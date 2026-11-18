// Wort-Diff auf bereinigtem Inline-HTML (erlaubt: i b sup sub br).
// Tags bleiben auf der jeweiligen Seite erhalten, Text wird wortweise verglichen.
import { diffArrays } from 'diff';
import { decodeEntities, escapeHtml } from './format.js';

const TOKEN = /(<[^>]+>)|([\s  ]+)|([\p{L}\p{N}\p{M}]+(?:[’'\-‑][\p{L}\p{N}\p{M}]+)*)|([^\s<])/gu;

export function tokenize(html) {
  const out = [];
  const src = String(html || '');
  // Text ausserhalb von Tags dekodieren, Tags unverändert
  const parts = src.split(/(<[^>]+>)/);
  for (const part of parts) {
    if (!part) continue;
    if (part[0] === '<' && part[part.length - 1] === '>') { out.push({ tag: true, v: normTag(part) }); continue; }
    const text = decodeEntities(part);
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(text))) out.push({ tag: false, v: m[0], ws: !!m[2] });
  }
  return out;
}
function normTag(t) {
  const m = /^<\s*(\/?)\s*([a-z0-9]+)/i.exec(t);
  if (!m) return '';
  const name = m[2].toLowerCase();
  if (!['i', 'b', 'sup', 'sub', 'br', 'em', 'strong'].includes(name)) return '';
  if (name === 'br') return '<br>';
  return `<${m[1]}${name}>`;
}

const cache = new Map();
const MAX_CACHE = 4000;

/**
 * Vergleicht zwei Texte.
 * @returns {{changed:boolean, oldHtml:string, newHtml:string, redline:string, ins:number, del:number}}
 */
export function diffText(oldHtml, newHtml) {
  const ck = `${oldHtml}\u0000${newHtml}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const a = tokenize(oldHtml);
  const b = tokenize(newHtml);
  const parts = cleanup(diffArrays(a, b, { comparator: (x, y) => x.tag === y.tag && x.v === y.v }), a, b);
  let oldOut = '', newOut = '', red = '', ins = 0, del = 0;
  const emit = (tokens, mode) => {
    // mode: 'eq' | 'del' | 'ins'; liefert HTML, Tags ausserhalb der Markierung.
    // Reine Leerzeichen sowie Leerzeichen am Rand einer Markierung bleiben unmarkiert.
    if (mode !== 'eq') {
      if (tokens.every((t) => t.tag || t.ws)) return emit(tokens, 'eq');
      let a = 0, b = tokens.length;
      while (a < b && tokens[a].ws) a++;
      while (b > a && tokens[b - 1].ws) b--;
      if (a > 0 || b < tokens.length) return emit(tokens.slice(0, a), 'eq') + emit(tokens.slice(a, b), mode) + emit(tokens.slice(b), 'eq');
    }
    let s = '', open = false;
    const wrap = mode === 'del' ? ['<del>', '</del>'] : mode === 'ins' ? ['<ins>', '</ins>'] : null;
    for (const t of tokens) {
      if (t.tag) {
        if (open) { s += wrap[1]; open = false; }
        s += t.v;
      } else {
        if (wrap && !open) { s += wrap[0]; open = true; }
        s += escapeHtml(t.v);
      }
    }
    if (open) s += wrap[1];
    return s;
  };
  const textOnly = (tokens) => tokens.filter((t) => !t.tag || t.v === '<br>');
  for (const p of parts) {
    if (p.removed) {
      del += p.value.filter((t) => !t.tag && !t.ws).length;
      oldOut += emit(p.value, 'del');
      red += emit(textOnly(p.value), 'del');
    } else if (p.added) {
      ins += p.value.filter((t) => !t.tag && !t.ws).length;
      newOut += emit(p.value, 'ins');
      red += emit(p.value, 'ins');
    } else {
      const e = emit(p.value, 'eq');
      oldOut += e; newOut += e; red += e;
    }
  }
  const res = { changed: ins + del > 0, oldHtml: oldOut, newHtml: newOut, redline: red, ins, del };
  if (cache.size > MAX_CACHE) cache.clear();
  cache.set(ck, res);
  return res;
}

const words = (toks) => toks.filter((t) => !t.tag && !t.ws).length;

/**
 * Semantische Bereinigung: kurze gemeinsame Stücke zwischen zwei Änderungen (bis 2 Wörter)
 * werden der Änderung zugeschlagen, damit zusammenhängende Streichungen und Einfügungen entstehen.
 * Ist der Text weitgehend neu gefasst (weniger als 40 % gemeinsame Wörter), wird er als ganzer ersetzt, ausser der
 * kürzere Text bleibt zu mindestens 60 % und mit einem zusammenhängenden Stück von vier oder mehr Wörtern erhalten.
 */
function cleanup(parts, a, b) {
  const isChg = (p) => p && (p.added || p.removed);
  const common = parts.filter((p) => !isChg(p)).reduce((n, p) => n + words(p.value), 0);
  const total = Math.max(words(a), words(b));
  if (total >= 6 && common / total < 0.4) {
    // Ausnahme: Der kürzere Text bleibt weitgehend und zusammenhängend erhalten (z. B. ein Absatz erhält einen
    // zweiten Satz). Dann zeigt der Wort-Diff die Ergänzung bzw. Kürzung, statt den ganzen Text zu ersetzen.
    const small = Math.min(words(a), words(b));
    const longestRun = parts.filter((p) => !isChg(p)).reduce((n, p) => Math.max(n, words(p.value)), 0);
    const kept = small > 0 && common / small >= 0.6 && longestRun >= 4;
    if (!kept) return [{ removed: true, value: a }, { added: true, value: b }];
  }
  for (let i = 1; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isChg(p) && isChg(parts[i - 1]) && isChg(parts[i + 1]) && words(p.value) <= 2 && !p.value.some((t) => t.tag)) p.absorb = true;
  }
  const out = [];
  let rem = [], add = [];
  const flush = () => {
    if (rem.length) out.push({ removed: true, value: rem });
    if (add.length) out.push({ added: true, value: add });
    rem = []; add = [];
  };
  for (const p of parts) {
    if (p.removed) rem = rem.concat(p.value);
    else if (p.added) add = add.concat(p.value);
    else if (p.absorb) { rem = rem.concat(p.value); add = add.concat(p.value); }
    else { flush(); out.push(p); }
  }
  flush();
  return out;
}

/** Ganzer Text als eingefügt bzw. gestrichen markiert. */
export const markAll = (html, mode) => {
  const toks = tokenize(html);
  let s = '', open = false;
  const [o, c] = mode === 'del' ? ['<del>', '</del>'] : ['<ins>', '</ins>'];
  for (const t of toks) {
    if (t.tag) { if (open) { s += c; open = false; } s += t.v; }
    else { if (!open) { s += o; open = true; } s += escapeHtml(t.v); }
  }
  if (open) s += c;
  return s;
};
