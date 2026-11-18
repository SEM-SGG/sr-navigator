// Playwright-Konfiguration für die UI-Tests (file://). Chrome: alle Tests. Firefox und Edge: Start, Abnahme (inkl. Hinzufügen gemockt), Sprachvergleich, Tastatur.
import { defineConfig } from '@playwright/test';
const common = { acceptDownloads: true, locale: 'de-CH', timezoneId: 'Europe/Zurich', viewport: { width: 1440, height: 900 } };
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs/,
  timeout: 180000,
  expect: { timeout: 20000 },
  workers: 3,
  reporter: [['list']],
  globalSetup: './global-setup.mjs',
  projects: [
    { name: 'chrome', use: { ...common, browserName: 'chromium', launchOptions: { executablePath: '/usr/bin/google-chrome' } } },
    { name: 'firefox', testMatch: /sr\.spec\.mjs/, grep: /Start:|Abnahme|Sprachvergleich|Tastatur/, use: { ...common, browserName: 'firefox' } },
    { name: 'edge', testMatch: /sr\.spec\.mjs/, grep: /Start:|Abnahme|Sprachvergleich|Tastatur/, use: { ...common, browserName: 'chromium', channel: 'msedge' } },
  ],
});
