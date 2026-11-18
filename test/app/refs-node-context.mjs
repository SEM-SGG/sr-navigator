// Kontext für die Modellfunktionen in Node (Test): gleiche Regeln wie refsContext() in src/app/data.js, aber ohne Data-Klasse.
// Stand: heute in Kraft; übrige Erlasse der Bibliothek am Stand, der am selben Datum in Kraft ist.
const UNIT_TYPES = new Set(['article', 'annex', 'preamble', 'final']);

export function unitOrderOf(b) {
  const units = b.units || {};
  const toc = (b.toc || []).filter((e) => UNIT_TYPES.has(e.type) && units[e.id]).map((e) => e.id);
  return [...toc, ...Object.keys(units).filter((id) => !toc.includes(id))];
}
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function buildContextNode({ lib, refs, model, workId, lang = 'de', today = localIso(new Date()) }) {
  const works = refs.worksFromLibrary(lib);
  const b = lib.works[workId];
  const stage = model.stageAt(b, today) || b.stages[0].id;
  const date = b.stages.find((s) => s.id === stage).date;
  const index = refs.buildRefIndex(b, lang, stage, { works });
  const others = [];
  for (const id of lib.order) {
    if (id === workId) continue;
    const ob = lib.works[id];
    const sid = model.stageAt(ob, date);
    if (sid) others.push({ work: id, stage: sid, index: refs.buildRefIndex(ob, lang, sid, { works }) });
  }
  const pos = new Map(lib.order.map((id) => [id, new Map(unitOrderOf(lib.works[id]).map((u, i) => [u, i]))]));
  const ctx = { work: workId, lang, stage, date, index, others, libOrder: lib.order, unitPos: (w, u) => (pos.get(w) && pos.get(w).has(u) ? pos.get(w).get(u) : Infinity) };
  const units = unitOrderOf(b);
  const tocById = new Map((b.toc || []).map((e) => [e.id, e]));
  const topOf = (u) => { let e = tocById.get(u); let top = e ? e.id : u; while (e && e.parent && tocById.has(e.parent)) { e = tocById.get(e.parent); top = e.id; } return top; };
  const ver = (u) => { const v = model.getVersion(b, u, lang, stage); return v && !v.missing && !v.repealed ? v : null; };
  const columns = units.filter((u) => ver(u)).map((u) => ({ unit: u, top: topOf(u) }));
  const blocksOf = (u) => { const v = ver(u); return v ? (v.blocks || []).filter((x) => x.ty !== 'heading').map((x) => x.k) : []; };
  return { ctx, columns, units, blocksOf, works };
}
