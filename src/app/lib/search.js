// Suche: Artikel- und Anhangnummern ("8", "Art. 8a", "8 bis", "Anhang V") und Volltext.
import { fold, escapeHtml } from './format.js';

// Lateinische Zusätze bleiben Teil der Nummer ("26bis", "108dquinquies"), wie in der SR.
const LATIN = '(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|nonies|decies)';

export function parseRef(q) {
  const s = fold(q).trim().replace(/\s+/g, ' ');
  let m = new RegExp(`^(?:art(?:ikel|icle|icolo|\\.)?\\s*)?(\\d{1,3})\\s*([a-z]?)\\s*(${LATIN})?(?:\\s*(?:abs\\.?|al\\.?|cpv\\.?|\\()\\s*(\\d+(?:\\s*${LATIN})?)\\)?)?$`).exec(s);
  if (m) return { type: 'article', num: m[1] + (m[2] || '') + (m[3] || ''), par: m[4] ? m[4].replace(/\s+/g, '') : null };
  m = /^(?:anhang|annexe?|allegato|anx\.?)\s*([ivxlc]+|\d+)$/.exec(s);
  if (m) return { type: 'annex', num: /^\d+$/.test(m[1]) ? m[1] : m[1].toUpperCase() };
  return null;
}

function snippet(raw, qf) {
  let folded = '';
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    const f = fold(raw[i]);
    for (let j = 0; j < f.length; j++) { folded += f[j]; map.push(i); }
  }
  const at = folded.indexOf(qf);
  if (at < 0) return escapeHtml(raw.slice(0, 140));
  const s = map[at], e = map[Math.min(at + qf.length - 1, map.length - 1)] + 1;
  const from = Math.max(0, s - 60), to = Math.min(raw.length, e + 80);
  return `${from > 0 ? '… ' : ''}${escapeHtml(raw.slice(from, s))}<mark>${escapeHtml(raw.slice(s, e))}</mark>${escapeHtml(raw.slice(e, to))}${to < raw.length ? ' …' : ''}`;
}

export function search(data, q, lang, stageId, limit = 150) {
  const out = { refs: [], hits: [], total: 0 };
  const query = (q || '').trim();
  if (!query) return out;
  const ref = parseRef(query);
  if (ref) {
    for (const id of data.unitOrder) {
      const m = data.unitMeta(id);
      if (m.type === ref.type && String(m.num).toLowerCase() === ref.num.toLowerCase()) out.refs.push({ unit: id, key: ref.par ? `p${ref.par}` : null });
    }
  }
  const qf = fold(query);
  if (qf.length < 2 && !ref) return out;
  if (ref && out.refs.length) return out; // Verweis gefunden: keine Volltexttreffer
  if (ref && /^\d/.test(qf) && qf.length <= 4) return out; // reine Nummer: keine Volltexttreffer
  for (const e of data.searchIndex(lang, stageId)) {
    if (e.text.includes(qf)) {
      out.total++;
      if (out.hits.length < limit) out.hits.push({ unit: e.unit, key: e.key, html: snippet(e.raw, qf) });
    }
  }
  return out;
}
