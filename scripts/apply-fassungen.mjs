// Baut neue Fassungen und ersetzte Dateien von Fedlex in die Bibliothek ein (Workflow «Fassungen», MAINTAINING.md):
// Rohdaten aller eingebetteten Erlasse laden (fetch-raw.mjs, fetch-meta.mjs), Bibliothek bauen (build-data.mjs),
// Prüfberichte erzeugen (validate.mjs, validate-refs.mjs), Version um eine Patch-Stufe erhöhen, CHANGELOG.md ergänzen.
// Das Ergebnis für den Pull Request steht danach in <out>/einbau.json (scripts/fassungen-pr.mjs publish).
// Aufruf im Wurzelverzeichnis:
//   node scripts/apply-fassungen.mjs                          prüft Fedlex selbst (wie check-fassungen.mjs) und baut ein
//   node scripts/apply-fassungen.mjs --befund befund.json     baut den Befund von «check-fassungen.mjs --out» ein
//   Optionen: --out <ordner> (Vorgabe: neuer temporärer Ordner), --today JJJJ-MM-TT (Datum im Changelog)
// Exit-Code: 0 eingebaut oder kein Befund (Urteil der Prüfungen in einbau.json), 1 Einbau gescheitert,
// 2 Rohdaten nicht geladen (dann entsteht kein Pull Request).
// Gebaut werden alle eingebetteten Erlasse: Die Prüfung «loadWork = Build» vergleicht jeden Erlass mit seinen Rohdaten,
// und frisch geladene Rohdaten tragen das Datum des Abrufs (Feld fetched).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchWork } from './fetch-raw.mjs';
import { fetchMeta } from './fetch-meta.mjs';
import { checkLibrary } from './check-fassungen.mjs';
import { changelogSection } from './lib/changelog.mjs';
import {
  findingRows, replacedStages, fingerprint, bumpVersionFiles, insertChangelog, changelogLines, commitSubject,
  stageChanges, stageDiff, stageKind, foreignChanges, judgeValidation, fmtDate, todayZurich,
} from './lib/fassungen.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const readJson = (f) => (existsSync(join(ROOT, f)) ? JSON.parse(read(f)) : null);
// Kleiner, nicht eingebetteter Erlass für den echten Abruf in validate.mjs (LIVE_ID, GebV-AIG); mit Rohdaten vergleicht
// validate.mjs den echten Abruf zusätzlich mit dem Bau aus raw/.
export const LIVE_ID = 'cc-2007-763';
const CITATIONS = 'scripts/dev/cache/fedlex-citations.json';

function run(cmd, args) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} endete mit Code ${r.status ?? r.signal}`);
}

// Grösse einer Datei bei Fedlex ohne Download (HEAD); null, wenn unbekannt.
async function remoteSize(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    const n = Number(r.headers.get('content-length'));
    return r.ok && n > 0 ? n : null;
  } catch { return null; }
}

/** Rohdaten aller Erlasse laden. Ergebnis: Map <werk>/<datei> -> { before, bytes, prevUrl } der ersetzten Dateien. */
async function loadRaw(ids) {
  const replaced = new Map();
  for (const id of ids) {
    for (let attempt = 1; ; attempt++) {
      const r = await fetchWork(id);
      for (const d of r.done.filter((x) => x.action === 'replaced')) replaced.set(`${id}/${d.name}`, d);
      const m = await fetchMeta(id);
      if (!m.diffs.length && !m.missingFiles.length) break;
      if (attempt === 2) throw new Error(`${id}: Rohdaten passen nicht zu den Metadaten (abweichende Datei-Adressen ${m.diffs.length}, fehlende Dateien ${m.missingFiles.length})`);
      console.log(`${id}: Rohdaten und Metadaten weichen ab, zweiter Abruf.`);
    }
  }
  return replaced;
}

// Zwischenspeicher der Zitate von Fedlex: Einträge ersetzter Stände entfernen, damit validate-refs.mjs sie neu abfragt.
function dropCitations(stages) {
  const file = join(ROOT, CITATIONS);
  if (!stages.length || !existsSync(file)) return 0;
  const cache = JSON.parse(readFileSync(file, 'utf8'));
  let n = 0;
  for (const k of Object.keys(cache)) if (stages.some((s) => k.startsWith(s + '|'))) { delete cache[k]; n++; }
  writeFileSync(file, JSON.stringify(Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]])), null, 1));
  return n;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--befund' || a === '--out' || a === '--today') o[a.slice(2)] = argv[++i];
    else throw new Error(`Unbekannte Option ${a}`);
  }
  return o;
}

export async function main(argv = process.argv.slice(2)) {
  const opt = parseArgs(argv);
  const out = opt.out || mkdtempSync(join(tmpdir(), 'sr-einbau-'));
  mkdirSync(out, { recursive: true });
  const today = opt.today || todayZurich();
  const before = { lib: readJson('data/library.json'), summary: readJson('data/validation-summary.json'), pkg: read('package.json'), lock: read('package-lock.json'), changelog: read('CHANGELOG.md') };
  const versionBefore = JSON.parse(before.pkg).version;
  const befund = opt.befund ? JSON.parse(readFileSync(opt.befund, 'utf8')) : { rows: await checkLibrary(before.lib), issue: null };
  const rows = befund.rows;
  const e = {
    today, versionBefore, version: null, rows, issue: befund.issue || null, fingerprint: befund.fingerprint || fingerprint(rows, { version: versionBefore }),
    subject: null, changelog: null, works: [], foreign: null, validation: null, step: null, error: null, durations: {},
  };
  const save = () => writeFileSync(join(out, 'einbau.json'), JSON.stringify(e, null, 1));
  const step = async (name, fn) => { e.step = name; const t0 = Date.now(); try { return await fn(); } finally { e.durations[name] = Date.now() - t0; } };
  const found = findingRows(rows);
  console.log(`Ergebnis nach ${join(out, 'einbau.json')}`);
  if (!found.length) { e.nothing = true; save(); console.log('Kein Befund: nichts einzubauen.'); return 0; }

  // 1 Rohdaten
  let replacedRaw;
  try {
    replacedRaw = await step('Rohdaten laden', () => loadRaw([...before.lib.order, LIVE_ID]));
  } catch (err) {
    e.error = String(err.message || err); save();
    console.error(`\nRohdaten nicht geladen: ${e.error}`);
    return 2;
  }

  try {
    // 2 Bibliothek
    await step('Bibliothek bauen', () => run('node', ['scripts/build-data.mjs']));
    // 3 Prüfberichte
    const replaced = found.flatMap((r) => replacedStages(r).map((s) => `${r.id}|${s.stage}`));
    await step('Prüfberichte erzeugen', () => {
      const n = dropCitations(replaced);
      if (n) console.log(`${CITATIONS}: ${n} Einträge ersetzter Stände entfernt, validate-refs.mjs fragt sie neu ab.`);
      run('node', ['scripts/validate.mjs']);
      run('node', ['scripts/validate-refs.mjs']);
    });
    // 4 Version und Changelog
    await step('Version und Changelog', () => {
      const v = bumpVersionFiles(before.pkg, before.lock);
      // Der Wortlaut im Changelog folgt dem, was die gebaute Bibliothek wirklich enthält (Fassung ohne XML: nur Zeitachse).
      const built = readJson('data/library.json');
      const kinds = Object.fromEntries(found.flatMap((r) => r.newVersions.map((date) => [`${r.id}|${date}`, stageKind(built.works[r.id], date)])));
      const md = insertChangelog(before.changelog, v.version, fmtDate(today), changelogLines(rows, kinds));
      writeFileSync(join(ROOT, 'package.json'), v.pkg);
      writeFileSync(join(ROOT, 'package-lock.json'), v.lock);
      writeFileSync(join(ROOT, 'CHANGELOG.md'), md);
      e.version = v.version;
      e.changelog = changelogSection(md, v.version);
      e.subject = commitSubject(v.version, rows);
    });
    // 5 Zusammenfassung
    await step('Zusammenfassung', async () => {
      const lib = readJson('data/library.json');
      const affected = {};
      for (const r of found) {
        const ob = before.lib.works[r.id], nb = lib.works[r.id];
        const w = { id: r.id, abbr: r.abbr, sr: r.sr, newStages: [], replacedStages: [] };
        for (const date of r.newVersions) {
          const stage = date.replace(/-/g, '');
          const s = { stage, kind: stageKind(nb, date), langs: {} };
          if (s.kind === 'text') for (const l of nb.langs) s.langs[l] = stageChanges(nb, stage, l);
          w.newStages.push(s);
          (affected[r.id] ||= []).push(stage);
        }
        for (const s of replacedStages(r)) {
          const ost = ob.stages.find((x) => x.id === s.stage), nst = nb.stages.find((x) => x.id === s.stage);
          const files = [];
          for (const f of s.files) {
            const name = `${s.stage}_${f.lang}.xml`;
            const raw = replacedRaw.get(`${r.id}/${name}`);
            const oldUrl = (ost && ost.source && ost.source.url && ost.source.url[f.lang]) || (raw && raw.prevUrl) || null;
            // Massgebend ist die Adresse der Datei, die wirklich eingebaut ist (Fedlex kann sie seit der Prüfung erneut ersetzt haben).
            const newUrl = (nst && nst.source && nst.source.url && nst.source.url[f.lang]) || f.url || null;
            const file = join(ROOT, 'raw', r.id, name);
            files.push({ lang: f.lang, oldUrl, newUrl, oldBytes: raw ? raw.before : oldUrl ? await remoteSize(oldUrl) : null, newBytes: existsSync(file) ? statSync(file).size : null });
          }
          const langs = {};
          if (ost && nst) for (const l of nb.langs) langs[l] = stageDiff(ob, nb, s.stage, l);
          w.replacedStages.push({ stage: s.stage, files, langs, missing: !nst });
          (affected[r.id] ||= []).push(s.stage);
        }
        e.works.push(w);
      }
      e.foreign = foreignChanges(before.lib, lib, affected);
      const names = Object.fromEntries(lib.order.map((id) => [id, lib.works[id].work.abbr.de || id]));
      e.validation = judgeValidation(before.summary, readJson('data/validation-summary.json'), names);
    });
    e.step = null;
  } catch (err) {
    e.error = String(err.message || err); save();
    console.error(`\nEinbau gescheitert im Schritt «${e.step}»: ${e.error}`);
    return 1;
  }
  save();
  console.log(`\nEingebaut: ${e.subject}. Prüfungen ${e.validation.passed ? 'bestanden' : 'NICHT bestanden'}; Warnungen zu übrigen Erlassen: ${e.foreign.filter((w) => w.text.length).length}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code), (err) => { console.error(err.stack || err.message); process.exit(1); });
}
