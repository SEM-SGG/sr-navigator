// fetch-Ersatz, der aus raw/ antwortet (für Build und Tests). SPARQL-Antworten liegen in raw/<id>/fedlex/<hash>.json
// (erzeugt von scripts/fetch-meta.mjs), Volltexte in raw/<id>/<JJJJMMTT>_<lang>.xml. raw/ ist nur Daten.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashString } from '../../src/core/text.js';
import { ENDPOINT } from '../../src/core/fedlex.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RAW = join(ROOT, 'raw');

const bodyOf = (init) => (init && typeof init.body === 'string' ? init.body : '');
export const queryKey = (body) => hashString(body);

function response(status, text, type) {
  return { ok: status >= 200 && status < 300, status, headers: { get: (h) => (/content-type/i.test(h) ? type : null) }, text: async () => text, json: async () => JSON.parse(text) };
}

// Antworten aus raw/; stats zählt Zugriffe; missing sammelt fehlende Antworten
export function rawFetch(workId, { stats = { sparql: 0, files: 0 }, missing = [] } = {}) {
  const dir = join(RAW, workId);
  return async (url, init) => {
    if (url === ENDPOINT) {
      stats.sparql++;
      const f = join(dir, 'fedlex', queryKey(bodyOf(init)) + '.json');
      if (!existsSync(f)) { missing.push({ url, body: bodyOf(init).slice(0, 200) }); return response(404, 'not cached', 'text/plain'); }
      const j = JSON.parse(readFileSync(f, 'utf8'));
      return response(200, JSON.stringify(j.response), 'application/sparql-results+json');
    }
    const m = /\/eli\/cc\/\d+\/[^/]+\/(\d{8})\/(de|fr|it)\/xml\//.exec(url);
    if (m) {
      stats.files++;
      const f = join(dir, `${m[1]}_${m[2]}.xml`);
      if (!existsSync(f)) { missing.push({ url }); return response(404, 'not found', 'text/plain'); }
      return response(200, readFileSync(f, 'utf8'), 'application/xml');
    }
    missing.push({ url });
    return response(404, 'unknown', 'text/plain');
  };
}

// Echter fetch, der jede SPARQL-Antwort nach raw/<id>/fedlex/ schreibt
export function recordingFetch(workId, realFetch = globalThis.fetch) {
  const dir = join(RAW, workId, 'fedlex');
  mkdirSync(dir, { recursive: true });
  return async (url, init) => {
    const r = await realFetch(url, init);
    if (url !== ENDPOINT) return r;
    const text = await r.text();
    if (r.ok) writeFileSync(join(dir, queryKey(bodyOf(init)) + '.json'), JSON.stringify({ query: decodeURIComponent(bodyOf(init).replace(/^query=/, '')), fetched: new Date().toISOString(), response: JSON.parse(text) }));
    return response(r.status, text, r.headers.get('content-type'));
  };
}
