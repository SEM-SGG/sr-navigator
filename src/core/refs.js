// SR-Navigator — Verweis-Index (ESM, isomorph: Browser und Node, ohne DOM, ohne Netz, deterministisch)
//
// buildRefIndex(bundle, lang, stageId, { works }) erkennt Verweise im Wortlaut der Blöcke eines Stands und löst sie auf
// (SPEC §12.2). Der Wortlaut bleibt unangetastet; Positionen beziehen sich auf plainText(block.t).
// Grundsatz: Ein falscher Verweis ist schlimmer als ein fehlender. Was nicht eindeutig ist, wird `uncertain` mit Grund.

import { getVersion as modelGetVersion, stageAt, tocAt as modelTocAt } from './model.js';

// Schnelle Fassungen der Modell-Abfragen (gleiche Semantik wie model.js, Reihenfolge der Stände zwischengespeichert)
const ORDERS = new WeakMap();
function orderOf(ds) { let m = ORDERS.get(ds); if (!m) { m = new Map(ds.stages.map((x) => [x.id, x.order])); ORDERS.set(ds, m); } return m; }
function getVersion(ds, unitId, lang, stageId) {
  const u = ds.units[unitId];
  if (!u || !u.versions[lang]) return null;
  const om = orderOf(ds);
  const target = om.get(stageId);
  if (target === undefined) return null;
  let best = null;
  for (const v of u.versions[lang]) if (om.get(v.stage) <= target) best = v;
  return best;
}
const TOCS = new WeakMap();
function tocAt(ds, stageId, lang) {
  let per = TOCS.get(ds);
  if (!per) { per = new Map(); TOCS.set(ds, per); }
  const k = stageId + '|' + lang;
  if (!per.has(k)) per.set(k, modelTocAt(ds, stageId, lang));
  return per.get(k);
}
void modelGetVersion;

export const REFS_VERSION = 1;

// ------------------------------------------------------------------ Klartext und Markierung

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const decodeEnt = (m, name) => {
  if (ENT[name] !== undefined) return ENT[name];
  if (name[0] === '#') { const c = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10); if (Number.isFinite(c)) return String.fromCodePoint(c); }
  return m;
};

/** Blocktext ohne Markup. <br> wird zu einem Leerzeichen, Entitäten werden aufgelöst. Grundlage aller Positionen. */
export function plainText(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, decodeEnt);
}

/** Markiert Bereiche [s,e] (Positionen in plainText(html)) im Inline-HTML; Tags bleiben erhalten. */
export function highlight(html, ranges, open = '<mark>', close = '</mark>') {
  const src = String(html || '');
  const rs = (ranges || []).filter((r) => r && r[1] > r[0]).map((r) => [r[0], r[1]]).sort((a, b) => a[0] - b[0]);
  if (!rs.length) return src;
  // Positionen zusammenführen
  const merged = [];
  for (const r of rs) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
  let out = '', pos = 0, i = 0, inMark = false, ri = 0;
  const startAt = (p) => ri < merged.length && merged[ri][0] === p;
  while (i < src.length) {
    if (src[i] === '<') {
      const j = src.indexOf('>', i);
      const tag = src.slice(i, j < 0 ? src.length : j + 1);
      if (/^<br/i.test(tag)) { // <br> zählt als ein Zeichen
        if (!inMark && startAt(pos)) { out += open; inMark = true; }
        out += tag; pos++;
        if (inMark && pos >= merged[ri][1]) { out += close; inMark = false; ri++; }
      } else {
        if (inMark) out += close + tag + open; else out += tag;
      }
      i += tag.length;
      continue;
    }
    let ch = src[i], len = 1;
    if (ch === '&') { const m = /^&(#x?[0-9a-fA-F]+|[a-z]+);/.exec(src.slice(i, i + 12)); if (m) { ch = m[0]; len = m[0].length; } }
    if (!inMark && startAt(pos)) { out += open; inMark = true; }
    out += ch; pos++; i += len;
    if (inMark && pos >= merged[ri][1]) { out += close; inMark = false; ri++; }
  }
  if (inMark) out += close;
  return out;
}

// ------------------------------------------------------------------ Sprachdaten

const LATIN = '(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|nonies|decies|undecies|duodecies|terdecies|quaterdecies|quinquiesdecies|quindecies|sexiesdecies|sexdecies|septiesdecies|septdecies|octiesdecies|octodecies|noviesdecies|novodecies|vicies)';
const LATIN_SP = `(?:${LATIN}|\\s${LATIN}(?![\\p{L}])(?!\\s*\\d))`;
const NUM_SRC = `\\d+(?:[a-z](?=\\s?${LATIN})|[a-z](?![a-z]))?${LATIN_SP}?(?![\\p{L}\\d/])(?!\\.\\d)(?!\\s?%)`;
const NUMDEC_SRC = `\\d+(?:\\.\\d+)*(?:[a-z](?=\\s?${LATIN})|[a-z](?![a-z]))?${LATIN_SP}?(?![\\p{L}\\d/])(?!\\.\\d)(?!\\s?%)`;
const LET_SRC = `([a-z])\\1?${LATIN}?(?![\\p{L}\\d’'])\\)?`;
const ROMAN_SRC = '[IVX]{1,5}(?![\\p{L}\\d])';
const RE_NUM = new RegExp(NUM_SRC, 'uy');
const RE_NUMDEC = new RegExp(NUMDEC_SRC, 'uy');
const RE_LET = new RegExp(LET_SRC, 'uy');
const RE_ROMAN = new RegExp(ROMAN_SRC, 'uy');

// Stichwörter: [Wort, Stufe, Form] — Form: sing (eindeutig Einzahl), plur (Mehrzahl), amb (Abkürzung, beides)
const KW = {
  de: [
    ['Artikeln', 'art', 'plur'], ['Artikels', 'art', 'sing'], ['Artikel', 'art', 'amb'], ['Art.', 'art', 'amb'], ['Art', 'art', 'nodot'],
    ['Absätzen', 'par', 'plur'], ['Absätze', 'par', 'plur'], ['Absatzes', 'par', 'sing'], ['Absatz', 'par', 'sing'], ['Abs.', 'par', 'amb'],
    ['Buchstaben', 'let', 'plur'], ['Buchstabe', 'let', 'sing'], ['Bst.', 'let', 'amb'], ['lit.', 'let', 'amb'],
    ['Ziffern', 'num', 'plur'], ['Ziffer', 'num', 'sing'], ['Ziff.', 'num', 'amb'], ['Nummern', 'num', 'plur'], ['Nummer', 'num', 'sing'],
    ['Anhängen', 'annex', 'plur'], ['Anhänge', 'annex', 'plur'], ['Anhanges', 'annex', 'sing'], ['Anhangs', 'annex', 'sing'], ['Anhang', 'annex', 'sing'],
  ],
  fr: [
    ['articles', 'art', 'plur'], ['article', 'art', 'sing'], ['art.', 'art', 'amb'], ['art', 'art', 'nodot'],
    ['alinéas', 'par', 'plur'], ['alinéa', 'par', 'sing'], ['al.', 'par', 'amb'], ['paragraphes', 'par', 'plur'], ['paragraphe', 'par', 'sing'], ['par.', 'par', 'amb'],
    ['lettres', 'let', 'plur'], ['lettre', 'let', 'sing'], ['let.', 'let', 'amb'], ['points', 'pt', 'plur'], ['point', 'pt', 'sing'], ['pt.', 'pt', 'amb'],
    ['chiffres', 'num', 'plur'], ['chiffre', 'num', 'sing'], ['ch.', 'num', 'amb'],
    ['annexes', 'annex', 'plur'], ['annexe', 'annex', 'sing'],
  ],
  it: [
    ['articoli', 'art', 'plur'], ['articolo', 'art', 'sing'], ['artt.', 'art', 'plur'], ['art.', 'art', 'amb'],
    ['capoversi', 'par', 'plur'], ['capoverso', 'par', 'sing'], ['cpv.', 'par', 'amb'], ['paragrafi', 'par', 'plur'], ['paragrafo', 'par', 'sing'], ['par.', 'par', 'amb'],
    ['lettere', 'let', 'plur'], ['lettera', 'let', 'sing'], ['lett.', 'let', 'amb'],
    ['numeri', 'num', 'plur'], ['numero', 'num', 'sing'], ['n.', 'num', 'amb'], ['punti', 'pt', 'plur'], ['punto', 'pt', 'sing'],
    ['allegati', 'annex', 'plur'], ['allegato', 'annex', 'sing'],
  ],
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const kwAlt = (lang) => KW[lang].slice().sort((a, b) => b[0].length - a[0].length).map((k) => esc(k[0])).join('|');
const KW_INFO = {};
const RE_KW_ALL = {};
const RE_KW_AT = {};
for (const lang of Object.keys(KW)) {
  KW_INFO[lang] = new Map(KW[lang].map((k) => [k[0].toLowerCase(), { level: k[1], form: k[2] }]));
  // Erster Buchstabe ohne Rücksicht auf Gross-/Kleinschreibung (Satzanfang); Rest exakt
  const alt = KW[lang].slice().sort((a, b) => b[0].length - a[0].length)
    .map((k) => `[${k[0][0].toUpperCase()}${k[0][0].toLowerCase()}]${esc(k[0].slice(1))}`).join('|');
  RE_KW_ALL[lang] = new RegExp(`(?<![\\p{L}\\d])(?:${alt})(?!\\p{L})`, 'gu');
  RE_KW_AT[lang] = new RegExp(`(?:${alt})(?!\\p{L})`, 'uy');
}
const kwInfo = (lang, word) => KW_INFO[lang].get(word.toLowerCase());

const SEP = {
  de: /\s*(?:(?:,\s*)?(?:und\/oder|und|oder|sowie|bzw\.|beziehungsweise|respektive)(?:\s*,\s*gegebenenfalls\s*,\s*|\s+gegebenenfalls\s+|\s+)|,\s*(?:gegebenenfalls\s+)?)/y,
  fr: /\s*(?:(?:,\s*)?(?:et\/ou|et|ou|ainsi que|voire)(?:\s*,\s*le cas échéant\s*,\s*|\s+le cas échéant\s*,?\s*|\s+)|,\s*(?:le cas échéant\s*,?\s*)?)/y,
  it: /\s*(?:(?:,\s*)?(?:e\/o|ed|e(?!\s+(?:e|ed|o|od)\s)|od|oppure|o(?!\s+(?:e|ed|o|od)\s)|nonché|ovvero)(?:\s*,\s*se del caso\s*,\s*|\s+se del caso\s*,?\s*|\s+)|,\s*(?:se del caso\s*,?\s*)?)/y,
};
const DET_BEFORE_KW = {
  de: /(?:die|der|den|dem|des)\s+/y,
  fr: /(?:l[’']\s?|les\s+|le\s+|la\s+)/y,
  it: /(?:l[’']\s?|gli\s+|il\s+|lo\s+|la\s+|i\s+|le\s+)/y,
};
const RANGE = { de: /\s*[–\-−‑‒]\s*/y, fr: /\s*(?:[–\-−‑‒]|à)\s*/y, it: /\s*[–\-−‑‒]\s*/y };
const SENTENCE = {
  de: /\s*,?\s*(?:(?:erster|zweiter|dritter|vierter|fünfter|sechster|letzter|vorletzter)\s+(?:Satz|Teilsatz|Halbsatz)|Satz\s+\d+|Einleitungssatz|Teil\s+[A-Z](?!\p{L}))(?!\p{L})/uy,
  fr: /\s*,?\s*(?:(?:1re|2e|3e|4e|5e|première|deuxième|troisième|quatrième|cinquième|dernière|avant-dernière)\s+phrase|phrase introductive|partie\s+[A-Z](?!\p{L}))(?!\p{L}),?/uy,
  it: /\s*,?\s*(?:(?:primo|secondo|terzo|quarto|quinto|ultimo|penultimo)\s+periodo|per\.\s*\d+|frase introduttiva|[Pp]arte\s+[A-Z](?!\p{L}))(?!\p{L}),?/uy,
};

const MONTHS = {
  de: ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
};
// abgekürzte Monate («18 mar. 2005», «19 juin 2015»), wie sie im Wortlaut gelegentlich stehen
const MONTHS_ABBR = {
  de: ['jan\\.', 'febr?\\.', 'märz', 'apr\\.', 'mai', 'juni', 'juli', 'aug\\.', 'sept?\\.', 'okt\\.', 'nov\\.', 'dez\\.'],
  fr: ['janv\\.', 'févr\\.', 'mars', 'avr\\.', 'mai', 'juin', 'juil\\.', 'août', 'sept\\.', 'oct\\.', 'nov\\.', 'déc\\.'],
  it: ['genn?\\.', 'febb?r?\\.', 'mar\\.', 'apr\\.', 'magg?\\.', 'giu\\.', 'lug\\.', 'ago\\.', 'sett?\\.', 'ott\\.', 'nov\\.', 'dic\\.'],
};
const monthAlt = (lang) => [...MONTHS[lang], ...MONTHS_ABBR[lang]].join('|');
const RE_DATE = {
  de: new RegExp(`(?<![\\p{L}])vom\\s+(\\d{1,2})\\.\\s*(${monthAlt('de')})\\s+(\\d{4})`, 'giu'),
  fr: new RegExp(`(?<![\\p{L}])du\\s+(\\d{1,2})(?:er|<sup>er</sup>)?\\s+(${monthAlt('fr')})\\s+(\\d{4})`, 'giu'),
  it: new RegExp(`(?<![\\p{L}])(?:del\\s+|dell[’']\\s?)(\\d{1,2})[°º]?\\s+(${monthAlt('it')})\\s+(\\d{4})`, 'giu'),
};
function monthIndex(lang, m) {
  const w = m.toLowerCase();
  let i = MONTHS[lang].indexOf(w);
  if (i >= 0) return i;
  return MONTHS_ABBR[lang].findIndex((re) => new RegExp(`^${re}$`).test(w));
}
const isoDate = (lang, d, m, y) => `${y}-${String(monthIndex(lang, m) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Gattungswörter für Erlasse. DE: Wortende eines Substantivs; FR/IT: Wortgruppen (längste zuerst)
const DE_ACT_STEMS = ['gesetzbuch', 'gesetz', 'verordnung', 'übereinkommen', 'abkommen', 'protokoll', 'konvention', 'vertrag', 'beschluss',
  'reglement', 'kodex', 'verfassung', 'statut', 'charta', 'notenaustausch', 'briefwechsel', 'vereinbarung', 'obligationenrecht'];
const DE_GENERIC = new Set(['gesetz', 'bundesgesetz', 'verordnung', 'abkommen', 'übereinkommen', 'protokoll', 'konvention', 'vertrag', 'beschluss',
  'bundesbeschluss', 'reglement', 'statut', 'charta', 'notenaustausch', 'briefwechsel', 'vereinbarung', 'zusatzprotokoll', 'staatsvertrag',
  'verwaltungsvereinbarung', 'rahmenabkommen', 'assoziierungsabkommen', 'rückübernahmeabkommen', 'migrationsabkommen', 'freihandelsabkommen',
  'zusatzabkommen', 'änderungsprotokoll', 'durchführungsverordnung', 'ausführungsverordnung', 'kodex', 'beschluss', 'gesetzes', 'bundesratsbeschluss',
  'schengen-assoziierungsabkommen', 'dublin-assoziierungsabkommen', 'assoziierungsabkommen', 'abkommens']);
function deActStem(word) {
  const w = word.toLowerCase();
  for (const cand of [w, w.replace(/(?:es|s)$/, ''), w.replace(/(?:en|n)$/, ''), w.replace(/e$/, '')]) {
    for (const st of DE_ACT_STEMS) if (cand.endsWith(st)) return cand;
  }
  return null;
}
const FR_ACT_NOUNS = ['loi fédérale', 'loi', 'ordonnance', 'accord', 'convention', 'protocole additionnel', 'protocole', 'code pénal militaire',
  'code pénal', 'code civil', 'code des obligations', 'code de procédure pénale', 'code de procédure civile', 'code', 'traité', 'arrêté fédéral',
  'arrêté', 'échange de notes', 'échange de lettres', 'constitution fédérale', 'constitution', 'statut', 'charte', 'règlement', 'mémorandum', 'tarif des émoluments', 'tarif', 'arrangement'];
const IT_ACT_NOUNS = ['legge federale', 'legge', 'ordinanza', 'accordo', 'convenzione', 'protocollo aggiuntivo', 'protocollo', 'codice penale militare',
  'codice penale', 'codice civile', 'codice delle obbligazioni', 'codice di procedura penale', 'codice di diritto processuale penale',
  'codice di procedura civile', 'codice', 'trattato', 'decreto federale', 'decreto', 'scambio di note', 'scambio di lettere', 'tariffa',
  'costituzione federale', 'costituzione', 'statuto', 'carta', 'regolamento', 'memorandum'];
const ROMANCE_GENERIC = new Set(['loi fédérale', 'loi', 'ordonnance', 'accord', 'convention', 'protocole', 'protocole additionnel', 'code', 'traité',
  'arrêté fédéral', 'arrêté', 'échange de notes', 'échange de lettres', 'statut', 'charte', 'règlement', 'mémorandum',
  'legge federale', 'legge', 'ordinanza', 'accordo', 'convenzione', 'protocollo', 'protocollo aggiuntivo', 'codice', 'trattato', 'decreto federale',
  'decreto', 'scambio di note', 'scambio di lettere', 'statuto', 'carta', 'regolamento', 'memorandum']);
// Benannte Erlasse ohne Datum (Wortlaut; die SR-Nummer kommt aus der Fussnote bzw. dem Register, nie aus dieser Liste)
const NAMED = {
  de: /(?<![\p{L}])(Strafgesetzbuch(?:e?s)?|Zivilgesetzbuch(?:e?s)?|Militärstrafgesetz(?:e?s)?|Bundesverfassung|Obligationenrecht(?:e?s)?|Strafprozessordnung|Zivilprozessordnung)(?!\p{L})/gu,
  fr: /(?<![\p{L}])((?:[Cc]ode pénal militaire|[Cc]ode pénal suisse|[Cc]ode pénal|[Cc]ode civil suisse|[Cc]ode civil|[Cc]ode des obligations|[Cc]ode de procédure pénale|[Cc]ode de procédure civile|Constitution fédérale|Constitution))(?!\p{L})/gu,
  it: /(?<![\p{L}])((?:[Cc]odice penale militare|[Cc]odice penale svizzero|[Cc]odice penale|[Cc]odice civile svizzero|[Cc]odice civile|[Cc]odice delle obbligazioni|[Cc]odice di procedura penale|[Cc]odice di diritto processuale penale svizzero|[Cc]odice di diritto processuale penale|[Cc]odice di procedura civile|Costituzione federale|Costituzione))(?!\p{L})/gu,
};

// EU-Rechtsakte
const EU_WORDS = {
  de: [['Durchführungsverordnung', 'R'], ['Durchführungsverordnungen', 'R'], ['Delegierte Verordnung', 'R'], ['Delegierten Verordnung', 'R'],
    ['Verordnungen', 'R'], ['Verordnung', 'R'], ['Richtlinien', 'L'], ['Richtlinie', 'L'], ['Rahmenbeschlusses', 'F'], ['Rahmenbeschluss', 'F'],
    ['Durchführungsbeschlusses', 'D'], ['Durchführungsbeschluss', 'D'], ['Delegierten Beschlusses', 'D'], ['Beschlüsse', 'D'], ['Beschlusses', 'D'], ['Beschluss', 'D'],
    ['Entscheidung', 'D'], ['Entscheidungen', 'D']],
  fr: [['règlement d’exécution', 'R'], ["règlement d'exécution", 'R'], ['règlement délégué', 'R'], ['règlements', 'R'], ['règlement', 'R'],
    ['directives', 'L'], ['directive', 'L'], ['décision-cadre', 'F'], ['décision d’exécution', 'D'], ["décision d'exécution", 'D'], ['décisions', 'D'], ['décision', 'D']],
  it: [['regolamento di esecuzione', 'R'], ['regolamento delegato', 'R'], ['regolamenti', 'R'], ['regolamento', 'R'], ['direttive', 'L'], ['direttiva', 'L'],
    ['decisione quadro', 'F'], ['decisione di esecuzione', 'D'], ['decisioni', 'D'], ['decisione', 'D']],
};
const EU_INST = '(?:EU|EG|EWG|EGKS|Euratom|UE|CE|CEE|CECA)';
const EU_SUFFIX = '(?:EU|EG|EWG|JI|GASP|UE|CE|CEE|JAI|PESC|GAI)';
const EU_NUM_SRC = `(?:[(\\[]${EU_INST}(?:,\\s*${EU_INST})?[)\\]]\\s*)?(?:(?:Nr\\.|n[o°º]|n\\.|N[o°º])\\s*)?(\\d{1,4})\\/(\\d{1,4})(?:\\/(${EU_SUFFIX}))?(?![\\d\\/])`;
const RE_EU = {};
const RE_EU_NUM_AT = new RegExp(`\\s*(?:,\\s*)?(?:und|oder|sowie|et|ou|e|o|ed)?\\s*${EU_NUM_SRC}`, 'uy');
for (const lang of Object.keys(EU_WORDS)) {
  const alt = EU_WORDS[lang].slice().sort((a, b) => b[0].length - a[0].length)
    .map((w) => `[${w[0][0].toUpperCase()}${w[0][0].toLowerCase()}]${esc(w[0].slice(1))}`).join('|');
  RE_EU[lang] = new RegExp(`(?<![\\p{L}])(${alt})\\s+${EU_NUM_SRC}`, 'gu');
}
const euTypeOf = (lang, word) => { const w = word.toLowerCase(); for (const [x, t] of EU_WORDS[lang]) if (x.toLowerCase() === w) return t; return null; };
function euId(type, a, b, hasNr, suffix) {
  let year, no;
  const plaus = (y) => /^\d{4}$/.test(y) && Number(y) >= 1950 && Number(y) <= 2100;
  if (hasNr) { no = a; year = b; if (!plaus(b) && plaus(a) && b.length !== 2) { year = a; no = b; } } else { year = a; no = b; }
  if (!hasNr && !suffix && type !== 'R' && Number(b) > 1900 && Number(a) < 1900) { no = a; year = b; } // «Richtlinie 115/2008» kommt nicht vor; Sicherung
  year = String(year); no = String(Number(no));
  if (year.length === 2) year = (Number(year) > 50 ? '19' : '20') + year;
  if (year.length !== 4 || Number(year) < 1950 || Number(year) > 2100) return null;
  const celex = /^[RLDF]$/.test(type) ? `3${year}${type}${no.padStart(4, '0')}` : null;
  return { type, year, no, celex };
}

// Selbstbezug und Rückverweis auf vorher Genanntes
const SELF = {
  de: /\s*(?:dieses|des\s+vorliegenden)\s+(Gesetzes|Bundesgesetzes|Erlasses|Beschlusses)|\s*(?:dieser|der\s+vorliegenden)\s+(Verordnung)(?!en)/uy,
  fr: /\s*,?\s*(?:de\s+la\s+présente|du\s+présent)\s+(loi|ordonnance|arrêté|acte)(?!\p{L})/uy,
  it: /\s*,?\s*(?:della\s+presente|del\s+presente)\s+(legge|ordinanza|decreto|atto)(?!\p{L})/uy,
};
const ANAPHOR = {
  de: /\s*(?:dieser|dieses|diesen|derselben|desselben|jener|jenes|der\s+genannten|des\s+genannten|der\s+erwähnten|des\s+erwähnten|der\s+betreffenden|des\s+betreffenden)\s+\p{Lu}/uy,
  fr: /\s*,?\s*(?:de\s+ce|de\s+cette|de\s+ces|dudit|de\s+ladite|desdits|desdites|du\s+même|de\s+la\s+même|des\s+mêmes)\s+\p{L}/uy,
  it: /\s*,?\s*(?:di\s+tali|di\s+tale|di\s+detto|di\s+detta|di\s+detti|del\s+medesimo|della\s+medesima|dello\s+stesso|della\s+stessa|di\s+questo|di\s+questa|di\s+questi|di\s+queste|di\s+quest[’'])\s*\p{L}/uy,
};
const OWNER_DET = {
  de: /\s*(?:(?:des|der|dem|den)\s+)?/y,
  fr: /\s*,?\s*(?:(?:de\s+la\s+|de\s+l[’']\s?|du\s+|des\s+|de\s+))?/y,
  it: /\s*,?\s*(?:(?:della\s+|dello\s+|delle\s+|degli\s+|dell[’']\s?|dei\s+|del\s+|di\s+))?/y,
};
const ABBR_SRC = '\\p{Lu}[\\p{L}]{0,9}(?:[-‑]\\p{Lu}[\\p{L}]{0,8})?(?![\\p{L}\\d\\-–‑\\/])';
const ABBR_TOKEN = new RegExp(ABBR_SRC, 'uy');
const isAbbrLike = (s) => (s.match(/\p{Lu}/gu) || []).length >= 2 && s.length <= 14 && !/-\p{Lu}\p{Ll}{3,}$/u.test(s);
const ANNEX_OWNER = {
  de: /\s*(?:des|im|dem)\s+(Anhangs|Anhanges|Anhang)\s+/uy,
  fr: /\s*,?\s*(?:de\s+l[’']|à\s+l[’'])\s?(annexe)\s+/uy,
  it: /\s*,?\s*(?:dell[’']|nell[’'])\s?(allegato)\s+/uy,
};

// ------------------------------------------------------------------ Schlüssel und Einheiten

function keySegs(key) {
  const out = [];
  for (const raw0 of String(key || '').split('.')) {
    const raw = raw0.replace(/[~+].*$/, '');
    let m;
    if (raw === 'p') out.push({ t: 'para0' });
    else if ((m = new RegExp(`^p(\\d+[a-z]?(?:_?${LATIN})?)(?:-(\\d+[a-z]?(?:_?${LATIN})?))?$`).exec(raw))) out.push({ t: 'par', v: m[1].replace('_', ''), v2: m[2] ? m[2].replace('_', '') : null });
    else if ((m = new RegExp(`^n(\\d+[a-z]?(?:_?${LATIN})?)$`).exec(raw))) out.push({ t: 'num', v: m[1].replace('_', '') });
    else if ((m = new RegExp(`^([a-z])\\1?(?:_?${LATIN})?$`).exec(raw)) && !/^(sh|hd)$/.test(raw)) out.push({ t: 'let', v: raw.replace('_', '') });
    else out.push({ t: 'other', v: raw });
  }
  return out;
}
const natCmp = (a, b) => {
  const pa = /^(\d+)(.*)$/.exec(a) || [a, '0', a], pb = /^(\d+)(.*)$/.exec(b) || [b, '0', b];
  return (Number(pa[1]) - Number(pb[1])) || (pa[2] < pb[2] ? -1 : pa[2] > pb[2] ? 1 : 0);
};
function parCovers(seg, v) {
  if (seg.v === v) return true;
  if (seg.v2) { const a = Number.parseInt(seg.v, 10), b = Number.parseInt(seg.v2, 10), x = Number.parseInt(v, 10); return String(x) === v && x >= a && x <= b; }
  return false;
}
/** Findet den Block für eine Gliederung { par, let, num }; null, wenn nicht genau einer passt. */
function findKey(blocks, want) {
  const levels = ['par', 'let', 'num'].filter((l) => want[l] != null);
  if (!levels.length) return null;
  const hits = [];
  for (const b of blocks) {
    const segs = keySegs(b.k);
    const has = { par: [], let: [], num: [] };
    for (const s of segs) if (has[s.t]) has[s.t].push(s);
    let ok = true;
    for (const l of ['par', 'let', 'num']) {
      if (want[l] == null) { if (has[l].length) { ok = false; break; } continue; }
      if (l === 'num') { if (has.num.map((s) => s.v).join('.') !== want.num) { ok = false; break; } continue; }
      if (has[l].length !== 1) { ok = false; break; }
      if (l === 'par' ? !parCovers(has.par[0], want.par) : has[l][0].v !== want[l]) { ok = false; break; }
    }
    if (ok) hits.push(b.k);
  }
  if (hits.length === 1) return hits[0];
  const clean = hits.filter((k) => !/[~+]/.test(k));
  return clean.length === 1 ? clean[0] : null;
}
/** Geschwister-Schlüssel zwischen zwei Werten (Bereich «Buchstaben b–d») in Dokumentreihenfolge. */
function rangeKeys(blocks, want, level, from, to) {
  const out = [];
  let on = false;
  for (const b of blocks) {
    const k = findKey([b], { ...want, [level]: on ? lastSeg(b, level) : from });
    const segv = lastSeg(b, level);
    const sameParent = findKey([b], { ...want, [level]: segv }) === b.k;
    if (!sameParent) continue;
    if (!on && segv === from && k) on = true;
    if (on) out.push({ key: b.k, v: segv });
    if (on && segv === to) return out;
  }
  return null;
}
function lastSeg(b, level) { const s = keySegs(b.k).filter((x) => x.t === level); return s.length ? (level === 'num' ? s.map((x) => x.v).join('.') : s[s.length - 1].v) : null; }

const plainNum = (n) => plainText(n).replace(/\s+/g, '').toLowerCase();
/** Unit-Id eines Artikels nach der Regel des Datensatzes («66abis» → art_66_a_bis). */
export function artUnitId(num) {
  const m = new RegExp(`^(\\d+)([a-z]{0,2}?)(${LATIN})?$`).exec(String(num));
  if (!m) return null;
  return ['art', m[1], m[2] || null, m[3] || null].filter(Boolean).join('_');
}

const TABLES = new WeakMap();
function unitTable(ds, lang, stageId) {
  let per = TABLES.get(ds);
  if (!per) { per = new Map(); TABLES.set(ds, per); }
  const ck = lang + '|' + stageId;
  if (per.has(ck)) return per.get(ck);
  const toc = tocAt(ds, stageId, lang).filter((e) => e.unit);
  const order = [], byNum = new Map(), ranges = [], annex = new Map(), present = new Set();
  for (const e of toc) {
    const v = getVersion(ds, e.id, lang, stageId);
    if (!v || v.missing) continue;
    present.add(e.id);
    if (e.type === 'article') {
      order.push(e.id);
      const n = plainNum(e.num || '');
      let m;
      if ((m = /^(\d+)[–-](\d+)$/.exec(n))) ranges.push({ id: e.id, a: +m[1], b: +m[2] });
      else if ((m = /^(.+?)und(.+)$/.exec(n))) { byNum.set(m[1], e.id); byNum.set(m[2], e.id); }
      else byNum.set(n, e.id);
    } else if (e.type === 'annex') annex.set(plainNum(e.num || '') || '', e.id);
  }
  // alle jemals vorhandenen Artikel (für «fehlt am Stand»)
  const everNum = new Map();
  for (const e of ds.toc) if (e.type === 'article') { const n = plainNum(e.num || ''); if (!everNum.has(n)) everNum.set(n, e.id); }
  const t = { order, pos: new Map(order.map((id, i) => [id, i])), byNum, ranges, annex, present, everNum, annexCount: annex.size };
  per.set(ck, t);
  return t;
}
function resolveArt(ds, lang, stageId, num) {
  const T = unitTable(ds, lang, stageId);
  const n = String(num).toLowerCase();
  let id = T.byNum.get(n);
  if (id) return { unit: id, version: getVersion(ds, id, lang, stageId) };
  const x = Number.parseInt(n, 10);
  if (String(x) === n) for (const r of T.ranges) if (x >= r.a && x <= r.b) return { unit: r.id, version: getVersion(ds, r.id, lang, stageId), viaRange: true };
  id = T.everNum.get(n) || artUnitId(n);
  return { unit: id, version: null };
}

// ------------------------------------------------------------------ Fussnoten

function srFootnotes(block) {
  const out = [];
  for (const f of block.fn || []) {
    if (f.kind !== 'ref') continue;
    const txt = plainText(f.t).replace(/\s+/g, ' ').trim();
    const m = /^(?:SR|RS)\s+(0?\.?[\d.]+\d)/.exec(txt);
    if (!m) continue;
    // mehrere SR-Nummern nur, wenn die Fussnote mit einer Aufzählung beginnt («SR 0.142.30, 0.142.301»); spätere Nummern sind Erläuterungen
    const multi = /^(?:SR|RS)\s+[\d.]*\d\s*(?:,|;|und|et|e)\s*(?:(?:SR|RS)\s+)?\d[\d.]*(?:\s|$|[;,.])/.test(txt);
    const href = /href="(https:\/\/fedlex\.data\.admin\.ch\/eli\/cc\/[^"#]+)"/.exec(f.t);
    out.push({ n: +f.n, sr: m[1], eli: href ? href[1] : null, multi });
  }
  return out.sort((a, b) => a.n - b.n);
}
const EU_FN_START = {
  de: /^(?:Durchführungsverordnung|Delegierte Verordnung|Verordnung|Richtlinie|Rahmenbeschluss|Durchführungsbeschluss|Beschluss|Entscheidung)\b/,
  fr: /^(?:Règlement d[’']exécution|Règlement délégué|Règlement|Directive|Décision-cadre|Décision d[’']exécution|Décision)\b/i,
  it: /^(?:Regolamento di esecuzione|Regolamento delegato|Regolamento|Direttiva|Decisione quadro|Decisione di esecuzione|Decisione)\b/i,
};
const EU_NAME_NOUN = /(kodex|verordnung|richtlinie|beschluss|übereinkommen|code|règlement|directive|décision|regolamento|codice|direttiva|decisione)/i;
function euFootnotes(block, lang) {
  const out = [];
  for (const f of block.fn || []) {
    if (f.kind === 'amend' || f.kind === 'ref') continue;
    const txt = plainText(f.t).replace(/\s+/g, ' ').trim();
    if (!EU_FN_START[lang].test(txt)) continue;
    RE_EU[lang].lastIndex = 0;
    const m = RE_EU[lang].exec(txt);
    if (!m || m.index > 0) continue;
    const id = euFromMatch(lang, m);
    if (!id) continue;
    // Kurzname in Klammern vor der Amtsblattangabe («(Schengener Grenzkodex)»)
    const head = txt.split(/,\s*(?:ABl\.|JO\s|GU\s)/)[0];
    const names = [...head.matchAll(/\(([^()]{4,70})\)/g)].map((x) => x[1].trim()).filter((s) => !new RegExp(`^${EU_INST}$`).test(s) && EU_NAME_NOUN.test(s) && !/\d{4}\//.test(s));
    out.push({ n: +f.n, eu: id, name: names.length ? names[names.length - 1] : null });
  }
  return out;
}
function euFromMatch(lang, m) {
  const type = euTypeOf(lang, m[1]);
  const full = m[0];
  const hasNr = /(?:Nr\.|n[o°º]|n\.|N[o°º])\s*\d/.test(full);
  return euId(type, m[2], m[3], hasNr, m[4]);
}

// ------------------------------------------------------------------ Erlass-Nennungen (Bezeichnungen) im Text

const normName = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/**
 * Findet Bezeichnungen von Erlassen im Klartext: EU-Rechtsakte mit Nummer, Titel mit Datum, benannte Erlasse,
 * Kürzel in Klammern (Einführung) und bekannte Namen/Kürzel aus dem Register.
 */
function findDesignations(P, lang, reg) {
  const out = [];
  // EU mit Nummer (auch Aufzählungen «(EU) 2019/817 und (EU) 2019/818»)
  RE_EU[lang].lastIndex = 0;
  let m;
  while ((m = RE_EU[lang].exec(P))) {
    const id = euFromMatch(lang, m);
    const list = id ? [{ eu: id, s: m.index, e: m.index + m[0].length }] : [];
    let pos = m.index + m[0].length;
    if (id) {
      for (;;) {
        RE_EU_NUM_AT.lastIndex = pos;
        const n = RE_EU_NUM_AT.exec(P);
        if (!n || !/[(\[]|\d/.test(n[0]) || !/[(\[]/.test(n[0].slice(0, 12)) && !/(?:Nr\.|n\.|no)/.test(n[0])) break;
        const id2 = euId(id.type, n[1], n[2], /(?:Nr\.|n[o°º]|n\.)\s*\d/.test(n[0]), n[3]);
        if (!id2) break;
        list.push({ eu: id2, s: pos + n[0].search(/\S/), e: pos + n[0].length });
        pos += n[0].length;
      }
    }
    if (list.length) out.push({ kind: 'eu', s: m.index, e: pos, coreE: pos, eus: list.map((x) => x.eu), parts: list.map((x) => [x.s, x.e]), word: m[1] });
    RE_EU[lang].lastIndex = Math.max(pos, m.index + 1);
  }
  const taken = (s, e) => out.some((d) => s < d.e && e > d.s);
  // Register: EU-Namen, Stämme (DE), Kürzel
  if (reg) {
    for (const [name, info] of reg.euNames) {
      let i = 0;
      const low = P.toLowerCase();
      while ((i = low.indexOf(name, i)) >= 0) {
        const e = i + name.length;
        const okL = i === 0 || !/\p{L}/u.test(P[i - 1]);
        const tail = /^(?:es|s)?(?!\p{L})/u.exec(P.slice(e));
        if (okL && tail && !taken(i, e)) out.push({ kind: 'euname', s: i, e: e + tail[0].length, coreE: e + tail[0].length, name, info });
        i = e;
      }
    }
  }
  // Titel mit Datum
  RE_DATE[lang].lastIndex = 0;
  while ((m = RE_DATE[lang].exec(P))) {
    const dateS = m.index, dateE = m.index + m[0].length;
    if (taken(dateS, dateE)) continue;
    const head = findActNounBefore(P, dateS, lang);
    if (!head || out.some((x) => x.e > head.s && x.s < dateS)) continue;
    const date = isoDate(lang, m[1], m[2], m[3]);
    const d = { kind: 'title', s: head.s, e: dateE, coreE: dateE, noun: head.noun, date, key: `${head.key}|${date}`, adjacent: head.adjacent, generic: head.generic, after: afterWords(P, dateE) };
    // Einführung eines Kürzels: «(ABBR)» im selben Satzteil
    const intro = findIntroAbbr(P, dateE);
    if (intro) { d.intro = intro.abbr; d.introS = intro.s; d.introE = intro.e; d.introAdj = /^\s*\($/.test(P.slice(dateE, intro.s)); }
    out.push(d);
  }
  // Benannte Erlasse ohne Datum
  NAMED[lang].lastIndex = 0;
  while ((m = NAMED[lang].exec(P))) {
    if (taken(m.index, m.index + m[0].length)) continue;
    const d = { kind: 'named', s: m.index, e: m.index + m[0].length, coreE: m.index + m[0].length, key: 'named|' + normNamed(m[1], lang) };
    const intro = findIntroAbbr(P, d.e, 12);
    if (intro) { d.intro = intro.abbr; d.introS = intro.s; d.introE = intro.e; d.introAdj = /^\s*\($/.test(P.slice(d.e, intro.s)); }
    out.push(d);
  }
  // Kürzel-artige Wörter (für Fussnotenzuordnung und Register)
  const reAb = new RegExp('(?<![\\p{L}\\d\\-])' + ABBR_SRC, 'gu');
  while ((m = reAb.exec(P))) {
    const w = m[0];
    const s = m.index, e = s + w.length;
    if (taken(s, e) || out.some((d) => d.introS != null && s >= d.introS && e <= d.introE)) continue;
    const known = reg && reg.abbr.has(w);
    if (!known && !isAbbrLike(w)) continue;
    if (P[s - 1] === '(' && P[e] === ')') continue; // Einführung in Klammern ohne Bezugstitel: kein Erlass-Kürzel gesichert
    out.push({ kind: 'abbr', s, e, coreE: e, abbr: w, known: !!known, evidence: !!known || !!(reg && reg.ownerAbbrs && reg.ownerAbbrs.has(w)) });
  }
  // DE: Stamm-Nennungen ohne Datum («des Ausweisgesetzes»), nur wenn im Register bekannt
  if (lang === 'de' && reg && reg.stems.size) {
    const reW = /(?<![\p{L}\-])\p{Lu}[\p{L}\-]{3,60}(?!\p{L})/gu;
    while ((m = reW.exec(P))) {
      const st = deActStem(m[0]);
      if (!st || DE_GENERIC.has(st) || !reg.stems.has(st)) continue;
      if (taken(m.index, m.index + m[0].length) || out.some((d) => m.index >= d.s && m.index < d.e)) continue;
      out.push({ kind: 'stem', s: m.index, e: m.index + m[0].length, coreE: m.index + m[0].length, key: 'stem|' + st });
    }
  }
  return out.sort((a, b) => a.s - b.s || b.e - a.e);
}
function normNamed(s, lang) {
  const w = s.toLowerCase();
  if (lang === 'de') return w.replace(/(?:e?s)$/, '').replace(/^(strafgesetzbuch|zivilgesetzbuch|militärstrafgesetz|obligationenrecht).*$/, '$1');
  return w.replace(/\s+(suisse|svizzero)$/, '');
}
function findActNounBefore(P, dateS, lang) {
  const before = P.slice(Math.max(0, dateS - 260), dateS);
  const off = dateS - before.length;
  // Satzteil nicht verlassen
  const cut = Math.max(before.lastIndexOf(';'), before.lastIndexOf(':'), before.lastIndexOf(','), before.search(/\.\s+\p{Lu}[^.]*$/u) >= 0 ? before.search(/\.\s+\p{Lu}[^.]*$/u) : -1);
  const seg = before.slice(cut + 1);
  const segOff = off + cut + 1;
  if (lang === 'de') {
    const words = [...seg.matchAll(/\p{Lu}[\p{L}\-]*/gu)];
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      const between = seg.slice(w.index + w[0].length);
      if ((between.match(/\S+/g) || []).length > 12) break;
      if (/[()]/.test(between)) break;
      const st = deActStem(w[0]);
      if (st) {
        // «Regierungs- und Verwaltungsorganisationsgesetzes»: Koordination mit Ergänzungsstrich einschliessen
        const pre = /(\p{Lu}[\p{L}]*-(?:,\s*\p{Lu}[\p{L}]*-)*\s+(?:und|oder)\s+)$/u.exec(seg.slice(0, w.index));
        const s0 = segOff + w.index - (pre ? pre[1].length : 0);
        return { s: s0, noun: w[0], key: st, adjacent: /^\s*$/.test(between), generic: DE_GENERIC.has(st) };
      }
    }
    return null;
  }
  const nouns = lang === 'fr' ? FR_ACT_NOUNS : IT_ACT_NOUNS;
  const low = seg.toLowerCase();
  // abgekürzte Gattung direkt vor dem Datum: «la L du …», «della LF del …», «dell’O del …»
  const ab = /(?<![\p{L}’'])(LF|L|OF|O|AF|DF|ACF|DCF)\s*$/u.exec(seg);
  if (ab) return { s: segOff + ab.index, noun: ab[1], key: ab[1].toLowerCase(), adjacent: true, generic: true };
  let best = null;
  for (const n of nouns) {
    const re = new RegExp(`(?<![\\p{L}])${esc(n)}(?![\\p{L}])`, 'gu');
    let x;
    while ((x = re.exec(low))) {
      const between = seg.slice(x.index + n.length);
      if ((between.match(/\S+/g) || []).length > 10 || /[()]/.test(between)) continue;
      if (!best || x.index > best.i || (x.index === best.i && n.length > best.n.length)) best = { i: x.index, n };
    }
  }
  if (!best) return null;
  const between = seg.slice(best.i + best.n.length);
  return { s: segOff + best.i, noun: seg.substr(best.i, best.n.length), key: best.n, adjacent: /^\s*$/.test(between), generic: ROMANCE_GENERIC.has(best.n) };
}
function findIntroAbbr(P, from, maxLen = 320) {
  const tail = P.slice(from, from + maxLen);
  const stop = tail.search(/[;:]|\.\s+\p{Lu}|\.$/u);
  const seg = stop >= 0 ? tail.slice(0, stop) : tail;
  const m = /\(([^()\s]{2,14})\)/u.exec(seg);
  if (!m) return null;
  const a = m[1];
  if (!/\p{Lu}/u.test(a) || /^\d/.test(a) || new RegExp(`^${EU_INST}$`).test(a)) return null;
  // keine weitere Erlass-Bezeichnung dazwischen
  const between = seg.slice(0, m.index);
  if (RE_DATE_ANY.test(between)) return null;
  return { abbr: a, s: from + m.index + 1, e: from + m.index + 1 + a.length };
}
const RE_DATE_ANY = /(?:vom|du|del)\s+\d{1,2}/;
/** Die ersten drei Wörter nach dem Datum eines Titels («über zulassung aufenthalt»), sonst ''. */
function afterWords(P, from) {
  const t = P.slice(from, from + 120).replace(/^\s*,?\s*/, '');
  if (!/^(?:über|zur|zum|betreffend|sur|concernant|relative?|relatif|sul|sulla|sui|sugli|concernente|che|zwischen|entre|tra|fra)\s/i.test(t)) return '';
  const w = t.toLowerCase().split(/[\s,;()]+/).filter(Boolean).slice(0, 3);
  return w.length === 3 ? w.join(' ') : '';
}

// ------------------------------------------------------------------ Register und Fussnotenzuordnung

function workTypeOf(title, lang) {
  const t = String(title || '').toLowerCase();
  if (lang === 'de') return /^(?:bundes)?gesetz|^\p{L}*gesetz\b/u.test(t) ? 'law' : /^verordnung|^\p{L}*verordnung\b/u.test(t) ? 'ord' : /beschluss/.test(t.split(' ')[0]) ? 'dec' : null;
  if (lang === 'fr') return /^loi/.test(t) ? 'law' : /^ordonnance/.test(t) ? 'ord' : /^arrêté/.test(t) ? 'dec' : null;
  return /^legge/.test(t) ? 'law' : /^ordinanza/.test(t) ? 'ord' : /^decreto/.test(t) ? 'dec' : null;
}
const SELF_NOUN_TYPE = { gesetzes: 'law', bundesgesetzes: 'law', verordnung: 'ord', beschlusses: 'dec', erlasses: '*', loi: 'law', ordonnance: 'ord', arrêté: 'dec', acte: '*', legge: 'law', ordinanza: 'ord', decreto: 'dec', atto: '*' };

function libraryIndex(works, lang) {
  const bySr = new Map(), abbr = new Map(), titleKeys = new Map(), stems = new Map();
  for (const w of works || []) {
    if (!w || !w.sr) continue;
    bySr.set(w.sr, w);
    const a = w.abbr && w.abbr[lang];
    if (a) abbr.set(a, w);
    const t = w.title && w.title[lang] ? plainText(w.title[lang]) : '';
    RE_DATE[lang].lastIndex = 0;
    const m = RE_DATE[lang].exec(t);
    if (m) { const h = findActNounBefore(t, m.index, lang); if (h) { const k = `${h.key}|${isoDate(lang, m[1], m[2], m[3])}|${afterWords(t, m.index + m[0].length)}`; titleKeys.set(k, titleKeys.has(k) && titleKeys.get(k) !== w ? null : w); if (lang === 'de' && !DE_GENERIC.has(h.key)) stems.set('stem|' + h.key, w); } }
    const sh = w.short && w.short[lang];
    if (sh && lang === 'de') { const st = deActStem(plainText(sh).split(/\s+/).pop()); if (st && !DE_GENERIC.has(st)) stems.set('stem|' + st, w); }
  }
  return { bySr, abbr, titleKeys, stems };
}

function newRegister() {
  const r = { abbr: new Map(), keys: new Map(), stems: new Map(), euNames: new Map(), conflicts: [] };
  for (const m of [r.abbr, r.keys, r.stems, r.euNames]) { m.__where = new Map(); m.__conf = r.conflicts; }
  return r;
}
let REG_WHERE = null; // Fundort für Widersprüche im Register (nur zur Ausweisung)
function regPut(map, k, v) {
  const cur = map.get(k);
  if (cur === undefined) { map.set(k, v); if (map.__where) map.__where.set(k, REG_WHERE); }
  else if (cur && (cur.sr !== v.sr || JSON.stringify(cur.eu || null) !== JSON.stringify(v.eu || null) || (cur.celex && cur.celex !== v.celex))) {
    map.set(k, null); // Widerspruch: nicht verwendbar
    if (map.__conf) map.__conf.push({ key: k, a: cur, b: v, at: [map.__where && map.__where.get(k), REG_WHERE] });
  }
}

/** Löst eine Bezeichnung ohne Fussnote über Register und Bibliothek auf. */
function knownTarget(d, reg, lib, own) {
  if (d.kind === 'eu') return { eu: d.eus };
  if (d.kind === 'euname') return d.info ? { eu: [d.info] } : null;
  if (d.kind === 'abbr') {
    if (own.abbr && d.abbr === own.abbr) return { self: true };
    if (reg.abbr.has(d.abbr)) return reg.abbr.get(d.abbr);
    const w = lib.abbr.get(d.abbr);
    if (w) return { sr: w.sr, eli: w.eli || null };
    return null;
  }
  if (d.kind === 'title' || d.kind === 'named' || d.kind === 'stem') {
    if (reg.keys.has(d.key)) return reg.keys.get(d.key);
    // Bibliothekstitel nur mit Gattung, Datum UND den ersten Wörtern danach («über Zulassung, Aufenthalt»): Erlasse gleichen Datums kommen vor
    const w = d.kind === 'stem' ? lib.stems.get(d.key) : d.kind === 'title' && d.after ? lib.titleKeys.get(`${d.key}|${d.after}`) : null;
    if (w) return { sr: w.sr, eli: w.eli || null };
    if (d.kind === 'stem' && reg.stems.has(d.key)) return reg.stems.get(d.key);
    return null;
  }
  return null;
}

/**
 * Ordnet die SR-Fussnoten eines Blocks den Bezeichnungen zu (Reihenfolge bleibt erhalten).
 * Pflicht: Titel mit Datum direkt am Gattungswort und Kürzel direkt nach einem Zitat ohne Registereintrag.
 * Ergebnis: Map Bezeichnung → Fussnote; mehrdeutige Bezeichnungen in `amb`.
 */
function alignFootnotes(cands, fns, reg, lib, own) {
  const res = new Map(), amb = new Set();
  if (!fns.length) return { res, amb, ok: true };
  let cs = cands.filter((d) => d.kind !== 'eu' && d.kind !== 'euname' && !(d.kind === 'abbr' && !d.evidence && !d.ownerPos));
  // Kürzel, das im selben Block bei einer früheren Bezeichnung eingeführt wurde («Zivilgesetzbuchs (ZGB) … Artikel 106 ZGB»): dieselbe Bezeichnung
  const linked = new Map();
  for (const d of cs) if (d.kind === 'abbr') { const src = cs.find((x) => x.intro === d.abbr && x.s < d.s); if (src) linked.set(d, src); }
  cs = cs.filter((d) => !linked.has(d));
  const info = cs.map((c) => {
    const k = knownTarget(c, reg, lib, own);
    const known = k && k.sr ? k.sr : null;
    // Kürzel sind im Erlass eindeutig (hart); Titel, benannte Erlasse und Stämme aus dem Register sind weich: die Fussnote am Block geht vor
    const soft = c.kind !== 'abbr';
    const mandatory = !k && ((c.kind === 'title' && c.adjacent) || (c.kind === 'abbr' && c.ownerPos) || c.kind === 'named');
    return { c, known, soft, mandatory, self: k && k.self };
  });
  // Dynamische Programmierung über (Bezeichnung i, Fussnote j), Reihenfolge bleibt erhalten.
  // Punkte: bekannte Bezeichnung mit passender Fussnote +3 (unpassend: nicht erlaubt), Pflichtbezeichnung mit Fussnote +1,
  // Pflichtbezeichnung ohne Fussnote −6, Fussnote ohne Bezeichnung −10.
  const m = info.length, n = fns.length;
  const NEG = -1e9;
  const best = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(NEG));
  const canTake = (i, j) => !info[i].self && (!info[i].known || info[i].soft || info[i].known === fns[j].sr);
  const takeScoreJ = (i, j) => (info[i].known ? (info[i].known === fns[j].sr ? 3 : 0.5) : info[i].mandatory ? 1 : 0);
  const skipScore = (i) => (info[i].mandatory ? -6 : 0);
  for (let i = m; i >= 0; i--) for (let j = n; j >= 0; j--) {
    if (i === m) { best[i][j] = -10 * (n - j); continue; }
    if (j === n) { best[i][j] = skipScore(i) + best[i + 1][j]; continue; }
    let b = skipScore(i) + best[i + 1][j];
    if (canTake(i, j)) b = Math.max(b, takeScoreJ(i, j) + best[i + 1][j + 1]);
    b = Math.max(b, -10 + best[i][j + 1]);
    best[i][j] = b;
  }
  // Erreichbare Zustände auf optimalen Wegen, Ergebnis je Bezeichnung
  const outcome = info.map(() => new Set());
  const fnOf = info.map(() => null);
  const seen = new Set();
  const stack = [[0, 0]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const key = i * (n + 2) + j;
    if (seen.has(key)) continue;
    seen.add(key);
    if (i === m) continue;
    if (j === n) { outcome[i].add(info[i].known || '-'); stack.push([i + 1, j]); continue; }
    const v = best[i][j];
    if (skipScore(i) + best[i + 1][j] === v) { outcome[i].add(info[i].known || '-'); stack.push([i + 1, j]); }
    if (canTake(i, j) && takeScoreJ(i, j) + best[i + 1][j + 1] === v) { outcome[i].add(fns[j].sr); fnOf[i] = fnOf[i] || fns[j]; stack.push([i + 1, j + 1]); }
    if (-10 + best[i][j + 1] === v) stack.push([i, j + 1]);
  }
  for (let i = 0; i < m; i++) {
    const o = outcome[i];
    if (o.size === 1) {
      const sr = [...o][0];
      if (sr !== '-' && fnOf[i] && fnOf[i].sr === sr) res.set(info[i].c, fnOf[i]);
    } else if (o.size > 1) amb.add(info[i].c);
  }
  for (const [d, src] of linked) { if (res.has(src)) res.set(d, res.get(src)); else if (amb.has(src)) amb.add(d); }
  return { res, amb, ok: true };
}

// ------------------------------------------------------------------ Zitate (Ketten) parsen

function tokenAt(P, pos, level) {
  const re = level === 'let' ? RE_LET : level === 'num' ? RE_NUMDEC : RE_NUM;
  re.lastIndex = pos;
  const m = re.exec(P);
  if (m) return { v: m[0].replace(/\)$/, '').replace(/\s+/g, ''), s: pos, e: pos + m[0].replace(/\)$/, '').length, eFull: pos + m[0].length };
  if (level === 'annex') { RE_ROMAN.lastIndex = pos; const r = RE_ROMAN.exec(P); if (r) return { v: r[0], s: pos, e: pos + r[0].length, eFull: pos + r[0].length, roman: true }; }
  return null;
}
function kwAt(P, pos, lang) {
  RE_KW_AT[lang].lastIndex = pos;
  const m = RE_KW_AT[lang].exec(P);
  if (!m) return null;
  const inf = kwInfo(lang, m[0]);
  return inf ? { word: m[0], level: inf.level, form: inf.form, s: pos, e: pos + m[0].length } : null;
}
function stickyAt(re, P, pos) { re.lastIndex = pos; const m = re.exec(P); return m ? m[0].length : 0; }
const NUMERIC = new Set(['art', 'par', 'num', 'annex']);
const intOf = (v) => Number.parseInt(v, 10);

/**
 * Parst ein Zitat ab einem Stichwort. Liefert { s, e, items: [{ segs: [{level,v,to?,s,e}], hit:[s,e] }], top } oder null.
 */
function parseChain(P, kw0, lang) {
  const stack = [];
  const items = [];
  let pos = kw0.e;
  let lastE = kw0.e;
  let last = null; // zuletzt gesetztes Segment
  let ownFrom = kw0.e;
  const lastAt = {};
  const place = (level, form, tok, kwS) => {
    const idx = stack.findIndex((s) => s.level === level);
    let sibling = false;
    if (idx >= 0) { stack.length = idx; sibling = true; }
    else if (level === 'art' && kwS != null && stack.length === 1 && stack[0].level === 'annex' && /^[\s,]*$/.test(P.slice(stack[0].e, kwS))) { /* «Anhang I Artikel 3», «annexe I, art. 3»: Artikel im Anhang */ }
    else if (level === 'art' || level === 'annex') { if (stack.length) sibling = true; stack.length = 0; }
    const prevSame = sibling && idx >= 0 && kwS == null ? lastAt[level] : null;
    const seg = { level, form, v: tok.v, s: tok.s, e: tok.e, roman: !!tok.roman, kwS, n: prevSame ? (prevSame.n || 1) + 1 : 1 };
    lastAt[level] = seg;
    const parentWasLeaf = !sibling && items.length && items[items.length - 1].segs.length === stack.length && stack.length > 0;
    stack.push(seg);
    const it = { segs: stack.slice(), hit: [tok.s, tok.e] };
    if (parentWasLeaf) items[items.length - 1] = it; else items.push(it);
    last = seg;
    lastE = tok.e;
    ownFrom = tok.eFull;
    pos = tok.eFull;
  };
  const firstTok = tokenForKw(P, stickyWs(P, pos), kw0, lang);
  if (!firstTok) return null;
  place(firstTok.level, kw0.form, firstTok.tok, kw0.s);
  for (let guard = 0; guard < 200; guard++) {
    // Bereich
    const rl = stickyAt(RANGE[lang], P, pos);
    if (rl) {
      const t = tokenAt(P, pos + rl, last.level === 'pt' ? 'let' : last.level);
      if (t && !last.to && rangeOk(last, t)) {
        last.to = t.v; last.e = t.e; last.n = (last.n || 1) + 1; items[items.length - 1].hit = [last.s, t.e]; items[items.length - 1].segs = stack.slice();
        pos = t.eFull; lastE = t.e; ownFrom = t.eFull; continue;
      }
    }
    // Satzangabe («dritter Satz») überspringen
    const sl = stickyAt(SENTENCE[lang], P, pos);
    if (sl) { pos += sl; lastE = pos; ownFrom = pos; continue; }
    // Stichwort direkt (DE «Artikel 5 Absatz 1», FR «art. 5, al. 1»)
    const ws = pos + stickyAt(/\s*,?\s*/y, P, pos);
    const k1 = kwAt(P, ws, lang);
    if (k1 && (k1.level !== 'annex') && (k1.level !== 'art' || (stack.length === 1 && stack[0].level === 'annex'))) {
      const t = tokenForKw(P, stickyWs(P, k1.e), k1, lang);
      if (t) { place(t.level, k1.form, t.tok, k1.s); continue; }
    }
    // Trenner + (Artikel + Stichwort | Zahl)
    const sepL = stickyAt(SEP[lang], P, pos);
    if (sepL) {
      let p2 = pos + sepL;
      const detL = stickyAt(DET_BEFORE_KW[lang], P, p2);
      const k2 = kwAt(P, p2 + detL, lang) || kwAt(P, p2, lang);
      if (k2) {
        const t = tokenForKw(P, stickyWs(P, k2.e), k2, lang);
        if (t) { place(t.level, k2.form, t.tok, k2.s); continue; }
        break;
      }
      // blosse Zahl bzw. Buchstabe
      const lv = decideLevel(P, p2, stack, lang, P.slice(pos, p2));
      if (lv) { place(lv.level, lv.form, lv.tok, null); continue; }
      break;
    }
    break;
  }
  return { s: kw0.s, e: lastE, ownFrom, items, top: items.length ? items[0].segs[0].level : null };
}
function stickyWs(P, pos) { return pos + stickyAt(/\s*/y, P, pos); }
function tokenForKw(P, pos, kw, lang) {
  if (kw.level === 'pt') { // FR/IT «point a)» (EU-Zitierweise): Buchstabe mit Klammer oder Ziffer
    const l = tokenAt(P, pos, 'let'); if (l && !/^\d/.test(l.v)) return l.eFull > l.e || /\.$/.test(kw.word) ? { level: 'let', tok: l } : null;
    const n = tokenAt(P, pos, 'num'); if (n) return { level: 'num', tok: n };
    return null;
  }
  const t = tokenAt(P, pos, kw.level);
  if (!t) return null;
  if (t.roman && kw.level !== 'annex') return null;
  if (kw.level === 'let' && /^\d/.test(t.v)) return null;
  return { level: kw.level, tok: t };
}
function rangeOk(seg, t) {
  if (seg.level === 'let') return /^[a-z]/.test(t.v) && t.v[0] >= seg.v[0];
  if (seg.roman || t.roman) return !!seg.roman === !!t.roman;
  return intOf(t.v) >= intOf(seg.v);
}
function decideLevel(P, pos, stack, lang, sepText) {
  // IT: «e»/«o» als Buchstabe am Listenende
  const let_ = tokenAt(P, pos, 'let');
  const num = tokenAt(P, pos, 'num');
  if (let_ && !/^\d/.test(let_.v)) {
    const L = stack.find((s) => s.level === 'let');
    if (!L) return null;
    return { level: 'let', form: L.form, tok: let_ };
  }
  if (!num) return null;
  const numeric = stack.filter((s) => NUMERIC.has(s.level));
  if (!numeric.length) return null;
  const D = numeric[numeric.length - 1];
  const up = numeric.length > 1 ? numeric[numeric.length - 2] : null;
  const tok = D.level === 'num' ? num : (tokenAt(P, pos, 'art') || num);
  if (D.roman) return null;
  // folgt ein Stichwort derselben Stufe, gehört die Zahl zur höheren Stufe
  const nextKw = kwAt(P, stickyWs(P, tok.eFull + stickyAt(/\s*,/y, P, tok.eFull)), lang);
  let choose;
  const prev = intOf(D.to || D.v), x = intOf(tok.v);
  const close = (x > prev && x - prev <= 4) || (x === prev && tok.v !== String(D.to || D.v) && /[a-z]/.test(tok.v));
  const listLen = stack.filter((s) => s.level === D.level).length; // immer 1 (Stapel); Zahl der Geschwister über D.n
  const artSeg = numeric.find((x) => x.level === 'art');
  if (!up) choose = D;
  else if (nextKw && nextKw.level === D.level) choose = up;
  // «Artikeln 10 Absatz 2 und 11», «articoli 5 paragrafo 4 e 8»: Mehrzahl beim Artikel verlangt einen weiteren Artikel
  else if (D.form === 'plur' && ((D.n || 1) < 2 || close)) choose = D;
  else if (artSeg && artSeg !== D && artSeg.form === 'plur' && (artSeg.n || 1) < 2 && !artSeg.to) choose = artSeg;
  // FR «art. 5, al. 4, et 8»: Komma vor dem Bindewort schliesst die Aufzählung der unteren Stufe
  else if (lang === 'fr' && D.form === 'amb' && /,\s*(?:et|ou)\s/.test(sepText) && !(x > prev && x - prev <= 2)) choose = up;
  else if (D.form === 'plur') choose = (D.n || 1) < 2 ? D : (close ? D : up);
  else if (D.form === 'sing') {
    const pu = intOf(up.to || up.v);
    const closeUp = x > pu && x - pu <= 10;
    choose = close && !closeUp ? D : up;
  } else choose = close ? D : up;
  void listLen;
  // nach oben: die erste höhere Stufe, zu der die Zahl passt («ch. 5, et 76a» → Artikel 76a, nicht Absatz 76a)
  if (choose !== D && choose !== artSeg) {
    const ups = numeric.slice(0, -1).reverse();
    const fits = (sg) => { const pv = intOf(sg.to || sg.v); return (x > pv && x - pv <= 10) || (x === pv && tok.v !== String(sg.to || sg.v) && /[a-z]/.test(tok.v)); };
    const hit = ups.find(fits);
    choose = hit || ups[ups.length - 1] || choose;
  }
  if (choose.level === 'art' || choose.level === 'annex') { const t = tokenAt(P, pos, choose.level); if (!t) return null; return { level: choose.level, form: choose.form, tok: t, alt: choose !== D ? D.level : null }; }
  return { level: choose.level, form: choose.form, tok: choose.level === 'num' ? num : (tokenAt(P, pos, choose.level) || num), alt: choose !== D ? D.level : (up ? up.level : null) };
}

// ------------------------------------------------------------------ Eigentümer eines Zitats

/**
 * Bestimmt, zu welchem Erlass ein Zitat gehört: Selbstbezug, Bezeichnung direkt danach, Rückverweis oder nichts.
 * Rückgabe { type: 'none'|'self'|'desig'|'anaphor'|'unknown'|'annex', e, d?, why? }
 */
function ownerAt(P, pos, lang, desigs, ownType) {
  let x = stickyAt(SELF[lang], P, pos);
  if (x) {
    SELF[lang].lastIndex = pos;
    const m = SELF[lang].exec(P);
    const noun = (m[1] || m[2] || '').toLowerCase();
    const t = SELF_NOUN_TYPE[noun];
    if (t === '*' || !ownType || t === ownType) return { type: 'self', e: pos + x };
    return { type: 'anaphor', e: pos + x, why: 'Demonstrativ auf einen Erlass anderer Art («' + m[0].trim() + '»)' };
  }
  x = stickyAt(ANAPHOR[lang], P, pos);
  if (x) {
    const wm = /^[\p{L}\-]*/u.exec(P.slice(pos + x - 1));
    const end = pos + x - 1 + wm[0].length;
    const word = P.slice(pos + x - 1, end);
    const phrase = P.slice(pos, end).trim();
    const isAct = lang === 'de' ? !!deActStem(word) || /^(Verordnungen|Richtlinien|Beschlüsse)$/.test(word)
      : (lang === 'fr' ? FR_ACT_NOUNS : IT_ACT_NOUNS).some((n) => n.split(' ')[0] === word.toLowerCase().replace(/s$/, '') || n.split(' ')[0] === word.toLowerCase()) || /^(règlements?|directives?|décisions?|regolament[oi]|dirett[iv][ae]|decision[ei]|accord[io]?|convenzion[ei])$/i.test(word);
    if (isAct && /^(?:,\s*)?(?:derselben|desselben|du\s+même|de\s+la\s+même|des\s+mêmes|del\s+medesimo|della\s+medesima|dello\s+stesso|della\s+stessa)\s/u.test(phrase + ' ')) return { type: 'same', e: end, why: 'Rückverweis «' + phrase + '»' };
    if (isAct) return { type: 'anaphor', e: end, why: 'Rückverweis auf einen vorher genannten Erlass («' + phrase + '»)' };
  }
  const al = stickyAt(ANNEX_OWNER[lang], P, pos);
  if (al) {
    const t = tokenAt(P, pos + al, 'annex');
    if (t) {
      const next = ownerAt(P, t.eFull, lang, desigs, ownType);
      if (next.type === 'none' || next.type === 'self') return { type: 'annex', e: next.type === 'self' ? next.e : t.eFull, tok: t };
      if (next.type === 'desig') return { ...next, annexTok: t };
      return { type: 'unknown', e: next.e, why: 'Anhang eines anderen Erlasses («' + P.slice(pos, next.e).trim() + '»)' };
    }
  }
  // EU-Nummer ohne Gattungswort direkt nach dem Zitat (IT «articolo 55 paragrafo 2 (UE) 2017/2226»): fremd, aber nicht bestimmbar
  const eun = /^\s*,?\s*[(\[](?:EU|UE|EG|CE|EWG|CEE)[)\]]\s*(?:(?:Nr\.|n\.|no)\s*)?\d{1,4}\/\d{1,4}/u.exec(P.slice(pos, pos + 40));
  if (eun && !/^\s*,?\s*(?:der|des|du|de|del|della|dei|degli|delle|dello)\s/u.test(eun[0])) return { type: 'unknown', e: pos + eun[0].length, why: 'EU-Nummer ohne Gattung («' + eun[0].trim() + '»)' };
  const dl = stickyAt(OWNER_DET[lang], P, pos);
  const start = pos + dl;
  const hasDet = /\p{L}/u.test(P.slice(pos, start));
  const d = desigs.find((z) => z.s === start);
  if (d) {
    if (d.kind === 'abbr' && !d.known && hasDet && lang === 'de' && !isAbbrLike(d.abbr)) return { type: 'none', e: pos };
    const e = d.intro != null && /^\s*\($/.test(P.slice(d.coreE, d.introS)) ? d.introE + 1 : d.coreE;
    return { type: 'desig', e, d };
  }
  // Gattungswort ohne bestimmbare Bezeichnung → unsicher
  const rest = P.slice(start, start + 80);
  if (hasDet || lang !== 'de') {
    if (lang === 'de') {
      const w = /^(?:\p{Lu}\p{Ll}+(?:e[nrs]?|er)\s+){0,2}(\p{Lu}[\p{L}\-]+)/u.exec(rest);
      if (w && hasDet && deActStem(w[1])) return { type: 'unknown', e: start + w[0].length, why: 'Erlass nicht bestimmbar («' + rest.slice(0, w[0].length) + '»)' };
    } else {
      const low = rest.toLowerCase();
      const nouns = lang === 'fr' ? FR_ACT_NOUNS : IT_ACT_NOUNS;
      for (const n of nouns) if (low.startsWith(n) && !/\p{L}/u.test(low[n.length] || '') && hasDet) return { type: 'unknown', e: start + n.length, why: 'Erlass nicht bestimmbar («' + rest.slice(0, n.length) + '»)' };
      const eu = /^(règlement|directive|décision|regolamento|direttiva|decisione)s?(?!\p{L})/u.exec(low);
      if (eu && hasDet) return { type: 'unknown', e: start + eu[0].length, why: 'EU-Rechtsakt nicht bestimmbar' };
    }
  }
  // Kürzel-artiges Wort direkt nach dem Zitat (ohne Artikel), nicht in der Bezeichnungsliste
  ABBR_TOKEN.lastIndex = start;
  const ab = ABBR_TOKEN.exec(P);
  if (ab && isAbbrLike(ab[0]) && !hasDet && /^\s*,?\s*$/.test(P.slice(pos, start))) return { type: 'unknown', e: start + ab[0].length, why: 'Kürzel unbekannt («' + ab[0] + '»)' };
  const abd = /^(\p{Lu}[\p{L}]{0,9})(\d+)(?![\p{L}\d])/u.exec(P.slice(start, start + 16));
  if (abd && isAbbrLike(abd[1]) && /^\s*,?\s*$/.test(P.slice(pos, start))) return { type: 'unknown', e: start + abd[0].length, why: 'Kürzel mit angehängter Zahl («' + abd[0] + '», Fussnotenzeichen im Wortlaut der Quelle?)' };
  return { type: 'none', e: pos };
}

// ------------------------------------------------------------------ Bezeichnungen und Labels

const WORDS = {
  de: { art: 'Art.', annex: 'Anhang', par: 'Abs.', let: 'Bst.', num: 'Ziff.', sep: ' ', sr: 'SR' },
  fr: { art: 'art.', annex: 'annexe', par: 'al.', let: 'let.', num: 'ch.', sep: ', ', sr: 'RS' },
  it: { art: 'art.', annex: 'allegato', par: 'cpv.', let: 'lett.', num: 'n.', sep: ' ', sr: 'RS' },
};
const EU_PAR = { de: 'Abs.', fr: 'par.', it: 'par.' };
const SEC_WORD = { de: 'Bst.', fr: 'section', it: 'sezione' }; // Grossbuchstaben-Gliederung in Staatsverträgen («Art. 1 Bst. C» der Flüchtlingskonvention)
function pathLabel(path, lang, isEu) {
  const W = WORDS[lang] || WORDS.de;
  const parts = [];
  const v = (x) => String(x).replace('-', '–');
  if (path.annex) parts.push(`${W.annex} ${v(path.annex)}`);
  if (path.art) parts.push(`${W.art} ${v(path.art)}`);
  if (path.sec) parts.push(`${SEC_WORD[lang] || SEC_WORD.de} ${path.sec}`);
  if (path.par) parts.push(`${isEu ? EU_PAR[lang] : W.par} ${v(path.par)}`);
  if (path.let) parts.push(`${W.let} ${v(path.let)}`);
  if (path.num) parts.push(`${W.num} ${v(path.num)}`);
  return parts.join(W.sep);
}
const EU_LABEL = {
  de: { R: 'Verordnung', L: 'Richtlinie', D: 'Beschluss', F: 'Rahmenbeschluss', inst: 'EU' },
  fr: { R: 'règlement', L: 'directive', D: 'décision', F: 'décision-cadre', inst: 'UE' },
  it: { R: 'regolamento', L: 'direttiva', D: 'decisione', F: 'decisione quadro', inst: 'UE' },
};
function euLabel(eu, lang) {
  const L = EU_LABEL[lang] || EU_LABEL.de;
  if (eu.type === 'R' && Number(eu.year) >= 2015) return `${L.R} (${L.inst}) ${eu.year}/${eu.no}`;
  if (eu.type === 'R') return `${L.R} ${lang === 'de' ? 'Nr.' : lang === 'fr' ? 'no' : 'n.'} ${eu.no}/${eu.year}`;
  return `${L[eu.type] || ''} ${eu.year}/${eu.no}`.trim();
}
function joinLabel(a, b, lang) { if (!a) return b; if (!b) return a; return a + (lang === 'fr' ? ', ' : ' ') + b; }

// ------------------------------------------------------------------ Index

const isHeading = (b) => b.ty === 'heading' || b.ty === 'table' || b.ty === 'img' || b.k === 'sh';
/** Quelle für Verweise? Nicht: Titel (ty heading), Tabellen, Bilder, Verweiszeile unter dem Titel (sh) bzw. am Anfang eines Anhangs «(Art. 2 Abs. 4 …)». */
export function isSourceBlock(unitType, b) {
  if (!b || isHeading(b)) return false;
  if (unitType === 'annex' && /^s1$/.test(b.k) && /^\s*\((?:Art|art)[^()]*\)\s*$/.test(plainText(b.t))) return false;
  return true;
}

/**
 * Verweis-Index eines Erlasses für eine Sprache und einen Stand.
 * @param {object} bundle   Bundle (schema 2)
 * @param {'de'|'fr'|'it'} lang
 * @param {string} stageId  Stand-Id (JJJJMMTT)
 * @param {{works?: Array<{id,sr,eli?,abbr,title,short?,bundle?}>}} opts
 */
export function buildRefIndex(bundle, lang, stageId, opts = {}) {
  const t0 = Date.now();
  const ds = bundle;
  const stage = ds.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Stand ${stageId} fehlt in ${ds.work && ds.work.id}`);
  const works = (opts.works || []).filter((w) => w && w.id !== ds.work.id);
  const lib = libraryIndex(works, lang);
  const own = { id: ds.work.id, sr: ds.work.sr, abbr: ds.work.abbr && ds.work.abbr[lang], type: workTypeOf(plainText(ds.work.title && ds.work.title[lang]), lang) };
  const reg = newRegister();

  // 1. Blöcke einsammeln
  const blocks = [];
  for (const e of tocAt(ds, stageId, lang)) {
    if (!e.unit) continue;
    const v = getVersion(ds, e.id, lang, stageId);
    if (!v || v.missing) continue;
    for (const b of v.blocks) {
      if (!isSourceBlock(e.type, b)) continue;
      const P = plainText(b.t);
      if (!/\d|\p{Lu}/u.test(P)) { RE_KW_ALL[lang].lastIndex = 0; if (!RE_KW_ALL[lang].test(P)) continue; }
      blocks.push({ unit: e.id, utype: e.type, v, b, P, srFns: srFootnotes(b), euFns: euFootnotes(b, lang) });
    }
  }

  // 2. Register lernen (zwei Durchgänge: im zweiten sind im ersten gelernte Kürzel bekannt)
  reg.ownerAbbrs = collectOwnerAbbrs(blocks, lang);
  const introOk = (d) => d.introAdj || reg.ownerAbbrs.has(d.intro) || introShapeOk(d, lang);
  for (let pass = 0; pass < 2; pass++) {
    for (const B of blocks) {
      REG_WHERE = B.unit + ' ' + B.b.k;
      for (const f of B.euFns) if (f.name) regPut(reg.euNames, normName(f.name), f.eu);
      B.desigs = findDesignations(B.P, lang, reg);
      markOwnerPositions(B, lang);
      const al = alignFootnotes(B.desigs, B.srFns, reg, lib, own);
      B.align = al;
      for (const [d, f] of al.res) {
        if (f.multi) continue;
        const val = { sr: f.sr, eli: f.eli };
        if (d.key) { regPut(reg.keys, d.key, val); if (d.kind === 'title' && lang === 'de' && !DE_GENERIC.has(d.noun ? deActStem(d.noun) : '')) regPut(reg.stems, 'stem|' + deActStem(d.noun), val); }
        if (d.kind === 'abbr') regPut(reg.abbr, d.abbr, val);
        if (d.intro && introOk(d)) regPut(reg.abbr, d.intro, val);
      }
      // Einführung ohne Fussnote, aber mit bekanntem Titel (Bibliothek)
      for (const d of B.desigs) if (d.intro && introOk(d) && !al.res.has(d)) { const k = knownTarget(d, reg, lib, own); if (k && k.sr) regPut(reg.abbr, d.intro, { sr: k.sr, eli: k.eli || null }); }
    }
  }
  for (const [k, v] of [...reg.stems]) if (!v) reg.stems.delete(k);

  // 3. Zitate und Nennungen auflösen
  const refs = [];
  let cid = 0;
  const date = stage.date;
  const ctx = { ds, lang, stageId, date, lib, own, reg, works, listRule: opts.listRule || 'v2', noBridge: opts.bridge === false };
  const byKey = new Map(blocks.map((B) => [B.unit + '\u0001' + B.b.k, B]));
  for (const B of blocks) {
    // Einleitungssatz steht vor den Punkten und ist darum schon verarbeitet (B._owned gesetzt)
    B.listCtx = listContext(B, byKey, lang, ctx);
    B._owned = new Set();
    const used = []; // Spannen von Zitaten (Bezeichnungen darin sind keine eigenen Nennungen)
    const blockChains = [];
    const P = B.P;
    RE_KW_ALL[lang].lastIndex = 0;
    let m;
    let skipTo = 0;
    const kws = [];
    while ((m = RE_KW_ALL[lang].exec(P))) kws.push({ i: m.index, w: m[0] });
    for (const k of kws) {
      if (k.i < skipTo) continue;
      if (B.desigs.some((d) => d.kind === 'eu' && k.i >= d.s && k.i < d.e)) continue;
      const inf = kwInfo(lang, k.w);
      const kw0 = { word: k.w, level: inf.level, form: inf.form, s: k.i, e: k.i + k.w.length };
      const ch = parseChain(P, kw0, lang);
      if (!ch || !ch.items.length) continue;
      let chains = [ch];
      // Eigentümer und Fortsetzung («66a StGB oder 49a MStG»)
      let endPos = ch.e;
      const out = [];
      for (let c = ch; c;) {
        let ow = ownerAt(P, c.ownFrom, lang, B.desigs, own.type);
        if (ow.type === 'none' && !ctx.noBridge) {
          // Brücke zur Erlassangabe: «(Art. 4–36) des Visakodex», «Artikel 1 Buchstabe C Ziffern 1–6 der Flüchtlingskonvention»
          const br = bridgeOwner(P, c, lang, B.desigs, own.type);
          if (br) { ow = br.owner; c.items = br.items; c.bridged = br.text; c.e = Math.max(c.e, br.e0); }
        }
        c.owner = ow;
        c.end = ow.type === 'none' ? c.e : Math.max(c.e, ow.e);
        out.push(c);
        endPos = c.end;
        // Fortsetzung mit blossen Nummern nach einer Erlass-Bezeichnung («66a StGB oder 49a MStG», FR «… de la présente loi et 21a LAsi»):
        // nur übernommen, wenn sie selbst eine Bezeichnung trägt; sonst nicht als Verweis geführt
        if ((ow.type !== 'desig' && ow.type !== 'self') || c.top !== 'art') break;
        const sl = stickyAt(SEP[lang], P, c.end);
        if (!sl) break;
        const t = tokenAt(P, c.end + sl, 'art');
        if (!t || kwAt(P, c.end + sl, lang)) break;
        const pseudo = { word: '', level: 'art', form: 'amb', s: c.end + sl, e: c.end + sl };
        const c2 = parseChain(P, pseudo, lang);
        if (!c2 || !c2.items.length) break;
        c2.continuation = true;
        c2.s = t.s;
        const ow2 = ownerAt(P, c2.ownFrom, lang, B.desigs, own.type);
        if (ow2.type !== 'desig' && ow2.type !== 'self') break;
        c = c2;
      }
      chains = out;
      skipTo = endPos;
      for (const c of chains) {
        if (c.owner && c.owner.d) B._owned.add(c.owner.d);
        used.push([c.s, c.end]);
        c.cid = cid++;
        if (c.owner.type === 'none' && B.listCtx) {
          if (B.listCtx.kind === 'owner') c.owner = { type: 'desig', e: c.owner.e, d: B.listCtx.d, B: B.listCtx.B, viaList: true };
          else c.owner = { type: 'unknown', e: c.owner.e, why: B.listCtx.why };
        }
        c.refs = resolveChain(c, B, ctx);
        blockChains.push(c);
      }
    }
    // Zitat ohne Bezeichnung, unmittelbar gefolgt von einem Zitat mit fremdem Erlass («articolo 8 e all’allegato VI … del codice»)
    for (let i = 0; i + 1 < blockChains.length; i++) {
      const a = blockChains[i], b2 = blockChains[i + 1];
      if (a.owner.type !== 'none' || !a.refs.length || a.refs.every((r) => r.uncertain)) continue;
      const gap = P.slice(a.end, b2.s);
      if (!GROUP_GAP[lang].test(gap)) continue;
      const bt = b2.refs.find((r) => !r.uncertain);
      if (!bt || bt.to.kind === 'internal' || b2.owner.type !== 'desig') continue;
      if (GROUP_PREP[lang].test(gap)) {
        // «art. 10, par. 6, et à l’art. 11, par. 6, du règlement …»: Bezeichnung gilt für beide Zitate
        const again = resolveChain({ ...a, owner: { ...b2.owner, e: a.end } }, B, ctx);
        if (again.length && again.every((r) => !r.uncertain)) { for (const r of again) r.via = 'group'; a.refs = again; continue; }
      }
      for (const r of a.refs) if (!r.uncertain) { r.uncertain = true; r.why = 'Bezug unklar: das anschliessende Zitat nennt einen anderen Erlass («' + b2.refs[0].text + '»)'; }
    }
    for (const c of blockChains) for (const r of c.refs) refs.push({ id: refs.length, cid: c.cid, ...r });
    // Nennungen ganzer Erlasse (ausserhalb von Zitaten)
    for (const d of B.desigs) {
      if (used.some(([s, e]) => d.s >= s && d.s < e)) continue;
      const r = resolveMention(d, B, ctx);
      if (!r) continue;
      const id = cid++;
      for (const x of r) refs.push({ id: refs.length, cid: id, ...x });
    }
  }
  // Reihenfolge: Blöcke in Dokumentreihenfolge, im Block nach Position; Nummern danach neu vergeben
  const blockPos = new Map(blocks.map((B, i) => [B.unit + '\u0001' + B.b.k, i]));
  refs.forEach((r, i) => { r._i = i; });
  refs.sort((a, b) => (blockPos.get(a.from.unit + '\u0001' + a.from.key) - blockPos.get(b.from.unit + '\u0001' + b.from.key)) || (a.at[0] - b.at[0]) || (a.hit[0] - b.hit[0]) || (a._i - b._i));
  const cidMap = new Map();
  refs.forEach((r, i) => { r.id = i; if (!cidMap.has(r.cid)) cidMap.set(r.cid, cidMap.size); r.cid = cidMap.get(r.cid); delete r._i; });
  cid = cidMap.size;
  for (const r of refs) if (r.why) r.whyCode = whyCodeOf(r.why);
  const stats = { total: refs.length, internal: 0, sr: 0, library: 0, eu: 0, other: 0, uncertain: 0, dangling: 0, citations: cid, blocks: blocks.length, ms: 0 };
  for (const r of refs) {
    if (r.uncertain) { stats.uncertain++; continue; }
    stats[r.to.kind] = (stats[r.to.kind] || 0) + 1;
    if (r.to.kind === 'sr' && r.to.work) stats.library++;
    if (r.to.missing) stats.dangling++;
  }
  const abbr = {};
  for (const [k, v] of [...reg.abbr].sort()) if (v) abbr[k] = v;
  for (const [k, v] of [...reg.euNames].sort()) if (v) abbr[k] = { eu: v };
  stats.ms = Date.now() - t0;
  const conflicts = [...new Map(reg.conflicts.map((c) => [c.key, { key: c.key, values: [c.a, c.b].map((x) => x.sr || (x.celex ? 'eu:' + x.celex : '?')), at: c.at }])).values()];
  return { work: ds.work.id, lang, stage: stageId, date, refs, stats, abbr, conflicts };
}

// Gliederungsangaben zwischen Zitat und Erlassangabe («Buchstabe C», «Abschnitt A», «section C», «Titel III», «Kapitel 2»)
const STRUCT = {
  de: /\s*,?\s*(?:Buchstaben?|Bst\.|Abschnitt|Abschnitts|Titel|Titels|Kapitel|Kapitels|Teil|Teils|Unterabsatz)\s+(?:[A-Z](?![\p{L}\d])|[IVXLC]+(?![\p{L}\d])|\d+[a-z]?(?![\p{L}\d]))/uy,
  fr: /\s*,?\s*(?:lettres?|let\.|section|sous-section|titre|chapitre|partie)\s+(?:[A-Z](?![\p{L}\d])|[IVXLC]+(?![\p{L}\d])|\d+[a-z]?(?![\p{L}\d]))\s*,?/uy,
  it: /\s*,?\s*(?:lettere?|lett\.|sezione|titolo|capitolo|parte)\s+(?:[A-Z](?![\p{L}\d])|[IVXLC]+(?![\p{L}\d])|\d+[a-z]?(?![\p{L}\d]))/uy,
};
/**
 * Sucht hinter einem Zitat ohne Erlassangabe im selben Satzteil die Erlassangabe, über erlaubte Brücken:
 * schliessende Klammer (wenn das Zitat in Klammern steht), Gliederungsangaben mit Grossbuchstaben/römischer Zahl,
 * weitere Unterteilungen (Absatz/Ziffer …, kein neuer Artikel). Liefert die neue Erlassangabe und die ergänzten Items oder null.
 */
function bridgeOwner(P, c, lang, desigs, ownType) {
  let pos = c.ownFrom;
  const before = P.slice(0, c.s);
  const inParen = before.lastIndexOf('(') > before.lastIndexOf(')');
  let parenClosed = false, used = false;
  let items = c.items;
  let e0 = c.e;
  for (let step = 0; step < 6; step++) {
    const ws = stickyAt(/[\s,]*/y, P, pos);
    if (inParen && !parenClosed && P[pos + ws] === ')') { pos += ws + 1; parenClosed = true; used = true; continue; }
    const st = stickyAt(STRUCT[lang], P, pos);
    if (st) {
      const m = /(Buchstaben?|Bst\.|Abschnitt|lettres?|let\.|section|lettere?|lett\.|sezione)\s+([A-Z])(?![\p{L}\d])/u.exec(P.slice(pos, pos + st));
      if (m && items.length === 1) { const vs = pos + P.slice(pos, pos + st).indexOf(m[2], m.index + m[1].length); items = [{ segs: [...items[0].segs, { level: 'sec', v: m[2], s: vs, e: vs + 1 }], hit: items[0].hit }]; }
      pos += st; used = true; continue;
    }
    const k = kwAt(P, pos + ws, lang);
    if (k && k.level !== 'art' && k.level !== 'annex') {
      const sub = parseChain(P, k, lang);
      if (!sub || !sub.items.length || items.length !== 1) return null;
      const base = items[0].segs;
      items = sub.items.map((it) => ({ segs: [...base, ...it.segs], hit: it.hit }));
      pos = sub.ownFrom; e0 = sub.e; used = true;
      continue;
    }
    break;
  }
  if (!used) return null;
  const ow = ownerAt(P, pos, lang, desigs, ownType);
  if (ow.type === 'none' || ow.type === 'annex') return null;
  return { owner: ow, items, e0, text: P.slice(c.e, pos) };
}

/**
 * Feste Liste der Gründe für `uncertain` (sprachunabhängig, für die Oberfläche DE/FR/IT); `why` bleibt deutscher Klartext.
 * anaphor  Rückverweis auf einen vorher genannten Erlass («dieser Verordnungen», «desdits règlements», «derselben …» ohne eindeutigen Bezug)
 * act-type Demonstrativ auf einen Erlass anderer Art («dieser Verordnung» in einem Gesetz)
 * act      Erlass nicht bestimmbar (Gattungswort ohne Datum/Kürzel, kein SR-Nachweis)
 * no-sr    Erlass genannt, aber ohne SR-Fussnote und ohne Registereintrag
 * abbr     Kürzel unbekannt bzw. mit angehängter Zahl
 * eu       EU-Rechtsakt nicht bestimmbar (ohne Nummer, ohne Gattung, Name mehrdeutig)
 * fn       SR-Fussnote nicht eindeutig zuordenbar, mehrere SR-Nummern, Bezeichnung im Erlass mehrdeutig
 * sub      Unterteilung ohne Artikel bei fremdem Erlass
 * annex    Anhang mit römischer Zahl ohne EU-Bezug oder Anhang eines anderen Erlasses
 * list     Aufzählung: Bezugserlass des Einleitungssatzes nicht eindeutig
 * group    Zitat ohne Erlassangabe vor einem Zitat eines anderen Erlasses
 * range    Bereich am Stand nicht auflösbar
 * other    sonstiger Grund
 */
export const WHY_CODES = ['anaphor', 'act-type', 'act', 'no-sr', 'abbr', 'eu', 'fn', 'sub', 'annex', 'list', 'group', 'range', 'other'];
function whyCodeOf(why) {
  const w = String(why || '');
  if (/^Demonstrativ/.test(w)) return 'act-type';
  if (/^Rückverweis/.test(w)) return 'anaphor';
  if (/^Aufzählung/.test(w)) return 'list';
  if (/^Bezug unklar/.test(w)) return 'group';
  if (/^Bereich/.test(w)) return 'range';
  if (/^Unterteilung/.test(w)) return 'sub';
  if (/^Anhang/.test(w)) return 'annex';
  if (/^Kürzel/.test(w)) return 'abbr';
  if (/^(EU-|Name eines EU)/.test(w)) return 'eu';
  if (/^(SR-Fussnote|Fussnote nennt|Bezeichnung im Erlass)/.test(w)) return 'fn';
  if (/^Erlass ohne SR/.test(w)) return 'no-sr';
  if (/^Erlass nicht bestimmbar/.test(w)) return 'act';
  return 'other';
}

/** Kürzel in Klammern nach einem Gesetzes-/Verordnungstitel, das wie ein Erlasskürzel gebaut ist (DE …G/…V, FR/IT L…/O…/C…). */
function introShapeOk(d, lang) {
  if (d.kind !== 'title' && d.kind !== 'named') return false;
  const noun = String(d.noun || d.key || '').toLowerCase();
  const a = d.intro || '';
  if (lang === 'de') return /(gesetz|gesetzbuch|verordnung)/.test(noun) && /(?:G|V|VO|GB)$/.test(a);
  return /^(?:loi|ordonnance|code|legge|ordinanza|codice|named\|)/.test(noun) && /^(?:L|O|C)/.test(a);
}

/** Kürzel, die irgendwo im Erlass direkt nach einem Zitat stehen («Artikel 26a ELG»): Beleg, dass sie Erlasse bezeichnen. */
function collectOwnerAbbrs(blocks, lang) {
  const set = new Set();
  for (const B of blocks) {
    const P = B.P;
    for (const ch of quickChains(B, lang)) {
      const dl = stickyAt(OWNER_DET[lang], P, ch.ownFrom);
      ABBR_TOKEN.lastIndex = ch.ownFrom + dl;
      const ab = ABBR_TOKEN.exec(P);
      if (ab && isAbbrLike(ab[0])) set.add(ab[0]);
    }
  }
  return set;
}

const GROUP_GAP = {
  de: /^\s*,?\s*(?:und|oder|sowie|bzw\.)\s+(?:\p{L}+\s+){0,2}$/u,
  fr: /^\s*,?\s*(?:et|ou|ainsi\s+qu[’']?)\s*(?:\p{L}+[’']?\s*){0,3}$/u,
  it: /^\s*,?\s*(?:e|ed|o|od|nonché)\s+(?:\p{L}+[’']?\s*){0,3}$/u,
};
// Lücke nur aus Bindewort und Präposition/Artikel: Bezeichnung des folgenden Zitats gilt auch für das vorangehende
const GROUP_PREP = {
  de: /^\s*,?\s*(?:und|oder|sowie)\s+(?:(?:nach|gemäss|in|im|von)\s+)?(?:(?:den|dem|der|des|die)\s+)?$/u,
  fr: /^\s*,?\s*(?:et|ou)\s+(?:(?:à|de)\s+)?(?:l[’']\s?|la\s+|le\s+|les\s+|aux\s+|au\s+|des\s+|du\s+)?$/u,
  it: /^\s*,?\s*(?:e|ed|o|od)\s+(?:all[’']\s?|agli\s+|al\s+|alla\s+|ai\s+|dell[’']\s?|degli\s+|del\s+|della\s+|dei\s+|nell[’']\s?|nel\s+|nella\s+|l[’']\s?|il\s+|gli\s+|i\s+)?$/u,
};
// Einleitungssatz einer Aufzählung: «gestützt auf die nachfolgend genannten Artikel und Absätze des Visakodex:»
const LIST_OWNER = {
  de: /(?:nachfolgend\s+genannten|nachfolgenden|nachfolgende|folgenden|folgende|nachstehenden|nachstehende|nachstehend\s+genannten)\s+(?:Artikel\s+und\s+Absätze|Artikel|Bestimmungen|Absätze)\s+/gu,
  fr: /(?:des|les|aux)\s+(?:articles\s+et\s+paragraphes|articles|dispositions)\s+suivant(?:e)?s\s+/gu,
  it: /(?:degli|gli|agli|delle|le|alle)\s+(?:(?:articoli\s+e\s+paragrafi|articoli|disposizioni)\s+seguenti|seguenti\s+(?:articoli|disposizioni))\s+/gu,
};
const short = (x, n = 60) => (x.length > n ? x.slice(0, n - 1) + '…' : x).replace(/\s+/g, ' ');
/** Beginn des letzten Satzes (nach «. » + Grossbuchstabe), sonst 0. */
function lastSentenceStart(P) {
  const re = /[.;]\s+(?=\p{Lu})/gu;
  let m, last = 0;
  while ((m = re.exec(P))) if (m.index < P.trimEnd().length - 1) last = m.index + m[0].length;
  return last;
}
/** Bezeichnungen, die im Block Eigentümer eines Artikelzitats sind («Artikel 66a StGB»). */
function chainOwnerDesigs(B, lang, ctx) {
  if (B._owned) return B._owned;
  const set = new Set();
  const P = B.P;
  RE_KW_ALL[lang].lastIndex = 0;
  let m, skip = 0;
  while ((m = RE_KW_ALL[lang].exec(P))) {
    if (m.index < skip) continue;
    const inf = kwInfo(lang, m[0]);
    const ch = parseChain(P, { word: m[0], level: inf.level, form: inf.form, s: m.index, e: m.index + m[0].length }, lang);
    if (!ch) continue;
    skip = ch.e;
    const ow = ownerAt(P, ch.ownFrom, lang, B.desigs, ctx.own.type);
    if (ow.d) set.add(ow.d);
  }
  // Fortsetzungen «… StGB oder Artikel 49a MStG» sind eigene Zitate und oben erfasst; Bezeichnung im Zitattext ebenso
  B._owned = set;
  return set;
}
function listContext(B, byKey, lang, ctx) {
  // Einleitungssatz = nächster vorangehender Block derselben Einheit mit kleinerer Tiefe (d), bis zu zwei Stufen
  const blocks = B.v.blocks;
  let idx = blocks.indexOf(B.b);
  let depth = B.b.d || 0;
  for (let step = 0; step < 2 && depth > 0; step++) {
    let j = idx - 1;
    while (j >= 0 && (blocks[j].d || 0) >= depth) j--;
    if (j < 0) return null;
    const PB = byKey.get(B.unit + '\u0001' + blocks[j].k);
    idx = j; depth = blocks[j].d || 0;
    if (!PB) continue;
    const t = PB.P.trim();
    if (!/:$/.test(t)) continue;
    LIST_OWNER[lang].lastIndex = 0;
    let m, found = null;
    while ((m = LIST_OWNER[lang].exec(PB.P))) {
      const start = m.index + m[0].length;
      const dl = stickyAt(OWNER_DET[lang], PB.P, start);
      const d = PB.desigs.find((z) => z.s === start + dl || z.s === start);
      if (d) found = d;
    }
    if (found) {
      const T = desigTarget(found, PB, ctx);
      if (T && !T.why && !T.self) return { kind: 'owner', d: found, B: PB };
      if (T && T.self) return null;
      return { kind: 'foreign', why: 'Aufzählung: Bezugserlass im Einleitungssatz nicht bestimmbar' };
    }
    const isForeign = (d) => { if (d.kind === 'abbr' && !d.evidence) return false; const T = desigTarget(d, PB, ctx); return !!(T && !T.self && !T.why); };
    if (ctx.listRule === 'wide') {
      // frühere, zu weite Regel (nur für den Vorher-Nachher-Vergleich im Prüfbericht)
      if (PB.desigs.some(isForeign)) return { kind: 'foreign', why: 'Aufzählung unter einem Einleitungssatz, der einen anderen Erlass nennt (Bezug nicht eindeutig)' };
      return null;
    }
    // Ein blosser Artikelverweis bezieht sich auf den eigenen Erlass. Unsicher nur, wenn der letzte Satz des Einleitungssatzes
    // einen anderen Erlass als Ganzes nennt (ohne eigene Artikelangabe), z. B. «Durchführungsrechtsakte zum Visakodex …:»;
    // ein in sich vollständiges Zitat («nach Artikel 66a StGB …:») macht die Punkte nicht unsicher.
    const lastS = lastSentenceStart(PB.P);
    const owned = chainOwnerDesigs(PB, lang, ctx);
    const whole = PB.desigs.filter((d) => d.s >= lastS && !owned.has(d) && isForeign(d));
    if (whole.length) return { kind: 'foreign', why: `Aufzählung: der Einleitungssatz nennt einen anderen Erlass als Ganzes («${short(PB.P.slice(whole[0].s, whole[0].coreE))}»), Bezug der Punkte nicht eindeutig` };
    return null;
  }
  return null;
}

/** Zitate eines Blocks ohne Eigentümer (nur Lage), einmal je Block berechnet. */
function quickChains(B, lang) {
  if (B._qc) return B._qc;
  const out = [];
  const P = B.P;
  RE_KW_ALL[lang].lastIndex = 0;
  let m, skip = 0;
  while ((m = RE_KW_ALL[lang].exec(P))) {
    if (m.index < skip) continue;
    const inf = kwInfo(lang, m[0]);
    const ch = parseChain(P, { word: m[0], level: inf.level, form: inf.form, s: m.index, e: m.index + m[0].length }, lang);
    if (!ch) continue;
    skip = ch.e;
    out.push(ch);
  }
  B._qc = out;
  return out;
}
function markOwnerPositions(B, lang) {
  // Kürzel direkt nach einem Zitat sind Pflichtkandidaten für Fussnoten
  const P = B.P;
  for (const ch of quickChains(B, lang)) {
    const dl = stickyAt(OWNER_DET[lang], P, ch.ownFrom);
    const d = B.desigs.find((z) => z.s === ch.ownFrom + dl && z.kind === 'abbr');
    if (d) d.ownerPos = true;
  }
}

/** Ziel für eine Bezeichnung (Fussnote im Block vor Register und Bibliothek). */
function desigTarget(d, B, ctx) {
  if (d.kind === 'eu') return { eus: d.eus };
  if (d.kind === 'euname') {
    const local = B.euFns.find((f) => f.name && normName(f.name) === d.name);
    if (local) return { eus: [local.eu] };
    if (d.info) return { eus: [d.info] };
    return { why: 'Name eines EU-Rechtsakts mehrdeutig («' + d.name + '»)' };
  }
  if (B.align.amb.has(d)) {
    const k = knownTarget(d, ctx.reg, ctx.lib, ctx.own);
    if (k && k.self) return { self: true };
    return { why: 'SR-Fussnote nicht eindeutig zuordenbar' };
  }
  const f = B.align.res.get(d);
  if (f) {
    if (f.multi) return { why: 'Fussnote nennt mehrere SR-Nummern' };
    return { sr: f.sr, eli: f.eli };
  }
  const k = knownTarget(d, ctx.reg, ctx.lib, ctx.own);
  if (k && k.self) return { self: true };
  if (k && k.sr) return { sr: k.sr, eli: k.eli };
  if (k === null && (d.kind === 'abbr' ? ctx.reg.abbr.get(d.abbr) === null : ctx.reg.keys.get(d.key) === null)) return { why: 'Bezeichnung im Erlass mehrdeutig (verschiedene SR-Nummern)' };
  return null;
}

function workBySr(ctx, sr) { return ctx.lib.bySr.get(sr) || null; }

function srTarget(ctx, sr, eli, textAbbr) {
  if (sr === ctx.own.sr) return { kind: 'internal', work: ctx.own.id };
  const w = workBySr(ctx, sr);
  const abbr = (w && w.abbr && w.abbr[ctx.lang]) || (textAbbr || null) || abbrForSr(ctx, sr);
  const t = { kind: 'sr', sr, eli: eli || (w && w.eli) || null };
  if (abbr) t.abbr = abbr;
  if (w) {
    t.work = w.id;
    if (w.title && w.title[ctx.lang]) t.title = plainText(w.title[ctx.lang]);
    if (w.bundle) {
      const st = stageAt(w.bundle, ctx.date);
      if (st) t.stage = st; else t.unchecked = true;
    } else t.unchecked = true;
  }
  return t;
}
function abbrForSr(ctx, sr) {
  for (const [k, v] of ctx.reg.abbr) if (v && v.sr === sr && isAbbrLike(k)) return k;
  return null;
}

function resolveMention(d, B, ctx) {
  if (d.kind === 'abbr' && !d.evidence) return null;
  if (d.kind === 'abbr' && !d.known && !B.align.res.has(d)) return null;
  const T = desigTarget(d, B, ctx);
  const text = B.P.slice(d.s, d.coreE);
  const base = { from: { unit: B.unit, key: B.b.k }, text, at: [d.s, d.coreE], hit: [d.s, d.coreE] };
  if (!T) {
    if (d.kind === 'title' && d.adjacent && !d.generic) return [{ ...base, to: { kind: 'other', path: {}, label: text }, uncertain: true, why: 'Erlass ohne SR-Fussnote und ohne Registereintrag' }];
    return null;
  }
  if (T.self) return null;
  if (T.why) return d.kind === 'abbr' && !d.ownerPos ? null : [{ ...base, to: { kind: 'other', path: {}, label: text }, uncertain: true, why: T.why }];
  if (T.eus) return T.eus.map((eu, i) => { const t = euTextLabel(B.P, d, i, eu, ctx.lang); return { ...base, to: { kind: 'eu', eu, path: {}, label: t, euText: t } }; });
  const to = srTarget(ctx, T.sr, T.eli, d.kind === 'abbr' ? d.abbr : d.intro);
  if (to.kind === 'internal') return null;
  to.path = {};
  to.label = to.abbr || `${WORDS[ctx.lang].sr} ${to.sr}`;
  return [{ ...base, to }];
}
/** Bezeichnung eines EU-Rechtsakts so, wie sie an der Fundstelle steht («Verordnung (EG) Nr. 810/2009», «Schengener Grenzkodex»). */
function euTextLabel(PP, d, i, eu, lang) {
  const clean = (x) => x.replace(/\s+/g, ' ').trim();
  if (d && d.kind === 'eu' && d.parts && d.parts[i]) return clean(PP.slice(d.parts[i][0], d.parts[i][1]).replace(/^\s*,?\s*(?:und|oder|sowie|et|ou|e|o|ed)\s+/u, ''));
  if (d && d.kind === 'euname') return clean(PP.slice(d.s, d.coreE));
  return euLabel(eu, lang);
}
function euOrName(eu, d, lang) { return d && d.kind === 'euname' ? d.name.replace(/^./, (c) => c.toUpperCase()) === d.name ? d.name : euLabel(eu, lang) : euLabel(eu, lang); }

/** Erzeugt die Refs eines Zitats. */
function resolveChain(c0, B, ctx) {
  let c = c0;
  const { lang } = ctx;
  const P = B.P;
  const text = P.slice(c.s, c.end).replace(/\s+$/, '');
  const at = [c.s, c.s + text.length];
  const from = { unit: B.unit, key: B.b.k };
  const ow = c.owner;
  const out = [];
  const mk = (it, to, extra = {}) => ({ from, text, at, hit: it.hit.slice(), to, ...extra });
  const pathOf = (segs) => {
    const p = {};
    for (const s of segs) {
      const val = s.to ? `${s.v}-${s.to}` : s.v;
      const lv = s.level === 'pt' ? 'let' : s.level;
      if (lv === 'num' && p.num) p.num += '.' + val; else p[lv] = val;
    }
    return p;
  };
  // Owner-Ziel
  let tgt = null;
  if (ow.type === 'same') {
    // «derselben Verordnung», «de la même loi»: nur wenn im Block vorher genau ein Erlass genannt ist
    const prevT = new Map();
    for (const d of B.desigs) {
      if (d.e > c.s) continue;
      const T = desigTarget(d, B, ctx);
      if (!T || T.why || T.self) continue;
      const k = T.eus ? 'eu:' + T.eus.map((x) => x.celex).join(',') : 'sr:' + T.sr;
      prevT.set(k, { T, d });
    }
    if (prevT.size === 1) { const [{ d }] = [...prevT.values()]; c.owner = ow.d = undefined; return resolveChain({ ...c, owner: { type: 'desig', e: ow.e, d } }, B, ctx); }
    ow.type = 'anaphor'; ow.why = 'Rückverweis auf einen vorher genannten Erlass, nicht eindeutig (' + ow.why + ')';
  }
  if (ow.type === 'anaphor' || ow.type === 'unknown') {
    for (const it of c.items) out.push(mk(it, { kind: 'other', path: pathOf(it.segs), label: pathLabel(pathOf(it.segs), lang) }, { uncertain: true, why: ow.why }));
    return out;
  }
  if (ow.type === 'desig') {
    const T = desigTarget(ow.d, ow.B || B, ctx);
    if (!T || T.why) {
      for (const it of c.items) out.push(mk(it, { kind: 'other', path: pathOf(it.segs), label: joinLabel(pathLabel(pathOf(it.segs), lang), P.slice(ow.d.s, ow.d.coreE), lang) }, { uncertain: true, why: (T && T.why) || 'Erlass nicht bestimmbar («' + P.slice(ow.d.s, ow.d.coreE) + '»)' }));
      return out;
    }
    if (T.self) tgt = { internal: true };
    else if (T.eus) tgt = { eus: T.eus, d: ow.d };
    else tgt = { sr: T.sr, eli: T.eli, textAbbr: ow.d.kind === 'abbr' ? ow.d.abbr : ow.d.intro };
  } else tgt = { internal: true };

  if (ow.annexTok && !tgt.internal) for (const it of c.items) it.segs = [{ level: 'annex', v: ow.annexTok.v, s: ow.annexTok.s, e: ow.annexTok.e, roman: ow.annexTok.roman }, ...it.segs];
  // Relative Zitate ohne Artikel: gleiche Einheit (nur im eigenen Erlass)
  const relative = !c.items.some((it) => it.segs.some((s) => s.level === 'art' || s.level === 'annex'));
  if (ow.type === 'annex') {
    // «Ziffer 2 des Anhangs 1»: Anhang als oberste Stufe
    for (const it of c.items) it.segs = [{ level: 'annex', v: ow.tok.v, s: ow.tok.s, e: ow.tok.e, roman: ow.tok.roman }, ...it.segs];
  } else if (!tgt.internal && !(tgt.sr && tgt.sr === ctx.own.sr)) {
    // Unterteilungen ohne Artikel («Absatz 7 DSG», «al. 1, l’art. 65, al. 2, PA»): bei fremdem Erlass nicht bestimmbar
    const rel = c.items.filter((it) => !it.segs.some((s) => s.level === 'art' || s.level === 'annex'));
    for (const it of rel) out.push(mk(it, { kind: 'other', path: pathOf(it.segs), label: pathLabel(pathOf(it.segs), lang) }, { uncertain: true, why: 'Unterteilung ohne Artikel bei fremdem Erlass' }));
    if (rel.length === c.items.length) return out;
    c = { ...c, items: c.items.filter((it) => !rel.includes(it)) };
  }

  if (tgt.eus) {
    const PP = ow.B ? ow.B.P : P;
    for (const [ei, eu] of tgt.eus.entries()) for (const it of c.items) {
      const path = euPath(pathOf(it.segs));
      const et = euTextLabel(PP, tgt.d, ei, eu, lang);
      out.push(mk(it, { kind: 'eu', eu, path, label: joinLabel(pathLabel(path, lang, true), et, lang), euText: et }));
    }
    return out;
  }
  if (tgt.internal || (tgt.sr && tgt.sr === ctx.own.sr)) {
    for (const it of c.items) {
      const itRel = ow.type !== 'annex' && !it.segs.some((s) => s.level === 'art' || s.level === 'annex');
      for (const r of internalTargets(it, B, ctx, ctx.ds, ctx.stageId, itRel)) out.push(mk(it, r.to, r.extra));
    }
    return out;
  }
  // SR-Erlass (Bibliothek oder ausserhalb)
  const base = srTarget(ctx, tgt.sr, tgt.eli, tgt.textAbbr);
  const w = base.work ? ctx.lib.bySr.get(base.sr) : null;
  const suffix = base.abbr || `${WORDS[lang].sr} ${base.sr}`;
  for (const it of c.items) {
    if (w && w.bundle && base.stage) {
      for (const r of internalTargets(it, B, ctx, w.bundle, base.stage, false)) {
        const to = { ...base, ...r.to, kind: 'sr', work: w.id, stage: base.stage };
        to.label = joinLabel(r.to.label, suffix, lang);
        out.push(mk(it, to, r.extra));
      }
    } else {
      const path = pathOf(it.segs);
      const to = { ...base, path, label: joinLabel(pathLabel(path, lang), suffix, lang) };
      const unit = path.art && !/-/.test(path.art) ? artUnitId(path.art) : path.annex && !/-/.test(path.annex) ? 'annex_' + path.annex : null;
      if (unit) to.unit = unit;
      if (/-/.test(path.art || '')) to.range = true;
      out.push(mk(it, to));
    }
  }
  return out;
}

/** Ziele in einem Bundle (eigener Erlass oder Bibliothek) mit Existenzprüfung am Stand. */
function internalTargets(it, B, ctx, ds, stageId, relative) {
  const lang = ctx.lang;
  const segs = it.segs.map((s) => ({ ...s, level: s.level === 'pt' ? 'let' : s.level }));
  const out = [];
  const top = segs[0];
  const sub = segs.filter((s) => s.level === 'par' || s.level === 'let' || s.level === 'num');
  const isOwn = ds === ctx.ds;
  const label = (path) => pathLabel(path, lang);
  const unitPaths = [];
  if (relative) {
    unitPaths.push({ unit: B.unit, path: {}, rel: true });
  } else if (top.level === 'annex') {
    if (top.roman) return [{ to: { kind: 'other', path: { annex: top.v }, label: label({ annex: top.v }) }, extra: { uncertain: true, why: 'Anhang mit römischer Zahl ohne EU-Bezug' } }];
    const T = unitTable(ds, lang, stageId);
    const vals = top.to ? numRange(top.v, top.to) : [top.v];
    for (const v of vals) unitPaths.push({ unit: T.annex.get(v) || 'annex_' + v, path: { annex: v }, exists: T.annex.has(v), range: !!top.to });
  } else if (top.level === 'art') {
    if (top.to) {
      const T = unitTable(ds, lang, stageId);
      const a = resolveArt(ds, lang, stageId, top.v), b = resolveArt(ds, lang, stageId, top.to);
      const ia = T.pos.get(a.unit), ib = T.pos.get(b.unit);
      if (ia == null || ib == null || ib < ia) {
        return [{ to: { kind: 'internal', path: { art: `${top.v}-${top.to}` }, label: label({ art: `${top.v}-${top.to}` }), range: true, missing: true }, extra: { uncertain: true, why: 'Bereich am Stand nicht auflösbar (Anfang oder Ende fehlt)' } }];
      }
      // jeder am Stand vorhandene Artikel des Bereichs; aufgehobene Hüllen nur als Anfang oder Ende des Bereichs
      for (let i = ia; i <= ib; i++) {
        const uid = T.order[i];
        if (i !== ia && i !== ib) { const vv = getVersion(ds, uid, lang, stageId); if (vv && vv.repealed) continue; }
        unitPaths.push({ unit: uid, path: { art: numOfUnit(ds, uid) }, range: true });
      }
    } else unitPaths.push({ unit: null, path: { art: top.v } });
  } else return [];
  const relUnit = ds.units[B.unit];
  const relBase = relUnit && relUnit.type === 'article' ? { art: plainNum(relUnit.num || '') } : relUnit && relUnit.type === 'annex' ? { annex: plainNum(relUnit.num || '') } : {};
  for (const up of unitPaths) {
    const labelFor = (path) => label(up.rel ? { ...relBase, ...path } : path);
    let unit = up.unit, v = null, viaRange = false;
    if (up.rel) { unit = B.unit; v = B.v; }
    else if (up.path.art && !up.unit) { const r = resolveArt(ds, lang, stageId, up.path.art); unit = r.unit; v = r.version; viaRange = !!r.viaRange; }
    else v = getVersion(ds, unit, lang, stageId);
    const to = { kind: 'internal', work: ds.work.id, unit, path: { ...up.path } };
    if (up.range) to.range = true;
    if (!v || v.missing || v.repealed) to.missing = true;
    // Unterteilung
    if (sub.length) {
      const want = {};
      for (const s of sub) want[s.level] = s.level === 'num' && want.num ? want.num + '.' + s.v : s.v;
      // relative Anker
      if (up.rel) {
        const src = keySegs(B.b.k);
        const highest = ['par', 'let', 'num'].find((l) => want[l] != null);
        if (highest === 'let') { const p = src.find((x) => x.t === 'par'); if (p) want.par = p.v; }
        if (highest === 'num') { const p = src.find((x) => x.t === 'par'); if (p) want.par = p.v; const l = src.find((x) => x.t === 'let'); if (l) want.let = l.v; }
      }
      const rs = sub.find((s) => s.to);
      if (rs) {
        Object.assign(to.path, pathFromWant(want, rs));
        if (v && !to.missing) {
          const keys = rangeKeys(v.blocks, { ...want, [rs.level]: undefined }, rs.level, rs.v, rs.to);
          if (keys && keys.length) {
            for (const k of keys) out.push({ to: { ...to, key: k.key, path: { ...to.path, [rs.level]: k.v }, label: labelFor({ ...to.path, [rs.level]: k.v }), range: true } });
            continue;
          }
          to.keyMissing = true;
        }
      } else {
        Object.assign(to.path, want);
        if (v && !to.missing) { const k = findKey(v.blocks, want) || annexKey(ds, unit, v.blocks, want); if (k) to.key = k; else to.keyMissing = true; }
      }
    }
    if (viaRange) to.via = 'range';
    to.label = labelFor(to.path);
    out.push({ to });
  }
  return out;
}
/** Anhänge: «Ziffer 1» ist die Überschrift mit Gliederungszeichen «1.» (Schlüssel h1), darunter Buchstaben. */
function annexKey(ds, unit, blocks, want) {
  const u = ds.units[unit];
  if (!u || u.type !== 'annex' || want.num == null || want.par != null) return null;
  const heads = blocks.filter((b) => /^h\d+$/.test(b.k) && plainNum(b.l || '').replace(/\.$/, '') === want.num);
  if (heads.length !== 1) return null;
  if (want.let == null) return heads[0].k;
  const k = heads[0].k + '.' + want.let;
  return blocks.some((b) => b.k === k) ? k : null;
}
// EU-Rechtsakte: eingefügte Artikel heissen DE «23a, 42b», FR/IT «23 bis, 42 ter»; sprachunabhängig als Buchstabe geführt
const EU_LAT = { bis: 'a', ter: 'b', quater: 'c', quinquies: 'd', sexies: 'e', septies: 'f', octies: 'g', novies: 'h', nonies: 'h', decies: 'i',
  undecies: 'j', duodecies: 'k', terdecies: 'l', quaterdecies: 'm', quinquiesdecies: 'n', quindecies: 'n', sexiesdecies: 'o', sexdecies: 'o',
  septiesdecies: 'p', septdecies: 'p', octiesdecies: 'q', octodecies: 'q', noviesdecies: 'r', novodecies: 'r', vicies: 's' };
function euPath(p) {
  const q = { ...p };
  for (const l of ['art', 'par']) if (q[l]) q[l] = String(q[l]).replace(new RegExp(`^(\\d+)(${LATIN})$`), (m, n, lat) => n + (EU_LAT[lat] || lat)).replace(new RegExp(`(-)(\\d+)(${LATIN})$`), (m, d, n, lat) => d + n + (EU_LAT[lat] || lat));
  return q;
}
function pathFromWant(want, rs) { const p = { ...want }; p[rs.level] = `${rs.v}-${rs.to}`; return p; }
function numRange(a, b) { const x = intOf(a), y = intOf(b); const out = []; if (String(x) !== a || String(y) !== b || y - x > 50) return [a, b]; for (let i = x; i <= y; i++) out.push(String(i)); return out; }
function numOfUnit(ds, unitId) { const u = ds.units[unitId]; return u ? plainNum(u.num || '') : null; }
function unitNumLabel(ds, unitId) { const u = ds.units[unitId]; return u && u.type === 'article' ? plainNum(u.num || '') : null; }

// ------------------------------------------------------------------ Abfragen für die Oberfläche

const keyUnder = (k, key) => k === key || (typeof k === 'string' && k.startsWith(key + '.'));

/** Ausgehende Verweise einer Einheit bzw. eines Blocks (deep: samt Unterblöcken). */
export function refsFrom(index, unit, key = null, { deep = true, uncertain = false } = {}) {
  return index.refs.filter((r) => r.from.unit === unit && (key == null || (deep ? keyUnder(r.from.key, key) : r.from.key === key)) && (uncertain || !r.uncertain));
}

/** Eingehende Verweise auf { work, unit, key } aus einem Index (eigener oder anderer Erlass). */
export function refsTo(index, { work, unit, key = null }, { deep = true, uncertain = false } = {}) {
  return index.refs.filter((r) => {
    if (!uncertain && r.uncertain) return false;
    const t = r.to;
    if (t.work !== work || t.unit !== unit) return false;
    if (key == null) return true;
    if (!t.key) return false;
    return deep ? keyUnder(t.key, key) : t.key === key;
  });
}

const pathStr = (p) => ['art', 'annex', 'sec', 'par', 'let', 'num'].filter((l) => p && p[l] != null).map((l) => `${l}=${p[l]}`).join(',');
/** Sprachunabhängige Identität eines Ziels. */
export function targetKey(to) {
  if (!to) return '';
  if (to.kind === 'eu') return `eu:${to.eu.celex || to.eu.type + to.eu.year + '/' + to.eu.no}#${pathStr(to.path)}`;
  if (to.kind === 'internal' || (to.kind === 'sr' && to.work)) return `w:${to.work}#${to.unit || ''}#${to.key ? 'k=' + to.key : pathStr(to.path)}`;
  if (to.kind === 'sr') return `sr:${to.sr}#${pathStr(to.path)}`;
  return `other:${pathStr(to.path)}`;
}
/** Knoten für Netz und Struktur. units=false: externe Ziele je Erlass. */
export function nodeKey(to, { units = true } = {}) {
  if (to.kind === 'internal' || (to.kind === 'sr' && to.work)) return to.unit ? `w:${to.work}#${to.unit}` : `w:${to.work}`;
  if (to.kind === 'sr') return units && to.unit ? `sr:${to.sr}#${to.unit}` : `sr:${to.sr}`;
  if (to.kind === 'eu') { const id = to.eu.celex || `${to.eu.type}${to.eu.year}/${to.eu.no}`; return units && to.path && to.path.art ? `eu:${id}#art_${to.path.art}` : `eu:${id}`; }
  return 'other';
}
/** Kanten Quell-Einheit → Ziel-Knoten mit Zahl der Fundstellen (verschiedene cid). */
export function edges(index, { externalUnits = false } = {}) {
  const map = new Map();
  for (const r of index.refs) {
    if (r.uncertain) continue;
    const t = r.to;
    if (t.kind === 'other') continue;
    if (t.work === index.work && t.unit === r.from.unit) continue;
    const nk = nodeKey(t, { units: externalUnits || t.kind === 'internal' || !!t.work });
    const k = r.from.unit + '\u0001' + nk;
    let e = map.get(k);
    if (!e) { e = { from: r.from.unit, to: nk, target: t, n: 0, refs: [], _c: new Set() }; map.set(k, e); }
    e.refs.push(r);
    if (!e._c.has(r.cid)) { e._c.add(r.cid); e.n++; }
  }
  return [...map.values()].map(({ _c, ...e }) => e);
}

/** Link nach aussen: Fedlex (mit ELI) bzw. EUR-Lex (mit CELEX); sonst null. */
export function externalUrl(to, lang = 'de') {
  if (!to) return null;
  const L = ['de', 'fr', 'it'].includes(lang) ? lang : 'de';
  if (to.kind === 'eu') return to.eu && to.eu.celex ? `https://eur-lex.europa.eu/legal-content/${L.toUpperCase()}/TXT/?uri=CELEX:${to.eu.celex}` : null;
  if (to.kind === 'sr' || to.kind === 'internal') {
    const eli = to.eli;
    if (!eli || !/^https:\/\/fedlex\.data\.admin\.ch\/eli\/cc\/[\w/]+$/.test(eli)) return null;
    const anchor = to.unit && /^(art_[\w]+|annex_\d+)$/.test(to.unit) && !to.range ? `#${to.unit}` : '';
    return `${eli.replace('https://fedlex.data.admin.ch/', 'https://www.fedlex.admin.ch/')}/${L}${anchor}`;
  }
  return null;
}

/** Werkliste für buildRefIndex aus data/library.json bzw. { order, works }. */
export function worksFromLibrary(library) {
  const ws = library && library.works ? library.works : {};
  const order = library && library.order ? library.order : Object.keys(ws);
  return order.filter((id) => ws[id]).map((id) => {
    const w = ws[id].work;
    return { id, sr: w.sr, eli: w.eli, abbr: w.abbr || {}, title: w.title || {}, short: w.short || {}, bundle: ws[id] };
  });
}
