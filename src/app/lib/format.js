// Datums- und Textformate für die Oberfläche (DE Schweizer Hochdeutsch, FR und IT nach den Weisungen der Bundeskanzlei).
import { uiLang } from './i18n.js';

const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
};
const LOCALE = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH' };

/** "2025-10-12" -> DE "12. Oktober 2025", FR "12 octobre 2025" ("1er"), IT "12 ottobre 2025" ("1° gennaio"). */
export function fmtDate(iso, lang = uiLang()) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = Number(m[3]);
  if (lang === 'fr') return `${d === 1 ? '1er' : d} ${MONTHS.fr[Number(m[2]) - 1]} ${m[1]}`;
  if (lang === 'it') return `${d === 1 ? '1°' : d} ${MONTHS.it[Number(m[2]) - 1]} ${m[1]}`;
  return `${d}. ${MONTHS.de[Number(m[2]) - 1]} ${m[1]}`;
}
/** Monat und Jahr: "April 2025", "avril 2025", "aprile 2025" */
export function fmtMonth(iso, lang = uiLang()) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '');
  return m ? `${(MONTHS[lang] || MONTHS.de)[Number(m[2]) - 1]} ${m[1]}` : '';
}
/** Uhrzeit HH:MM in der Oberflächensprache */
export function fmtTime(date, lang = uiLang()) {
  return date.toLocaleTimeString(LOCALE[lang] || 'de-CH', { hour: '2-digit', minute: '2-digit' });
}
/** "2025-10-12" -> "12.10.2025" (für sehr enge Stellen) */
export function fmtDateShort(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : '';
}
export const todayIso = () => localIso(new Date());
/** Lokales Kalenderdatum als JJJJ-MM-TT (nicht UTC). */
export function localIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Zahlengruppen mit schmalem Leerzeichen */
export function fmtNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export const LANG_CODES = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN', rm: 'RM' };

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
/** Inline-HTML aus den Daten als reiner Text (Tags entfernt, Entities dekodiert, Leerraum vereinheitlicht). */
export function plain(html) {
  return stripTags(html).replace(/\s+/g, ' ').trim();
}
export function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''));
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
/** Für Suche: Kleinbuchstaben, Akzente und Umlaute entfernt, ß -> ss */
export function fold(s) {
  return String(s || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[  ]/g, ' ');
}
