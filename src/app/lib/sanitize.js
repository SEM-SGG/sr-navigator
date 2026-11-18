// Allowlist-Bereinigung für Text aus dem Datensatz und aus Uploads (SPEC §5.2).
const INLINE = new Set(['i', 'b', 'sup', 'sub', 'br', 'em', 'strong']);
const TABLE = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'p', 'br', 'i', 'b', 'sup', 'sub', 'em', 'strong', 'colgroup', 'col']);
const cacheI = new Map();
const cacheT = new Map();

function clean(html, allowed, keepSpan) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (m, close, name, attrs) => {
      const n = name.toLowerCase();
      if (!allowed.has(n)) return '';
      if (n === 'br') return '<br>';
      if (close) return `</${n}>`;
      let a = '';
      if (keepSpan && (n === 'td' || n === 'th' || n === 'col')) {
        const cs = /colspan\s*=\s*["']?(\d+)/i.exec(attrs);
        const rs = /rowspan\s*=\s*["']?(\d+)/i.exec(attrs);
        if (cs) a += ` colspan="${cs[1]}"`;
        if (rs) a += ` rowspan="${rs[1]}"`;
      }
      return `<${n}${a}>`;
    });
}
export function safeInline(html) {
  const s = String(html || '');
  let r = cacheI.get(s);
  if (r === undefined) { r = clean(s, INLINE, false); if (cacheI.size > 20000) cacheI.clear(); cacheI.set(s, r); }
  return r;
}
export function safeTable(html) {
  const s = String(html || '');
  let r = cacheT.get(s);
  if (r === undefined) { r = clean(s, TABLE, true); cacheT.set(s, r); }
  return r;
}
/** Titel als Inline-HTML für Überschriften: i, sup, sub, br bleiben, Fettung entfällt (die Überschrift ist bereits fett). */
export function titleInline(html) {
  return safeInline(html).replace(/<\/?(b|strong)>/g, '');
}

// Fussnoten: zusätzlich Links, aber nur auf Fedlex (SPEC §5.1), in neuem Tab und ohne Referrer.
const NOTE = new Set(['i', 'b', 'sup', 'sub', 'br', 'em', 'strong', 'a']);
const SAFE_HREF = /^https:\/\/(fedlex\.data\.admin\.ch|www\.fedlex\.admin\.ch)\/[^\s"'<>]*$/;
export const isFedlexUrl = (u) => SAFE_HREF.test(String(u || ''));
const cacheN = new Map();
export function safeNote(html) {
  const s = String(html || '');
  let r = cacheN.get(s);
  if (r !== undefined) return r;
  r = s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (m, close, name, attrs) => {
      const n = name.toLowerCase();
      if (!NOTE.has(n)) return '';
      if (n === 'br') return '<br>';
      if (close) return `</${n}>`;
      if (n === 'a') {
        const h = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(attrs);
        const href = h ? (h[1] || h[2] || '').replace(/&amp;/g, '&') : '';
        if (!SAFE_HREF.test(href)) return '<a>';
        return `<a href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
      }
      return `<${n}>`;
    })
    .replace(/<a>([\s\S]*?)<\/a>/g, '$1');
  if (cacheN.size > 20000) cacheN.clear();
  cacheN.set(s, r);
  return r;
}
