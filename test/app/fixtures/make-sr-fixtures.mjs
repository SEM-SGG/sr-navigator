// Erzeugt kleine Fixtures im Bundle-Schema 2 (SPEC §5) aus raw/ für die UI-Tests, solange data/library.json fehlt.
// Verwendet den Ersatzparser der Oberfläche (src/app/fedlex-fallback.js), unabhängig vom Parser des Agents DATEN;
// nur für Tests gedacht, nicht für den Prüfbericht.
// Aufruf: node test/app/fixtures/make-sr-fixtures.mjs  → test/app/fixtures/library.json
// raw/ ist NUR DATEN: Dateien werden gelesen und ausgewertet, nichts daraus wird ausgeführt.
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';
import { buildBundle } from '../../../src/app/fedlex-fallback.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const RAW = join(ROOT, 'raw');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** Eingabe für buildBundle aus raw/<id>/ (dieselbe Form, die fetchWorkMeta liefert). */
export function rawInput(id, { maxStages } = {}) {
  const dir = join(RAW, id);
  const vj = readJson(join(dir, 'versions.json'));
  const sp = (n) => (existsSync(join(dir, 'sparql', n + '.json')) ? readJson(join(dir, 'sparql', n + '.json')) : []);
  const texts = {};
  let withXml = vj.versions.filter((v) => existsSync(join(dir, `${v.date.replace(/-/g, '')}_de.xml`)));
  if (maxStages) withXml = withXml.slice(-maxStages);
  for (const v of withXml) for (const l of ['de', 'fr', 'it']) {
    const f = join(dir, `${v.date.replace(/-/g, '')}_${l}.xml`);
    if (existsSync(f)) texts[`${v.date.replace(/-/g, '')}_${l}`] = readFileSync(f, 'utf8');
  }
  return { meta: { id, uri: vj.work, work: sp('work'), taxonomy: sp('taxonomy') }, versions: vj.versions, impacts: sp('impacts'), pending: sp('pending'), texts, fetched: vj.fetched };
}

const sigU = (u) => JSON.stringify([u.title, u.blocks.map((b) => [b.k, b.t])]);
// AIG: Einheiten mit vielen Änderungen plus die ersten Artikel
const pickAig = (versions) => {
  const cnt = new Map();
  let prev = new Map();
  for (const p of versions) {
    const cur = new Map(p.units.map((u) => [u.id, sigU(u)]));
    for (const [id, s] of cur) if (prev.has(id) && prev.get(id) !== s) cnt.set(id, (cnt.get(id) || 0) + 1);
    prev = cur;
  }
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  return [...new Set(['preamble', 'art_1', 'art_2', 'art_3', 'art_5', 'art_10', ...top, 'disp_u1'])];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const make = (id, opts = {}) => { const inp = rawInput(id); return buildBundle(inp, { DOMParser, fetched: inp.fetched, ...opts }); };
  const works = {
    'cc-2007-758': make('cc-2007-758', { pick: pickAig }),
    'cc-2021-734': make('cc-2021-734'),
  };
  void readdirSync;
  const lib = { schema: 2, generated: '2026-11-12', fixtures: true, order: ['cc-2007-758', 'cc-2021-734'], works };
  const out = join(here, 'library.json');
  writeFileSync(out + '.tmp', JSON.stringify(lib));
  renameSync(out + '.tmp', out);
  for (const [id, w] of Object.entries(works)) console.log(id, 'Stände', w.stages.length, 'Einheiten', Object.keys(w.units).length, 'Akte', w.acts.length, 'Zeitstrahl', w.timeline.length);
  console.log('→', out, (JSON.stringify(lib).length / 1024).toFixed(0), 'KB');
}
