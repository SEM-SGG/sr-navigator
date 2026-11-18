// UI-Tests SR-Navigator gegen dist/sr-navigator.html über file:// (SPEC §8): Start ohne Fehler und ohne Netz, jeder Arbeitsablauf
// aus SPEC §7, Exporte mit gültigen Dateien, Abruf von Fedlex gemockt (raw/) und einmal echt, Abnahme (Übergabe §12).
// Aufruf: npx playwright test -c test/app/playwright.config.mjs test/app/sr.spec.mjs
import { test, expect, MANIFEST_URL, manifestRoute, currentManifest, updateSettled } from './pw.mjs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { layoutCheck, buttonCheck, mockFedlex } from './helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const APP = 'file://' + join(ROOT, 'dist/sr-navigator.html');
const APP_NO_EESV = 'file://' + join(ROOT, 'test/app/out/sr-navigator-ohne-eesv.html');
const OUT = join(ROOT, 'test/app/out');
mkdirSync(OUT, { recursive: true });
const AIG = 'cc-2007-758';

async function open(page, hash = '#/bibliothek', app = APP) {
  const log = { errors: [], requests: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob):/.test(u) && u !== MANIFEST_URL) log.requests.push(u); });
  await page.goto(app + hash);
  await page.waitForFunction(() => window.__sr && window.__sr.ready, null, { timeout: 30000 });
  await page.waitForTimeout(150);
  return log;
}
async function nav(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(80);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/** Bestimmung mit mindestens zwei Fassungen im Wortlaut (für Chronologie mit Wort-Diff). */
async function changedBlock(page, prefer = 'art_5') {
  return page.evaluate((prefer) => {
    const d = window.__sr.data();
    const units = [prefer, ...d.unitOrder.filter((u) => u !== prefer)];
    for (const u of units) {
      for (const v of d.versions(u, 'de')) for (const b of v.blocks || []) {
        if (!b.t || b.ty) continue;
        const h = d.history(u, 'de', b.k);
        if (h.length >= 2 && h[h.length - 1].block && h[h.length - 2].block && d.exists(u, 'de', d.current.id) && (d.version(u, 'de', d.current.id).blocks || []).some((x) => x.k === b.k)) return { u, k: b.k, n: h.length };
      }
    }
    return null;
  }, prefer);
}

// ------------------------------------------------------------------ Start
test('Start: Bibliothek ohne Konsolenfehler, Netzwerkzugriff allein auf die Versionsangabe, eingebettete Erlasse und Erlasswahl', async ({ page }) => {
  const log = await open(page, '#/');
  await updateSettled(page);
  await expect(page.locator('h1.unit-title')).toHaveText('Erlasse der Bibliothek');
  const items = page.locator('.lib-item');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.lib-item[data-work="cc-2007-758"] .lib-abbr')).toContainText('AIG');
  await expect(page.locator('.lib-item[data-work="cc-2007-758"]')).toContainText('fest eingebettet');
  await expect(page.locator('.lib-item[data-work="cc-2007-758"] .btn-remove')).toHaveCount(0); // eingebettet: nicht entfernbar
  await page.click('#btn-work');
  await expect(page.locator('.wp-item')).toHaveCount(n);
  await page.locator('.wp-item').first().click();
  await expect(page).toHaveURL(/#\/uebersicht\?w=cc-2007-758/);
  await expect(page.locator('.ov-head h1')).toContainText('AIG');
  await page.waitForTimeout(300);
  expect(log.errors).toEqual([]);
  expect(log.requests).toEqual([]);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain(`connect-src https://fedlex.data.admin.ch ${new URL(MANIFEST_URL).origin};`);
});

// ------------------------------------------------------------------ Abnahme (Übergabe §12)
test('Abnahme a: Bestimmung im AIG finden und Chronologie mit Wort-Diff sehen', async ({ page }) => {
  const t0 = Date.now();
  const log = await open(page, `#/lesen?w=${AIG}`);
  await page.fill('#toc-q', 'Art. 5');
  await page.press('#toc-q', 'Enter');
  await expect(page).toHaveURL(/u=art_5/);
  await expect(page.locator('.unit-head .unit-label')).toContainText('Art. 5');
  const cb = await changedBlock(page, 'art_5');
  expect(cb).not.toBeNull();
  if (cb.u !== 'art_5') await nav(page, `#/lesen?w=${AIG}&u=${cb.u}`);
  await page.locator(`.blk[data-k="${cb.k}"]`).click();
  const panel = page.locator('aside.panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.chron .step')).toHaveCount(cb.n);
  await expect(panel.locator('.step-text ins, .step-text del').first()).toBeVisible();
  // Diff nie nur über Farbe
  const deco = await panel.locator('.step-text ins, .step-text del').first().evaluate((e) => getComputedStyle(e).textDecorationLine);
  expect(deco).toMatch(/underline|line-through/);
  await expect(panel.locator('.events')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(60000);
  expect(log.errors).toEqual([]);
});

test('Abnahme b und c: zwei Fassungen vergleichen, Vergleich als PNG und PDF mit korrektem Zitat exportieren', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}`);
  const cb = await changedBlock(page, 'art_5');
  const stages = await page.evaluate(({ u, k }) => { const d = window.__sr.data(); const h = d.history(u, 'de', k); return { a: d.prevStage(h[h.length - 1].stage).id, b: h[h.length - 1].stage }; }, cb);
  await nav(page, `#/vergleich?w=${AIG}&u=${cb.u}&a=${stages.a}&b=${stages.b}`);
  await expect(page.locator('.cmp .cmp-row.st-changed, .cmp .cmp-row.st-ins').first()).toBeVisible();
  const cite = await page.locator('.unit-head .unit-title').textContent();
  expect(cite).toMatch(/^Art\. \S+ AIG$/);
  await page.locator('#cmp-a').selectOption(stages.a);
  // Redline
  await page.getByRole('button', { name: 'Redline' }).click();
  await expect(page.locator('.cmp-redline')).toBeVisible();
  await page.getByRole('button', { name: 'Nebeneinander' }).click();
  // PNG
  await page.locator('.export-menu > button').first().click();
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'PNG A4' }).click()]);
  const pngPath = join(OUT, 'export-vergleich.png');
  await png.saveAs(pngPath);
  expect(png.suggestedFilename()).toMatch(new RegExp(`^${cite.replace(/[^\p{L}\p{N}]+/gu, '-')}_Vergleich_A4\\.png$`, 'u'));
  const buf = readFileSync(pngPath);
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.readUInt32BE(16)).toBe(794 * 2); // Breite A4-Karte, 2-fach
  // PDF
  await page.locator('.export-menu > button').first().click();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'PDF A4' }).click()]);
  const pdfPath = join(OUT, 'export-vergleich.pdf');
  await pdf.saveAs(pdfPath);
  const doc = await PDFDocument.load(readFileSync(pdfPath));
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(doc.getTitle()).toContain(cite);
  expect(doc.getCreator()).toBe('SR-Navigator');
  expect(log.errors).toEqual([]);
});

test('Abnahme d: weiteren Erlass über die SR-Nummer hinzufügen (gemockt, Antworten aus raw/)', async ({ page }) => {
  const mock = await mockFedlex(page);
  const log = await open(page, '#/bibliothek', APP_NO_EESV);
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toHaveCount(0);
  await page.fill('#lib-q', '142.206');
  await page.click('#btn-lib-search');
  const row = page.locator('tr[data-work="cc-2021-734"]');
  await expect(row).toContainText('EESV');
  await expect(row).toContainText('in Kraft');
  await row.locator('.btn-add').click();
  await expect(page.locator('.job')).toBeVisible();
  await expect(page.locator('.job')).toContainText(/Datei \d+ von \d+|Metadaten|verarbeitet|erstellt/);
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toContainText('lokal gespeichert');
  expect(mock.files).toBe(18);
  expect(mock.missing).toEqual([]);
  await page.locator('.lib-item[data-work="cc-2021-734"] .btn-open').click();
  await expect(page.locator('.ov-head h1')).toContainText('EESV');
  await nav(page, '#/lesen?w=cc-2021-734&u=art_1');
  await expect(page.locator('.blocks .blk').first()).toBeVisible();
  // Persistenz (IndexedDB): nach dem Neuladen noch da, dann entfernen
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await nav(page, '#/bibliothek');
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.locator('.lib-item[data-work="cc-2021-734"] .btn-remove').click();
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toHaveCount(0);
  expect(log.errors).toEqual([]);
});

test('Hinzufügen: Abbruch und Fehlermeldung ohne Netz', async ({ page }) => {
  const mock = await mockFedlex(page, { delayMs: 1500 });
  await open(page, '#/bibliothek', APP_NO_EESV);
  await page.fill('#lib-q', '142.206');
  await page.click('#btn-lib-search');
  await page.locator('tr[data-work="cc-2021-734"] .btn-add').click();
  await expect(page.locator('#btn-job-cancel')).toBeVisible();
  await page.click('#btn-job-cancel');
  await expect(page.locator('.toast')).toContainText('Abruf abgebrochen');
  await expect(page.locator('.job')).toHaveCount(0);
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toHaveCount(0);
  mock.offline = true;
  await page.click('#btn-lib-search');
  await expect(page.locator('.notice-error')).toContainText('Keine Verbindung zu Fedlex');
});

test('Echter Abruf gegen Fedlex: ETIASV (SR 142.207) suchen und hinzufügen', async ({ page }) => {
  test.skip(!!process.env.NO_NET, 'ohne Netz');
  test.setTimeout(300000);
  const log = await open(page, '#/bibliothek');
  await page.fill('#lib-q', '142.207');
  await page.click('#btn-lib-search');
  const row = page.locator('tr[data-work="cc-2026-474"]');
  await expect(row).toContainText('ETIASV', { timeout: 120000 });
  await row.locator('.btn-add').click();
  await expect(page.locator('.lib-item[data-work="cc-2026-474"]')).toBeVisible({ timeout: 240000 });
  await page.locator('.lib-item[data-work="cc-2026-474"] .btn-open').click();
  await expect(page.locator('.ov-head h1')).toContainText('ETIASV');
  expect(log.requests.every((u) => u.startsWith('https://fedlex.data.admin.ch/'))).toBe(true);
  expect(log.errors).toEqual([]);
});

// ------------------------------------------------------------------ Arbeitsabläufe SPEC §7
test('Übersicht: Kennzahlen, Zeitstrahl aller Fassungen, ändernde Erlasse, Matrix öffnet Vergleich, hängige Vorhaben', async ({ page }) => {
  const log = await open(page, `#/uebersicht?w=${AIG}`);
  await expect(page.locator('#fig-versions .fig-v')).toHaveText(/\d+/);
  await expect(page.locator('.vt-seg.vt-xml').first()).toBeVisible();
  await expect(page.locator('.vt-seg.vt-pdf').first()).toBeVisible();
  await expect(page.locator('.vt-now')).toHaveCount(1);
  await expect(page.locator('.vt-today')).toHaveText('heute');
  await expect(page.locator('.acts-table tbody tr').first()).toBeVisible();
  await expect(page.locator('.acts-table a.ext').first()).toHaveAttribute('href', /^https:\/\/fedlex\.data\.admin\.ch\/eli\/oc\//);
  await expect(page.locator('.acts-table a.ext').first()).toHaveAttribute('rel', 'noopener noreferrer');
  const cell = page.locator('.mx-cell button').first();
  await cell.click();
  await expect(page).toHaveURL(/#\/vergleich\?/);
  await expect(page.locator('.cmp')).toBeVisible();
  await nav(page, `#/uebersicht?w=${AIG}`);
  await expect(page.locator('#pd-h')).toHaveText('Hängige Vorhaben');
  expect(log.errors).toEqual([]);
});

test('Lesen: Fassungswahl über Liste, Pfeile und Leiste, Sicht «In Kraft am», Redline, Herkunft und Fussnoten', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}&u=art_5`);
  const st = await page.evaluate(() => { const d = window.__sr.data(); return { cur: d.current.id, first: d.first.id, firstDate: d.first.date, n: d.stages.length, second: d.stages[1] && d.stages[1].id, secondDate: d.stages[1] && d.stages[1].date }; });
  await expect(page.locator('#read-stage')).toHaveValue(st.cur);
  await expect(page.locator('.sbar .sbar-item')).toHaveCount(st.n);
  await page.locator('.sbar .sbar-item').first().click();
  await expect(page).toHaveURL(new RegExp(`s=${st.first}`));
  await page.getByRole('button', { name: 'Nächste Fassung' }).click();
  await expect(page).toHaveURL(new RegExp(`s=${st.second}`));
  await page.getByRole('button', { name: 'Heute in Kraft' }).click();
  await expect(page.locator('#read-stage')).toHaveValue(st.cur);
  // In Kraft am: exakt über stageAt
  await page.getByRole('button', { name: 'In Kraft am …' }).click();
  await page.fill('#read-date', st.secondDate);
  await page.dispatchEvent('#read-date', 'change');
  await expect(page.locator('.unit-meta')).toContainText(await page.evaluate((id) => window.__sr.data().stageLabel(id), st.second));
  const before = new Date(st.firstDate); before.setDate(before.getDate() - 1);
  await page.fill('#read-date', before.toISOString().slice(0, 10));
  await page.dispatchEvent('#read-date', 'change');
  await expect(page.locator('.notice')).toContainText('Keine Fassung mit Wortlaut');
  await expect(page.locator('.events')).toBeVisible();
  // Redline, Herkunft, Fussnoten
  await nav(page, `#/lesen?w=${AIG}&u=art_5&red=1&s=${st.cur}`);
  await expect(page.locator('.mark.has-origin').first()).toBeVisible();
  await expect(page.locator('.mark-code').first()).toHaveText(/^(AS|ELI) /);
  const fn = page.locator('.fns a').first();
  await expect(fn).toHaveAttribute('href', /^https:\/\/(fedlex\.data\.admin\.ch|www\.fedlex\.admin\.ch)\//);
  await expect(fn).toHaveAttribute('target', '_blank');
  await expect(fn).toHaveAttribute('rel', 'noopener noreferrer');
  // Filter nach Erlass hebt hervor
  const act = await page.locator('#toc-act option').nth(1).getAttribute('value');
  await page.locator('#toc-act').selectOption(act);
  await expect(page).toHaveURL(new RegExp('act=' + encodeURIComponent(act).replace(/%2F/g, '(%2F|/)')));
  await expect(page.locator('.toc-mark.is-hit').first()).toBeVisible();
  expect(log.errors).toEqual([]);
});

test('Künftige Fassung: «beschlossen, noch nicht in Kraft», schraffiert und beschriftet', async ({ page }) => {
  await open(page, `#/lesen?w=${AIG}`);
  const fut = await page.evaluate(() => { const d = window.__sr.data(); const s = d.stages.find((x) => d.isFuture(x.id)); if (!s) return null; const u = d.unitOrder.find((id) => d.versions(id, 'de').some((v) => v.stage === s.id)); return { s: s.id, u }; });
  test.skip(!fut, 'keine künftige Fassung im Datensatz');
  await nav(page, `#/lesen?w=${AIG}&u=${fut.u}&s=${fut.s}`);
  await expect(page.locator('.unit-meta .stag-future')).toHaveText('beschlossen, noch nicht in Kraft');
  await expect(page.locator('.notice-future')).toBeVisible();
  const bg = await page.locator('.sbar-item.is-future').first().evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(bg).toContain('repeating-linear-gradient');
});

test('Chronologie breit und Ereignisliste vor der XML-Zeit', async ({ page }) => {
  const log = await open(page, `#/lesen?w=${AIG}`);
  const cb = await changedBlock(page);
  await nav(page, `#/chronik?w=${AIG}&u=${cb.u}&k=${cb.k}`);
  await expect(page.locator('.chron-wide .chron .step')).toHaveCount(cb.n);
  await expect(page.locator('.events-title')).toContainText('Ereignisse ohne Wortlaut');
  await expect(page.locator('.events-note')).toContainText('Fussnoten und Metadaten');
  await page.locator('#chr-key').selectOption('*');
  await expect(page.locator('.chron-wide .step-items').first()).toBeVisible();
  expect(log.errors).toEqual([]);
});

test('Sprachvergleich DE, FR, IT', async ({ page }) => {
  await open(page, `#/vergleich?w=${AIG}&u=art_5&cm=sprache`);
  await expect(page.locator('.cmp .cmp-headrow')).toContainText('Deutsch (DE)');
  await expect(page.locator('.cmp .cmp-headrow')).toContainText('Französisch (FR)');
  await page.locator('#cmp-lb').selectOption('it');
  await expect(page.locator('.cmp .cmp-headrow')).toContainText('Italienisch (IT)');
  await expect(page.locator('.cmp .cmp-c[lang="it"]').first()).toBeVisible();
});

test('Sammelkorb über Erlasse hinweg: PDF mit mehreren Karten', async ({ page }) => {
  const log = await open(page, `#/chronik?w=${AIG}&u=art_5&k=*`);
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'In Sammelkorb (A4)' }).click();
  const other = await page.evaluate(() => window.__sr.library().map((e) => e.id).find((id) => id !== 'cc-2007-758'));
  await nav(page, `#/chronik?w=${other}&k=*`);
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'In Sammelkorb (16:9)' }).click();
  await page.click('#btn-basket');
  await expect(page.locator('.bk-item')).toHaveCount(2);
  await expect(page.locator('.bk-item').first()).toContainText('AIG');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('#btn-basket-pdf')]);
  const p = join(OUT, 'export-sammelkorb.pdf');
  await pdf.saveAs(p);
  const doc = await PDFDocument.load(readFileSync(p));
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  expect(log.errors).toEqual([]);
});

test('Exportkarte: Titel mit Zitat, Quellenzeile «Quelle: Fedlex, SR …, Stand …. Massgebend ist die Amtliche Sammlung (Art. 15 Abs. 1 PublG).»', async ({ page }) => {
  await open(page, `#/chronik?w=${AIG}&u=art_5&k=*`);
  // Druckansicht rendert dieselbe Karte in das Dokument
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'Druckansicht' }).click();
  const card = page.locator('#print-root .card').first();
  await expect(card.locator('.card-title')).toHaveText('Art. 5 AIG');
  await expect(card.locator('.card-source')).toContainText(/Quelle: Fedlex, SR 142\.20, Stand \d{1,2}\. \S+ \d{4}\. Massgebend ist die Amtliche Sammlung \(Art\. 15 Abs\. 1 PublG\)\./);
  await nav(page, `#/chronik?w=${AIG}&u=art_5&k=*&ui=fr`);
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'Aperçu avant impression' }).click();
  await expect(page.locator('#print-root .card .card-title').first()).toHaveText('art. 5, LEI');
  await expect(page.locator('#print-root .card .card-source').first()).toContainText(/Source: Fedlex, RS 142\.20, état au .*\(art\. 15, al\. 1, LPubl\)\./);
  await nav(page, `#/chronik?w=${AIG}&u=art_5&k=*&ui=it`);
  await page.locator('.export-menu > button').click();
  await page.getByRole('menuitem', { name: 'Anteprima di stampa' }).click();
  await expect(page.locator('#print-root .card .card-title').first()).toHaveText('art. 5 LStrI');
  await expect(page.locator('#print-root .card .card-source').first()).toContainText(/Fonte: Fedlex, RS 142\.20, stato al .*\(art\. 15 cpv\. 1 LPubb\)\./);
});

test('Aktualisieren: auf neue Fassungen prüfen (gemockt) und Ergebnis neu, geändert, unverändert', async ({ page }) => {
  const mock = await mockFedlex(page);
  const log = await open(page, '#/aktualisieren?w=cc-2021-734');
  await page.click('#btn-check-one');
  const item = page.locator('.upd-item[data-work="cc-2021-734"]');
  await expect(item).toBeVisible({ timeout: 60000 });
  await expect(item.locator('.upd-name .tag')).toHaveText(/unverändert|neu oder geändert/);
  await expect(item.locator('.btn-load')).toBeVisible();
  expect(mock.missing).toEqual([]);
  expect(log.errors).toEqual([]);
});

test('Projektdatei sichern und in leerem Browser laden', async ({ page, browser }) => {
  await mockFedlex(page);
  await open(page, '#/bibliothek', APP_NO_EESV);
  await page.fill('#lib-q', '142.206');
  await page.click('#btn-lib-search');
  await page.locator('tr[data-work="cc-2021-734"] .btn-add').click();
  await expect(page.locator('.lib-item[data-work="cc-2021-734"]')).toBeVisible({ timeout: 120000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-project-save')]);
  const p = join(OUT, 'projekt.json');
  await dl.saveAs(p);
  const proj = JSON.parse(readFileSync(p, 'utf8'));
  expect(proj.kind).toBe('sr-navigator-project');
  expect(proj.works.map((w) => w.work.id)).toEqual(['cc-2021-734']);
  const ctx = await browser.newContext();
  await manifestRoute(ctx, currentManifest());
  const p2 = await ctx.newPage();
  await open(p2, '#/bibliothek', APP_NO_EESV);
  await expect(p2.locator('.lib-item[data-work="cc-2021-734"]')).toHaveCount(0);
  await p2.locator('input[type="file"]').setInputFiles(p);
  await expect(p2.locator('.lib-item[data-work="cc-2021-734"]')).toBeVisible();
  await ctx.close();
});

test('Deep Link mit Erlass im Hash öffnet dieselbe Stelle, auch nach dem Neuladen', async ({ page }) => {
  await open(page, `#/lesen?w=${AIG}`);
  const cb = await changedBlock(page);
  const hash = `#/lesen?w=${AIG}&u=${cb.u}&k=${cb.k}&l=fr`;
  await page.goto(APP + hash);
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await expect(page.locator('aside.panel')).toBeVisible();
  await expect(page.locator('.legal-read')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await expect(page).toHaveURL(new RegExp(`w=${AIG}.*u=${cb.u}`));
  await expect(page.locator(`.blk[data-k="${cb.k}"].is-sel`)).toBeVisible();
});

test('Tastatur: Bestimmung mit Enter öffnen, Esc schliesst, Fokus sichtbar', async ({ page }) => {
  await open(page, `#/lesen?w=${AIG}&u=art_5`);
  const blk = page.locator('.blk[role="button"]').first();
  await blk.focus();
  const outline = await blk.evaluate((e) => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth);
  expect(outline).toMatch(/solid 2px/);
  await page.keyboard.press('Enter');
  await expect(page.locator('aside.panel')).toBeVisible();
  await page.locator('aside.panel').press('Escape');
  await expect(page.locator('aside.panel')).toHaveCount(0);
});

test('Anleitung mit echten Beispielen und Info mit Verbindlichkeit, in DE, FR und IT', async ({ page }) => {
  await open(page, `#/anleitung?w=${AIG}`);
  await expect(page.locator('.g-sample[data-kind="base"] .blk')).toBeVisible();
  await expect(page.locator('.g-sample[data-kind="amended"] .mark-code')).toHaveText(/^(AS|ELI) /);
  await expect(page.locator('.g-cite td[lang="fr"]').first()).toHaveText('art. 5, al. 1, let. a, ch. 2, LEI');
  await expect(page.locator('.g-cite td[lang="it"]').first()).toHaveText('art. 5 cpv. 1 lett. a n. 2 LStrI');
  await nav(page, `#/info?w=${AIG}`);
  await expect(page.locator('#info-binding')).toContainText('Art. 15 Abs. 1 PublG, SR 170.512');
  await expect(page.locator('#info-binding')).toContainText('Art. 11 PublG');
  await expect(page.locator('#info-binding')).toContainText('Art. 14 Abs. 1 PublG');
  await expect(page.locator('#info-binding')).toContainText('kein amtliches Produkt');
  await nav(page, `#/info?w=${AIG}&ui=fr`);
  await expect(page.locator('#info-binding')).toContainText('art. 15, al. 1, LPubl');
  await nav(page, `#/info?w=${AIG}&ui=it`);
  await expect(page.locator('#info-binding')).toContainText('art. 15 cpv. 1 LPubb');
  // Hilfe-Symbol je Ansicht
  for (const v of ['bibliothek', 'uebersicht', 'lesen', 'chronik', 'vergleich', 'aktualisieren', 'info']) {
    await nav(page, `#/${v}?w=${AIG}&ui=de`);
    await expect(page.locator('.help-link').first()).toBeVisible();
  }
});

test('«Geändert» nur bei geändertem Wortlaut: AIG, Stand 20250101, IT gleich viele geänderte Einheiten wie DE; keine Scheinschritte', async ({ page }) => {
  await open(page, `#/uebersicht?w=${AIG}`);
  const r = await page.evaluate(() => {
    const d = window.__sr.data();
    const sid = d.stage('20250101') ? '20250101' : d.stages[Math.min(5, d.stages.length - 1)].id;
    const n = (l) => d.changedUnits(sid, l).size;
    const versionsAt = (l) => d.unitOrder.filter((u) => d.versions(u, l).some((v) => v.stage === sid)).length;
    // Chronologie: kein Schritt ohne Änderung des Wortlauts
    const bad = [];
    for (const l of ['de', 'it']) for (const u of d.unitOrder) {
      for (const v of d.versions(u, l)) for (const b of v.blocks || []) {
        const h = d.history(u, l, b.k);
        for (let i = 1; i < h.length; i++) if (h[i].block && h[i - 1].block && h[i].block.t === h[i - 1].block.t && (h[i].block.l || '') === (h[i - 1].block.l || '') && (h[i].block.html || '') === (h[i - 1].block.html || '')) bad.push(`${l} ${u} ${b.k} ${h[i].stage}`);
        break;
      }
    }
    return { sid, de: n('de'), it: n('it'), fr: n('fr'), vDe: versionsAt('de'), vIt: versionsAt('it'), bad: [...new Set(bad)].slice(0, 5) };
  });
  console.log('Stand', r.sid, 'geändert DE/FR/IT', r.de, r.fr, r.it, '| Versionen DE/IT', r.vDe, r.vIt);
  expect(r.it).toBe(r.de);
  expect(r.bad).toEqual([]);
  // Matrix: gleiche Zahl markierter Zellen in der Spalte des Stands, DE und IT
  const col = async (l) => { await nav(page, `#/uebersicht?w=${AIG}&l=${l}`); return page.evaluate((sid) => { const ths = [...document.querySelectorAll('.mx thead th')]; const i = ths.findIndex((th) => th.title && th.title.includes(window.__sr.data().stageLabel(sid))); return [...document.querySelectorAll('.mx tbody tr')].filter((tr) => tr.children[i] && tr.children[i].classList.contains('mx-cell')).length; }, r.sid); };
  expect(await col('it')).toBe(await col('de'));
});

// ------------------------------------------------------------------ Qualität
test('Kein rohes Markup in der Oberfläche: alle Einheiten aller eingebetteten Erlasse', async ({ page }) => {
  test.setTimeout(600000);
  await open(page, '#/bibliothek');
  const ids = await page.evaluate(() => window.__sr.library().map((e) => e.id));
  const bad = [];
  let n = 0;
  for (const id of ids) {
    await nav(page, `#/lesen?w=${id}`);
    await page.waitForSelector('.unit-head');
    const units = await page.evaluate(() => window.__sr.data().unitOrder);
    for (const u of units) {
      await page.evaluate((h) => { location.hash = h; }, `#/lesen?w=${id}&u=${u}`);
      const txt = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r((document.querySelector('.reader') || document.body).innerText + '\n' + (document.querySelector('.toc') || document.body).innerText))));
      n++;
      const m = /<\/?(?:i|b|sup|sub|br|a|span|p|em|strong|ref|num|authorialNote)\b[^>]*>|&lt;|&gt;|&amp;[a-z]+;/i.exec(txt);
      if (m) bad.push(`${id} ${u}: ${m[0]}`);
    }
  }
  expect(bad).toEqual([]);
  expect(n).toBeGreaterThan(20);
});

test('Wörterbücher im Browser: keine fehlenden Schlüssel in allen Ansichten und Sprachen', async ({ page }) => {
  await open(page, `#/bibliothek`);
  const views = ['bibliothek', 'uebersicht', 'lesen', 'chronik', 'vergleich', 'aktualisieren', 'anleitung', 'info'];
  for (const ui of ['de', 'fr', 'it']) for (const v of views) {
    await nav(page, `#/${v}?w=${AIG}&ui=${ui}&u=art_5&k=*`);
    const txt = await page.evaluate(() => document.body.innerText + [...document.querySelectorAll('[title],[aria-label],[placeholder]')].map((e) => (e.getAttribute('title') || '') + (e.getAttribute('aria-label') || '') + (e.getAttribute('placeholder') || '')).join(' '));
    expect(txt, `${ui} ${v}`).not.toMatch(/⟦/);
    if (ui === 'de') expect(txt, `${v}: ß in der Oberfläche`).not.toMatch(/ß/);
  }
});
