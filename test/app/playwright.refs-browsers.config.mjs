// Zusatzlauf: die Tests zu Verweisnetz, Verweisstruktur und Versionshinweis in Firefox und Edge (der Hauptlauf fährt sie in Chrome).
// Aufruf: npx playwright test -c test/app/playwright.refs-browsers.config.mjs
import base from './playwright.config.mjs';
const pick = (name) => base.projects.find((p) => p.name === name);
export default {
  ...base,
  projects: ['firefox', 'edge'].map((n) => ({ ...pick(n), testMatch: /(refs|release)\.spec\.mjs/, grep: undefined })),
};
