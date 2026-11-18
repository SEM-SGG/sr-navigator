// Verweisstruktur eines Erlasses (SPEC §12.3 C): reine Modellfunktionen ohne DOM, mit node --test prüfbar.
// Kontext wie in refsgraph-model.js. Die Zählung läuft hier in einem Durchgang über den ganzen Index (statt je Einheit),
// folgt aber denselben Regeln; der Test «Netz gleich Struktur» vergleicht beide Wege über alle Einheiten.
import { targetNode, sourceNode, targetWork, fundKey, isEdge, groupOf } from './refsgraph-model.js';

/**
 * columns: [{ unit, top }] in der Reihenfolge der Gliederung (top: Kennung der obersten Gliederungsebene, für das Band).
 * Liefert {
 *   columns: [{ unit, i, top }],
 *   bands: [{ top, from, to }],                       // zusammenhängende Spalten derselben obersten Ebene
 *   arcs: [{ a, b, nab, nba, n }],                    // a < b (Spaltenindex), Fundstellen a→b und b→a
 *   rows: [{ group, work, cells: Map(i → n), total }], // je Bibliotheks-Erlass, dann 'sr', dann 'eu'
 *   units: Map(unit → { inUnits, inRefs, outNodes, outRefs, nodes, refs, uncertain, outSelf, outLib: {w: n}, outSr, outEu, inSelf, inLib }),
 *   totals: { refs, arcs, uncertain }
 * }
 */
export function structureModel(ctx, columns) {
  const own = ctx.work;
  const col = new Map(columns.map((c, i) => [c.unit, i]));
  const cols = columns.map((c, i) => ({ unit: c.unit, i, top: c.top == null ? null : c.top }));
  const bands = [];
  for (const c of cols) {
    const last = bands[bands.length - 1];
    if (last && last.top === c.top) last.to = c.i;
    else bands.push({ top: c.top, from: c.i, to: c.i });
  }
  // Ausgehend: je Quell-Einheit je Ziel-Knoten die Fundstellen
  const out = new Map(); // unit → Map(nodeId → { node, fund:Set })
  const unc = new Map(); // unit → Set
  for (const r of (ctx.index && ctx.index.refs) || []) {
    if (!r.from) continue;
    const u = r.from.unit;
    if (r.uncertain) { if (!unc.has(u)) unc.set(u, new Set()); unc.get(u).add(fundKey(own, r)); continue; }
    if (!isEdge(r, own)) continue;
    const node = targetNode(r.to, own, own);
    if (!out.has(u)) out.set(u, new Map());
    const m = out.get(u);
    if (!m.has(node.id)) m.set(node.id, { node, fund: new Set() });
    m.get(node.id).fund.add(fundKey(own, r));
  }
  // Eingehend: je Ziel-Einheit des eigenen Erlasses je Quell-Einheit
  const inc = new Map(); // unit → Map(sourceId → { node, fund:Set })
  for (const src of [{ work: own, index: ctx.index }, ...(ctx.others || [])]) {
    for (const r of (src.index && src.index.refs) || []) {
      if (!r.to || !r.to.unit || targetWork(r.to, src.work) !== own) continue;
      if (!isEdge(r, src.work)) continue;
      const node = sourceNode(r.from, src.work, own);
      const u = r.to.unit;
      if (!inc.has(u)) inc.set(u, new Map());
      const m = inc.get(u);
      if (!m.has(node.id)) m.set(node.id, { node, fund: new Set() });
      m.get(node.id).fund.add(fundKey(src.work, r));
    }
  }
  // Kennzahlen je Einheit
  const units = new Map();
  const allUnits = new Set([...columns.map((c) => c.unit), ...out.keys(), ...inc.keys(), ...unc.keys()]);
  for (const u of allUnits) {
    const o = out.get(u) || new Map(), n = inc.get(u) || new Map();
    const s = { inUnits: n.size, inRefs: 0, outNodes: o.size, outRefs: 0, nodes: 0, refs: 0, uncertain: (unc.get(u) || new Set()).size, outSelf: 0, outLib: {}, outSr: 0, outEu: 0, inSelf: 0, inLib: {} };
    const ids = new Set();
    for (const [id, e] of o) {
      ids.add(id);
      const k = e.fund.size;
      s.outRefs += k;
      const g = groupOf(e.node, own);
      if (g === 'self') s.outSelf += k;
      else if (g.startsWith('lib:')) s.outLib[e.node.work] = (s.outLib[e.node.work] || 0) + k;
      else if (g === 'eu') s.outEu += k;
      else s.outSr += k;
    }
    for (const [id, e] of n) {
      ids.add(id);
      const k = e.fund.size;
      s.inRefs += k;
      if (e.node.kind === 'self') s.inSelf += k;
      else s.inLib[e.node.work] = (s.inLib[e.node.work] || 0) + k;
    }
    s.nodes = ids.size;
    s.refs = s.inRefs + s.outRefs;
    units.set(u, s);
  }
  // Bögen zwischen Spalten des eigenen Erlasses (je ungeordnetes Paar)
  const arcs = new Map();
  for (const [u, m] of out) {
    const a = col.get(u);
    if (a == null) continue;
    for (const e of m.values()) {
      if (e.node.kind !== 'self' || !e.node.unit) continue;
      const b = col.get(e.node.unit);
      if (b == null || b === a) continue; // Ziel fehlt am Stand oder ohne Spalte: keine Bogen, aber gezählt
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const id = lo + '|' + hi;
      if (!arcs.has(id)) arcs.set(id, { a: lo, b: hi, nab: 0, nba: 0, n: 0 });
      const x = arcs.get(id);
      if (a === lo) x.nab += e.fund.size; else x.nba += e.fund.size;
      x.n += e.fund.size;
    }
  }
  // Zeilen: je Bibliotheks-Erlass, auf den verwiesen wird, dann übrige SR-Erlasse und EU-Rechtsakte
  const rowMap = new Map();
  const libOrder = (ctx.libOrder || []).filter((w) => w !== own);
  for (const w of libOrder) rowMap.set('lib:' + w, { group: 'lib:' + w, work: w, cells: new Map(), total: 0 });
  rowMap.set('sr', { group: 'sr', work: null, cells: new Map(), total: 0 });
  rowMap.set('eu', { group: 'eu', work: null, cells: new Map(), total: 0 });
  for (const [u, m] of out) {
    const i = col.get(u);
    for (const e of m.values()) {
      const g = groupOf(e.node, own);
      if (g === 'self') continue;
      if (!rowMap.has(g)) rowMap.set(g, { group: g, work: e.node.work || null, cells: new Map(), total: 0 });
      const row = rowMap.get(g);
      row.total += e.fund.size;
      if (i != null) row.cells.set(i, (row.cells.get(i) || 0) + e.fund.size);
    }
  }
  const rows = [...rowMap.values()].filter((r) => r.group === 'sr' || r.group === 'eu' || r.total > 0);
  let refs = 0, uncertain = 0;
  for (const s of units.values()) { refs += s.outRefs; uncertain += s.uncertain; }
  return { columns: cols, bands, arcs: [...arcs.values()].sort((x, y) => (y.b - y.a) - (x.b - x.a)), rows, units, totals: { refs, arcs: arcs.size, uncertain } };
}

/** Deckkraftstufe einer Zelle: 1 · 2–3 · 4–7 · 8 und mehr (0 = leer). */
export const cellLevel = (n) => (!n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 7 ? 3 : 4);
export const arcStroke = (n) => 0.6 + Math.sqrt(Math.max(1, n)) * 0.7;

/** Bögen der gewählten Spalte: { out: [...], in: [...] } (beidseitig: in out). */
export function arcsOf(model, i) {
  const res = { out: [], in: [] };
  for (const a of model.arcs) {
    if (a.a !== i && a.b !== i) continue;
    const outN = a.a === i ? a.nab : a.nba;
    (outN > 0 ? res.out : res.in).push(a);
  }
  return res;
}

/**
 * Achsenbeschriftung ausdünnen: jede step-te Spalte, ohne Überlappung. colW: Spaltenbreite; labelW(i): Breite der
 * Beschriftung waagrecht; lineH: Zeilenhöhe (Platzbedarf gedreht). Liefert { rotate, step, show: [i…] }.
 */
export function thinLabels(n, colW, labelW, lineH = 14, gap = 4) {
  let maxW = 0;
  for (let i = 0; i < n; i++) maxW = Math.max(maxW, labelW(i));
  const rotate = maxW + gap > colW;
  const need = rotate ? lineH + gap / 2 : maxW + gap;
  const raw = Math.max(1, Math.ceil(need / colW));
  const nice = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100].find((s) => s >= raw) || raw;
  const show = [];
  for (let i = 0; i < n; i += nice) show.push(i);
  return { rotate, step: nice, show };
}

/** Bogen über der Achse zwischen den Spaltenmitten x1 < x2; Höhe nach Abstand, gedeckelt. */
export function arcPath(x1, x2, y0, maxH) {
  const rx = (x2 - x1) / 2;
  const ry = Math.min(maxH, Math.max(4, rx));
  return `M${x1.toFixed(1)},${y0} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 1 ${x2.toFixed(1)},${y0}`;
}
export const arcHeight = (x1, x2, maxH) => Math.min(maxH, Math.max(4, (x2 - x1) / 2));
