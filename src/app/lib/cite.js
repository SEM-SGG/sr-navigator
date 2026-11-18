// Zitierweise nach den Weisungen der Bundeskanzlei (SPEC §3 und §7 Ziff. 10).
// DE: "Art. 5 Abs. 1 Bst. a Ziff. 2 AIG", "Art. 10a Abs. 2 AIG", "Anhang 1 Ziff. 2.1 VEV"
// FR: "art. 5, al. 1, let. a, ch. 2, LEI"   (Komma zwischen den Gliederungseinheiten und vor dem Kürzel)
// IT: "art. 5 cpv. 1 lett. a n. 2 LStrI"    (ohne Komma)
// Lateinische Zusätze der Quelle bleiben erhalten ("Art. 10a", "al. 1bis", "Bst. abis").
// Fehlt das Kürzel des Erlasses: "SR 142.206" bzw. "RS 142.206".

const ORD = {
  de: ['', 'erster', 'zweiter', 'dritter', 'vierter', 'fünfter', 'sechster', 'siebter', 'achter', 'neunter', 'zehnter'],
  it: ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo', 'nono', 'decimo'],
};
const LATIN = '(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|nonies|decies)';
const SEP = { de: ' ', fr: ', ', it: ' ' };
const WORD = {
  de: { art: 'Art.', annex: 'Anhang', par: 'Abs.', let: 'Bst.', num: 'Ziff.', table: 'Tabelle', preamble: 'Ingress' },
  fr: { art: 'art.', annex: 'annexe', par: 'al.', let: 'let.', num: 'ch.', table: 'tableau', preamble: 'préambule' },
  it: { art: 'art.', annex: 'allegato', par: 'cpv.', let: 'lett.', num: 'n.', table: 'tabella', preamble: 'ingresso' },
};

/** "1_bis" → "1bis", "a_bis" → "abis" */
const latin = (v) => String(v).replace(new RegExp(`_(${LATIN})$`), '$1');

/** Zerlegt einen Blockschlüssel in typisierte Segmente. */
export function parseKey(key) {
  if (!key) return [];
  const segs = [];
  for (const raw of String(key).split('.')) {
    let m;
    if (raw === 'p') segs.push({ type: 'para0' });
    else if ((m = new RegExp(`^p(\\d+[a-z]?(?:_?${LATIN})?)$`).exec(raw))) segs.push({ type: 'par', v: latin(m[1]) });
    else if ((m = new RegExp(`^n(\\d+[a-z]?(?:_?${LATIN})?)$`).exec(raw))) segs.push({ type: 'num', v: latin(m[1]) });
    else if ((m = /^s(\d+)$/.exec(raw))) segs.push({ type: 'sub', v: Number(m[1]) });
    else if ((m = /^d(\d+)$/.exec(raw))) segs.push({ type: 'dash', v: Number(m[1]) });
    else if (/^(h\d+|hd)$/.test(raw)) segs.push({ type: 'head' });
    else if ((m = /^t(\d+)$/.exec(raw))) segs.push({ type: 'table', v: Number(m[1]) });
    else if ((m = /^g(\d+)$/.exec(raw))) segs.push({ type: 'img', v: Number(m[1]) });
    else if ((m = new RegExp(`^([a-z]{1,2}(?:_?${LATIN})?)$`).exec(raw))) segs.push({ type: 'let', v: latin(m[1]) });
    else segs.push({ type: 'raw', v: raw });
  }
  return segs;
}

function dash(n, lang) {
  if (lang === 'fr') return `${n === 1 ? '1er' : n + 'e'} tiret`;
  if (lang === 'it') return `${ORD.it[n] || n + '°'} trattino`;
  return `${ORD.de[n] || n + '.'} Strich`;
}

/** Werkkürzel in der Sprache, sonst SR-Nummer ("SR 142.206", FR/IT "RS 142.206"). */
export function workAbbr(abbr, sr, lang) {
  const a = abbr && abbr[lang];
  if (a) return a;
  if (sr) return `${lang === 'de' ? 'SR' : 'RS'} ${sr}`;
  return '';
}

/**
 * Zitat einer Einheit oder Bestimmung.
 * @param {{type:string,num:string,label?:string}} unit  type: article | annex | preamble | final
 * @param {string|null} key  Blockschlüssel (p1.a.n2)
 * @param {'de'|'fr'|'it'} lang
 * @param {string|null} abbr  Werkkürzel bzw. "SR …" (null: ohne)
 */
export function cite(unit, key, lang = 'de', abbr = null) {
  if (!unit) return '';
  const L = WORD[lang] ? lang : 'de';
  const W = WORD[L];
  const parts = [];
  if (unit.type === 'annex') parts.push(`${W.annex} ${unit.num || ''}`.trim());
  else if (unit.type === 'preamble') parts.push(W.preamble);
  else if (unit.type === 'final') parts.push(unit.label || unit.num || '');
  else parts.push(`${W.art} ${unit.num || ''}`.trim());
  // aufeinanderfolgende Ziffern (Anhang 2.1.3) als eine Dezimalgliederung zitieren
  const segs = [];
  for (const g of parseKey(key)) {
    const last = segs[segs.length - 1];
    if (g.type === 'num' && last && last.type === 'num') last.v = `${last.v}.${g.v}`;
    else segs.push({ ...g });
  }
  for (const g of segs) {
    if (g.type === 'par') parts.push(`${W.par} ${g.v}`);
    else if (g.type === 'let') parts.push(`${W.let} ${g.v}`);
    else if (g.type === 'num') parts.push(`${W.num} ${g.v}`);
    else if (g.type === 'dash') parts.push(dash(g.v, L));
    else if (g.type === 'table') parts.push(`${W.table} ${g.v}`);
    // para0 (einziger Absatz), sub (weiterer Textteil), head, img: ohne eigene Zitierstufe
  }
  let s = parts.filter(Boolean).join(SEP[L]);
  if (abbr) s += SEP[L] + abbr;
  return s;
}

/** Kurzform ohne Werkkürzel, für Listen. */
export const citeShort = (unit, key, lang = 'de') => cite(unit, key, lang, null);
