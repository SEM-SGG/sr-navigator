// Gemeinsame Grundlage der Browsertests: ersetzt die Versionsangabe der Projektseite durch eine Attrappe.
// Ohne sie fragte jeder Test beim Start die echte Projektseite ab. Die Attrappe meldet die Version dieser Datei,
// also «aktuell». Tests, die etwas anderes brauchen, setzen mit manifestRoute() eine eigene Antwort.
import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
export const CFG = JSON.parse(readFileSync(join(ROOT, 'release.config.json'), 'utf8'));
export const MANIFEST_URL = CFG.siteUrl + CFG.manifest;
export const LIST_URL = `${CFG.repoUrl}/releases`;
export const DOWNLOAD_URL = `${LIST_URL}/latest/download/${CFG.asset}`;

const HEAD = { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' };

/** Antwort auf die Versionsangabe festlegen: ein Objekt (JSON), eine Zahl (HTTP-Status) oder 'offline'. Gilt für Seite oder Kontext. */
export async function manifestRoute(target, answer) {
  const log = { count: 0 };
  await target.route(MANIFEST_URL, (route) => {
    log.count++;
    if (answer === 'offline') return route.abort('internetdisconnected');
    if (typeof answer === 'number') return route.fulfill({ status: answer, headers: HEAD, body: '{}' });
    return route.fulfill({ status: 200, headers: HEAD, body: JSON.stringify(answer) });
  });
  return log;
}

export const currentManifest = () => ({ version: VERSION, date: '2026-01-01', url: `${LIST_URL}/download/v${VERSION}/${CFG.asset}`, notes: { de: '' } });

export const test = base.extend({
  context: async ({ context }, use) => {
    await manifestRoute(context, currentManifest());
    await use(context);
  },
});
export { expect };

/** Wartet, bis die Versionsprüfung beim Start abgeschlossen oder ausgelassen ist. */
export const updateSettled = (page) => page.waitForFunction(() => window.__srUpdateSettled === true, null, { timeout: 15000 });
