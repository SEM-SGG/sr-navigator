// Prüft, ob die Produktdokumentation (docs/sr-navigator-dokumentation.html) und package-lock.json die Version aus
// package.json nennen.
// Aufruf im Wurzelverzeichnis:
//   node scripts/check-dokumentation.mjs         prüft; endet mit Fehler und nennt jede abweichende Stelle
//   node scripts/check-dokumentation.mjs --fix   setzt die Version aus package.json an allen Stellen beider Dateien
// Läuft in «CI», im Workflow «Release» vor der Veröffentlichung und beim automatischen Einbau neuer Fassungen.
// In package-lock.json setzt --fix nur die beiden Felder «version»; der übrige Inhalt bleibt unverändert.
import { readFileSync, writeFileSync } from 'node:fs';
import { DOC_FILE, checkDocVersion, setDocVersion, docVersionMessage } from './lib/dokumentation.mjs';
import { LOCK_FILE, checkLockVersion, setLockVersion, lockVersionMessage } from './lib/lockfile.mjs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

try {
  const { version } = JSON.parse(read('package.json'));
  const html = read(DOC_FILE);
  const lock = read(LOCK_FILE);
  const arg = process.argv[2];
  if (arg === '--fix') {
    const out = setDocVersion(html, version);
    const lockOut = setLockVersion(lock, version);
    if (out !== html) writeFileSync(new URL(DOC_FILE, root), out);
    if (lockOut !== lock) writeFileSync(new URL(LOCK_FILE, root), lockOut);
    console.log(`${DOC_FILE}: Version ${version} an ${checkDocVersion(out, version).found} Stellen gesetzt.`);
    console.log(`${LOCK_FILE}: Version ${version} in beiden Feldern gesetzt.`);
  } else if (arg) {
    throw new Error(`Unbekannte Option ${arg}. Aufruf: node scripts/check-dokumentation.mjs [--fix]`);
  } else {
    const r = checkDocVersion(html, version);
    const l = checkLockVersion(lock, version);
    const errors = [docVersionMessage(r, version), lockVersionMessage(l, version)].filter(Boolean);
    if (errors.length) { console.error(errors.join('\n\n')); process.exit(1); }
    console.log(`${DOC_FILE}: Version ${version} an allen ${r.found} Stellen.`);
    console.log(`${LOCK_FILE}: Version ${version} in beiden Feldern.`);
  }
} catch (e) { console.error(e.message); process.exit(1); }
