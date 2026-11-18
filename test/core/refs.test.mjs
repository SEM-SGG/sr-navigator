// Tests für src/core/refs.js (node --test test/core/*.test.mjs) — echte Fälle aus data/library.json in DE, FR, IT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRefIndex, plainText, highlight, refsFrom, refsTo, targetKey, nodeKey, edges, externalUrl, worksFromLibrary, artUnitId } from '../../src/core/refs.js';
import { stageAt } from '../../src/core/model.js';

const L = JSON.parse(fs.readFileSync(new URL('../../data/library.json', import.meta.url), 'utf8'));
const works = worksFromLibrary(L);
const AIG = 'cc-2007-758', VZAE = 'cc-2007-759', VEV = 'cc-2018-493', ASYLG = 'cc-1999-358', EESV = 'cc-2021-734';
const CACHE = new Map();
const ix = (id, lang, stage) => {
  const k = `${id}|${lang}|${stage}`;
  if (!CACHE.has(k)) CACHE.set(k, buildRefIndex(L.works[id], lang, stage, { works }));
  return CACHE.get(k);
};
const at = (index, unit, key) => index.refs.filter((r) => r.from.unit === unit && r.from.key === key);
const sure = (rs) => rs.filter((r) => !r.uncertain);
const keys = (rs) => [...new Set(sure(rs).map((r) => targetKey(r.to)))].sort();
const LANGS = ['de', 'fr', 'it'];
const ws = (x) => x.replace(/\s+/g, ' '); // Quelle enthält geschützte Leerzeichen
const S = '20261101'; // AIG, heute geltend

test('Einfacher Verweis und relativer Verweis (AIG Art. 7 Abs. 2): «Absatz 1» → Art. 7 Abs. 1; Schengener Grenzkodex', () => {
  for (const lang of LANGS) {
    const rs = sure(at(ix(AIG, lang, S), 'art_7', 'p2'));
    const rel = rs.find((r) => r.to.kind === 'internal');
    assert.equal(rel.to.unit, 'art_7', lang);
    assert.equal(rel.to.key, 'p1', lang);
    const eu = rs.find((r) => r.to.kind === 'eu');
    assert.equal(eu.to.eu.celex, '32016R0399', lang);
    // DE «Artikel 42b», FR «art. 42 ter», IT «articolo 42ter»: EU-Zählung vereinheitlicht
    assert.equal(eu.to.path.art, '42b', lang);
  }
  assert.equal(ws(sure(at(ix(AIG, 'de', S), 'art_7', 'p2')).find((r) => r.to.kind === 'eu').text), 'Artikel 42b des Schengener Grenzkodex');
});

test('Aufzählung (AIG Art. 25 Abs. 2): «Artikel 20, 23 und 24» – drei Ziele, eine Fundstelle, gleich in DE/FR/IT', () => {
  const want = ['art_20', 'art_23', 'art_24'];
  const sets = LANGS.map((lang) => {
    const rs = sure(at(ix(AIG, lang, S), 'art_25', 'p2'));
    assert.deepEqual(rs.map((r) => r.to.unit), want, lang);
    assert.equal(new Set(rs.map((r) => r.cid)).size, 1, `${lang}: eine Fundstelle`);
    return keys(rs).join();
  });
  assert.equal(sets[0], sets[1]); assert.equal(sets[0], sets[2]);
  assert.equal(ws(at(ix(AIG, 'de', S), 'art_25', 'p2')[0].text), 'Artikel 20, 23 und 24');
});

test('Bereich (AIG Art. 18 Bst. c): «Artikeln 20–25» umfasst den eingefügten Art. 21a; FR «art. 20 à 25»', () => {
  for (const lang of LANGS) {
    const rs = sure(at(ix(AIG, lang, S), 'art_18', 'p.c'));
    assert.deepEqual(rs.map((r) => r.to.unit), ['art_20', 'art_21', 'art_21_a', 'art_22', 'art_23', 'art_24', 'art_25'], lang);
    assert.ok(rs.every((r) => r.to.range && !r.to.missing), lang);
  }
  assert.equal(ws(at(ix(AIG, 'fr', S), 'art_18', 'p.c')[0].text), 'art. 20 à 25');
});

test('Lateinischer Zusatz und SR-Erlass ausserhalb der Bibliothek (AIG Art. 5 Abs. 1 Bst. d): 66abis StGB, 49abis MStG', () => {
  for (const lang of LANGS) {
    const rs = sure(at(ix(AIG, lang, S), 'art_5', 'p1.d'));
    assert.deepEqual(keys(rs), ['sr:311.0#art=66a', 'sr:311.0#art=66abis', 'sr:321.0#art=49a', 'sr:321.0#art=49abis'], lang);
    const t = rs.find((r) => r.to.path.art === '66abis').to;
    assert.equal(t.unit, 'art_66_a_bis');
    assert.equal(t.eli, 'https://fedlex.data.admin.ch/eli/cc/54/757_781_799');
    assert.equal(t.work, undefined, 'nicht in der Bibliothek');
  }
  const t = sure(at(ix(AIG, 'de', S), 'art_5', 'p1.d')).find((r) => r.to.path.art === '66abis').to;
  assert.equal(t.label, 'Art. 66abis StGB');
  assert.equal(externalUrl(t, 'fr'), 'https://www.fedlex.admin.ch/eli/cc/54/757_781_799/fr#art_66_a_bis');
  assert.equal(sure(at(ix(AIG, 'fr', S), 'art_5', 'p1.d')).find((r) => r.to.path.art === '66abis').to.label, 'art. 66abis, CP');
});

test('Relativer Verweis ohne Artikel (AIG Art. 5 Abs. 3): «Absatz 1» → Art. 5 Abs. 1 (Block p1)', () => {
  for (const lang of LANGS) {
    const [r] = sure(at(ix(AIG, lang, S), 'art_5', 'p3'));
    assert.equal(r.to.kind, 'internal');
    assert.equal(r.to.work, AIG);
    assert.deepEqual([r.to.unit, r.to.key], ['art_5', 'p1'], lang);
  }
  assert.equal(sure(at(ix(AIG, 'it', S), 'art_5', 'p3'))[0].to.label, 'art. 5 cpv. 1');
});

test('Verweis auf Bibliotheks-Erlass AIG → AsylG mit Ziel-Block am Stand des Ziel-Erlasses', () => {
  const asylStage = stageAt(L.works[ASYLG], '2026-11-01');
  for (const lang of LANGS) {
    const rs = sure(at(ix(AIG, lang, S), 'art_9_c', 'p6'));
    assert.equal(rs.length, 1, lang);
    const t = rs[0].to;
    assert.deepEqual([t.kind, t.work, t.unit, t.key, t.stage], ['sr', ASYLG, 'art_26', 'p1bis', asylStage], lang);
    assert.equal(t.sr, '142.31');
  }
  assert.equal(ws(sure(at(ix(AIG, 'de', S), 'art_9_c', 'p6'))[0].text), 'Artikel 26 Absatz 1bis AsylG');
  assert.equal(sure(at(ix(AIG, 'fr', S), 'art_9_c', 'p6'))[0].to.label, 'art. 26, al. 1bis, LAsi');
});

test('VZAE → AIG und EESV → AIG (Kürzel der Bibliothek in jeder Sprache)', () => {
  const vz = L.works[VZAE].stages.at(-1).id, ee = L.works[EESV].stages.at(-1).id;
  const want = (lang) => ({ de: 'AIG', fr: 'LEI', it: 'LStrI' })[lang];
  for (const lang of LANGS) {
    const a = sure(at(ix(VZAE, lang, vz), 'art_4', 'p1')).find((r) => r.to.work === AIG);
    assert.deepEqual([a.to.unit, a.to.key], ['art_11', 'p2'], lang);
    assert.ok(ws(a.text).endsWith(want(lang)), a.text);
    const b = sure(at(ix(EESV, lang, ee), 'art_9', 'p1.c')).find((r) => r.to.work === AIG);
    assert.deepEqual([b.to.unit, b.to.key], ['art_108_c', 'p1'], lang);
  }
});

test('EU-Rechtsakte mit Nummer (AIG Art. 5 Abs. 1 Bst. abis) und EUR-Lex-Adresse', () => {
  for (const lang of LANGS) {
    const rs = sure(at(ix(AIG, lang, S), 'art_5', 'p1.abis'));
    assert.deepEqual(rs.map((r) => r.to.eu.celex), ['32009R0810', '32018R1240'], lang);
  }
  const t = sure(at(ix(AIG, 'it', S), 'art_5', 'p1.abis'))[1].to;
  assert.equal(externalUrl(t, 'it'), 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32018R1240');
  assert.equal(externalUrl({ kind: 'eu', eu: { type: 'R', year: '2018', no: '1240' } }, 'de'), null, 'ohne CELEX kein Link');
  assert.equal(externalUrl({ kind: 'sr', sr: '311.0' }, 'de'), null, 'ohne ELI kein Link');
});

test('Ziel fehlt am Stand: IT «articoli 190c e 120d» (Tippfehler der Quelle, DE/FR «109c»)', () => {
  const it = sure(at(ix(AIG, 'it', S), 'art_126_b', 'p'));
  const bad = it.find((r) => r.to.path.art === '190c');
  assert.equal(bad.to.missing, true);
  assert.equal(bad.to.unit, 'art_190_c');
  const de = sure(at(ix(AIG, 'de', S), 'art_126_b', 'p'));
  assert.ok(de.some((r) => r.to.unit === 'art_109_c' && !r.to.missing));
  // fehlende Ziele zählen als «dangling», aber als Kante
  assert.ok(ix(AIG, 'it', S).stats.dangling >= 1);
});

test('Unsicher statt geraten: Rückverweis «dieser Verordnungen», Übereinkommen ohne SR-Fussnote', () => {
  const r1 = at(ix(AIG, 'de', S), 'art_110_f', 'p4').find((r) => /dieser\s+Verordnungen/.test(r.text));
  assert.equal(r1.uncertain, true);
  assert.match(r1.why, /Rückverweis/);
  const r2 = at(ix(AIG, 'de', S), 'art_95', 'p').find((r) => /Übereinkommens\s+vom\s+19\.\s+Juni\s+1990/.test(r.text));
  assert.equal(r2.uncertain, true);
  // unsichere Verweise sind keine Kanten
  assert.ok(!edges(ix(AIG, 'de', S)).some((e) => e.refs.some((r) => r.uncertain)));
});

test('Aufzählung unter einem Einleitungssatz mit fremdem Erlass (VEV Art. 34b): Visakodex statt eigener Artikel', () => {
  const st = L.works[VEV].stages.at(-1).id;
  for (const lang of LANGS) {
    const [r] = sure(at(ix(VEV, lang, st), 'art_34_b', 'p.a'));
    assert.equal(r.to.kind, 'eu', lang);
    assert.equal(r.to.eu.celex, '32009R0810', lang);
    assert.deepEqual(r.to.path, { art: '14', par: '5a' }, lang); // FR/IT «par. 5bis» = DE «Abs. 5a»
  }
});

test('Aufzählung nach einem Einleitungssatz mit vollständigem Zitat eines anderen Erlasses bleibt intern (AIG Art. 75 Abs. 1)', () => {
  // Einleitungssatz: «… Landesverweisung nach Artikel 66a oder 66abis StGB oder Artikel 49a oder 49abis MStG …:»
  for (const lang of LANGS) {
    const a = ix(AIG, lang, S);
    const b = sure(at(a, 'art_75', 'p1.b'));
    assert.deepEqual(b.map((r) => [r.to.kind, r.to.unit]), [['internal', 'art_74']], lang);
    assert.deepEqual(sure(at(a, 'art_75', 'p1.d')).map((r) => r.to.unit), ['art_62', 'art_63'], lang);
    assert.deepEqual(sure(at(a, 'art_75', 'p1.e')).map((r) => r.to.unit), ['art_68'], lang);
    assert.equal(at(a, 'art_75', 'p1.b').filter((r) => r.uncertain).length, 0, lang);
  }
});

test('Gegenfall: Einleitungssatz nennt den anderen Erlass als Ganzes (VEV Art. 34 Abs. 1 FR/IT «relatifs au règlement (UE) 2017/2226 …:»)', () => {
  const st = L.works[VEV].stages.at(-1).id;
  for (const lang of ['fr', 'it']) {
    const rs = at(ix(VEV, lang, st), 'art_34', 'p1.a');
    assert.ok(rs.length && rs.every((r) => r.uncertain), lang);
    assert.match(rs[0].why, /als Ganzes/);
  }
  // DE weist die Punkte ausdrücklich zu («nachfolgend genannten Artikel und Absätze des Visakodex:»)
  const [de] = sure(at(ix(VEV, 'de', st), 'art_34', 'p1.a'));
  assert.equal(de.to.eu.celex, '32009R0810');
});

test('Klammerzitat mündet in die Erlassangabe: VEV Art. 12 «Titel III (Art. 4–36) des Visakodex» → Visakodex, nie intern', () => {
  const st = L.works[VEV].stages.at(-1).id;
  for (const lang of LANGS) {
    const rs = at(ix(VEV, lang, st), 'art_12', 'p1');
    assert.ok(rs.length >= 1, lang);
    assert.ok(rs.every((r) => r.to.kind !== 'internal'), `${lang}: kein interner Verweis`);
    const r = rs.find((x) => !x.uncertain);
    assert.equal(r.to.eu.celex, '32009R0810', lang);
    assert.equal(r.to.path.art, '4-36', lang);
  }
});

test('Gliederung mit Grossbuchstabe: AsylG Art. 63 Abs. 1 Bst. b «Artikel 1 Buchstabe C Ziffern 1–6 der Flüchtlingskonvention» ist EIN Zitat', () => {
  const st = stageAt(L.works[ASYLG], '2026-11-18');
  for (const lang of LANGS) {
    const rs = at(ix(ASYLG, lang, st), 'art_63', 'p1.b');
    assert.ok(rs.every((r) => r.to.kind !== 'internal'), `${lang}: kein interner Verweis`);
    assert.equal(new Set(rs.map((r) => r.cid)).size, 1, `${lang}: eine Fundstelle`);
    const [r] = sure(rs);
    assert.equal(r.to.sr, '0.142.30', lang);
    assert.deepEqual(r.to.path, { art: '1', sec: 'C', num: '1-6' }, lang);
  }
  assert.equal(sure(at(ix(ASYLG, 'fr', st), 'art_63', 'p1.b'))[0].to.label, 'art. 1, section C, ch. 1–6, RS 0.142.30');
});

test('whyCode aus fester Liste; EU-Bezeichnung wie an der Fundstelle', async () => {
  const { WHY_CODES } = await import('../../src/core/refs.js');
  for (const lang of LANGS) for (const r of ix(AIG, lang, S).refs.filter((x) => x.uncertain)) assert.ok(WHY_CODES.includes(r.whyCode), `${lang} ${r.whyCode}`);
  const r1 = at(ix(AIG, 'de', S), 'art_110_f', 'p4').find((r) => r.uncertain);
  assert.equal(r1.whyCode, 'anaphor');
  // «Verordnung (EG) Nr. 810/2009» bleibt mit «(EG)»; IT «regolamento (CE) n. 810/2009»
  assert.equal(sure(at(ix(AIG, 'de', S), 'art_5', 'p1.abis'))[0].to.label, 'Verordnung (EG) Nr. 810/2009');
  assert.equal(sure(at(ix(AIG, 'it', S), 'art_5', 'p1.abis'))[0].to.label, 'regolamento (CE) n. 810/2009');
  assert.equal(sure(at(ix(AIG, 'de', S), 'art_7', 'p2')).find((r) => r.to.kind === 'eu').to.label, 'Art. 42b Schengener Grenzkodex');
});

test('Fussnote am Block geht vor Registerwissen (AIG Anhang 1: zwei Abkommen vom 26. Oktober 2004)', () => {
  for (const lang of LANGS) {
    const a = sure(at(ix(AIG, lang, S), 'annex_1', 'h1.a'))[0].to.sr;
    const b = sure(at(ix(AIG, lang, S), 'annex_1', 'h1.b'))[0].to.sr;
    assert.deepEqual([a, b], ['0.362.31', '0.362.1'], lang);
  }
});

test('Bekanntes Kürzel nimmt keine fremde Fussnote (VEV IT 2021: «art. 9 cpv. 2 LStrI e art. 97 della L del 18 mar. 2005»)', () => {
  const rs = sure(at(ix(VEV, 'it', '20210101'), 'art_31', 'p2'));
  assert.deepEqual(rs.map((r) => [r.to.work || r.to.sr, r.to.path.art]), [[AIG, '9'], ['631.0', '97']]);
});

test('Keine Verweise: «Art» als Wort, Zahlen, Daten, Stunden, Prozent', () => {
  const t = 'Die Art der Tätigkeit, 12 Personen, 48 Stunden, 5 % und der 1. Januar 2020 sind keine Verweise; Artikel des täglichen Bedarfs.';
  const ds = {
    work: { id: 'cc-x', sr: '999.9', abbr: { de: 'XG' }, title: { de: 'Bundesgesetz vom 1. Januar 2000 über X' } },
    stages: [{ id: '20200101', date: '2020-01-01', order: 0 }],
    toc: [{ id: 'art_1', type: 'article', num: '1', parent: null }],
    units: { art_1: { id: 'art_1', type: 'article', num: '1', versions: { de: [{ stage: '20200101', label: 'Art. 1', title: 'T', blocks: [{ k: 'p', d: 0, l: '', t }] }] } } },
  };
  assert.deepEqual(buildRefIndex(ds, 'de', '20200101', { works: [] }).refs, []);
  // echter Block mit Zahlen und Dauer, aber ohne Verweis im Text dazwischen (AIG Art. 65 Abs. 2)
  const rs = at(ix(AIG, 'de', S), 'art_65', 'p2');
  assert.ok(rs.every((r) => !/48/.test(r.text)));
});

test('Fundstellen: text und at zeigen genau auf die Stelle im Klartext; hit liegt in at (AIG, alle Sprachen)', () => {
  for (const lang of LANGS) {
    const index = ix(AIG, lang, S);
    const ds = L.works[AIG];
    for (const r of index.refs) {
      const u = ds.units[r.from.unit];
      const v = u.versions[lang].filter((x) => Number(x.stage) <= Number(S)).at(-1);
      const b = v.blocks.find((x) => x.k === r.from.key);
      const P = plainText(b.t);
      assert.equal(P.slice(r.at[0], r.at[1]), r.text, `${lang} ${r.from.unit} ${r.from.key}`);
      assert.ok(r.hit[0] >= r.at[0] && r.hit[1] <= r.at[1], `${lang} hit ${r.from.unit}`);
    }
  }
  assert.equal(highlight('Art. 66<i>a</i> StGB', [[5, 8]]), 'Art. <mark>66</mark><i><mark>a</mark></i><mark></mark> StGB'.replace('<mark></mark>', ''));
});

test('Hilfsfunktionen: ausgehend (Block samt Unterblöcken), eingehend aus anderem Index, Kanten nach Fundstellen', () => {
  const aig = ix(AIG, 'de', S);
  const out5 = refsFrom(aig, 'art_5');
  assert.ok(out5.length >= 7);
  assert.ok(refsFrom(aig, 'art_5', 'p1').every((r) => r.from.key === 'p1' || r.from.key.startsWith('p1.')));
  assert.equal(refsFrom(aig, 'art_5', 'p1', { deep: false }).length, 0);
  // eingehend: AIG-Index verweist auf AsylG Art. 26 Abs. 1bis
  const inc = refsTo(aig, { work: ASYLG, unit: 'art_26', key: 'p1bis' });
  assert.ok(inc.some((r) => r.from.unit === 'art_9_c'));
  assert.ok(refsTo(aig, { work: ASYLG, unit: 'art_26' }).length >= inc.length);
  // Kanten: «Artikel 20, 23 und 24» = drei Kanten mit je einer Fundstelle; keine Kante in dieselbe Einheit
  const E = edges(aig).filter((e) => e.from === 'art_25');
  for (const u of ['art_20', 'art_23', 'art_24']) assert.equal(E.find((e) => e.to === `w:${AIG}#${u}`).n, 1);
  assert.ok(!edges(aig).some((e) => e.to === `w:${AIG}#${e.from}`));
  assert.equal(nodeKey({ kind: 'sr', sr: '311.0', unit: 'art_66_a' }, { units: false }), 'sr:311.0');
  assert.equal(artUnitId('109lquater'), 'art_109_l_quater');
});

test('Sprachgleichheit an Stichproben-Blöcken (DE = FR = IT)', () => {
  for (const [unit, key] of [['art_25', 'p2'], ['art_18', 'p.c'], ['art_5', 'p1.d'], ['art_9_c', 'p6'], ['art_7', 'p2'], ['art_64_a', 'p2'], ['art_87', 'p1.a']]) {
    const [d, f, i] = LANGS.map((l) => keys(at(ix(AIG, l, S), unit, key)).join(' '));
    assert.equal(d, f, `${unit} ${key} DE/FR`);
    assert.equal(d, i, `${unit} ${key} DE/IT`);
  }
});

test('Deterministisch und schnell (AIG je Stand und Sprache)', () => {
  const ds = L.works[AIG];
  const a = JSON.stringify(buildRefIndex(ds, 'fr', '20250615', { works }).refs);
  const b = JSON.stringify(buildRefIndex(ds, 'fr', '20250615', { works }).refs);
  assert.equal(a, b);
  const t0 = performance.now();
  buildRefIndex(ds, 'it', '20240701', { works });
  const ms = performance.now() - t0;
  assert.ok(ms < 600, `Laufzeit ${ms.toFixed(0)} ms`); // Vorgabe 300 ms; Testgrenze mit Reserve für langsame Rechner
});
