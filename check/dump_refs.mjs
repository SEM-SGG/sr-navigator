// Auszug des Verweis-Index für die Gegenprüfung: { unit: [interne Ziel-Einheiten] } (ohne unsichere)
import { readFileSync, writeFileSync } from 'node:fs';
const R = await import('../src/core/refs.js');
const lib = JSON.parse(readFileSync('../data/library.json', 'utf8'));
const [wid, lang, stage, out] = process.argv.slice(2);
const t0 = performance.now();
const idx = R.buildRefIndex(lib.works[wid], lang, stage, { works: R.worksFromLibrary(lib) });
const ms = Math.round(performance.now() - t0);
const m = {};
for (const r of idx.refs) { if (r.uncertain || r.to.kind !== 'internal' || !r.to.unit) continue; if (r.to.unit === r.from.unit) continue; (m[r.from.unit] ||= new Set()).add(r.to.unit); }
writeFileSync(out, JSON.stringify(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]))));
console.log(wid, lang, stage, JSON.stringify(idx.stats), 'ms', ms);
