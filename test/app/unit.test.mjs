// Einheitstests (node --test): Zitierweise DE/FR/IT mit echten Fällen, Wörterbücher, Datumsformat, Bereinigung,
// Wort-Diff, Suche, Ersatzmodell, rohes Markup über alle Einheiten der eingebetteten Bibliothek.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cite, parseKey, workAbbr } from '../../src/app/lib/cite.js';
import { diffText } from '../../src/app/lib/diff.js';
import { parseRef } from '../../src/app/lib/search.js';
import { fmtDate, plain } from '../../src/app/lib/format.js';
import { safeInline, safeNote, titleInline } from '../../src/app/lib/sanitize.js';
import * as fb from '../../src/app/fallback-model.js';
import { sparqlString } from '../../src/app/fedlex-fallback.js';
import de from '../../src/app/i18n/de.js';
import fr from '../../src/app/i18n/fr.js';
import it from '../../src/app/i18n/it.js';
import './refs-model.test.mjs'; // Verweisnetz und Verweisstruktur (SPEC §12.3)
import './release.test.mjs'; // Version und Hinweis auf eine neuere Version

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const art = (num) => ({ type: 'article', num });
const AIG = { de: 'AIG', fr: 'LEI', it: 'LStrI' };
const ab = (l) => AIG[l];

// Tabelle echter Fälle je Sprache (SPEC §3 und §7 Ziff. 10; Belege aus dem Rechtstext und den Weisungen der Bundeskanzlei)
const CITES = [
  // [Einheit, Schlüssel, Kürzel, DE, FR, IT]
  [art('5'), 'p1.a.n2', AIG, 'Art. 5 Abs. 1 Bst. a Ziff. 2 AIG', 'art. 5, al. 1, let. a, ch. 2, LEI', 'art. 5 cpv. 1 lett. a n. 2 LStrI'],
  [art('10a'), 'p2', AIG, 'Art. 10a Abs. 2 AIG', 'art. 10a, al. 2, LEI', 'art. 10a cpv. 2 LStrI'],
  [{ type: 'annex', num: '1' }, 'n2.n1', { de: 'VEV', fr: 'OEV', it: 'OEV' }, 'Anhang 1 Ziff. 2.1 VEV', 'annexe 1, ch. 2.1, OEV', 'allegato 1 n. 2.1 OEV'],
  [art('76'), 'p1.b.n5', { de: 'AIG', fr: 'LEI', it: 'LStrI' }, 'Art. 76 Abs. 1 Bst. b Ziff. 5 AIG', 'art. 76, al. 1, let. b, ch. 5, LEI', 'art. 76 cpv. 1 lett. b n. 5 LStrI'],
  [art('93'), 'p1.a', { de: 'AsylG', fr: 'LAsi', it: 'LAsi' }, 'Art. 93 Abs. 1 Bst. a AsylG', 'art. 93, al. 1, let. a, LAsi', 'art. 93 cpv. 1 lett. a LAsi'],
  [art('109g'), 'p2.a', AIG, 'Art. 109g Abs. 2 Bst. a AIG', 'art. 109g, al. 2, let. a, LEI', 'art. 109g cpv. 2 lett. a LStrI'],
  [art('58'), 'p1', { de: 'ParlG', fr: 'LParl', it: 'LParl' }, 'Art. 58 Abs. 1 ParlG', 'art. 58, al. 1, LParl', 'art. 58 cpv. 1 LParl'],
  [art('26bis'), 'p1bis', { de: 'AsylG', fr: 'LAsi', it: 'LAsi' }, 'Art. 26bis Abs. 1bis AsylG', 'art. 26bis, al. 1bis, LAsi', 'art. 26bis cpv. 1bis LAsi'],
  [art('5'), 'p1.abis', AIG, 'Art. 5 Abs. 1 Bst. abis AIG', 'art. 5, al. 1, let. abis, LEI', 'art. 5 cpv. 1 lett. abis LStrI'],
  [art('5'), 'p1.a_bis', AIG, 'Art. 5 Abs. 1 Bst. abis AIG', 'art. 5, al. 1, let. abis, LEI', 'art. 5 cpv. 1 lett. abis LStrI'],
  [art('103c'), 'p1_bis', AIG, 'Art. 103c Abs. 1bis AIG', 'art. 103c, al. 1bis, LEI', 'art. 103c cpv. 1bis LStrI'],
  [art('120d'), 'p.f', AIG, 'Art. 120d Bst. f AIG', 'art. 120d, let. f, LEI', 'art. 120d lett. f LStrI'],
  [art('3'), 'p1.a.d2', AIG, 'Art. 3 Abs. 1 Bst. a zweiter Strich AIG', 'art. 3, al. 1, let. a, 2e tiret, LEI', 'art. 3 cpv. 1 lett. a secondo trattino LStrI'],
  [art('97'), 'p1.i', AIG, 'Art. 97 Abs. 1 Bst. i AIG', 'art. 97, al. 1, let. i, LEI', 'art. 97 cpv. 1 lett. i LStrI'], // Buchstabe i, keine römische Ziffer
  [art('1'), null, { de: null, fr: null, it: null }, 'Art. 1', 'art. 1', 'art. 1'],
  [{ type: 'preamble', num: '' }, 's2', AIG, 'Ingress AIG', 'préambule, LEI', 'ingresso LStrI'],
];

test('Zitierweise: Tabelle echter Fälle DE, FR, IT', () => {
  for (const [u, k, a, d, f, i] of CITES) {
    assert.equal(cite(u, k, 'de', a.de), d);
    assert.equal(cite(u, k, 'fr', a.fr), f);
    assert.equal(cite(u, k, 'it', a.it), i);
  }
});

test('Zitierweise: SR-Nummer, wenn das Kürzel fehlt', () => {
  assert.equal(workAbbr({ de: null }, '142.206', 'de'), 'SR 142.206');
  assert.equal(workAbbr({ de: null }, '142.206', 'fr'), 'RS 142.206');
  assert.equal(workAbbr({ de: null }, '142.206', 'it'), 'RS 142.206');
  assert.equal(cite(art('3'), 'p2', 'fr', workAbbr(null, '142.206', 'fr')), 'art. 3, al. 2, RS 142.206');
  assert.equal(workAbbr(AIG, '142.20', 'it'), 'LStrI');
});

test('Zitierweise: Schlusszeichen und Gliederung', () => {
  assert.deepEqual(parseKey('p1.a.n2').map((s) => s.type), ['par', 'let', 'num']);
  assert.equal(cite({ type: 'final', num: '1', label: 'Übergangsbestimmungen zur Änderung vom 14. Dezember 2012' }, null, 'de', 'AIG'), 'Übergangsbestimmungen zur Änderung vom 14. Dezember 2012 AIG');
  assert.equal(cite(art('5'), 'p1.s2', 'de', 'AIG'), 'Art. 5 Abs. 1 AIG'); // weiterer Textteil: ohne eigene Stufe
  assert.equal(cite({ type: 'annex', num: '2' }, 'n1.t1', 'fr', 'OEES'), 'annexe 2, ch. 1, tableau 1, OEES');
});

// ------------------------------------------------------------------ Wörterbücher
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    const plural = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((x) => ['one', 'other', 'zero', 'two', 'few', 'many'].includes(x));
    if (v && typeof v === 'object' && !Array.isArray(v) && !plural) flat(v, key, out); else out[key] = v;
  }
  return out;
};
const D = { de: flat(de), fr: flat(fr), it: flat(it) };

test('Wörterbücher DE, FR, IT: identische Schlüsselmengen', () => {
  const k = Object.keys(D.de).sort();
  assert.deepEqual(Object.keys(D.fr).sort(), k);
  assert.deepEqual(Object.keys(D.it).sort(), k);
});

test('Wörterbücher: Platzhalter in allen Sprachen gleich', () => {
  const ph = (v) => [...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const key of Object.keys(D.de)) for (const l of ['fr', 'it']) assert.equal(ph(D[l][key]), ph(D.de[key]), `${l}: ${key}`);
});

test('Texte: kein ß, keine Ausrufezeichen, keine Füllwörter', () => {
  const all = (l) => JSON.stringify(D[l]);
  assert.ok(!/ß/.test(all('de')), 'ß in de.js');
  for (const l of ['de', 'fr', 'it']) assert.ok(!/!/.test(all(l)), `Ausrufezeichen in ${l}.js`);
  const fill = all('de').match(/\b(einfach|einfache|nur|schnell|bitte)\b/gi) || [];
  assert.deepEqual(fill, [], 'Füllwörter in de.js');
});

test('Datum ausgeschrieben DE, FR, IT', () => {
  assert.equal(fmtDate('2025-10-12', 'de'), '12. Oktober 2025');
  assert.equal(fmtDate('2025-10-12', 'fr'), '12 octobre 2025');
  assert.equal(fmtDate('2025-10-12', 'it'), '12 ottobre 2025');
  assert.equal(fmtDate('2020-04-01', 'fr'), '1er avril 2020');
  assert.equal(fmtDate('2020-04-01', 'it'), '1° aprile 2020');
});

// ------------------------------------------------------------------ Bereinigung, Diff, Suche
test('Bereinigung: Inline-HTML und Fussnoten nur mit Fedlex-Links', () => {
  assert.equal(safeInline('<b onclick="x">a</b><script>y</script><a href="https://x">z</a>'), '<b>a</b>z');
  const n = safeNote('(<a href="https://fedlex.data.admin.ch/eli/oc/2017/718">AS 2017 6521</a>; <a href="javascript:alert(1)">x</a>; <a href="https://www.fedlex.admin.ch/eli/cc/2007/758/de">SR</a>; <a href="https://evil.example/">y</a>)');
  assert.match(n, /<a href="https:\/\/fedlex\.data\.admin\.ch\/eli\/oc\/2017\/718" target="_blank" rel="noopener noreferrer">AS 2017 6521<\/a>/);
  assert.match(n, /<a href="https:\/\/www\.fedlex\.admin\.ch\/eli\/cc\/2007\/758\/de" target="_blank" rel="noopener noreferrer">SR<\/a>/);
  assert.ok(!/javascript|evil/.test(n));
  assert.equal(titleInline('<b>Titel</b> <i>a</i>'), 'Titel <i>a</i>');
});

test('Wort-Diff: Einfügung und Streichung, Tags bleiben erhalten', () => {
  const d = diffText('das erforderliche Visum oder der <i>Titel</i>', 'das erforderliche Visum, die Reisegenehmigung oder der <i>Titel</i>');
  assert.ok(d.changed);
  assert.match(d.newHtml, /<ins>, die Reisegenehmigung<\/ins>/);
  assert.match(d.redline, /<i>Titel<\/i>/);
  assert.equal(diffText('a &amp; b', 'a &amp; b').changed, false);
});

test('Suche: Artikelnummern mit lateinischen Zusätzen', () => {
  assert.deepEqual(parseRef('Art. 5 Abs. 1'), { type: 'article', num: '5', par: '1' });
  assert.equal(parseRef('art. 26bis').num, '26bis');
  assert.equal(parseRef('Art. 103c').num, '103c');
  assert.equal(parseRef('art. 5 al. 1bis').par, '1bis');
  assert.deepEqual(parseRef('Anhang 1'), { type: 'annex', num: '1' });
  assert.equal(parseRef('Einreise'), null);
});

test('SPARQL-Literale: Nutzereingaben verändern die Abfrage nicht', () => {
  assert.equal(sparqlString('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(sparqlString('x" } ; DROP'), '"x\\" } ; DROP"');
  assert.ok(!/\n/.test(sparqlString('a\nb')));
});

// ------------------------------------------------------------------ Bibliothek
const libFile = existsSync(join(ROOT, 'data/library.json')) ? join(ROOT, 'data/library.json') : join(ROOT, 'test/app/fixtures/library.json');
const lib = JSON.parse(readFileSync(libFile, 'utf8'));

test(`Ersatzmodell: stageAt exakt, Versionen und Chronologie (${libFile.replace(ROOT + '/', '')})`, () => {
  for (const id of lib.order) {
    const ds = lib.works[id];
    const s = ds.stages;
    assert.equal(fb.stageAt(ds, s[0].date), s[0].id);
    assert.equal(fb.stageAt(ds, '1900-01-01'), null);
    if (s.length > 1) {
      const d = new Date(s[1].date); d.setDate(d.getDate() - 1);
      assert.equal(fb.stageAt(ds, d.toISOString().slice(0, 10)), s[0].id);
      assert.equal(fb.stageAt(ds, s[1].date), s[1].id);
    }
    const u = Object.keys(ds.units).find((x) => ds.units[x].versions.de && ds.units[x].versions.de.length > 1);
    if (u) {
      const v = ds.units[u].versions.de;
      assert.equal(fb.getVersion(ds, u, 'de', v[1].stage), v[1]);
      const k = v[1].blocks.find((b) => b.t)?.k;
      if (k) assert.ok(fb.blockHistory(ds, u, 'de', k).length >= 1);
    }
  }
});

const TAG = /<\/?([a-z0-9]+)\b[^>]*>/gi;
const OK_T = new Set(['i', 'b', 'sup', 'sub', 'br', 'em', 'strong']);
test('Kein rohes Markup: Texte aller Einheiten aller Erlasse nach Bereinigung nur mit erlaubten Tags', () => {
  let n = 0;
  const bad = [];
  for (const id of lib.order) {
    const ds = lib.works[id];
    for (const u of Object.values(ds.units)) for (const [l, vs] of Object.entries(u.versions)) for (const v of vs) {
      for (const s of [v.title || '', v.label || '', ...(v.blocks || []).flatMap((b) => [b.t || '', b.l || ''])]) {
        n++;
        for (const m of safeInline(s).matchAll(TAG)) if (!OK_T.has(m[1].toLowerCase())) bad.push(`${id} ${u.id} ${l}: ${m[0]}`);
        assert.ok(!/[<>]/.test(plain(safeInline(s)).replace(/&[lg]t;/g, '')) || /[<>]/.test(plain(s)), `${id} ${u.id}: Tag bleibt nach plain`);
      }
      for (const b of v.blocks || []) for (const f of b.fn || []) for (const m of safeNote(f.t).matchAll(TAG)) if (!OK_T.has(m[1].toLowerCase()) && m[1].toLowerCase() !== 'a') bad.push(`${id} ${u.id} fn: ${m[0]}`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
  assert.ok(n > 1000);
});

test('Wort-Diff: ergänzter Absatz zeigt die Ergänzung, neu gefasster Absatz wird als ganzer ersetzt (AIG Art. 7, 12. Juni 2026)', () => {
  const alt = ' Die Ein- und Ausreise richtet sich nach den Schengen-Assoziierungsabkommen.';
  const neu = alt + ' Die Durchführung der Grenzkontrollen an den Schengen-Aussen- und den Schengen-Binnengrenzen der Schweiz richtet sich nach dem Schengener Grenzkodex.';
  const d = diffText(alt, neu);
  assert.equal(d.del, 0, 'der bestehende Satz gilt nicht als gestrichen');
  assert.ok(d.redline.startsWith(' Die Ein- und Ausreise richtet sich nach den Schengen-Assoziierungsabkommen. <ins>Die Durchführung'));
  const r = diffText(neu, alt);
  assert.equal(r.ins, 0);
  assert.ok(r.redline.includes('<del>Die Durchführung'));
  const a2 = 'Der Bundesrat regelt die nach diesen Abkommen möglichen Personenkontrollen an der Grenze. Wird die Einreise verweigert, so erlässt die für die Grenzkontrolle zuständige Behörde eine Wegweisungsverfügung nach Artikel 64.';
  const n2 = 'Der Bundesrat regelt die Modalitäten der Grenzkontrollen nach Absatz 1. Er bestimmt im Einvernehmen mit den Kantonen und den Nachbarstaaten die grenzüberschreitenden Regionen gemäss Artikel 42b des Schengener Grenzkodex.';
  const d2 = diffText(a2, n2);
  assert.ok(d2.redline.startsWith('<del>Der Bundesrat regelt die nach diesen Abkommen'), 'weitgehend neu gefasst: als ganzer ersetzt');
});
