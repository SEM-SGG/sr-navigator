// Gemeinsame Prüfhilfen der UI-Tests (SR-Navigator; übernommen vom SGK-Navigator und ergänzt).

/** Prüft im Browser: unbeabsichtigter Überlauf, Ellipsen ohne Tooltip, Überlappungen in Standleiste, Zeitstrahl, Inhaltsverzeichnis, Kopfzeile. */
export const layoutCheck = () => {
  const issues = [];
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const inter = (a, b, pad = 0) => a.left < b.right - pad && a.right > b.left + pad && a.top < b.bottom - pad && a.bottom > b.top + pad;
  const W = innerWidth;
  if (document.documentElement.scrollWidth > W + 1) issues.push(`Seite scrollt horizontal (${document.documentElement.scrollWidth} > ${W})`);
  // 1. Inhalt ragt aus einem Element ohne vorgesehenes Scrollen
  for (const e of document.querySelectorAll('.app *, .portal *')) {
    if (!vis(e) || e.closest('.card-host, svg, .tbl-wrap, .tbl-scroll, .mx-wrap, select, option, .sr')) continue;
    const s = getComputedStyle(e);
    if (/(auto|scroll)/.test(s.overflowX) || s.display === 'inline') continue;
    if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) {
      // Kinder, die über den rechten Rand hinausragen und sichtbar sind
      const r = e.getBoundingClientRect();
      const over = [...e.children].some((c) => vis(c) && c.getBoundingClientRect().right > r.right + 2 && !c.closest('.blk-go'));
      const clipped = s.overflowX === 'hidden' || s.overflowX === 'clip';
      if (over || clipped && e.scrollWidth > e.clientWidth + 2 && !e.title && !e.closest('[title]')) issues.push(`Überlauf ${name(e)} (${e.scrollWidth} > ${e.clientWidth})`);
    }
    // Ellipse oder Zeilenbegrenzung ohne Tooltip
    const clamped = (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) || (s.webkitLineClamp && s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2);
    if (clamped && !e.getAttribute('title') && !e.closest('[title]')) issues.push(`abgeschnitten ohne Tooltip ${name(e)}: ${e.textContent.slice(0, 40)}`);
  }
  // 2. Standleiste
  const bar = document.querySelector('.stagebar');
  if (bar && vis(bar)) {
    const br = bar.getBoundingClientRect();
    if (bar.scrollWidth > bar.clientWidth + 1) issues.push('Standleiste scrollt horizontal');
    const items = [...bar.querySelectorAll('.stg')].map((e) => [e, e.getBoundingClientRect()]);
    for (const [e, r] of items) {
      if (r.left < br.left - 1 || r.right > br.right + 1) issues.push(`Standleiste: Eintrag ausserhalb ${e.textContent.trim()}`);
      for (const c of e.querySelectorAll('.stg-code, .stg-year')) { const cr = c.getBoundingClientRect(); if (cr.right > r.right + 1 || cr.left < r.left - 1) issues.push(`Standleiste: Beschriftung ragt heraus ${c.textContent}`); }
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (inter(items[i][1], items[j][1], 1)) issues.push(`Standleiste: Überlappung ${items[i][0].textContent.trim()} / ${items[j][0].textContent.trim()}`);
  }
  // 3. Zeitstrahl
  const axis = document.querySelector('.tl-axis-track');
  if (axis && vis(axis)) {
    const ar = axis.getBoundingClientRect();
    const labs = [...axis.querySelectorAll('.tl-year, .tl-today')].map((e) => [e, e.getBoundingClientRect()]);
    if (labs.length < 4) issues.push('Zeitstrahl: zu wenige Achsenbeschriftungen');
    for (const [e, r] of labs) if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.right > W) issues.push(`Zeitstrahl: Beschriftung ragt heraus ${e.textContent}`);
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) if (inter(labs[i][1], labs[j][1])) issues.push(`Zeitstrahl: Beschriftungen überlappen ${labs[i][0].textContent} / ${labs[j][0].textContent}`);
    for (const row of document.querySelectorAll('.tl-row:not(.tl-axis)')) {
      const st = row.querySelector('.tl-status'), tr = row.querySelector('.tl-track'), act = row.querySelector('.tl-act');
      const sr = st.getBoundingClientRect(), trr = tr.getBoundingClientRect();
      if (sr.right > trr.left + 1) issues.push(`Zeitstrahl: Status überlappt Spur ${st.textContent}`);
      for (const c of st.querySelectorAll('*')) if (c.getBoundingClientRect().right > sr.right + 1) issues.push('Zeitstrahl: Status ragt heraus');
      const range = document.createRange(); range.selectNodeContents(st);
      for (const rr of range.getClientRects()) if (rr.right > sr.right + 1 || rr.bottom > sr.bottom + 1) issues.push(`Zeitstrahl: Statustext ragt heraus ${st.textContent}`);
      const acr = act.getBoundingClientRect();
      for (const m of tr.querySelectorAll('.tl-adopt, .tl-apply, .tl-wait')) { const mr = m.getBoundingClientRect(); if (inter(mr, sr) || inter(mr, acr)) issues.push('Zeitstrahl: Marker überlappt Beschriftung'); if (mr.width > 0 && (mr.left < trr.left - 6 || mr.right > trr.right + 1)) issues.push('Zeitstrahl: Marker ausserhalb der Spur'); }
      if (acr.right > sr.left + 1) issues.push(`Zeitstrahl: Akt überlappt Status ${act.textContent.trim()}`);
    }
  }
  // 2b. Leiste der Fassungen (SR): keine Überlappung, nichts ausserhalb, Jahresbeschriftung über ihren Einträgen
  const sbar = document.querySelector('.sbar');
  if (sbar && vis(sbar)) {
    const br = sbar.getBoundingClientRect();
    const items = [...sbar.querySelectorAll('.sbar-item, .sbar-y')].filter(vis).map((e) => [e, e.getBoundingClientRect()]);
    for (const [e, r] of items) if (r.left < br.left - 1 || r.right > br.right + 1) issues.push(`Fassungsleiste: Eintrag ausserhalb ${e.getAttribute('aria-label') || e.textContent}`);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (inter(items[i][1], items[j][1], 1)) issues.push(`Fassungsleiste: Überlappung ${items[i][0].getAttribute('aria-label') || items[i][0].textContent} / ${items[j][0].getAttribute('aria-label') || items[j][0].textContent}`);
  }
  // 3b. Zeitstrahl der Fassungen (SR): Achsenbeschriftungen ohne Überlappung, innerhalb der Spur
  const vax = document.querySelector('.vt-axis');
  if (vax && vis(vax)) {
    const ar = vax.getBoundingClientRect();
    const labs = [...vax.querySelectorAll('.vt-year, .vt-today')].map((e) => [e, e.getBoundingClientRect()]);
    if (labs.length < 3) issues.push('Zeitstrahl: zu wenige Achsenbeschriftungen');
    for (const [e, r] of labs) if (r.left < ar.left - 1 || r.right > ar.right + 1) issues.push(`Zeitstrahl: Beschriftung ragt heraus ${e.textContent}`);
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) if (inter(labs[i][1], labs[j][1])) issues.push(`Zeitstrahl: Beschriftungen überlappen ${labs[i][0].textContent} / ${labs[j][0].textContent}`);
  }
  // 5b. Zweite Kopfzeile (Ansichten): Einträge überlappen nicht und sind ganz sichtbar
  const sub = document.querySelector('.app-subhead .views');
  if (sub && vis(sub)) {
    const links = [...sub.children].filter(vis).map((e) => [e, e.getBoundingClientRect()]);
    for (let i = 0; i < links.length; i++) { if (links[i][1].right > W + 1) issues.push(`Ansichten: ${links[i][0].textContent} ragt aus dem Fenster`); for (let j = i + 1; j < links.length; j++) if (inter(links[i][1], links[j][1], 1)) issues.push(`Ansichten überlappen: ${links[i][0].textContent} / ${links[j][0].textContent}`); }
  }
  // 4. Inhaltsverzeichnis: Nummer überlappt Titel nicht
  for (const a of document.querySelectorAll('.toc-unit a')) {
    if (!vis(a)) continue;
    const n = a.querySelector('.toc-num'), t = a.querySelector('.toc-title');
    if (!n || !t) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const nr = range.getBoundingClientRect(), tr = t.getBoundingClientRect();
    if (nr.right > tr.left - 2 && nr.bottom > tr.top + 1 && nr.top < tr.bottom - 1) issues.push(`Inhaltsverzeichnis: Nummer überlappt Titel ${n.textContent}`);
  }
  // 5. Kopfzeile
  const head = document.querySelector('.app-head');
  if (head) {
    const parts = [...head.children].filter(vis).filter((e) => !e.classList.contains('skip')).map((e) => [e, e.getBoundingClientRect()]);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i][1].right > W + 1) issues.push(`Kopfzeile: ${name(parts[i][0])} ragt aus dem Fenster`);
      for (let j = i + 1; j < parts.length; j++) if (inter(parts[i][1], parts[j][1], 1)) issues.push(`Kopfzeile: ${name(parts[i][0])} überlappt ${name(parts[j][0])}`);
    }
    for (const a of head.querySelectorAll('.views a')) if (a.scrollWidth > a.clientWidth + 1) issues.push(`Navigation abgeschnitten: ${a.textContent}`);
  }
  // 6. Matrix-Köpfe und Steuerleisten
  for (const th of document.querySelectorAll('.mx thead th')) for (const c of th.children) if (vis(c) && c.getBoundingClientRect().right > th.getBoundingClientRect().right + 1) issues.push(`Matrixkopf ragt heraus: ${c.textContent}`);
  for (const s of document.querySelectorAll('.toolbar select, .toc select, .stage-picker select')) {
    if (!vis(s)) continue;
    const o = s.options[s.selectedIndex];
    if (!o) continue;
    const c = document.createElement('canvas').getContext('2d');
    const cs = getComputedStyle(s);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const need = c.measureText(o.textContent).width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    if (need > s.clientWidth - 18) issues.push(`Auswahl abgeschnitten: ${o.textContent}`);
  }
  // 7. Verweisnetz (SVG): Beschriftungen überlappen nicht und bleiben im Bild
  for (const svg of document.querySelectorAll('svg.rn-svg')) {
    if (!vis(svg)) continue;
    const sr = svg.getBoundingClientRect();
    const labs = [...svg.querySelectorAll('.rn-label, .rn-head, .rn-sidecount, .rn-clabel, .rn-note, text.rn-more, .rn-more text')].filter(vis).map((e) => [e, e.getBoundingClientRect()]);
    for (const [e, r] of labs) if (r.left < sr.left - 1 || r.right > sr.right + 1) issues.push(`Verweisnetz: Beschriftung ragt heraus ${e.textContent}`);
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) if (inter(labs[i][1], labs[j][1], 1)) issues.push(`Verweisnetz: Beschriftungen überlappen ${labs[i][0].textContent} / ${labs[j][0].textContent}`);
  }
  // 8. Verweisstruktur (SVG): Spaltenbeschriftungen ohne Überlappung, Bandbeschriftung im Band, Zeilenbeschriftung neben den Zeilen
  for (const svg of document.querySelectorAll('svg.rs-svg')) {
    if (!vis(svg)) continue;
    const sr = svg.getBoundingClientRect();
    const labs = [...svg.querySelectorAll('.rs-lab')].map((e) => [e, e.getBoundingClientRect()]);
    for (const [e, r] of labs) if (r.left < sr.left - 1 || r.right > sr.right + 1) issues.push(`Verweisstruktur: Spaltenbeschriftung ragt heraus ${e.textContent}`);
    for (let i = 1; i < labs.length; i++) if (inter(labs[i - 1][1], labs[i][1], 0.5)) issues.push(`Verweisstruktur: Spaltenbeschriftungen überlappen ${labs[i - 1][0].textContent} / ${labs[i][0].textContent}`);
    for (const g of svg.querySelectorAll('.rs-bands > g')) {
      const t = g.querySelector('text'), b = g.querySelector('rect');
      if (!t || !t.textContent) continue;
      const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (tr.right > br.right + 1 || tr.left < br.left - 1) issues.push(`Verweisstruktur: Bandbeschriftung ragt heraus ${t.textContent}`);
    }
  }
  return issues;
};


/** Schaltflächen: Form ohne Hover erkennbar, Mindestgrösse, Zeiger (im Browser auszuführen). */
export const buttonCheck = () => {
  const out = [];
  for (const b of document.querySelectorAll('button, a.btn, a.btn-icon, [role="button"]')) {
    const r = b.getBoundingClientRect();
    // SVG-Bedienelemente (Spalten der Verweisstruktur, «n weitere» im Netz) haben eigenen Fokusrahmen und Trefferflächen im Diagramm
    if (!r.width || b.closest('.menu-pop, .stagebar-legend, .card-host, svg') || b.classList.contains('link') || b.matches('.blk')) continue;
    const s = getComputedStyle(b);
    const shaped = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' || s.boxShadow !== 'none' || s.borderStyle !== 'none' && parseFloat(s.borderWidth) > 0;
    const bareOk = b.classList.contains('is-bare') || b.matches('.seg button, .tl-act, .mx-cell button, .chip-btn, .menu-item');
    if (!shaped && !bareOk) out.push(`ohne Form: ${b.textContent.trim().slice(0, 30) || b.getAttribute('aria-label')}`);
    if (Math.min(r.width, r.height) < 31 && !b.closest('.toc-search')) out.push(`zu klein (${Math.round(r.width)}x${Math.round(r.height)}): ${b.textContent.trim().slice(0, 30) || b.getAttribute('aria-label')}`);
    if (s.cursor !== 'pointer' && !b.disabled && b.getAttribute('aria-disabled') !== 'true') out.push(`kein Zeiger: ${b.textContent.trim().slice(0, 30)}`);
  }
  return out;
};

// ------------------------------------------------------------------ Fedlex-Attrappe (SPEC §8: Abruf gemockt, Antworten aus raw/)
import { readFileSync as _rf, existsSync as _ex, readdirSync as _rd } from 'node:fs';
import { join as _join, dirname as _dirname, resolve as _resolve } from 'node:path';
import { fileURLToPath as _f2p } from 'node:url';
const _ROOT = _resolve(_dirname(_f2p(import.meta.url)), '../..');
const RAW = _join(_ROOT, 'raw');
import { test as _pwTest } from '@playwright/test';
const REC = _join(_ROOT, 'test/app/fixtures/fedlex-recorded.json');
export const RECORD_FILE = REC;

/** Datei-URL → Datei in raw/ (aus versions.json). */
function fileIndex() {
  const m = new Map();
  if (!_ex(RAW)) return m;
  for (const d of _rd(RAW)) {
    const vf = _join(RAW, d, 'versions.json');
    if (!_ex(vf)) continue;
    const vj = JSON.parse(_rf(vf, 'utf8'));
    for (const v of vj.versions) for (const [l, f] of Object.entries(v.files || {})) if (f && f.xml) m.set(f.xml, _join(RAW, d, `${v.date.replace(/-/g, '')}_${l}.xml`));
  }
  return m;
}
const LIT = /^\d{4}-\d{2}-\d{2}$|^-?\d+$/;
function toSparqlJson(rows, vars) {
  return { head: { vars }, results: { bindings: rows.map((r) => Object.fromEntries(vars.filter((k) => r[k] != null).map((k) => [k, /^https?:\/\//.test(r[k]) ? { type: 'uri', value: r[k] } : { type: 'literal', value: String(r[k]) }]))) } };
}
/** Antwort aus raw/<werk>/sparql/*.json für die Abfragen von scripts/fetch-raw.mjs (gleiche Form wie fetchWorkMeta der Oberfläche). */
function rawSparql(q) {
  const m = /<https:\/\/fedlex\.data\.admin\.ch\/eli\/(cc\/\d+\/[\w]+)>/.exec(q);
  if (!m) return null;
  const dir = _join(RAW, m[1].replace(/\//g, '-'), 'sparql');
  if (!_ex(dir)) return { head: { vars: [] }, results: { bindings: [] } };
  const read = (n, vars) => toSparqlJson(_ex(_join(dir, n + '.json')) ? JSON.parse(_rf(_join(dir, n + '.json'), 'utf8')) : [], vars);
  if (/SELECT DISTINCT \?p \?o WHERE \{ <[^>]+> \?p \?o \}/.test(q)) return read('work', ['p', 'o']);
  if (/SELECT DISTINCT \?t \?p \?o/.test(q)) return read('taxonomy', ['t', 'p', 'o']);
  if (/SELECT DISTINCT \?cons \?date \?end/.test(q)) return read('consolidations', ['cons', 'date', 'end']);
  if (/SELECT DISTINCT \?cons \?lang \?fmt \?file/.test(q)) return read('files', ['cons', 'lang', 'fmt', 'file']);
  if (/SELECT DISTINCT \?imp \?target \?p \?o/.test(q)) return read('impacts', ['imp', 'target', 'p', 'o']);
  if (/SELECT DISTINCT \?s \?p \?o WHERE \{ \?s jolux:foreseenImpactToLegalResource/.test(q)) return read('pending', ['s', 'p', 'o']);
  return null;
}
void LIT;
/** SPARQL-Abfrage aus GET (query=…) oder POST (Formular) */
export function queryOf(req) {
  if (req.method() === 'POST') return new URLSearchParams(req.postData() || '').get('query') || '';
  return new URL(req.url()).searchParams.get('query') || '';
}

/**
 * Fedlex im Browser ersetzen: Dateien aus raw/, SPARQL aus test/app/fixtures/fedlex-recorded.json (aufgezeichnet mit
 * test/app/record-fedlex.mjs) oder aus raw/<werk>/sparql. Optionen: delayMs (je Datei), offline (Netzfehler).
 * Liefert ein Protokoll { sparql, files, missing, offline }; offline lässt sich während des Tests umschalten.
 */
export async function mockFedlex(page, { delayMs = 0, offline = false } = {}) {
  // Die Antworten stammen aus raw/. Fehlt der Ordner (frischer Klon), überspringt Playwright den Test.
  _pwTest.skip(!_ex(_join(RAW, 'cc-2021-734', 'fedlex')), 'Ordner raw/ fehlt (Bezug der Rohdaten: README, Abschnitt «Navigator pflegen»)');
  const files = fileIndex();
  const rec = _ex(REC) ? JSON.parse(_rf(REC, 'utf8')) : { sparql: {} };
  const log = { sparql: 0, files: 0, missing: [], offline };
  await page.route('https://fedlex.data.admin.ch/**', async (route) => {
    const url = route.request().url();
    if (log.offline) return route.abort('internetdisconnected').catch(() => {});
    const head = { 'access-control-allow-origin': '*' };
    if (url.startsWith('https://fedlex.data.admin.ch/sparqlendpoint')) {
      const q = queryOf(route.request());
      log.sparql++;
      const body = rec.sparql[q] || rawSparql(q);
      if (!body) { log.missing.push(q.slice(0, 300)); return route.fulfill({ status: 500, headers: head, body: 'nicht aufgezeichnet' }); }
      return route.fulfill({ status: 200, headers: { ...head, 'content-type': 'application/sparql-results+json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    }
    const f = files.get(url);
    if (f && _ex(f)) {
      log.files++;
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return route.fulfill({ status: 200, headers: { ...head, 'content-type': 'application/xml' }, body: _rf(f, 'utf8') }).catch(() => {});
    }
    log.missing.push(url);
    return route.fulfill({ status: 404, headers: head, body: 'nicht in raw/' });
  });
  return log;
}
