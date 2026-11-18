// Adapter-Schicht zwischen Oberfläche und Kernbibliothek (SPEC §6).
// Die Kernfunktionen kommen aus src/core/* (virtuelle Module "sr-core/*", im Build aufgelöst, sobald data/STATUS.md
// die Funktionen meldet); fehlt eine Funktion, greifen die Ersatzimplementierungen aus fallback-model.js bzw.
// fedlex-fallback.js. Die Oberfläche greift nur über diese Datei auf Daten und Kernfunktionen zu.
import * as coreModel from 'sr-core/model';
import * as coreFedlex from 'sr-core/fedlex';
import * as coreRefs from 'sr-core/refs';
import * as fb from './fallback-model.js';
import * as fbf from './fedlex-fallback.js';
import { gunzipSync, strFromU8 } from 'fflate';
import { fmtDate, todayIso, stripTags, fold, plain } from './lib/format.js';
import { workAbbr } from './lib/cite.js';
import { t, uiLang } from './lib/i18n.js';

const fn = (mod, name) => (mod && typeof mod[name] === 'function' ? mod[name] : null);
const MODEL_FNS = ['getVersion', 'blockHistory', 'changesOfStage', 'stageAt', 'unitActs', 'unitEvents'];
const FEDLEX_FNS = ['searchWorks', 'fetchWorkMeta', 'loadWork', 'checkUpdates', 'updateWork'];
export const core = {
  ...Object.fromEntries(MODEL_FNS.map((n) => [n, fn(coreModel, n) || fb[n]])),
  ...Object.fromEntries(FEDLEX_FNS.map((n) => [n, fn(coreFedlex, n) || fbf[n]])),
};
// Verweis-Index (SPEC §12.2): ausschliesslich aus src/core/refs.js; fehlt er, zeigt die Oberfläche einen Hinweis.
const REFS_FNS = ['buildRefIndex', 'plainText', 'externalUrl'];
export const refsCore = Object.fromEntries(REFS_FNS.map((n) => [n, fn(coreRefs, n)]));
export const refsAvailable = () => !!refsCore.buildRefIndex;
/** Welche Funktionen aus src/core stammen (für Info und Bericht). */
export const coreSource = {
  model: MODEL_FNS.map((n) => [n, !!fn(coreModel, n)]),
  fedlex: FEDLEX_FNS.map((n) => [n, !!fn(coreFedlex, n)]),
  refs: REFS_FNS.map((n) => [n, !!fn(coreRefs, n)]),
};

// Erlasse der Bibliothek für die Auflösung der Verweisziele (gesetzt von app.js, sobald alle Erlasse geöffnet sind).
let refLibrary = { version: 0, works: [], datas: new Map(), order: [] };
/** datas: Map(id → Data) aller Erlasse der Bibliothek, order: Reihenfolge der Bibliothek. */
export function setRefLibrary(datas, order) {
  refLibrary = {
    version: refLibrary.version + 1,
    datas,
    order: order.filter((id) => datas.has(id)),
    works: order.filter((id) => datas.has(id)).map((id) => { const d = datas.get(id); return { id: d.id, sr: d.work.sr, eli: d.work.eli, abbr: d.work.abbr, title: d.work.title, short: d.work.short, bundle: d.ds }; }),
  };
}
export const refLibraryState = () => refLibrary;

/**
 * Kontext für die Modellfunktionen (ui/refsgraph-model.js, ui/refsstructure-model.js): Index des Erlasses am Stand und die
 * Indizes der übrigen Erlasse der Bibliothek an ihrem Stand, der am selben Datum in Kraft ist (SPEC §12.3). Zwischengespeichert.
 */
export function refsContext(data, lang, stageId) {
  if (!refsAvailable() || !data || !stageId) return null;
  return data.memo(`rc|${lang}|${stageId}|${refLibrary.version}`, () => {
    const lib = refLibrary;
    const date = data.stageDate(stageId);
    const index = data.refIndex(lang, stageId);
    if (!index) return null;
    const others = [];
    for (const id of lib.order) {
      if (id === data.id) continue;
      const d = lib.datas.get(id);
      const sid = d && date ? d.stageAt(date) : null;
      if (!sid || !d.langs.includes(lang)) continue;
      const ix = d.refIndex(lang, sid);
      if (ix) others.push({ work: id, stage: sid, lang, index: ix });
    }
    const dataOf = (w) => (w === data.id ? data : lib.datas.get(w) || null);
    return {
      work: data.id, lang, stage: stageId, date, index, others,
      libOrder: lib.order.includes(data.id) ? lib.order : [data.id, ...lib.order],
      unitPos: (w, u) => { const d = dataOf(w); const i = d ? d.unitIndex.get(u) : null; return i == null ? Infinity : i; },
      dataOf,
      /** Stand eines Erlasses der Bibliothek am Datum des betrachteten Stands (null vor seiner ersten Fassung mit Wortlaut). */
      stageOf: (w) => { if (w === data.id) return stageId; const o = others.find((x) => x.work === w); if (o) return o.stage; const d = dataOf(w); return d && date ? d.stageAt(date) : null; },
    };
  });
}

// ---------------------------------------------------------------- Einbettung
function readEmbeddedEl(el) {
  const txt = el.textContent.trim();
  if (!txt) return null;
  if (el.dataset.enc === 'gz64') {
    const bin = atob(txt);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return JSON.parse(strFromU8(gunzipSync(u8)));
  }
  return JSON.parse(txt);
}
export function readEmbedded(id) {
  const el = document.getElementById(id);
  return el ? readEmbeddedEl(el) : null;
}
/** Eingebettete Bibliothek: Index (klein) sofort, Bundles erst beim Öffnen entpacken. */
export function loadEmbedded() {
  const meta = readEmbedded('sr-meta') || {};
  const index = readEmbedded('sr-index') || { order: [], works: {} };
  return { meta, index, bundle: (id) => readEmbedded('sr-work-' + id) };
}

// ---------------------------------------------------------------- Bezeichnungen
export const changeLabel = (c) => (c ? t('change.' + c) : '');
const LANGS = ['de', 'fr', 'it'];
const pickLang = (obj, l = uiLang()) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[l] || obj.de || obj.fr || obj.it || '';
};
/** Sprache eines mehrsprachigen Felds, aus der der Text tatsächlich stammt. */
export function langOf(obj, l = uiLang()) {
  if (!obj || typeof obj === 'string') return l;
  return obj[l] ? l : obj.de ? 'de' : obj.fr ? 'fr' : obj.it ? 'it' : l;
}
export { pickLang };

/** Kurzinfo eines Erlasses für die Bibliothek (aus einem Bundle). */
export function summarize(b) {
  const stages = b.stages || [];
  return {
    id: b.work.id, sr: b.work.sr, abbr: b.work.abbr, title: b.work.title, short: b.work.short, status: b.work.status,
    fetched: b.fetched, versions: (b.timeline || []).length, xmlVersions: stages.length,
    xmlFrom: stages.length ? stages[0].date : null, xmlTo: stages.length ? stages[stages.length - 1].date : null,
    langs: b.langs || LANGS, units: Object.keys(b.units || {}).length,
  };
}

const norm = (x) => String(x || '').replace(/\s+/g, ' ').trim();
/** Gleicher Wortlaut (Text, Gliederungszeichen, Tabelle), unabhängig von Herkunft und Fussnoten */
export const sameText = (a, b) => norm(a.t) === norm(b.t) && norm(a.l) === norm(b.l) && norm(a.html) === norm(b.html);

// ---------------------------------------------------------------- Datenobjekt je Erlass
export class Data {
  constructor(bundle, { source = 'embedded', today = todayIso() } = {}) {
    this.notes = [];
    this.source = source;
    this.today = today;
    const stages = [...(bundle.stages || [])].map((s, i) => ({ ...s, order: typeof s.order === 'number' ? s.order : i }));
    stages.sort((a, b) => a.order - b.order || a.date.localeCompare(b.date));
    this.ds = { ...bundle, stages };
    this.stages = stages;
    this.stageById = new Map(stages.map((s) => [s.id, s]));
    this.langs = bundle.langs || LANGS;
    this.work = bundle.work || {};
    this.id = this.work.id;
    this.timeline = [...(bundle.timeline || [])].sort((a, b) => a.date.localeCompare(b.date));
    this.actList = bundle.acts || [];
    this.acts = new Map(this.actList.map((a) => [a.id, a]));
    this.base = this.work.base;
    if (this.base && !this.acts.has(this.base)) this.acts.set(this.base, { id: this.base, kind: 'base', as: {}, title: {}, label: {}, inForce: [this.work.dateEntryInForce].filter(Boolean), changes: [], url: 'https://fedlex.data.admin.ch/eli/' + this.base });
    this.pending = bundle.pending || [];
    this.dataNotes = bundle.notes || [];
    // Einheiten in Dokumentreihenfolge
    this.toc = bundle.toc || [];
    const UNIT_TYPES = new Set(['article', 'annex', 'preamble', 'final']);
    const tocUnits = this.toc.filter((e) => UNIT_TYPES.has(e.type)).map((e) => e.id);
    const units = bundle.units || {};
    const rest = Object.keys(units).filter((id) => !tocUnits.includes(id));
    if (rest.length) this.notes.push({ k: 'notes.unitsNoToc', v: { n: rest.length, list: rest.slice(0, 5).join(', ') } });
    this.unitOrder = [...tocUnits.filter((id) => units[id]), ...rest];
    this.unitIndex = new Map(this.unitOrder.map((id, i) => [id, i]));
    this.tocById = new Map(this.toc.map((e) => [e.id, e]));
    this._cache = new Map();
  }

  memo(key, f) {
    if (this._cache.has(key)) return this._cache.get(key);
    const v = f();
    this._cache.set(key, v);
    return v;
  }
  call(name, args, fallback) {
    try { return core[name](this.ds, ...args); } catch (e) { this.coreError(name, e); return fallback ? fallback(this.ds, ...args) : null; }
  }
  coreError(name, e) {
    const msg = `${name}: ${e && e.message}`;
    if (!this.notes.some((n) => n.v && n.v.msg === msg)) { this.notes.push({ k: 'notes.coreError', v: { msg } }); console.warn('Kernfunktion fehlgeschlagen', msg); }
  }

  // -------------------------------------------------- Erlass
  abbr(l = uiLang()) { return workAbbr(this.work.abbr, this.work.sr, l); }
  /** Kürzel für Kopf und Listen: amtliches Kürzel oder "SR …" */
  code(l = uiLang()) { return this.abbr(l); }
  title(l = uiLang()) { return pickLang(this.work.title, l); }
  titleLang(l = uiLang()) { return langOf(this.work.title, l); }
  shortTitle(l = uiLang()) { return pickLang(this.work.short, l); }
  srLabel(l = uiLang()) { return this.work.sr ? `${l === 'de' ? 'SR' : 'RS'} ${this.work.sr}` : ''; }

  // -------------------------------------------------- Stände (Fassungen mit Wortlaut)
  stage(id) { return this.stageById.get(id) || null; }
  get first() { return this.stages[0]; }
  get latest() { return this.stages[this.stages.length - 1]; }
  /** Stand, der heute in Kraft ist (sonst der jüngste vergangene, sonst der erste). */
  get current() {
    const id = this.stageAt(this.today);
    return (id && this.stage(id)) || this.first;
  }
  stageIndex(id) { return this.stages.findIndex((s) => s.id === id); }
  prevStage(id) { const i = this.stageIndex(id); return i > 0 ? this.stages[i - 1] : null; }
  nextStage(id) { const i = this.stageIndex(id); return i >= 0 && i < this.stages.length - 1 ? this.stages[i + 1] : null; }
  stageDate(id) { const s = this.stage(id); return s ? s.date : null; }
  stageAt(iso) { return this.memo('sa|' + iso, () => this.call('stageAt', [iso], fb.stageAt)); }
  isFuture(id) { const s = this.stage(id); return !!s && s.date > this.today; }
  /** in Kraft | früher | beschlossen, noch nicht in Kraft */
  stageStatus(id) {
    const s = this.stage(id);
    if (!s) return { kind: 'none', label: '' };
    if (s.date > this.today) return { kind: 'future', label: t('status.future') };
    if (this.current && this.current.id === id) return { kind: 'current', label: t('status.current') };
    return { kind: 'past', label: t('status.past') };
  }
  /** "Fassung vom 1. April 2025" */
  stageLabel(id) { const s = this.stage(id); return s ? t('stage.label', { date: fmtDate(s.date) }) : ''; }
  /** "1. April 2025" */
  stageName(id) { const s = this.stage(id); return s ? fmtDate(s.date) : ''; }
  /** Eintrag für Auswahllisten: "1. April 2025, in Kraft" */
  stageOption(id, changed) {
    const s = this.stage(id);
    if (!s) return id;
    const st = this.stageStatus(id);
    return `${changed ? '● ' : ''}${fmtDate(s.date)}${st.kind === 'current' ? ', ' + st.label : st.kind === 'future' ? ', ' + t('status.futureShort') : ''}`;
  }
  /** Fedlex-Fassung (Zeitstrahl-Eintrag) zu einem Stand */
  timelineOf(stageId) { const s = this.stage(stageId); return s ? this.timeline.find((x) => x.date === s.date) || null : null; }
  pdfOf(stageId, l) { const x = this.timelineOf(stageId); return x && x.pdf ? x.pdf[l] || x.pdf.de || null : null; }
  /** Fassung (alle, auch ohne XML), die an einem Datum gilt */
  versionAt(iso) { let best = null; for (const x of this.timeline) if (x.date <= iso) best = x; return best; }
  timelineStatus(x) {
    if (x.date > this.today) return 'future';
    if ((!x.end || x.end >= this.today) && x.date <= this.today) return 'current';
    return 'past';
  }

  // -------------------------------------------------- Erlasse
  act(id) { return (id && this.acts.get(id)) || null; }
  isBase(id) { return !id || id === this.base; }
  /** Kürzel der Herkunft: AS-Fundstelle in der Oberflächensprache ("AS 2018 3171", "RO …", "RU …"). */
  actCode(id, l = uiLang()) {
    const a = this.act(id);
    const as = a && a.as && (a.as[l] || a.as.de || a.as.fr || a.as.it);
    if (as) return as;
    const m = /oc\/(\d{4})\/(\d+)$/.exec(id || '');
    // Seit 2021 erscheint die AS nur online; die Nummer entspricht der ELI-Nummer. Davor ist die Seitenzahl nicht ableitbar.
    if (m && Number(m[1]) >= 2021) return `${t('act.asPrefix')} ${m[1]} ${m[2]}`;
    return id ? 'ELI ' + id : '';
  }
  /** Bezeichnung: Kurzbezeichnung aus der Fussnote oder amtlicher Titel, sonst AS-Fundstelle */
  actName(id, l = uiLang()) {
    const a = this.act(id);
    if (!a) return this.actCode(id, l);
    if (a.kind === 'base') return t('act.base');
    return plain(pickLang(a.label, l) || pickLang(a.title, l)) || this.actCode(id, l);
  }
  actTitle(id, l = uiLang()) { const a = this.act(id); return a ? plain(pickLang(a.title, l) || pickLang(a.label, l) || '') : ''; }
  actUrl(id) { const a = this.act(id); return (a && a.url) || (id ? 'https://fedlex.data.admin.ch/eli/' + id : null); }
  actInForce(id) { const a = this.act(id); return (a && a.inForce) || []; }
  /** Inkrafttreten der Änderung eines Blocks (aus der Fussnote) bzw. des Erlasses */
  blockInForce(b) {
    if (!b) return null;
    const f = (b.fn || []).filter((x) => x.act === b.o && x.inForce).map((x) => x.inForce).sort().pop();
    if (f) return f;
    const d = this.actInForce(b.o);
    return d.length ? d[0] : null;
  }
  /** Herkunft eines Blocks: Grunderlass, geändert, künftig (beschlossen, noch nicht in Kraft) */
  origin(b) {
    const o = (b && b.o) || this.base;
    if (this.isBase(o)) return { act: o, kind: 'base' };
    const d = this.blockInForce(b);
    return { act: o, kind: d && d > this.today ? 'future' : 'amended', inForce: d };
  }
  isFutureAct(id) { const d = this.actInForce(id); return d.length > 0 && d.every((x) => x > this.today); }

  // -------------------------------------------------- Einheiten
  unit(id) { return (this.ds.units || {})[id] || null; }
  unitMeta(id, l) {
    const u = this.unit(id);
    const e = this.tocById.get(id);
    const type = (u && u.type) || (e && e.type) || 'article';
    const meta = { id, type, num: (u && u.num) || (e && e.num) || id };
    if (type === 'final') {
      const lang = l || uiLang();
      const vs = this.versions(id, this.langs.includes(lang) ? lang : this.langs[0]);
      const v = vs[vs.length - 1];
      meta.label = v ? plain(v.label || '') : '';
    }
    return meta;
  }
  version(unitId, lang, stageId) {
    return this.memo(`v|${unitId}|${lang}|${stageId}`, () => {
      const v = this.call('getVersion', [unitId, lang, stageId], fb.getVersion);
      return v && v.missing ? null : v; // missing: Einheit in dieser Fassung nicht vorhanden (Kernbibliothek)
    });
  }
  exists(unitId, lang, stageId) { const v = this.version(unitId, lang, stageId); return !!v && !v.repealed; }
  versions(unitId, lang) {
    return this.memo(`vs|${unitId}|${lang}`, () => {
      const u = this.unit(unitId);
      const list = (u && u.versions && u.versions[lang]) || [];
      return [...list].sort((a, b) => this.stageIndex(a.stage) - this.stageIndex(b.stage));
    });
  }
  unitActs(unitId, lang = this.langs[0]) { return this.memo(`ua|${unitId}|${lang}`, () => this.call('unitActs', [unitId, lang], fb.unitActs) || []); }
  unitEvents(unitId) { return this.memo(`ue|${unitId}`, () => this.call('unitEvents', [unitId], fb.unitEvents) || []); }
  // «Geändert» heisst: Wortlaut oder Titel geändert (changesOfStage bzw. blockHistory), nie das blosse Vorhandensein einer
  // Version an einem Stand. Fedlex passt Fussnoten redaktionell an; solche Versionen zählen nicht als Änderung.
  /** Einheiten mit geändertem Wortlaut in einem Stand */
  changedUnits(stageId, lang) { return this.memo(`cu|${stageId}|${lang}`, () => new Set(this.changes(stageId, lang).map((c) => c.unit))); }
  /** Stände (ohne den ersten), in denen sich der Wortlaut der Einheit ändert */
  unitChangeStages(unitId, lang = this.langs[0]) { return this.memo(`ucs|${unitId}|${lang}`, () => this.stages.slice(1).filter((s) => this.changedUnits(s.id, lang).has(unitId)).map((s) => s.id)); }
  /** Einheit ändert sich seit der ersten Fassung mit Wortlaut */
  unitChanged(unitId, lang = this.langs[0]) { return this.unitChangeStages(unitId, lang).length > 0; }
  /** Stand der letzten Änderung des Wortlauts bis und mit stageId (sonst Stand der ersten Version) */
  lastChangeAt(unitId, lang, stageId) {
    const i = this.stageIndex(stageId);
    const ch = this.unitChangeStages(unitId, lang).filter((s) => this.stageIndex(s) <= i);
    if (ch.length) return ch[ch.length - 1];
    const v = this.versions(unitId, lang)[0];
    return v && this.stageIndex(v.stage) <= i ? v.stage : null;
  }
  history(unitId, lang, key) {
    return this.memo(`h|${unitId}|${lang}|${key}`, () => {
      const h = this.call('blockHistory', [unitId, lang, key], fb.blockHistory) || [];
      // Kein Schritt ohne Änderung des Wortlauts (z. B. nur Herkunft oder Fussnote neu zugeordnet)
      const out = [];
      for (const x of h) {
        const prev = out.length ? out[out.length - 1].block : null;
        if (prev && x.block && sameText(prev, x.block)) continue;
        out.push({ stage: x.stage, act: x.act || null, change: x.change || 'replaced', block: x.block || null });
      }
      return out;
    });
  }
  changes(stageId, lang) {
    return this.memo(`c|${stageId}|${lang}`, () => {
      const list = this.call('changesOfStage', [stageId, lang], fb.changesOfStage) || [];
      const prev = this.prevStage(stageId);
      if (!prev) return list;
      // Nur Änderungen des Wortlauts: gleiche Blöcke (Herkunft oder Fussnote neu) fallen weg
      return list.filter((c) => {
        if (!c.key || c.key === '_title' || c.change === 'inserted' || c.change === 'deleted' || c.change === 'repealed') return true;
        const a = (this.version(c.unit, lang, prev.id) || { blocks: [] }).blocks || [];
        const b = (this.version(c.unit, lang, stageId) || { blocks: [] }).blocks || [];
        const pa = a.find((x) => x.k === c.key), pb = b.find((x) => x.k === c.key);
        return !(pa && pb && sameText(pa, pb));
      });
    });
  }

  heading(tocEntry, lang, stageId) {
    const h = tocEntry && tocEntry.heading && (tocEntry.heading[lang] || tocEntry.heading.de);
    if (!Array.isArray(h) || !h.length) return null;
    const idx = this.stageIndex(stageId);
    let best = h[0];
    for (const x of h) if (this.stageIndex(x.from) <= idx) best = x;
    return { ...best, label: plain(best.label || ''), text: plain(best.text || '') };
  }
  tocAlive(e, stageId) {
    const i = this.stageIndex(stageId);
    if (e.from && this.stageIndex(e.from) > i) return false;
    if (e.to && this.stageIndex(e.to) <= i) return false;
    return true;
  }
  /** Titel einer Einheit: html (bereinigt), text (rein), label */
  unitTitle(unitId, lang, stageId) {
    const v = this.version(unitId, lang, stageId || this.current.id) || this.versions(unitId, lang).slice(-1)[0];
    if (!v) return { html: '', text: '', label: '', missing: true };
    if (v.repealed) return { html: '', text: '', label: '', repealed: true };
    const text = plain(v.title || '');
    if (text) return { html: v.title, text, label: text };
    const meta = this.unitMeta(unitId, lang);
    if (meta.type === 'preamble' || meta.type === 'final' || meta.type === 'annex') {
      const lab = plain(v.label || '');
      return { html: '', text: lab, label: lab, fromLabel: true };
    }
    return { html: '', text: '', label: '' };
  }
  /** Zitat-Metadaten (Einheit) in Sprache l */
  citeUnit(unitId, l) { return this.unitMeta(unitId, l); }

  // -------------------------------------------------- Verweise (SPEC §12.2, §12.3)
  /** Verweis-Index am Stand (zwischengespeichert; null ohne src/core/refs.js). Rechenzeit in this.refTimes. */
  refIndex(lang, stageId) {
    if (!refsAvailable() || !stageId) return null;
    return this.memo(`ri|${lang}|${stageId}|${refLibrary.version}`, () => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let ix = null;
      try { ix = refsCore.buildRefIndex(this.ds, lang, stageId, { works: refLibrary.works }); }
      catch (e) { this.coreError('buildRefIndex', e); ix = null; }
      const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
      (this.refTimes || (this.refTimes = [])).push({ lang, stage: stageId, ms: Math.round(dt), refs: ix ? ix.refs.length : 0 });
      return ix;
    });
  }
  /** Blocktext ohne Markup (Grundlage der Positionen at im Index). */
  refPlain(unitId, lang, stageId, key) {
    const v = this.version(unitId, lang, stageId);
    const b = v && (v.blocks || []).find((x) => x.k === key);
    if (!b) return '';
    return refsCore.plainText ? refsCore.plainText(b.t || '') : plain(b.t || '');
  }
  /** Link nach aussen (Fedlex, EUR-Lex) eines Ziels, sonst null. */
  refUrl(to, lang) {
    if (!refsCore.externalUrl || !to) return null;
    try {
      const u = refsCore.externalUrl(to, lang);
      return typeof u === 'string' && /^https:\/\/(www\.fedlex\.admin\.ch|fedlex\.data\.admin\.ch|eur-lex\.europa\.eu)\//.test(u) ? u : null;
    } catch { return null; }
  }

  // -------------------------------------------------- Suche
  searchIndex(lang, stageId) {
    return this.memo(`si|${lang}|${stageId}`, () => {
      const out = [];
      for (const id of this.unitOrder) {
        const v = this.version(id, lang, stageId);
        if (!v || v.repealed) continue;
        out.push({ unit: id, key: null, text: fold(`${plain(v.label || '')} ${plain(v.title || '')}`), raw: plain(v.title || '') });
        for (const b of v.blocks || []) {
          const raw = stripTags(b.t || '');
          out.push({ unit: id, key: b.k, text: fold(raw), raw });
        }
      }
      return out;
    });
  }
}

export { stripTags };
