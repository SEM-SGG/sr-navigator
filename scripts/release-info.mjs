// Angaben für eine Release, gelesen aus package.json, CHANGELOG.md und release.config.json.
// Aufruf im Wurzelverzeichnis:
//   node scripts/release-info.mjs            prüft die Angaben und nennt die Version
//   node scripts/release-info.mjs --version  Version, zum Beispiel 1.3.0
//   node scripts/release-info.mjs --notes    Abschnitt der Version aus CHANGELOG.md (Text der Release)
//   node scripts/release-info.mjs --asset    Dateiname in der Release
// Endet mit Fehler, wenn die Version nicht die Form 1.2.3 hat oder der Abschnitt in CHANGELOG.md fehlt.
// So entsteht keine Release ohne Beschrieb der Änderungen.
import { readFileSync } from 'node:fs';
import { changelogSection } from './lib/changelog.mjs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const fail = (msg) => { console.error(msg); process.exit(1); };

const { version } = JSON.parse(read('package.json'));
if (!/^\d+\.\d+\.\d+$/.test(version || '')) fail(`package.json: Version «${version}» hat nicht die Form 1.2.3.`);
const notes = changelogSection(read('CHANGELOG.md'), version);
if (!notes) fail(`CHANGELOG.md: Abschnitt «## ${version} (Datum)» fehlt oder ist leer.`);
const cfg = JSON.parse(read('release.config.json'));
if (!/^[\w][\w.-]*$/.test(cfg.asset || '')) fail('release.config.json: Feld «asset» fehlt oder enthält unzulässige Zeichen.');

const arg = process.argv[2];
if (arg === '--version') console.log(version);
else if (arg === '--notes') console.log(notes);
else if (arg === '--asset') console.log(cfg.asset);
else if (arg) fail(`Unbekannte Option ${arg}.`);
else console.log(`Version ${version}: Abschnitt in CHANGELOG.md vorhanden, Datei ${cfg.asset}.`);
