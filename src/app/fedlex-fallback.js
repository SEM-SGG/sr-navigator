// Ersatz für src/core/fedlex.js und buildBundle (SPEC §6), solange die Kernbibliothek sie nicht liefert.
// Isomorph (Browser und Node): fetch und DOMParser werden übergeben. Ein vereinfachter Parser für Akoma Ntoso;
// massgebend für Wortlauttreue ist die Kernbibliothek des Agents DATEN (Prüfbericht data/VALIDATION.md).
// Dieselbe Logik erzeugt die Test-Fixtures (test/app/fixtures/make-sr-fixtures.mjs).

export const ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';
const PREFIX = 'PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#> ';
const LANG_URI = 'http://publications.europa.eu/resource/authority/language/';
const LANG_CODE = { de: 'DEU', fr: 'FRA', it: 'ITA', en: 'ENG', rm: 'ROH' };
const ALL_LANGS = ['de', 'fr', 'it'];
const ELI = 'https://fedlex.data.admin.ch/eli/';
const STATUS = { 0: 'inForce', 1: 'notInSr', 2: 'obsolete', 3: 'repealed', 4: 'notYetInForce', 5: 'suspended' };

/** "cc-2007-758" ↔ "cc/2007/758" */
export const workPath = (id) => String(id).replace(/^cc-(\d+)-/, 'cc/$1/');
export const workId = (pathOrUri) => String(pathOrUri).replace(ELI, '').replace(/^cc\/(\d+)\//, 'cc-$1-');

function abortError() { const e = new Error('Abgebrochen'); e.name = 'AbortError'; return e; }
const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

/** Literal für SPARQL maskieren (Nutzereingaben dürfen die Abfrage nicht verändern). */
export function sparqlString(s) {
  return '"' + String(s).replace(/[\\"]/g, (c) => '\\' + c).replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/[\u0000-\u001f]/g, '') + '"';
}

export async function sparql(q, { fetch, signal } = {}) {
  const f = fetch || globalThis.fetch;
  let r;
  try {
    r = await f(ENDPOINT + '?query=' + encodeURIComponent(PREFIX + q), { headers: { Accept: 'application/sparql-results+json' }, signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    const err = new Error(`network: ${ENDPOINT}`); err.code = 'network'; err.url = ENDPOINT; throw err;
  }
  if (!r.ok) { const err = new Error(`HTTP ${r.status}: ${ENDPOINT}`); err.code = 'http'; err.status = r.status; err.url = ENDPOINT; throw err; }
  const j = await r.json();
  return j.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

async function getText(url, { fetch, signal }) {
  const f = fetch || globalThis.fetch;
  let lastErr;
  for (let i = 0; i < 3; i++) {
    if (signal && signal.aborted) throw abortError();
    try {
      const r = await f(url, { signal });
      if (!r.ok) { const err = new Error(`HTTP ${r.status}: ${url}`); err.code = 'http'; err.url = url; throw err; }
      return await r.text();
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      lastErr = e;
      if (e.code !== 'http' || i === 2) break;
      await new Promise((s) => setTimeout(s, 600 * (i + 1)));
    }
  }
  const err = new Error(`${lastErr && lastErr.code === 'http' ? lastErr.message : 'network: ' + url}`); err.code = (lastErr && lastErr.code) || 'network'; err.url = url; throw err;
}

// ------------------------------------------------------------------ Suche
const isSr = (q) => /^\d{1,3}(\.\d+)*\.?$/.test(q.trim());

/** Suche nach SR-Nummer (auch Präfix), Kurztitel oder Teilwort des Titels; geltende Erlasse zuerst. */
export async function searchWorks(query, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  let rows;
  if (isSr(q)) {
    const pfx = q.replace(/\.$/, '');
    rows = await sparql(`SELECT DISTINCT ?w ?sr WHERE { ?w a jolux:ConsolidationAbstract ; jolux:classifiedByTaxonomyEntry ?t . ?t skos:notation ?sr . FILTER(STR(?sr) = ${sparqlString(pfx)} || STRSTARTS(STR(?sr), ${sparqlString(pfx + '.')})${/\.\d$/.test(pfx) ? ` || STRSTARTS(STR(?sr), ${sparqlString(pfx)})` : ''}) } LIMIT 80`, opts);
  } else {
    const lc = q.toLowerCase();
    rows = await sparql(`SELECT DISTINCT ?w WHERE { ?w a jolux:ConsolidationAbstract ; jolux:isRealizedBy ?e . { ?e jolux:titleShort ?ab . FILTER(LCASE(STR(?ab)) = ${sparqlString(lc)}) } UNION { ?e jolux:title ?ti . FILTER(CONTAINS(LCASE(STR(?ti)), ${sparqlString(lc)})) } } LIMIT 60`, opts);
  }
  const uris = [...new Set(rows.map((r) => r.w))].filter((u) => /\/eli\/cc\//.test(u)).slice(0, 60);
  if (!uris.length) return [];
  const values = uris.map((u) => `<${u}>`).join(' ');
  const [info, titles, counts, xml] = await Promise.all([
    sparql(`SELECT ?w ?sr ?st ?dif WHERE { VALUES ?w { ${values} } OPTIONAL { ?w jolux:classifiedByTaxonomyEntry ?t . ?t skos:notation ?sr } OPTIONAL { ?w jolux:inForceStatus ?st } OPTIONAL { ?w jolux:dateEntryInForce ?dif } }`, opts),
    sparql(`SELECT ?w ?lang ?ti ?ab WHERE { VALUES ?w { ${values} } ?w jolux:isRealizedBy ?e . ?e jolux:language ?lang ; jolux:title ?ti . OPTIONAL { ?e jolux:titleShort ?ab } }`, opts),
    sparql(`SELECT ?w (COUNT(DISTINCT ?c) AS ?n) WHERE { VALUES ?w { ${values} } ?c jolux:isMemberOf ?w } GROUP BY ?w`, opts),
    sparql(`SELECT ?w (COUNT(DISTINCT ?c) AS ?n) (MIN(?d) AS ?from) WHERE { VALUES ?w { ${values} } ?c jolux:isMemberOf ?w ; jolux:dateApplicability ?d ; jolux:isRealizedBy ?e . ?e jolux:isEmbodiedBy ?m . ?m jolux:userFormat <https://fedlex.data.admin.ch/vocabulary/user-format/xml> } GROUP BY ?w`, opts),
  ]);
  const out = uris.map((u) => {
    const inf = info.filter((r) => r.w === u);
    const sr = (inf.find((r) => r.sr) || {}).sr || null;
    const st = ((inf.find((r) => r.st) || {}).st || '').replace(/^.*\//, '');
    const title = {}, abbr = {};
    for (const l of ALL_LANGS) {
      const t = titles.find((r) => r.w === u && r.lang === LANG_URI + LANG_CODE[l]);
      title[l] = t ? t.ti : null;
      abbr[l] = t && t.ab ? t.ab : null;
    }
    const c = counts.find((r) => r.w === u), x = xml.find((r) => r.w === u);
    return {
      id: workId(u), eli: u, sr, abbr, title, status: STATUS[st] || (st ? 'other' : null),
      dateEntryInForce: (inf.find((r) => r.dif) || {}).dif || null,
      versions: c ? Number(c.n) : 0, xmlVersions: x ? Number(x.n) : 0, xmlFrom: x ? x.from : null,
    };
  });
  const rank = (w) => (w.status === 'inForce' ? 0 : w.status === 'notYetInForce' ? 1 : 2);
  out.sort((a, b) => rank(a) - rank(b) || String(a.sr || '').localeCompare(String(b.sr || ''), 'de', { numeric: true }) || a.id.localeCompare(b.id));
  return out;
}

// ------------------------------------------------------------------ Metadaten eines Erlasses
export async function fetchWorkMeta(id, opts = {}) {
  const uri = ELI + workPath(id);
  const [work, taxonomy, cons, files, impacts, pending] = await Promise.all([
    sparql(`SELECT DISTINCT ?p ?o WHERE { <${uri}> ?p ?o }`, opts),
    sparql(`SELECT DISTINCT ?t ?p ?o WHERE { <${uri}> jolux:classifiedByTaxonomyEntry ?t . ?t ?p ?o . FILTER(?p IN (skos:notation, skos:prefLabel)) }`, opts),
    sparql(`SELECT DISTINCT ?cons ?date ?end WHERE { ?cons jolux:isMemberOf <${uri}> ; jolux:dateApplicability ?date . OPTIONAL { ?cons jolux:dateEndApplicability ?end } } ORDER BY ?date`, opts),
    sparql(`SELECT DISTINCT ?cons ?lang ?fmt ?file WHERE { ?cons jolux:isMemberOf <${uri}> ; jolux:isRealizedBy ?e . ?e jolux:language ?lang ; jolux:isEmbodiedBy ?m . ?m jolux:userFormat ?fmt ; jolux:isExemplifiedBy ?file }`, opts),
    sparql(`SELECT DISTINCT ?imp ?target ?p ?o WHERE { ?imp a jolux:LegalResourceImpact ; jolux:impactToLegalResource ?target ; ?p ?o . { ?target jolux:legalResourceSubdivisionIsPartOf <${uri}> } UNION { FILTER(?target = <${uri}>) } FILTER(?p NOT IN (jolux:impactConsolidatedByExpression, jolux:impactToExpression)) }`, opts),
    sparql(`SELECT DISTINCT ?s ?p ?o WHERE { ?s jolux:foreseenImpactToLegalResource <${uri}> ; ?p ?o }`, opts),
  ]);
  if (!work.length && !cons.length) { const e = new Error('notFound: ' + uri); e.code = 'notFound'; throw e; }
  const versions = cons.map((c) => {
    const v = { uri: c.cons, date: c.date, end: c.end || null, files: {} };
    for (const [l, code] of Object.entries(LANG_CODE)) {
      const f = files.filter((x) => x.cons === c.cons && x.lang === LANG_URI + code);
      const pick = (fmt) => (f.find((x) => x.fmt.endsWith('/user-format/' + fmt)) || {}).file || null;
      if (f.length) v.files[l] = { xml: pick('xml'), pdf: pick('pdf-a'), html: pick('html') };
    }
    return v;
  });
  return { meta: { id, uri, work, taxonomy }, versions, impacts, pending, actsMeta: null };
}

// ------------------------------------------------------------------ Laden
/** Lädt einen Erlass vollständig (Metadaten und alle XML-Dateien in den gewählten Sprachen) und baut das Bundle. */
export async function loadWork(id, { fetch, DOMParser, langs = ALL_LANGS, onProgress, signal, concurrency = 3 } = {}) {
  const opts = { fetch, signal };
  onProgress && onProgress({ done: 0, total: 0, label: 'meta' });
  const meta = await fetchWorkMeta(id, opts);
  const jobs = [];
  for (const v of meta.versions) for (const l of langs) if (v.files[l] && v.files[l].xml) jobs.push({ key: `${v.date.replace(/-/g, '')}_${l}`, url: v.files[l].xml });
  if (!jobs.length) { const e = new Error('noXml: ' + id); e.code = 'noXml'; throw e; }
  const texts = {};
  let done = 0;
  const total = jobs.length;
  onProgress && onProgress({ done, total, label: 'files' });
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      if (signal && signal.aborted) throw abortError();
      const j = queue.shift();
      texts[j.key] = await getText(j.url, opts);
      done++;
      onProgress && onProgress({ done, total, label: 'files', url: j.url });
      await yieldToBrowser();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker));
  if (signal && signal.aborted) throw abortError();
  onProgress && onProgress({ done, total, label: 'build' });
  await yieldToBrowser();
  return buildBundle({ ...meta, texts }, { DOMParser, langs, onProgress, fetched: todayIso() });
}

const todayIso = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** Prüft, ob es neue Fassungen, geänderte Dateien oder neue hängige Vorhaben gibt. */
export async function checkUpdates(bundle, opts = {}) {
  const meta = await fetchWorkMeta(bundle.work.id, opts);
  const known = new Set((bundle.timeline || []).map((x) => x.date));
  const newVersions = meta.versions.filter((v) => !known.has(v.date)).map((v) => ({ date: v.date, files: v.files, xml: Object.values(v.files).some((f) => f && f.xml) }));
  const changedFiles = [];
  for (const s of bundle.stages || []) {
    const v = meta.versions.find((x) => x.date === s.date);
    if (!v) continue;
    for (const l of bundle.langs || ALL_LANGS) {
      const now = v.files[l] && v.files[l].xml;
      const had = s.source && s.source.url && s.source.url[l];
      if (now && had && now !== had) changedFiles.push({ stage: s.id, lang: l, url: now });
    }
  }
  // Fassungen, die inzwischen XML haben (vorher nur PDF)
  for (const x of bundle.timeline || []) {
    if (x.stage) continue;
    const v = meta.versions.find((y) => y.date === x.date);
    if (v && Object.values(v.files).some((f) => f && f.xml)) changedFiles.push({ stage: null, date: x.date, lang: null, url: null, xmlNew: true });
  }
  const pending = pendingFrom(meta.pending);
  const knownP = new Set((bundle.pending || []).map((p) => p.id));
  return { newVersions, changedFiles, pending, newPending: pending.filter((p) => !knownP.has(p.id)), meta };
}

/** Lädt den Erlass neu und meldet, welche Stände hinzukamen oder ersetzt wurden. */
export async function updateWork(bundle, { fetch, DOMParser, onProgress, signal, concurrency } = {}) {
  const next = await loadWork(bundle.work.id, { fetch, DOMParser, onProgress, signal, concurrency, langs: bundle.langs || ALL_LANGS });
  const oldIds = new Set(bundle.stages.map((s) => s.id));
  const added = next.stages.filter((s) => !oldIds.has(s.id)).map((s) => s.id);
  const replaced = next.stages.filter((s) => {
    const o = bundle.stages.find((x) => x.id === s.id);
    return o && JSON.stringify(o.source && o.source.url) !== JSON.stringify(s.source && s.source.url);
  }).map((s) => s.id);
  return { bundle: next, added, replaced };
}

// ------------------------------------------------------------------ Parser (vereinfacht)
const kids = (el) => (el ? [...el.childNodes].filter((n) => n.nodeType === 1) : []);
const nameOf = (el) => (el.localName || el.tagName || '').replace(/^.*:/, '');
const kid = (el, n) => kids(el).find((c) => nameOf(c) === n) || null;
const ACT_RE = /\/eli\/oc\/(\d{4})\/([\w-]+)/;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (h) => h.replace(/\s+/g, ' ').replace(/<(i|b|sup|sub)>\s*<\/\1>/g, '').replace(/\s+(<br>)/g, '$1').trim();
const stripT = (h) => h.replace(/<[^>]+>/g, '');

function inline(el, notes) {
  let out = '';
  for (const n of el.childNodes) {
    if (n.nodeType === 3) { out += esc(n.textContent); continue; }
    if (n.nodeType !== 1) continue;
    const nm = nameOf(n);
    if (nm === 'authorialNote') { notes.push(noteHtml(n)); continue; }
    if (nm === 'num' || nm === 'heading' || nm === 'blockList' || nm === 'subheading') continue;
    const inner = inline(n, notes);
    if (nm === 'i' || nm === 'b' || nm === 'sup' || nm === 'sub') out += inner.trim() ? `<${nm}>${inner}</${nm}>` : inner;
    else if (nm === 'br') out += '<br>';
    else out += inner;
  }
  return out;
}
function noteHtml(n) {
  let out = '';
  const walk = (el) => {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { out += esc(c.textContent); continue; }
      if (c.nodeType !== 1) continue;
      const nm = nameOf(c);
      if (nm === 'ref') {
        const href = c.getAttribute('href') || '';
        const url = /^https:\/\/(fedlex\.data\.admin\.ch|www\.fedlex\.admin\.ch)\//.test(href) ? href : null;
        const txt = esc(c.textContent);
        out += url ? `<a href="${esc(url)}">${txt}</a>` : txt;
      } else if (nm === 'i' || nm === 'b' || nm === 'sup' || nm === 'sub') { out += `<${nm}>`; walk(c); out += `</${nm}>`; }
      else walk(c);
    }
  };
  walk(n);
  return norm(out);
}
const MON = { jan: 1, janv: 1, gen: 1, genn: 1, feb: 2, févr: 2, febbr: 2, märz: 3, mars: 3, mar: 3, apr: 4, avr: 4, april: 4, aprile: 4, mai: 5, mag: 5, maggio: 5, juni: 6, juin: 6, giu: 6, giugno: 6, juli: 7, juil: 7, lug: 7, luglio: 7, aug: 8, août: 8, ago: 8, agosto: 8, sept: 9, sep: 9, sett: 9, okt: 10, oct: 10, ott: 10, nov: 11, dez: 12, déc: 12, dic: 12 };
function parseDate(s) {
  const m = /(\d{1,2})(?:er|°)?\.?\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})/.exec(s || '');
  if (!m) return null;
  const k = m[2].toLowerCase().replace(/\.$/, '');
  const mo = MON[k] || MON[k.slice(0, 3)] || MON[k.slice(0, 4)] || MON[k.slice(0, 5)];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : null;
}
const CH = [
  [/^(Eingefügt|Introduit|Introdott)/i, 'inserted'], [/^(Fassung gemäss|Nouvelle teneur|Nuovo testo|Nuova espressione)/i, 'replaced'],
  [/^(Aufgehoben|Abrogé|Abrogat)/i, 'repealed'], [/^(Ausdruck gemäss|Ausdruck|Expression|Espressione|Termine|Nouvelle expression)/i, 'term'],
  [/^(Berichtigt|Rectifi|Rettific|Die Berichtigung|La rectification|La rettifica)/i, 'amended'],
];
function classifyNote(t) {
  const txt = stripT(t).trim();
  for (const [re, ch] of CH) if (re.test(txt)) {
    const m = ACT_RE.exec(t);
    return { kind: ch === 'amended' && /Berichtig|Rectifi|Rettific/i.test(txt) ? 'corrigendum' : 'amend', ch, act: m ? `oc/${m[1]}/${m[2]}` : null, inForce: parseDate(txt.replace(/^.*?(in Kraft seit|in Kraft ab|mit Wirkung seit|mit Wirkung ab|en vigueur depuis|en vigueur dès le|avec effet au|in vigore dal|con effetto dal)/i, '')) };
  }
  return { kind: 'ref' };
}
function keyPart(seg) {
  let m;
  if ((m = /^para_(\d+)(?:_([a-z]+))?$/.exec(seg))) return 'p' + m[1] + (m[2] || '');
  if (seg === 'para') return 'p';
  if ((m = /^lbl_(\d+)([a-z]*)$/.exec(seg))) return 'n' + m[1] + m[2];
  if ((m = /^lbl_([a-z]+)(?:_([a-z]+))?$/.exec(seg))) return m[1] + (m[2] || '');
  if ((m = /^lbl_u?(\d+)$/.exec(seg))) return 'd' + m[1];
  if ((m = /^lvl_u(\d+)$/.exec(seg))) return 'h' + m[1];
  if ((m = /^lvl_(\d+)$/.exec(seg))) return 'n' + m[1];
  if (/^list_/.test(seg)) return '';
  if ((m = /^lbl_(.+)$/.exec(seg))) return seg.replace(/^lbl_/, '').replace(/\W/g, '').toLowerCase();
  return seg.replace(/\W/g, '');
}
const keyOf = (eid, unitId) => eid.slice(unitId.length + 1).split('/').filter((s) => s !== 'listintro' && s !== 'content').map(keyPart).filter(Boolean).join('.');

function parseUnitBody(root, unitId, ctx) {
  const blocks = [];
  const used = new Set();
  const uniq = (k) => { let x = k || 's1'; let i = 2; while (used.has(x)) x = `${k}.s${i++}`; used.add(x); return x; };
  const push = (k, d, l, html, notes, parentNotes) => {
    const t = norm(html);
    if (!t && !notes.length) return;
    const fn = notes.map((n) => ({ t: n, ...classifyNote(n) })).map((n) => ({ n: String(++ctx.fn), t: n.t, kind: n.kind, act: n.act || undefined, inForce: n.inForce || undefined, ch: n.ch }));
    const own = fn.filter((f) => f.kind !== 'ref' && f.act).sort((a, b) => (b.inForce || '').localeCompare(a.inForce || ''))[0];
    const inh = parentNotes.filter((f) => f.kind !== 'ref' && f.act).sort((a, b) => (b.inForce || '').localeCompare(a.inForce || ''))[0];
    const src = own || inh;
    const b = { k: uniq(k), d, l: l || '', t, o: src ? src.act : ctx.base };
    if (src && src.ch) b.ch = src.ch;
    if (fn.length) b.fn = fn.map((f) => { const x = { n: f.n, t: f.t, kind: f.kind }; if (f.act) x.act = f.act; if (f.inForce) x.inForce = f.inForce; return x; });
    blocks.push(b);
  };
  const numText = (el, notes) => { const n = kid(el, 'num'); if (!n) return ''; const nn = []; const h = norm(stripT(inline(n, nn))); if (notes) notes.push(...nn); return h; };
  const walkList = (bl, parentKey, d, parentNotes) => {
    for (const it of kids(bl)) {
      if (nameOf(it) !== 'item') continue;
      const k = it.getAttribute('eId') ? keyOf(it.getAttribute('eId'), unitId) : parentKey + '.x';
      const notes = [];
      let html = '';
      const sub = [];
      for (const c of kids(it)) {
        const nm = nameOf(c);
        if (nm === 'p') html += ' ' + inline(c, notes);
        else if (nm === 'blockList') sub.push(c);
      }
      push(k, d, numText(it, notes), html, notes, parentNotes);
      for (const s of sub) {
        const si = kid(s, 'listIntroduction');
        if (si) { const n2 = []; const h2 = inline(si, n2); if (norm(h2) && blocks.length) blocks[blocks.length - 1].t = norm(blocks[blocks.length - 1].t + ' ' + h2); }
        walkList(s, k, d + 1, parentNotes);
      }
    }
  };
  const walkContainer = (el, key, d, label, parentNotes) => {
    const content = kid(el, 'content') || el;
    const notes = [];
    let html = '';
    let first = true;
    let part = 1;
    for (const c of kids(content)) {
      const nm = nameOf(c);
      if (nm === 'p') {
        if (first) html += ' ' + inline(c, notes);
        else { part++; const n2 = []; push(`${key}.s${part}`, d + 1, '', inline(c, n2), n2, parentNotes); }
      } else if (nm === 'blockList') {
        const intro = kid(c, 'listIntroduction');
        if (intro) html += ' ' + inline(intro, notes);
        if (first) { push(key, d, label, html, notes, parentNotes); first = false; }
        walkList(c, key, d + 1, parentNotes.concat(notes.map((n) => classifyNote(n))));
      } else if (nm === 'level' || nm === 'paragraph') {
        if (first && (html || label)) { push(key, d, label, html, notes, parentNotes); first = false; }
        walkLevel(c, d + 1, parentNotes);
      } else if (nm === 'table') {
        if (first && (html || label)) { push(key, d, label, html, notes, parentNotes); first = false; }
        blocks.push({ k: uniq(`${key}.t1`), d: d + 1, l: '', t: esc(norm(c.textContent)).slice(0, 2000), ty: 'table', html: tableHtml(c), o: ctx.base });
      }
    }
    if (first) push(key, d, label, html, notes, parentNotes);
  };
  const walkLevel = (lv, d, parentNotes) => {
    const eid = lv.getAttribute('eId');
    const key = eid ? keyOf(eid, unitId) : `s${blocks.length + 1}`;
    const h = kid(lv, 'heading');
    if (h) {
      const notes = [];
      const hh = inline(h, notes);
      if (norm(hh)) { push(key + '.hd', d, numText(lv), hh, notes, parentNotes); blocks[blocks.length - 1].ty = 'heading'; }
      walkContainer(lv, key, d, '', parentNotes);
    } else walkContainer(lv, key, d, numText(lv), parentNotes);
  };
  for (const c of kids(root)) {
    const nm = nameOf(c);
    if (nm === 'paragraph') walkContainer(c, keyOf(c.getAttribute('eId') || unitId + '/para', unitId) || 'p', 0, numText(c), ctx.unitNotes);
    else if (nm === 'level') walkLevel(c, 0, ctx.unitNotes);
    else if (nm === 'p') { const n = []; push(`s${blocks.length + 1}`, 0, '', inline(c, n), n, ctx.unitNotes); }
  }
  return blocks;
}

function tableHtml(tbl) {
  let out = '<table>';
  for (const tr of tbl.getElementsByTagName('tr')) {
    out += '<tr>';
    for (const c of kids(tr)) {
      const nm = nameOf(c) === 'th' ? 'th' : 'td';
      const cs = c.getAttribute('colspan'), rs = c.getAttribute('rowspan');
      const n = [];
      out += `<${nm}${cs ? ` colspan="${Number(cs) || 1}"` : ''}${rs ? ` rowspan="${Number(rs) || 1}"` : ''}>${norm(inline(c, n))}</${nm}>`;
    }
    out += '</tr>';
  }
  return out + '</table>';
}

export function parseXml(xml, lang, base, DOMParser) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML');
  const act = kids(doc.documentElement)[0];
  const names = {};
  for (const n of doc.getElementsByTagName('FRBRname')) { const l = n.getAttribute('xml:lang'); if (l && !names[l]) names[l] = { title: n.getAttribute('value'), short: n.getAttribute('shortForm') }; }
  const units = [];
  const toc = [];
  let fnCount = 0;
  const addUnit = (id, type, num, label, titleEl, body, parent, labelNotes = []) => {
    const ctx = { base, fn: fnCount, unitNotes: [] };
    let title = '';
    const tn = [...labelNotes];
    if (titleEl) title = norm(inline(titleEl, tn));
    ctx.unitNotes = tn.map((x) => classifyNote(x));
    const blocks = parseUnitBody(body, id, ctx);
    fnCount = ctx.fn;
    if (tn.length && blocks[0]) {
      const extra = tn.map((t) => ({ n: String(++fnCount), t, ...classifyNote(t) })).map((f) => { const x = { n: f.n, t: f.t, kind: f.kind }; if (f.act) x.act = f.act; if (f.inForce) x.inForce = f.inForce; return x; });
      blocks[0].fn = [...extra, ...(blocks[0].fn || [])];
    } else if (tn.length && !blocks.length) {
      blocks.push({ k: 'p', d: 0, l: '', t: '', o: base, fn: tn.map((t) => ({ n: String(++fnCount), t, ...classifyNote(t) })).map((f) => { const x = { n: f.n, t: f.t, kind: f.kind }; if (f.act) x.act = f.act; if (f.inForce) x.inForce = f.inForce; return x; }) });
    }
    const repealed = blocks.every((b) => !b.t) && ctx.unitNotes.some((n) => n.ch === 'repealed');
    units.push({ id, type, num, label, title, blocks, repealed });
    toc.push({ id, type, parent, num });
  };
  const walk = (el, parent) => {
    for (const c of kids(el)) {
      const nm = nameOf(c);
      const eid = c.getAttribute('eId');
      if (nm === 'article' && eid) {
        const num = (eid.match(/^art_(.+)$/) || [, eid])[1].replace(/_/g, '');
        const ln = [];
        const numEl = kid(c, 'num');
        const label = numEl ? norm(stripT(inline(numEl, ln))) : '';
        addUnit(eid, 'article', num, label, kid(c, 'heading'), c, parent, ln);
      } else if (nm === 'transitional' && eid) {
        const ln = [];
        const h = kid(c, 'heading') || kid(c, 'num');
        const label = h ? norm(stripT(inline(h, ln))) : eid;
        addUnit(eid, 'final', eid.replace(/\D/g, ''), label.slice(0, 160), null, c, parent, ln);
      } else if (['part', 'title', 'chapter', 'section'].includes(nm) && eid) {
        const n = []; const h = kid(c, 'heading');
        const numEl = kid(c, 'num');
        const heading = { label: numEl ? norm(stripT(inline(numEl, []))).replace(/:$/, '') : '', text: h ? norm(inline(h, n)) : '' };
        toc.push({ id: eid, type: nm, parent, num: eid.replace(/^.*_/, ''), heading });
        walk(c, eid);
      } else if (nm === 'body' || nm === 'mainBody') walk(c, parent);
    }
  };
  walk(act, null);
  const pre = kid(act, 'preamble');
  if (pre) {
    const blocks = [];
    let i = 0;
    for (const p of kids(pre)) {
      const n = [];
      const t = norm(inline(p, n));
      if (t) blocks.push({ k: `s${++i}`, d: 0, l: '', t, o: base, ...(n.length ? { fn: n.map((x) => ({ n: String(++fnCount), t: x, ...classifyNote(x) })).map((f) => { const x = { n: f.n, t: f.t, kind: f.kind }; if (f.act) x.act = f.act; if (f.inForce) x.inForce = f.inForce; return x; }) } : {}) });
    }
    if (blocks.length) { units.unshift({ id: 'preamble', type: 'preamble', num: '', label: lang === 'de' ? 'Ingress' : lang === 'fr' ? 'Préambule' : 'Ingresso', title: '', blocks }); toc.unshift({ id: 'preamble', type: 'preamble', parent: null, num: '' }); }
  }
  for (const comp of doc.getElementsByTagName('doc')) {
    if (comp.getAttribute('name') !== 'annex') continue;
    let id = null;
    const find = (el) => { for (const c of kids(el)) { const e = c.getAttribute('eId'); if (e && /^annex_/.test(e)) { id = e.split('/')[0]; return; } find(c); if (id) return; } };
    find(comp);
    if (!id) continue;
    const pref = kid(comp, 'preface');
    const ln = [];
    const label = pref ? norm(stripT(inline(pref, ln))) : id;
    const body = kid(comp, 'mainBody');
    if (!body) continue;
    addUnit(id, 'annex', id.replace(/^annex_/, ''), label.slice(0, 200), null, body, null, ln);
  }
  return { lang, names, units, toc };
}

// ------------------------------------------------------------------ Bundle
const sig = (v) => JSON.stringify([v.title, v.repealed || false, v.blocks.map((b) => [b.k, b.t, b.l, b.ty || '', b.html || ''])]);

function versionsFrom(meta) {
  if (Array.isArray(meta.versions)) return meta.versions;
  return [];
}

/**
 * Baut ein Bundle (SPEC §5) aus Metadaten und XML-Texten. Rein, ohne Netz.
 * input: { meta:{ id, uri, work:[{p,o}], taxonomy:[{t,p,o}] }, versions:[{date,end,files}], impacts:[{imp,target,p,o}], pending:[{s,p,o}], texts:{ "JJJJMMTT_de": xml } }
 */
export function buildBundle(input, { DOMParser, langs = ALL_LANGS, onProgress, pick, fetched } = {}) {
  const id = input.meta.id;
  const vlist = versionsFrom(input);
  const work = input.meta.work || [];
  const wp = (p) => (work.find((x) => x.p.endsWith('#' + p)) || {}).o || null;
  const srNum = (JSON.stringify(input.meta.taxonomy || []).match(/"(\d{1,3}(?:\.\d+)+|\d{3})"/) || [])[1] || null;
  const m0 = /cc-(\d{4})-(.+)$/.exec(id) || [];
  const base = (wp('basicAct') || `${ELI}oc/${m0[1]}/${m0[2]}`).replace(/^.*\/eli\//, '');
  const texts = input.texts || {};
  const xmlVersions = vlist.filter((v) => langs.some((l) => texts[`${v.date.replace(/-/g, '')}_${l}`]));
  if (!xmlVersions.length) { const e = new Error('noXml: ' + id); e.code = 'noXml'; throw e; }
  const parsed = {};
  let n = 0;
  for (const v of xmlVersions) {
    const sid = v.date.replace(/-/g, '');
    for (const l of langs) {
      const x = texts[`${sid}_${l}`];
      if (x) parsed[`${sid}_${l}`] = parseXml(x, l, base, DOMParser);
    }
    n++;
    onProgress && onProgress({ done: n, total: xmlVersions.length, label: 'parse' });
  }
  const L0 = langs.find((l) => parsed[`${xmlVersions[0].date.replace(/-/g, '')}_${l}`]) || langs[0];
  const first = parsed[`${xmlVersions[0].date.replace(/-/g, '')}_${L0}`];
  const last = parsed[`${xmlVersions[xmlVersions.length - 1].date.replace(/-/g, '')}_${L0}`] || first;
  let unitIds = null;
  if (pick) unitIds = new Set(pick(Object.keys(parsed).filter((k) => k.endsWith('_' + L0)).map((k) => parsed[k])));
  const units = {};
  const stageIds = xmlVersions.map((v) => v.date.replace(/-/g, ''));
  const changedIn = new Map();
  for (const l of langs) {
    const prevSig = new Map();
    for (const sid of stageIds) {
      const p = parsed[`${sid}_${l}`];
      if (!p) continue;
      const seen = new Set();
      for (const u of p.units) {
        if (unitIds && !unitIds.has(u.id)) continue;
        seen.add(u.id);
        const v = { stage: sid, label: u.label, title: u.title, blocks: u.blocks };
        if (u.repealed) v.repealed = true;
        const s = sig(v);
        if (prevSig.get(u.id) === s) continue;
        if (!units[u.id]) units[u.id] = { id: u.id, type: u.type, num: u.num, versions: Object.fromEntries(langs.map((x) => [x, []])) };
        units[u.id].versions[l].push(v);
        if (prevSig.has(u.id)) { if (!changedIn.has(sid)) changedIn.set(sid, new Set()); changedIn.get(sid).add(u.id); }
        prevSig.set(u.id, s);
      }
      for (const [uid] of prevSig) {
        const lastV = units[uid] && units[uid].versions[l].slice(-1)[0];
        if (!seen.has(uid) && lastV && !lastV.repealed && lastV.stage !== sid) {
          units[uid].versions[l].push({ stage: sid, label: lastV.label, title: '', blocks: [], repealed: true });
          prevSig.set(uid, 'gone');
        }
      }
    }
  }
  // Gliederung: Vereinigung in Dokumentreihenfolge
  const tocMap = new Map();
  const tocOrder = [];
  for (const sid of [...stageIds].reverse()) {
    for (const l of langs) {
      const p = parsed[`${sid}_${l}`];
      if (!p) continue;
      for (const e of p.toc) {
        if (!['article', 'annex', 'preamble', 'final'].includes(e.type)) {
          if (!tocMap.has(e.id)) { tocMap.set(e.id, { id: e.id, type: e.type, parent: e.parent, num: e.num, heading: Object.fromEntries(langs.map((x) => [x, []])) }); tocOrder.push(e.id); }
          const h = tocMap.get(e.id).heading[l];
          const ex = h.find((x) => x.text === e.heading.text);
          if (!ex) h.unshift({ from: sid, label: e.heading.label, text: e.heading.text });
          else ex.from = sid;
        } else if (units[e.id] && !tocMap.has(e.id)) {
          const vs = units[e.id].versions[L0] || [];
          const lastV = vs[vs.length - 1];
          tocMap.set(e.id, { id: e.id, type: e.type, parent: e.parent, num: e.num, from: vs[0] ? vs[0].stage : null, to: lastV && lastV.repealed && !lastV.blocks.length && lastV.title === '' && !lastV.label ? lastV.stage : null });
          tocOrder.push(e.id);
        }
      }
    }
  }
  const lastOrder = last.toc.map((e) => e.id);
  const pos = (x) => { const i = lastOrder.indexOf(x); return i < 0 ? 1e6 + tocOrder.indexOf(x) : i; };
  const toc = tocOrder.map((x) => tocMap.get(x)).sort((a, b) => pos(a.id) - pos(b.id));
  for (const e of toc) if (e.heading) for (const l of langs) e.heading[l].sort((a, b) => a.from.localeCompare(b.from));
  const hasUnit = (x) => toc.some((e) => e.parent === x && (units[e.id] || hasUnit(e.id)));
  const tocF = toc.filter((e) => units[e.id] || hasUnit(e.id));

  // Erlasse aus Fussnoten
  const acts = new Map();
  const actOf = (aid) => { if (!acts.has(aid)) acts.set(aid, { id: aid, kind: aid === base ? 'base' : 'amendment', as: {}, title: Object.fromEntries(langs.map((l) => [l, null])), label: {}, dateDocument: null, inForce: [], bbl: [], url: `${ELI}${aid}`, changes: [] }); return acts.get(aid); };
  actOf(base);
  const PFX = { de: 'AS', fr: 'RO', it: 'RU' };
  for (const [key, p] of Object.entries(parsed)) {
    const l = key.slice(-2);
    for (const u of p.units) for (const b of u.blocks) for (const f of b.fn || []) {
      if (!f.act) continue;
      const a = actOf(f.act);
      if (f.kind === 'corrigendum') a.kind = 'corrigendum';
      const re = new RegExp(`<a href="https://fedlex\\.data\\.admin\\.ch/eli/${f.act.replace(/\//g, '\\/')}">([^<]*(?:<[bi]>[^<]*</[bi]>[^<]*)*)</a>`);
      const m = re.exec(f.t);
      if (m && !a.as[l]) a.as[l] = stripT(m[1]).replace(/\s+/g, ' ').trim();
      const plainT = stripT(f.t);
      const lm = /(?:der|des|du|de la|de l’|dell’|della|del)\s+((?:V|BG|BB|VO|O|LF|AF|OCF|L|DCF|AD|D)\s+(?:vom|du|del)\s+\d{1,2}(?:er|°)?\.?\s+\S+\s+\d{4})/.exec(plainT);
      if (lm && !a.label[l]) a.label[l] = lm[1];
      if (f.inForce && !a.inForce.includes(f.inForce)) a.inForce.push(f.inForce);
      if (lm && !a.dateDocument) a.dateDocument = parseDate(lm[1]);
      const bbl = /<a href="(https:\/\/fedlex\.data\.admin\.ch\/eli\/fga\/[^"]+)">(BBl|FF) ([^<]+)<\/a>/.exec(f.t);
      if (bbl && l === 'de' && !a.bbl.some((x) => x.url === bbl[1])) a.bbl.push({ label: `BBl ${bbl[3]}`, url: bbl[1] });
    }
  }
  const baseAct = acts.get(base);
  baseAct.dateDocument = wp('dateDocument') || (first.names.de && parseDate(first.names.de.title)) || null;
  baseAct.inForce = [wp('dateEntryInForce')].filter(Boolean);

  // Impacts → Erlasse je Fassung
  const g = new Map();
  for (const x of input.impacts || []) { if (!g.has(x.imp)) g.set(x.imp, { target: x.target }); g.get(x.imp)[x.p.split('#').pop()] = x.o; }
  const impacts = [...g.values()].filter((x) => x.impactFromLegalResource && x.legalResourceImpactHasDateEntryInForce);
  const actIdOf = (u) => { const m = ACT_RE.exec(u || ''); return m ? `oc/${m[1]}/${m[2]}` : null; };
  const stages = xmlVersions.map((v, i) => {
    const sid = v.date.replace(/-/g, '');
    const prev = i > 0 ? xmlVersions[i - 1].date : null;
    const set = new Set();
    for (const uid of changedIn.get(sid) || []) {
      for (const l of langs) { const vv = units[uid].versions[l].find((x) => x.stage === sid); if (vv) for (const b of vv.blocks) if (b.o && b.o !== base && (b.fn || []).some((f) => f.act === b.o && f.inForce && f.inForce > (prev || '') && f.inForce <= v.date)) set.add(b.o); }
    }
    for (const x of impacts) { const d = x.legalResourceImpactHasDateEntryInForce; if (prev && d > prev && d <= v.date) { const a = actIdOf(x.impactFromLegalResource); if (a) { set.add(a); actOf(a); } } }
    const allIdx = vlist.findIndex((x) => x.date === v.date);
    const prevIdx = prev ? vlist.findIndex((x) => x.date === prev) : allIdx;
    const gap = i === 0 ? 0 : Math.max(0, allIdx - prevIdx - 1);
    const sl = langs.filter((l) => Object.values(units).some((u) => (u.versions[l] || []).some((x) => x.stage === sid)));
    return { id: sid, date: v.date, end: v.end || null, order: i, acts: i === 0 ? [] : [...set].sort(), gap, source: { kind: 'fedlex', url: Object.fromEntries(langs.map((l) => [l, (v.files[l] && v.files[l].xml) || null])) }, langs: i === 0 ? [...langs] : sl };
  });
  const stageSet = new Set(stages.map((s) => s.id));
  const timeline = vlist.map((v) => {
    const sid = v.date.replace(/-/g, '');
    const actsT = [...new Set(impacts.filter((x) => x.legalResourceImpactHasDateEntryInForce === v.date).map((x) => actIdOf(x.impactFromLegalResource)).filter(Boolean))].sort();
    for (const a of actsT) { const aa = actOf(a); if (!aa.inForce.includes(v.date)) aa.inForce.push(v.date); }
    return { date: v.date, end: v.end || null, stage: stageSet.has(sid) ? sid : null, pdf: Object.fromEntries(langs.map((l) => [l, (v.files[l] && v.files[l].pdf) || null])), acts: actsT };
  });
  // Ereignisse vor der XML-Zeit (Fussnoten des ersten Stands)
  const firstDate = stages[0].date;
  for (const u of Object.values(units)) {
    const v0 = (u.versions[L0] || [])[0];
    if (!v0) continue;
    for (const b of v0.blocks) for (const f of b.fn || []) {
      if (!f.act || f.kind === 'ref') continue;
      if (f.inForce && f.inForce < firstDate) {
        const ch = classifyNote(f.t).ch || 'other';
        actOf(f.act).changes.push({ unit: u.id, key: b.k, action: ch, inForce: f.inForce, stage: null, src: ['footnote'] });
      }
    }
  }
  for (const s of stages) for (const uid of changedIn.get(s.id) || []) {
    const vv = (units[uid].versions[L0] || []).find((x) => x.stage === s.id);
    if (vv) for (const b of vv.blocks) if (b.o && s.acts.includes(b.o) && b.ch) actOf(b.o).changes.push({ unit: uid, key: b.k, action: b.ch, inForce: s.date, stage: s.id, src: ['footnote', 'diff'] });
  }
  // Impacts vor der XML-Zeit als Ereignisse (artikelgenaue Ziele)
  for (const x of impacts) {
    const d = x.legalResourceImpactHasDateEntryInForce;
    if (d >= firstDate) continue;
    const a = actIdOf(x.impactFromLegalResource);
    const tm = /\/(art_[\w]+|annex_\w+)$/.exec(x.target || '');
    if (!a || !tm || !units[tm[1]]) continue;
    const type = (x.legalResourceImpactHasType || '').replace(/^.*\//, '');
    const action = type === '2' ? 'repealed' : type === '1' ? 'amended' : type === '6' ? 'amended' : 'other';
    const aa = actOf(a);
    if (!aa.changes.some((c) => c.unit === tm[1] && c.inForce === d)) aa.changes.push({ unit: tm[1], key: null, action, inForce: d, stage: null, src: ['impact'] });
    if (!aa.inForce.includes(d)) aa.inForce.push(d);
  }
  // AS-Fundstelle: aus dem Link der Fussnote; sonst ab 2021 (AS nur online, Nummer = ELI-Nummer) aus der Akt-Id; sonst null
  for (const a of acts.values()) {
    a.inForce.sort();
    const known = langs.map((l) => a.as[l]).find(Boolean);
    for (const l of langs) {
      if (a.as[l]) continue;
      const m = /oc\/(\d{4})\/(\d+)$/.exec(a.id);
      if (known) a.as[l] = known.replace(/^(AS|RO|RU)/, PFX[l] || 'AS');
      else if (m && Number(m[1]) >= 2021) a.as[l] = `${PFX[l] || 'AS'} ${m[1]} ${m[2]}`;
      else a.as[l] = null;
    }
    for (const l of langs) if (!a.label[l]) a.label[l] = null;
  }

  const pending = pendingFrom(input.pending || []);
  const notes = [];
  for (const s of stages) if (s.gap > 0) notes.push({ code: 'gap', stage: s.id, text: { de: `Zwischen der Vorfassung und der Fassung vom ${s.date} liegen ${s.gap} Fassungen ohne XML; der Vergleich überspannt sie.`, fr: `Entre la version précédente et celle du ${s.date}, ${s.gap} versions sans XML; la comparaison les englobe.`, it: `Tra la versione precedente e quella del ${s.date} vi sono ${s.gap} versioni senza XML; il confronto le comprende.` } });
  notes.push({ code: 'footnoteLatest', text: { de: 'Die Fussnote zeigt je Bestimmung nur die jüngste Änderung.', fr: 'La note de bas de page n’indique que la dernière modification de chaque disposition.', it: 'La nota a piè di pagina indica soltanto l’ultima modifica di ogni disposizione.' } });
  notes.push({ code: 'fallbackParser', text: { de: 'Mit dem vereinfachten Ersatzparser der Oberfläche verarbeitet.', fr: 'Traité avec l’analyseur de remplacement simplifié de l’interface.', it: 'Elaborato con l’analizzatore sostitutivo semplificato dell’interfaccia.' } });
  if (unitIds) notes.push({ code: 'fixture', text: { de: `Fixture: Auswahl von ${Object.keys(units).length} Einheiten.`, fr: `Fixture: sélection de ${Object.keys(units).length} unités.`, it: `Fixture: selezione di ${Object.keys(units).length} unità.` } });

  const st = (wp('inForceStatus') || '').replace(/^.*\//, '');
  const nm = (l) => (last.names[l] || first.names[l] || {});
  const shortTitle = (l) => { const t = nm(l).title || ''; const m = /\(([^()]*(?:gesetz|Gesetz|loi|legge|ordonnance|Verordnung|ordinanza)[^()]*)\)/i.exec(t); return m ? m[1].replace(/,\s*[^,]+$/, '').trim() : null; };
  return {
    schema: 2, fetched: fetched || todayIso(),
    work: {
      id, eli: input.meta.uri || `${ELI}${workPath(id)}`, sr: srNum,
      title: Object.fromEntries(ALL_LANGS.map((l) => [l, nm(l).title || null])),
      short: Object.fromEntries(ALL_LANGS.map((l) => [l, shortTitle(l)])),
      abbr: Object.fromEntries(ALL_LANGS.map((l) => [l, nm(l).short || null])),
      dateDocument: baseAct.dateDocument, dateEntryInForce: wp('dateEntryInForce'), status: STATUS[st] || 'inForce', base,
    },
    langs: [...langs], timeline, stages, toc: tocF, units, acts: [...acts.values()].sort((a, b) => a.id.localeCompare(b.id)), pending, notes,
  };
}

export function pendingFrom(rows) {
  const pg = new Map();
  for (const x of rows || []) { if (!pg.has(x.s)) pg.set(x.s, { titles: [] }); const e = pg.get(x.s); const p = x.p.split('#').pop(); if (p === 'eventTitle' || p === 'title') e.titles.push(x.o); else e[p] = x.o; }
  const guess = (s) => (/[äöüÄÖÜ]|\b(und|der|die|das|zur|über|für|des)\b/.test(s) ? 'de' : /\b(della|delle|degli|sulla|nonché|nel|alla|dei|il|per)\b/.test(s) ? 'it' : 'fr');
  return [...pg.entries()].filter(([s, e]) => /\/cons_\d+$/.test(s) && e.titles.length).map(([s, e]) => {
    const title = {};
    for (const tt of e.titles) { const l = guess(tt); if (!title[l]) title[l] = tt; }
    const m = /proj\/(\d{4})\//.exec(s);
    const date = (e.eventStartDate || e.dateStart || e.startDate || '').slice(0, 10) || (m && m[1] < '2100' ? null : null);
    return { id: s.replace(/^.*\/eli\//, ''), type: 'consultation', title, date: date || null, year: m && m[1] < '2100' ? m[1] : null, status: (e.consultationStatus || '').replace(/^.*\//, '') || null, url: s };
  }).sort((a, b) => b.id.localeCompare(a.id, 'de', { numeric: true }));
}
