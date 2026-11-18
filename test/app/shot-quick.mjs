// Schnelle Sichtprüfung: node test/app/shot-quick.mjs <hash> [breite] [datei]
import { chromium } from '@playwright/test';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [hash = '#/bibliothek', w = '1440', file = 'quick.png', fullArg] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const page = await b.newPage({ viewport: { width: Number(w), height: 900 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) errs.push('REQUEST ' + r.url()); });
await page.goto('file://' + join(ROOT, 'dist/sr-navigator.html') + hash);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(ROOT, 'test/app/out', file), fullPage: fullArg === 'full' });
console.log(errs.join('\n') || 'keine Fehler');
await b.close();
