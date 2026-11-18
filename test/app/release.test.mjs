// Unit-Tests: Version, Versionsprüfung und Hinweis (src/app/lib/release.js) sowie Release-Angaben. Ohne DOM und ohne Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.equal(releaseInfo({ built: '2026-06-01T00:00:00Z' }).remindAfterDays, 60);
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
});
