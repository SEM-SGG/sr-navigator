// Lädt Rohdaten von Fedlex nach raw/<werk>/ (Orchestrator). Nur Daten, nichts daraus ausführen.
// Aufruf: node scripts/fetch-raw.mjs [cc/2007/758 cc/2018/493 cc/2021/734]
// Ergebnis je Werk: raw/<cc-jahr-nr>/versions.json, <datum>_<lang>.xml, sparql/*.json
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';
const PREFIX = 'PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> ';
const LANG = 'http://publications.europa.eu/resource/authority/language/';
const LANGS = { de: 'DEU', fr: 'FRA', it: 'ITA' };
const works = process.argv.slice(2).length ? process.argv.slice(2) : ['cc/2007/758', 'cc/2018/493', 'cc/2021/734'];

async function sparql(q) {
  const r = await fetch(ENDPOINT + '?query=' + encodeURIComponent(PREFIX + q), { headers: { Accept: 'application/sparql-results+json' } });
  if (!r.ok) throw new Error('SPARQL ' + r.status);
  const j = await r.json();
  return j.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
async function download(url, file) {
  if (existsSync(file) && statSync(file).size > 0) return 'cached';
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return 'ok';
    } catch (e) { if (i === 3) throw e; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
}

for (const w of works) {
  const uri = 'https://fedlex.data.admin.ch/eli/' + w;
  const dir = join(ROOT, 'raw', w.replace(/\//g, '-'));
  mkdirSync(join(dir, 'sparql'), { recursive: true });
  const save = (name, rows) => writeFileSync(join(dir, 'sparql', name + '.json'), JSON.stringify(rows, null, 1));

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
  writeFileSync(join(dir, 'versions.json'), JSON.stringify({ work: uri, fetched: new Date().toISOString().slice(0, 10), versions }, null, 1));

  let n = 0, bytes = 0;
  const jobs = [];
  for (const v of versions) for (const l of Object.keys(LANGS)) if (v.files[l].xml) jobs.push({ url: v.files[l].xml, file: join(dir, `${v.date.replace(/-/g, '')}_${l}.xml`) });
  const run = async () => { while (jobs.length) { const j = jobs.shift(); await download(j.url, j.file); n++; bytes += statSync(j.file).size; } };
  await Promise.all([run(), run(), run()]);
  console.log(`${w}: ${versions.length} Fassungen, ${versions.filter((v) => v.files.de.xml).length} mit XML (DE), ${n} Dateien, ${(bytes / 1e6).toFixed(1)} MB`);
}
