// SR-Navigator — Textnormalisierung (ESM, isomorph)
// Wird fuer Vergleiche verwendet (Versionserkennung, Validierung). Der angezeigte Text bleibt unveraendert.

export const ROMAN_RE = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)[a-z]?$/;

export function normLabelKey(l) {
  return String(l || '').replace(/[()\s.]/g, '').toLowerCase();
}

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

// Vergleichsnormalisierung: rein redaktionelle Unterschiede entfernen
const NCACHE = new Map();
export function normText(t, opts) {
  const caseFold = !!(opts && opts.caseFold);
  const key = String(t || '');
  const ck = caseFold ? '\u0001' + key : key;
  const hit = NCACHE.get(ck);
  if (hit !== undefined) return hit;
  const r = normTextRaw(key, caseFold);
  if (NCACHE.size > 300000) NCACHE.clear();
  NCACHE.set(ck, r);
  return r;
}
function normTextRaw(t, caseFold) {
  let s = t;
  s = s.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');
  s = s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m]);
  s = s.replace(/­/g, '');                                   // weiches Trennzeichen
  s = s.replace(/[  -​  　\t\r\n]+/g, ' ');
  s = s.replace(/[„“”‟"«»‹›]/g, '"').replace(/[‚‘’‛`´]/g, "'");
  s = s.replace(/[—–‑‒−]/g, '-');
  s = s.replace(/…/g, '...');
  s = s.replace(/[⁰¹²³⁴-⁹]/g, (c) => '0123456789'['⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)]);
  s = s.replace(/\bn\s*[°º]\s*/g, 'no ').replace(/\bN\s*[°º]\s*/g, 'No ');
  s = s.replace(/ +/g, ' ');
  // Leerzeichen um Satzzeichen und Anfuehrungszeichen vereinheitlichen
  s = s.replace(/ ?([,;:!?.)\]]) ?/g, '$1 ').replace(/([(\[]) /g, '$1');
  s = s.replace(/" ?/g, '"').replace(/ ?"/g, '"').replace(/' /g, "'").replace(/ '/g, "'");
  s = s.replace(/ +/g, ' ').replace(/ ([,;:!?.)\]])/g, '$1').trim();
  if (caseFold) s = s.toLowerCase();
  return s;
}

// Woerter fuer Diff und Abdeckungsmessung
export function tokens(t) {
  const s = normText(t);
  return s.split(/(?=[,;:!?.()"'\[\]])|(?<=[,;:!?.()"'\[\]])| /).map((x) => x.trim()).filter(Boolean);
}

// Einfache Aehnlichkeit (Dice ueber Wortbigramme), 0..1
export function similarity(a, b) {
  const A = normText(a).toLowerCase().split(' ');
  const B = normText(b).toLowerCase().split(' ');
  if (!A.length && !B.length) return 1;
  if (A.join(' ') === B.join(' ')) return 1;
  const grams = (arr) => {
    const m = new Map();
    for (let i = 0; i < arr.length - 1; i++) { const g = arr[i] + ' ' + arr[i + 1]; m.set(g, (m.get(g) || 0) + 1); }
    if (arr.length === 1) m.set(arr[0], 1);
    return m;
  };
  const ga = grams(A), gb = grams(B);
  let inter = 0, na = 0, nb = 0;
  for (const v of ga.values()) na += v;
  for (const v of gb.values()) nb += v;
  for (const [g, v] of ga) if (gb.has(g)) inter += Math.min(v, gb.get(g));
  return na + nb ? (2 * inter) / (na + nb) : 0;
}

// Schneller, synchroner Hash (cyrb53) fuer Bild-Deduplizierung, hex
export function hashString(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
