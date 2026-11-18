// Zeichnet die SPARQL-Antworten von Fedlex für die gemockten Tests auf (test/app/fixtures/fedlex-recorded.json).
// Einmal mit Netz ausführen, wenn sich die Abfragen der Kernbibliothek ändern:
//   node build.mjs && node build.mjs --exclude cc-2021-734 --out test/app/out/sr-navigator-ohne-eesv.html && node test/app/record-fedlex.mjs
// Abläufe: Suche «142.206» und Hinzufügen der EESV (Variante ohne EESV), Prüfung auf neue Fassungen für die EESV.
import { chromium } from '@playwright/test';
import { queryOf } from './helpers.mjs';
import { writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'test/app/fixtures/fedlex-recorded.json');
const rec = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sparql: {} };
delete rec.sparql[''];
rec.recorded = new Date().toISOString().slice(0, 10);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
async function session(file, fn) {
  const ctx = await b.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.route('https://fedlex.data.admin.ch/sparqlendpoint**', async (route) => {
    const q = queryOf(route.request());
    const res = await route.fetch();
    const body = await res.text();
    if (res.ok() && q) rec.sparql[q] = body;
    await route.fulfill({ response: res, body });
  });
  await page.goto('file://' + join(ROOT, file) + '#/bibliothek');
  await page.waitForFunction(() => window.__sr && window.__sr.ready);
  await fn(page);
  await ctx.close();
}
await session('test/app/out/sr-navigator-ohne-eesv.html', async (page) => {
  await page.fill('#lib-q', '142.206');
  await page.click('#btn-lib-search');
  await page.waitForSelector('tr[data-work="cc-2021-734"] .btn-add', { timeout: 120000 });
  await page.click('tr[data-work="cc-2021-734"] .btn-add');
  await page.waitForSelector('.lib-item[data-work="cc-2021-734"]', { timeout: 300000 });
});
await session('dist/sr-navigator.html', async (page) => {
  await page.evaluate(() => { location.hash = '#/aktualisieren?w=cc-2021-734'; });
  await page.click('#btn-check-one');
  await page.waitForSelector('.upd-item[data-work="cc-2021-734"]', { timeout: 120000 });
});
await b.close();
writeFileSync(OUT + '.tmp', JSON.stringify(rec));
renameSync(OUT + '.tmp', OUT);
console.log('aufgezeichnet:', Object.keys(rec.sparql).length, 'SPARQL-Antworten →', OUT);
