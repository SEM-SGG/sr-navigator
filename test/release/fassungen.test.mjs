// Tests für scripts/lib/fassungen.mjs: Version, Changelog, Fingerabdruck, Vergleich der Bibliothek, Urteil über die
// Prüfberichte und Text des Pull Requests. Kein Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bumpPatch, bumpVersionFiles, insertChangelog, changelogLines, commitSubject, fingerprint, fingerprintOf, statusOf, planPr,
  branchName, keyLabel, stageDiff, stageChanges, describeUnit, foreignChanges, judgeValidation, testCounts, prText, befundTable,
} from '../../scripts/lib/fassungen.mjs';
import { changelogSection, changelogDate } from '../../scripts/lib/changelog.mjs';

const F = 'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2007/759/20261001/';
const row = (o = {}) => ({ id: 'cc-2007-759', abbr: 'VZAE', sr: '142.201', url: 'https://www.fedlex.admin.ch/eli/cc/2007/759/de', newVersions: [], newFiles: [], changedFiles: [], error: null, ...o });
const replacedRow = () => row({ changedFiles: ['de', 'fr', 'it'].map((l) => ({ stage: '20261001', lang: l, url: `${F}${l}/xml/x-${l}-xml-1.xml` })) });
const newRow = () => row({ id: 'cc-2021-734', abbr: 'EESV', sr: '142.206', newVersions: ['2027-01-01'], newFiles: [{ date: '2027-01-01', lang: 'de', url: 'https://example.invalid/de.xml' }] });
const quiet = (id, abbr) => row({ id, abbr });

test('Version: Patch-Stufe in package.json und an zwei Stellen in package-lock.json', () => {
  assert.equal(bumpPatch('1.3.1'), '1.3.2');
  assert.equal(bumpPatch('2.0.9'), '2.0.10');
  assert.throws(() => bumpPatch('1.3'), /Form 1\.2\.3/);
  const pkg = '{\n  "name": "sr-navigator",\n  "version": "1.3.1",\n  "private": true\n}\n';
  const lock = '{\n  "name": "sr-navigator",\n  "version": "1.3.1",\n  "lockfileVersion": 3,\n  "packages": {\n    "": {\n      "name": "sr-navigator",\n      "version": "1.3.1"\n    },\n    "node_modules/x": {\n      "version": "1.3.1"\n    }\n  }\n}\n';
  const r = bumpVersionFiles(pkg, lock);
  assert.equal(r.version, '1.3.2');
  assert.equal(r.pkg, pkg.replace('1.3.1', '1.3.2'));
  const l = JSON.parse(r.lock);
  assert.equal(l.version, '1.3.2');
  assert.equal(l.packages[''].version, '1.3.2');
  assert.equal(l.packages['node_modules/x'].version, '1.3.1', 'Abhängigkeit mit gleicher Nummer bleibt');
  assert.equal(r.lock.split('\n').length, lock.split('\n').length, 'Format bleibt');
  assert.throws(() => bumpVersionFiles(pkg, lock.replace(/1\.3\.1/, '1.3.0')), /package-lock\.json nennt nicht/);
});

test('Changelog: Abschnitt zuoberst, lesbar für release-info.mjs', () => {
  const md = '# Änderungen\n\n## 1.3.1 (18. November 2026)\n\n- alt\n';
  const out = insertChangelog(md, '1.3.2', '23. November 2026', ['erste Zeile', 'zweite Zeile']);
  assert.equal(out, '# Änderungen\n\n## 1.3.2 (23. November 2026)\n\n- erste Zeile\n- zweite Zeile\n\n## 1.3.1 (18. November 2026)\n\n- alt\n');
  assert.equal(changelogSection(out, '1.3.2'), '- erste Zeile\n- zweite Zeile');
  assert.equal(changelogDate(out, '1.3.2'), '23. November 2026');
  assert.equal(changelogSection(out, '1.3.1'), '- alt');
  assert.throws(() => insertChangelog(out, '1.3.2', 'x', ['y']), /schon einen Abschnitt/);
  assert.throws(() => insertChangelog(md, '1.3.2', 'x', []), /ohne Einträge/);
  assert.equal(insertChangelog('# Änderungen\n', '0.1.0', 'd', ['a']), '# Änderungen\n## 0.1.0 (d)\n\n- a\n\n');
});

test('Changelog-Zeilen und Betreff je Befund', () => {
  assert.deepEqual(changelogLines([replacedRow(), quiet('cc-2007-758', 'AIG')]), [
    'VZAE (SR 142.201), Stand vom 1. Oktober 2026: Fedlex hat die Dateien in Deutsch, Französisch und Italienisch neu veröffentlicht. Der Navigator enthält jetzt die neuen Dateien.',
  ]);
  const it = row({ changedFiles: [{ stage: '20261001', lang: 'it', url: 'u' }] });
  assert.match(changelogLines([it])[0], /die Datei in Italienisch neu veröffentlicht\. Der Navigator enthält jetzt die neue Datei\.$/);
  assert.deepEqual(changelogLines([newRow()]), ['EESV (SR 142.206): Der Navigator enthält die neue Fassung vom 1. Januar 2027.']);
  const two = newRow(); two.newVersions = ['2027-01-01', '2027-03-01'];
  assert.deepEqual(changelogLines([two]), ['EESV (SR 142.206): Der Navigator enthält die neuen Fassungen vom 1. Januar 2027 und 1. März 2027.']);
  assert.equal(commitSubject('1.3.2', [replacedRow()]), 'SR-Navigator 1.3.2: VZAE-Fassung vom 1. Oktober 2026 nachgeführt');
  assert.equal(commitSubject('1.3.2', [two]), 'SR-Navigator 1.3.2: EESV-Fassungen vom 1. Januar 2027 und 1. März 2027 nachgeführt');
  assert.equal(commitSubject('1.3.2', [replacedRow(), newRow(), quiet('cc-2007-758', 'AIG')]), 'SR-Navigator 1.3.2: Fassungen von VZAE und EESV nachgeführt');
  const err = row({ error: 'SPARQL 503' });
  assert.deepEqual(changelogLines([err]), []);
  assert.match(befundTable([err, replacedRow()]), /Prüfung fehlgeschlagen: SPARQL 503 \|/);
});

test('Fingerabdruck: gleich bei gleichem Befund, anders bei neuer Datei-Adresse oder Ausgangsversion', () => {
  const a = fingerprint([replacedRow(), quiet('cc-2007-758', 'AIG')], { version: '1.3.1' });
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(fingerprint([quiet('cc-2007-758', 'AIG'), replacedRow()], { version: '1.3.1' }), a, 'Reihenfolge egal');
  const again = replacedRow(); again.changedFiles[2].url = `${F}it/xml/x-it-xml-2.xml`;
  assert.notEqual(fingerprint([again], { version: '1.3.1' }), a);
  assert.notEqual(fingerprint([replacedRow()], { version: '1.3.2' }), a);
  assert.notEqual(fingerprint([replacedRow(), newRow()], { version: '1.3.1' }), a);
  const body = prText(einbau({ fingerprint: a }), okTests()).body;
  assert.equal(fingerprintOf(body), a);
  assert.equal(statusOf(body), 'ok');
  assert.equal(fingerprintOf('kein Abdruck'), null);
});

test('Pull Request: eröffnen, unverändert lassen, neu bauen; fester Zweig', () => {
  const fp = 'abcdef0123456789';
  assert.equal(planPr(null, fp), 'create');
  assert.equal(planPr({ body: prText(einbau({ fingerprint: fp }), okTests()).body }, fp), 'skip');
  assert.equal(planPr({ body: prText(einbau({ fingerprint: '1111111111111111' }), okTests()).body }, fp), 'update');
  assert.equal(planPr({ body: prText(einbau({ fingerprint: fp }), null).body }, fp), 'update', 'gescheiterter Einbau wird wiederholt');
  assert.equal(planPr({ body: 'von Hand' }, fp), 'update');
  assert.equal(branchName('main'), 'fassungen/einbau');
  assert.equal(branchName('test/probe'), 'fassungen/einbau-test-probe');
  assert.equal(branchName('main', true), 'fassungen/probelauf-main');
});

test('Bestimmungen in Worten', () => {
  assert.equal(keyLabel('p1'), 'Abs. 1');
  assert.equal(keyLabel('p1bis.g'), 'Abs. 1bis Bst. g');
  assert.equal(keyLabel('p.a'), 'Bst. a');
  assert.equal(keyLabel('p2.a.n3'), 'Abs. 2 Bst. a Ziff. 3');
  assert.equal(keyLabel('p'), 'Text');
  assert.equal(keyLabel('_title'), 'Titel');
  assert.equal(keyLabel(null), 'ganze Bestimmung');
  assert.equal(keyLabel('h2.t1'), 'Teil «h2.t1»');
  assert.equal(describeUnit({ label: 'Art. 5', changes: [{ key: 'p1', change: 'replaced' }, { key: 'p2', change: 'inserted' }, { key: 'p1', change: 'fn' }] }), 'Art. 5: Abs. 1 geändert, Abs. 2 eingefügt, Fussnoten zu Abs. 1 geändert');
  assert.equal(describeUnit({ label: 'Art. 6', changes: [{ key: null, change: 'inserted' }, { key: 'p', change: 'inserted' }] }), 'Art. 6: eingefügt');
});

// ------------------------------------------------------------------ kleine Bibliotheken

const blk = (k, t, fn = []) => ({ k, d: 0, l: k.replace(/^p/, ''), t, o: 'oc/2020/1', fn: fn.map((x, i) => ({ n: i + 1, t: x, kind: 'other' })) });
function bundle(id, abbr, stages, units) {
  return {
    schema: 2, fetched: '2026-11-15', langs: ['de', 'it'],
    work: { id, sr: '1', abbr: { de: abbr } },
    stages: stages.map((s, i) => ({ id: s, date: s, order: i, source: { kind: 'fedlex', url: { de: `u-${s}-de`, it: `u-${s}-it` } }, generator: { de: 'g1', it: 'g1' } })),
    timeline: stages.map((s) => ({ date: s, stage: s, pdf: { de: `p-${s}` } })),
    toc: Object.keys(units).map((u) => ({ id: u, type: 'article' })),
    units: Object.fromEntries(Object.entries(units).map(([u, v]) => [u, { id: u, type: 'article', versions: v }])),
    acts: [], pending: [], notes: [],
  };
}
const ver = (stage, label, blocks) => ({ stage, label, title: '', blocks });
function libs() {
  const a1 = { de: [ver('20250101', 'Art. 1', [blk('p1', 'Alt.')])], it: [ver('20250101', 'Art. 1', [blk('p1', 'Vecchio.')])] };
  const a2 = { de: [ver('20250101', 'Art. 2', [blk('p1', 'Zwei.', ['Fn A'])])], it: [ver('20250101', 'Art. 2', [blk('p1', 'Due.', ['Nota A'])])] };
  const old = { schema: 2, generated: '2026-11-15', order: ['w-a', 'w-b'], works: {
    'w-a': bundle('w-a', 'VZAE', ['20250101', '20261001'], { art_1: a1, art_2: a2 }),
    'w-b': bundle('w-b', 'AIG', ['20250101'], { art_1: structuredClone(a1) }),
  } };
  const neu = structuredClone(old);
  neu.generated = '2026-11-23';
  for (const id of neu.order) neu.works[id].fetched = '2026-11-23';
  const b = neu.works['w-a'];
  b.stages[1].source.url.it = 'u-20261001-it-1';
  b.stages[1].generator.it = 'g2';
  // IT im Stand 20261001: Art. 1 Wortlaut neu, Art. 2 nur Fussnote neu; Leerzeichen-Variante zählt nicht
  b.units.art_1.versions.it.push(ver('20261001', 'Art. 1', [blk('p1', 'Nuovo.')]));
  b.units.art_2.versions.it.push(ver('20261001', 'Art. 2', [blk('p1', 'Due.', ['Nota B'])]));
  b.units.art_2.versions.de.push(ver('20261001', 'Art. 2', [blk('p1', 'Zwei.', ['Fn A'])]));
  b.units.art_2.versions.de[1].blocks[0].t = 'Zwei. ';
  return { old, neu };
}

test('Ersetzte Datei: geänderte Bestimmungen je Sprache, alte gegen neue Bibliothek', () => {
  const { old, neu } = libs();
  const a = old.works['w-a'], b = neu.works['w-a'];
  assert.deepEqual(stageDiff(a, b, '20261001', 'de'), []);
  assert.deepEqual(stageDiff(a, b, '20261001', 'it').map(describeUnit), ['Art. 1: Abs. 1 geändert', 'Art. 2: Fussnoten zu Abs. 1 geändert']);
  // Neuer Stand: changesOfStage gegenüber dem Vorstand
  assert.deepEqual(stageChanges(b, '20261001', 'it').map(describeUnit), ['Art. 1: Abs. 1 geändert']);
});

test('Übrige Erlasse und Stände: unverändert bis auf Datum und Adressen; Warnung bei Inhalt, Hinweis bei Metadaten', () => {
  const { old, neu } = libs();
  assert.deepEqual(foreignChanges(old, neu, { 'w-a': ['20261001'] }), []);
  // Inhalt eines nicht betroffenen Stands des betroffenen Erlasses
  const n2 = structuredClone(neu);
  n2.works['w-a'].units.art_1.versions.de[0].blocks[0].t = 'Anders.';
  const w2 = foreignChanges(old, n2, { 'w-a': ['20261001'] });
  assert.deepEqual(w2.map((w) => [w.abbr, w.text.map((t) => [t.stage, t.lang, t.units])]), [['VZAE', [['20250101', 'de', ['Art. 1']]]]], 'betroffener Stand nicht doppelt');
  // nicht betroffener Erlass: Wortlaut und Metadaten
  const n3 = structuredClone(neu);
  n3.works['w-b'].units.art_1.versions.it[0].blocks[0].t = 'Altro.';
  n3.works['w-b'].pending.push({ id: 'x' });
  const w3 = foreignChanges(old, n3, { 'w-a': ['20261001'] });
  assert.equal(w3.length, 1);
  assert.equal(w3[0].abbr, 'AIG');
  assert.deepEqual(w3[0].text, [{ stage: '20250101', lang: 'it', units: ['Art. 1'] }]);
  assert.deepEqual(w3[0].meta, ['Bestimmungen (Auszeichnung)', 'laufende Vorhaben']);
  // nur Metadaten
  const n4 = structuredClone(neu);
  n4.works['w-b'].pending.push({ id: 'x' });
  assert.deepEqual(foreignChanges(old, n4, { 'w-a': ['20261001'] }).map((w) => [w.abbr, w.text.length, w.meta]), [['AIG', 0, ['laufende Vorhaben']]]);
  // fehlender Stand
  const n5 = structuredClone(neu);
  n5.works['w-b'].stages = [];
  assert.match(foreignChanges(old, n5, { 'w-a': ['20261001'] }).find((w) => w.abbr === 'AIG').text[0].units[0], /Stand fehlt/);
  // ohne Angabe gilt auch der ersetzte Stand als nicht betroffen
  assert.deepEqual(foreignChanges(old, neu, {}).map((w) => w.text.map((t) => t.stage + ' ' + t.lang)), [['20261001 it']]);
});

// ------------------------------------------------------------------ Prüfberichte

const res = (id, o = {}) => ({ id, minCov: 1, miss: 0, extra: 0, fnMiss: 0, spur: { footnote: 10, impact: 5, origin: 3, editorial: 2, structural: 1 }, rev: { total: 9, found: 9, explained: 0, open: 0 }, lang: [90, 100], keys: [50, 1], markup: 0, ...o });
const summary = (results, o = {}) => ({ results, load: results.map((r) => ({ id: r.id, diffs: 0 })), live: { liveId: 'cc-2007-763', rows: [1, 1], rawCmp: 0 }, ...o });

test('Prüfberichte: bestanden, Hinweis, nicht bestanden', () => {
  const before = summary([res('w-a'), res('w-b')]);
  const same = judgeValidation(before, summary([res('w-a'), res('w-b')]), { 'w-a': 'VZAE', 'w-b': 'AIG' });
  assert.equal(same.passed, true);
  assert.ok(same.rows.every((r) => r.verdict === 'ok'), JSON.stringify(same.rows));
  assert.deepEqual(same.rows.map((r) => r.key), ['wortlaut', 'fussnoten', 'belege', 'impacts', 'sprachen', 'schluessel', 'markup', 'load', 'live']);
  // mehr redaktionelle Änderungen und Sprachausnahmen, echter Abruf gescheitert: Hinweise, bestanden
  const notes = judgeValidation(before, summary([res('w-a', { spur: { ...res('w-a').spur, editorial: 3 }, lang: [95, 110] }), res('w-b')], { live: { error: 'fetch failed' } }), { 'w-a': 'VZAE' });
  assert.equal(notes.passed, true);
  assert.deepEqual(notes.rows.filter((r) => r.verdict === 'note').map((r) => r.key), ['belege', 'sprachen', 'live']);
  assert.match(notes.rows.find((r) => r.key === 'belege').text, /VZAE/);
  assert.equal(notes.rows.find((r) => r.key === 'belege').after, '5 / 2');
  // Wortlaut, Schlüssel, Laden: nicht bestanden
  const bad = judgeValidation(before, summary([res('w-a', { minCov: 0.998, miss: 4, keys: [50, 2] }), res('w-b', { rev: { total: 9, found: 8, explained: 0, open: 1 } })]), { 'w-a': 'VZAE' });
  assert.equal(bad.passed, false);
  assert.deepEqual(bad.rows.filter((r) => r.verdict === 'fail').map((r) => r.key), ['wortlaut', 'impacts', 'schluessel']);
  assert.equal(bad.rows[0].after, '99,80 %');
  const load = summary([res('w-a'), res('w-b')]); load.load[1].diffs = 2;
  assert.equal(judgeValidation(before, load).rows.find((r) => r.key === 'load').verdict, 'fail');
  // ohne früheren Bericht
  assert.equal(judgeValidation(null, summary([res('w-a')])).rows[0].before, '–');
});

test('Zahlen aus der Ausgabe der Tests', () => {
  assert.deepEqual(testCounts('ok 1\n# tests 51\n# pass 43\n# fail 0\n# skipped 8\n'), { pass: 43, fail: 0, skipped: 8 });
  assert.deepEqual(testCounts('ℹ tests 5\nℹ pass 5\nℹ fail 0\n'), { pass: 5, fail: 0 });
  assert.deepEqual(testCounts('Running 40 tests\n  38 passed (1.2m)\n  2 skipped\n'), { pass: 38, skipped: 2 });
  assert.deepEqual(testCounts('nichts'), {});
});

// ------------------------------------------------------------------ Text des Pull Requests

function einbau(o = {}) {
  return {
    today: '2026-11-23', versionBefore: '1.3.0', version: '1.3.1', rows: [replacedRow(), quiet('cc-2007-758', 'AIG')], issue: 12, fingerprint: 'c22cf384d78710bb',
    subject: 'SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt',
    changelog: '- VZAE (SR 142.201), Stand vom 1. Oktober 2026: Fedlex hat die Dateien in Deutsch, Französisch und Italienisch neu veröffentlicht. Der Navigator enthält jetzt die neuen Dateien.',
    works: [{ id: 'cc-2007-759', abbr: 'VZAE', sr: '142.201', newStages: [], replacedStages: [{
      stage: '20261001', missing: false,
      files: [{ lang: 'it', oldUrl: `${F}it/xml/a-it-xml.xml`, newUrl: `${F}it/xml/a-it-xml-1.xml`, oldBytes: 348694, newBytes: 348377 }],
      langs: { de: [], fr: [], it: [{ unit: 'art_83_a', label: 'Art. 83a', changes: [{ key: 'p1', change: 'replaced' }] }] },
    }] }],
    foreign: [],
    validation: judgeValidation(summary([res('cc-2007-759')]), summary([res('cc-2007-759')])),
    step: null, error: null, durations: {},
    ...o,
  };
}
const okTests = () => ({ results: [{ id: 'core', label: 'Kern mit Rohdaten (test:core)', ok: true, counts: { pass: 51, fail: 0, skipped: 0 } }, { id: 'browser', label: 'Browsertests in Chrome', ok: true, counts: { pass: 40 } }] });

test('Text des Pull Requests: bestanden', () => {
  const { title, body, failed } = prText(einbau(), okTests());
  assert.equal(failed, false);
  assert.equal(title, 'SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt');
  assert.match(body, /^<!-- sr-fassungen-fingerabdruck: c22cf384d78710bb -->\n<!-- sr-fassungen-status: ok -->\n/);
  assert.doesNotMatch(body, /Nicht zusammenführen/);
  assert.match(body, /Die Version steigt von 1\.3\.0 auf \*\*1\.3\.1\*\*/);
  assert.match(body, /\| \[VZAE\]\(https:\/\/www\.fedlex\.admin\.ch\/eli\/cc\/2007\/759\/de\) \| 142\.201 \| keine \| 20261001 \(DE\), 20261001 \(FR\), 20261001 \(IT\) \|/);
  assert.match(body, /```markdown\n- VZAE \(SR 142\.201\), Stand vom 1\. Oktober 2026/);
  assert.match(body, /\| Italienisch \| a-it-xml\.xml \(348694 Bytes\) \| a-it-xml-1\.xml \(348377 Bytes\) \|/);
  assert.match(body, /- Deutsch und Französisch: keine Bestimmung geändert\n {2}- Italienisch: 1 Bestimmung\n {4}- Art\. 83a: Abs\. 1 geändert/);
  assert.match(body, /\| Wortlaut vollständig \(kleinste Abdeckung\) \| 100 % \| 100 % \| \*\*bestanden\*\* \|/);
  assert.match(body, /inhaltlich unverändert/);
  assert.match(body, /\| Kern mit Rohdaten \(test:core\) \| \*\*bestanden\*\* \(51 bestanden, 0 fehlgeschlagen, 0 übersprungen\) \|/);
  assert.match(body, /## So prüfst du diesen Pull Request\n\n1\. .*\n2\. .*\n3\. .*\n4\. .*verbessern.*\n5\. .*Merge pull request/);
  assert.match(body, /\nCloses #12\n$/);
});

test('Text des Pull Requests: Entwurf bei Fehler, bei nicht bestandener Prüfung, bei Warnung; Probelauf', () => {
  const t = okTests(); t.results[1] = { id: 'browser', label: 'Browsertests in Chrome', ok: false, counts: { pass: 39, fail: 1 }, tail: 'Error: expect(received)' };
  const a = prText(einbau(), t);
  assert.equal(a.failed, true);
  assert.match(a.body, /<!-- sr-fassungen-status: fehler -->/);
  assert.match(a.body, /> \*\*Nicht zusammenführen\.\*\*/);
  assert.match(a.body, /> - Test fehlgeschlagen: Browsertests in Chrome\./);
  assert.match(a.body, /<summary>Letzte Zeilen von «Browsertests in Chrome»<\/summary>\n\n```\nError: expect\(received\)\n```/);
  const b = prText(einbau({ error: 'node scripts/validate.mjs endete mit Code 1', step: 'Prüfberichte erzeugen', validation: null, works: [], foreign: null, version: null, changelog: null }), null);
  assert.equal(b.failed, true);
  assert.match(b.body, /> - Einbau gescheitert \(Prüfberichte erzeugen\): node scripts\/validate\.mjs endete mit Code 1/);
  assert.match(b.body, /## Tests\n\nNicht ausgeführt, weil der Einbau gescheitert ist\./);
  const bad = summary([res('cc-2007-759', { markup: 2 })]);
  const c = prText(einbau({ validation: judgeValidation(summary([res('cc-2007-759')]), bad) }), okTests());
  assert.equal(c.failed, true);
  assert.match(c.body, /\| Unerlaubtes Markup \| 0 \| 2 \| \*\*nicht bestanden\*\* \|/);
  const d = prText(einbau({ foreign: [{ id: 'cc-2007-758', abbr: 'AIG', affected: false, text: [{ stage: '20250615', lang: 'fr', units: ['Art. 5'] }], meta: ['laufende Vorhaben'] }] }), okTests());
  assert.equal(d.failed, true);
  assert.match(d.body, /- \*\*Warnung:\*\* AIG, Stand vom 15\. Juni 2025, Französisch: Art\. 5/);
  assert.match(d.body, /- Hinweis: AIG: Fedlex hat Metadaten nachgeführt \(laufende Vorhaben\)/);
  const e = prText(einbau({ foreign: [{ id: 'cc-2007-758', abbr: 'AIG', affected: false, text: [], meta: ['laufende Vorhaben'] }] }), okTests());
  assert.equal(e.failed, false, 'Metadaten allein sind kein Hindernis');
  const p = prText(einbau(), okTests(), { probelauf: true });
  assert.equal(p.title, 'Probelauf: SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt');
  assert.match(p.body, /\*\*Probelauf\.\*\*/);
  assert.doesNotMatch(p.body, /Closes #/);
  const n = prText(einbau({ works: [{ id: 'x', abbr: 'EESV', sr: '142.206', replacedStages: [], newStages: [{ stage: '20270101', kind: 'fehlt', langs: {} }] }] }), okTests());
  assert.equal(n.failed, true);
  assert.match(n.body, /Die neue Fassung vom 1\. Januar 2027 fehlt nach dem Einbau/);
});
