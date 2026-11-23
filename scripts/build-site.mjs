// Baut die Projektseite (GitHub Pages) nach dist/site/: index.html (Download-Seite in DE, FR, IT), version.json und
// app/index.html (der Navigator selbst, unverändert kopiert aus dist/<asset>, zum Öffnen über einen Link).
// Der Navigator ruft version.json ab, um auf eine neuere Version hinzuweisen (src/app/update.js).
// Aufruf im Wurzelverzeichnis:
//   node scripts/build-site.mjs [--date JJJJ-MM-TT] [--out dist/site] [--require-app]
// --date ist das Datum der Release (Vorgabe: heute). Die Grösse der Datei liest das Skript aus dist/<asset>.
// Fehlt dist/<asset>, entsteht die Seite ohne app/; mit --require-app bricht das Skript dann ab (Workflow «Release»).
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { changelogSection } from './lib/changelog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Versionsangabe für den Navigator: { version, date, url, notes: { de } }. url zeigt auf die Datei genau dieser Release. */
export function buildManifest({ version, date, config, notes }) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error(`Version «${version}» hat nicht die Form 1.2.3.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date))) throw new Error(`Datum «${date}» hat nicht die Form JJJJ-MM-TT.`);
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(config.repoUrl || '')) throw new Error('release.config.json: repoUrl fehlt oder ist ungültig.');
  return { version, date, url: `${config.repoUrl}/releases/download/v${version}/${config.asset}`, notes: { de: notes || '' } };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const longDate = (iso, locale) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));

/** Füllt die Vorlage. Unbekannte Platzhalter führen zu einem Fehler, damit keine «{{…}}» auf der Seite stehen. */
export function renderPage(template, { version, date, config, sizeBytes }) {
  const mb = sizeBytes ? (sizeBytes / 1048576).toFixed(1) : null;
  const values = {
    VERSION: version,
    DATE_DE: longDate(date, 'de-CH'), DATE_FR: longDate(date, 'fr-CH'), DATE_IT: longDate(date, 'it-CH'),
    SIZE_DE: mb ? `, rund ${mb.replace('.', ',')} MB` : '', SIZE_FR: mb ? `, environ ${mb.replace('.', ',')} Mo` : '', SIZE_IT: mb ? `, circa ${mb.replace('.', ',')} MB` : '',
    DOWNLOAD_URL: `${config.repoUrl}/releases/latest/download/${config.asset}`,
    LIST_URL: `${config.repoUrl}/releases`, REPO_URL: config.repoUrl, ISSUES_URL: `${config.repoUrl}/issues/new/choose`,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`Vorlage: unbekannter Platzhalter {{${k}}}`);
    return esc(values[k]);
  });
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');
  const { version } = JSON.parse(read('package.json'));
  const config = JSON.parse(read('release.config.json'));
  const date = opt('--date', new Date().toISOString().slice(0, 10));
  const out = resolve(ROOT, opt('--out', 'dist/site'));
  const notes = changelogSection(read('CHANGELOG.md'), version);
  if (!notes) throw new Error(`CHANGELOG.md: Abschnitt «## ${version} (Datum)» fehlt oder ist leer.`);
  const asset = join(ROOT, 'dist', config.asset);
  const hasApp = existsSync(asset);
  if (!hasApp && args.includes('--require-app')) {
    throw new Error(`dist/${config.asset} fehlt. Ohne diese Datei entsteht keine Seite unter app/. Zuerst «npm run build» ausführen oder die Datei der Release nach dist/ laden.`);
  }
  const sizeBytes = hasApp ? statSync(asset).size : null;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), renderPage(read('site/index.template.html'), { version, date, config, sizeBytes }));
  writeFileSync(join(out, config.manifest || 'version.json'), JSON.stringify(buildManifest({ version, date, config, notes }), null, 2) + '\n');
  writeFileSync(join(out, '.nojekyll'), '');
  // Navigator unter app/: dieselbe Datei wie in der Release, Byte für Byte. Ohne Build entfällt app/index.html (eine alte Kopie wird entfernt).
  if (hasApp) { mkdirSync(join(out, 'app'), { recursive: true }); copyFileSync(asset, join(out, 'app', 'index.html')); }
  else rmSync(join(out, 'app', 'index.html'), { force: true });
  const files = ['index.html', config.manifest || 'version.json', ...(hasApp ? [`app/index.html (Kopie von dist/${config.asset})`] : [])];
  console.log(`${out.replace(ROOT + '/', '')}: ${files.join(', ')} (Version ${version} vom ${date})`);
  if (!hasApp) console.log(`dist/${config.asset} fehlt: Seite ohne app/ gebaut.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
