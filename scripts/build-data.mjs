// Baut data/library.json aus raw/ mit derselben Kernlogik wie der Browser (fetchWorkMeta + buildBundle).
// Aufruf: node scripts/build-data.mjs [cc-2021-734 …]   (ohne Argument: alle eingebetteten Erlasse)
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DOMParser } from 'linkedom';
import { buildBundle } from '../src/core/model.js';
import { fetchWorkMeta, fetchActsMeta, actIdsInTexts } from '../src/core/fedlex.js';
import { rawFetch, RAW, ROOT } from './lib/rawfetch.mjs';

export const EMBEDDED = ['cc-2007-758', 'cc-2007-759', 'cc-2018-493', 'cc-1999-358', 'cc-2021-734'];
export const LANGS = ['de', 'fr', 'it'];

export function fetchedDate(id) {
  const dir = join(RAW, id, 'fedlex');
  let d = null;
  for (const f of readdirSync(dir)) { const j = JSON.parse(readFileSync(join(dir, f), 'utf8')); const x = (j.fetched || '').slice(0, 10); if (!d || x > d) d = x; }
  return d;
}

export async function buildFromRaw(id, { log } = {}) {
  const missing = [];
  const fetch = rawFetch(id, { missing });
  const m = await fetchWorkMeta(id, { fetch });
  const dir = join(RAW, id);
  const texts = new Map(readdirSync(dir).filter((f) => /^\d{8}_(de|fr|it)\.xml$/.test(f)).sort().map((f) => [f.slice(0, 11), readFileSync(join(dir, f), 'utf8')]));
  // nur Texte, die laut Metadaten zu einer Fassung gehören
  const known = new Set();
  for (const v of m.versions) for (const l of LANGS) if (v.files[l] && v.files[l].xml) known.add(`${v.date.replace(/-/g, '')}_${l}`);
  for (const k of [...texts.keys()]) if (!known.has(k)) texts.delete(k);
  const extra = actIdsInTexts(texts).filter((a) => !m.actsMeta[a]);
  if (extra.length) Object.assign(m.actsMeta, await fetchActsMeta(extra, { fetch }));
  if (missing.length) throw new Error(`${id}: fehlende Antworten in raw/: ${missing.length} (node scripts/fetch-meta.mjs ${id})`);
  const t0 = Date.now();
  const b = await buildBundle({ ...m, texts, fetched: fetchedDate(id) }, { DOMParser, langs: LANGS, log, yield: false });
  return { bundle: b, ms: Date.now() - t0, files: texts.size };
}

export function writeAtomic(file, text) {
  const tmp = file + '.tmp-' + process.pid;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : EMBEDDED;
  const out = join(ROOT, 'data', 'library.json');
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  const lib = existsSync(out) && process.argv.slice(2).length ? JSON.parse(readFileSync(out, 'utf8')) : { schema: 2, generated: null, order: [], works: {} };
  const logs = {};
  for (const id of ids) {
    const log = [];
    const { bundle, ms, files } = await buildFromRaw(id, { log });
    lib.works[id] = bundle;
    logs[id] = log;
    const units = Object.keys(bundle.units).length;
    const versions = Object.values(bundle.units).reduce((n, u) => n + Object.values(u.versions).reduce((m, v) => m + v.length, 0), 0);
    console.log(`${id}: ${files} Dateien, ${bundle.stages.length} Stände, ${units} Einheiten, ${versions} Versionen, ${bundle.acts.length} Erlasse, ${(ms / 1000).toFixed(1)} s`);
  }
  lib.schema = 2;
  lib.generated = new Date().toISOString().slice(0, 10);
  lib.order = EMBEDDED.filter((x) => lib.works[x]);
  writeAtomic(out, JSON.stringify(lib));
  writeAtomic(join(ROOT, 'data', 'build-log.json'), JSON.stringify(logs));
  console.log(`data/library.json: ${(JSON.stringify(lib).length / 1e6).toFixed(2)} MB`);
}
