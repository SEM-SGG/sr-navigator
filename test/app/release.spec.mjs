// Browsertests: Versionsprüfung über die Projektseite, Hinweis auf eine neuere Version, Abschnitt «Version» in Info.
// Die Versionsangabe ist immer eine Attrappe (pw.mjs); kein Test fragt die echte Projektseite ab.
// Varianten aus global-setup: sr-navigator-alt.html (Build-Datum 1. Juni 2026), sr-navigator-ohne-pruefung.html.
import { test, expect, VERSION, CFG, MANIFEST_URL, LIST_URL, DOWNLOAD_URL, manifestRoute, currentManifest, updateSettled } from './pw.mjs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { layoutCheck } from './helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const NEW = 'file://' + join(ROOT, 'dist/sr-navigator.html');
const OLD = 'file://' + join(ROOT, 'test/app/out/sr-navigator-alt.html');
const PLAIN = 'file://' + join(ROOT, 'test/app/out/sr-navigator-ohne-pruefung.html');
const SHOTS = join(ROOT, 'test/app/out/shots-release');
mkdirSync(SHOTS, { recursive: true });

const [DB_NAME, DB_STORE] = ['sr-navigator', 'kv']; // wie src/app/lib/store.js
const NEXT = VERSION.replace(/^(\d+)\.(\d+)\.\d+$/, (_, a, b) => `${a}.${Number(b) + 1}.0`);
const PREV = VERSION.replace(/^(\d+)\.(\d+)\.\d+$/, (_, a, b) => `${a}.${Math.max(0, Number(b) - 1)}.0`);
const NEXT_URL = `${LIST_URL}/download/v${NEXT}/${CFG.asset}`;
const newer = (extra = {}) => ({ version: NEXT, date: '2026-12-12', url: NEXT_URL, notes: { de: '- Neu' }, ...extra });

/** Setzt den Zeitpunkt der letzten Prüfung zurück: Beim nächsten Start prüft der Navigator wieder, sofern eingeschaltet. */
const resetTried = (page) => page.evaluate(([db, store]) => new Promise((res, rej) => {
  const open = indexedDB.open(db);
  open.onerror = () => rej(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction(store, 'readwrite'); const os = tx.objectStore(store); const get = os.get('settings');
    get.onsuccess = () => os.put({ ...get.result, updateTried: '2020-01-01T00:00:00.000Z' }, 'settings');
    tx.oncomplete = () => { open.result.close(); res(); }; tx.onerror = () => rej(tx.error);
  };
}), [DB_NAME, DB_STORE]);

async function open(page, url, hash = '#/bibliothek') {
  const log = { errors: [], requests: [] };
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) log.requests.push(u); });
  await page.goto(url + hash);
  await page.waitForFunction(() => window.__sr && window.__sr.ready, null, { timeout: 30000 });
  await updateSettled(page);
  return log;
}
const info = async (page) => { await page.evaluate(() => { location.hash = '#/info'; }); const sec = page.locator('section[aria-labelledby="vs-h"]'); await expect(sec).toBeVisible(); return sec; };

test('Aktuelle Datei: genau eine Anfrage an die Versionsangabe, kein Hinweis; Info nennt Version, Prüfung und Links', async ({ page }) => {
  const log = await open(page, NEW);
  expect(log.requests).toEqual([MANIFEST_URL]);
  await expect(page.locator('.update-hint')).toHaveCount(0);
  const sec = await info(page);
  await expect(sec).toContainText(`Version ${VERSION}`);
  await expect(sec.locator('.vs-status')).toContainText('Diese Datei ist aktuell');
  await expect(sec.locator('.vs-check input')).toBeChecked();
  await expect(sec).toContainText(new URL(MANIFEST_URL).host);
  const hrefs = [];
  for (const a of await sec.locator('.vs-links a').all()) {
    hrefs.push(await a.getAttribute('href'));
    expect(await a.getAttribute('target')).toBe('_blank');
    expect(await a.getAttribute('rel')).toBe('noopener noreferrer');
  }
  expect(hrefs).toEqual([CFG.siteUrl, LIST_URL, CFG.repoUrl, `${CFG.repoUrl}/issues/new/choose`]);
  expect(log.errors).toEqual([]);
  expect(log.requests).toEqual([MANIFEST_URL]);
});

test('Neuere Version: Hinweis mit Version, Datum und Download-Link; «Später erinnern» bleibt nach dem Neuladen, ohne zweite Anfrage am selben Tag', async ({ page }) => {
  const m = await manifestRoute(page, newer());
  const log = await open(page, NEW);
  const hint = page.locator('.update-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('data-kind', 'newer');
  await expect(hint).toContainText(`Eine neue Version des SR-Navigators ist verfügbar: ${NEXT} vom 12. Dezember 2026. Diese Datei hat Version ${VERSION}.`);
  const dl = hint.locator('a.btn-primary');
  await expect(dl).toHaveText('Neueste Version herunterladen');
  expect(await dl.getAttribute('href')).toBe(NEXT_URL);
  expect(await dl.getAttribute('target')).toBe('_blank');
  expect(await dl.getAttribute('rel')).toBe('noopener noreferrer');
  expect(await hint.getByRole('link', { name: 'Was ist neu' }).getAttribute('href')).toBe(LIST_URL);
  await page.screenshot({ path: join(SHOTS, '1440-de-neue-version.png') });
  // Der Hinweis steht in jeder Ansicht.
  await page.evaluate(() => { location.hash = '#/lesen?w=cc-2007-758&u=art_5'; });
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Später erinnern' }).click();
  await expect(hint).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await updateSettled(page);
  await expect(page.locator('.update-hint')).toHaveCount(0);
  expect(m.count).toBe(1);
  const sec = await info(page);
  await expect(sec.locator('.vs-status')).toContainText(`Version ${NEXT} ist verfügbar`);
  expect(await sec.locator('.vs-actions a.btn-primary').getAttribute('href')).toBe(NEXT_URL);
  expect(log.errors).toEqual([]);
});

test('Ältere Version in der Versionsangabe: kein Hinweis. Fremde Download-Adresse: Link fällt auf das Repository zurück', async ({ page }) => {
  await manifestRoute(page, { version: PREV, date: '2026-01-01' });
  await open(page, NEW);
  await expect(page.locator('.update-hint')).toHaveCount(0);
  await page.unroute(MANIFEST_URL);
  await manifestRoute(page, newer({ url: 'https://example.com/boese.html' }));
  const sec = await info(page);
  await sec.getByRole('button', { name: 'Jetzt nach neuer Version suchen' }).click();
  const dl = page.locator('.update-hint a.btn-primary');
  await expect(dl).toBeVisible();
  expect(await dl.getAttribute('href')).toBe(DOWNLOAD_URL);
});

test('Fehler bleiben beim Start still; die manuelle Suche meldet sie und findet danach die neue Version', async ({ page }) => {
  for (const answer of ['offline', 404, { unsinn: true }]) {
    await page.unroute(MANIFEST_URL).catch(() => {});
    await manifestRoute(page, answer);
    const log = await open(page, NEW);
    await expect(page.locator('.update-hint')).toHaveCount(0);
    await expect(page.locator('.toast')).toHaveCount(0);
    expect(log.errors).toEqual([]);
    await page.waitForTimeout(200);
    await resetTried(page);
  }
  const sec = await info(page);
  await expect(sec.locator('.vs-status')).toContainText('Noch nicht nach einer neuen Version gesucht');
  await sec.getByRole('button', { name: 'Jetzt nach neuer Version suchen' }).click();
  await expect(sec.locator('.vs-status')).toContainText('Die Versionsangabe ist nicht erreichbar');
  await expect(sec.locator('.vs-status')).toHaveAttribute('role', 'alert');
  await page.unroute(MANIFEST_URL);
  await manifestRoute(page, newer());
  await sec.getByRole('button', { name: 'Jetzt nach neuer Version suchen' }).click();
  await expect(sec.locator('.vs-status')).toContainText(`Version ${NEXT} ist verfügbar`);
  await expect(page.locator('.update-hint')).toBeVisible();
  await page.screenshot({ path: join(SHOTS, '1440-de-info-version.png'), fullPage: false });
});

test('Prüfung abgeschaltet: nach dem Neuladen keine Anfrage; die manuelle Suche geht weiterhin', async ({ page }) => {
  const m = await manifestRoute(page, currentManifest());
  await open(page, NEW);
  expect(m.count).toBe(1);
  const sec = await info(page);
  await sec.locator('.vs-check input').uncheck();
  await page.waitForTimeout(300);
  // Den Zeitpunkt der letzten Prüfung zurücksetzen: ohne Schalter würde der Navigator jetzt wieder prüfen.
  await resetTried(page);
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await updateSettled(page);
  expect(m.count).toBe(1);
  const sec2 = await info(page);
  await expect(sec2.locator('.vs-check input')).not.toBeChecked();
  await sec2.getByRole('button', { name: 'Jetzt nach neuer Version suchen' }).click();
  await expect.poll(() => m.count).toBe(2);
});

test('Alte Datei ohne erreichbare Versionsangabe: Hinweis nach Alter; mit frischer Prüfung «aktuell» kein Hinweis', async ({ page }) => {
  await manifestRoute(page, 'offline');
  await open(page, OLD);
  const hint = page.locator('.update-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('data-kind', 'age');
  const days = await page.evaluate(() => Math.floor((Date.now() - Date.parse('2026-06-01T00:00:00Z')) / 86400000));
  await expect(hint).toContainText(`${days} Tage alt (Version ${VERSION} vom 1. Juni 2026)`);
  expect(await hint.locator('a.btn-primary').getAttribute('href')).toBe(DOWNLOAD_URL);
  expect(await hint.getByRole('link', { name: 'Alle Versionen ansehen' }).getAttribute('href')).toBe(LIST_URL);
  await page.unroute(MANIFEST_URL);
  await manifestRoute(page, currentManifest());
  const sec = await info(page);
  await sec.getByRole('button', { name: 'Jetzt nach neuer Version suchen' }).click();
  await expect(sec.locator('.vs-status')).toContainText('Diese Datei ist aktuell');
  await expect(page.locator('.update-hint')).toHaveCount(0);
});

test('Build ohne Versionsprüfung: keine Anfrage, kein Schalter, CSP ohne Projektseite', async ({ page }) => {
  const log = await open(page, PLAIN);
  expect(log.requests).toEqual([]);
  const sec = await info(page);
  await expect(sec).toContainText(`Version ${VERSION}`);
  await expect(sec.locator('.vs-check')).toHaveCount(0);
  await expect(sec.getByRole('button', { name: 'Jetzt nach neuer Version suchen' })).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain('connect-src https://fedlex.data.admin.ch;');
  expect(log.requests).toEqual([]);
});

for (const [lang, word] of [['fr', 'Télécharger la dernière version'], ['it', 'Scaricare la versione più recente'], ['de', 'Neueste Version herunterladen']]) {
  test(`Hinweis und Info ${lang.toUpperCase()}: Texte vorhanden, kein abgeschnittener oder überlappender Text bei 1024 bis 1920 px`, async ({ page }) => {
    await manifestRoute(page, newer());
    for (const w of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await open(page, NEW, `#/bibliothek?ui=${lang}`);
      const hint = page.locator('.update-hint');
      await expect(hint).toBeVisible();
      await expect(hint.locator('a.btn-primary')).toHaveText(word);
      expect(await hint.textContent()).not.toContain('⟦');
      let issues = await page.evaluate(layoutCheck);
      expect(issues, `${lang} ${w}px Bibliothek: ${JSON.stringify(issues).slice(0, 400)}`).toEqual([]);
      if (w === 1024) await page.screenshot({ path: join(SHOTS, `1024-${lang}-neue-version.png`) });
      await page.evaluate((l) => { location.hash = `#/info?ui=${l}`; }, lang);
      const sec = page.locator('section[aria-labelledby="vs-h"]');
      await expect(sec).toBeVisible();
      expect(await sec.textContent()).not.toContain('⟦');
      await sec.scrollIntoViewIfNeeded();
      issues = await page.evaluate(layoutCheck);
      expect(issues, `${lang} ${w}px Info: ${JSON.stringify(issues).slice(0, 400)}`).toEqual([]);
      if (w === 1280) await page.screenshot({ path: join(SHOTS, `1280-${lang}-info-version.png`) });
    }
  });
}
