// Prüft für alle eingebetteten Erlasse, ob Fedlex neue Fassungen oder ersetzte Dateien führt, die in data/library.json fehlen.
// Nutzt dieselbe Abfrage wie die Ansicht «Aktualisieren» des Navigators (src/core/fedlex.js, checkUpdates).
// Aufruf im Wurzelverzeichnis:
//   node scripts/check-fassungen.mjs            gibt den Befund als Markdown aus (Trockenlauf)
//   node scripts/check-fassungen.mjs --issue    eröffnet oder aktualisiert zusätzlich ein Issue im Repository (gh, GH_TOKEN, GH_REPO)
//   node scripts/check-fassungen.mjs --out befund.json   schreibt zusätzlich den Befund als JSON (für scripts/apply-fassungen.mjs)
// Ohne Befund entsteht kein Issue. Ein offenes Issue mit demselben Titel wird aktualisiert statt verdoppelt.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkUpdates } from '../src/core/fedlex.js';
import { befundTable, fingerprint } from './lib/fassungen.mjs';

export const ISSUE_TITLE = 'Neue Fassungen auf Fedlex';

const fmt = (iso) => new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const page = (work) => String(work.eli || '').replace('https://fedlex.data.admin.ch/', 'https://www.fedlex.admin.ch/') + '/de';

/**
 * Befund je Erlass: { id, abbr, sr, url, newVersions: [Datum], newFiles: [{ date, lang, url }],
 * changedFiles: [{ stage, lang, url }], error }. url: neue Datei-Adresse (XML) bei Fedlex.
 */
export async function checkLibrary(library, { fetch } = {}) {
  const out = [];
  for (const id of library.order || Object.keys(library.works)) {
    const bundle = library.works[id];
    const w = bundle.work;
    const row = { id, abbr: (w.abbr && w.abbr.de) || id, sr: w.sr || '', url: page(w), newVersions: [], newFiles: [], changedFiles: [], error: null };
    try {
      const r = await checkUpdates(bundle, { fetch });
      row.newVersions = r.newVersions.map((v) => v.date).sort();
      row.newFiles = r.newVersions.flatMap((v) => bundle.langs.map((l) => ({ date: v.date, lang: l, url: (v.files && v.files[l] && v.files[l].xml) || null }))).filter((f) => f.url);
      row.changedFiles = r.changedFiles.map((c) => ({ stage: c.stage, lang: c.lang, url: c.url }));
    } catch (e) {
      row.error = e.message || String(e);
    }
    out.push(row);
  }
  return out;
}

export const hasFindings = (rows) => rows.some((r) => r.newVersions.length || r.changedFiles.length);

/** Text des Issues. generated: Stand der Bibliothek (JJJJ-MM-TT), today: Datum der Prüfung. */
export function report(rows, { generated, today }) {
  const lines = [`Prüfung vom ${fmt(today)}. Die eingebetteten Erlasse haben den Stand vom ${generated ? fmt(generated) : 'unbekannten Datum'}.`, ''];
  lines.push(befundTable(rows));
  lines.push('', 'Der Workflow «Fassungen» baut die Fassungen ein und eröffnet dazu einen Pull Request. Er schliesst dieses Issue beim Zusammenführen. Fehlt der Pull Request, stehen die Schritte von Hand in `MAINTAINING.md`, Abschnitt «Neue Fassung einbauen».');
  return lines.join('\n');
}

function gh(args, input) {
  const r = spawnSync('gh', args, { encoding: 'utf8', input });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
}

async function main() {
  const root = new URL('../', import.meta.url);
  const library = JSON.parse(readFileSync(new URL('data/library.json', root), 'utf8'));
  const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  const outAt = process.argv.indexOf('--out');
  const outFile = outAt > 0 ? process.argv[outAt + 1] : null;
  const rows = await checkLibrary(library);
  const today = new Date().toISOString().slice(0, 10);
  const body = report(rows, { generated: library.generated, today });
  console.log(body);
  const befund = { today, generated: library.generated, version, rows, hasFindings: hasFindings(rows), fingerprint: fingerprint(rows, { version }), issue: null };
  const save = () => { if (outFile) writeFileSync(outFile, JSON.stringify(befund, null, 1)); };
  const failed = rows.filter((r) => r.error);
  if (failed.length === rows.length) { console.error('\nKein Erlass liess sich prüfen.'); process.exit(1); }
  if (!befund.hasFindings) { save(); console.log('\nKeine neuen Fassungen. Kein Issue.'); return; }
  if (!process.argv.includes('--issue')) { save(); console.log('\nTrockenlauf: kein Issue. Mit --issue eröffnet das Skript eines.'); return; }
  const file = join(mkdtempSync(join(tmpdir(), 'sr-fassungen-')), 'body.md');
  writeFileSync(file, body);
  const open = JSON.parse(gh(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title']));
  const hit = open.find((i) => i.title === ISSUE_TITLE);
  if (hit) { gh(['issue', 'edit', String(hit.number), '--body-file', file]); befund.issue = hit.number; console.log(`\nIssue #${hit.number} aktualisiert.`); }
  else {
    const url = gh(['issue', 'create', '--title', ISSUE_TITLE, '--body-file', file]).trim();
    const n = /\/issues\/(\d+)/.exec(url);
    befund.issue = n ? Number(n[1]) : null;
    console.log(`\nIssue eröffnet: ${url}`);
  }
  save();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
