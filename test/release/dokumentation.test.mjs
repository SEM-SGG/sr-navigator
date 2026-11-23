// Versionsangaben der Produktdokumentation (scripts/lib/dokumentation.mjs, scripts/check-dokumentation.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOC_FILE, docVersions, checkDocVersion, setDocVersion, docVersionMessage } from '../../scripts/lib/dokumentation.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SAMPLE = [
  '<title>SR-Navigator — Produktdokumentation (v1.4.0)</title>',
  '<span class="lang-de">Version 1.4.0 · Datenstand Fedlex: 18. November 2026</span>',
  '<span class="lang-it">Versione 1.4.0 · Stato dei dati</span>',
  '<p>Fassung vom 15.06.2025, Art. 1.2.3 bleibt, 2026.11.18 auch.</p>',
  "  de: 'SR-Navigator — Produktdokumentation (v1.4.0)',",
].join('\n');

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

test('check-dokumentation.mjs: rot bei Abweichung, --fix setzt die Version, danach grün', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sr-doku-')));
  for (const f of ['scripts/check-dokumentation.mjs', 'scripts/lib/dokumentation.mjs']) { mkdirSync(join(dir, f, '..'), { recursive: true }); cpSync(join(ROOT, f), join(dir, f)); }
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.4.1' }));
  writeFileSync(join(dir, DOC_FILE), SAMPLE);
  const run = (...a) => spawnSync(process.execPath, [join(dir, 'scripts/check-dokumentation.mjs'), ...a], { cwd: dir, encoding: 'utf8' });
  const red = run();
  assert.equal(red.status, 1);
  assert.match(red.stderr, /Zeile 1: nennt 1\.4\.0 statt 1\.4\.1/);
  const fix = run('--fix');
  assert.equal(fix.status, 0, fix.stderr);
  assert.match(fix.stdout, /Version 1\.4\.1 an 4 Stellen gesetzt/);
  const green = run();
  assert.equal(green.status, 0, green.stderr);
  assert.equal(run('--x').status, 1);
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
