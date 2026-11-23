// Prüft, ob die Produktdokumentation (docs/sr-navigator-dokumentation.html) die Version aus package.json nennt.
// Aufruf im Wurzelverzeichnis:
//   node scripts/check-dokumentation.mjs         prüft; endet mit Fehler und nennt jede abweichende Stelle
//   node scripts/check-dokumentation.mjs --fix   setzt die Version aus package.json an allen Stellen
// Läuft in «CI», im Workflow «Release» vor der Veröffentlichung und beim automatischen Einbau neuer Fassungen.
import { readFileSync, writeFileSync } from 'node:fs';
import { DOC_FILE, checkDocVersion, setDocVersion, docVersionMessage } from './lib/dokumentation.mjs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

try {
  const { version } = JSON.parse(read('package.json'));
  const html = read(DOC_FILE);
  const arg = process.argv[2];
  if (arg === '--fix') {
    const out = setDocVersion(html, version);
    if (out !== html) writeFileSync(new URL(DOC_FILE, root), out);
    console.log(`${DOC_FILE}: Version ${version} an ${checkDocVersion(out, version).found} Stellen gesetzt.`);
  } else if (arg) {
    throw new Error(`Unbekannte Option ${arg}. Aufruf: node scripts/check-dokumentation.mjs [--fix]`);
  } else {
    const r = checkDocVersion(html, version);
    if (!r.ok) { console.error(docVersionMessage(r, version)); process.exit(1); }
    console.log(`${DOC_FILE}: Version ${version} an allen ${r.found} Stellen.`);
  }
} catch (e) { console.error(e.message); process.exit(1); }
