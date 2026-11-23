// Tests für src/core/model.js (node --test test/core/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { buildBundle, getVersion, blockHistory, changesOfStage, stageAt, unitActs, unitEvents, tocAt } from '../../src/core/model.js';
import { buildFromRaw } from '../../scripts/build-data.mjs';
import { AKN, FN, META, versionsOf } from './helpers.mjs';
import { existsSync as existsSyncRaw } from 'node:fs';
// Tests mit Rohdaten laufen nur, wenn der Ordner raw/ vorliegt (node scripts/fetch-raw.mjs, node scripts/fetch-meta.mjs).
const RAW_OK = existsSyncRaw(new URL('../../raw/cc-2021-734/fedlex/', import.meta.url));
const RAW_SKIP = 'Ordner raw/ fehlt';

const build = (files, impacts = []) => buildBundle({
  meta: META, versions: versionsOf(Object.keys(files)), impacts, pending: [], actsMeta: {},
  texts: Object.fromEntries(Object.entries(files).map(([d, x]) => [`${d.replace(/-/g, '')}_de`, x])), fetched: '2026-11-15',
}, { DOMParser, langs: ['de'], yield: false });

const art = (n, paras, numFn = '') => `<article eId="art_${n}"><num><b>Art. ${n}</b>${numFn}</num><heading>Titel ${n}</heading>${paras}</article>`;
const para = (a, k, text) => `<paragraph eId="art_${a}/para_${k}"><num>${k}</num><content><p>${text}</p></content></paragraph>`;

test('Verschobene Fussnotennummer n löst keine neue Version aus', async () => {
  const f1 = FN('Fassung gemäss Ziff. I der V vom 1. Jan. 2021, in Kraft seit 1. Jan. 2022', 'oc/2021/10');
  const s1 = AKN(art(1, para(1, 1, 'Erster Text.')) + art(2, para(2, 1, `Zweiter Text.${f1}`)), { date: '2022-01-01' });
  // Stand 2: in Art. 1 kommt eine Fussnote hinzu, dadurch verschiebt sich die Nummer der Fussnote in Art. 2
  const f0 = FN('Fassung gemäss Ziff. I der V vom 1. Jan. 2022, in Kraft seit 1. Juli 2022', 'oc/2022/20');
  const s2 = AKN(art(1, para(1, 1, `Erster Text geändert.${f0}`)) + art(2, para(2, 1, `Zweiter Text.${f1}`)), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  assert.equal(ds.units.art_2.versions.de.length, 1, 'Art. 2 unverändert');
  assert.equal(ds.units.art_1.versions.de.length, 2);
  assert.equal(getVersion(ds, 'art_2', 'de', '20220701').blocks[0].fn[0].n, 1); // Darstellung der Vorfassung
  const ch = changesOfStage(ds, '20220701', 'de');
  assert.deepEqual(ch.map((c) => [c.unit, c.key, c.change, c.act]), [['art_1', 'p1', 'replaced', 'oc/2022/20']]);
  assert.deepEqual(ds.stages[1].acts, ['oc/2022/20']);
});

test('Typografische Varianten und reine Auszeichnung lösen keine Version aus', async () => {
  const s1 = AKN(art(1, para(1, 1, 'Er sagt «ja» … und n° 5, Art. 10<i>a</i>.')), { date: '2022-01-01' });
  const s2 = AKN(art(1, para(1, 1, ' Er  sagt "ja" ... und n<sup>o</sup> 5, Art. <b>10a</b>.')), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  assert.equal(ds.units.art_1.versions.de.length, 1);
  assert.equal(changesOfStage(ds, '20220701', 'de').length, 0);
});

test('Nur Fussnoten geändert: neue Version mit fnOnly, aber keine Änderung in changesOfStage und blockHistory', async () => {
  const s1 = AKN(art(1, para(1, 1, 'Text.') + para(1, 2, `Zwei.${FN('SR 101')}`)), { date: '2022-01-01' });
  const s2 = AKN(art(1, para(1, 1, 'Text.') + para(1, 2, `Zwei.${FN('SR 101; die Bezeichnung wurde angepasst')}`)), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  const vs = ds.units.art_1.versions.de;
  assert.equal(vs.length, 2);
  assert.equal(vs[1].fnOnly, true);
  assert.equal(vs[1].blocks[1].x, 'fn');
  assert.equal(changesOfStage(ds, '20220701', 'de').length, 0);
  assert.equal(blockHistory(ds, 'art_1', 'de', 'p2').length, 1);
});

test('Andere Blockaufteilung bei gleichem Wortlaut (Auszeichnung) löst keine Version aus', async () => {
  const s1 = AKN(art(1, `<paragraph eId="art_1/para_1"><num>1</num><content><p>Satz eins. Satz zwei.</p></content></paragraph>`), { date: '2022-01-01' });
  const s2 = AKN(art(1, `<paragraph eId="art_1/para_1"><num>1</num><content><p>Satz eins.</p><p>Satz zwei.</p></content></paragraph>`), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  assert.equal(ds.units.art_1.versions.de.length, 1);
});

test('Einfügen eines Absatzes davor: Schlüssel der unveränderten Absätze bleiben (auch positionsabhängige)', async () => {
  const dash = (items) => `<paragraph eId="art_1/para"><content><blockList><listIntroduction eId="art_1/para/listintro">Liste:</listIntroduction>${items.map((t, i) => `<item eId="art_1/para/bull_u${i + 1}"><num>–</num><p>${t}</p></item>`).join('')}</blockList></content></paragraph>`;
  const s1 = AKN(art(1, dash(['Alpha;', 'Beta.'])), { date: '2022-01-01' });
  const fi = FN('Eingefügt durch Ziff. I der V vom 1. Jan. 2022, in Kraft seit 1. Juli 2022', 'oc/2022/20');
  const s2 = AKN(art(1, dash([`Null;${fi}`, 'Alpha;', 'Beta.'])), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  const v1 = getVersion(ds, 'art_1', 'de', '20220101'), v2 = getVersion(ds, 'art_1', 'de', '20220701');
  const keyOf = (v, t) => v.blocks.find((b) => b.t.startsWith(t)).k;
  assert.equal(keyOf(v1, 'Alpha'), keyOf(v2, 'Alpha'));
  assert.equal(keyOf(v1, 'Beta'), keyOf(v2, 'Beta'));
  const ins = changesOfStage(ds, '20220701', 'de');
  assert.deepEqual(ins.map((c) => c.change), ['inserted']);
  assert.equal(ins[0].act, 'oc/2022/20');
});

test('Textänderung ohne Änderungshinweis wird als editorial markiert', async () => {
  const s1 = AKN(art(1, para(1, 1, 'Arbeitslosentschädigung.')), { date: '2022-01-01' });
  const s2 = AKN(art(1, para(1, 1, 'Arbeitslosenentschädigung.')), { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  const b = getVersion(ds, 'art_1', 'de', '20220701').blocks[0];
  assert.equal(b.x, 'editorial');
  assert.deepEqual(blockHistory(ds, 'art_1', 'de', 'p1').map((h) => h.change), ['base', 'editorial']);
});

test('Sammelartikel («Art. 111g und 111h») verschwindet: Version missing mit splitInto, changesOfStage meldet deleted', async () => {
  const shell = `<article eId="art_5_g_5_h"><num><b>Art. 5g und 5h</b>${FN('Aufgehoben durch Ziff. I der V vom 1. Jan. 2010, mit Wirkung seit 1. Jan. 2011', 'oc/2010/5')}</num><paragraph eId="art_5_g_5_h/para"><content><p>…</p></content></paragraph></article>`;
  const s1 = AKN(art(1, para(1, 1, 'Eins.')) + shell, { date: '2022-01-01' });
  const fi = FN('Eingefügt durch Ziff. I der V vom 1. Jan. 2022, in Kraft seit 1. Juli 2022', 'oc/2022/20');
  const s2 = AKN(art(1, para(1, 1, 'Eins.')) + `<article eId="art_5_g"><num><b>Art. 5</b><i>g</i>${fi}</num><paragraph eId="art_5_g/para"><content><p>Neu.</p></content></paragraph></article><article eId="art_5_h"><num><b>Art. 5</b><i>h</i>${FN('Aufgehoben durch Ziff. I der V vom 1. Jan. 2010, mit Wirkung seit 1. Jan. 2011', 'oc/2010/5')}</num><paragraph eId="art_5_h/para"><content><p>…</p></content></paragraph></article>`, { date: '2022-07-01' });
  const ds = await build({ '2022-01-01': s1, '2022-07-01': s2 });
  const v = ds.units.art_5_g_5_h.versions.de;
  assert.equal(v[0].repealed, true);
  assert.equal(v[1].missing, true);
  assert.deepEqual(v[1].splitInto, ['art_5_g', 'art_5_h']);
  assert.equal(ds.toc.find((e) => e.id === 'art_5_g_5_h').to, '20220701');
  const ch = changesOfStage(ds, '20220701', 'de');
  assert.ok(ch.some((c) => c.unit === 'art_5_g_5_h' && c.change === 'deleted'));
  assert.ok(ch.some((c) => c.unit === 'art_5_g' && c.key === null && c.change === 'inserted'));
  assert.deepEqual(tocAt(ds, '20220701', 'de').filter((e) => e.unit).map((e) => e.id), ['preamble', 'art_1', 'art_5_g', 'art_5_h']);
  assert.deepEqual(tocAt(ds, '20220101', 'de').filter((e) => e.unit).map((e) => e.id), ['preamble', 'art_1', 'art_5_g_5_h']);
});

test('EESV aus raw/: Abfragen auf dem echten Bundle', { skip: !RAW_OK && RAW_SKIP }, async () => {
  const { bundle: ds } = await buildFromRaw('cc-2021-734');
  assert.equal(ds.schema, 2);
  assert.equal(ds.work.sr, '142.206');
  assert.equal(ds.work.base, 'oc/2021/734');
  // Spätere Fassungen in raw/ kommen hinzu; die ersten sechs Stände bleiben.
  assert.ok(ds.timeline.length >= 6);
  assert.deepEqual(ds.stages.map((s) => s.id).slice(0, 6), ['20220501', '20230901', '20230913', '20240101', '20260612', '20261001']);
  assert.equal(stageAt(ds, '2026-09-30'), '20260612');
  assert.equal(stageAt(ds, '2026-10-01'), '20261001');
  assert.equal(stageAt(ds, '2022-04-30'), null);
  const v = getVersion(ds, 'art_1', 'de', '20261001');
  assert.equal(v.blocks.find((b) => b.k === 'p.a').o, 'oc/2026/474');
  assert.ok(unitActs(ds, 'art_1', 'de').includes('oc/2026/474'));
  assert.ok(unitEvents(ds, 'art_18').some((e) => e.act === 'oc/2022/568' && e.stage === '20230901'));
  assert.ok(ds.stages.find((s) => s.id === '20261001').acts.includes('oc/2026/474'));
  for (const s of ds.stages) for (const l of ds.langs) for (const c of changesOfStage(ds, s.id, l)) assert.ok(ds.units[c.unit], c.unit);
  assert.ok(ds.notes.some((n) => n.code === 'footnote-latest-only'));
  assert.ok(ds.notes.some((n) => n.code === 'typography'));
  const corr = ds.acts.find((a) => a.id === 'oc/2023/508');
  assert.equal(corr.kind, 'corrigendum');
});

test('AIG: mehrteiliger Änderungshinweis Art. 5 Abs. 1 Bst. abis ergibt zwei Ereignisse; Kurzbezeichnungen ohne Satzreste; Impact-Daten', { skip: !RAW_OK && RAW_SKIP, timeout: 120000 }, async () => {
  const { actLabelFromFn } = await import('../../src/core/model.js');
  const { bundle: ds } = await buildFromRaw('cc-2007-758');
  const b = getVersion(ds, 'art_5', 'de', '20250615').blocks.find((x) => x.k === 'p1.abis');
  assert.equal(b.o, 'oc/2025/349');
  assert.equal(b.ch, 'replaced');
  const a346 = ds.acts.find((a) => a.id === 'oc/2025/346');
  assert.ok(a346.changes.some((c) => c.unit === 'art_5' && c.key === 'p1.abis' && c.action === 'inserted'));
  const ev = unitEvents(ds, 'art_5').filter((e) => e.key === 'p1.abis').map((e) => [e.act, e.action]);
  assert.deepEqual(ev.slice(0, 2), [['oc/2025/346', 'inserted'], ['oc/2025/349', 'replaced']]);
  assert.ok(unitActs(ds, 'art_5', 'de').includes('oc/2025/346'));
  // Kurzbezeichnung: lesbarer Erlassname oder null
  for (const a of ds.acts) for (const l of ds.langs) if (a.label[l] !== null) assert.match(a.label[l], /^[A-ZÄÖÜÉ].*\d{4}/, `${a.id} ${l}: ${a.label[l]}`);
  assert.equal(actLabelFromFn('Art. 127 hiernach'), null);
  assert.equal(actLabelFromFn('Anhang Ziff. 1 des BB vom 25. Sept. 2020 über die Genehmigung und die Umsetzung des Notenaustauschs zwischen der Schweiz und der EU betreffend die Übernahme der Verordnung (EU) 2018/1240 über das Europäische Reiseinformations- und -genehmigungssystem (ETIAS)'),
    'BB vom 25. Sept. 2020 über die Genehmigung und die Umsetzung des Notenaustauschs zwischen der Schweiz und der EU betreffend die Übernahme der Verordnung (EU) 2018/1240 über das Europäische Reiseinformations- und -genehmigungssystem (ETIAS)');
  assert.equal(actLabelFromFn('lla L del 16 dic. 2005'), 'L del 16 dic. 2005');
  assert.equal(actLabelFromFn('le ch. IV 2 de la LF du 19 juin 2015 (Réforme du droit des sanctions)'), 'LF du 19 juin 2015 (Réforme du droit des sanctions)');
  // Beschlussdatum aus alter Impact-Erfassung ist kein Inkrafttreten
  const a727 = ds.acts.find((a) => a.id === 'oc/2006/727');
  assert.ok(!a727.inForce.includes('2005-12-16'));
});
