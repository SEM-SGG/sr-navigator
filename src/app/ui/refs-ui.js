// Gemeinsame Bausteine für Verweisnetz und Verweisstruktur (SPEC §12.3): Kontext laden, Bezeichnungen, Links,
// Auszug, Formen der Legende, Messung von Text, Dialog mit Fokusfalle.
import { html } from 'htm/preact';
import { render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { refsAvailable, refsContext } from '../data.js';
import { openRefLibrary, settingsStore, persistSettings } from '../app.js';
import { go, getState, toHash, createStore } from '../state.js';
import { cite } from '../lib/cite.js';
import { t, uiLang } from '../lib/i18n.js';
import { excerpt } from './refsgraph-model.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------ Zustand
/** Wahl «Verweise» in der Chronologie-Leiste (für die Sitzung, auch über einen Erlasswechsel hinweg). */
export const refsPanelStore = createStore({ on: false });
/** Gespeicherte Wahl: «Liste | Netz» (Standard Liste), «Diagramm | Tabelle» (Standard Diagramm), «alle zeigen». */
export function refsSetting(name, dflt) {
  const s = settingsStore.get();
  return s && s[name] != null ? s[name] : dflt;
}
export function setRefsSetting(name, value) {
  settingsStore.set({ ...settingsStore.get(), [name]: value });
  persistSettings();
}

// ------------------------------------------------------------ Kontext laden (alle Erlasse der Bibliothek, Index bei Bedarf)
const timings = [];
/** Gemessene Rechenzeiten (für Tests und Bericht): [{ work, lang, stage, ms, what }] */
export const refsTimings = () => timings;
if (typeof window !== 'undefined') window.__srRefsTimings = timings;
/** Prüfschnittstelle für die Browsertests (Zustand setzen, Modelle mit denselben Funktionen rechnen). */
export function exposeRefsTestApi(api) {
  if (typeof window === 'undefined') return;
  window.__srRefs = {
    ...api,
    setPanel: (on) => refsPanelStore.set({ on: !!on }),
    setSetting: (name, v) => setRefsSetting(name, v),
    context: async (data, lang, stageId) => { await openRefLibrary(); return refsContext(data, lang, stageId || data.current.id); },
  };
}

/** Kontext für die Modellfunktionen; status: loading | ready | none (kein Index) | error. enabled=false: noch nicht laden. */
export function useRefsCtx(data, lang, stageId, enabled = true) {
  const [st, setSt] = useState({ status: refsAvailable() ? 'loading' : 'none' });
  useEffect(() => {
    if (!enabled) return undefined;
    if (!refsAvailable()) { setSt({ status: 'none' }); return undefined; }
    let alive = true;
    setSt((s) => (s.status === 'ready' && s.key === `${data.id}|${lang}|${stageId}` ? s : { status: 'loading' }));
    openRefLibrary()
      .then(() => new Promise((r) => setTimeout(r, 0)))
      .then(() => {
        if (!alive) return;
        const t0 = performance.now();
        const ctx = refsContext(data, lang, stageId);
        const ms = Math.round(performance.now() - t0);
        timings.push({ work: data.id, lang, stage: stageId, ms, what: 'context' });
        setSt(ctx ? { status: 'ready', ctx, ms, key: `${data.id}|${lang}|${stageId}` } : { status: 'error' });
      })
      .catch((e) => { console.error(e); if (alive) setSt({ status: 'error', msg: e.message }); });
    return () => { alive = false; };
  }, [data, lang, stageId, enabled]);
  return st;
}

// ------------------------------------------------------------ Bezeichnungen
/** Bezeichnung eines Knotens: { text, lang } (lang: Sprache des Texts, wenn er aus dem Rechtstext stammt). */
export function nodeLabel(ctx, node, { withAbbr = false, lang } = {}) {
  const ui = uiLang();
  if (node.kind === 'self' || node.kind === 'lib') {
    const d = ctx.dataOf(node.work);
    if (d && !node.unit) return { text: d.abbr(ui), lang: ui };
    if (d && d.unit(node.unit)) {
      const meta = d.unitMeta(node.unit, ui);
      const base = meta.type === 'final' ? t('read.toc.final') : cap(cite(meta, null, ui, null));
      return { text: withAbbr ? `${base} ${d.abbr(ui)}` : base, lang: ui };
    }
    const r = node.refs && node.refs[0];
    return { text: (r && r.to && r.to.label) || node.unit || '', lang: lang || ui };
  }
  const to = (node.refs && node.refs[0] && node.refs[0].to) || node;
  if (node.kind === 'eu') return { text: euAct(to.label || ''), lang: lang || ui };
  if (to.abbr) return { text: to.abbr, lang: lang || ui };
  if (to.sr) return { text: `${ui === 'de' ? 'SR' : 'RS'} ${to.sr}`, lang: ui };
  return { text: to.title || to.label || '', lang: lang || ui };
}
/** Bezeichnung des EU-Rechtsakts ohne Gliederung davor («Art. 6 der Verordnung (EU) 2016/399» → «Verordnung (EU) 2016/399»). */
export function euAct(label) {
  const m = /((?:Durchführungs|Delegierte[nr]? )?(?:Verordnung|Richtlinie|Rahmenbeschluss|Beschluss)|règlement(?: d’exécution| délégué)?|directive|décision(?:-cadre)?|regolamento(?: di esecuzione| delegato)?|direttiva|decisione(?: quadro)?)\b[\s\S]*$/i.exec(label);
  return (m ? m[0] : label).replace(/^\w/, (c) => c.toUpperCase());
}
/** Kurzform für enge Stellen: «Verordnung» → «VO», «règlement» → «règl.», «regolamento» → «reg.» usw. */
export function euShort(label) {
  return String(label)
    .replace(/^Durchführungsverordnung\b/i, 'DVO').replace(/^Verordnung\b/i, 'VO').replace(/^Richtlinie\b/i, 'RL').replace(/^Rahmenbeschluss\b/i, 'RB').replace(/^Beschluss\b/i, 'Beschl.')
    .replace(/^règlement\b/i, 'Règl.').replace(/^directive\b/i, 'Dir.').replace(/^décision-cadre\b/i, 'Déc.-cadre').replace(/^décision\b/i, 'Déc.')
    .replace(/^regolamento\b/i, 'Reg.').replace(/^direttiva\b/i, 'Dir.').replace(/^decisione quadro\b/i, 'Dec. quadro').replace(/^decisione\b/i, 'Dec.');
}

/** Zitat der Quelle eines Verweises (Einheit und Block), mit Kürzel, wenn sie in einem anderen Erlass liegt. */
export function sourceCite(ctx, ref, { withAbbr } = {}) {
  const ui = uiLang();
  const d = ctx.dataOf(ref.srcWork || ctx.work);
  if (!d) return ref.from.unit;
  const ab = withAbbr != null ? withAbbr : (ref.srcWork && ref.srcWork !== ctx.work);
  return cap(cite(d.unitMeta(ref.from.unit, ui), ref.from.key || null, ui, ab ? d.abbr(ui) : null));
}
/** Zitat eines Ziels: { text, lang }; Bestimmungen der Bibliothek in der Zitierweise der Oberfläche, sonst Bezeichnung des Index. */
export function targetCite(ctx, ref, { withAbbr } = {}) {
  const ui = uiLang();
  const to = ref.to;
  const w = to.kind === 'internal' ? ctx.work : to.work;
  const d = w ? ctx.dataOf(w) : null;
  const partial = to.path && (to.path.par || to.path.let || to.path.num) && !to.key;
  if (d && to.unit && d.unit(to.unit) && !partial) {
    const ab = withAbbr != null ? withAbbr : w !== ctx.work;
    return { text: cap(cite(d.unitMeta(to.unit, ui), to.key || null, ui, ab ? d.abbr(ui) : null)), lang: ui };
  }
  return { text: to.label || '', lang: ctx.lang };
}

// ------------------------------------------------------------ Links
/** Patch für go() und href eines Ziels im Tool, oder Link nach aussen, oder null (kein eindeutiger Link). */
export function nodeLink(ctx, node, side) {
  const lang = ctx.lang;
  if (node.kind === 'self' || node.kind === 'lib') {
    const w = node.work;
    const d = ctx.dataOf(w);
    if (!d) return null;
    if (!node.unit) { const patch = { view: 'uebersicht', w, u: null, k: null, s: null, a: null, b: null, act: null, q: null }; return { patch, href: toHash({ ...getState(), ...patch }) }; }
    if (!d.unit(node.unit)) return null;
    const keys = new Set((node.refs || []).map((r) => (side === 'left' ? r.from.key : r.to.key) || null));
    const sid = ctx.stageOf(w);
    let k = '*';
    if (keys.size === 1) {
      const only = [...keys][0];
      const v = sid ? d.version(node.unit, lang, sid) : null;
      if (only && v && (v.blocks || []).some((b) => b.k === only)) k = only;
    }
    const patch = { view: 'lesen', w, u: node.unit, k, s: sid || null, m: 'stand', d: null, a: null, b: null, act: null, q: null, ch: '0', l: d.langs.includes(lang) ? lang : null };
    return { patch, href: toHash({ ...getState(), ...patch }) };
  }
  const r = node.refs && node.refs[0];
  if (!r) return null;
  const own = ctx.dataOf(ctx.work);
  const to = { ...r.to };
  delete to.unit; delete to.key; delete to.path;
  const url = own ? own.refUrl(to, lang) : null;
  return url ? { url } : null;
}
/** Link eines einzelnen Ziels (Liste): im Tool oder nach aussen (mit Anker der Einheit), sonst null. */
export function refTargetLink(ctx, ref) {
  const to = ref.to;
  const w = to.kind === 'internal' ? ctx.work : to.work;
  if (w) return nodeLink(ctx, { kind: w === ctx.work ? 'self' : 'lib', work: w, unit: to.unit || null, refs: [ref] }, 'right');
  const own = ctx.dataOf(ctx.work);
  const url = own ? own.refUrl(to, ctx.lang) : null;
  return url ? { url } : null;
}
export function refSourceLink(ctx, ref) {
  return nodeLink(ctx, { kind: ref.srcWork === ctx.work ? 'self' : 'lib', work: ref.srcWork || ctx.work, unit: ref.from.unit, refs: [ref] }, 'left');
}
/** Klick auf einen Link im Tool: Navigation ohne Neuladen (optional vorher before(), z. B. Dialog schliessen). */
export const onInternal = (link, before) => (e) => {
  if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  if (before) before();
  go(link.patch);
};

/** Link-Element (HTML) für ein Ziel bzw. eine Quelle; ohne Link reiner Text. */
export function RefLink({ link, children, lang, before, className = '' }) {
  if (!link) return html`<span class=${className} lang=${lang}>${children}</span>`;
  if (link.url) return html`<a class=${'ext ' + className} href=${link.url} target="_blank" rel="noopener noreferrer" lang=${lang}>${children}<svg class="ico" aria-hidden="true"><use href="#external"></use></svg><span class="sr">${t('common.newTab')}</span></a>`;
  return html`<a class=${className} href=${link.href} lang=${lang} onClick=${onInternal(link, before)}>${children}</a>`;
}

// ------------------------------------------------------------ Auszug
/** Auszug der Fundstelle aus dem Wortlaut der Quelle (Text ohne Markup, Position at). */
export function refExcerpt(ctx, ref, radius = 70) {
  const w = ref.srcWork || ctx.work;
  const d = ctx.dataOf(w);
  const sid = ctx.stageOf(w);
  if (!d || !sid) return null;
  const text = d.refPlain(ref.from.unit, ctx.lang, sid, ref.from.key);
  return text ? excerpt(text, ref.at, radius) : null;
}
export function Excerpt({ ex, lang, className = '' }) {
  if (!ex) return null;
  return html`<span class=${'rx ' + className} lang=${lang}>${ex.before}<mark>${ex.hit}</mark>${ex.after}</span>`;
}

// ------------------------------------------------------------ Formen (SPEC §12.3: keine Farbe je Erlass)
/** Form eines Knotens als SVG-Element um (x, y). kind: self | lib | sr | other | eu | center. */
export function shape(kind, x, y, { missing, r = 5 } = {}) {
  const cls = 'rn-shape rn-' + kind + (missing ? ' is-missing' : '');
  if (kind === 'center') return html`<circle class=${cls} cx=${x} cy=${y} r=${r + 4} />`;
  if (kind === 'lib') return html`<rect class=${cls} x=${x - r} y=${y - r} width=${r * 2} height=${r * 2} />`;
  if (kind === 'eu') { const q = r + 1.5; return html`<path class=${cls} d=${`M${x},${y - q} L${x + q},${y} L${x},${y + q} L${x - q},${y} Z`} />`; }
  return html`<circle class=${cls} cx=${x} cy=${y} r=${r} />`;
}
export function ShapeIcon({ kind, missing }) {
  return html`<svg class="rn-ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${shape(kind, 8, 8, { missing })}</svg>`;
}
/** Legende der Formen und Linien (Textfassung der Bedeutung). */
export function RefsLegend({ missing = true, struct = false }) {
  return html`<p class="legend-line rn-legend">
    <span class="lg"><${ShapeIcon} kind="self" />${t('refs.lg.self')}</span>
    <span class="lg"><${ShapeIcon} kind="lib" />${t('refs.lg.lib')}</span>
    <span class="lg"><${ShapeIcon} kind="sr" />${t('refs.lg.sr')}</span>
    <span class="lg"><${ShapeIcon} kind="eu" />${t('refs.lg.eu')}</span>
    ${missing ? html`<span class="lg"><svg class="rn-ico" width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><path class="rn-edge is-missing" d="M1,8 L16,8" /><circle class="rn-shape rn-self is-missing" cx="21" cy="8" r="5" /></svg>${t('refs.lg.missing')}</span>` : null}
    ${struct ? null : html`<span class="lg"><svg class="rn-ico" width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><path class="rn-edge" d="M1,5 L27,5" style="stroke-width:1.5px" /><path class="rn-edge" d="M1,12 L27,12" style="stroke-width:4px" /></svg>${t('refs.lg.width')}</span>`}
  </p>`;
}

// ------------------------------------------------------------ Messen
let mctx = null;
export function textWidth(s, font = '400 12px "IBM Plex Sans"') {
  try {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font;
    return Math.ceil(mctx.measureText(String(s)).width);
  } catch { return String(s).length * 7; }
}
/** Kürzt s mit «…» auf höchstens maxW Pixel. */
export function fitText(s, maxW, font) {
  const str = String(s || '');
  if (textWidth(str, font) <= maxW) return str;
  let lo = 0, hi = str.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textWidth(str.slice(0, mid) + '…', font) <= maxW) lo = mid; else hi = mid - 1; }
  return str.slice(0, Math.max(1, lo)).replace(/\s+$/, '') + '…';
}
export function useWidth(ref) {
  const [w, setW] = useState(0);
  const seen = useRef(null);
  const ro = useRef(null);
  // Ohne Abhängigkeiten: das Element kann erst nach einem späteren Rendern erscheinen (Platzhalter, Ladezustand).
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === seen.current) return;
    seen.current = el;
    if (ro.current) { ro.current.disconnect(); ro.current = null; }
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    ro.current = new ResizeObserver(() => setW(el.clientWidth));
    ro.current.observe(el);
  });
  useEffect(() => () => { if (ro.current) ro.current.disconnect(); }, []);
  return w;
}
export function useFontsReady() {
  const [ok, setOk] = useState(!document.fonts || document.fonts.status === 'loaded');
  useEffect(() => { if (!ok && document.fonts) document.fonts.ready.then(() => setOk(true)); }, []);
  return ok;
}

// ------------------------------------------------------------ Dialog (Carbon Dialog: modal, Fokusfalle, Esc, Fokus zurück)
function Portal({ children }) {
  const host = useMemo(() => { const d = document.createElement('div'); d.className = 'portal'; return d; }, []);
  useLayoutEffect(() => { document.body.appendChild(host); return () => { render(null, host); host.remove(); }; }, []);
  useLayoutEffect(() => { render(children, host); });
  return null;
}
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modaler Dialog über der Seite; der Hash bleibt unverändert. */
export function Dialog({ labelId, kicker, title, onClose, children, footer, className = '' }) {
  return html`<${Portal}><${DialogInner} labelId=${labelId} kicker=${kicker} title=${title} onClose=${onClose} footer=${footer} className=${className}>${children}</${DialogInner}></${Portal}>`;
}
function DialogInner({ labelId, kicker, title, onClose, children, footer, className }) {
  const ref = useRef();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const opener = useMemo(() => document.activeElement, []);
  // Layout-Effekt: Sperre und Fokus stehen, sobald der Dialog im DOM ist
  useLayoutEffect(() => {
    const app = document.getElementById('app');
    if (app) app.inert = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current && ref.current.querySelector('.rd-close');
    if (first) first.focus();
    // Esc und Tab auch dann, wenn der Fokus den Dialog verlassen hat (z. B. nach einer deaktivierten Schaltfläche)
    const onDoc = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      else if (e.key === 'Tab') { e.preventDefault(); const f = ref.current.querySelector('.rd-close'); if (f) f.focus(); }
    };
    document.addEventListener('keydown', onDoc);
    return () => {
      document.removeEventListener('keydown', onDoc);
      if (app) app.inert = false;
      document.body.style.overflow = prevOverflow;
      if (opener && opener.isConnected && opener.focus) opener.focus();
      else { const p = document.querySelector('aside.panel .panel-head .btn-icon, #main'); if (p) p.focus(); }
    };
  }, []);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const list = [...ref.current.querySelectorAll(FOCUSABLE)].filter((x) => x.getClientRects().length);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
  };
  return html`<div class="modal-scrim rd-scrim" onClick=${onClose}></div>
  <div class=${'modal rd ' + className} role="dialog" aria-modal="true" aria-labelledby=${labelId} ref=${ref} onKeyDown=${onKey}>
    <div class="rd-head">
      <div>${kicker ? html`<p class="panel-kicker">${kicker}</p>` : null}<h2 class="rd-title" id=${labelId}>${title}</h2></div>
      <button type="button" class="btn-icon is-bare rd-close" aria-label=${t('refs.dlg.close')} title=${t('refs.dlg.close')} onClick=${onClose}><svg class="ico" aria-hidden="true"><use href="#close"></use></svg></button>
    </div>
    <div class="modal-body rd-body">${children}</div>
    ${footer ? html`<div class="rd-foot">${footer}</div>` : null}
  </div>`;
}
