// Sprache der Oberfläche (DE, FR, IT), unabhängig von der Sprache des Rechtstexts.
//
// API für alle Module (auch Etappe 2):
//   registerStrings(lang, dict)  Wörterbuch ergänzen; verschachtelte Objekte werden zu Punkt-Schlüsseln ("read.mode.stand").
//                                Pluralformen als Objekt { one: '…', other: '…' } (Auswahl über Intl.PluralRules mit vars.n).
//   t(key, vars?)                Text in der aktuellen Oberflächensprache; {name} wird aus vars ersetzt, {n} als Zahl formatiert.
//                                Fehlt ein Schlüssel, erscheint "⟦key⟧" (Tests suchen danach).
//   tx(key)                      Rohwert (z. B. Arrays für Listen in der Anleitung).
//   has(key)                     Schlüssel vorhanden?
//   uiLang()                     'de' | 'fr' | 'it'
//   setUiLang(lang, {persist})   Sprache wechseln (Standard: speichern in localStorage).
//   onUiLangChange(fn)           Abonnement; liefert Abmeldefunktion.
//   useUiLang()                  Preact-Hook: rendert die Komponente beim Sprachwechsel neu und liefert die Sprache.
//   withUiLang(lang, fn)         fn synchron in einer anderen Sprache ausführen (Exportkarten in der Sprache ihrer Erstellung).
import { useEffect, useState } from 'preact/hooks';

export const UI_LANGS = ['de', 'fr', 'it'];
export const HTML_LANG = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH' };
const STORE_KEY = 'sr-navigator.ui';
const dicts = { de: Object.create(null), fr: Object.create(null), it: Object.create(null) };
const subs = new Set();
let current = 'de';
let override = null;

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !isPlural(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
function isPlural(v) {
  const ks = Object.keys(v);
  return ks.length > 0 && ks.every((k) => ['zero', 'one', 'two', 'few', 'many', 'other'].includes(k)) && 'other' in v;
}

export function registerStrings(lang, dict) {
  if (!dicts[lang]) dicts[lang] = Object.create(null);
  Object.assign(dicts[lang], flatten(dict, '', {}));
}
/** Alle Schlüssel einer Sprache (für Tests). */
export const keysOf = (lang) => Object.keys(dicts[lang] || {});

export function uiLang() { return override || current; }

export function setUiLang(lang, { persist = true } = {}) {
  if (!UI_LANGS.includes(lang)) return;
  if (persist) { try { localStorage.setItem(STORE_KEY, lang); } catch { /* file:// ohne Speicher */ } }
  if (lang === current) return;
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = HTML_LANG[lang];
  for (const f of subs) f(lang);
}
export function onUiLangChange(fn) { subs.add(fn); return () => subs.delete(fn); }

export function useUiLang() {
  const [l, set] = useState(current);
  useEffect(() => onUiLangChange(set), []);
  return l;
}

export function withUiLang(lang, fn) {
  const prev = override;
  override = UI_LANGS.includes(lang) ? lang : prev;
  try { return fn(); } finally { override = prev; }
}

/** Startsprache: gespeicherte Wahl, sonst Browsersprache fr* → FR, it* → IT, sonst DE. */
export function initialUiLang(fromHash) {
  if (UI_LANGS.includes(fromHash)) return fromHash;
  try { const s = localStorage.getItem(STORE_KEY); if (UI_LANGS.includes(s)) return s; } catch { /* ignorieren */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages && navigator.languages[0]) || navigator.language || '' : '';
  return /^fr/i.test(nav) ? 'fr' : /^it/i.test(nav) ? 'it' : 'de';
}

const nf = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pr = {};
function plural(lang, n) {
  if (!pr[lang]) pr[lang] = new Intl.PluralRules(HTML_LANG[lang] || 'de-CH');
  return pr[lang].select(n);
}

export function has(key) { return key in dicts[uiLang()]; }
export function tx(key) {
  const l = uiLang();
  return key in dicts[l] ? dicts[l][key] : dicts.de[key];
}

export function t(key, vars) {
  const l = uiLang();
  let v = dicts[l][key];
  if (v === undefined) return `⟦${key}⟧`;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const n = vars && typeof vars.n === 'number' ? vars.n : 0;
    v = v[plural(l, n)] ?? v.other;
  }
  if (typeof v !== 'string') return v;
  if (!vars) return v;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (typeof vars[k] === 'number' ? nf(vars[k]) : String(vars[k] ?? '')) : m));
}
