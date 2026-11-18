// Tests für src/core/parser.js (node --test test/core/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser } from 'linkedom';
import { parseFedlex, segKey, parseInForce, idFromNum, tidy } from '../../src/core/parser.js';
import { AKN, FN } from './helpers.mjs';
import { existsSync as existsSyncRaw } from 'node:fs';
// Tests mit Rohdaten laufen nur, wenn der Ordner raw/ vorliegt (node scripts/fetch-raw.mjs, node scripts/fetch-meta.mjs).
const RAW_OK = existsSyncRaw(new URL('../../raw/cc-2021-734/fedlex/', import.meta.url));
const RAW_SKIP = 'Ordner raw/ fehlt';

const RAW = new URL('../../raw/', import.meta.url);
const parse = (x) => parseFedlex(x, { DOMParser });

test('Schlüssel aus eId-Segmenten (SPEC §5.1)', () => {
  assert.equal(segKey('para_1'), 'p1');
  assert.equal(segKey('para'), 'p');
  assert.equal(segKey('para_1_bis'), 'p1bis');
  assert.equal(segKey('para_2quinqies'), 'p2quinqies');
  assert.equal(segKey('para_3_4'), 'p3-4');
  assert.equal(segKey('para_7_bisund7_ter'), 'p7bis-7ter');
  assert.equal(segKey('para_7_biset7_ter'), 'p7bis-7ter');
  assert.equal(segKey('para_7_bise7_ter'), 'p7bis-7ter');
  assert.equal(segKey('lbl_a'), 'a');
  assert.equal(segKey('lbl_d_bis'), 'dbis');
  assert.equal(segKey('lbl_dbis'), 'dbis');
  assert.equal(segKey('lbl_1'), 'n1');
  assert.equal(segKey('bull_u3'), 'd3');
  assert.equal(segKey('lvl_u1'), 'h1');
  assert.equal(segKey('lvl_2'), 'h2');
});

test('Einheiten-Id aus der Bezeichnung', () => {
  assert.equal(idFromNum('art_', '102ebis'), 'art_102_e_bis');
  assert.equal(idFromNum('art_', '10a'), 'art_10_a');
  assert.equal(idFromNum('art_', '108 und 109'), 'art_108_109');
  assert.equal(idFromNum('art_', '120a à 120c'), 'art_120_a_120_c');
  assert.equal(idFromNum('art_', '32 a 35'), 'art_32_35');
});

test('Inkrafttreten aus Fussnoten (DE, FR, IT)', () => {
  assert.equal(parseInForce('Fassung gemäss Ziff. I des BG vom 16. Dez. 2016, in Kraft seit 1. Jan. 2019 (AS 2017 6521)'), '2019-01-01');
  assert.equal(parseInForce('Nouvelle teneur selon le ch. I, en vigueur depuis le 1er juil. 2021 (RO 2021 1)'), '2021-07-01');
  assert.equal(parseInForce('Nuovo testo giusta il n. I, in vigore dal 1° giu. 2022 (RU 2022 1)'), '2022-06-01');
  assert.equal(parseInForce('Aufgehoben durch Anhang Ziff. 1, mit Wirkung seit 1. Febr. 2014 (AS 2013 1)'), '2014-02-01');
  assert.equal(parseInForce('Introdotto dal n. I, in vigore dal  1° ott. 2016'), '2016-10-01');
  assert.equal(parseInForce('Siehe Fussnote zu Art. 5'), null);
});

test('Leerraum und leere Auszeichnung bereinigen, Wortlaut unverändert', () => {
  assert.equal(tidy('  Art.\n\t 10<i>a</i>  <b> </b>Abs.<sup></sup> 2 '), 'Art. 10<i>a</i> Abs. 2');
});

test('Herkunft aus dem href, nicht aus dem Text; Fussnote an der Nummer gilt für die ganze Bestimmung', () => {
  const x = AKN(`<article eId="art_1"><num><b>Art. 1</b>${FN('Fassung gemäss Ziff. I der V vom 1. Jan. 2022, in Kraft seit 1. März 2022', 'oc/2022/55')}</num><heading>Titel</heading>
    <paragraph eId="art_1/para_1"><num>1</num><content><p> Text eins.</p></content></paragraph>
    <paragraph eId="art_1/para_2"><num>2</num><content><blockList><listIntroduction eId="art_1/para_2/listintro">Einleitung:${FN('Fassung gemäss Ziff. I der V vom 2. Febr. 2023, in Kraft seit 1. Mai 2023', 'oc/2023/77')}</listIntroduction>
      <item eId="art_1/para_2/lbl_a"><num>a. </num><p>erstens;</p></item>
      <item eId="art_1/para_2/lbl_b"><num>b.${FN('Eingefügt durch Ziff. I der V vom 3. März 2024 (AS 2024 1), in Kraft seit 1. Juli 2024', 'oc/2024/1')}</num><p>zweitens.</p></item>
    </blockList></content></paragraph></article>`);
  const r = parse(x);
  const u = r.units.find((u) => u.id === 'art_1');
  const by = Object.fromEntries(u.blocks.map((b) => [b.k, b]));
  assert.deepEqual(u.blocks.map((b) => b.k), ['p1', 'p2', 'p2.a', 'p2.b']);
  assert.equal(by.p1.o, 'oc/2022/55');           // Nummer des Artikels
  assert.equal(by.p2.o, 'oc/2023/77');           // eigener Hinweis jünger
  assert.equal(by['p2.a'].o, 'oc/2022/55');      // Hinweis an der Einleitung gilt nur für die Einleitung
  assert.equal(by['p2.b'].o, 'oc/2024/1');
  assert.equal(by['p2.b'].ch, 'inserted');
  assert.equal(by.p2.t, 'Einleitung:');
  assert.ok(!/authorialNote|Fassung/.test(by.p2.t));
});

test('Fussnote mit mehreren Ereignissen: jüngstes ist massgebend', () => {
  const x = AKN(`<article eId="art_2"><num><b>Art. 2</b><authorialNote><p> Eingefügt durch Art. 127 hiernach (<ref href="https://fedlex.data.admin.ch/eli/oc/2008/5405">AS 2008 5405</ref>). Fassung gemäss Ziff. I des BG vom 13. Juni 2008, in Kraft seit 12. Dez. 2008 (<ref href="https://fedlex.data.admin.ch/eli/oc/2008/700">AS 2008 5407</ref>).</p></authorialNote></num><paragraph eId="art_2/para"><content><p>Text.</p></content></paragraph></article>`);
  const f = parse(x).units.find((u) => u.id === 'art_2').fn[0];
  assert.equal(f.act, 'oc/2008/700');
  assert.equal(f.action, 'replaced');
  assert.equal(f.inForce, '2008-12-12');
  assert.equal(f.events.length, 2);
});

test('Gliederungszeichen im Text bei Platzhalter im Nummernfeld («[tab]»)', () => {
  const x = AKN(`<article eId="art_3"><num>Art. 3</num><paragraph eId="art_3/para_1"><num>1</num><content><blockList><listIntroduction eId="art_3/para_1/listintro">Es gilt:</listIntroduction>
    <item eId="art_3/para_1/lbl_d"><num>d. </num><p>vier;</p></item>
    <item eId="art_3/para_1/lbl_tab"><num><placeholder fedlex:message="E40S10-TAB">[tab]</placeholder></num><p>d<sup>bis</sup>. vier bis.</p></item></blockList></content></paragraph></article>`);
  const u = parse(x).units.find((u) => u.id === 'art_3');
  const b = u.blocks.find((b) => b.k === 'p1.dbis');
  assert.ok(b, 'Schlüssel aus dem Text abgeleitet');
  assert.equal(b.t, 'd<sup>bis</sup>. vier bis.'); // Wortlaut unverändert
});

test('Doppelter eId wird eindeutig gemacht und gemeldet, Text bleibt', () => {
  const x = AKN(`<article eId="art_4"><num>Art. 4</num><paragraph eId="art_4/para_1"><num>1</num><content><p>A</p></content></paragraph><paragraph eId="art_4/para_1"><num>1</num><content><p>B</p></content></paragraph></article>`);
  const r = parse(x);
  assert.deepEqual(r.units.find((u) => u.id === 'art_4').blocks.map((b) => [b.k, b.t]), [['p1', 'A'], ['p1~2', 'B']]);
  assert.ok(r.notes.some((n) => n.code === 'dup-key'));
});

test('EESV 20261001: Einheiten, Anhänge, Präambel, Fussnoten', { skip: !RAW_OK && RAW_SKIP }, () => {
  const r = parse(readFileSync(new URL('cc-2021-734/20261001_de.xml', RAW), 'utf8'));
  assert.equal(r.sr, '142.206');
  assert.equal(r.date, '2026-10-01');
  assert.equal(r.lang, 'de');
  assert.equal(r.names.de.short, 'EESV');
  const ids = r.units.map((u) => u.id);
  assert.equal(ids[0], 'preamble');
  assert.ok(ids.includes('art_24') && ids.includes('annex_1') && ids.includes('annex_2'));
  const a1 = r.units.find((u) => u.id === 'art_1');
  const pa = a1.blocks.find((b) => b.k === 'p.a');
  assert.equal(pa.o, 'oc/2026/474');
  assert.equal(pa.fn[0].inForce, '2026-10-01');
  const allT = r.units.flatMap((u) => u.blocks.map((b) => b.t)).join(' ');
  assert.ok(!/<(?!\/?(i|b|sup|sub)>|br>)/.test(allT), 'nur erlaubte Tags');
});

test('AsylG IT 2021: als Anhang ausgezeichnete Kapitelköpfe werden als Gliederung gelesen, Artikel bleiben', { skip: !RAW_OK && RAW_SKIP }, () => {
  const r = parse(readFileSync(new URL('cc-1999-358/20210101_it.xml', RAW), 'utf8'));
  assert.ok(r.notes.some((n) => n.code === 'pseudo-annex'));
  assert.ok(r.units.some((u) => u.id === 'art_102_e_bis'));
  assert.ok(r.units.some((u) => u.id === 'art_123'));
  assert.ok(r.toc.some((n) => n.pseudo && n.type === 'chapter' && n.num === '8'));
  assert.deepEqual(r.units.filter((u) => u.type === 'annex').map((u) => u.id), ['annex_1', 'annex_2']);
});
