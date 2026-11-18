// Ersatz für die Modellfunktionen aus SPEC §6 (src/core/model.js), solange die Kernbibliothek sie nicht liefert.
// Generisch: kennt Erlass, Stände, Einheiten, Blöcke und Erlasse (Bundle schema 2).

const ordCache = new WeakMap();
function orders(ds) {
  let m = ordCache.get(ds);
  if (!m) {
    m = new Map();
    ds.stages.forEach((s, i) => m.set(s.id, typeof s.order === 'number' ? s.order : i));
    ordCache.set(ds, m);
  }
  return m;
}
const ord = (ds, id) => orders(ds).get(id) ?? -1;
const sortedVersions = (ds, unitId, lang) => {
  const u = ds.units[unitId];
  if (!u || !u.versions || !u.versions[lang]) return [];
  return [...u.versions[lang]].sort((a, b) => ord(ds, a.stage) - ord(ds, b.stage));
};
/** Vergleichssignatur eines Blocks: Wortlaut, Gliederungszeichen und Tabelle (ohne Fussnoten und Herkunft). */
export const blockSig = (b) => (b ? `${b.l || ''}\u0001${b.t || ''}\u0001${b.html || ''}\u0001${b.src || ''}` : null);

export function getVersion(ds, unitId, lang, stageId) {
  const target = ord(ds, stageId);
  let best = null;
  for (const v of sortedVersions(ds, unitId, lang)) if (ord(ds, v.stage) <= target) best = v;
  return best;
}

const stageActs = (ds, id) => ((ds.stages.find((s) => s.id === id) || {}).acts || []);
const changeOf = (b, fallback) => (b && b.x === 'editorial' ? 'editorial' : b && b.ch === 'amended' ? 'amended' : fallback);

export function blockHistory(ds, unitId, lang, key) {
  const out = [];
  let prev; // undefined = noch keine Version gesehen
  const first = ds.stages[0] && ds.stages[0].id;
  for (const v of sortedVersions(ds, unitId, lang)) {
    const b = v.repealed ? null : (v.blocks || []).find((x) => x.k === key) || null;
    const act = (b && b.o) || stageActs(ds, v.stage)[0] || null;
    if (prev === undefined) {
      if (b) out.push({ stage: v.stage, act, change: v.stage === first ? 'base' : 'inserted', block: b });
      prev = b;
      continue;
    }
    if (!b && prev) out.push({ stage: v.stage, act: stageActs(ds, v.stage)[0] || null, change: v.repealed ? 'repealed' : 'deleted', block: null });
    else if (b && !prev) out.push({ stage: v.stage, act, change: 'inserted', block: b });
    else if (b && prev && blockSig(b) !== blockSig(prev)) out.push({ stage: v.stage, act, change: changeOf(b, 'replaced'), block: b });
    prev = b;
  }
  return out;
}

export function changesOfStage(ds, stageId, lang) {
  const out = [];
  const o = ord(ds, stageId);
  const sa = stageActs(ds, stageId)[0] || null;
  for (const unitId of Object.keys(ds.units)) {
    const vs = sortedVersions(ds, unitId, lang);
    const i = vs.findIndex((v) => v.stage === stageId);
    if (i < 0) continue;
    const v = vs[i];
    const p = vs.slice(0, i).filter((x) => ord(ds, x.stage) < o).pop();
    if (!p) { if (i === 0 && ds.stages[0].id !== stageId) out.push({ unit: unitId, key: null, change: 'inserted', act: ((v.blocks || [])[0] || {}).o || sa }); continue; }
    if (v.repealed && !p.repealed) { out.push({ unit: unitId, key: null, change: 'repealed', act: sa }); continue; }
    if (!v.repealed && p.repealed) { out.push({ unit: unitId, key: null, change: 'inserted', act: ((v.blocks || [])[0] || {}).o || sa }); continue; }
    const pm = new Map((p.blocks || []).map((b) => [b.k, b]));
    const nm = new Map((v.blocks || []).map((b) => [b.k, b]));
    for (const b of v.blocks || []) {
      if (!pm.has(b.k)) out.push({ unit: unitId, key: b.k, change: 'inserted', act: b.o || sa });
      else if (blockSig(pm.get(b.k)) !== blockSig(b)) out.push({ unit: unitId, key: b.k, change: changeOf(b, 'replaced'), act: b.o || sa });
    }
    for (const b of p.blocks || []) if (!nm.has(b.k)) out.push({ unit: unitId, key: b.k, change: 'deleted', act: sa });
    if ((v.title || '') !== (p.title || '') && !out.some((c) => c.unit === unitId)) out.push({ unit: unitId, key: null, change: 'amended', act: sa });
  }
  return out;
}

/** Jüngster Stand mit date <= isoDate, sonst null. */
export function stageAt(ds, isoDate) {
  let best = null;
  for (const s of ds.stages) if (s.date <= isoDate && (!best || s.date >= best.date)) best = s;
  return best ? best.id : null;
}

/** Ereignisliste je Einheit (aufsteigend): aus acts[].changes, ergänzt um Änderungshinweise in den Fussnoten aller Fassungen. */
export function unitEvents(ds, unitId) {
  const out = [];
  const seen = new Set();
  const add = (e) => {
    const k = `${e.act}|${e.key || ''}|${e.date || ''}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  for (const a of ds.acts || []) for (const c of a.changes || []) if (c.unit === unitId) add({ date: c.inForce || null, act: a.id, action: c.action || 'other', key: c.key || null, stage: c.stage || null, src: c.src || [] });
  const u = ds.units[unitId];
  const lang = (ds.langs || ['de'])[0];
  if (u && u.versions && u.versions[lang]) {
    for (const v of u.versions[lang]) for (const b of v.blocks || []) for (const f of b.fn || []) {
      if (!f.act || f.kind === 'ref' || !f.inForce) continue;
      const stage = (ds.stages.find((s) => s.date >= f.inForce) || {}).id || null;
      const firstDate = ds.stages[0] ? ds.stages[0].date : '';
      add({ date: f.inForce, act: f.act, action: b.ch || 'other', key: b.k, stage: f.inForce < firstDate ? null : stage, src: ['footnote'] });
    }
  }
  out.sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')) || String(x.key || '').localeCompare(String(y.key || '')));
  return out;
}

/** Alle Erlasse, die die Einheit geprägt haben (ohne Grunderlass), nach Inkrafttreten. */
export function unitActs(ds, unitId, lang) {
  const base = ds.work && ds.work.base;
  const date = new Map();
  for (const e of unitEvents(ds, unitId)) if (e.act && e.act !== base) date.set(e.act, date.has(e.act) ? date.get(e.act) : e.date || '9999');
  const u = ds.units[unitId];
  if (u && u.versions && u.versions[lang]) for (const v of u.versions[lang]) for (const b of v.blocks || []) if (b.o && b.o !== base && !date.has(b.o)) date.set(b.o, '9999');
  return [...date.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])).map(([a]) => a);
}
