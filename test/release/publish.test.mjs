// Tests für scripts/publish-release.sh mit einer Attrappe für gh (test/release/gh-stub.sh). Kein Netz, kein GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Kopie der nötigen Dateien in einem leeren Ordner, mit Version und fester Marke nach Wahl. */
function sandbox({ version = '9.8.7', built = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sr-release-'));
  mkdirSync(join(dir, 'scripts/lib'), { recursive: true });
  for (const f of ['scripts/publish-release.sh', 'scripts/release-info.mjs', 'scripts/lib/changelog.mjs']) cpSync(join(ROOT, f), join(dir, f));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'sr-navigator', version, type: 'module' }));
  writeFileSync(join(dir, 'CHANGELOG.md'), `# Änderungen\n\n## ${version} (1. Januar 2027)\n\n- Testeintrag\n\n## 0.0.1 (x)\n\n- alt\n`);
  writeFileSync(join(dir, 'release.config.json'), JSON.stringify({ repoUrl: 'https://github.com/example-org/sgg-toolkit', asset: 'sr-navigator.html' }));
  if (built) { mkdirSync(join(dir, 'dist')); writeFileSync(join(dir, 'dist/sr-navigator.html'), '<!doctype html>'); }
  const stub = join(dir, 'stub'); const bin = join(dir, 'bin');
  mkdirSync(stub); mkdirSync(bin);
  // Aufruf über bash, damit der Test nicht vom Ausführungsrecht der Attrappe abhängt.
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash\nexec bash "${join(ROOT, 'test/release/gh-stub.sh')}" "$@"\n`, { mode: 0o755 });
  const run = (mode, env = {}) => {
    const out = join(dir, 'gh-output.txt'); writeFileSync(out, '');
    const r = spawnSync('bash', [join(dir, 'scripts/publish-release.sh'), mode], {
      encoding: 'utf8',
      env: { ...process.env, PATH: bin + ':' + process.env.PATH, GH_STUB_DIR: stub, GITHUB_OUTPUT: out, GITHUB_SHA: 'a'.repeat(40), GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), ...env },
    });
    return { ...r, output: readFileSync(out, 'utf8') };
  };
  const rel = (t) => (existsSync(join(stub, 'rel-' + t)) ? readFileSync(join(stub, 'rel-' + t), 'utf8').trim() : null);
  const latest = (t) => readFileSync(join(stub, 'latest-' + t), 'utf8').trim();
  const notes = (t) => readFileSync(join(stub, 'notes-' + t), 'utf8');
  const calls = () => (existsSync(join(stub, 'calls.log')) ? readFileSync(join(stub, 'calls.log'), 'utf8').trim().split('\n') : []);
  return { dir, run, rel, latest, notes, calls };
}

test('Erste Veröffentlichung: Release v<version> als «Latest», Notizen aus CHANGELOG.md', () => {
  const s = sandbox();
  const plan = s.run('plan');
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.output, /^build=true$/m); assert.match(plan.output, /^version=9\.8\.7$/m); assert.match(plan.output, /^tag=v9\.8\.7$/m);
  const pub = s.run('publish');
  assert.equal(pub.status, 0, pub.stderr);
  assert.equal(s.rel('v9.8.7'), 'SR-Navigator 9.8.7');
  assert.equal(s.latest('v9.8.7'), 'true');
  assert.equal(s.notes('v9.8.7').trim(), '- Testeintrag');
});

test('Wiederholung mit derselben Version ändert nichts', () => {
  const s = sandbox();
  s.run('publish');
  const before = s.calls().length;
  assert.match(s.run('plan').output, /^build=false$/m);
  const pub = s.run('publish');
  assert.equal(pub.status, 0, pub.stderr);
  assert.deepEqual(s.calls().slice(before).filter((c) => !c.startsWith('release view')), []);
});

test('Neue Version: frühere Release bleibt bestehen', () => {
  const s = sandbox({ version: '1.0.0' });
  s.run('publish');
  writeFileSync(join(s.dir, 'package.json'), JSON.stringify({ name: 'sr-navigator', version: '1.1.0', type: 'module' }));
  writeFileSync(join(s.dir, 'CHANGELOG.md'), '# Änderungen\n\n## 1.1.0 (2. Januar 2027)\n\n- neu\n\n## 1.0.0 (1. Januar 2027)\n\n- Testeintrag\n');
  assert.match(s.run('plan').output, /^build=true$/m);
  assert.equal(s.run('publish').status, 0);
  assert.equal(s.rel('v1.0.0'), 'SR-Navigator 1.0.0');
  assert.equal(s.rel('v1.1.0'), 'SR-Navigator 1.1.0');
  assert.equal(s.notes('v1.1.0').trim(), '- neu');
  assert.deepEqual(s.calls().filter((c) => c.startsWith('release delete')), []);
});

test('Abbruch beim Anlegen: der zweite Lauf holt die Release nach', () => {
  const s = sandbox();
  assert.notEqual(s.run('publish', { GH_STUB_FAIL_CREATE: 'v9.8.7' }).status, 0);
  assert.equal(s.rel('v9.8.7'), null);
  assert.match(s.run('plan').output, /^build=true$/m);
  assert.equal(s.run('publish').status, 0);
  assert.equal(s.rel('v9.8.7'), 'SR-Navigator 9.8.7');
});

test('Fehler: Build fehlt, Abschnitt in CHANGELOG.md fehlt, Version ohne Form 1.2.3', () => {
  const a = sandbox({ built: false }).run('publish');
  assert.notEqual(a.status, 0); assert.match(a.stderr, /dist\/sr-navigator\.html fehlt/);
  const s = sandbox();
  writeFileSync(join(s.dir, 'CHANGELOG.md'), '# Änderungen\n\n## 0.0.1 (x)\n\n- alt\n');
  const b = s.run('plan');
  assert.notEqual(b.status, 0); assert.match(b.stderr, /CHANGELOG\.md: Abschnitt/);
  assert.deepEqual(s.calls(), []);
  const c = sandbox({ version: '1.2' }).run('plan');
  assert.notEqual(c.status, 0); assert.match(c.stderr, /hat nicht die Form/);
});
