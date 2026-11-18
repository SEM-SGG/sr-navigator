// SR-Navigator — Zugriff auf Fedlex (SPARQL und Filestore) (ESM, isomorph; fetch und DOMParser werden übergeben)
//
// searchWorks(query, { fetch, signal }) -> [ { id, eli, sr, abbr, title, status, dateEntryInForce, versions, xmlVersions, xmlFrom } ]
// fetchWorkMeta(workId, { fetch, signal }) -> { meta, versions, impacts, pending, actsMeta }
// fetchActsMeta(actIds, { fetch, signal }) -> { 'oc/…': { title, as, dateDocument, dateEntryInForce } }
// loadWork(workId, { fetch, DOMParser, langs, onProgress, signal, concurrency }) -> Bundle
// checkUpdates(bundle, { fetch, signal }) -> { newVersions: [ { date, files } ], changedFiles: [ { stage, lang, url } ], pending: […] }
// updateWork(bundle, { fetch, DOMParser, onProgress, signal }) -> { bundle, added: [stageId…], replaced: [stageId…] }
//
// Alle SPARQL-Texte stehen in diesem Modul. Nutzereingaben gehen nur als maskierte Literale in eine Abfrage (sparqlString).

import { buildBundle } from './model.js';
import { idFromNum } from './parser.js';

export const ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';
export const ELI = 'https://fedlex.data.admin.ch/eli/';
const PREFIX = 'PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>\nPREFIX skos: <http://www.w3.org/2004/02/skos/core#>\n';
const LANG_URI = 'http://publications.europa.eu/resource/authority/language/';
const LANG_CODE = { DEU: 'de', FRA: 'fr', ITA: 'it', ENG: 'en', ROH: 'rm' };
const CODE_LANG = { de: 'DEU', fr: 'FRA', it: 'ITA', en: 'ENG', rm: 'ROH' };
const FMT = 'https://fedlex.data.admin.ch/vocabulary/user-format/';
export const STATUS = { 0: 'inForce', 1: 'notInSr', 2: 'obsolete', 3: 'repealed', 4: 'notYetInForce', 5: 'suspended' };
const STATUS_RANK = { inForce: 0, notYetInForce: 1, suspended: 2, notInSr: 3, obsolete: 4, repealed: 5 };
export const CONSULTATION_STATUS = {
  0: { code: 'preparation', de: 'In Vorbereitung', fr: 'En préparation', it: 'In fase di realizzazione' },
  1: { code: 'planned', de: 'Geplant', fr: 'Prévue', it: 'Previste' },
  2: { code: 'ongoing', de: 'Laufend', fr: 'En cours', it: 'In corso' },
  3: { code: 'closed-pending', de: 'Abgeschlossen – abwarten Stellungnahmen und/oder des Ergebnisberichts', fr: 'Clôturée - en attente des avis et/ou du rapport de résultats', it: 'Concluse - in attesa dei pareri e/o del rapporto sui risultati' },
  4: { code: 'closed-report', de: 'Abgeschlossen – abwarten Ergebnisbericht', fr: 'Clôturée - en attente du rapport de résultats', it: 'Concluse - in attesa del rapporto sui risultati' },
  5: { code: 'closed', de: 'Abgeschlossen', fr: 'Clôturée', it: 'Concluse' },
  6: { code: 'withdrawn', de: 'Zurückgezogen', fr: 'Retirée', it: 'Ritirata' },
};

// ------------------------------------------------------------------ Grundfunktionen

// SPARQL-Stringliteral: alle Sonderzeichen maskiert (SPARQL 1.1, ECHAR und UCHAR)
export function sparqlString(s) {
  let out = '"';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === "'") out += "\\'";
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20 || c === 0x7f || (c >= 0xd800 && c <= 0xdfff)) out += '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}
// IRI nur aus geprüften Bausteinen (Erlass-Id)
export function workIri(workId) {
  const path = workPath(workId);
  return `<${ELI}${path}>`;
}
export function workPath(workId) {
  const m = /^cc[-/](\d{1,4})[-/]([0-9A-Za-z_.]+)$/.exec(String(workId).trim());
  if (!m) throw new Error(`Ungültige Erlass-Id: ${workId}`);
  return `cc/${m[1]}/${m[2]}`;
}
export function workIdOf(eliOrPath) {
  const m = /(?:eli\/)?cc\/(\d{1,4})\/([0-9A-Za-z_.]+)/.exec(String(eliOrPath));
  return m ? `cc-${m[1]}-${m[2]}` : null;
}
const actIri = (id) => {
  if (!/^oc\/\d{4}\/[0-9A-Za-z_.]+$/.test(id)) throw new Error(`Ungültige Akt-Id: ${id}`);
  return `<${ELI}${id}>`;
};
export const actIdOf = (uri) => { const m = /\/eli\/oc\/(\d{4})\/([0-9A-Za-z_.]+)/.exec(uri || ''); return m ? `oc/${m[1]}/${m[2]}` : null; };
const langOf = (uri) => LANG_CODE[String(uri || '').replace(LANG_URI, '')] || null;

export async function sparql(query, { fetch, signal } = {}) {
  const f = fetch || globalThis.fetch;
  const body = 'query=' + encodeURIComponent(PREFIX + query);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await f(ENDPOINT, {
        method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body, signal,
      });
      if (!r.ok) throw Object.assign(new Error(`SPARQL HTTP ${r.status}`), { status: r.status, url: ENDPOINT });
      const j = await r.json();
      return j.results.bindings.map((b) => {
        const o = {};
        for (const [k, v] of Object.entries(b)) o[k] = v.value, v['xml:lang'] && (o[k + '@'] = v['xml:lang']);
        return o;
      });
    } catch (e) {
      lastErr = e;
      if ((signal && signal.aborted) || (e && e.name === 'AbortError') || (e && e.status && e.status < 500)) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------------ Abfragen

export const Q = {
  work: (iri) => `SELECT ?p ?o WHERE { ${iri} ?p ?o . FILTER(?p IN (jolux:dateDocument, jolux:dateEntryInForce, jolux:inForceStatus, jolux:basicAct, jolux:historicalLegalId, jolux:typeDocument)) }`,
  titles: (iri) => `SELECT ?lang ?p ?o WHERE { ${iri} jolux:isRealizedBy ?e . ?e jolux:language ?lang ; ?p ?o . FILTER(?p IN (jolux:title, jolux:titleShort, jolux:titleAlternative)) }`,
  taxonomy: (iri) => `SELECT ?n WHERE { ${iri} jolux:classifiedByTaxonomyEntry ?t . ?t skos:notation ?n }`,
  versions: (iri) => `SELECT ?cons ?date ?end ?lang ?fmt ?file WHERE { ?cons jolux:isMemberOf ${iri} ; jolux:dateApplicability ?date . OPTIONAL { ?cons jolux:dateEndApplicability ?end } OPTIONAL { ?cons jolux:isRealizedBy ?e . ?e jolux:language ?lang ; jolux:isEmbodiedBy ?m . ?m jolux:userFormat ?fmt ; jolux:isExemplifiedBy ?file . FILTER(?lang IN (<${LANG_URI}DEU>, <${LANG_URI}FRA>, <${LANG_URI}ITA>)) FILTER(?fmt IN (<${FMT}xml>, <${FMT}pdf-a>, <${FMT}html>)) } }`,
  impacts: (iri) => `SELECT ?imp ?target ?from ?type ?date ?label ?comment ?lang WHERE { ?imp a jolux:LegalResourceImpact ; jolux:impactToLegalResource ?target ; jolux:impactFromLegalResource ?from ; jolux:legalResourceImpactHasType ?type . ?target jolux:legalResourceSubdivisionIsPartOf ${iri} . OPTIONAL { ?imp jolux:legalResourceImpactHasDateEntryInForce ?date } OPTIONAL { ?imp jolux:impactFromLegalResourceLabel ?label } OPTIONAL { ?imp jolux:impactToLegalResourceComment ?comment } OPTIONAL { ?imp jolux:language ?lang } }`,
  impactsWork: (iri) => `SELECT ?imp ?from ?type ?date ?label ?comment ?lang WHERE { ?imp a jolux:LegalResourceImpact ; jolux:impactToLegalResource ${iri} ; jolux:impactFromLegalResource ?from ; jolux:legalResourceImpactHasType ?type . OPTIONAL { ?imp jolux:legalResourceImpactHasDateEntryInForce ?date } OPTIONAL { ?imp jolux:impactFromLegalResourceLabel ?label } OPTIONAL { ?imp jolux:impactToLegalResourceComment ?comment } OPTIONAL { ?imp jolux:language ?lang } }`,
  pending: (iri) => `SELECT ?s ?status ?title ?start ?fstart WHERE { ?s jolux:foreseenImpactToLegalResource ${iri} . OPTIONAL { ?s jolux:consultationStatus ?status } OPTIONAL { ?s jolux:eventTitle ?title } OPTIONAL { ?s jolux:hasSubTask ?sub . OPTIONAL { ?sub jolux:eventStartDate ?start } OPTIONAL { ?sub jolux:foreseenEventStartDate ?fstart } } }`,
  acts: (iris) => `SELECT ?act ?dd ?dif ?lang ?title ?hid ?ident WHERE { VALUES ?act { ${iris.join(' ')} } OPTIONAL { ?act jolux:dateDocument ?dd } OPTIONAL { ?act jolux:dateEntryInForce ?dif } OPTIONAL { ?act jolux:isRealizedBy ?e . ?e jolux:language ?lang . FILTER(?lang IN (<${LANG_URI}DEU>, <${LANG_URI}FRA>, <${LANG_URI}ITA>)) OPTIONAL { ?e jolux:title ?title } OPTIONAL { ?e jolux:historicalLegalId ?hid } OPTIONAL { ?e <http://purl.org/dc/terms/identifier> ?ident } } }`,
  // Suche: Treffer als Erlasse (cc); Titel, Kurztitel und SR-Nummer aus beiden Quellen (historicalLegalId, Taxonomie)
  searchSr: (lit, prefix) => `SELECT DISTINCT ?w WHERE { { ?w jolux:classifiedByTaxonomyEntry ?t . ?t skos:notation ?n . } UNION { ?w jolux:historicalLegalId ?n . } ?w a jolux:ConsolidationAbstract . FILTER(${prefix ? `STR(?n) = ${lit} || STRSTARTS(STR(?n), CONCAT(${lit}, "."))  || STRSTARTS(STR(?n), ${lit})` : `STR(?n) = ${lit}`}) } LIMIT 200`,
  searchTitle: (lit) => `SELECT DISTINCT ?w WHERE { ?w a jolux:ConsolidationAbstract ; jolux:inForceStatus <https://fedlex.data.admin.ch/vocabulary/enforcement-status/0> ; jolux:isRealizedBy ?e . { ?e jolux:titleShort ?s . FILTER(LCASE(STR(?s)) = LCASE(${lit})) } UNION { ?e jolux:title ?title . FILTER(CONTAINS(LCASE(STR(?title)), LCASE(${lit}))) } UNION { ?e jolux:titleAlternative ?a . FILTER(CONTAINS(LCASE(STR(?a)), LCASE(${lit}))) } } LIMIT 60`,
  searchShortAll: (lit) => `SELECT DISTINCT ?w WHERE { ?w a jolux:ConsolidationAbstract ; jolux:isRealizedBy ?e . ?e jolux:titleShort ?s . FILTER(LCASE(STR(?s)) = LCASE(${lit})) } LIMIT 60`,
  summary: (iris) => `SELECT ?w ?status ?dif ?hid ?n ?lang ?title ?short WHERE { VALUES ?w { ${iris.join(' ')} } OPTIONAL { ?w jolux:inForceStatus ?status } OPTIONAL { ?w jolux:dateEntryInForce ?dif } OPTIONAL { ?w jolux:historicalLegalId ?hid } OPTIONAL { ?w jolux:classifiedByTaxonomyEntry ?t . ?t skos:notation ?n } OPTIONAL { ?w jolux:isRealizedBy ?e . ?e jolux:language ?lang . FILTER(?lang IN (<${LANG_URI}DEU>, <${LANG_URI}FRA>, <${LANG_URI}ITA>)) OPTIONAL { ?e jolux:title ?title } OPTIONAL { ?e jolux:titleShort ?short } } }`,
  counts: (iris) => `SELECT ?w ?date ?fmt WHERE { VALUES ?w { ${iris.join(' ')} } ?cons jolux:isMemberOf ?w ; jolux:dateApplicability ?date . OPTIONAL { ?cons jolux:isRealizedBy ?e . ?e jolux:language <${LANG_URI}DEU> ; jolux:isEmbodiedBy ?m . ?m jolux:userFormat ?fmt . FILTER(?fmt = <${FMT}xml>) } }`,
};

// ------------------------------------------------------------------ Aufbereitung

export function normalizeVersions(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.cons)) by.set(r.cons, { uri: r.cons, date: r.date, end: r.end || null, files: {} });
    const v = by.get(r.cons);
    if (r.end && !v.end) v.end = r.end;
    const l = langOf(r.lang);
    if (!l || !r.fmt || !r.file) continue;
    const f = v.files[l] || (v.files[l] = { xml: null, pdf: null, html: null });
    const fmt = r.fmt.replace(FMT, '');
    const key = fmt === 'pdf-a' ? 'pdf' : fmt;
    // bei mehreren Dateien: die mit der höchsten Versionsnummer im Dateinamen
    const num = (u) => { const m = /-(\d+)\.\w+$/.exec(u || ''); return m ? +m[1] : 0; };
    if (!f[key] || num(r.file) > num(f[key])) f[key] = r.file;
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function unitOfTarget(target, workPathStr) {
  const rest = target.replace(ELI + workPathStr, '').replace(/^\//, '');
  if (!rest) return { unit: null, kind: 'work' };
  const m = /^art_(.+)$/.exec(rest);
  if (m) return { unit: idFromNum('art_', m[1].replace(/_/g, '')), kind: 'article', raw: rest };
  const a = /^annex_(.+)$/.exec(rest);
  if (a) return { unit: idFromNum('annex_', a[1]), kind: 'annex', raw: rest };
  if (/^(chap|sec|tit|part)_/.test(rest)) return { unit: null, toc: rest.replace(/(\d)([a-z])/g, '$1_$2'), kind: 'toc', raw: rest };
  return { unit: null, kind: 'text', raw: rest };
}
const IMPACT_ACTION = { 1: 'amended', 2: 'repealed', 5: 'inForce', 6: 'corrected', 7: 'extended' };
const cleanComment = (s) => String(s || '').replace(/<(?!\/?(i|b|sup|sub)>)[^>]*>/g, '').trim();

export function normalizeImpacts(rows, workPathStr) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.imp)) by.set(r.imp, { id: r.imp, target: r.target, from: r.from, type: +String(r.type).split('/').pop(), inForce: r.date || null, label: {}, comment: {}, langs: new Set() });
    const o = by.get(r.imp);
    if (r.lang) o.langs.add(langOf(r.lang));
    if (r.label) { const m = /^(AS|RO|RU|BS|RS|CS)\b/.exec(r.label); const l = m ? { AS: 'de', RO: 'fr', RU: 'it', BS: 'de', RS: 'fr', CS: 'it' }[m[1]] : null; if (l) o.label[l] = r.label; }
    if (r.comment && r['comment@']) { const c = cleanComment(r.comment); if (c) o.comment[r['comment@']] = c; }
  }
  // Einträge je Sprache (ältere Erfassung) zusammenführen: gleicher Erlass, Ziel, Typ und Datum
  const merged = new Map();
  for (const o of by.values()) {
    const act = actIdOf(o.from);
    const t = unitOfTarget(o.target, workPathStr);
    const key = [act, o.target.replace(/maintext_.*$/, 'maintext'), o.type, o.inForce].join('|');
    let e = merged.get(key);
    if (!e) {
      e = { id: o.id, act, from: o.from, target: o.target, targetKind: t.kind, unit: t.unit, toc: t.toc || null, type: o.type, action: IMPACT_ACTION[o.type] || 'other', inForce: o.inForce, label: {}, comment: {} };
      merged.set(key, e);
    }
    Object.assign(e.label, o.label);
    for (const [l, c] of Object.entries(o.comment)) { if (!e.comment[l]) e.comment[l] = c; else if (!e.comment[l].split(' | ').includes(c)) e.comment[l] += ' | ' + c; }
  }
  const out = [...merged.values()].map((e) => {
    if (!Object.keys(e.label).length) delete e.label;
    if (!Object.keys(e.comment).length) delete e.comment;
    return e;
  });
  out.sort((a, b) => (a.inForce || '').localeCompare(b.inForce || '') || String(a.act).localeCompare(String(b.act)) || String(a.unit).localeCompare(String(b.unit)) || a.id.localeCompare(b.id));
  return out;
}

export function normalizePending(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.s)) by.set(r.s, { id: r.s.replace(ELI, ''), type: /\/cons_\d+$/.test(r.s) ? 'consultation' : 'project', title: {}, date: null, status: null, statusLabel: null, url: r.s, _dates: new Set() });
    const o = by.get(r.s);
    if (r.title && r['title@']) o.title[r['title@']] = r.title;
    if (r.status) { const n = +String(r.status).split('/').pop(); const s = CONSULTATION_STATUS[n]; if (s) { o.status = s.code; o.statusLabel = { de: s.de, fr: s.fr, it: s.it }; } }
    if (r.start) o._dates.add(r.start.slice(0, 10));
    else if (r.fstart) o._dates.add(r.fstart.slice(0, 10));
  }
  const out = [...by.values()].map((o) => { const d = [...o._dates].sort(); o.date = d[0] || null; delete o._dates; return o; });
  out.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
  return out;
}

function normalizeWork(workId, rows, titleRows, taxRows) {
  const get = (p) => rows.filter((r) => r.p.endsWith('#' + p)).map((r) => r.o);
  const title = {}, short = {}, abbr = {};
  for (const r of titleRows) {
    const l = langOf(r.lang);
    if (!l) continue;
    if (r.p.endsWith('#title')) title[l] = r.o;
    if (r.p.endsWith('#titleAlternative')) short[l] = r.o;
    if (r.p.endsWith('#titleShort')) abbr[l] = r.o;
  }
  const notations = [...new Set(taxRows.map((r) => r.n))].sort();
  const hist = get('historicalLegalId');
  const st = get('inForceStatus')[0];
  const status = st ? (STATUS[+st.split('/').pop()] || 'unknown') : null;
  const ls = ['de', 'fr', 'it'];
  return {
    id: workId, eli: ELI + workPath(workId),
    sr: notations[0] || hist[0] || null,
    title: Object.fromEntries(ls.map((l) => [l, title[l] || null])),
    short: Object.fromEntries(ls.map((l) => [l, short[l] || null])),
    abbr: Object.fromEntries(ls.map((l) => [l, abbr[l] || null])),
    dateDocument: get('dateDocument')[0] || null,
    dateEntryInForce: get('dateEntryInForce')[0] || null,
    status,
    base: actIdOf(get('basicAct')[0]) || null,
  };
}

export async function fetchActsMeta(actIds, opts = {}) {
  const ids = [...new Set(actIds)].filter((x) => /^oc\/\d{4}\/[0-9A-Za-z_.]+$/.test(x)).sort();
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const rows = await sparql(Q.acts(chunk.map(actIri)), opts);
    for (const r of rows) {
      const id = actIdOf(r.act);
      const o = out[id] || (out[id] = { title: {}, as: {}, dateDocument: null, dateEntryInForce: null });
      if (r.dd) o.dateDocument = r.dd;
      if (r.dif) o.dateEntryInForce = r.dif;
      const l = langOf(r.lang);
      if (l && r.title) o.title[l] = r.title;
      if (l && r.hid) o.as[l] = r.hid;
      else if (l && r.ident && /^(AS|RO|RU) \d{4} \d+/.test(r.ident) && !o.as[l]) o.as[l] = r.ident;
    }
  }
  return out;
}

export async function fetchWorkMeta(workId, opts = {}) {
  const iri = workIri(workId);
  const path = workPath(workId);
  const [w, t, tax, ver, imp, impW, pend] = [
    await sparql(Q.work(iri), opts), await sparql(Q.titles(iri), opts), await sparql(Q.taxonomy(iri), opts),
    await sparql(Q.versions(iri), opts), await sparql(Q.impacts(iri), opts), await sparql(Q.impactsWork(iri), opts),
    await sparql(Q.pending(iri), opts),
  ];
  for (const r of impW) imp.push({ ...r, target: ELI + path });
  const meta = normalizeWork(workId, w, t, tax);
  if (!w.length && !ver.length) throw Object.assign(new Error(`Erlass ${workId} bei Fedlex nicht gefunden`), { code: 'not-found' });
  const versions = normalizeVersions(ver);
  const impacts = normalizeImpacts(imp, path);
  const pending = normalizePending(pend);
  const actIds = [...new Set(impacts.map((x) => x.act).filter(Boolean))];
  if (meta.base) actIds.push(meta.base);
  const actsMeta = await fetchActsMeta(actIds, opts);
  return { meta, versions, impacts, pending, actsMeta };
}

// Ändernde Erlasse aus den Fussnoten der Volltexte (für Titel und AS-Fundstellen)
export function actIdsInTexts(texts) {
  const set = new Set();
  const vals = texts instanceof Map ? texts.values() : Object.values(texts);
  for (const x of vals) { const re = /href="https:\/\/fedlex\.data\.admin\.ch\/eli\/oc\/(\d{4})\/([0-9A-Za-z_.]+)"/g; let m; while ((m = re.exec(x))) set.add(`oc/${m[1]}/${m[2]}`); }
  return [...set];
}

// ------------------------------------------------------------------ Laden

async function fetchText(url, { fetch, signal }) {
  const f = fetch || globalThis.fetch;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await f(url, { signal });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} für ${url}`), { status: r.status, url });
      return await r.text();
    } catch (e) {
      lastErr = e;
      if ((signal && signal.aborted) || (e && e.name === 'AbortError') || (e && e.status && e.status < 500 && e.status !== 429)) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw Object.assign(new Error(`Datei nicht geladen: ${url} (${lastErr && lastErr.message})`), { url, cause: lastErr });
}

async function loadTexts(versions, langs, { fetch, signal, onProgress, concurrency = 3, only = null }) {
  const jobs = [];
  for (const v of versions) for (const l of langs) {
    const url = v.files && v.files[l] && v.files[l].xml;
    const key = `${v.date.replace(/-/g, '')}_${l}`;
    if (url && (!only || only.has(key))) jobs.push({ key, url });
  }
  const texts = new Map();
  const errors = [];
  let done = 0;
  const run = async () => {
    while (jobs.length) {
      if (signal && signal.aborted) throw Object.assign(new Error('Abgebrochen'), { name: 'AbortError' });
      const j = jobs.shift();
      try { texts.set(j.key, await fetchText(j.url, { fetch, signal })); }
      catch (e) { if (e.name === 'AbortError' || (signal && signal.aborted)) throw e; errors.push({ key: j.key, url: j.url, error: String(e.message || e) }); }
      done++;
      if (onProgress) onProgress({ phase: 'download', done, total: done + jobs.length, label: j.key });
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const total = jobs.length;
  if (onProgress) onProgress({ phase: 'download', done: 0, total, label: '' });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total || 1)) }, run));
  return { texts, errors };
}

export async function loadWork(workId, opts = {}) {
  const { fetch, DOMParser, signal, onProgress } = opts;
  const langs = opts.langs || ['de', 'fr', 'it'];
  if (onProgress) onProgress({ phase: 'meta', done: 0, total: 1, label: workId });
  const m = await fetchWorkMeta(workId, { fetch, signal });
  const xmlCount = m.versions.filter((v) => langs.some((l) => v.files[l] && v.files[l].xml)).length;
  if (!xmlCount) throw Object.assign(new Error(`Erlass ${workId}: keine Fassung mit XML`), { code: 'no-xml' });
  const { texts, errors } = await loadTexts(m.versions, langs, { fetch, signal, onProgress, concurrency: opts.concurrency || 3 });
  if (errors.length) throw Object.assign(new Error(`${errors.length} Datei(en) nicht geladen: ${errors.map((e) => e.url).join(', ')}`), { code: 'download', errors });
  const extra = actIdsInTexts(texts).filter((id) => !m.actsMeta[id]);
  if (extra.length) Object.assign(m.actsMeta, await fetchActsMeta(extra, { fetch, signal }));
  const fetched = opts.today || new Date().toISOString().slice(0, 10);
  return buildBundle({ ...m, texts, fetched }, { DOMParser, langs, onProgress: onProgress ? (p) => onProgress({ phase: 'parse', ...p }) : null });
}

// ------------------------------------------------------------------ Aktualisieren

export async function checkUpdates(bundle, opts = {}) {
  const iri = workIri(bundle.work.id);
  const versions = normalizeVersions(await sparql(Q.versions(iri), opts));
  const pending = normalizePending(await sparql(Q.pending(iri), opts));
  const known = new Set(bundle.timeline.map((t) => t.date));
  const stages = new Map(bundle.stages.map((s) => [s.id, s]));
  const newVersions = [], changedFiles = [];
  for (const v of versions) {
    const id = v.date.replace(/-/g, '');
    const hasXml = bundle.langs.some((l) => v.files[l] && v.files[l].xml);
    if (!known.has(v.date) || (hasXml && !stages.has(id))) newVersions.push({ date: v.date, files: v.files });
    else if (stages.has(id)) {
      const st = stages.get(id);
      for (const l of bundle.langs) {
        const url = v.files[l] && v.files[l].xml;
        if (url && st.source && st.source.url && st.source.url[l] !== url) changedFiles.push({ stage: id, lang: l, url });
      }
    }
  }
  return { newVersions, changedFiles, pending, versions };
}

// Neu laden: die Bibliothek speichert keine Volltexte, darum wird bei Änderungen das ganze Bundle neu aufgebaut.
// Unverändertes Ergebnis wird erkannt (added und replaced leer).
export async function updateWork(bundle, opts = {}) {
  const chk = await checkUpdates(bundle, opts);
  if (!chk.newVersions.length && !chk.changedFiles.length) {
    return { bundle: { ...bundle, pending: chk.pending }, added: [], replaced: [] };
  }
  const nb = await loadWork(bundle.work.id, { ...opts, langs: bundle.langs });
  const old = new Set(bundle.stages.map((s) => s.id));
  const added = nb.stages.filter((s) => !old.has(s.id)).map((s) => s.id);
  const replaced = [...new Set(chk.changedFiles.map((c) => c.stage))];
  return { bundle: nb, added, replaced };
}

// ------------------------------------------------------------------ Suche

function srLike(q) { return /^\d+(?:\.\d+)*\.?$/.test(q) || /^0(\.\d+)+$/.test(q); }

export async function searchWorks(query, opts = {}) {
  const q = String(query || '').trim().replace(/^(SR|RS)\s+/i, '');
  if (!q) return [];
  if (q.length > 200) throw new Error('Suchbegriff zu lang');
  const lit = sparqlString(q.replace(/\.$/, ''));
  let rows;
  if (srLike(q)) rows = await sparql(Q.searchSr(lit, true), opts);
  else {
    rows = await sparql(Q.searchTitle(lit), opts);
    const more = await sparql(Q.searchShortAll(lit), opts);
    rows = [...rows, ...more];
  }
  const works = [...new Set(rows.map((r) => r.w))].filter((w) => /\/eli\/cc\//.test(w) && !/\/\d{8}$/.test(w));
  if (!works.length) return [];
  const iris = works.slice(0, 80).map((w) => `<${w}>`);
  const sum = await sparql(Q.summary(iris), opts);
  const cnt = await sparql(Q.counts(iris), opts);
  const by = new Map();
  for (const r of sum) {
    const id = workIdOf(r.w);
    if (!id) continue;
    const o = by.get(id) || { id, eli: r.w, sr: null, abbr: { de: null, fr: null, it: null }, title: { de: null, fr: null, it: null }, status: null, dateEntryInForce: null, versions: 0, xmlVersions: 0, xmlFrom: null, _sr: new Set() };
    by.set(id, o);
    if (r.status) o.status = STATUS[+r.status.split('/').pop()] || 'unknown';
    if (r.dif) o.dateEntryInForce = r.dif;
    if (r.n) o._sr.add('t:' + r.n);
    if (r.hid) o._sr.add('h:' + r.hid);
    const l = langOf(r.lang);
    if (l && r.title) o.title[l] = r.title;
    if (l && r.short) o.abbr[l] = r.short;
  }
  const vers = new Map();
  for (const r of cnt) {
    const id = workIdOf(r.w);
    const v = vers.get(id) || { all: new Set(), xml: new Set() };
    vers.set(id, v);
    v.all.add(r.date);
    if (r.fmt) v.xml.add(r.date);
  }
  const out = [];
  for (const o of by.values()) {
    const t = [...o._sr].filter((x) => x.startsWith('t:')).map((x) => x.slice(2)).sort();
    const h = [...o._sr].filter((x) => x.startsWith('h:')).map((x) => x.slice(2)).sort();
    o.sr = t[0] || h[0] || null;
    delete o._sr;
    const v = vers.get(o.id);
    if (v) { o.versions = v.all.size; o.xmlVersions = v.xml.size; o.xmlFrom = [...v.xml].sort()[0] || null; }
    if (srLike(q) && o.sr && !(o.sr === q.replace(/\.$/, '') || o.sr.startsWith(q.replace(/\.$/, '')))) continue;
    out.push(o);
  }
  const exact = (o) => (srLike(q) ? (o.sr === q.replace(/\.$/, '') ? 0 : 1) : (Object.values(o.abbr).some((a) => a && a.toLowerCase() === q.toLowerCase()) ? 0 : 1));
  out.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || exact(a) - exact(b) || String(a.sr).localeCompare(String(b.sr), 'de', { numeric: true }) || a.id.localeCompare(b.id));
  return out;
}
