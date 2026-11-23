// Lädt die Metadaten (SPARQL-Antworten der Abfragen in src/core/fedlex.js) nach raw/<id>/fedlex/ (Agent DATEN).
// Aufruf: node scripts/fetch-meta.mjs cc-2007-758 cc-2007-759 …   Volltexte lädt scripts/fetch-raw.mjs (Orchestrator).
// Nimmt auch die Form cc/2007/758 an.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchWorkMeta, fetchActsMeta, actIdsInTexts } from '../src/core/fedlex.js';
import { recordingFetch, RAW } from './lib/rawfetch.mjs';

/**
 * Lädt die Metadaten eines Werks und gleicht sie mit den Volltexten in raw/ ab.
 * Ergebnis { id, versions, missingFiles, diffs }; diffs: Volltexte, deren Adresse von den Metadaten abweicht.
 */
export async function fetchMeta(work) {
  const id = String(work).replace(/\//g, '-');
  const fetch = recordingFetch(id);
  const m = await fetchWorkMeta(id, { fetch });
  const dir = join(RAW, id);
  const texts = new Map(readdirSync(dir).filter((f) => /^\d{8}_(de|fr|it)\.xml$/.test(f)).map((f) => [f.slice(0, 11), readFileSync(join(dir, f), 'utf8')]));
  const extra = actIdsInTexts(texts).filter((a) => !m.actsMeta[a]);
  await fetchActsMeta(extra, { fetch });
  // Abgleich mit den Volltexten in raw/
  const rv = existsSync(join(dir, 'versions.json')) ? JSON.parse(readFileSync(join(dir, 'versions.json'), 'utf8')) : { versions: [] };
  const rawUrls = new Map();
  for (const v of rv.versions) for (const [l, f] of Object.entries(v.files)) if (f.xml) rawUrls.set(`${v.date.replace(/-/g, '')}_${l}`, f.xml);
  const diffs = [], missingFiles = [];
  for (const v of m.versions) for (const l of ['de', 'fr', 'it']) {
    const u = v.files[l] && v.files[l].xml;
    if (!u) continue;
    const key = `${v.date.replace(/-/g, '')}_${l}`;
    if (!texts.has(key)) missingFiles.push(key);
    else if (rawUrls.get(key) && rawUrls.get(key) !== u) diffs.push({ key, raw: rawUrls.get(key), now: u });
  }
  console.log(`${id}: ${m.versions.length} Fassungen, ${m.impacts.length} Impacts, ${m.pending.length} Vorhaben, Akte ${Object.keys(m.actsMeta).length}+${extra.length}; fehlende XML in raw/: ${missingFiles.join(', ') || 'keine'}; abweichende Datei-URLs: ${diffs.length}`);
  for (const d of diffs) console.log('   ', d.key, d.raw.split('/').pop(), '->', d.now.split('/').pop());
  return { id, versions: m.versions.length, missingFiles, diffs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const id of process.argv.slice(2)) await fetchMeta(id);
}
