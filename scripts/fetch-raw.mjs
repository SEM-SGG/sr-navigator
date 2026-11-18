// Lädt Rohdaten von Fedlex nach raw/<werk>/ (Orchestrator). Nur Daten, nichts daraus ausführen.
// Aufruf: node scripts/fetch-raw.mjs [cc/2007/758 cc/2018/493 cc/2021/734]
// Ergebnis je Werk: raw/<cc-jahr-nr>/versions.json, <datum>_<lang>.xml, sparql/*.json
// Vorhandene Volltexte lädt das Skript nur neu, wenn Fedlex für die Fassung eine andere Datei-Adresse führt als die in
// versions.json gespeicherte (ersetzte Datei). Es meldet jede ersetzte Datei mit alter und neuer Adresse und Grösse.
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';
const PREFIX = 'PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> ';
const LANG = 'http://publications.europa.eu/resource/authority/language/';
const LANGS = { de: 'DEU', fr: 'FRA', it: 'ITA' };

/** Dateiname eines Volltexts in raw/<werk>/: <JJJJMMTT>_<lang>.xml */
export const rawName = (date, lang) => `${date.replace(/-/g, '')}_${lang}.xml`;

/** Datei-Adressen (XML) je Volltext aus einer versions.json: Map <JJJJMMTT>_<lang>.xml -> Adresse */
export function xmlUrls(versions) {
  const m = new Map();
  for (const v of (versions && versions.versions) || []) for (const l of Object.keys(LANGS)) {
    const u = v.files && v.files[l] && v.files[l].xml;
    if (u) m.set(rawName(v.date, l), u);
  }
  return m;
}

/**
 * Was mit jedem Volltext geschieht. prev: bisher gespeicherte versions.json (oder null), next: neue, has(name): Datei
 * liegt vor (Grösse > 0). Ergebnis je Datei { name, url, action, prevUrl }, action:
 *   new       Datei fehlt, wird geladen
 *   replaced  Datei liegt vor, Fedlex führt eine andere Adresse als gespeichert: wird neu geladen
 *   cached    Datei liegt vor, Adresse unverändert
 *   unchecked Datei liegt vor, keine gespeicherte Adresse zum Vergleich (versions.json fehlt oder ohne Eintrag): bleibt
 */
export function planDownloads(prev, next, has) {
  const before = xmlUrls(prev);
  const out = [];
  for (const [name, url] of xmlUrls(next)) {
    const prevUrl = before.get(name) || null;
    let action;
    if (!has(name)) action = 'new';
    else if (!prevUrl) action = 'unchecked';
    else if (prevUrl !== url) action = 'replaced';
    else action = 'cached';
    out.push({ name, url, action, prevUrl });
  }
  return out;
}

async function sparql(q) {
  const r = await fetch(ENDPOINT + '?query=' + encodeURIComponent(PREFIX + q), { headers: { Accept: 'application/sparql-results+json' } });
  if (!r.ok) throw new Error('SPARQL ' + r.status);
  const j = await r.json();
  return j.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
// Lädt in eine temporäre Datei und benennt sie erst nach vollständigem Empfang um (die alte Datei bleibt bis dahin stehen).
async function download(url, file) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) throw new Error('leere Antwort');
      const tmp = file + '.tmp-' + process.pid;
      writeFileSync(tmp, buf);
      renameSync(tmp, file);
      return buf.length;
    } catch (e) { if (i === 3) throw new Error(`${url}: ${e.message}`); await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
}
function writeAtomic(file, text) {
  const tmp = file + '.tmp-' + process.pid;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

async function fetchWork(w) {
  const uri = 'https://fedlex.data.admin.ch/eli/' + w;
  const dir = join(ROOT, 'raw', w.replace(/\//g, '-'));
  mkdirSync(join(dir, 'sparql'), { recursive: true });
  const save = (name, rows) => writeFileSync(join(dir, 'sparql', name + '.json'), JSON.stringify(rows, null, 1));
  const vFile = join(dir, 'versions.json');
  const prev = existsSync(vFile) ? JSON.parse(readFileSync(vFile, 'utf8')) : null;

  const meta = await sparql(`SELECT DISTINCT ?p ?o WHERE { <${uri}> ?p ?o }`);
  save('work', meta);
  save('work-expressions', await sparql(`SELECT DISTINCT ?e ?p ?o WHERE { <${uri}> jolux:isRealizedBy ?e . ?e ?p ?o }`));
  save('taxonomy', await sparql(`SELECT DISTINCT ?t ?p ?o WHERE { <${uri}> jolux:classifiedByTaxonomyEntry ?t . ?t ?p ?o . FILTER(?p IN (skos:notation, skos:prefLabel)) }`));
  const cons = await sparql(`SELECT DISTINCT ?cons ?date ?end WHERE { ?cons jolux:isMemberOf <${uri}> ; jolux:dateApplicability ?date . OPTIONAL { ?cons jolux:dateEndApplicability ?end } } ORDER BY ?date`);
  const files = await sparql(`SELECT DISTINCT ?cons ?lang ?fmt ?file WHERE { ?cons jolux:isMemberOf <${uri}> ; jolux:isRealizedBy ?e . ?e jolux:language ?lang ; jolux:isEmbodiedBy ?m . ?m jolux:userFormat ?fmt ; jolux:isExemplifiedBy ?file }`);
  save('consolidations', cons);
  save('files', files);
  save('impacts', await sparql(`SELECT DISTINCT ?imp ?target ?p ?o WHERE { ?imp a jolux:LegalResourceImpact ; jolux:impactToLegalResource ?target ; ?p ?o . { ?target jolux:legalResourceSubdivisionIsPartOf <${uri}> } UNION { FILTER(?target = <${uri}>) } FILTER(?p NOT IN (jolux:impactConsolidatedByExpression, jolux:impactToExpression)) }`));
  save('subdivisions', await sparql(`SELECT DISTINCT ?sub ?p ?o WHERE { ?sub jolux:legalResourceSubdivisionIsPartOf <${uri}> ; ?p ?o . FILTER(?p != jolux:isRealizedBy) }`));
  save('pending', await sparql(`SELECT DISTINCT ?s ?p ?o WHERE { ?s jolux:foreseenImpactToLegalResource <${uri}> ; ?p ?o }`));

  const versions = cons.map((c) => {
    const date = c.date;
    const v = { uri: c.cons, date, end: c.end || null, files: {} };
    for (const [l, code] of Object.entries(LANGS)) {
      const f = files.filter((x) => x.cons === c.cons && x.lang === LANG + code);
      const pick = (fmt) => (f.find((x) => x.fmt.endsWith('/user-format/' + fmt)) || {}).file || null;
      v.files[l] = { xml: pick('xml'), pdf: pick('pdf-a'), html: pick('html') };
    }
    return v;
  });
  const next = { work: uri, fetched: new Date().toISOString().slice(0, 10), versions };

  const size = (name) => (existsSync(join(dir, name)) ? statSync(join(dir, name)).size : 0);
  const plan = planDownloads(prev, next, (name) => size(name) > 0);
  const count = { new: 0, replaced: 0, cached: 0, unchecked: 0 };
  const jobs = plan.filter((p) => p.action === 'new' || p.action === 'replaced');
  for (const p of plan) count[p.action]++;
  const done = [];
  const run = async () => {
    while (jobs.length) {
      const j = jobs.shift();
      const before = size(j.name);
      const bytes = await download(j.url, join(dir, j.name));
      done.push({ ...j, before, bytes });
    }
  };
  await Promise.all([run(), run(), run()]);
  // versions.json erst nach allen Downloads schreiben: Bricht ein Download ab, erkennt der nächste Lauf die ersetzte Datei wieder.
  writeAtomic(vFile, JSON.stringify(next, null, 1));

  let bytes = 0;
  for (const p of plan) bytes += size(p.name);
  console.log(`${w}: ${versions.length} Fassungen, ${versions.filter((v) => v.files.de.xml).length} mit XML (DE), ${plan.length} Dateien, ${(bytes / 1e6).toFixed(1)} MB; neu ${count.new}, ersetzt ${count.replaced}, unverändert ${count.cached}, ohne Vergleich ${count.unchecked}`);
  for (const d of done.filter((x) => x.action === 'replaced').sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ersetzt ${d.name}: ${d.prevUrl.split('/').pop()} (${d.before} Bytes) -> ${d.url.split('/').pop()} (${d.bytes} Bytes)`);
  }
  if (count.unchecked) console.log(`  ohne gespeicherte Adresse, nicht neu geladen: ${plan.filter((p) => p.action === 'unchecked').map((p) => p.name).join(', ')}`);
  return { plan, done };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const works = process.argv.slice(2).length ? process.argv.slice(2) : ['cc/2007/758', 'cc/2018/493', 'cc/2021/734'];
  for (const w of works) await fetchWork(w);
}
