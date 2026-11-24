// Versionsangaben der Produktdokumentation und von package-lock.json
// (scripts/lib/dokumentation.mjs, scripts/lib/lockfile.mjs, scripts/check-dokumentation.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_FILE, docVersions, checkDocVersion, setDocVersion, docVersionMessage } from '../../scripts/lib/dokumentation.mjs';
import { LOCK_FILE, checkLockVersion, setLockVersion, lockVersionMessage } from '../../scripts/lib/lockfile.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SAMPLE = [
  '<title>SR-Navigator — Produktdokumentation (v1.4.0)</title>',
  '<span class="lang-de">Version 1.4.0 · Datenstand Fedlex: 18. November 2026</span>',
  '<span class="lang-it">Versione 1.4.0 · Stato dei dati</span>',
  '<p>Fassung vom 15.06.2025, Art. 1.2.3 bleibt, 2026.11.18 auch.</p>',
  "  de: 'SR-Navigator — Produktdokumentation (v1.4.0)',",
].join('\n');
// Aufbau wie die Lock-Datei von npm; die Abhängigkeit trägt absichtlich dieselbe Nummer.
const LOCK = '{\n  "name": "sr-navigator",\n  "version": "1.4.0",\n  "lockfileVersion": 3,\n  "requires": true,\n  "packages": {\n    "": {\n      "name": "sr-navigator",\n      "version": "1.4.0",\n      "dependencies": {\n        "x": "^1.4.0"\n      }\n    },\n    "node_modules/x": {\n      "version": "1.4.0",\n      "resolved": "https://registry.npmjs.org/x/-/x-1.4.0.tgz"\n    }\n  }\n}\n';

test('Dokumentation: findet «Version», «Versione» und «(v…)», keine anderen Zahlen', () => {
  const f = docVersions(SAMPLE);
  assert.deepEqual(f.map((x) => [x.line, x.version]), [[1, '1.4.0'], [2, '1.4.0'], [3, '1.4.0'], [5, '1.4.0']]);
  assert.equal(checkDocVersion(SAMPLE, '1.4.0').ok, true);
});

test('Dokumentation: abweichende Version mit Datei, Zeile und Behebung; setDocVersion setzt alle Stellen', () => {
  const mixed = SAMPLE.replace('Versione 1.4.0', 'Versione 1.3.1');
  const r = checkDocVersion(mixed, '1.4.0');
  assert.equal(r.ok, false);
  assert.deepEqual(r.wrong.map((w) => w.line), [3]);
  const msg = docVersionMessage(r, '1.4.0');
  assert.match(msg, new RegExp(`^${DOC_FILE.replace(/\./g, '\\.')}: `));
  assert.match(msg, /Zeile 3: nennt 1\.3\.1 statt 1\.4\.0/);
  assert.match(msg, /Behebung: «node scripts\/check-dokumentation\.mjs --fix»/);
  const fixed = setDocVersion(mixed, '1.4.1');
  assert.equal(checkDocVersion(fixed, '1.4.1').ok, true);
  assert.equal(checkDocVersion(fixed, '1.4.1').found, 4);
  assert.ok(fixed.includes('15.06.2025') && fixed.includes('Art. 1.2.3') && fixed.includes('2026.11.18'), 'andere Zahlen bleiben');
  assert.throws(() => setDocVersion('<p>ohne Angabe</p>', '1.4.1'), /keine Versionsangabe/);
  assert.throws(() => setDocVersion(SAMPLE, '1.4'), /Form 1\.2\.3/);
  assert.equal(checkDocVersion('<p>ohne Angabe</p>', '1.4.0').ok, false);
});

test('Dokumentation im Repository nennt die Version aus package.json', () => {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const r = checkDocVersion(readFileSync(join(ROOT, DOC_FILE), 'utf8'), version);
  assert.ok(r.ok, docVersionMessage(r, version));
  assert.ok(r.found >= 4, `nur ${r.found} Versionsangaben gefunden`);
});

test('package-lock.json: gleiche Version ist grün, abweichende nennt Zeile, Feld und Behebung', () => {
  assert.deepEqual(checkLockVersion(LOCK, '1.4.0'), { ok: true, wrong: [] });
  assert.equal(lockVersionMessage(checkLockVersion(LOCK, '1.4.0'), '1.4.0'), null);
  const r = checkLockVersion(LOCK, '1.4.1');
  assert.equal(r.ok, false);
  assert.deepEqual(r.wrong.map((w) => [w.line, w.field, w.version]), [[3, 'version', '1.4.0'], [9, 'packages[""].version', '1.4.0']]);
  const msg = lockVersionMessage(r, '1.4.1');
  assert.match(msg, /^package-lock\.json: Die Versionsangabe passt nicht zu package\.json \(Version 1\.4\.1\)\./);
  assert.match(msg, /Zeile 3, Feld «version»: nennt 1\.4\.0 statt 1\.4\.1/);
  assert.match(msg, /Zeile 9, Feld «packages\[""\]\.version»: nennt 1\.4\.0 statt 1\.4\.1/);
  assert.match(msg, /Behebung: «node scripts\/check-dokumentation\.mjs --fix»/);
  // Nur ein Feld weicht ab
  const one = LOCK.replace('"version": "1.4.0",\n      "dependencies"', '"version": "1.3.9",\n      "dependencies"');
  assert.deepEqual(checkLockVersion(one, '1.4.0').wrong.map((w) => [w.line, w.version]), [[9, '1.3.9']]);
});

test('package-lock.json: setLockVersion setzt beide Felder und lässt den Rest byte-gleich', () => {
  const out = setLockVersion(LOCK, '1.4.1');
  assert.equal(checkLockVersion(out, '1.4.1').ok, true);
  assert.equal(JSON.parse(out).packages['node_modules/x'].version, '1.4.0', 'Abhängigkeit mit gleicher Nummer bleibt');
  // Genau die beiden Felder ändern sich, alle übrigen Zeichen bleiben
  const changed = LOCK.split('\n').map((l, i) => [i + 1, l, out.split('\n')[i]]).filter(([, a, b]) => a !== b);
  assert.deepEqual(changed.map(([n, , b]) => [n, b.trim()]), [[3, '"version": "1.4.1",'], [9, '"version": "1.4.1",']]);
  assert.equal(out.length, LOCK.length);
  // Auch eine abweichende Version wird gesetzt, gleiche bleibt gleich
  const one = LOCK.replace('"version": "1.4.0",\n      "dependencies"', '"version": "1.3.9",\n      "dependencies"');
  assert.equal(setLockVersion(one, '1.4.0'), LOCK);
  assert.equal(setLockVersion(LOCK, '1.4.0'), LOCK);
  assert.throws(() => setLockVersion(LOCK, '1.4'), /Form 1\.2\.3/);
  assert.throws(() => setLockVersion('{"version": "1.4.0"}', '1.4.1'), /packages\[""\] fehlt/);
  // Steht das Feld unter packages[""] nicht an zweiter Stelle, bricht die Funktion ab, statt Falsches zu setzen
  const odd = '{\n  "version": "1.4.0",\n  "packages": {\n    "node_modules/x": {\n      "version": "1.4.0"\n    },\n    "": {\n      "version": "1.4.0"\n    }\n  }\n}\n';
  assert.throws(() => setLockVersion(odd, '1.4.1'), /nicht eindeutig/);
});

test('package-lock.json im Repository nennt die Version aus package.json', () => {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const r = checkLockVersion(readFileSync(join(ROOT, LOCK_FILE), 'utf8'), version);
  assert.ok(r.ok, lockVersionMessage(r, version));
});

test('check-dokumentation.mjs: rot bei Abweichung, --fix setzt Dokumentation und package-lock.json, danach grün', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sr-doku-')));
  for (const f of ['scripts/check-dokumentation.mjs', 'scripts/lib/dokumentation.mjs', 'scripts/lib/lockfile.mjs']) { mkdirSync(join(dir, f, '..'), { recursive: true }); cpSync(join(ROOT, f), join(dir, f)); }
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.4.1' }));
  writeFileSync(join(dir, DOC_FILE), SAMPLE);
  writeFileSync(join(dir, LOCK_FILE), LOCK);
  const run = (...a) => spawnSync(process.execPath, [join(dir, 'scripts/check-dokumentation.mjs'), ...a], { cwd: dir, encoding: 'utf8' });
  const red = run();
  assert.equal(red.status, 1);
  assert.match(red.stderr, /Zeile 1: nennt 1\.4\.0 statt 1\.4\.1/);
  assert.match(red.stderr, /package-lock\.json: Die Versionsangabe passt nicht zu package\.json/);
  const fix = run('--fix');
  assert.equal(fix.status, 0, fix.stderr);
  assert.match(fix.stdout, /Version 1\.4\.1 an 4 Stellen gesetzt/);
  assert.match(fix.stdout, /package-lock\.json: Version 1\.4\.1 in beiden Feldern gesetzt/);
  assert.equal(readFileSync(join(dir, LOCK_FILE), 'utf8'), setLockVersion(LOCK, '1.4.1'));
  const green = run();
  assert.equal(green.status, 0, green.stderr);
  assert.match(green.stdout, /package-lock\.json: Version 1\.4\.1 in beiden Feldern\./);
  assert.equal(run('--x').status, 1);
  // Nur die Lock-Datei weicht ab: ebenfalls rot, die Meldung nennt nur sie
  writeFileSync(join(dir, LOCK_FILE), LOCK);
  const lockOnly = run();
  assert.equal(lockOnly.status, 1);
  assert.doesNotMatch(lockOnly.stderr, /sr-navigator-dokumentation/);
  assert.match(lockOnly.stderr, /Zeile 3, Feld «version»: nennt 1\.4\.0 statt 1\.4\.1/);
});

test('Fassungs-Einbau: committet die Dokumentation und prüft ihre Version vor dem Pull Request', async () => {
  const { COMMIT_FILES, TESTS } = await import('../../scripts/fassungen-pr.mjs');
  assert.ok(COMMIT_FILES.includes(DOC_FILE), 'Dokumentation fehlt in COMMIT_FILES');
  assert.ok(TESTS.some((t) => t.args.includes('scripts/check-dokumentation.mjs')), 'Prüfung fehlt in TESTS');
  // apply-fassungen.mjs setzt die neue Version in der Dokumentation im Schritt «Version und Changelog».
  const src = readFileSync(join(ROOT, 'scripts/apply-fassungen.mjs'), 'utf8');
  assert.match(src, /setDocVersion\(before\.doc, v\.version\)/);
  assert.match(src, /writeFileSync\(join\(ROOT, DOC_FILE\), doc\)/);
});
