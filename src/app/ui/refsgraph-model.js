// Verweisnetz einer Bestimmung (SPEC §12.3 A): reine Modellfunktionen ohne DOM, mit node --test prüfbar.
//
// Kontext (ctx), von der Adapter-Schicht bzw. im Test von Hand gebaut:
//   ctx = {
//     work: 'cc-2007-758',                // eigener Erlass
//     index: RefIndex,                    // Verweis-Index des eigenen Erlasses am betrachteten Stand (SPEC §12.2)
//     others: [{ work, index }],          // übrige Erlasse der Bibliothek, je am Stand, der am selben Datum in Kraft ist
//     libOrder: ['cc-…', …],              // Reihenfolge der Bibliothek (Gruppen rechts)
//     unitPos(work, unit) → Zahl          // Position in der Gliederung (Sortierung); unbekannt: Infinity
//   }
//
// Zählregeln (gelten für Netz, Liste und Verweisstruktur gleich):
//   - Kanten verbinden Einheiten bzw. Ziel-Erlasse (Knoten), nicht Blöcke.
//   - Gewicht einer Kante = Zahl der Fundstellen, die die beiden Knoten verbinden. Eine Fundstelle ist eine Stelle im
//     Wortlaut (Erlass, Einheit, Block, Position). Nennt eine Fundstelle mehrere Ziele derselben Einheit («Artikel 5
//     Absätze 1 und 2»), zählt sie für diese Kante einmal; nennt sie Ziele in mehreren Einheiten («Artikel 10–12»),
//     zählt sie für jede dieser Kanten einmal.
//   - Unsichere Verweise (uncertain) sind keine Kanten; ihre Zahl (ausgehend) steht als Hinweis.
//   - Verweise innerhalb derselben Einheit sind keine Kanten.
//   - Umfang «Bestimmung» (key gesetzt): ausgehend die Fundstellen im Block und in seinen Unterblöcken (p1 umfasst p1.a);
//     eingehend die Verweise auf den Block, auf einen Unterblock oder auf einen übergeordneten Block (nicht auf die
//     ganze Einheit). Umfang «ganzer Artikel» (key null): alle Fundstellen der Einheit bzw. alle Verweise auf sie.

export const LIMITS_PANEL = { left: 7, group: 4 };

/** Liegt Schlüssel k im Block key oder darunter? */
export const keyWithin = (k, key) => !!k && (k === key || k.startsWith(key + '.'));
/** Eingehender Verweis auf Ziel-Schlüssel tk trifft die Bestimmung key (gleich, darunter oder darüber; nicht die ganze Einheit). */
export const keyHits = (tk, key) => !!tk && (tk === key || tk.startsWith(key + '.') || key.startsWith(tk + '.'));

/** Erlass, in dem das Ziel liegt (Bibliotheks-Id), oder null. */
export function targetWork(to, srcWork) {
  if (!to) return null;
  if (to.kind === 'internal') return to.work || srcWork;
  return to.work || null;
}

/** Gruppe rechts: self (eigener Erlass), lib:<id> (Erlass der Bibliothek), sr (übrige SR-Erlasse), eu (EU-Rechtsakte). */
export function groupOf(node, own) {
  if (node.kind === 'self' || (node.work && node.work === own)) return 'self';
  if (node.kind === 'lib') return 'lib:' + node.work;
  if (node.kind === 'eu') return 'eu';
  return 'sr';
}

const euKey = (eu) => (eu ? (eu.celex || `${eu.type || ''}:${eu.year || ''}/${eu.no || ''}`) : '');

/** Knoten (Ziel) eines Verweises aus Erlass srcWork; own = eigener Erlass des Netzes. */
export function targetNode(to, srcWork, own) {
  const w = targetWork(to, srcWork);
  if (w) {
    const kind = w === own ? 'self' : 'lib';
    if (to.unit) return { id: `u|${w}|${to.unit}`, kind, work: w, unit: to.unit };
    return { id: `w|${w}`, kind, work: w, unit: null };
  }
  // Erlasse ausserhalb der Bibliothek: ein Knoten je Erlass (wie edges() im Kern ohne externalUnits); die Liste nennt die
  // einzelnen Ziele.
  if (to.kind === 'eu') return { id: `eu|${euKey(to.eu) || to.label}`, kind: 'eu', eu: to.eu || null, unit: null, label: to.label };
  const act = to.sr || to.eli || to.abbr || to.title || to.label;
  return { id: `sr|${act}`, kind: to.kind === 'other' ? 'other' : 'sr', sr: to.sr || null, eli: to.eli || null, abbr: to.abbr || null, title: to.title || null, unit: null, label: to.label };
}

/** Quelle (Einheit) eines eingehenden Verweises aus Erlass srcWork. */
export function sourceNode(from, srcWork, own) {
  return { id: `u|${srcWork}|${from.unit}`, kind: srcWork === own ? 'self' : 'lib', work: srcWork, unit: from.unit };
}

/** Kennung einer Fundstelle: Nummer des Zitats (cid) im Index des Quell-Erlasses, sonst Einheit, Block und Position. */
export const fundKey = (srcWork, r) => (r.cid != null ? `${srcWork}#${r.cid}` : `${srcWork}|${r.from.unit}|${r.from.key || ''}|${r.at ? r.at[0] + '-' + r.at[1] : r.text || ''}`);

/** Ist der Verweis eine Kante? (nicht unsicher, nicht innerhalb derselben Einheit) */
export function isEdge(r, srcWork) {
  if (!r || r.uncertain || !r.to || !r.from) return false;
  const w = targetWork(r.to, srcWork);
  return !(w === srcWork && r.to.unit && r.to.unit === r.from.unit);
}

function addEdge(map, node, fk, ref, srcWork) {
  let e = map.get(node.id);
  if (!e) { e = { ...node, fund: new Set(), refs: [], keys: new Set(), missing: false }; map.set(node.id, e); }
  e.fund.add(fk);
  e.refs.push({ ...ref, srcWork });
  if (ref.to && ref.to.missing) e.missing = true;
  return e;
}

const finish = (e) => {
  const out = { ...e, n: e.fund.size };
  delete out.fund;
  delete out.keys;
  return out;
};

/** Ausgehende Kanten einer Einheit (bzw. Bestimmung). Liefert { edges: Map id → Kante, uncertain: Zahl der Fundstellen }. */
export function outgoing(ctx, unit, key = null) {
  const own = ctx.work;
  const edges = new Map();
  const unc = new Set();
  for (const r of (ctx.index && ctx.index.refs) || []) {
    if (!r.from || r.from.unit !== unit) continue;
    if (key && !keyWithin(r.from.key, key)) continue;
    if (r.uncertain) { unc.add(fundKey(own, r)); continue; }
    if (!isEdge(r, own)) continue;
    addEdge(edges, targetNode(r.to, own, own), fundKey(own, r), r, own);
  }
  return { edges, uncertain: unc.size };
}

/** Eingehende Kanten einer Einheit (bzw. Bestimmung) aus dem eigenen Erlass und den übrigen Erlassen der Bibliothek. */
export function incoming(ctx, unit, key = null) {
  const own = ctx.work;
  const edges = new Map();
  const sources = [{ work: own, index: ctx.index }, ...(ctx.others || [])];
  for (const src of sources) {
    for (const r of (src.index && src.index.refs) || []) {
      if (!r.to || r.to.unit !== unit) continue;
      if (targetWork(r.to, src.work) !== own) continue;
      if (key ? !keyHits(r.to.key, key) : false) continue;
      if (!isEdge(r, src.work)) continue;
      addEdge(edges, sourceNode(r.from, src.work, own), fundKey(src.work, r), r, src.work);
    }
  }
  return { edges };
}

/** Kennzahlen aus ein- und ausgehenden Kanten (gleiche Zählung in Netz, Liste und Struktur). */
export function edgeStats(inEdges, outEdges, uncertain = 0) {
  const ins = [...inEdges.values()], outs = [...outEdges.values()];
  const sum = (l) => l.reduce((s, e) => s + (e.n != null ? e.n : e.fund.size), 0);
  const ids = new Set([...ins.map((e) => e.id), ...outs.map((e) => e.id)]);
  return { inUnits: ins.length, inRefs: sum(ins), outNodes: outs.length, outRefs: sum(outs), nodes: ids.size, refs: sum(ins) + sum(outs), uncertain };
}

/** Sortierung: Zahl der Fundstellen absteigend, dann Bibliothek (eigener Erlass zuerst), dann Gliederung. */
function sorter(ctx) {
  const lo = (w) => (w === ctx.work ? -1 : (ctx.libOrder || []).indexOf(w));
  const pos = (e) => (e.unit && ctx.unitPos ? ctx.unitPos(e.work || ctx.work, e.unit) : Infinity);
  return (a, b) => b.n - a.n || lo(a.work) - lo(b.work) || (pos(a) - pos(b)) || String(a.label || a.id).localeCompare(String(b.label || b.id));
}
/** Sortierung innerhalb einer Gruppe rechts: Gliederung bzw. Bezeichnung (gleich bleibende Lesereihenfolge), Gewicht zuerst bei Kürzung. */
function groupSorter(ctx) {
  const pos = (e) => (e.unit && ctx.unitPos ? ctx.unitPos(e.work || ctx.work, e.unit) : Infinity);
  return (a, b) => b.n - a.n || (pos(a) - pos(b)) || String(a.label || a.id).localeCompare(String(b.label || b.id), 'de', { numeric: true });
}

/** Reihenfolge der Gruppen rechts. */
export function groupOrder(ctx) {
  return ['self', ...(ctx.libOrder || []).filter((w) => w !== ctx.work).map((w) => 'lib:' + w), 'sr', 'eu'];
}

/**
 * Ego-Netz einer Bestimmung (key) bzw. einer ganzen Einheit (key null).
 * limits: { left, group } kürzt für die Leiste (Rest «n weitere»); null zeigt alles (Dialog).
 * Liefert { center, left, leftMore, right: [{ group, work, nodes, more, total }], stats }.
 */
export function egoGraph(ctx, unit, key = null, limits = null) {
  const out = outgoing(ctx, unit, key);
  const inc = incoming(ctx, unit, key);
  const stats = edgeStats(inc.edges, out.edges, out.uncertain);
  const left = [...inc.edges.values()].map(finish).map((e) => ({ ...e, side: 'left' })).sort(sorter(ctx));
  const groups = new Map(groupOrder(ctx).map((g) => [g, []]));
  for (const e of out.edges.values()) {
    const node = { ...finish(e), side: 'right' };
    const g = groupOf(node, ctx.work);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(node);
  }
  const gs = groupSorter(ctx);
  const right = [];
  for (const [g, nodes] of groups) {
    if (!nodes.length) continue;
    nodes.sort(gs);
    let shown = nodes;
    if (limits && limits.group != null && nodes.length > limits.group) shown = nodes.slice(0, limits.group);
    // Innerhalb der Gruppe in der Gliederung lesen (gezeigte Auswahl nach Gewicht, Anzeige nach Gliederung)
    const pos = (e) => (e.unit && ctx.unitPos ? ctx.unitPos(e.work || ctx.work, e.unit) : Infinity);
    shown = [...shown].sort((a, b) => (pos(a) - pos(b)) || String(a.label || a.id).localeCompare(String(b.label || b.id), 'de', { numeric: true }));
    right.push({ group: g, work: g.startsWith('lib:') ? g.slice(4) : g === 'self' ? ctx.work : null, nodes: shown, more: nodes.length - shown.length, total: nodes.length });
  }
  let leftShown = left;
  if (limits && limits.left != null && left.length > limits.left) leftShown = left.slice(0, limits.left);
  return {
    center: { id: `u|${ctx.work}|${unit}`, kind: 'self', work: ctx.work, unit, key: key || null },
    left: leftShown, leftMore: left.length - leftShown.length, leftTotal: left.length,
    right, stats,
  };
}

/** Die stärksten Verbindungen (ein- und ausgehend), absteigend nach Fundstellen. */
export function strongest(graph, n = 3) {
  const all = [...graph.left.map((e) => ({ ...e, dir: 'in' })), ...graph.right.flatMap((g) => g.nodes.map((e) => ({ ...e, dir: 'out' })))];
  return all.sort((a, b) => b.n - a.n || (a.dir === 'out' ? -1 : 1) - (b.dir === 'out' ? -1 : 1)).slice(0, n);
}

/** Einträge der Liste (Textfassung): je Kante die Fundstellen (eine Zeile je Fundstelle und Knoten, mit allen Refs der Fundstelle). */
export function listEntries(graph) {
  const items = (node) => {
    const m = new Map();
    for (const r of node.refs) {
      const k = fundKey(r.srcWork, r);
      if (!m.has(k)) m.set(k, { node, ref: r, refs: [] });
      m.get(k).refs.push(r);
    }
    return [...m.values()];
  };
  return {
    out: graph.right.map((g) => ({ group: g.group, work: g.work, items: g.nodes.flatMap(items) })),
    in: groupIncoming(graph.left).map((g) => ({ ...g, items: g.nodes.flatMap(items) })),
  };
}

/** Unsichere Fundstellen einer Einheit (bzw. Bestimmung), je Fundstelle einmal. */
export function uncertainRefs(ctx, unit, key = null) {
  const seen = new Set();
  const out = [];
  for (const r of (ctx.index && ctx.index.refs) || []) {
    if (!r.uncertain || !r.from || r.from.unit !== unit) continue;
    if (key && !keyWithin(r.from.key, key)) continue;
    const k = fundKey(ctx.work, r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...r, srcWork: ctx.work });
  }
  return out;
}
function groupIncoming(left) {
  const m = new Map();
  for (const n of left) {
    const g = n.kind === 'self' ? 'self' : 'lib:' + n.work;
    if (!m.has(g)) m.set(g, { group: g, work: n.work, nodes: [] });
    m.get(g).nodes.push(n);
  }
  return [...m.values()].sort((a, b) => (a.group === 'self' ? -1 : b.group === 'self' ? 1 : 0));
}

/** Auszug um die Fundstelle: { before, hit, after } mit Auslassungszeichen, höchstens radius Zeichen je Seite. */
export function excerpt(text, at, radius = 70) {
  const s = String(text || '');
  if (!at || at.length !== 2 || at[0] < 0 || at[1] > s.length || at[0] > at[1]) {
    return { before: '', hit: '', after: s.length > radius * 2 ? s.slice(0, radius * 2).replace(/\s+\S*$/, '') + ' …' : s };
  }
  let a = Math.max(0, at[0] - radius), b = Math.min(s.length, at[1] + radius);
  if (a > 0) { const sp = s.indexOf(' ', a); if (sp >= 0 && sp < at[0]) a = sp + 1; }
  if (b < s.length) { const sp = s.lastIndexOf(' ', b); if (sp > at[1]) b = sp; }
  return { before: (a > 0 ? '… ' : '') + s.slice(a, at[0]), hit: s.slice(at[0], at[1]), after: s.slice(at[1], b) + (b < s.length ? ' …' : '') };
}

// ------------------------------------------------------------ Geometrie des Netzes (SVG, ohne DOM)
export const strokeOf = (n) => 1 + Math.sqrt(Math.max(1, n)) * 1.1;

/**
 * Lage der Knoten in drei Spalten. opts: { width, row, rowMissing, head, pad, labelL, labelR }.
 * Liefert { width, height, cx, cy, left: [{node, x, y}], right: [{ group, y, items: [{node, x, y}], more, moreY }], leftMoreY }.
 */
export function layoutEgo(graph, opts = {}) {
  const W = opts.width || 400;
  const row = opts.row || 28;
  const rowMissing = opts.rowMissing || 40;
  const head = opts.head || 24;
  const pad = opts.pad || 12;
  const top = opts.top != null ? opts.top : 0; // Kopf je Seite («Verweise hierauf», «Verweist auf» mit Zählern)
  const xl = opts.labelL != null ? opts.labelL : Math.round(W * 0.28);
  const xr = opts.labelR != null ? opts.labelR : Math.round(W * 0.72);
  const cx = opts.cx != null ? opts.cx : Math.round(W / 2);
  const h = (n) => (n.missing ? rowMissing : row);
  // rechts
  let y = pad + top;
  const right = [];
  for (const g of graph.right) {
    const gy = y + head / 2;
    y += head;
    const items = [];
    for (const n of g.nodes) { items.push({ node: n, x: xr, y: y + row / 2 }); y += h(n); }
    let moreY = null;
    if (g.more) { moreY = y + row / 2; y += row; }
    right.push({ group: g.group, work: g.work, y: gy, items, more: g.more, moreY });
    y += pad / 2;
  }
  const rightH = y;
  // links (mit Kopf «Verweise hierauf»)
  let yl = pad + top + (top ? 0 : head);
  const left = [];
  for (const n of graph.left) { left.push({ node: n, x: xl, y: yl + row / 2 }); yl += h(n); }
  let leftMoreY = null;
  if (graph.leftMore) { leftMoreY = yl + row / 2; yl += row; }
  const height = Math.max(rightH, yl, pad * 2 + top + head + row * 2) + pad;
  // Mitte: auf der Höhe der Mitte aller Knoten, mindestens unter den Köpfen
  const ys = [...left.map((p) => p.y), ...right.flatMap((g) => g.items.map((p) => p.y))];
  const cy = ys.length ? Math.max(pad + top + head + row / 2, Math.round((Math.min(...ys) + Math.max(...ys)) / 2)) : Math.round(height / 2);
  return { width: W, height, cx, cy, xl, xr, left, right, leftMoreY, head, pad, top };
}

/** Bézier-Kurve zwischen zwei Punkten (waagrecht ein- und auslaufend). */
export function bezier(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}
