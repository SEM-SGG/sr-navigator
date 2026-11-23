// Tests für scripts/fassungen-pr.mjs (plan, publish) mit der Attrappe für gh (test/release/gh-stub.sh) und echtem git
// gegen ein lokales Remote. Kein Netz, kein GitHub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeValidation } from '../../scripts/lib/fassungen.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts/fassungen-pr.mjs');
// git ohne persönliche Einstellungen (Signieren, Hooks) des Geräts
const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'sr-fassungen-pr-'));
  const remote = join(dir, 'remote.git'), work = join(dir, 'work'), stub = join(dir, 'stub'), bin = join(dir, 'bin'), out = join(dir, 'einbau');
  for (const d of [work, stub, bin, out]) mkdirSync(d);
  const git = (args, cwd = work) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(['init', '--bare', '--quiet', '-b', 'main', remote], dir);
  git(['init', '--quiet', '-b', 'main']);
  mkdirSync(join(work, 'data'));
  writeFileSync(join(work, 'package.json'), '{ "version": "1.3.0" }\n');
  writeFileSync(join(work, 'CHANGELOG.md'), '# Änderungen\n');
  writeFileSync(join(work, 'data/library.json'), '{}');
  git(['add', '.']); git(['commit', '--quiet', '-m', 'Ausgangsstand']);
  git(['remote', 'add', 'origin', remote]); git(['push', '--quiet', 'origin', 'main']);
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash\nexec bash "${join(ROOT, 'test/release/gh-stub.sh')}" "$@"\n`, { mode: 0o755 });
  // Ergebnis eines Einbaus: geänderte Dateien im Arbeitsbaum, einbau.json und tests.json im Ordner out
  const change = (version) => {
    writeFileSync(join(work, 'package.json'), `{ "version": "${version}" }\n`);
    writeFileSync(join(work, 'data/library.json'), JSON.stringify({ v: version }));
    writeFileSync(join(work, 'notiz.txt'), 'gehört nicht in den Commit');
  };
  const run = (cmd, args, env = {}) => {
    const ghOut = join(dir, 'gh-output.txt'); writeFileSync(ghOut, '');
    const r = spawnSync('node', [SCRIPT, cmd, ...args], {
      cwd: work, encoding: 'utf8',
      env: { ...process.env, ...GIT_ENV, PATH: bin + ':' + process.env.PATH, GH_STUB_DIR: stub, GITHUB_OUTPUT: ghOut, GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), BASE: 'main', PROBELAUF: 'false', ...env },
    });
    return { ...r, output: readFileSync(ghOut, 'utf8') };
  };
  const publish = (e, t, env) => {
    writeFileSync(join(out, 'einbau.json'), JSON.stringify(e));
    const tf = join(out, 'tests.json');
    if (t) writeFileSync(tf, JSON.stringify(t)); else if (existsSync(tf)) writeFileSync(tf, 'null');
    return run('publish', ['--einbau', out], env);
  };
  const plan = (befund, env) => { const f = join(dir, 'befund.json'); writeFileSync(f, JSON.stringify(befund)); return run('plan', ['--befund', f], env); };
  const prs = () => {
    const d = join(stub, 'prs');
    if (!existsSync(d)) return [];
    return readdirSync(d).sort().map((n) => ({ ...Object.fromEntries(['head', 'base', 'title', 'body', 'draft', 'state'].map((f) => [f, readFileSync(join(d, n, f), 'utf8')])), comments: existsSync(join(d, n, 'comments')) ? readFileSync(join(d, n, 'comments'), 'utf8') : '' }));
  };
  const runs = () => (existsSync(join(stub, 'workflow-runs.log')) ? readFileSync(join(stub, 'workflow-runs.log'), 'utf8').trim().split('\n') : []);
  const remoteGit = (args) => git(args, remote);
  return { dir, work, change, publish, plan, prs, runs, remoteGit };
}

const row = { id: 'cc-2007-759', abbr: 'VZAE', sr: '142.201', url: 'https://www.fedlex.admin.ch/eli/cc/2007/759/de', newVersions: [], newFiles: [], changedFiles: [{ stage: '20261001', lang: 'it', url: 'https://example.invalid/it-xml-1.xml' }], error: null };
const summary = { results: [{ id: 'cc-2007-759', minCov: 1, miss: 0, extra: 0, fnMiss: 0, spur: { footnote: 1, impact: 1, origin: 1, editorial: 0, structural: 0 }, rev: { total: 1, found: 1, explained: 0, open: 0 }, lang: [1, 1], keys: [1, 0], markup: 0 }], load: [{ id: 'cc-2007-759', diffs: 0 }], live: null };
function einbau(fp, o = {}) {
  return {
    today: '2026-11-23', versionBefore: '1.3.0', version: '1.3.1', rows: [row], issue: 7, fingerprint: fp,
    subject: 'SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt', changelog: '- VZAE: neu',
    works: [], foreign: [], validation: judgeValidation(summary, summary), step: null, error: null, durations: {}, ...o,
  };
}
const passed = { results: [{ id: 'core', label: 'Kern mit Rohdaten (test:core)', ok: true, counts: { pass: 3 } }] };
const failedTests = { results: [{ id: 'core', label: 'Kern mit Rohdaten (test:core)', ok: false, counts: { pass: 2, fail: 1 }, tail: 'not ok 3' }] };

test('publish: eröffnet den Pull Request auf dem festen Zweig, Commit von github-actions[bot], startet CI', () => {
  const s = sandbox();
  s.change('1.3.1');
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa'), passed);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const [pr] = s.prs();
  assert.equal(s.prs().length, 1);
  assert.deepEqual([pr.head, pr.base, pr.draft, pr.title], ['fassungen/einbau', 'main', 'false', 'SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt']);
  assert.match(pr.body, /<!-- sr-fassungen-fingerabdruck: aaaaaaaaaaaaaaaa -->/);
  assert.match(pr.body, /\nCloses #7\n$/);
  assert.equal(s.remoteGit(['log', '-1', '--format=%an <%ae>|%s', 'fassungen/einbau']), 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>|SR-Navigator 1.3.1: VZAE-Fassung vom 1. Oktober 2026 nachgeführt');
  assert.deepEqual(s.remoteGit(['diff', '--name-only', 'main', 'fassungen/einbau']).split('\n'), ['data/library.json', 'package.json'], 'nur Dateien des Einbaus');
  assert.deepEqual(s.runs(), ['ci.yml fassungen/einbau']);
  assert.equal(s.remoteGit(['rev-parse', 'main']), s.remoteGit(['rev-parse', 'fassungen/einbau~1']), 'Zweig beginnt auf main');
});

test('plan: gleicher Fingerabdruck lässt den Pull Request unverändert, anderer baut neu', () => {
  const s = sandbox();
  s.change('1.3.1');
  s.publish(einbau('aaaaaaaaaaaaaaaa'), passed);
  const same = s.plan({ hasFindings: true, fingerprint: 'aaaaaaaaaaaaaaaa', rows: [row] });
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.output, /^einbau<<(\S+)\nfalse\n\1$/m);
  assert.match(same.stdout, /#1 enthält diesen Befund schon/);
  const other = s.plan({ hasFindings: true, fingerprint: 'bbbbbbbbbbbbbbbb', rows: [row] });
  assert.match(other.output, /^einbau<<(\S+)\ntrue\n\1$/m);
  assert.match(other.output, /^zweig<<(\S+)\nfassungen\/einbau\n\1$/m);
  const befund = /^befund<<(\S+)\n(.*)\n\1$/m.exec(other.output);
  assert.equal(JSON.parse(befund[2]).fingerprint, 'bbbbbbbbbbbbbbbb');
  const none = s.plan({ hasFindings: false, fingerprint: 'x', rows: [] });
  assert.match(none.output, /^einbau<<(\S+)\nfalse\n\1$/m);
  const fresh = sandbox().plan({ hasFindings: true, fingerprint: 'aaaaaaaaaaaaaaaa', rows: [row] });
  assert.match(fresh.output, /^einbau<<(\S+)\ntrue\n\1$/m);
});

test('publish: anderer Befund überschreibt den Zweig und aktualisiert Text und Titel, kein zweiter Pull Request', () => {
  const s = sandbox();
  s.change('1.3.1');
  s.publish(einbau('aaaaaaaaaaaaaaaa'), passed);
  const first = s.remoteGit(['rev-parse', 'fassungen/einbau']);
  // neuer Lauf auf frischem main (wie in GitHub Actions): Arbeitsbaum zurück auf main
  spawnSync('git', ['checkout', '--quiet', '-f', 'main'], { cwd: s.work, env: { ...process.env, ...GIT_ENV } });
  s.change('1.3.1');
  const r = s.publish(einbau('bbbbbbbbbbbbbbbb', { subject: 'SR-Navigator 1.3.1: Fassungen von VZAE und EESV nachgeführt' }), passed);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.prs().length, 1);
  assert.match(s.prs()[0].body, /fingerabdruck: bbbbbbbbbbbbbbbb/);
  assert.equal(s.prs()[0].title, 'SR-Navigator 1.3.1: Fassungen von VZAE und EESV nachgeführt');
  assert.notEqual(s.remoteGit(['rev-parse', 'fassungen/einbau']), first);
  assert.equal(s.remoteGit(['rev-list', '--count', 'main..fassungen/einbau']), '1', 'Zweig überschrieben, nicht ergänzt');
  assert.deepEqual(s.runs(), ['ci.yml fassungen/einbau', 'ci.yml fassungen/einbau']);
});

test('publish: Entwurf mit Vermerk bei fehlgeschlagenem Test, Lauf endet rot; danach wieder bereit', () => {
  const s = sandbox();
  s.change('1.3.1');
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa'), failedTests);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Test fehlgeschlagen: Kern mit Rohdaten/);
  const [pr] = s.prs();
  assert.equal(pr.draft, 'true');
  assert.match(pr.body, /\*\*Nicht zusammenführen\.\*\*/);
  assert.match(pr.body, /<!-- sr-fassungen-status: fehler -->/);
  assert.deepEqual(s.runs(), ['ci.yml fassungen/einbau']);
  // derselbe Befund wird nach einem Fehler neu gebaut
  assert.match(s.plan({ hasFindings: true, fingerprint: 'aaaaaaaaaaaaaaaa', rows: [row] }).output, /^einbau<<(\S+)\ntrue\n\1$/m);
  const ok = s.publish(einbau('aaaaaaaaaaaaaaaa'), passed);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(s.prs()[0].draft, 'false');
  // und wieder zurück zum Entwurf
  s.publish(einbau('aaaaaaaaaaaaaaaa'), failedTests);
  assert.equal(s.prs()[0].draft, 'true');
});

test('publish: gescheiterter Einbau ergibt einen Entwurf mit Fehlermeldung, auch ohne geänderte Dateien', () => {
  const s = sandbox();
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa', { error: 'node scripts/build-data.mjs endete mit Code 1', step: 'Bibliothek bauen', version: null, changelog: null, validation: null, foreign: null }), null);
  assert.equal(r.status, 1);
  const [pr] = s.prs();
  assert.equal(pr.draft, 'true');
  assert.match(pr.body, /Einbau gescheitert \(Bibliothek bauen\): node scripts\/build-data\.mjs endete mit Code 1/);
  assert.equal(s.remoteGit(['rev-list', '--count', 'main..fassungen/einbau']), '1', 'leerer Commit trägt den Pull Request');
});

test('publish: ohne Rohdaten kein Pull Request, kein Push', () => {
  const s = sandbox();
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa', { error: 'fetch failed', step: 'Rohdaten laden' }), null);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Rohdaten von Fedlex nicht geladen: fetch failed\. Kein Pull Request; das Issue bleibt\./);
  assert.deepEqual(s.prs(), []);
  assert.deepEqual(s.runs(), []);
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/fassungen/einbau'], { cwd: join(s.dir, 'remote.git') }).status, 1);
});

test('publish: Probelauf eröffnet einen Entwurf mit «Probelauf:» auf eigenem Zweig, ohne Closes', () => {
  const s = sandbox();
  s.change('1.3.1');
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa'), passed, { PROBELAUF: 'true', BASE: 'main' });
  assert.equal(r.status, 0, r.stderr);
  const [pr] = s.prs();
  assert.deepEqual([pr.head, pr.draft], ['fassungen/probelauf-main', 'true']);
  assert.match(pr.title, /^Probelauf: SR-Navigator 1\.3\.1/);
  assert.doesNotMatch(pr.body, /Closes #/);
  assert.deepEqual(s.runs(), ['ci.yml fassungen/probelauf-main']);
});

test('publish: CI lässt sich nicht starten, Lauf endet rot, Pull Request bleibt', () => {
  const s = sandbox();
  s.change('1.3.1');
  const r = s.publish(einbau('aaaaaaaaaaaaaaaa'), passed, { GH_STUB_FAIL_WORKFLOW: '1' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Workflow «CI» nicht gestartet/);
  assert.equal(s.prs().length, 1);
  assert.match(s.prs()[0].comments, /Workflow «CI» ist zu diesem Pull Request nicht gestartet[\s\S]*Zweig `fassungen\/einbau`/);
});
