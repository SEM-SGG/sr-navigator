import { readFileSync } from 'node:fs';
const R = await import('../src/core/refs.js'); const m = await import('../src/core/model.js');
const lib = JSON.parse(readFileSync('../data/library.json', 'utf8'));
const [wid, lang, stage, ...units] = process.argv.slice(2); const ds = lib.works[wid];
const idx = R.buildRefIndex(ds, lang, stage, { works: R.worksFromLibrary(lib) });
for (const u of units) {
  const rs = idx.refs.filter((r) => r.from.unit === u); const v = m.getVersion(ds, u, lang, stage);
  console.log(u, v ? `Version ${v.stage}${v.missing ? ' missing' : ''}, ${v.blocks.length} Blöcke` : 'keine Version', '| Refs:', rs.length);
  for (const r of rs) console.log('   ', r.from.key, `«${r.text}» →`, r.to.unit || r.to.label, r.to.kind !== 'internal' ? `[${r.to.kind}${r.to.work ? ' ' + r.to.work : ''}]` : '', r.uncertain ? `UNSICHER (${r.why})` : '', r.to.missing ? 'MISSING' : '');
}
