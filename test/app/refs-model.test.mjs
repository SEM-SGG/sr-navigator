// Einheitstests der Modellfunktionen zu Verweisnetz und Verweisstruktur (SPEC §12.3), ohne DOM.
// Teil 1: handgeschriebener Beispiel-Index (test/app/fixtures/refs-sample.mjs).
// Teil 2: echter Verweis-Index (src/core/refs.js) an AIG und EESV aus data/library.json, sofern vorhanden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { egoGraph, LIMITS_PANEL, listEntries, excerpt, layoutEgo, strongest, keyWithin, keyHits } from '../../src/app/ui/refsgraph-model.js';
import { structureModel, cellLevel, thinLabels, arcsOf } from '../../src/app/ui/refsstructure-model.js';
import { sampleCtx, UNITS, OWN, OTHER } from './fixtures/refs-sample.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Verweisnetz (Beispiel): Zahlen ganzer Artikel', () => {
  const g = egoGraph(sampleCtx(), 'art_1', null, null);
  assert.deepEqual(g.stats, { inUnits: 4, inRefs: 5, outNodes: 9, outRefs: 11, nodes: 11, refs: 16, uncertain: 1 });
  const groups = g.right.map((x) => x.group);
  assert.deepEqual(groups, ['self', 'lib:' + OTHER, 'sr', 'eu']);
  const self = g.right[0].nodes;
  assert.deepEqual(self.map((n) => n.unit), ['art_2', 'art_3', 'art_4', 'art_5', 'art_6', 'art_99']); // Gliederung, Unbekanntes zuletzt
  assert.equal(self.find((n) => n.unit === 'art_2').n, 2);
  assert.equal(self.find((n) => n.unit === 'art_4').n, 1, 'Aufzählung in einer Fundstelle zählt einmal');
  assert.equal(self.find((n) => n.unit === 'art_99').missing, true);
  assert.equal(self.some((n) => n.unit === 'art_1'), false, 'keine Kante innerhalb derselben Einheit');
  // links: nach Fundstellen absteigend, dann eigener Erlass, dann Gliederung
  assert.deepEqual(g.left.map((n) => `${n.work}:${n.unit}:${n.n}`), [`${OWN}:art_3:2`, `${OWN}:art_2:1`, `${OTHER}:art_10:1`, `${OTHER}:art_11:1`]);
  assert.equal(g.left[2].kind, 'lib');
});

test('Verweisnetz (Beispiel): Umfang Bestimmung gegen ganzer Artikel', () => {
  const ctx = sampleCtx();
  const p2 = egoGraph(ctx, 'art_1', 'p2', null);
  assert.deepEqual(p2.stats, { inUnits: 1, inRefs: 2, outNodes: 4, outRefs: 4, nodes: 4, refs: 6, uncertain: 0 });
  const p1 = egoGraph(ctx, 'art_1', 'p1', null);
  // eingehend auf Abs. 1: Art. 11 Abs. 1 der Bibliothek (Art. 1 ohne Absatz zählt erst beim ganzen Artikel)
  assert.deepEqual(p1.left.map((n) => n.unit), ['art_11']);
  assert.ok(keyWithin('p2.a', 'p2') && !keyWithin('p20', 'p2'));
  assert.ok(keyHits('p2', 'p2.a') && keyHits('p2.a.n1', 'p2.a') && !keyHits(null, 'p2'));
  const whole = egoGraph(ctx, 'art_1', null, null);
  assert.ok(whole.stats.refs >= p1.stats.refs + p2.stats.refs - 2);
});

test('Verweisnetz (Beispiel): Kürzung in der Leiste («n weitere»)', () => {
  const g = egoGraph(sampleCtx(), 'art_1', null, LIMITS_PANEL);
  const self = g.right.find((x) => x.group === 'self');
  assert.equal(self.nodes.length, 4);
  assert.equal(self.more, 2);
  assert.equal(self.total, 6);
  // die gezeigten sind die stärksten (art_2 mit 2 Fundstellen ist dabei), in der Gliederung gelesen
  assert.ok(self.nodes.some((n) => n.unit === 'art_2'));
  const pos = self.nodes.map((n) => UNITS.indexOf(n.unit)).map((x) => (x < 0 ? 99 : x));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b));
  assert.equal(g.leftMore, 0);
  // Kennzahlen bleiben ungekürzt
  assert.equal(g.stats.outNodes, 9);
});

test('Verweisnetz (Beispiel): Einheit ohne Verweise, Liste, Auszug, stärkste Verbindungen, Lage', () => {
  const ctx = sampleCtx();
  const g = egoGraph(ctx, 'art_4', null, LIMITS_PANEL);
  assert.deepEqual(g.stats, { inUnits: 1, inRefs: 1, outNodes: 0, outRefs: 0, nodes: 1, refs: 1, uncertain: 0 });
  const none = egoGraph(ctx, 'art_77', null, LIMITS_PANEL);
  assert.equal(none.stats.refs, 0);
  assert.equal(none.left.length + none.right.length, 0);
  const l = listEntries(egoGraph(ctx, 'art_1', null, null));
  assert.equal(l.out.reduce((s, g) => s + g.items.length, 0), 11, 'Liste: eine Zeile je Fundstelle und Ziel');
  assert.equal(l.in.reduce((s, g) => s + g.items.length, 0), 5);
  const ex = excerpt('Die Bewilligung nach Artikel 64 Absatz 1 ist zu verweigern, wenn die Voraussetzungen fehlen.', [21, 40], 12);
  assert.equal(ex.hit, 'Artikel 64 Absatz 1');
  assert.match(ex.before, /^… /);
  assert.match(ex.after, / …$/);
  assert.equal(strongest(egoGraph(ctx, 'art_1', null, null), 3)[0].n, 2);
  const lay = layoutEgo(egoGraph(ctx, 'art_1', null, LIMITS_PANEL), { width: 400 });
  const ys = lay.right.flatMap((gr) => gr.items.map((p) => p.y));
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), 'rechts von oben nach unten ohne Überlappung');
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 24);
  assert.ok(lay.cy > 0 && lay.cy < lay.height);
});

test('Verweisstruktur (Beispiel): Bögen, Zeilen, Kennzahlen gleich wie das Netz', () => {
  const ctx = sampleCtx();
  const m = structureModel(ctx, UNITS.map((u) => ({ unit: u, top: u.startsWith('annex') ? 'annex' : 'chap_1' })));
  assert.deepEqual(m.bands.map((b) => [b.top, b.from, b.to]), [['chap_1', 0, 5], ['annex', 6, 6]]);
  const a12 = m.arcs.find((a) => a.a === 0 && a.b === 1);
  assert.deepEqual({ nab: a12.nab, nba: a12.nba }, { nab: 2, nba: 1 });
  assert.equal(m.arcs.some((a) => a.a === a.b), false);
  const sel = arcsOf(m, 0);
  assert.equal(sel.out.length, 5); // art_2..art_6
  assert.equal(sel.in.length, 0); // art_3 → art_1 liegt auf demselben Bogen wie art_1 → art_3 (ausgehend)
  assert.deepEqual(m.rows.map((r) => r.group), ['lib:' + OTHER, 'sr', 'eu']);
  assert.equal(m.rows[1].cells.get(0), 2);
  for (const u of [...UNITS, 'art_99']) {
    const g = egoGraph(ctx, u, null, null).stats;
    const s = m.units.get(u) || { inUnits: 0, inRefs: 0, outNodes: 0, outRefs: 0, nodes: 0, refs: 0, uncertain: 0 };
    assert.deepEqual([s.inUnits, s.inRefs, s.outNodes, s.outRefs, s.nodes, s.refs, s.uncertain], [g.inUnits, g.inRefs, g.outNodes, g.outRefs, g.nodes, g.refs, g.uncertain], u);
  }
  assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 30].map(cellLevel), [0, 1, 2, 2, 3, 3, 4, 4]);
  const th = thinLabels(269, 4, () => 22);
  assert.equal(th.rotate, true);
  assert.ok(th.step * 4 >= 14 + 2);
  assert.equal(thinLabels(27, 40, () => 20).step, 1);
});

// ------------------------------------------------------------ echter Index (src/core/refs.js)
const REFS = join(ROOT, 'src/core/refs.js');
const LIB = join(ROOT, 'data/library.json');
const haveReal = existsSync(REFS) && existsSync(LIB);

async function realCtx(workId, lang = 'de') {
  const refs = await import(pathToFileURL(REFS).href);
  const model = await import(pathToFileURL(join(ROOT, 'src/core/model.js')).href);
  const { buildContextNode } = await import('./refs-node-context.mjs');
  const lib = JSON.parse(readFileSync(LIB, 'utf8'));
  return buildContextNode({ lib, refs, model, workId, lang });
}

test('Verweisnetz und Verweisstruktur am echten Index: gleiche Zahlen über alle Einheiten (AIG, EESV, VZAE)', { skip: !haveReal && 'src/core/refs.js fehlt' }, async () => {
  for (const w of ['cc-2007-758', 'cc-2021-734', 'cc-2007-759']) {
    const { ctx, columns, units } = await realCtx(w);
    const t0 = performance.now();
    const m = structureModel(ctx, columns);
    const dt = performance.now() - t0;
    let checked = 0, withRefs = 0;
    for (const u of units) {
      const g = egoGraph(ctx, u, null, null).stats;
      const s = m.units.get(u) || { inUnits: 0, inRefs: 0, outNodes: 0, outRefs: 0, nodes: 0, refs: 0, uncertain: 0 };
      assert.deepEqual([s.inUnits, s.inRefs, s.outNodes, s.outRefs, s.nodes, s.refs, s.uncertain], [g.inUnits, g.inRefs, g.outNodes, g.outRefs, g.nodes, g.refs, g.uncertain], `${w} ${u}`);
      // Kürzung ändert die Zahlen nicht; gezeigte Knoten höchstens 7 links und 4 je Gruppe
      const k = egoGraph(ctx, u, null, LIMITS_PANEL);
      assert.deepEqual(k.stats, g);
      assert.ok(k.left.length <= 7 && k.right.every((x) => x.nodes.length <= 4 && x.nodes.length + x.more === x.total));
      checked++;
      if (g.refs) withRefs++;
    }
    assert.equal(checked, units.length);
    assert.ok(withRefs > 0, `${w}: Einheiten mit Verweisen`);
    console.log(`${w}: ${checked} Einheiten geprüft, ${withRefs} mit Verweisen, ${m.totals.refs} ausgehende Fundstellen, ${m.arcs.length} Bögen, Strukturmodell ${dt.toFixed(1)} ms`);
  }
});

test('Verweisnetz am echten Index: Umfang Bestimmung ist Teilmenge des ganzen Artikels (AIG)', { skip: !haveReal && 'src/core/refs.js fehlt' }, async () => {
  const { ctx, units, blocksOf } = await realCtx('cc-2007-758');
  let n = 0;
  for (const u of units) {
    const whole = egoGraph(ctx, u, null, null);
    const wholeIds = new Set([...whole.left, ...whole.right.flatMap((g) => g.nodes)].map((x) => x.id));
    for (const k of blocksOf(u)) {
      const p = egoGraph(ctx, u, k, null);
      assert.ok(p.stats.outRefs <= whole.stats.outRefs && p.stats.inRefs <= whole.stats.inRefs, `${u} ${k}`);
      for (const x of [...p.left, ...p.right.flatMap((g) => g.nodes)]) assert.ok(wholeIds.has(x.id), `${u} ${k} ${x.id}`);
      n++;
    }
  }
  assert.ok(n > 500);
});

test('Verweisnetz am echten Index: ausgehende Kanten wie edges() des Kerns (AIG, DE und FR)', { skip: !haveReal && 'src/core/refs.js fehlt' }, async () => {
  const refs = await import(pathToFileURL(REFS).href);
  for (const lang of ['de', 'fr']) {
    const { ctx, units } = await realCtx('cc-2007-758', lang);
    const core = refs.edges(ctx.index, { externalUnits: false });
    const byUnit = new Map();
    for (const e of core) { if (!byUnit.has(e.from)) byUnit.set(e.from, { n: 0, refs: 0 }); const x = byUnit.get(e.from); x.n++; x.refs += e.n; }
    for (const u of units) {
      const g = egoGraph(ctx, u, null, null).stats;
      const c = byUnit.get(u) || { n: 0, refs: 0 };
      assert.deepEqual([g.outNodes, g.outRefs], [c.n, c.refs], `${lang} ${u}`);
    }
  }
});
