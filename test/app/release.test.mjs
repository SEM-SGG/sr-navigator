// Unit-Tests: Version, Versionsprüfung und Hinweis (src/app/lib/release.js), gehostete Fassung, Release-Angaben und
// scripts/build-site.mjs (in einem leeren Ordner). Ohne DOM und ohne Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseInfo, compareVersions, parseManifest, ageDays, shouldAutoCheck, lastCheck, hintState, snooze, autoCheckEnabled, FRESH_DAYS } from '../../src/app/lib/release.js';
import { changelogSection, changelogDate } from '../../scripts/lib/changelog.mjs';
import { buildManifest } from '../../scripts/build-site.mjs';

const REL = { repoUrl: 'https://github.com/example-org/sr-navigator', asset: 'sr-navigator.html', siteUrl: 'https://example-org.github.io/sr-navigator/', manifest: 'version.json', checkEveryHours: 24, snoozeDays: 7, remindAfterDays: 60 };
const META = { built: '2026-06-01T12:00:00.000Z', version: '1.3.0', release: REL };
const at = (iso) => Date.parse(iso.length > 10 ? iso : iso + 'T09:00:00Z');
const seen = (version, checkedAt, extra = {}) => ({ updateSeen: { version, date: '2026-07-01', url: REL.repoUrl + '/releases/latest/download/sr-navigator.html', checkedAt, ...extra } });

test('releaseInfo: Adressen nur in den Formen github.com/<besitzer>/<repo> und <besitzer>.github.io/<repo>/', () => {
  const r = releaseInfo(META);
  assert.equal(r.version, '1.3.0'); assert.equal(r.built, '2026-06-01');
  assert.equal(r.downloadUrl, 'https://github.com/example-org/sr-navigator/releases/latest/download/sr-navigator.html');
  assert.equal(r.listUrl, 'https://github.com/example-org/sr-navigator/releases');
  assert.equal(r.issuesUrl, 'https://github.com/example-org/sr-navigator/issues/new/choose');
  assert.equal(r.manifestUrl, 'https://example-org.github.io/sr-navigator/version.json');
  assert.equal(r.siteHost, 'example-org.github.io');
  assert.equal(r.checkEveryMs, 24 * 3600000); assert.equal(r.snoozeDays, 7); assert.equal(r.remindAfterDays, 60);
  for (const bad of ['http://github.com/a/b', 'https://example.com/a/b', 'https://github.com/a/b/c', 'javascript:alert(1)', '', null]) {
    const x = releaseInfo({ ...META, release: { ...REL, repoUrl: bad } });
    assert.equal(x.downloadUrl, null, String(bad)); assert.equal(x.listUrl, null); assert.equal(x.issuesUrl, null);
  }
  for (const bad of ['http://a.github.io/b/', 'https://a.github.io/b', 'https://example.com/b/', 'https://a.github.io/b/c/', 'https://a.github.io.evil.example/b/', '', null]) {
    const x = releaseInfo({ ...META, release: { ...REL, siteUrl: bad } });
    assert.equal(x.manifestUrl, null, String(bad)); assert.equal(x.siteUrl, null);
  }
  assert.equal(releaseInfo({ ...META, release: { ...REL, manifest: '../x.json' } }).manifestUrl, null);
  assert.equal(releaseInfo({ ...META, release: { ...REL, asset: '../x.html' } }).downloadUrl, null);
  assert.equal(releaseInfo(null).downloadUrl, null);
  assert.equal(r.docsUrl, 'https://example-org.github.io/sr-navigator/dokumentation.html');
  assert.equal(r.contact, null, 'ohne Feld contact keine E-Mail-Adresse');
  assert.equal(releaseInfo({ ...META, release: { ...REL, contact: 'stelle@example.org' } }).contact, 'stelle@example.org');
  for (const bad of ['javascript:alert(1)', 'a@b', 'x@example.org?subject=1', 42]) assert.equal(releaseInfo({ ...META, release: { ...REL, contact: bad } }).contact, null, String(bad));
  assert.equal(releaseInfo({ built: '2026-06-01T00:00:00Z' }).remindAfterDays, 60);
});

test('releaseInfo: Etikett BETA nur mit beta: true; die Adresse für Meldungen hängt nicht am Schalter', () => {
  assert.equal(releaseInfo(META).beta, false, 'ohne Feld beta kein Etikett');
  assert.equal(releaseInfo({ ...META, release: { ...REL, beta: true } }).beta, true);
  for (const off of [false, 'true', 1, null]) assert.equal(releaseInfo({ ...META, release: { ...REL, beta: off } }).beta, false, String(off));
  assert.equal(releaseInfo(null).beta, false);
  assert.equal(releaseInfo({ ...META, release: { ...REL, beta: false } }).issuesUrl, REL.repoUrl + '/issues/new/choose');
  assert.equal(releaseInfo({ ...META, release: { ...REL, beta: true, repoUrl: null } }).issuesUrl, null);
});

test('compareVersions: Zahl für Zahl, auch Datumsversionen und Zusatz -n; ungültige Eingaben ergeben null', () => {
  assert.equal(compareVersions('1.3.0', '1.2.1'), 1);
  assert.equal(compareVersions('1.2.1', '1.3.0'), -1);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.3', '1.3.0'), 0);
  assert.equal(compareVersions('2026.11.18-2', '2026.11.18'), 1);
  assert.equal(compareVersions('2026.11.18', '2026.2.1'), 1);
  for (const bad of ['v1.2.0', '1.2.x', '', null, undefined, 12, '1..2', '1.2.0-beta']) assert.equal(compareVersions(bad, '1.0.0'), null, String(bad));
});

test('parseManifest: Version nötig, Datum nur als JJJJ-MM-TT, Download-Adresse nur im eigenen Repository', () => {
  const r = releaseInfo(META);
  assert.deepEqual(parseManifest({ version: '1.4.0', date: '2026-12-01', url: REL.repoUrl + '/releases/download/v1.4.0/sr-navigator.html' }, r),
    { version: '1.4.0', date: '2026-12-01', url: REL.repoUrl + '/releases/download/v1.4.0/sr-navigator.html' });
  assert.equal(parseManifest({ version: '1.4.0', url: 'https://evil.example/x.html' }, r).url, r.downloadUrl);
  assert.equal(parseManifest({ version: '1.4.0', url: REL.repoUrl + '.evil.example/releases/x' }, r).url, r.downloadUrl);
  assert.equal(parseManifest({ version: '1.4.0', url: REL.repoUrl + '/releases/x" onclick="' }, r).url, r.downloadUrl);
  assert.equal(parseManifest({ version: '1.4.0', date: '1. Dezember' }, r).date, null);
  for (const bad of [null, 'x', [], {}, { version: 'neu' }, { version: 14 }]) assert.equal(parseManifest(bad, r), null);
});

test('ageDays: ganze Tage, nie negativ', () => {
  assert.equal(ageDays('2026-06-01', at('2026-06-01')), 0);
  assert.equal(ageDays('2026-06-01', at('2026-07-31')), 60);
  assert.equal(ageDays('2026-06-01', at('2026-05-01')), 0);
  assert.equal(ageDays('unsinn', at('2026-07-31')), 0);
});

test('shouldAutoCheck: höchstens einmal je Tag, nicht ohne Adresse, nicht wenn abgeschaltet', () => {
  const r = releaseInfo(META);
  assert.equal(shouldAutoCheck(r, {}, at('2026-06-02')), true);
  assert.equal(shouldAutoCheck(r, { updateTried: '2026-06-02T08:00:00.000Z' }, at('2026-06-02T20:00:00Z')), false);
  assert.equal(shouldAutoCheck(r, { updateTried: '2026-06-02T08:00:00.000Z' }, at('2026-06-03T08:00:00Z')), true);
  assert.equal(shouldAutoCheck(r, { updateTried: '2030-01-01T00:00:00.000Z' }, at('2026-06-03')), true, 'Zeitpunkt in der Zukunft blockiert nicht');
  assert.equal(shouldAutoCheck(r, { updateCheck: false }, at('2026-06-02')), false);
  assert.equal(autoCheckEnabled({}), true); assert.equal(autoCheckEnabled({ updateCheck: false }), false);
  assert.equal(shouldAutoCheck(releaseInfo({ ...META, release: { ...REL, siteUrl: null } }), {}, at('2026-06-02')), false);
  assert.equal(shouldAutoCheck(null, {}), false);
});

test('hintState: neuere Version aus der Prüfung; gleiche oder ältere Version ergibt keinen Hinweis', () => {
  const r = releaseInfo(META); const now = at('2026-07-02');
  const h = hintState(r, seen('1.4.0', '2026-07-02T08:00:00.000Z'), now);
  assert.deepEqual(h, { kind: 'newer', version: '1.4.0', date: '2026-07-01', url: REL.repoUrl + '/releases/latest/download/sr-navigator.html', key: 'v1.4.0' });
  assert.equal(hintState(r, seen('1.3.0', '2026-07-02T08:00:00.000Z'), now).kind, 'none');
  assert.equal(hintState(r, seen('1.2.9', '2026-07-02T08:00:00.000Z'), now).kind, 'none');
  assert.equal(lastCheck(r, seen('1.4.0', '2026-07-02T08:00:00.000Z'), now).newer, true);
  assert.equal(lastCheck(r, { updateSeen: { version: 'x', checkedAt: '2026-07-02T08:00:00.000Z' } }, now), null);
  assert.equal(lastCheck(r, {}, now), null);
});

test('hintState: «Später erinnern» gilt für genau diese Version und läuft nach snoozeDays ab', () => {
  const r = releaseInfo(META); const now = at('2026-07-02');
  const z = snooze(r, 'v1.4.0', now);
  assert.deepEqual(z, { key: 'v1.4.0', until: '2026-07-09' });
  const s = { ...seen('1.4.0', '2026-07-02T08:00:00.000Z'), releaseSnooze: z };
  assert.equal(hintState(r, s, at('2026-07-08')).kind, 'none');
  assert.equal(hintState(r, s, at('2026-07-09')).kind, 'newer');
  assert.equal(hintState(r, { ...seen('1.5.0', '2026-07-03T08:00:00.000Z'), releaseSnooze: z }, at('2026-07-03')).kind, 'newer', 'noch neuere Version erscheint trotz Zurückstellen');
});

test('hintState: ohne frische Prüfung erinnert das Alter der Datei, mit frischer Prüfung nicht', () => {
  const r = releaseInfo(META);
  assert.equal(hintState(r, {}, at('2026-07-30')).kind, 'none');
  assert.deepEqual(hintState(r, {}, at('2026-07-31')), { kind: 'age', days: 60, url: r.downloadUrl, key: 'age' });
  assert.equal(hintState(r, seen('1.3.0', '2026-11-10T08:00:00.000Z'), at('2026-11-18')).kind, 'none', 'frisch geprüft und aktuell');
  const stale = new Date(at('2026-11-18') - (FRESH_DAYS + 1) * 86400000).toISOString();
  assert.equal(hintState(r, seen('1.3.0', stale), at('2026-11-18')).kind, 'age', 'Prüfung zu alt');
  assert.equal(hintState(r, { releaseSnooze: snooze(r, 'age', at('2026-11-18')) }, at('2026-11-20')).kind, 'none');
  assert.equal(hintState(r, { releaseSnooze: snooze(r, 'age', at('2026-11-18')) }, at('2026-11-25')).kind, 'age');
  assert.equal(hintState(releaseInfo({ ...META, release: null }), {}, at('2026-11-18')).kind, 'none');
  assert.equal(hintState(null, {}).kind, 'none');
});

test('releaseInfo: gehostet nur unter https und unter siteUrl (Präfix mit «/»)', () => {
  const hosted = (href, release = REL) => releaseInfo({ ...META, release }, href).hosted;
  assert.equal(hosted(REL.siteUrl + 'app/'), true);
  assert.equal(hosted(REL.siteUrl + 'app/index.html#/info?ui=fr'), true);
  assert.equal(hosted(REL.siteUrl), true);
  for (const href of [
    'https://example-org.github.io/sr-navigator-x/app/', // anderes Repository mit gleichem Anfang
    'https://example-org.github.io/sr-navigator', // ohne «/» am Ende
    'https://example-org.github.io/', 'https://example-org.github.io/andere/app/',
    'https://evil.example/sr-navigator/app/', 'https://example-org.github.io.evil.example/sr-navigator/app/',
    'http://example-org.github.io/sr-navigator/app/',
    'file:///Users/x/Downloads/sr-navigator.html', 'file:///https://example-org.github.io/sr-navigator/app/',
    '', null, undefined, 42,
  ]) assert.equal(hosted(href), false, String(href));
  assert.equal(releaseInfo(META).hosted, false, 'ohne Adresse nicht gehostet');
  assert.equal(hosted(REL.siteUrl + 'app/', { ...REL, siteUrl: null }), false, 'ohne siteUrl nie gehostet');
  assert.equal(hosted(REL.siteUrl + 'app/', { ...REL, siteUrl: 'https://example-org.github.io/sr-navigator' }), false, 'ungültige siteUrl');
});

test('hintState gehostet: neuere Version wie bisher, kein Hinweis nach Alter, «Später erinnern» gilt', () => {
  const r = releaseInfo(META, REL.siteUrl + 'app/');
  assert.equal(r.hosted, true);
  const now = at('2026-07-02');
  assert.deepEqual(hintState(r, seen('1.4.0', '2026-07-02T08:00:00.000Z'), now),
    { kind: 'newer', version: '1.4.0', date: '2026-07-01', url: REL.repoUrl + '/releases/latest/download/sr-navigator.html', key: 'v1.4.0' });
  const z = snooze(r, 'v1.4.0', now);
  const s = { ...seen('1.4.0', '2026-07-02T08:00:00.000Z'), releaseSnooze: z };
  assert.deepEqual(hintState(r, s, at('2026-07-08')), { kind: 'none', snoozed: true });
  assert.equal(hintState(r, s, at('2026-07-09')).kind, 'newer');
  assert.equal(hintState(r, { ...seen('1.5.0', '2026-07-03T08:00:00.000Z'), releaseSnooze: z }, at('2026-07-03')).kind, 'newer');
  // Gleiche Datei über file:// erinnert nach 60 Tagen; gehostet nie, auch ohne Prüfung oder mit alter Prüfung.
  assert.equal(hintState(releaseInfo(META, 'file:///x/sr-navigator.html'), {}, at('2026-11-18')).kind, 'age');
  assert.deepEqual(hintState(r, {}, at('2026-11-18')), { kind: 'none' });
  assert.deepEqual(hintState(r, seen('1.3.0', '2026-07-02T08:00:00.000Z'), at('2027-06-01')), { kind: 'none' });
  assert.equal(hintState(r, seen('1.3.0', '2026-07-02T08:00:00.000Z'), at('2026-07-03')).kind, 'none');
});

test('buildManifest: Versionsangabe der Projektseite passt zu parseManifest', () => {
  const m = buildManifest({ version: '1.3.0', date: '2026-11-18', config: REL, notes: '- Eintrag' });
  assert.deepEqual(m, { version: '1.3.0', date: '2026-11-18', url: REL.repoUrl + '/releases/download/v1.3.0/sr-navigator.html', notes: { de: '- Eintrag' } });
  assert.deepEqual(parseManifest(m, releaseInfo(META)), { version: '1.3.0', date: '2026-11-18', url: m.url });
  assert.throws(() => buildManifest({ version: '1.3.0', date: '18.11.2026', config: REL, notes: '' }), /Datum/);
});

test('changelogSection: Abschnitt der Version ohne Überschrift, null wenn er fehlt oder leer ist', () => {
  const md = '# Änderungen\n\n## 1.2.1 (18. November 2026)\n\n- A\n- B\n\n## 1.2.0 (1. Juni 2026)\n\n- C\n\n## 1.1.0\n\n## 1.0.0 (x)\n- D';
  assert.equal(changelogSection(md, '1.2.1'), '- A\n- B');
  assert.equal(changelogSection(md, '1.2.0'), '- C');
  assert.equal(changelogSection(md, '1.0.0'), '- D');
  assert.equal(changelogSection(md, '1.1.0'), null);
  assert.equal(changelogSection(md, '1.2'), null);
  assert.equal(changelogSection(md, '9.9.9'), null);
  assert.equal(changelogDate(md, '1.2.1'), '18. November 2026');
  assert.equal(changelogDate(md, '1.1.0'), null);
});

test('Release-Angaben stimmen überein: package.json, CHANGELOG.md, release.config.json', () => {
  const root = new URL('../../', import.meta.url);
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.ok(changelogSection(readFileSync(new URL('CHANGELOG.md', root), 'utf8'), pkg.version), `CHANGELOG.md ohne Abschnitt ${pkg.version}`);
  const cfg = JSON.parse(readFileSync(new URL('release.config.json', root), 'utf8'));
  const r = releaseInfo({ built: '2026-01-01T00:00:00Z', version: pkg.version, release: cfg });
  assert.ok(r.downloadUrl, 'release.config.json ergibt keine Download-Adresse');
  assert.ok(r.downloadUrl.endsWith('/' + cfg.asset));
  assert.ok(r.manifestUrl, 'release.config.json ergibt keine Adresse der Versionsangabe');
  assert.equal(r.docsUrl, cfg.siteUrl + 'dokumentation.html');
  assert.equal(r.contact, 'sektion-grenze@sem.admin.ch', 'Funktionsadresse für Rückmeldungen ohne GitHub-Konto');
  assert.equal(typeof cfg.beta, 'boolean', 'Schalter beta (Etikett BETA) ist true oder false');
  assert.ok(r.issuesUrl, 'release.config.json ergibt keine Adresse für Meldungen (Rückmelde-Symbol)');
});

/** Kopie von scripts/build-site.mjs mit den nötigen Dateien in einem leeren Ordner; dist/<asset> nach Wahl. */
function siteSandbox({ app = true } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // realpath: Unter macOS ist tmpdir() ein symbolischer Link; sonst erkennt das Skript den direkten Aufruf nicht.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sr-site-')));
  for (const f of ['scripts/build-site.mjs', 'scripts/lib/changelog.mjs', 'site/index.template.html', 'docs/sr-navigator-dokumentation.html', 'package.json', 'CHANGELOG.md', 'release.config.json']) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    cpSync(join(root, f), join(dir, f));
  }
  const cfg = JSON.parse(readFileSync(join(dir, 'release.config.json'), 'utf8'));
  // Inhalt mit Zeichen ausserhalb von ASCII, Zeilenenden \r\n und Nullbyte: Die Kopie muss Byte für Byte gleich sein.
  const bytes = Buffer.concat([Buffer.from('<!DOCTYPE html>\r\n<title>SR-Navigator «Prüfung» ß</title>\n', 'utf8'), Buffer.from([0, 255, 254, 10])]);
  if (app) { mkdirSync(join(dir, 'dist')); writeFileSync(join(dir, 'dist', cfg.asset), bytes); }
  const run = (...args) => spawnSync(process.execPath, [join(dir, 'scripts/build-site.mjs'), '--date', '2026-11-23', ...args], { cwd: dir, encoding: 'utf8' });
  return { dir, out: join(dir, 'dist/site'), bytes, run };
}

test('build-site: app/index.html ist bytegleich zu dist/<asset>; ohne Datei entsteht die Seite ohne app/', () => {
  const s = siteSandbox();
  const a = s.run();
  assert.equal(a.status, 0, a.stderr);
  assert.ok(readFileSync(join(s.out, 'app/index.html')).equals(s.bytes), 'Kopie weicht ab');
  assert.match(a.stdout, /app\/index\.html/);
  for (const f of ['index.html', 'version.json', '.nojekyll', 'dokumentation.html']) assert.ok(existsSync(join(s.out, f)), f);
  // Produktdokumentation unter der festen Adresse dokumentation.html, Byte für Byte wie im Repository.
  assert.ok(readFileSync(join(s.out, 'dokumentation.html')).equals(readFileSync(join(s.dir, 'docs/sr-navigator-dokumentation.html'))), 'Kopie der Dokumentation weicht ab');
  // Die Projektseite führt in allen drei Sprachen zuerst zum Navigator im Browser, daneben zum Download.
  const page = readFileSync(join(s.out, 'index.html'), 'utf8');
  assert.equal((page.match(/<a class="btn" href="app\/">/g) || []).length, 3);
  assert.equal((page.match(/<a class="btn btn-2" href="https:\/\/github\.com\/[^"]+\/releases\/latest\/download\/[^"]+">/g) || []).length, 3);
  // In allen drei Sprachen: Link zur Produktdokumentation und Funktionsadresse für Rückmeldungen ohne GitHub-Konto.
  assert.equal((page.match(/<a href="dokumentation\.html">/g) || []).length, 3);
  assert.equal((page.match(/<a href="mailto:sektion-grenze@sem\.admin\.ch">sektion-grenze@sem\.admin\.ch<\/a>/g) || []).length, 3);
  const b = siteSandbox({ app: false });
  const r = b.run();
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(b.out, 'index.html')) && existsSync(join(b.out, 'version.json')));
  assert.equal(existsSync(join(b.out, 'app')), false);
  assert.match(r.stdout, /ohne app\//);
});

test('build-site --require-app: bricht ohne dist/<asset> mit Meldung ab und schreibt nichts; mit Datei läuft es', () => {
  const b = siteSandbox({ app: false });
  const r = b.run('--require-app');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dist\/sr-navigator\.html fehlt/);
  assert.equal(existsSync(b.out), false, 'keine halbe Seite');
  const s = siteSandbox();
  const a = s.run('--require-app');
  assert.equal(a.status, 0, a.stderr);
  assert.ok(readFileSync(join(s.out, 'app/index.html')).equals(s.bytes));
});

test('build-site: ohne Produktdokumentation bricht das Skript mit Meldung ab und schreibt nichts', () => {
  const s = siteSandbox();
  rmSync(join(s.dir, 'docs/sr-navigator-dokumentation.html'));
  const r = s.run();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /docs\/sr-navigator-dokumentation\.html fehlt/);
  assert.equal(existsSync(s.out), false, 'keine halbe Seite');
});
