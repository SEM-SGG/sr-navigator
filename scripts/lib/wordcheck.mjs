// Unabhängige Vergleichsextraktion für die Wortlautprüfung (SPEC §8 Nr. 1).
// Bewusst ohne DOM und ohne Code aus src/core: Text direkt aus dem XML-String über reguläre Ausdrücke.
import { diffArrays } from 'diff';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}

// Vergleichsnormalisierung: nur typografische Varianten, kein Eingriff in Wörter
export function vnorm(s) {
  return String(s).normalize('NFC')
    .replace(/­/g, '')
    .replace(/[  -​  　]/g, ' ')
    .replace(/[„“”‟"«»‹›]/g, '"').replace(/[‚‘’‛`´]/g, "'")
    .replace(/[—–‑‒−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[⁰¹²³⁴-⁹]/g, (c) => '0123456789'['⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)])
    .replace(/\bn\s*[°º]/g, 'no').replace(/\bN\s*[°º]/g, 'No');
}
// ohne typografische Normalisierung (nur Unicode-NFC), für die Zählung typografischer Abweichungen
export function tokenizeRaw(s) {
  return String(s).normalize('NFC').replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ').match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
}
// Typografische Abweichungen als Paare «Quelle → Datensatz»
export function typoPairs(src, got) {
  const parts = diffArrays(src, got);
  const pairs = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.removed && parts[i + 1] && parts[i + 1].added) { pairs.push([p.value.join(''), parts[i + 1].value.join('')]); i++; }
    else if (p.removed) pairs.push([p.value.join(''), '']);
    else if (p.added) pairs.push(['', p.value.join('')]);
  }
  return pairs;
}
export function tokenize(s) {
  return vnorm(s).match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) || [];
}

const INLINE = 'b|i|u|sup|sub|span|inline|ref|placeholder|docNumber|docTitle|abbr|term';

// Quelltext ohne Metadaten, ohne Titelblatt des Erlasses und ohne Fussnoten
export function sourceText(xml) {
  let s = xml;
  s = s.replace(/<meta>[\s\S]*?<\/meta>/g, ' ');
  s = s.replace(/<preface>[\s\S]*?<\/preface>/, ' ');          // nur das erste <preface> (Titelblatt des Erlasses)
  const notes = [];
  s = s.replace(/<authorialNote\b[^>]*>([\s\S]*?)<\/authorialNote>/g, (m, inner) => { notes.push(inner); return ''; });
  s = s.replace(/<placeholder\b[^>]*>[\s\S]*?<\/placeholder>/g, ' ');
  s = s.replace(new RegExp(`</?(?:${INLINE})\\b[^>]*>`, 'g'), '');
  s = s.replace(/<[^>]+>/g, ' ');
  const fn = notes.map((n) => decode(n.replace(new RegExp(`</?(?:${INLINE})\\b[^>]*>`, 'g'), '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  return { text: decode(s), notes: fn };
}

function stripHtml(h) { return decode(String(h || '').replace(/<br\s*\/?>/g, ' ').replace(/<\/?(td|th|tr|table)\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '')); }

// Vergleich zweier Tokenfolgen: fehlende (nur Quelle) und zusätzliche (nur Datensatz) Wörter mit Umgebung
export function compareTokens(src, got, { context = 6, maxList = 40 } = {}) {
  const parts = diffArrays(src, got);
  let common = 0, missing = 0, extra = 0, iSrc = 0;
  const gaps = [];
  for (const p of parts) {
    const n = p.count ?? p.value.length;
    if (!p.added && !p.removed) { common += n; iSrc += n; continue; }
    if (p.removed) {
      missing += n;
      if (gaps.length < maxList) gaps.push({ kind: 'fehlt', words: p.value.join(' ').slice(0, 300), at: src.slice(Math.max(0, iSrc - context), iSrc).join(' ') });
      iSrc += n;
    } else {
      extra += n;
      if (gaps.length < maxList) gaps.push({ kind: 'zusätzlich', words: p.value.join(' ').slice(0, 300), at: src.slice(Math.max(0, iSrc - context), iSrc).join(' ') });
    }
  }
  return { total: src.length, common, missing, extra, coverage: src.length ? common / src.length : 1, gaps };
}

export { stripHtml };
