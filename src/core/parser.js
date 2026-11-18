// SR-Navigator — Parser für Fedlex Akoma Ntoso 3.0 (ESM, isomorph: Browser und Node, keine Node-APIs)
//
// parseFedlex(xmlString, { DOMParser }) -> {
//   kind: 'fedlex', eli, sr, lang, date, generator, names: { de: { title, short }, … },
//   units: [ Unit ], toc: [ TocNode | UnitRef ] (Dokumentreihenfolge), notes: [ { code, unit?, key?, text } ]
// }
// Unit: { id, type: 'preamble'|'article'|'annex'|'final', num, label, title, fn, o, ch, repealed?, blocks: [Block], eid, lid }
// Block: { k, d, l, t, fn?, o?, ch?, ty?, html? }   (o/ch nur gesetzt, wenn ein Änderungshinweis greift; sonst ergänzt das Modell work.base)
//
// Grundsätze: Wortlaut unverändert (nur Leerraum zusammengefasst, Fussnoten aus dem Text gelöst, Auszeichnung auf
// <b> <i> <sup> <sub> <br> reduziert). Schlüssel aus dem eId; fehlt er, aus Gliederungszeichen und Position.
// Doppelte Schlüssel werden nicht geraten, sondern mit «~n» eindeutig gemacht und als Hinweis ausgewiesen.

export const PARSER_VERSION = 1;

const KEEP = { b: 'b', i: 'i', sup: 'sup', sub: 'sub' };
const TOC_TYPES = {
  part: 'part', book: 'part', title: 'title', subtitle: 'title', chapter: 'chapter', subchapter: 'chapter',
  section: 'section', subsection: 'section', division: 'section', subdivision: 'section',
};
const FINAL = new Set(['transitional', 'proviso', 'disposition']);
const LATIN = 'bis|ter|quater|quinquies|sexies|septies|octies|novies|nonies|decies|undecies|duodecies|terdecies|quaterdecies|quinquiesdecies|sexiesdecies|septiesdecies';
const LATIN_RE = new RegExp('^(' + LATIN + ')$');
export const ALLOWED_LINK = /^https:\/\/(fedlex\.data\.admin\.ch|www\.fedlex\.admin\.ch)\//;

// ------------------------------------------------------------------ DOM-Hilfen

const kids = (el) => {
  const r = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) r.push(c);
  return r;
};
const nm = (el) => el.localName || el.nodeName;
const child = (el, name) => { for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && nm(c) === name) return c; return null; };
const attr = (el, a) => (el.getAttribute ? el.getAttribute(a) : null);

export function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

// Leerraum zusammenfassen, leere Auszeichnung entfernen; Text sonst unverändert
export function tidy(html) {
  let s = String(html).replace(/[ \t\r\n\f\v]+/g, ' ');
  let prev;
  do { prev = s; s = s.replace(/<(b|i|sup|sub|a)(?: [^>]*)?>( ?)<\/\1>/g, '$2'); } while (s !== prev);
  s = s.replace(/ {2,}/g, ' ');
  s = s.replace(/^(?: |<br>)+/, '').replace(/(?: |<br>)+$/, '');
  return s;
}
export function plain(html) {
  return String(html).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

// Inline-Inhalt eines Elements als bereinigtes HTML; Fussnoten werden gesammelt, nicht ausgegeben
function inl(el, sink) {
  let out = '';
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3 || c.nodeType === 4) { out += escHtml(c.nodeValue); continue; }
    if (c.nodeType !== 1) continue;
    const n = nm(c);
    if (n === 'authorialNote') { sink.fn.push(c); continue; }
    if (n === 'br') { out += '<br>'; continue; }
    if (n === 'placeholder') { sink.placeholder = (sink.placeholder || 0) + 1; out += ' '; continue; }
    if (n === 'annotationRef' || n === 'meta') continue;
    if (n === 'table' || n === 'blockList' || n === 'item' || n === 'paragraph' || n === 'article') { sink.nested = (sink.nested || 0) + 1; out += ' ' + inl(c, sink) + ' '; continue; }
    if (n === 'p') { out += ' ' + inl(c, sink) + ' '; continue; }
    const tag = KEEP[n];
    const inner = inl(c, sink);
    out += tag ? `<${tag}>${inner}</${tag}>` : inner;
  }
  return out;
}

// Fussnote als HTML mit Links (nur Fedlex)
function fnHtml(el) {
  let out = '';
  for (let c = el.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3 || c.nodeType === 4) { out += escHtml(c.nodeValue); continue; }
    if (c.nodeType !== 1) continue;
    const n = nm(c);
    if (n === 'br') { out += '<br>'; continue; }
    if (n === 'authorialNote') continue;
    if (n === 'p') { out += ' ' + fnHtml(c) + ' '; continue; }
    if (n === 'ref') {
      const url = attr(c, 'fedlex:rs-uri') || attr(c, 'href') || '';
      const inner = fnHtml(c);
      out += ALLOWED_LINK.test(url) ? `<a href="${escAttr(url)}">${inner}</a>` : inner;
      continue;
    }
    const tag = KEEP[n];
    const inner = fnHtml(c);
    out += tag ? `<${tag}>${inner}</${tag}>` : inner;
  }
  return out;
}

// ------------------------------------------------------------------ Änderungshinweise

const MONTHS = [[/^(jan|gen)/, 1], [/^(f[eé]v|feb)/, 2], [/^m[äa]r/, 3], [/^(apr|avr)/, 4], [/^(mai|mag)/, 5],
  [/^(juin|jun|giu)/, 6], [/^(juil|jul|lug)/, 7], [/^(aug|ao[uû]|ago)/, 8], [/^(sep|set)/, 9], [/^(okt|oct|ott)/, 10],
  [/^nov/, 11], [/^(d[eé][zc]|dic)/, 12]];
export function parseMonth(s) {
  const t = String(s).toLowerCase();
  for (const [re, m] of MONTHS) if (re.test(t)) return m;
  return 0;
}
const DATE_RX = '(\\d{1,2})\\s*(?:\\.|er|°|º)?\\s*([A-Za-zÄäÉéÈèÛûÔôÀà]+)\\.?\\s*(\\d{4})';
const INFORCE_RE = new RegExp('(?:in\\s+Kraft\\s+(?:seit|ab|vom|am)|mit\\s+Wirkung\\s+(?:seit|ab|vom|am)|en\\s+vigueur\\s+(?:depuis\\s+le|dès\\s+le|le|du|à\\s+partir\\s+du)|avec\\s+effet\\s+(?:au|dès\\s+le|depuis\\s+le|à\\s+partir\\s+du|le)|in\\s+vigore\\s+(?:dal|il|dall[’\']|da|a\\s+partire\\s+dal)|con\\s+effetto\\s+(?:dal|a\\s+contare\\s+dal|il))\\s*' + DATE_RX, 'i');
export function parseDateText(d, m, y) {
  const mm = parseMonth(m);
  if (!mm) return null;
  return `${y}-${String(mm).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
}
export function parseInForce(text) {
  const m = INFORCE_RE.exec(text);
  return m ? parseDateText(m[1], m[2], m[3]) : null;
}

const ACTIONS = [
  ['repealed', /(aufgehoben|abrog[ée]|abrogat[oaie]|abrogés|abrogées)/i],
  ['inserted', /(eingefügt|introduit|introduite|introdott[oaie]|introdotti)/i],
  ['replaced', /(fassung\s+gemäss|fassung\s+des|fassung\s+der|nouvelle\s+teneur|nuovo\s+testo|testo\s+giusta|nuova\s+versione)/i],
  ['term', /(ausdruck|bezeichnung|nouvelle\s+expression|nouvelle\s+désignation|désignation|nuova\s+espr|nuova\s+espressione|designazione|nuova\s+denominazione)/i],
  ['corrected', /(aggiornat[oaie]\s+dall[ae]\s+correzione|berichtig|rectifi|rettific|correction|correzione|erratum)/i],
  ['replaced', /(bereinigt\s+gemäss|mise\s+à\s+jour\s+par|mis\s+à\s+jour\s+par|aggiornat[oaie])/i],
  ['extended', /(verlängert|prorogé|prorogée|prorogat[oaie]|validità\s+prorogata)/i],
];
const RENUM = /^(ursprünglich|anciennement|originari|originale|ora:|heute:|früher)/i;
const PARTIAL = /(satz|sätze|phrase|per\.|periodo|periodi|teilsatz|halbsatz)/i;

const UNTIL_RE = new RegExp('(?:\\bbis\\s+(?:zum\\s+)?|\\bjusqu[’\']au\\s+|\\bau\\s+|\\bal\\s+|\\bfino\\s+al\\s+)' + DATE_RX, 'gi');
const EVENT_START = /(?:^|[.;]\s+)(?=(?:(?:Zweiter|Dritter|Vierter|Erster|Letzter)\s+Satz\s+|Satz\s+\d+\s+|(?:Première|Deuxième|Troisième|Dernière)\s+phrase\s+|Phrase\s+|(?:Primo|Secondo|Terzo|Ultimo)\s+periodo\s+|Per\.\s+)?(?:Eingefügt|Fassung\s+gemäss|Aufgehoben|Ausdruck\s+gemäss|Berichtigt|Berichtigung|Bereinigt|Mise\s+à\s+jour|Mis\s+à\s+jour|Aggiornat|Introdu|Nouvelle\s+teneur|Abrog|Introdott|Nuovo\s+testo|Rectifi|Rettific|Testo\s+rettificato|La\s+correzione|Correzione|Erratum|Validità\s+prorogata|Geltungsdauer|Ursprünglich|Anciennement|Originari))/g;

function classify(text) {
  let action = null, pos = Infinity;
  for (const [a, re] of ACTIONS) {
    const m = re.exec(text);
    if (m && m.index < pos && m.index < 160) { pos = m.index; action = a; }
  }
  return { action, pos };
}

// Fussnote analysieren: Art, Erlass (immer aus dem href), Inkrafttreten.
// Mehrere Ereignisse in einer Fussnote («Eingefügt durch … . Fassung gemäss …, in Kraft seit …») werden getrennt;
// massgebend ist das Ereignis mit dem jüngsten Inkrafttreten (bei Gleichstand das spätere).
export function analyzeFootnote(el, n) {
  const html = tidy(fnHtml(el));
  // linearer Text mit Lage der Verweise
  let raw = '';
  const refs = [];
  const walk = (e) => {
    for (let c = e.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 || c.nodeType === 4) { raw += c.nodeValue; continue; }
      if (c.nodeType !== 1) continue;
      if (nm(c) === 'ref') {
        const start = raw.length;
        walk(c);
        refs.push({ href: attr(c, 'href') || '', label: raw.slice(start).replace(/\s+/g, ' ').trim(), at: start });
        continue;
      }
      if (nm(c) === 'p') raw += ' ';
      walk(c);
    }
  };
  walk(el);
  const text = raw.replace(/\s+/g, ' ').trim();
  const actOfHref = (h) => { const m = /\/eli\/oc\/(\d{4})\/([^/?#"\s]+)/.exec(h); return m ? `oc/${m[1]}/${m[2]}` : null; };
  const acts = [];
  for (const r of refs) { const a = actOfHref(r.href); if (a && !acts.includes(a)) acts.push(a); }
  const f = { n, t: html };
  const lead = raw.replace(/^\s+/, '');
  if (RENUM.test(lead) && !classify(lead.slice(0, 200)).action) { f.kind = 'renum'; return f; }
  // Ereignisse
  const cuts = [0];
  EVENT_START.lastIndex = 0;
  let m;
  while ((m = EVENT_START.exec(raw))) { const at = m.index + m[0].length; if (at > 0 && at < raw.length && at !== cuts[cuts.length - 1]) cuts.push(at); if (m[0].length === 0) EVENT_START.lastIndex++; }
  cuts.push(raw.length);
  const events = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const seg = raw.slice(cuts[i], cuts[i + 1]);
    const st = seg.replace(/\s+/g, ' ').trim();
    if (!st) continue;
    if (RENUM.test(st)) { events.push({ action: 'renumbered' }); continue; }
    const { action, pos } = classify(st);
    if (!action) continue;
    const segRefs = refs.filter((r) => r.at >= cuts[i] && r.at < cuts[i + 1]);
    const segActs = [];
    for (const r of segRefs) { const a = actOfHref(r.href); if (a && !segActs.includes(a)) segActs.push(a); }
    const ev = { action };
    if (segActs.length) ev.act = segActs[0];
    if (segActs.length > 1) ev.acts = segActs;
    const asRef = segRefs.find((r) => /\/eli\/oc\//.test(r.href));
    if (asRef) ev.as = asRef.label;
    const inForce = parseInForce(st);
    if (inForce) ev.inForce = inForce;
    if (inForce) {
      // letztes «bis …» im Ereignis (Verlängerungen stehen danach)
      let um, u = null;
      UNTIL_RE.lastIndex = 0;
      const tail = st.slice(Math.max(0, st.search(INFORCE_RE)));
      while ((um = UNTIL_RE.exec(tail))) { const d = parseDateText(um[1], um[2], um[3]); if (d) u = d; }
      if (u && u > inForce) ev.until = u;
    }
    if (action !== 'corrected' && action !== 'term' && pos > 0 && PARTIAL.test(st.slice(0, pos))) ev.partial = true;
    const lm = /(?:durch|gemäss|par|selon|dalla|dallo|dagli|dal|dai|dall[’']|giusta|del)\s*(?<=\s|[’'])(.+?)(?:,\s*(?:in\s+Kraft|mit\s+Wirkung|en\s+vigueur|avec\s+effet|in\s+vigore|con\s+effetto)|\s*\((?:AS|RO|RU)\b|$)/i.exec(st.slice(pos));
    if (lm) ev.label = lm[1].trim().replace(/[,;.]$/, '');
    events.push(ev);
  }
  const real = events.filter((e) => e.action !== 'renumbered');
  if (!real.length) {
    if (events.length) { f.kind = 'renum'; return f; }
    if (acts.length || /^(SR|RS|AS|RO|RU|BBl|FF|BS|CS)\b/.test(text)) f.kind = 'ref';
    else f.kind = 'other';
    return f;
  }
  let best = null;
  for (const e of real) if (e.action !== 'extended' && (!best || (e.inForce || '') >= (best.inForce || ''))) best = e;
  if (!best) best = real[real.length - 1];
  const withAct = best.act ? best : null;
  if (!withAct) {
    if (best.action === 'corrected') { f.kind = 'corr'; f.action = 'corrected'; if (best.inForce) f.inForce = best.inForce; }
    else if (acts.length || /^(SR|RS|AS|RO|RU|BBl|FF|BS|CS)\b/.test(text)) f.kind = 'ref';
    else f.kind = 'other';
    if (real.length > 1) f.events = real;
    return f;
  }
  f.kind = best.action === 'corrected' ? 'corr' : 'amend';
  for (const k of ['action', 'partial', 'act', 'acts', 'as', 'inForce', 'until', 'label']) if (best[k] !== undefined) f[k] = best[k];
  if (real.length > 1) f.events = real;
  return f;
}

// Massgebender Änderungshinweis: jüngstes Inkrafttreten, bei Gleichstand der nächstgelegene (erste in der Liste)
export function pickOrigin(fnLists) {
  let best = null;
  for (const list of fnLists) {
    for (const f of list || []) {
      if (f.kind !== 'amend' && f.kind !== 'corr') continue;
      if (!f.act) continue;
      if (!best || (f.inForce || '') > (best.inForce || '')) best = f;
    }
  }
  return best;
}
export function chOf(f) {
  if (!f) return null;
  if (f.action === 'corrected' || f.action === 'extended') return 'amended';
  if (f.partial) return 'amended';
  return f.action;
}

// ------------------------------------------------------------------ Schlüssel

function normTokens(rest) {
  const r = rest.replace(/(und|et|e|à|a)(?=\d)/g, '_');
  const toks = r.split('_').filter(Boolean);
  let out = '';
  for (const t of toks) {
    if (out && /^\d/.test(t)) out += '-';
    out += t;
  }
  return out;
}
// eId-Segment -> Schlüsselsegment (SPEC §5.1)
export function segKey(seg) {
  if (seg === 'para') return 'p';
  let m;
  if ((m = /^para_(.+)$/.exec(seg))) return 'p' + normTokens(m[1]);
  if ((m = /^lbl_(.+)$/.exec(seg))) {
    const v = normTokens(m[1]);
    return /^\d/.test(v) ? 'n' + v : v;
  }
  if ((m = /^(?:bull|dash|indent)_u?(\d+)$/.exec(seg))) return 'd' + m[1];
  if ((m = /^lvl_u?(.+)$/.exec(seg))) return 'h' + normTokens(m[1]);
  return seg.replace(/[^A-Za-z0-9_-]/g, '');
}
// Gliederungszeichen -> Schlüsselsegment, wenn kein eId vorhanden ist
function labelKey(label, kind, idx) {
  const l = plain(label).replace(/\s+/g, '');
  if (!l) return null;
  if (/^[–—-]$/.test(l)) return 'd' + idx;
  let m;
  if (kind === 'paragraph' && (m = /^(\d+[a-z]*)\.?$/i.exec(l))) return 'p' + m[1];
  if ((m = /^(\d+[a-z]*)[.)]?$/i.exec(l))) return 'n' + m[1];
  if ((m = /^([a-z]+)[.)]$/i.exec(l))) return m[1];
  return null;
}

// Nummer der Einheit aus der Bezeichnung («Art. 102ebis» -> «102ebis»)
function artNum(label) {
  const m = /^(?:Art(?:icle|icolo)?\.?|Art)\s*(.+)$/i.exec(plain(label));
  return m ? m[1].trim() : plain(label);
}
export function idFromNum(prefix, num) {
  const s = String(num).toLowerCase().replace(/\s*(?:und|et|e|à|a|bis|–|-)\s+(?=\d)/g, '_').replace(/[–-](?=\d)/g, '_').replace(/\s+/g, '');
  const parts = s.split('_').map((p) => {
    const m = /^(\d+)([a-z])?(?:(?<=\d|[a-z])(bis|ter|quater|quinquies|sexies|septies|octies|novies|nonies|decies))?$/.exec(p);
    if (!m) return p;
    return [m[1], m[2], m[3]].filter(Boolean).join('_');
  });
  return prefix + parts.join('_');
}
function tocTypeOfLabel(label) {
  const t = plain(label).toLowerCase();
  if (/(kapitel|chapitre|capitolo)/.test(t)) return 'chapter';
  if (/(abschnitt|section|sezione)/.test(t)) return 'section';
  if (/(titel|titre|titolo)/.test(t)) return 'title';
  if (/(teil|partie|parte)/.test(t)) return 'part';
  return null;
}
const TOC_PREFIX = { part: 'part_', title: 'tit_', chapter: 'chap_', section: 'sec_' };
function tocNumOfLabel(label) {
  const m = /(\d+[a-z]*)/i.exec(plain(label));
  return m ? m[1] : null;
}

// ------------------------------------------------------------------ Parser

export function parseFedlex(xmlString, { DOMParser } = {}) {
  const DP = DOMParser || (typeof globalThis !== 'undefined' ? globalThis.DOMParser : null);
  if (!DP) throw new Error('parseFedlex: DOMParser fehlt');
  const doc = new DP().parseFromString(xmlString, 'text/xml');
  const root = doc.documentElement;
  if (!root || nm(root) === 'parsererror' || (doc.getElementsByTagName && doc.getElementsByTagName('parsererror').length)) throw new Error('parseFedlex: XML nicht lesbar');
  const act = child(root, 'act') || kids(root)[0];
  if (!act) throw new Error('parseFedlex: kein <act>');

  // Fussnotennummern in Dokumentreihenfolge (wie in der Fedlex-Darstellung)
  const fnIndex = new Map();
  const allNotes = doc.getElementsByTagName('authorialNote');
  for (let i = 0; i < allNotes.length; i++) fnIndex.set(allNotes[i], i + 1);

  const res = { kind: 'fedlex', parser: PARSER_VERSION, eli: null, sr: null, lang: null, date: null, generator: null, names: {}, units: [], toc: [], notes: [] };
  readMeta(act, res);
  const ctx = { res, fnIndex, finalCount: 0, unitIds: new Map(), tocIds: new Map() };
  const note = (code, text, extra = {}) => res.notes.push({ code, text, ...extra });
  ctx.note = note;

  const preamble = child(act, 'preamble');
  if (preamble) addUnit(ctx, { id: 'preamble', type: 'preamble', el: preamble, parent: null });
  const body = child(act, 'body');
  if (body) walkStruct(ctx, body, null, null);
  const comps = child(act, 'components');
  if (comps) for (const c of kids(comps)) walkComponent(ctx, c, null);
  return res;
}

function readMeta(act, res) {
  const meta = child(act, 'meta');
  const ident = meta && child(meta, 'identification');
  const work = ident && child(ident, 'FRBRWork');
  const expr = ident && child(ident, 'FRBRExpression');
  const man = ident && child(ident, 'FRBRManifestation');
  if (work) {
    for (const c of kids(work)) {
      const n = nm(c);
      if (n === 'FRBRuri') res.eli = (attr(c, 'value') || '').replace(/\/\d{8}$/, '');
      if (n === 'FRBRnumber') res.sr = (attr(c, 'value') || '').trim() || null;
      if (n === 'FRBRdate' && attr(c, 'name') === 'jolux:dateApplicability') res.date = attr(c, 'date');
      if (n === 'FRBRdate' && attr(c, 'name') === 'jolux:dateDocument') res.dateDocument = attr(c, 'date');
      if (n === 'FRBRdate' && attr(c, 'name') === 'jolux:dateEntryInForce') res.dateEntryInForce = attr(c, 'date');
      if (n === 'FRBRname') {
        const l = attr(c, 'xml:lang') || attr(c, 'lang');
        if (l) res.names[l] = { title: attr(c, 'value') || null, short: attr(c, 'shortForm') || null };
      }
    }
  }
  if (expr) { const l = child(expr, 'FRBRlanguage'); if (l) res.lang = attr(l, 'language'); }
  if (man) { const f = child(man, 'FRBRformat'); if (f) res.generator = attr(f, 'fedlex:generator') || null; }
  if (!res.sr) {
    const pre = child(act, 'preface');
    const dn = pre && pre.getElementsByTagName('docNumber')[0];
    if (dn) res.sr = dn.textContent.trim() || null;
  }
}

// Textteil (Inline-HTML plus Fussnoten) aus einem Element
function textOf(ctx, el) {
  const sink = { fn: [] };
  const html = tidy(inl(el, sink));
  const fns = sink.fn.map((n) => analyzeFootnote(n, ctx.fnIndex.get(n) || 0));
  return { html, fns, placeholder: sink.placeholder || 0, nested: sink.nested || 0 };
}

function tocNodeId(eid) {
  if (!eid) return null;
  const segs = eid.split('/').filter((s) => /^(part|book|tit|title|subtit|chap|subchap|sec|subsec|div)_/.test(s));
  return segs.length ? segs.join('/') : null;
}

function walkStruct(ctx, el, parentId, parentLid) {
  for (const c of kids(el)) {
    const n = nm(c);
    if (TOC_TYPES[n] || (n === 'level' && containsArticle(c))) addToc(ctx, c, TOC_TYPES[n] || null, parentId, parentLid);
    else if (n === 'article') addUnit(ctx, { type: 'article', el: c, parent: parentId });
    else if (FINAL.has(n)) addUnit(ctx, { type: 'final', el: c, parent: parentId });
    else if (n === 'component' || n === 'doc') walkComponent(ctx, c, parentId);
    else if (n === 'num' || n === 'heading' || n === 'subheading' || n === 'meta') continue;
    else if (n === 'content' || n === 'mainBody' || n === 'components') walkStruct(ctx, c, parentId, parentLid);
    else {
      const t = textOf(ctx, c);
      if (plain(t.html)) {
        // Text ausserhalb einer Einheit: als eigene Einheit führen, damit kein Wortlaut verloren geht
        ctx.note('orphan-text', `Text ausserhalb einer Einheit (<${n}>), als Einheit «text_${ctx.res.units.length + 1}» übernommen`);
        addUnit(ctx, { type: 'final', el: c, parent: parentId, orphan: true });
      }
    }
  }
}
function containsArticle(el) {
  for (const c of kids(el)) { const n = nm(c); if (n === 'article' || TOC_TYPES[n] || FINAL.has(n)) return true; if (n === 'content' && containsArticle(c)) return true; }
  return false;
}

function addToc(ctx, el, type, parentId, parentLid, header) {
  const numEl = header ? header.num : child(el, 'num');
  const headEl = header ? header.heading : child(el, 'heading');
  const subEl = header ? null : child(el, 'subheading');
  const num = numEl ? textOf(ctx, numEl) : { html: '', fns: [] };
  const head = headEl ? textOf(ctx, headEl) : { html: '', fns: [] };
  const sub = subEl ? textOf(ctx, subEl) : null;
  const t = type || tocTypeOfLabel(num.html) || 'section';
  const n = tocNumOfLabel(num.html);
  const eid = header ? null : attr(el, 'eId');
  const lid = (parentLid ? parentLid + '/' : '') + (TOC_PREFIX[t] || 'sec_') + (n ? idFromNum('', n) : 'u' + (ctx.res.toc.length + 1));
  let id = tocNodeId(eid);
  if (eid && id !== eid) ctx.note('eid-prefix', `Gliederungs-eId «${eid}» mit fremdem Präfix; verwendet «${id || lid}»`);
  const node = { id: id || null, lid, type: t, parent: parentId, num: n, label: num.html, heading: head.html };
  if (sub && sub.html) node.sub = sub.html;
  const fns = [...num.fns, ...head.fns, ...(sub ? sub.fns : [])];
  if (fns.length) node.fn = fns;
  if (header) node.pseudo = true;
  ctx.res.toc.push(node);
  if (!header) walkStruct(ctx, el, node.id || node.lid, lid);
  return node;
}

function walkComponent(ctx, el, parentId) {
  const n = nm(el);
  if (n === 'component') { for (const c of kids(el)) walkComponent(ctx, c, parentId); return; }
  if (n !== 'doc') return;
  const preface = child(el, 'preface');
  const container = preface && child(preface, 'container');
  let numEl = null, headEl = null;
  if (container) for (const b of kids(container)) {
    if (attr(b, 'name') === 'num') numEl = b;
    else if (attr(b, 'name') === 'heading') headEl = b;
  }
  const label = numEl ? plain(textOf(ctx, numEl).html) : '';
  const mainBody = child(el, 'mainBody');
  if (/^(anhang|annexe|allegato|anh\.|all\.|annex|anhänge|annexes|allegati|beilage|appendice)\b/i.test(label) || !label) {
    addUnit(ctx, { type: 'annex', el, parent: null, numEl, headEl, body: mainBody });
  } else {
    // Fehlerhaft ausgezeichnete Quelle: Kapitel- oder Abschnittskopf als Anhang (z. B. AsylG IT 2021–2023)
    const type = tocTypeOfLabel(label);
    ctx.note('pseudo-annex', `Kopf «${label}» ist in der Quelle als Anhang ausgezeichnet; als Gliederungstitel (${type || 'unbekannt'}) gelesen`);
    const node = addToc(ctx, el, type, parentId, null, { num: numEl, heading: headEl });
    if (mainBody) walkStruct(ctx, mainBody, node.id || node.lid, node.lid);
  }
}

// ------------------------------------------------------------------ Einheiten

function addUnit(ctx, spec) {
  const { type, el } = spec;
  const res = ctx.res;
  const unit = { id: null, type, num: null, label: '', title: '', blocks: [] };
  const unitFns = []; // Fussnoten an Nummer bzw. Kopf der Einheit (gelten für die ganze Einheit, wenn an der Nummer)
  let numFns = [], headFns = [];
  const eid = el && attr(el, 'eId');
  unit.eid = eid || null;
  let contentNodes = [];
  if (type === 'preamble') {
    unit.id = 'preamble';
    contentNodes = kids(el);
    unit.label = '';
  } else if (type === 'article') {
    const numEl = child(el, 'num'), headEl = child(el, 'heading');
    const nt = numEl ? textOf(ctx, numEl) : { html: '', fns: [] };
    const ht = headEl ? textOf(ctx, headEl) : { html: '', fns: [] };
    unit.label = nt.html; unit.title = ht.html; numFns = nt.fns; headFns = ht.fns;
    unit.num = artNum(nt.html);
    const lid = idFromNum('art_', unit.num);
    const seg = eid ? eid.split('/').pop() : null;
    unit.lid = lid;
    if (seg && /^art_/.test(seg)) {
      unit.id = seg;
      if (eid !== seg) ctx.note('eid-prefix', `Artikel-eId «${eid}» mit fremdem Präfix; verwendet «${seg}»`, { unit: seg });
      if (seg !== lid) unit.lidMismatch = true;
    } else {
      unit.id = lid;
      ctx.note('eid-missing', `Artikel ohne verwendbaren eId («${eid || ''}»); Id aus der Bezeichnung «${plain(nt.html)}»`, { unit: lid });
    }
    contentNodes = kids(el).filter((c) => nm(c) !== 'num' && nm(c) !== 'heading');
  } else if (type === 'final') {
    ctx.finalCount++;
    const headEl = child(el, 'heading');
    const ht = headEl ? textOf(ctx, headEl) : { html: '', fns: [] };
    unit.title = ht.html; headFns = ht.fns;
    const numEl = child(el, 'num');
    if (numEl) { const nt = textOf(ctx, numEl); unit.label = nt.html; numFns = nt.fns; }
    const ord = 'disp_u' + ctx.finalCount;
    const seg = eid ? eid.split('/').pop() : null;
    unit.id = spec.orphan ? 'text_' + (res.units.length + 1) : ord;
    unit.lid = ord;
    if (seg && seg !== ord) ctx.note('eid-final', `Schluss-/Übergangsbestimmung mit eId «${eid}»; Id nach Reihenfolge «${ord}»`, { unit: ord });
    contentNodes = spec.orphan ? [el] : kids(el).filter((c) => nm(c) !== 'num' && nm(c) !== 'heading');
  } else if (type === 'annex') {
    const nt = spec.numEl ? textOf(ctx, spec.numEl) : { html: '', fns: [] };
    const ht = spec.headEl ? textOf(ctx, spec.headEl) : { html: '', fns: [] };
    unit.label = nt.html; unit.title = ht.html; numFns = nt.fns; headFns = ht.fns;
    const m = /(\d+[a-z]*)/i.exec(plain(nt.html));
    unit.num = m ? m[1] : null;
    // Kontrolle: eId der Unterelemente
    const body = spec.body;
    let eidAnnex = null;
    if (body) {
      const any = body.getElementsByTagName ? [...body.getElementsByTagName('*')].find((x) => attr(x, 'eId')) : null;
      if (any) { const mm = /(?:^|\/)(annex_[^/]+)\//.exec(attr(any, 'eId') + '/'); eidAnnex = mm ? mm[1] : null; }
    }
    const lid = unit.num ? idFromNum('annex_', unit.num) : (eidAnnex || 'annex_' + (res.units.filter((u) => u.type === 'annex').length + 1));
    unit.id = lid; unit.lid = lid; unit.eid = eidAnnex;
    if (eidAnnex && eidAnnex !== lid) ctx.note('eid-annex', `Anhang «${plain(nt.html)}» mit eId-Präfix «${eidAnnex}»; verwendet «${lid}»`, { unit: lid });
    contentNodes = body ? kids(body) : [];
  }
  // Doppelte Einheit in derselben Datei: eindeutig machen und melden
  if (ctx.unitIds.has(unit.id)) {
    const n = ctx.unitIds.get(unit.id) + 1;
    ctx.unitIds.set(unit.id, n);
    ctx.note('dup-unit', `Einheit «${unit.id}» kommt mehrfach vor; Vorkommen ${n} als «${unit.id}~${n}»`, { unit: unit.id });
    unit.id = unit.id + '~' + n;
  } else ctx.unitIds.set(unit.id, 1);

  unitFns.push(...numFns, ...headFns);
  if (unitFns.length) unit.fn = unitFns;
  // Herkunft des Titels: Kopf vor Nummer; Herkunft der ganzen Einheit: Nummer
  const titleO = pickOrigin([headFns, numFns]);
  if (titleO) { unit.o = titleO.act; unit.ch = chOf(titleO); }

  const B = new BlockBuilder(ctx, unit);
  const rootScope = numFns; // Fussnoten an der Nummer gelten für alle Blöcke
  B.flow(contentNodes, B.root(rootScope));
  unit.blocks = B.finish();
  // Kopf eines anderen Artikels im Text (Auszeichnungsfehler der Quelle, z. B. VEV DE 2022: Art. 34e in Art. 34d)
  for (const b of unit.blocks) {
    const m = /^<b>(?:<[^>]+>)*Art\.?\s*(?:<[^>]+>)*\s*\d+/.exec(b.t || '');
    if (m) ctx.note('article-head-in-text', `${unit.id} ${b.k}: Text beginnt mit dem Kopf eines Artikels («${plain(b.t).slice(0, 40)}»); Quelle vermutlich fehlerhaft ausgezeichnet, Wortlaut unverändert`, { unit: unit.id, key: b.k });
  }

  // Aufgehoben: jüngster Hinweis an Nummer/Kopf ist eine Aufhebung und kein Wortlaut ausser «…»
  const uo = pickOrigin([numFns, headFns]);
  const empty = unit.blocks.every((b) => /^(…|\.\.\.|\.\s?\.\s?\.|)$/.test(plain(b.t || '')) && b.ty !== 'table');
  if (uo && empty && (uo.action === 'repealed' || (uo.until && res.date && uo.until < res.date))) unit.repealed = true;

  res.units.push(unit);
  res.toc.push({ id: unit.id, type: type === 'final' ? 'final' : type, parent: spec.parent || null, unit: true });
  return unit;
}

// Baut die Blockfolge einer Einheit in Dokumentreihenfolge
class BlockBuilder {
  constructor(ctx, unit) { this.ctx = ctx; this.unit = unit; this.blocks = []; this.keys = new Map(); }
  root(scope) { return { k: '', d: -1, root: true, parts: 0, tables: 0, kids: 0, scope: [scope], block: null }; }
  uniq(k) {
    if (!this.keys.has(k)) { this.keys.set(k, 1); return k; }
    const n = this.keys.get(k) + 1;
    this.keys.set(k, n);
    const nk = k + '~' + n;
    this.ctx.note('dup-key', `Schlüssel «${k}» doppelt in ${this.unit.id}; Vorkommen ${n} als «${nk}»`, { unit: this.unit.id, key: nk });
    this.keys.set(nk, 1);
    return nk;
  }
  push(parent, b, ownFns, scopeFns, pos) {
    const k0 = b.k;
    b.k = this.uniq(b.k);
    if (pos || parent.pos || b.k !== k0) b.pos = 1;
    const origin = pickOrigin([ownFns, scopeFns || [], ...parent.scope.slice().reverse()]);
    if (origin) { b.o = origin.act; b.ch = chOf(origin); }
    const fn = [...(scopeFns || []), ...(ownFns || [])];
    if (fn.length) b.fn = fn;
    this.blocks.push(b);
    return b;
  }
  // Textteil an einen Elternknoten: erster Teil ist der Text des Elternblocks, weitere als s2, s3 …
  text(parent, t) {
    if (!plain(t.html) && !t.fns.length) return;
    if (!parent.root && parent.block.t === undefined && parent.kids === 0 && parent.tables === 0) {
      parent.block.t = t.html;
      if (t.fns.length) {
        parent.own.push(...t.fns);
        const origin = pickOrigin([parent.own, ...parent.scope.slice().reverse()]);
        if (origin) { parent.block.o = origin.act; parent.block.ch = chOf(origin); }
        parent.block.fn = [...(parent.block.fn || []), ...t.fns];
      }
      return;
    }
    parent.parts++;
    const idx = parent.root ? parent.parts : parent.parts + 1;
    const k = (parent.k ? parent.k + '.' : '') + 's' + idx;
    this.push(parent, { k, d: Math.max(0, parent.d), l: '', t: t.html }, t.fns, [], true);
  }
  flow(nodes, parent) {
    let acc = null; // lose Inline-Knoten sammeln
    const flushAcc = () => { if (acc) { this.text(parent, this.inlineSeq(acc)); acc = null; } };
    for (const c of nodes) {
      if (c.nodeType === 3 || c.nodeType === 4) { if (c.nodeValue.trim()) (acc = acc || []).push(c); continue; }
      if (c.nodeType !== 1) continue;
      const n = nm(c);
      if (KEEP[n] || n === 'inline' || n === 'span' || n === 'ref' || n === 'authorialNote' || n === 'br') { (acc = acc || []).push(c); continue; }
      flushAcc();
      if (n === 'p' || n === 'listIntroduction' || n === 'subheading' && parent.root === false) { this.text(parent, textOf(this.ctx, c)); continue; }
      if (n === 'subheading') {
        const t = textOf(this.ctx, c);
        if (plain(t.html)) this.push(parent, { k: 'sh', d: 0, l: '', t: t.html, ty: 'heading' }, t.fns, [], true);
        continue;
      }
      if (n === 'blockList') {
        // Mehrere Listen unter demselben Elternteil: ab der zweiten mit Präfix «l2», «l3» (sonst Schlüsselkollision)
        parent.lists = (parent.lists || 0) + 1;
        const save = parent.kp;
        if (parent.lists > 1) parent.kp = (parent.k ? parent.k + '.' : '') + 'l' + parent.lists;
        this.flow([...c.childNodes], parent);
        parent.kp = save;
        continue;
      }
      if (n === 'content' || n === 'mainBody' || n === 'container' || n === 'block' || n === 'intro' || n === 'wrapUp') { this.flow([...c.childNodes], parent); continue; }
      if (n === 'paragraph' || n === 'item') { this.labelled(c, parent, n); continue; }
      if (n === 'level') { this.level(c, parent); continue; }
      if (n === 'table') { this.table(c, parent); continue; }
      if (n === 'num' || n === 'heading') { // unerwartet an dieser Stelle: als Text übernehmen
        this.text(parent, textOf(this.ctx, c));
        continue;
      }
      if (n === 'placeholder' || n === 'meta' || n === 'annotationRef') continue;
      // Unbekanntes Element: Inhalt als Text übernehmen und melden
      this.ctx.note('unknown-element', `Element <${n}> in ${this.unit.id} als Text übernommen`, { unit: this.unit.id });
      this.flow([...c.childNodes], parent);
    }
    flushAcc();
  }
  inlineSeq(nodes) {
    const sink = { fn: [] };
    let html = '';
    for (const c of nodes) {
      if (c.nodeType === 3 || c.nodeType === 4) { html += escHtml(c.nodeValue); continue; }
      const n = nm(c);
      if (n === 'authorialNote') { sink.fn.push(c); continue; }
      if (n === 'br') { html += '<br>'; continue; }
      const tag = KEEP[n];
      const inner = inl(c, sink);
      html += tag ? `<${tag}>${inner}</${tag}>` : inner;
    }
    return { html: tidy(html), fns: sink.fn.map((x) => analyzeFootnote(x, this.ctx.fnIndex.get(x) || 0)) };
  }
  keyFor(el, parent, kind, label, placeholder) {
    const eid = attr(el, 'eId');
    let seg = null;
    const rawSeg = eid ? eid.split('/').pop() : '';
    if (eid) seg = segKey(rawSeg);
    this.lastPos = /_u\d+$/.test(rawSeg) || /^(?:bull|dash|indent)_/.test(rawSeg);
    if (seg === 'tab' || placeholder) {
      // Gliederungszeichen steht in der Quelle nicht in <num>, sondern am Anfang des Texts («d<sup>quater</sup>. …»)
      const first = kids(el).find((c) => nm(c) === 'p' || nm(c) === 'content');
      const txt = first ? plain(tidy(inl(first, { fn: [] }))) : '';
      const m = new RegExp('^([a-z]{1,2}|\\d{1,3}[a-z]?)\\s?(' + LATIN + ')?\\s?[.)]\\s').exec(txt);
      if (m) {
        const lab = m[1] + (m[2] || '');
        seg = /^\\d/.test(lab) ? 'n' + lab : lab;
        this.lastPos = false;
        this.ctx.note('key-from-text', `${this.unit.id}: Gliederungszeichen «${m[0].trim()}» steht im Text, nicht im Nummernfeld; Schlüssel «${seg}» daraus abgeleitet`, { unit: this.unit.id, key: seg });
      }
    }
    if (!seg || seg === 'listintro') {
      seg = labelKey(label, kind, parent.kids + 1);
      if (!seg) seg = (kind === 'paragraph' ? 'p' : 'n') + 'u' + (parent.kids + 1);
      this.lastPos = this.lastPos || /u\d+$/.test(seg) || /^d\d+$/.test(seg);
      this.ctx.note('key-from-label', `${this.unit.id}: Block ohne eId, Schlüssel «${seg}» aus Gliederungszeichen bzw. Position`, { unit: this.unit.id });
    }
    const base = parent.kp || parent.k;
    return (base ? base + '.' : '') + seg;
  }
  labelled(el, parent, kind) {
    const numEl = child(el, 'num');
    const nt = numEl ? textOf(this.ctx, numEl) : { html: '', fns: [] };
    const k = this.keyFor(el, parent, kind, nt.html, nt.placeholder);
    parent.kids++;
    const b = this.push(parent, { k, d: parent.d + 1, l: nt.html }, [], nt.fns, this.lastPos || !!parent.kp);
    const node = { k: b.k, d: b.d, root: false, parts: 0, tables: 0, kids: 0, block: b, own: [], scope: [...parent.scope, nt.fns], pos: b.pos };
    this.flow(kids(el).filter((c) => c !== numEl), node);
    if (b.t === undefined) b.t = '';
  }
  level(el, parent) {
    const numEl = child(el, 'num'), headEl = child(el, 'heading');
    const nt = numEl ? textOf(this.ctx, numEl) : { html: '', fns: [] };
    const ht = headEl ? textOf(this.ctx, headEl) : { html: '', fns: [] };
    const k = this.keyFor(el, parent, 'level', nt.html);
    parent.kids++;
    const b = this.push(parent, { k, d: parent.d + 1, l: nt.html, t: ht.html, ty: 'heading' }, ht.fns, nt.fns, this.lastPos || !!parent.kp);
    const node = { k: b.k, d: b.d, root: false, parts: 0, tables: 0, kids: 0, block: b, own: [...ht.fns], scope: [...parent.scope, nt.fns], pos: b.pos };
    this.flow(kids(el).filter((c) => c !== numEl && c !== headEl), node);
  }
  table(el, parent) {
    parent.tables++;
    const k = (parent.k ? parent.k + '.' : '') + 't' + parent.tables;
    const sink = { fn: [] };
    const texts = [];
    const cellParts = (e, parts) => {
      const ks = kids(e);
      if (!ks.length) { const h = tidy(inl(e, sink)); if (h) parts.push(h); return; }
      for (const x of ks) {
        const n = nm(x);
        if (n === 'blockList' || n === 'content') cellParts(x, parts);
        else if (n === 'item') {
          const num = child(x, 'num');
          let first = true;
          for (const y of kids(x)) {
            if (y === num) continue;
            if (first && nm(y) === 'p') { parts.push(tidy((num ? inl(num, sink) + ' ' : '') + inl(y, sink))); first = false; }
            else if (nm(y) === 'blockList') cellParts(y, parts);
            else parts.push(tidy(inl(y, sink)));
          }
          if (first && num) parts.push(tidy(inl(num, sink)));
        } else parts.push(tidy(inl(x, sink)));
      }
    };
    const cell = (c) => {
      const parts = [];
      cellParts(c, parts);
      const h = parts.filter(Boolean).join('<br>');
      if (plain(h)) texts.push(h);
      return h;
    };
    let html = '<table>';
    for (const tr of el.getElementsByTagName('tr')) {
      html += '<tr>';
      for (const c of kids(tr)) {
        const n = nm(c);
        if (n !== 'td' && n !== 'th') continue;
        const cs = attr(c, 'colspan'), rs = attr(c, 'rowspan');
        html += `<${n}${cs && cs !== '1' ? ` colspan="${escAttr(cs)}"` : ''}${rs && rs !== '1' ? ` rowspan="${escAttr(rs)}"` : ''}>${cell(c)}</${n}>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    const fns = sink.fn.map((x) => analyzeFootnote(x, this.ctx.fnIndex.get(x) || 0));
    this.push(parent, { k, d: Math.max(0, parent.d + 1), l: '', t: texts.join(' '), ty: 'table', html }, fns, [], true);
  }
  finish() {
    return this.blocks.map((b) => {
      const o = { k: b.k, d: b.d, l: b.l || '', t: b.t === undefined ? '' : b.t };
      if (b.ty) o.ty = b.ty;
      if (b.html) o.html = b.html;
      if (b.fn && b.fn.length) o.fn = b.fn;
      if (b.o) { o.o = b.o; o.ch = b.ch; }
      if (b.pos) o.pos = 1; // intern: Schlüssel aus Position (vom Modell entfernt)
      return o;
    });
  }
}
