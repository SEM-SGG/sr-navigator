// Version und Hinweis auf eine neuere Version. Reine Funktionen, ohne DOM und ohne Netz.
// Der Abruf der Versionsangabe liegt in src/app/update.js, die Oberfläche in src/app/ui/updatehint.js.
// Die Adressen kommen aus release.config.json (beim Build eingebettet). Verwendet werden nur Adressen der Form
// https://github.com/<besitzer>/<repo>/… und https://<besitzer>.github.io/<repo>/…
// Dieselbe Datei liegt auch auf der Projektseite unter app/ («gehostete Fassung»). releaseInfo erkennt das an der Adresse
// der Seite; dann entfallen der Hinweis nach Alter und der Download-Hinweis, und eine neue Version kommt mit dem Neuladen.

const DAY = 86400000;
const HOUR = 3600000;
/** So lange gilt eine erfolgreiche Prüfung als frisch. Danach erinnert der Navigator wieder nach dem Alter der Datei. */
export const FRESH_DAYS = 14;

const num = (v, fallback) => (Number.isFinite(v) && v > 0 ? v : fallback);

/** Liegt die Seite unter der Projektseite? Nur https und nur als Präfix der validierten siteUrl (endet auf «/»). */
const isHosted = (href, siteUrl) => !!siteUrl && typeof href === 'string' && href.startsWith('https:') && href.startsWith(siteUrl);

/**
 * Angaben zur Veröffentlichung aus den eingebetteten Metadaten. Fehlt die Konfiguration, gibt es weder Prüfung noch Hinweis.
 * href ist die Adresse der Seite (location.href); hosted ist true, wenn sie unter siteUrl liegt.
 */
export function releaseInfo(meta, href) {
  const m = meta || {};
  const r = m.release && typeof m.release === 'object' ? m.release : null;
  const repoUrl = r && typeof r.repoUrl === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(r.repoUrl) ? r.repoUrl : null;
  const asset = r && typeof r.asset === 'string' && /^[\w][\w.-]*$/.test(r.asset) ? r.asset : null;
  const siteUrl = r && typeof r.siteUrl === 'string' && /^https:\/\/[\w-]+\.github\.io\/[\w.-]+\/$/.test(r.siteUrl) ? r.siteUrl : null;
  const manifest = r && typeof r.manifest === 'string' && /^[\w][\w.-]*\.json$/.test(r.manifest) ? r.manifest : null;
  return {
    version: typeof m.version === 'string' ? m.version : null,
    built: typeof m.built === 'string' ? m.built.slice(0, 10) : null,
    repoUrl,
    downloadUrl: repoUrl && asset ? `${repoUrl}/releases/latest/download/${asset}` : null,
    listUrl: repoUrl ? `${repoUrl}/releases` : null,
    issuesUrl: repoUrl ? `${repoUrl}/issues/new/choose` : null,
    siteUrl,
    siteHost: siteUrl ? new URL(siteUrl).host : null,
    hosted: isHosted(href, siteUrl),
    manifestUrl: siteUrl && manifest ? siteUrl + manifest : null,
    checkEveryMs: num(r && r.checkEveryHours, 24) * HOUR,
    remindAfterDays: num(r && r.remindAfterDays, 60),
    snoozeDays: num(r && r.snoozeDays, 7),
  };
}

/** Vergleicht zwei Versionen der Form 1.2.3 (auch 2026.11.18 oder 1.2.3-2). 1: a neuer, -1: a älter, 0: gleich, null: ungültig. */
export function compareVersions(a, b) {
  const parse = (v) => (typeof v === 'string' && /^\d+(\.\d+)*(-\d+)?$/.test(v) ? v.split(/[.-]/).map(Number) : null);
  const x = parse(a), y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Prüft die Versionsangabe der Projektseite ({ version, date, url, notes }). Liefert { version, date, url } oder null.
 * Die Download-Adresse muss im Repository liegen; sonst gilt die Adresse aus der Konfiguration.
 */
export function parseManifest(json, info) {
  if (!json || typeof json !== 'object' || compareVersions(json.version, '0') === null) return null;
  const date = typeof json.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(json.date) && Number.isFinite(Date.parse(json.date)) ? json.date : null;
  const own = info && info.repoUrl && typeof json.url === 'string' && json.url.startsWith(info.repoUrl + '/releases/') && !/[\s"'<>\\]/.test(json.url);
  return { version: json.version, date, url: own ? json.url : (info && info.downloadUrl) || null };
}

/** Ganze Tage zwischen dem Build (ISO-Datum) und jetzt; nie negativ. */
export function ageDays(built, now = Date.now()) {
  const t = Date.parse(`${String(built).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY));
}

/** Ist die Prüfung beim Start eingeschaltet? Standard: ja. */
export const autoCheckEnabled = (settings) => !settings || settings.updateCheck !== false;

/** Soll der Navigator jetzt von sich aus prüfen? Höchstens einmal je checkEveryMs, nur mit Adresse und eingeschalteter Prüfung. */
export function shouldAutoCheck(info, settings, now = Date.now()) {
  if (!info || !info.manifestUrl || !info.version || !autoCheckEnabled(settings)) return false;
  const last = Date.parse((settings && settings.updateTried) || '');
  return !Number.isFinite(last) || now - last >= info.checkEveryMs || last > now;
}

/** Ergebnis der letzten erfolgreichen Prüfung aus den Einstellungen: { version, date, url, checkedAt, newer, fresh } oder null. */
export function lastCheck(info, settings, now = Date.now()) {
  const s = settings && settings.updateSeen;
  if (!info || !s || typeof s !== 'object') return null;
  const cmp = compareVersions(s.version, info.version);
  const at = Date.parse(s.checkedAt || '');
  if (cmp === null || !Number.isFinite(at)) return null;
  return { version: s.version, date: s.date || null, url: s.url || info.downloadUrl, checkedAt: s.checkedAt, newer: cmp > 0, fresh: now - at < FRESH_DAYS * DAY };
}

const snoozed = (settings, key, now) => {
  const z = settings && settings.releaseSnooze;
  if (!z || typeof z !== 'object' || z.key !== key) return false;
  const until = Date.parse(`${String(z.until).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(until) && now < until;
};

/**
 * Welcher Hinweis erscheint unter der Kopfzeile?
 *   { kind: 'newer', version, date, url, key }  die Prüfung hat eine neuere Version gefunden
 *   { kind: 'age', days, url, key }             keine frische Prüfung, und die Datei ist älter als remindAfterDays
 *                                               (nicht in der gehosteten Fassung: Sie ist beim Laden aktuell)
 *   { kind: 'none' }
 * «Später erinnern» stellt genau diesen Hinweis zurück (key). Eine noch neuere Version erscheint trotzdem.
 */
export function hintState(info, settings, now = Date.now()) {
  if (!info || !info.version || !info.downloadUrl) return { kind: 'none' };
  const last = lastCheck(info, settings, now);
  if (last && last.newer) {
    const key = 'v' + last.version;
    return snoozed(settings, key, now) ? { kind: 'none', snoozed: true } : { kind: 'newer', version: last.version, date: last.date, url: last.url, key };
  }
  if ((last && last.fresh) || info.hosted) return { kind: 'none' };
  const days = info.built ? ageDays(info.built, now) : 0;
  if (days < info.remindAfterDays) return { kind: 'none' };
  return snoozed(settings, 'age', now) ? { kind: 'none', snoozed: true } : { kind: 'age', days, url: info.downloadUrl, key: 'age' };
}

/** Eintrag für die Einstellungen: stellt den Hinweis mit diesem Schlüssel um snoozeDays zurück. */
export function snooze(info, key, now = Date.now()) {
  return { key, until: new Date(now + (info ? info.snoozeDays : 7) * DAY).toISOString().slice(0, 10) };
}
