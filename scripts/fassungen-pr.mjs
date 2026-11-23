// Pull Request zum Einbau neuer Fassungen (Workflow «Fassungen»). Drei Schritte:
//   node scripts/fassungen-pr.mjs plan --befund befund.json
//       entscheidet, ob ein Einbau nötig ist: nein, wenn kein Befund vorliegt oder ein offener Pull Request des Workflows
//       denselben Fingerabdruck trägt. Schreibt einbau=true|false, zweig und befund nach $GITHUB_OUTPUT.
//   node scripts/fassungen-pr.mjs tests --out <ordner>
//       führt die Tests aus und schreibt <ordner>/tests.json (Endet mit Fehler, wenn ein Test fehlschlägt.)
//   node scripts/fassungen-pr.mjs publish --einbau <ordner>
//       liest einbau.json (scripts/apply-fassungen.mjs) und tests.json, committet auf den festen Einbau-Zweig, pusht,
//       eröffnet oder aktualisiert den Pull Request. «CI» gibt ein Mensch im Pull Request frei. Endet mit Fehler, wenn Einbau,
//       Prüfung oder Test fehlschlugen (dann ist der Pull Request ein Entwurf). Ohne Rohdaten kein Pull Request.
// Umgebung: GH_TOKEN, GH_REPO für gh; BASE Zielzweig (Vorgabe main); PROBELAUF=true für einen Probelauf
// (Titel «Probelauf:», immer Entwurf); PLAYWRIGHT_CONFIG für eine andere Konfiguration der Browsertests (lokal).
// git und gh arbeiten im aktuellen Verzeichnis.
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planPr, branchName, prText, testCounts } from './lib/fassungen.mjs';

export const BOT = { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' };
/** Dateien, die der Einbau ändert. Nur sie gehen in den Commit. */
export const COMMIT_FILES = ['data/library.json', 'data/build-log.json', 'data/validation-summary.json', 'data/VALIDATION.md', 'data/VALIDATION_REFS.md', 'scripts/dev/cache/fedlex-citations.json', 'package.json', 'package-lock.json', 'CHANGELOG.md', 'docs/sr-navigator-dokumentation.html'];

export const TESTS = [
  { id: 'release-info', label: 'Version, Changelog und Einstellungen', cmd: 'node', args: ['scripts/release-info.mjs'] },
  { id: 'dokumentation', label: 'Version in der Produktdokumentation', cmd: 'node', args: ['scripts/check-dokumentation.mjs'] },
  { id: 'core', label: 'Kern mit Rohdaten (test:core)', cmd: 'npm', args: ['run', 'test:core'], unset: ['SR_NO_NET'] },
  { id: 'release', label: 'Veröffentlichung (test:release)', cmd: 'npm', args: ['run', 'test:release'] },
  { id: 'unit', label: 'Oberfläche, Unit-Tests (test:app:unit)', cmd: 'npm', args: ['run', 'test:app:unit'] },
  { id: 'build', label: 'Navigator bauen (build)', cmd: 'npm', args: ['run', 'build'] },
  { id: 'site', label: 'Projektseite bauen (site)', cmd: 'npm', args: ['run', 'site'] },
  { id: 'browser', label: 'Browsertests in Chrome', cmd: 'npx', args: ['playwright', 'test', '-c', 'test/app/playwright.config.mjs', '--project=chrome'], env: { NO_NET: '1' } },
];

function sh(cmd, args, { input, allowFail = false, env: extra } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, env: extra ? { ...process.env, ...extra } : process.env });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.slice(0, 2).join(' ')}: ${(r.stderr || r.stdout || '').trim()}`);
  return r;
}
const gh = (args, o) => sh('gh', args, o).stdout;
const git = (args, o) => sh('git', args, o).stdout;

function output(pairs) {
  const f = process.env.GITHUB_OUTPUT;
  const text = Object.entries(pairs).map(([k, v]) => { const d = `EOF_${k}_${Date.now()}`; return `${k}<<${d}\n${v}\n${d}\n`; }).join('');
  if (f) appendFileSync(f, text);
}
const summary = (line) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); };
const env = () => ({ base: process.env.BASE || 'main', probelauf: process.env.PROBELAUF === 'true' });

/**
 * Offener Pull Request des Workflows auf dem Einbau-Zweig, sonst null. Ein Pull Request aus einem Fork mit demselben
 * Zweignamen zählt nicht: «gh pr list --head» vergleicht nur den Namen des Zweigs.
 */
export const ownPr = (list) => (list || []).find((p) => !p.isCrossRepository) || null;
export function openPr(branch, base) {
  return ownPr(JSON.parse(gh(['pr', 'list', '--head', branch, '--base', base, '--state', 'open', '--json', 'number,body,isDraft,url,title,isCrossRepository']) || '[]'));
}

export function plan({ befundFile }) {
  const { base, probelauf } = env();
  const befund = JSON.parse(readFileSync(befundFile, 'utf8'));
  const branch = branchName(base, probelauf);
  let einbau = false, why;
  if (!befund.hasFindings) why = 'Kein Befund: kein Einbau.';
  else {
    const pr = openPr(branch, base);
    const action = planPr(pr, befund.fingerprint);
    einbau = action !== 'skip';
    why = action === 'skip' ? `Pull Request #${pr.number} enthält diesen Befund schon (Fingerabdruck ${befund.fingerprint}). Kein neuer Einbau.`
      : action === 'update' ? `Pull Request #${pr.number} wird neu gebaut (Fingerabdruck ${befund.fingerprint}).`
      : `Neuer Einbau auf ${branch} (Fingerabdruck ${befund.fingerprint}).`;
  }
  console.log(why);
  summary(why);
  output({ einbau: String(einbau), zweig: branch, befund: JSON.stringify(befund) });
  return einbau;
}

export function tests({ out }) {
  mkdirSync(out, { recursive: true });
  const results = [];
  for (const t of TESTS) {
    const e = { ...process.env, ...(t.env || {}) };
    for (const k of t.unset || []) delete e[k];
    const args = t.id === 'browser' && process.env.PLAYWRIGHT_CONFIG ? t.args.map((a) => (a === 'test/app/playwright.config.mjs' ? process.env.PLAYWRIGHT_CONFIG : a)) : t.args;
    console.log(`\n$ ${t.cmd} ${args.join(' ')}`);
    const t0 = Date.now();
    const r = spawnSync(t.cmd, args, { encoding: 'utf8', env: e, maxBuffer: 256 * 1024 * 1024 });
    const text = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(text);
    const ok = r.status === 0;
    results.push({ id: t.id, label: t.label, ok, status: r.status, ms: Date.now() - t0, counts: testCounts(text), tail: ok ? null : text.trim().split('\n').slice(-40).join('\n').slice(-4000) });
  }
  writeFileSync(join(out, 'tests.json'), JSON.stringify({ results }, null, 1));
  const bad = results.filter((r) => !r.ok);
  console.log(`\nTests: ${results.length - bad.length} von ${results.length} bestanden${bad.length ? '; fehlgeschlagen: ' + bad.map((r) => r.label).join(', ') : ''}.`);
  return bad.length ? 1 : 0;
}

export function publish({ einbau }) {
  const { base, probelauf } = env();
  const file = join(einbau, 'einbau.json');
  if (!existsSync(file)) { console.error(`${file} fehlt: Das Einbau-Skript hat kein Ergebnis geschrieben. Kein Pull Request; das Issue bleibt.`); return 1; }
  const e = JSON.parse(readFileSync(file, 'utf8'));
  if (e.nothing) { console.log('Kein Befund: kein Pull Request.'); return 0; }
  if (e.error && e.step === 'Rohdaten laden') {
    const msg = `Rohdaten von Fedlex nicht geladen: ${e.error}. Kein Pull Request; das Issue bleibt.`;
    console.error(msg); summary(msg); return 1;
  }
  const t = existsSync(join(einbau, 'tests.json')) ? JSON.parse(readFileSync(join(einbau, 'tests.json'), 'utf8')) : null;
  const { title, body, failed, reasons } = prText(e, t, { probelauf });
  const draft = failed || probelauf;
  const branch = branchName(base, probelauf);
  const dir = mkdtempSync(join(tmpdir(), 'sr-pr-'));
  const bodyFile = join(dir, 'body.md');
  writeFileSync(bodyFile, body);
  writeFileSync(join(einbau, 'pr.md'), `# ${title}\n\n${body}`);

  git(['switch', '-C', branch]);
  const files = COMMIT_FILES.filter((f) => existsSync(f));
  git(['add', '--', ...files]);
  const msg = `${e.subject || title}\n\nEingebaut vom Workflow «Fassungen» (Fingerabdruck ${e.fingerprint}).${failed ? '\nEinbau unvollständig: ' + reasons.join(' ') : ''}`;
  const id = { GIT_AUTHOR_NAME: BOT.name, GIT_AUTHOR_EMAIL: BOT.email, GIT_COMMITTER_NAME: BOT.name, GIT_COMMITTER_EMAIL: BOT.email };
  git(['commit', '--allow-empty', '--quiet', '--no-verify', '-F', '-'], { input: msg, env: id });
  // Weist GitHub das Überschreiben des Zweigs zurück, löscht der Lauf den Zweig und legt ihn neu an. Ein offener
  // Pull Request schliesst sich dabei; unten entsteht ein neuer.
  const push = () => sh('git', ['push', '--force', '--quiet', 'origin', `HEAD:refs/heads/${branch}`], { allowFail: true });
  let pushed = push();
  if (pushed.status !== 0) {
    console.error(`Push auf ${branch} abgewiesen: ${(pushed.stderr || '').trim()}\nZweiter Versuch mit neu angelegtem Zweig.`);
    sh('git', ['push', '--quiet', 'origin', '--delete', branch], { allowFail: true });
    pushed = push();
    if (pushed.status !== 0) throw new Error(`git push: ${(pushed.stderr || pushed.stdout || '').trim()}`);
  }

  const pr = openPr(branch, base);
  let url;
  if (pr) {
    gh(['pr', 'edit', String(pr.number), '--title', title, '--body-file', bodyFile]);
    if (draft && !pr.isDraft) gh(['pr', 'ready', String(pr.number), '--undo']);
    if (!draft && pr.isDraft) gh(['pr', 'ready', String(pr.number)]);
    url = pr.url;
    console.log(`Pull Request #${pr.number} aktualisiert${draft ? ' (Entwurf)' : ''}: ${url}`);
  } else {
    url = gh(['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body-file', bodyFile, ...(draft ? ['--draft'] : [])]).trim();
    console.log(`Pull Request eröffnet${draft ? ' (Entwurf)' : ''}: ${url}`);
  }
  // «CI» startet der Workflow nicht selbst: GitHub legt zum Pull Request des Standard-Tokens einen Lauf an, der auf die
  // Freigabe eines Menschen wartet (**Approve workflows to run** im Pull Request). Ein über workflow_dispatch gestarteter
  // Lauf erschiene nicht unter den Checks des Pull Requests (Probelauf vom 23. November 2026).
  summary(`${draft ? 'Entwurf' : 'Pull Request'}: ${url}`);
  if (failed) { console.error(`\nEinbau unvollständig:\n- ${reasons.join('\n- ')}`); return 1; }
  return 0;
}

function args(argv) {
  const o = { cmd: argv[0] };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--befund') o.befundFile = argv[++i];
    else if (argv[i] === '--out') o.out = argv[++i];
    else if (argv[i] === '--einbau') o.einbau = argv[++i];
    else throw new Error(`Unbekannte Option ${argv[i]}`);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const o = args(process.argv.slice(2));
    if (o.cmd === 'plan' && o.befundFile) plan(o);
    else if (o.cmd === 'tests' && o.out) process.exit(tests(o));
    else if (o.cmd === 'publish' && o.einbau) process.exit(publish(o));
    else { console.error('Aufruf: node scripts/fassungen-pr.mjs plan --befund <datei> | tests --out <ordner> | publish --einbau <ordner>'); process.exit(2); }
  } catch (err) { console.error(err.message); process.exit(1); }
}
