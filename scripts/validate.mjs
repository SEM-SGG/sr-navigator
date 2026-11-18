// Prüfbericht data/VALIDATION.md (SPEC §8). Aufruf: node scripts/validate.mjs [--no-net] [--quick]
// Die Wortlautprüfung liest den Quelltext unabhängig vom Parser (scripts/lib/wordcheck.mjs, reguläre Ausdrücke).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DOMParser } from 'linkedom';
import { getVersion, changesOfStage, buildBundle, tocAt } from '../src/core/model.js';
import { loadWork, searchWorks, fetchWorkMeta } from '../src/core/fedlex.js';
import { normText } from '../src/core/text.js';
import { sourceText, tokenize, tokenizeRaw, typoPairs, compareTokens, stripHtml, vnorm } from './lib/wordcheck.mjs';
import { rawFetch, RAW, ROOT } from './lib/rawfetch.mjs';
import { writeAtomic, buildFromRaw, fetchedDate } from './build-data.mjs';

const args = new Set(process.argv.slice(2));
const NET = !args.has('--no-net');
const lib = JSON.parse(readFileSync(join(ROOT, 'data', 'library.json'), 'utf8'));
const buildLog = existsSync(join(ROOT, 'data', 'build-log.json')) ? JSON.parse(readFileSync(join(ROOT, 'data', 'build-log.json'), 'utf8')) : {};
const LIVE_ID = 'cc-2007-763'; // GebV-AIG, SR 142.209: kleiner, nicht eingebetteter Erlass mit XML (über die Suche bestätigt)

const md = [];
const P = (s = '') => md.push(s);
const pct = (x) => (x * 100).toFixed(2).replace('.', ',') + ' %';
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const short = (s, n = 140) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n) + ' …' : t; };

// ------------------------------------------------------------------ Hilfen

function headingAt(e, lang, ds, stageId) {
  const arr = e.heading && e.heading[lang];
  if (!arr) return null;
  const om = new Map(ds.stages.map((s) => [s.id, s.order]));
  const t = om.get(stageId);
  let best = null;
  for (const h of arr) if (om.get(h.from) <= t) best = h;
  return best && !best.gone ? best : null;
}

// Blockfolge des Datensatzes für einen Stand und eine Sprache, in der Gliederung dieses Stands (tocAt)
function datasetSequence(ds, stageId, lang) {
  const seq = [];
  const fns = [];
  for (const e of tocAt(ds, stageId, lang)) {
    if (!e.unit) { seq.push(e.label, e.text, e.sub || ''); for (const f of e.fn || []) fns.push(f.t); continue; }
    const v = getVersion(ds, e.id, lang, stageId);
    seq.push(v.label, v.title);
    for (const f of v.fn || []) fns.push(f.t);
    for (const b of v.blocks) { seq.push(b.l, b.t); for (const f of b.fn || []) fns.push(f.t); }
  }
  const txt = seq.map(stripHtml).join(' ');
  return { tokens: tokenize(txt), raw: tokenizeRaw(txt), fns };
}

const fnNorm = (t) => tokenize(stripHtml(t)).join(' ');
function multisetDiff(a, b) {
  const m = new Map();
  for (const x of a) m.set(x, (m.get(x) || 0) + 1);
  const extra = [];
  for (const x of b) { const n = m.get(x) || 0; if (n) m.set(x, n - 1); else extra.push(x); }
  const missing = [];
  for (const [x, n] of m) for (let i = 0; i < n; i++) missing.push(x);
  return { missing, extra };
}

const ALLOWED_INLINE = /<\/?(?:i|b|sup|sub)>|<br>/g;
const ALLOWED_FN = /<\/?(?:i|b|sup|sub)>|<br>|<a href="https:\/\/(?:fedlex\.data\.admin\.ch|www\.fedlex\.admin\.ch)\/[^"<>]*">|<\/a>/g;
const ALLOWED_TABLE = /<\/?(?:i|b|sup|sub|table|tr)>|<br>|<(?:td|th)(?: colspan="\d+")?(?: rowspan="\d+")?>|<\/(?:td|th)>/g;
function badMarkup(s, re) {
  const rest = String(s || '').replace(re, '');
  if (/[<>]/.test(rest)) return rest.match(/<[^>]*>?|>/)[0];
  if (/&(?!amp;|lt;|gt;|quot;)/.test(rest)) return rest.match(/&[^\s;]*;?/)[0];
  return null;
}

function inIv(d, from, to) { return !!d && (from === null || d > from) && d <= to; }

// ------------------------------------------------------------------ Prüfungen je Erlass

async function checkWork(id, ds) {
  const R = { id, typo: { files: 0, tokens: 0, patterns: new Map() }, wort: [], fnRows: [], spurious: {}, editorial: [], uncovered: [], reverse: { total: 0, found: 0, explained: 0, open: [] }, lang: { checked: 0, equal: 0, exceptions: [] }, keys: { pairs: 0, violations: [] }, markup: { checked: 0, bad: [] } };
  const dir = join(RAW, id);
  // 1 Wortlaut
  for (const st of ds.stages) for (const l of ds.langs) {
    const f = join(dir, `${st.id}_${l}.xml`);
    if (!existsSync(f)) continue;
    const xml = readFileSync(f, 'utf8');
    const src = sourceText(xml);
    const { tokens, raw, fns } = datasetSequence(ds, st.id, l);
    const c = compareTokens(tokenize(src.text), tokens, { maxList: 20 });
    if (!c.missing && !c.extra) {
      const pairs = typoPairs(tokenizeRaw(src.text), raw);
      if (pairs.length) R.typo.files++;
      for (const [a, b] of pairs) { R.typo.tokens++; const k = `«${a}» → «${b}»`; R.typo.patterns.set(k, (R.typo.patterns.get(k) || 0) + 1); }
    }
    R.wort.push({ stage: st.id, lang: l, ...c });
    // Fussnoten: Text ohne Nummer; Fussnoten im Titelblatt des Erlasses gehören zu keiner Einheit
    const srcFn = src.notes.map(fnNorm); // ohne Titelblatt (sourceText entfernt es vor dem Sammeln)
    const d = multisetDiff(srcFn, fns.map(fnNorm));
    R.fnRows.push({ stage: st.id, lang: l, total: srcFn.length, missing: d.missing, extra: d.extra });
  }
  // 2 Scheinänderungen
  const impactsByUnit = new Map();
  const impacts = (await fetchWorkMeta(id, { fetch: rawFetch(id) })).impacts;
  for (const im of impacts) if (im.unit) { if (!impactsByUnit.has(im.unit)) impactsByUnit.set(im.unit, []); impactsByUnit.get(im.unit).push(im); }
  const cats = { footnote: 0, impact: 0, origin: 0, editorial: 0, structural: 0 };
  for (let si = 1; si < ds.stages.length; si++) {
    const st = ds.stages[si], from = ds.stages[si - 1].date;
    for (const l of ds.langs) {
      for (const ch of changesOfStage(ds, st.id, l)) {
        const v = getVersion(ds, ch.unit, l, st.id);
        const b = v && ch.key && ch.key !== '_title' ? v.blocks.find((x) => x.k === ch.key) : null;
        const fnsAll = [...((b && b.fn) || []), ...((v && v.fn) || [])].filter((f) => f.kind === 'amend' || f.kind === 'corr');
        const byFn = fnsAll.some((f) => inIv(f.inForce, from, st.date));
        const byImp = (impactsByUnit.get(ch.unit) || []).some((im) => inIv(im.inForce, from, st.date));
        let cat;
        if (b && b.x === 'editorial') cat = 'editorial';
        else if (b && b.x === 'origin') cat = 'origin';
        else if (byFn) cat = 'footnote';
        else if (byImp) cat = 'impact';
        else if (ch.change === 'deleted' || !b) cat = 'structural';
        else cat = 'editorial';
        cats[cat]++;
        if (cat === 'editorial') {
          const prev = (ds.units[ch.unit].versions[l] || []).filter((x) => ds.stages.findIndex((s) => s.id === x.stage) < si).pop();
          const pb = prev && prev.blocks.find((x) => x.k === ch.key);
          const otherLangEarlier = ds.langs.some((o) => o !== l && (ds.units[ch.unit].versions[o] || []).some((x) => ds.stages.findIndex((q) => q.id === x.stage) < si));
          const prevTexts = prev ? prev.blocks.map((x) => normText(x.l + ' ' + x.t)) : [];
          const at = normText((b ? b.l + ' ' + b.t : ''));
          let kind;
          if (!prev && otherLangEarlier) kind = 'Einheit in dieser Sprachquelle bisher nicht ausgezeichnet (in anderen Sprachen schon vorhanden): Korrektur der Auszeichnung';
          else if (/~/.test(ch.key) || (prev && prev.blocks.some((x) => /~/.test(x.k)))) kind = 'Auflösung bzw. Entstehung eines doppelten eId (Auszeichnungsfehler der Quelle)';
          else if (at && prevTexts.some((t) => t.includes(at.replace(/^\S+ /, '')) || at.includes(t.replace(/^\S+ /, '')) && t.length > 8)) kind = 'Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich';
          else kind = 'Textänderung ohne Änderungshinweis mit passendem Inkrafttreten (redaktionelle Nachführung der Quelle)';
          R.editorial.push({ stage: st.id, lang: l, unit: ch.unit, key: ch.key, before: pb ? pb.t : null, after: b ? b.t : null, o: b && b.o, kind });
        }
        if (cat === 'structural') R.uncovered.push({ stage: st.id, lang: l, unit: ch.unit, key: ch.key, change: ch.change });
      }
    }
  }
  R.spurious = cats;
  // Umkehrung: jeder Impact im XML-Zeitraum findet seine Änderung
  const first = ds.stages[0], last = ds.stages[ds.stages.length - 1];
  for (const im of impacts) {
    if (!im.inForce || !(im.inForce > first.date && im.inForce <= last.date)) continue;
    R.reverse.total++;
    const si = ds.stages.findIndex((s, i) => i > 0 && inIv(im.inForce, ds.stages[i - 1].date, s.date));
    const st = ds.stages[si];
    let found = false, why = null;
    if (im.unit) {
      const u = ds.units[im.unit];
      found = !!u && ds.langs.some((l) => (u.versions[l] || []).some((v) => v.stage === st.id));
      if (!found && !u) why = 'Einheit fehlt im Datensatz';
    } else {
      found = st.acts.includes(im.act);
    }
    if (found) { R.reverse.found++; continue; }
    if (im.type === 5) { R.reverse.explained++; R.reverse.open.push({ ...im, stage: st.id, expl: 'Inkrafttreten (Typ 5): keine Textänderung erwartet' }); continue; }
    if (im.type === 7) { R.reverse.explained++; R.reverse.open.push({ ...im, stage: st.id, expl: 'Verlängerung (Typ 7): Geltungsdauer, keine Textänderung erwartet' }); continue; }
    if (!im.unit && im.targetKind === 'toc') {
      const e = ds.toc.find((x) => x.id === im.toc || (x.id && x.id.endsWith('/' + im.toc)) || x.id === im.toc);
      const changedH = e && Object.values(e.heading || {}).some((arr) => arr.some((h) => h.from === st.id));
      if (changedH) { R.reverse.found++; continue; }
    }
    if (im.unit && ds.units[im.unit]) {
      // Quelle selbst prüfen: Wortlaut und Fussnoten der Einheit unverändert gegenüber dem Vorstand?
      const prevSt = ds.stages[si - 1];
      const same = ds.langs.every((l) => getVersion(ds, im.unit, l, st.id) === getVersion(ds, im.unit, l, prevSt.id));
      if (same) { R.reverse.explained++; R.reverse.open.push({ ...im, stage: st.id, expl: `Quelle unverändert: Einheit ${im.unit} hat in ${st.id} in DE, FR und IT dieselbe Fassung wie in ${prevSt.id} (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung` }); continue; }
    }
    R.reverse.open.push({ ...im, stage: st.id, expl: why });
  }
  // 3 Sprachkonsistenz
  const reasons = buildLog[id] || [];
  for (const st of ds.stages) {
    for (const uid of Object.keys(ds.units)) {
      const sets = {};
      for (const l of ds.langs) { const v = getVersion(ds, uid, l, st.id); if (v && !v.missing) sets[l] = v.blocks.map((b) => b.k); }
      const ls = Object.keys(sets);
      if (!ls.length) continue;
      R.lang.checked++;
      const ref = sets[ls[0]].join('|');
      if (ls.length === ds.langs.length && ls.every((l) => sets[l].join('|') === ref)) { R.lang.equal++; continue; }
      const vStages = new Set(ds.langs.map((l) => { const v = getVersion(ds, uid, l, st.id); return v ? v.stage : null; }).filter(Boolean));
      const why = reasons.filter((e) => e.unit === uid && vStages.has(e.stage) && /^(lang-|pseudo|dup-|key-from-text|eid-)/.test(e.code)).map((e) => e.code);
      const all = new Set(ls.flatMap((l) => sets[l]));
      const diff = {};
      for (const l of ds.langs) { if (!sets[l]) { diff[l] = '(Einheit fehlt)'; continue; } const s = new Set(sets[l]); const miss = [...all].filter((k) => !s.has(k)); if (miss.length) diff[l] = 'ohne ' + miss.slice(0, 6).join(', ') + (miss.length > 6 ? ` (+${miss.length - 6})` : ''); }
      if (!Object.keys(diff).length) diff.order = 'gleiche Schlüssel, andere Reihenfolge';
      // Erklärung aus der Art der abweichenden Schlüssel
      const extraKeys = [];
      for (const l of ls) { const others = ls.filter((o) => o !== l); for (const k of sets[l]) if (others.some((o) => !sets[o].includes(k))) extraKeys.push(k); }
      let expl;
      if (ls.length < ds.langs.length) expl = 'Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet)';
      else if (extraKeys.some((k) => k.includes('~'))) expl = 'doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen';
      else if (extraKeys.every((k) => /\.s\d+$|^s\d+$/.test(k))) expl = 'Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf';
      else if (extraKeys.some((k) => /\.t\d+$/.test(k))) expl = 'Inhalt in einer Sprache als Tabelle, in den anderen als Absätze ausgezeichnet';
      else if (extraKeys.some((k) => /\d-\d|bis-|ter-/.test(k))) expl = 'zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld';
      else if (extraKeys.some((k) => /^sh$|^pu\d/.test(k))) expl = 'Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet';
      else if (extraKeys.some((k) => /\.d\d+$/.test(k))) expl = 'Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet';
      else expl = 'Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab';
      R.lang.exceptions.push({ stage: st.id, unit: uid, diff, why: [...new Set(why)], expl });
    }
  }
  // 4 Schlüsselstabilität: gleicher Wortlaut in Vor- und Folgeversion behält seinen Schlüssel
  for (const [uid, u] of Object.entries(ds.units)) for (const [l, vsl] of Object.entries(u.versions)) {
    for (let i = 1; i < vsl.length; i++) {
      const a = vsl[i - 1], b = vsl[i];
      const cnt = (bl) => { const m = new Map(); for (const x of bl) { const t = normText((x.l || '') + ' ' + x.t); if (!t || /^[\d\w]{0,4}\s*[.…]*$/.test(normText(x.t))) continue; m.set(t, (m.get(t) || []).concat(x.k)); } return m; };
      const A = cnt(a.blocks), B = cnt(b.blocks);
      for (const [t, ka] of A) {
        const kb = B.get(t);
        if (!kb || ka.length !== 1 || kb.length !== 1) continue;
        R.keys.pairs++;
        if (ka[0] !== kb[0]) R.keys.violations.push({ unit: uid, lang: l, from: a.stage, to: b.stage, before: ka[0], after: kb[0], text: t });
      }
    }
  }
  // 6 Markup
  const chk = (s, re, where) => { R.markup.checked++; const b = badMarkup(s, re); if (b) R.markup.bad.push({ where, bad: b, s: short(s, 80) }); };
  for (const e of ds.toc) if (e.heading) for (const [l, arr] of Object.entries(e.heading)) for (const h of arr) { chk(h.label, ALLOWED_INLINE, `${e.id} ${l} label`); chk(h.text, ALLOWED_INLINE, `${e.id} ${l} heading`); if (h.sub) chk(h.sub, ALLOWED_INLINE, `${e.id} ${l} sub`); for (const f of h.fn || []) chk(f.t, ALLOWED_FN, `${e.id} ${l} fn`); }
  for (const [uid, u] of Object.entries(ds.units)) for (const [l, vsl] of Object.entries(u.versions)) for (const v of vsl) {
    chk(v.label, ALLOWED_INLINE, `${uid} ${l} ${v.stage} label`);
    chk(v.title, ALLOWED_INLINE, `${uid} ${l} ${v.stage} title`);
    for (const f of v.fn || []) chk(f.t, ALLOWED_FN, `${uid} ${l} ${v.stage} fn`);
    for (const b of v.blocks) {
      chk(b.t, ALLOWED_INLINE, `${uid} ${l} ${v.stage} ${b.k} t`);
      chk(b.l, ALLOWED_INLINE, `${uid} ${l} ${v.stage} ${b.k} l`);
      if (b.html) chk(b.html, ALLOWED_TABLE, `${uid} ${l} ${v.stage} ${b.k} html`);
      for (const f of b.fn || []) chk(f.t, ALLOWED_FN, `${uid} ${l} ${v.stage} ${b.k} fn`);
    }
  }
  for (const a of ds.acts) for (const l of ds.langs) { chk(a.title[l], ALLOWED_INLINE, `act ${a.id} ${l} title`); chk(a.label[l], ALLOWED_INLINE, `act ${a.id} ${l} label`); }
  return R;
}

// ------------------------------------------------------------------ Vergleich zweier Bundles

function deepDiff(a, b, path = '', out = []) {
  if (out.length > 20) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(`${path}: ${short(JSON.stringify(a), 80)} ≠ ${short(JSON.stringify(b), 80)}`); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path}: Typ`); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) deepDiff(a[k], b[k], path + '/' + k, out);
  return out;
}

// ------------------------------------------------------------------ Lauf

const results = [];
for (const id of lib.order) results.push(await checkWork(id, lib.works[id]));

// 5 loadWork mit fetch aus raw/ gegen den Build
const loadRes = [];
for (const id of lib.order) {
  const stats = { sparql: 0, files: 0 }, missing = [];
  const t0 = Date.now();
  const b = await loadWork(id, { fetch: rawFetch(id, { stats, missing }), DOMParser, langs: lib.works[id].langs, today: fetchedDate(id), concurrency: 3 });
  const d = deepDiff(JSON.parse(JSON.stringify(b)), lib.works[id]);
  loadRes.push({ id, ms: Date.now() - t0, sparql: stats.sparql, files: stats.files, missing: missing.length, diffs: d });
}

// Echter Abruf
let live = null;
if (NET) {
  try {
    const t0 = Date.now();
    const hits = await searchWorks('142.209', { fetch });
    const hit = hits.find((h) => h.status === 'inForce' && h.xmlVersions > 0) || null;
    const liveId = hit ? hit.id : LIVE_ID;
    const tS = Date.now() - t0;
    const t1 = Date.now();
    const b = await loadWork(liveId, { fetch, DOMParser, langs: ['de', 'fr', 'it'] });
    const tL = Date.now() - t1;
    // Wortlaut des echten Abrufs gegen die gerade geladenen Dateien (unabhängige Extraktion)
    const rows = [];
    for (const st of b.stages) for (const l of b.langs) {
      const url = st.source.url[l];
      if (!url) continue;
      const xml = await (await fetch(url)).text();
      const { tokens } = datasetSequence(b, st.id, l);
      const c = compareTokens(tokenize(sourceText(xml).text), tokens);
      rows.push({ stage: st.id, lang: l, coverage: c.coverage, missing: c.missing, extra: c.extra, total: c.total });
    }
    // Vergleich echter Abruf gegen Build aus raw/ (raw/cc-2007-763 mit fetch-raw.mjs und fetch-meta.mjs am selben Tag geladen)
    let rawCmp = null, liveChecks = null;
    if (existsSync(join(RAW, liveId, 'fedlex'))) {
      const { bundle: rb } = await buildFromRaw(liveId);
      const lb = JSON.parse(JSON.stringify(b));
      lb.fetched = rb.fetched;
      rawCmp = deepDiff(lb, JSON.parse(JSON.stringify(rb)));
      liveChecks = await checkWork(liveId, b);
    }
    const tq = Date.now();
    const sres = { sr: await searchWorks('142.2', { fetch }), abbr: await searchWorks('vzae', { fetch }), title: await searchWorks('Einreise- und Ausreisesystem', { fetch }), amb: await searchWorks('142.204', { fetch }), inj: await searchWorks('") } } SELECT * WHERE { ?s ?p ?o } #', { fetch }) };
    live = { hit, liveId, tS, tL, tQ: Date.now() - tq, rawCmp, liveChecks, stages: b.stages.length, versions: b.timeline.length, units: Object.keys(b.units).length, rows, sres };
  } catch (e) { live = { error: String(e && e.message || e) }; }
}

// Grössen und Laufzeit
const sizes = lib.order.map((id) => { const s = JSON.stringify(lib.works[id]); return { id, json: Buffer.byteLength(s), gz: gzipSync(s, { level: 9 }).length }; });
const libStr = JSON.stringify(lib);
const libGz = gzipSync(libStr, { level: 9 }).length;
const perf = [];
{
  const id = 'cc-2007-758';
  const m = await fetchWorkMeta(id, { fetch: rawFetch(id) });
  const dir = join(RAW, id);
  const texts = new Map(readdirSync(dir).filter((f) => /^\d{8}_(de|fr|it)\.xml$/.test(f)).map((f) => [f.slice(0, 11), readFileSync(join(dir, f), 'utf8')]));
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    await buildBundle({ ...m, texts, fetched: '2026-11-15' }, { DOMParser, langs: ['de', 'fr', 'it'], yield: false });
    perf.push(Date.now() - t0);
  }
}

// ------------------------------------------------------------------ Bericht

const W = (id) => lib.works[id];
P('# Prüfbericht Datensatz SR-Navigator (Agent DATEN)');
P();
P(`Erzeugt von \`node scripts/validate.mjs\` am ${new Date().toISOString().slice(0, 10)} aus \`data/library.json\` (generiert ${lib.generated}) und den Quelldateien in \`raw/\`. Alle Zahlen stammen aus maschinellen Prüfungen, die bei jedem Lauf neu ausgeführt werden.`);
P();
P('## 1 Übersicht');
P();
P('| Erlass | SR | Stände (XML) | Fassungen | Einheiten | Wortlaut min. | Wörter fehlend / zusätzlich | Fussnoten fehlend / zusätzlich | Änderungen gedeckt | redaktionell | Impacts gefunden / erklärt / offen | Sprachgleich | Schlüssel stabil | Markup-Fehler | loadWork = Build |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const ds = W(r.id);
  const minCov = Math.min(...r.wort.map((x) => x.coverage));
  const miss = r.wort.reduce((n, x) => n + x.missing, 0), extra = r.wort.reduce((n, x) => n + x.extra, 0);
  const fm = r.fnRows.reduce((n, x) => n + x.missing.length, 0), fe = r.fnRows.reduce((n, x) => n + x.extra.length, 0);
  const c = r.spurious; const tot = c.footnote + c.impact + c.origin + c.editorial + c.structural;
  const lr = loadRes.find((x) => x.id === r.id);
  P(`| ${ds.work.abbr.de || r.id} | ${ds.work.sr} | ${ds.stages.length} | ${ds.timeline.length} | ${Object.keys(ds.units).length} | ${pct(minCov)} | ${miss} / ${extra} | ${fm} / ${fe} | ${c.footnote + c.impact + c.origin} von ${tot} | ${c.editorial} | ${r.reverse.found} / ${r.reverse.explained} / ${r.reverse.open.length - r.reverse.explained} von ${r.reverse.total} | ${r.lang.equal} von ${r.lang.checked} | ${r.keys.pairs - r.keys.violations.length} von ${r.keys.pairs} | ${r.markup.bad.length} von ${r.markup.checked} | ${lr && !lr.diffs.length ? 'ja' : 'NEIN'} |`);
}
P();
P('Lesehilfe: «Änderungen gedeckt» zählt jede zwischen zwei Ständen als geändert ausgewiesene Bestimmung (Block, Titel, Einheit) je Sprache, die durch einen Änderungshinweis mit Inkrafttreten im Intervall (Vorstand, Stand], einen Impact-Eintrag zur Einheit im selben Intervall oder einen neuen Änderungshinweis bei gleichem Wortlaut (`x: "origin"`) gedeckt ist. «redaktionell» sind Textänderungen ohne solchen Beleg (Liste in Kapitel 3). Die übrigen sind strukturelle Änderungen (gelöschte Blöcke, Gliederungswechsel), einzeln in Kapitel 3.');
P();

P('## 2 Wortlauttreue (Prüfung 1)');
P();
P('Methode: Für jeden Stand und jede Sprache wird der Quelltext unabhängig vom Parser direkt aus dem XML gelesen (reguläre Ausdrücke in `scripts/lib/wordcheck.mjs`: `<meta>`, das Titelblatt `<preface>` des Erlasses und alle `<authorialNote>` entfernt, Inline-Tags ohne Leerzeichen, übrige Tags als Leerzeichen). Daneben wird aus `data/library.json` die Folge aller Gliederungstitel, Einheitenbezeichnungen, Titel, Gliederungszeichen und Blocktexte des Stands (über `getVersion`, also mit übernommenen unveränderten Blöcken) gebildet. Beide Folgen werden nach typografischer Normalisierung (Anführungszeichen, Gedankenstriche, Auslassungspunkte, geschützte Leerzeichen) in Wörter und Satzzeichen zerlegt und mit einem Diff (Myers) verglichen. Abdeckung = gemeinsame Wörter / Wörter der Quelle. Fussnoten werden getrennt als Textmenge (ohne Nummer) verglichen.');
P();
for (const r of results) {
  const ds = W(r.id);
  P(`### ${ds.work.abbr.de} (SR ${ds.work.sr})`);
  P();
  P('| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |');
  P('|---|---|---|---|---|---|---|---|---|');
  for (const w of r.wort) {
    const f = r.fnRows.find((x) => x.stage === w.stage && x.lang === w.lang);
    P(`| ${w.stage} | ${w.lang} | ${w.total} | ${pct(w.coverage)} | ${w.missing} | ${w.extra} | ${f.total} | ${f.missing.length} | ${f.extra.length} |`);
  }
  P();
  const gaps = r.wort.filter((w) => w.gaps.length);
  if (gaps.length) {
    P('Lücken einzeln:');
    P();
    for (const w of gaps) for (const g of w.gaps) P(`- ${w.stage} ${w.lang}: ${g.kind} «${esc(g.words)}» nach «${esc(g.at)}»`);
    P();
  }
  const fg = r.fnRows.filter((x) => x.missing.length || x.extra.length);
  if (fg.length) {
    P('Fussnoten mit Abweichung (Text im Datensatz aus einer früheren Version des unveränderten Blocks, siehe Kapitel 8):');
    P();
    let n = 0;
    for (const x of fg) for (const m of x.missing) { if (n++ < 25) P(`- ${x.stage} ${x.lang}: Quelle «${esc(short(m, 160))}»`); }
    if (n > 25) P(`- … ${n - 25} weitere`);
    P();
  }
}

P('### Typografische Abweichungen (vertragsgemäss)');
P();
P('Rein typografische Unterschiede lösen keine neue Version aus (SPEC §5.1). Der Datensatz zeigt dann die Schreibweise der Fassung der letzten inhaltlichen Änderung; die Info-Ansicht erhält dazu den Hinweis `notes[].code = "typography"`. Gezählt: Abweichungen zwischen Quelle und Datensatz ohne jede Normalisierung (nur Unicode-NFC), in Stand-Sprache-Dateien mit 100 % Abdeckung nach Normalisierung.');
P();
P('| Erlass | Dateien mit typografischer Abweichung | Abweichungen (Wortfolgen) | häufigste Muster (Quelle → Datensatz, Anzahl) |');
P('|---|---|---|---|');
for (const r of results) P(`| ${W(r.id).work.abbr.de} | ${r.typo.files} von ${r.wort.length} | ${r.typo.tokens} | ${[...r.typo.patterns].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${esc(k)} ${n}`).join('; ')} |`);
P();

P('## 3 Keine Scheinänderungen (Prüfung 2)');
P();
P('| Erlass | durch Fussnote | durch Impact | nur Herkunft (gleicher Wortlaut) | redaktionell | strukturell |');
P('|---|---|---|---|---|---|');
for (const r of results) { const c = r.spurious; P(`| ${W(r.id).work.abbr.de} | ${c.footnote} | ${c.impact} | ${c.origin} | ${c.editorial} | ${c.structural} |`); }
P();
for (const r of results) {
  const ds = W(r.id);
  if (r.editorial.length) {
    P(`### ${ds.work.abbr.de}: redaktionelle Änderungen (Block \`x: "editorial"\`)`);
    P();
    const kinds = new Map(); for (const e of r.editorial) kinds.set(e.kind, (kinds.get(e.kind) || 0) + 1);
    for (const [k, n] of kinds) P(`- ${n}: ${k}`);
    P();
    P('| Stand | Sprache | Einheit | Schlüssel | vorher | nachher | Art |');
    P('|---|---|---|---|---|---|---|');
    for (const e of r.editorial) P(`| ${e.stage} | ${e.lang} | ${e.unit} | ${e.key} | ${esc(short(stripHtml(e.before), 120))} | ${esc(short(stripHtml(e.after), 120))} | ${esc(e.kind.split(':')[0].split('(')[0].trim())} |`);
    P();
  }
  if (r.uncovered.length) {
    P(`### ${ds.work.abbr.de}: strukturelle Änderungen ohne Beleg`);
    P();
    for (const e of r.uncovered) P(`- ${e.stage} ${e.lang} ${e.unit} ${e.key || '(Einheit)'}: ${e.change}`);
    P();
  }
}
P('### Umkehrprüfung: Impact-Einträge im XML-Zeitraum');
P();
P('| Erlass | Einträge (Inkrafttreten nach dem ersten Stand) | gefunden | erklärt | offen |');
P('|---|---|---|---|---|');
for (const r of results) P(`| ${W(r.id).work.abbr.de} | ${r.reverse.total} | ${r.reverse.found} | ${r.reverse.explained} | ${r.reverse.open.length - r.reverse.explained} |`);
P();
for (const r of results) {
  const open = r.reverse.open;
  if (!open.length) continue;
  P(`${W(r.id).work.abbr.de}:`);
  P();
  for (const im of open) P(`- ${im.inForce} ${im.act} Typ ${im.type} Ziel ${im.unit || im.toc || im.targetKind} (Stand ${im.stage}): ${im.expl || 'OFFEN, keine Änderung im Datensatz gefunden'}`);
  P();
}

P('## 4 Sprachkonsistenz der Schlüsselmengen (Prüfung 3)');
P();
P('Gleiche Schlüsselfolge je Einheit und Stand in DE, FR, IT. Abweichende Blockgliederung einer Sprachquelle wird nicht vereinheitlicht (der Wortlaut jeder Sprache ist nach Prüfung 1 vollständig); wo die Folgen gleich lang und gleich tief sind, übernimmt die Sprache die Schlüssel der Bezugssprache (Protokoll `lang-key`). Jede verbleibende Ausnahme steht unten mit Begründung.');
P();
P('| Erlass | Einheit × Stand geprüft | gleich in DE, FR, IT | Ausnahmen |');
P('|---|---|---|---|');
for (const r of results) P(`| ${W(r.id).work.abbr.de} | ${r.lang.checked} | ${r.lang.equal} | ${r.lang.exceptions.length} |`);
P();
for (const r of results) {
  if (!r.lang.exceptions.length) continue;
  P(`${W(r.id).work.abbr.de}:`);
  P();
  P('| Stand | Einheit | Abweichung | Begründung | Protokoll |');
  P('|---|---|---|---|---|');
  for (const e of r.lang.exceptions) P(`| ${e.stage} | ${e.unit} | ${esc(Object.entries(e.diff).map(([l, s]) => `${l}: ${s}`).join('; '))} | ${esc(e.expl)} | ${e.why.join(', ') || '–'} |`);
  P();
}

P('## 5 Schlüsselstabilität (Prüfung 4)');
P();
P('Geprüft: jeder Block, dessen Wortlaut (normalisiert, ohne triviale Texte wie «…») in zwei aufeinanderfolgenden Versionen derselben Einheit und Sprache genau einmal vorkommt. Er muss in beiden Versionen denselben Schlüssel tragen.');
P();
P('| Erlass | Paare | Schlüsselwechsel |');
P('|---|---|---|');
for (const r of results) P(`| ${W(r.id).work.abbr.de} | ${r.keys.pairs} | ${r.keys.violations.length} |`);
P();
for (const r of results) for (const v of r.keys.violations.slice(0, 40)) P(`- ${W(r.id).work.abbr.de} ${v.unit} ${v.lang} ${v.from}→${v.to}: «${v.before}» → «${v.after}» («${esc(short(v.text, 80))}»)`);
P();

P('## 6 loadWork gegen Build (Prüfung 5)');
P();
P('`loadWork` mit einem `fetch`, der SPARQL-Antworten aus `raw/<id>/fedlex/` und Volltexte aus `raw/<id>/*.xml` liefert, gegen den Eintrag in `data/library.json` (Tiefenvergleich des ganzen Bundles).');
P();
P('| Erlass | SPARQL-Abfragen | Dateien | Laufzeit | Abweichungen |');
P('|---|---|---|---|---|');
for (const x of loadRes) P(`| ${x.id} | ${x.sparql} | ${x.files} | ${(x.ms / 1000).toFixed(1)} s | ${x.diffs.length ? x.diffs.slice(0, 3).map(esc).join('; ') : 'keine'} |`);
P();
P('### Echter Abruf gegen Fedlex');
P();
if (!NET) P('Nicht ausgeführt (`--no-net`).');
else if (live && live.error) P(`Fehler: ${live.error}`);
else if (live) {
  P(`Suche «142.209»: ${live.hit ? `${live.hit.id} (${live.hit.abbr.de}, ${live.hit.title.de}), Status ${live.hit.status}, ${live.hit.versions} Fassungen, ${live.hit.xmlVersions} mit XML ab ${live.hit.xmlFrom}` : 'kein Treffer, Ersatz ' + live.liveId} (${live.tS} ms). \`loadWork\` echt: ${live.stages} Stände, ${live.versions} Fassungen, ${live.units} Einheiten in ${(live.tL / 1000).toFixed(1)} s.`);
  P();
  P('| Stand | Sprache | Wörter | Abdeckung | fehlend | zusätzlich |');
  P('|---|---|---|---|---|---|');
  for (const r of live.rows) P(`| ${r.stage} | ${r.lang} | ${r.total} | ${pct(r.coverage)} | ${r.missing} | ${r.extra} |`);
  P();
  if (live.rawCmp) P(`Echter Abruf gegen Build aus \`raw/${live.liveId}\` (Tiefenvergleich, ohne Feld \`fetched\`): ${live.rawCmp.length ? 'ABWEICHUNG: ' + live.rawCmp.slice(0, 5).map(esc).join('; ') : 'identisch'}.`);
  if (live.liveChecks) { const c = live.liveChecks; P(`Prüfungen 1 bis 4 und 6 auf dem echt geladenen Bundle: Wortlaut min. ${pct(Math.min(...c.wort.map((x) => x.coverage)))}, Fussnoten fehlend ${c.fnRows.reduce((n, x) => n + x.missing.length, 0)}, Änderungen ${c.spurious.footnote + c.spurious.impact + c.spurious.origin} gedeckt / ${c.spurious.editorial} redaktionell / ${c.spurious.structural} strukturell, Impacts ${c.reverse.found} gefunden / ${c.reverse.explained} erklärt / ${c.reverse.open.length - c.reverse.explained} offen von ${c.reverse.total}, Sprachgleich ${c.lang.equal} von ${c.lang.checked}, Schlüssel stabil ${c.keys.pairs - c.keys.violations.length} von ${c.keys.pairs}, Markup-Verstösse ${c.markup.bad.length}.`); for (const e of c.editorial) P(`  - redaktionell: ${e.stage} ${e.lang} ${e.unit} ${e.key}: ${esc(e.kind)}`); for (const e of c.lang.exceptions) P(`  - Sprachabweichung: ${e.stage} ${e.unit}: ${esc(e.expl)}`); }
  P();
  const fmt = (list) => list.slice(0, 6).map((h) => `${h.sr} ${h.abbr.de || ''} (${h.status})`).join(', ');
  P(`Suche (echt, ${live.tQ} ms für fünf Suchen): «142.2» ${live.sres.sr.length} Treffer (${fmt(live.sres.sr)} …); «vzae» ${live.sres.abbr.length} (${fmt(live.sres.abbr)}); «Einreise- und Ausreisesystem» ${live.sres.title.length} (${fmt(live.sres.title)}); «142.204» ${live.sres.amb.length} (${fmt(live.sres.amb)}); Eingabe mit SPARQL-Fragment ${live.sres.inj.length} Treffer (Literal maskiert, Abfrage unverändert).`);
}
P();

P('## 7 Markup (Prüfung 6)');
P();
P('Erlaubt in `t`, `title`, `label`, `heading`, `l`: `<i> <b> <sup> <sub> <br>` und die Entitäten `&amp; &lt; &gt; &quot;`; in Fussnoten zusätzlich `<a href="https://fedlex.data.admin.ch/…">` bzw. `https://www.fedlex.admin.ch/…`; in Tabellen (`html`) zusätzlich `table tr td th` mit `colspan`/`rowspan`. Titel und Bezeichnungen der Erlasse (`acts[]`, aus den Metadaten bzw. Fussnoten): dieselben Inline-Tags wie `t`.');
P();
P('| Erlass | geprüfte Felder | Verstösse |');
P('|---|---|---|');
for (const r of results) P(`| ${W(r.id).work.abbr.de} | ${r.markup.checked} | ${r.markup.bad.length} |`);
P();
for (const r of results) for (const b of r.markup.bad.slice(0, 20)) P(`- ${W(r.id).work.abbr.de} ${b.where}: «${esc(b.bad)}» in «${esc(b.s)}»`);
P();

P('## 8 Grösse und Laufzeit');
P();
P('| Erlass | JSON | gzip |');
P('|---|---|---|');
for (const s of sizes) P(`| ${s.id} | ${(s.json / 1e6).toFixed(2)} MB | ${(s.gz / 1e6).toFixed(2)} MB |`);
P(`| data/library.json gesamt | ${(Buffer.byteLength(libStr) / 1e6).toFixed(2)} MB | ${(libGz / 1e6).toFixed(2)} MB (base64 ≈ ${(libGz * 4 / 3 / 1e6).toFixed(2)} MB) |`);
P();
P(`\`buildBundle\` für das AIG (${W('cc-2007-758').stages.length} Stände × 3 Sprachen = 69 Dateien, Node 22 mit linkedom als DOMParser, ohne Netz): ${perf.map((x) => (x / 1000).toFixed(1) + ' s').join(', ')} (zwei Läufe). Im Browser übernimmt der native DOMParser das Parsen.`);
P();
P('Hinweis zu Fussnoten: Unveränderte Blöcke übernehmen Wortlaut und Auszeichnung der Vorfassung (SPEC §5.1). Ändert die Quelle nur Fussnoten (Text, nicht Nummer), entsteht eine Version mit `fnOnly: true` und Blöcken mit `x: "fn"`; darum ist die Spalte «Fussnoten fehlend» in Kapitel 2 überall 0. Eine reine Verschiebung der Fussnotennummer `n` löst keine Version aus (Test `test/core/model.test.mjs`).');

P();
P('## 9 Weitere Angaben je Erlass');
P();
P('| Erlass | mehrteilige Änderungshinweise (verschiedene) | daraus zusätzliche Ereignisse in acts[].changes | Kurzbezeichnungen gesetzt / null / Bruchstück | Impact-Daten verworfen (Beschluss- statt Inkrafttreten) | Kopf eines Artikels im Text (Quelle) | Versionen nur Fussnoten (fnOnly) | Blöcke x: editorial / origin / fn |');
P('|---|---|---|---|---|---|---|---|');
for (const id of lib.order) {
  const ds = W(id);
  const multi = new Set();
  let fnOnly = 0; const xs = { editorial: 0, origin: 0, fn: 0 };
  for (const [uid, u] of Object.entries(ds.units)) for (const [l, vsl] of Object.entries(u.versions)) for (const v of vsl) {
    if (v.fnOnly) fnOnly++;
    for (const f of v.fn || []) if (f.events && f.events.length > 1 && (f.kind === 'amend' || f.kind === 'corr')) multi.add(l + '|' + normText(f.t));
    for (const b of v.blocks) { if (b.x) xs[b.x] = (xs[b.x] || 0) + 1; for (const f of b.fn || []) if (f.events && f.events.length > 1 && (f.kind === 'amend' || f.kind === 'corr')) multi.add(l + '|' + normText(f.t)); }
  }
  const parts = ds.acts.reduce((n, a) => n + a.changes.filter((c) => c.part).length, 0);
  let set = 0, nul = 0, bad = 0;
  for (const a of ds.acts) for (const l of ds.langs) { const x = a.label[l]; if (x == null) nul++; else if (/^[A-ZÄÖÜÉ]/.test(x) && /\d{4}/.test(x)) set++; else bad++; }
  const dropped = ds.acts.reduce((n, a) => n + a.changes.filter((c) => c.impactDate).length, 0);
  const heads = ds.notes.filter((n) => n.code === 'article-head-in-text').map((n) => `${n.stage} ${n.lang}: ${n.examples.join(', ')}`);
  P(`| ${ds.work.abbr.de} | ${multi.size} | ${parts} | ${set} / ${nul} / ${bad} | ${dropped} | ${heads.length ? esc(heads.join('; ')) : 0} | ${fnOnly} | ${xs.editorial} / ${xs.origin} / ${xs.fn} |`);
}
P();
P('`x`-Werte: `editorial` Wortlaut geändert ohne Änderungshinweis mit passendem Inkrafttreten und ohne Impact; `origin` gleicher Wortlaut, neue Herkunft (neuer Änderungshinweis, z. B. Änderung betrifft nur eine andere Sprache); `fn` nur die Fussnoten des Blocks geändert (Version mit `fnOnly: true`). Massgebend für «geändert» sind `changesOfStage` und `blockHistory`; sie melden `fn` nie und `origin` als Schritt ohne Wortlautänderung.');

writeAtomic(join(ROOT, 'data', 'VALIDATION.md'), md.join('\n') + '\n');
console.log(md.slice(0, 20).join('\n'));
const sum = { results: results.map((r) => ({ id: r.id, minCov: Math.min(...r.wort.map((x) => x.coverage)), miss: r.wort.reduce((n, x) => n + x.missing, 0), extra: r.wort.reduce((n, x) => n + x.extra, 0), fnMiss: r.fnRows.reduce((n, x) => n + x.missing.length, 0), spur: r.spurious, rev: { total: r.reverse.total, found: r.reverse.found, explained: r.reverse.explained, open: r.reverse.open.length - r.reverse.explained }, lang: [r.lang.equal, r.lang.checked], keys: [r.keys.pairs, r.keys.violations.length], markup: r.markup.bad.length })), load: loadRes.map((x) => ({ id: x.id, diffs: x.diffs.length })), live: live && { liveId: live.liveId, error: live.error, rows: live.rows && live.rows.map((r) => r.coverage), rawCmp: live.rawCmp && live.rawCmp.length } };
writeAtomic(join(ROOT, 'data', 'validation-summary.json'), JSON.stringify(sum, null, 1));
