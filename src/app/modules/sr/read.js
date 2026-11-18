// Lesen: Inhaltsverzeichnis, Bestimmung im gewählten Stand, Sicht «In Kraft am …», Herkunft am Rand, Redline,
// Fussnoten der Quelle, Chronologie-Panel. Dazu die breite Chronologie (Ansicht «Chronologie»).
import { html } from 'htm/preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { go } from '../../state.js';
import { OriginChip, Icon, Notice, Seg, StageStatusTag, Empty, HelpLink, LegalLangSwitch, UnitTitle, TitleText, ExtLink } from '../../ui/common.js';
import { BlockList } from '../../ui/blocks.js';
import { BlockChronology, UnitChronology, EventList } from '../../ui/chronology.js';
import { ExportMenu } from '../../ui/exportmenu.js';
import { cite } from '../../lib/cite.js';
import { safeInline } from '../../lib/sanitize.js';
import { search } from '../../lib/search.js';
import { fmtDate } from '../../lib/format.js';
import { t, uiLang } from '../../lib/i18n.js';
import { settingsStore, persistSettings } from '../../app.js';
import { RefsPanel } from '../../ui/refsnet.js';
import { refsPanelStore } from '../../ui/refs-ui.js';

export const legalLang = (data, route) => (data.langs.includes(route.l) ? route.l : data.langs[0]);
export function currentStage(data, route) {
  if (route.m === 'datum') return data.stageAt(route.d || data.today);
  return route.s && data.stage(route.s) ? route.s : data.current.id;
}
export function currentUnit(data, route) {
  if (route.u && data.unit(route.u)) return route.u;
  return data.unitOrder.find((id) => data.unitMeta(id).type === 'article') || data.unitOrder[0];
}
/** Zitat in der Zitierweise der Oberflächensprache */
export const uiCite = (data, unitId, key, withAbbr = true) => cite(data.unitMeta(unitId, uiLang()), key || null, uiLang(), withAbbr ? data.abbr(uiLang()) : null);
const UNIT_TYPES = new Set(['article', 'annex', 'preamble', 'final']);
/** Grossbuchstabe am Anfang für Listen und Überschriften («Art. 5», «Préambule»); Zitate im Satz bleiben klein. */
export const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------ Inhaltsverzeichnis
function buildTree(data) {
  const kids = new Map();
  for (const e of data.toc) {
    const p = e.parent && data.tocById.has(e.parent) ? e.parent : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(e);
  }
  return kids;
}

function TocUnit({ data, entry, route, stageId, lang, activeUnit }) {
  const v = stageId ? data.version(entry.id, lang, stageId) : null;
  const alive = v && !v.repealed && data.tocAlive(entry, stageId);
  const cur = entry.id === activeUnit;
  const ti = data.unitTitle(entry.id, lang, stageId || data.current.id);
  const nCh = data.unitChangeStages(entry.id, lang).length;
  const future = data.unitChangeStages(entry.id, lang).some((x) => data.isFuture(x));
  const hit = route.act && data.unitActs(entry.id, lang).includes(route.act);
  const status = !v ? t('read.toc.notYet') : v.repealed ? t('read.toc.repealed') : '';
  const meta = data.unitMeta(entry.id, uiLang());
  return html`<li class=${'toc-unit' + (cur ? ' is-current' : '') + (alive ? '' : ' is-dead') + (meta.type === 'annex' ? ' is-annex' : '') + (meta.type === 'final' || meta.type === 'preamble' ? ' is-wide' : '')}>
    <a href=${`#/lesen?w=${data.id}&u=${entry.id}`} aria-current=${cur ? 'page' : undefined}
      onClick=${(e) => { e.preventDefault(); go({ view: 'lesen', u: entry.id, k: null }); }}>
      <span class="toc-num">${meta.type === 'final' ? t('read.toc.final') : capFirst(cite(meta, null, uiLang(), null))}</span>
      ${status ? html`<span class="toc-title" title=${status}>${status}</span>` : meta.type === 'preamble' ? null : html`<${TitleText} ti=${ti} lang=${lang} className="toc-title" />`}
      ${nCh > 0 || future || hit ? html`<span class="toc-acts">
        ${nCh > 0 ? html`<span class="toc-mark" title=${t('read.toc.changedTip', { n: nCh, date: fmtDate(data.first.date) })}>${t('read.toc.changedN', { n: nCh })}</span>` : null}
        ${future ? html`<span class="toc-mark is-pending" title=${t('status.future')}>${t('status.futureShort')}</span>` : null}
        ${hit ? html`<span class="toc-mark is-hit">${data.actCode(route.act)}</span>` : null}
      </span>` : null}
    </a>
  </li>`;
}

function TocNode({ data, entry, kids, route, stageId, lang, activeUnit, filter }) {
  const ch = (kids.get(entry.id) || []).filter((c) => filter(c));
  if (!ch.length) return null;
  const h = data.heading(entry, lang, stageId || data.current.id);
  return html`<li class=${'toc-group toc-g-' + entry.type}>
    <details open>
      <summary lang=${lang}><span class="toc-glabel">${h ? h.label : entry.num}</span> <span class="toc-gtext">${h ? h.text : ''}</span></summary>
      <ul>${ch.map((c) => (UNIT_TYPES.has(c.type)
        ? html`<${TocUnit} data=${data} entry=${c} route=${route} stageId=${stageId} lang=${lang} activeUnit=${activeUnit} />`
        : html`<${TocNode} data=${data} entry=${c} kids=${kids} route=${route} stageId=${stageId} lang=${lang} activeUnit=${activeUnit} filter=${filter} />`))}</ul>
    </details>
  </li>`;
}

/** Erlasse, die Einheiten dieses Erlasses geprägt haben (für Filter), jüngste zuerst. */
export function actsForFilter(data, lang) {
  const set = new Set(data.unitOrder.flatMap((id) => data.unitActs(id, lang)));
  const key = (c) => (data.actInForce(c)[0] || '0000');
  return [...set].sort((x, y) => key(y).localeCompare(key(x)));
}

function Toc({ data, route, stageId, lang, activeUnit }) {
  const kids = useMemo(() => buildTree(data), [data]);
  const [q, setQ] = useState(route.q || '');
  useEffect(() => { setQ(route.q || ''); }, [route.q]);
  const onlyChanged = route.ch === '1';
  const actF = route.act;
  const unitOk = (id) => (!onlyChanged || data.unitChanged(id, lang)) && (!actF || data.unitActs(id, lang).includes(actF));
  const memo = new Map();
  const filter = (e) => {
    if (UNIT_TYPES.has(e.type)) return unitOk(e.id);
    if (memo.has(e.id)) return memo.get(e.id);
    const r = (kids.get(e.id) || []).some(filter);
    memo.set(e.id, r);
    return r;
  };
  const sid = stageId || data.current.id;
  const res = useMemo(() => (route.q ? search(data, route.q, lang, sid) : null), [data, route.q, lang, sid]);
  const roots = kids.get(null) || [];
  const scrollRef = useRef();
  useEffect(() => {
    const el = scrollRef.current && scrollRef.current.querySelector('.toc-unit.is-current');
    if (!el) return;
    const box = scrollRef.current.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < box.top || r.bottom > box.bottom) scrollRef.current.scrollTop += r.top - box.top - box.height / 3;
  }, [activeUnit, !!res]);
  const acts = useMemo(() => actsForFilter(data, lang), [data, lang]);
  const submit = (e) => {
    e.preventDefault();
    const r = search(data, q, lang, sid);
    if (r.refs.length === 1 && !r.hits.length) go({ view: 'lesen', u: r.refs[0].unit, k: r.refs[0].key, q: null });
    else go({ q: q || null });
  };
  const summary = res ? [
    res.refs.length ? t('read.search.units', { n: res.refs.length }) : '',
    res.total ? t('read.search.hits', { n: res.total }) : '',
  ].filter(Boolean).join(', ') + (res.total > res.hits.length ? ' ' + t('read.search.first', { n: res.hits.length }) : '') : '';
  stageId = sid; // vor der ersten Fassung mit Wortlaut: Gliederung der geltenden Fassung
  return html`<aside class="toc" aria-label=${t('read.toc.label')}>
    <div class="toc-head">
      <form class="toc-search" role="search" onSubmit=${submit}>
        <label class="sr" for="toc-q">${t('read.search.label')}</label>
        <${Icon} name="search" />
        <input id="toc-q" type="search" placeholder=${t('read.search.placeholder')} title=${t('read.search.placeholder')} value=${q} onInput=${(e) => setQ(e.target.value)} />
        ${route.q ? html`<button type="button" class="btn-icon is-bare" aria-label=${t('read.search.reset')} title=${t('read.search.reset')} onClick=${() => { setQ(''); go({ q: null }); }}><${Icon} name="close" /></button>` : null}
      </form>
      <div class="toc-filters">
        <label class="check"><input type="checkbox" checked=${onlyChanged} onChange=${(e) => go({ ch: e.target.checked ? '1' : '0' }, { replace: true })} />${t('read.toc.onlyChanged', { date: fmtDate(data.first.date) })}</label>
        <label class="field field-row"><span class="field-label">${t('read.toc.actFilter')}</span>
          <select id="toc-act" value=${actF || ''} onChange=${(e) => go({ act: e.target.value || null }, { replace: true })}>
            <option value="">${t('read.toc.allActs')}</option>
            ${acts.map((c) => html`<option value=${c} title=${data.actName(c)}>${data.actCode(c)}${data.actInForce(c)[0] ? ' (' + data.actInForce(c)[0].slice(0, 4) + ')' : ''}</option>`)}
          </select></label>
      </div>
    </div>
    <div class="toc-scroll" ref=${scrollRef}>
      ${res ? html`<div class="search-res" aria-live="polite">
          <p class="search-sum">${summary || t('read.search.none')}</p>
          <ul>
            ${res.refs.map((r) => { const ti = data.unitTitle(r.unit, lang, sid); return html`<li><a href="#" class="sr-unit" onClick=${(e) => { e.preventDefault(); go({ view: 'lesen', u: r.unit, k: r.key }); }}><b>${capFirst(uiCite(data, r.unit, r.key, false))}</b> <${TitleText} ti=${ti} lang=${lang} /></a></li>`; })}
            ${res.hits.map((h) => html`<li><a href="#" onClick=${(e) => { e.preventDefault(); go({ view: 'lesen', u: h.unit, k: h.key }); }}><b>${capFirst(uiCite(data, h.unit, h.key, false))}</b><span class="sr-snip" lang=${lang} dangerouslySetInnerHTML=${{ __html: h.html }}></span></a></li>`)}
          </ul>
        </div>`
      : html`<nav aria-label=${t('read.toc.outline')}><ul class="toc-tree">${roots.filter(filter).map((e) => (UNIT_TYPES.has(e.type)
          ? html`<${TocUnit} data=${data} entry=${e} route=${route} stageId=${stageId} lang=${lang} activeUnit=${activeUnit} />`
          : html`<${TocNode} data=${data} entry=${e} kids=${kids} route=${route} stageId=${stageId} lang=${lang} activeUnit=${activeUnit} filter=${filter} />`))}</ul>
        ${roots.filter(filter).length === 0 ? html`<p class="muted pad">${t('read.toc.noMatch')}</p>` : null}</nav>`}
    </div>
  </aside>`;
}

// ------------------------------------------------------------ Standwahl: Auswahlliste, Blättern, Leiste nach Jahren
export function StageSelect({ data, value, onChange, id, unitId, lang, label }) {
  const changed = unitId ? new Set(data.unitChangeStages(unitId, lang)) : new Set();
  return html`<select id=${id} value=${value} aria-label=${label} onChange=${(e) => onChange(e.target.value)}>
    ${[...data.stages].reverse().map((s) => html`<option value=${s.id} title=${data.stageLabel(s.id)}>${data.stageOption(s.id, changed.has(s.id) && s.id !== data.first.id)}</option>`)}
  </select>`;
}

export function StageBar({ data, unitId, lang, value, onPick }) {
  const changedAt = new Set(data.unitChangeStages(unitId, lang));
  const years = [];
  for (const s of data.stages) {
    const y = s.date.slice(0, 4);
    if (!years.length || years[years.length - 1].y !== y) years.push({ y, items: [] });
    years[years.length - 1].items.push(s);
  }
  const cur = data.current.id;
  return html`<div class="sbar-wrap">
    <div class="sbar" role="group" aria-label=${t('read.stagebar.label')}>
      ${years.map((g) => html`<div class="sbar-year"><span class="sbar-y" aria-hidden="true">${g.y}</span><div class="sbar-items">
        ${g.items.map((s) => {
          const ch = changedAt.has(s.id) && s.id !== data.first.id;
          const exists = data.exists(unitId, lang, s.id);
          const fut = data.isFuture(s.id);
          const tip = [data.stageLabel(s.id), data.stageStatus(s.id).label, ch ? t('read.stagebar.changesUnit') : '', !exists ? t('read.stagebar.absent') : '', s.gap ? t('read.stagebar.gap', { n: s.gap }) : ''].filter(Boolean).join(', ');
          return html`<button type="button" class=${'sbar-item' + (ch ? ' is-changed' : '') + (exists ? '' : ' is-absent') + (fut ? ' is-future' : '') + (s.id === cur ? ' is-today' : '')} aria-pressed=${value === s.id ? 'true' : 'false'} title=${tip} aria-label=${tip} onClick=${() => onPick(s.id)}><span class="sbar-dot" aria-hidden="true"></span></button>`;
        })}
      </div></div>`)}
    </div>
    <p class="sbar-legend">
      <span class="lg"><span class="sbar-item is-changed lg-box" aria-hidden="true"><span class="sbar-dot"></span></span>${t('read.stagebar.legendChanged')}</span>
      <span class="lg"><span class="sbar-item lg-box" aria-hidden="true"><span class="sbar-dot"></span></span>${t('read.stagebar.legendSame')}</span>
      <span class="lg"><span class="sbar-item is-today lg-box" aria-hidden="true"><span class="sbar-dot"></span></span>${t('read.stagebar.legendToday')}</span>
      ${data.stages.some((s) => data.isFuture(s.id)) ? html`<span class="lg"><span class="sbar-item is-future lg-box" aria-hidden="true"><span class="sbar-dot"></span></span>${t('legend.future')}</span>` : null}
    </p>
  </div>`;
}

function StagePicker({ data, unitId, lang, stageId }) {
  const prev = data.prevStage(stageId), next = data.nextStage(stageId);
  const pick = (s) => go({ s, m: 'stand' }, { replace: true });
  return html`<div class="stage-picker">
    <div class="tool-cluster">
      <label class="field field-row"><span class="field-label">${t('common.stage')}</span>
        <${StageSelect} id="read-stage" data=${data} value=${stageId} unitId=${unitId} lang=${lang} onChange=${pick} /></label>
      <button type="button" class="btn-icon" aria-label=${t('read.stagePrev')} title=${t('read.stagePrev')} disabled=${!prev} onClick=${() => prev && pick(prev.id)}><${Icon} name="chevron-left" /></button>
      <button type="button" class="btn-icon" aria-label=${t('read.stageNext')} title=${t('read.stageNext')} disabled=${!next} onClick=${() => next && pick(next.id)}><${Icon} name="chevron-right" /></button>
      <button type="button" class="btn btn-quiet btn-sm" disabled=${stageId === data.current.id} onClick=${() => pick(data.current.id)}><${Icon} name="calendar" />${t('read.stageToday')}</button>
    </div>
    <${StageBar} data=${data} unitId=${unitId} lang=${lang} value=${stageId} onPick=${pick} />
  </div>`;
}

// ------------------------------------------------------------ Panel
function ChronPanel({ data, unitId, k, lang, stageId, onClose, onPick }) {
  const [diff, setDiff] = useState(true);
  const refs = refsPanelStore.use().on;
  const unitLevel = k === '*';
  const spec = unitLevel ? { kind: 'unit', unit: unitId, key: null, lang } : { kind: 'block', unit: unitId, key: k, lang };
  const ref = useRef();
  useEffect(() => { const b = ref.current && ref.current.querySelector('.panel-head .btn-icon'); if (b) b.focus({ preventScroll: true }); }, [unitId, k]);
  // Esc schliesst die Leiste unabhängig davon, wo der Fokus steht (offene Menüs und Dialoge behandeln Esc zuerst selbst).
  // Layout-Effekt: der Handler steht, sobald die Leiste im DOM ist (vorher fiel ein früher Tastendruck selten durch).
  useLayoutEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.drawer, .menu-pop, [role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const setMode = (v) => { if (v === 'r') refsPanelStore.set({ on: true }); else { refsPanelStore.set({ on: false }); if (v === 'd' || v === 't') setDiff(v === 'd'); } };
  // Ebene Bestimmung: «Änderungen | Wortlaut | Verweise»; Ebene Einheit: «Chronologie | Verweise» (SPEC §12.3 A1)
  const modeOpts = unitLevel
    ? [{ value: 'c', label: t('chron.title') }, { value: 'r', label: t('refs.title') }]
    : [{ value: 'd', label: t('chron.showChanges') }, { value: 't', label: t('chron.showText') }, { value: 'r', label: t('refs.title') }];
  const mode = refs ? 'r' : unitLevel ? 'c' : diff ? 'd' : 't';
  return html`<aside class=${'panel' + (refs ? ' is-refs' : '')} ref=${ref} aria-label=${refs ? t('refs.title') : t('chron.title')}>
    <div class="panel-head">
      <div>
        <p class="panel-kicker">${refs ? t('refs.title') : t('chron.title')}</p>
        <h2 class="panel-title">${uiCite(data, unitId, unitLevel ? null : k)}</h2>
      </div>
      <button type="button" class="btn-icon is-bare" aria-label=${t('chron.close')} title=${t('chron.close')} onClick=${onClose}><${Icon} name="close" /></button>
    </div>
    <div class="panel-tools">
      <${Seg} size="sm" label=${t('chron.display')} value=${mode} onChange=${setMode} options=${modeOpts} />
      ${refs ? null : html`<span class="spacer"></span>
      <${ExportMenu} data=${data} spec=${spec} label=${t('export.short')} small />
      <button type="button" class="btn btn-tertiary btn-sm" onClick=${() => go({ view: 'chronik', u: unitId, k })}><${Icon} name="maximize" />${t('chron.wide')}</button>`}
    </div>
    <div class="panel-body">
      ${refs ? html`<${RefsPanel} data=${data} unitId=${unitId} k=${unitLevel ? null : k} lang=${lang} stageId=${stageId} />` : html`
      ${unitLevel ? html`<${UnitChronology} data=${data} unitId=${unitId} lang=${lang} onPick=${onPick} />` : html`<${BlockChronology} data=${data} unitId=${unitId} k=${k} lang=${lang} showDiff=${diff} compact />`}
      <${EventList} data=${data} unitId=${unitId} k=${unitLevel ? null : k} lang=${lang} compact />`}
    </div>
  </aside>`;
}

// ------------------------------------------------------------ Bestimmung
function UnitHeader({ data, unitId, version, lang, stageId }) {
  const meta = data.unitMeta(unitId, lang);
  const ti = version && !version.repealed ? data.unitTitle(unitId, lang, stageId) : { html: '', text: '' };
  const fedlexUrl = `https://www.fedlex.admin.ch/eli/${data.work.eli ? data.work.eli.replace(/^.*\/eli\//, '') : ''}/${data.stageDate(stageId) ? data.stageDate(stageId).replace(/-/g, '') : ''}/${lang}`;
  return html`<header class="unit-head">
    ${version && version.label && meta.type === 'article' ? html`<p class="unit-label" lang=${lang} dangerouslySetInnerHTML=${{ __html: safeInline(version.label) }}></p>` : html`<p class="unit-label" lang=${lang}>${cite(meta, null, lang, null)}</p>`}
    <${UnitTitle} ti=${ti.fromLabel && meta.type !== 'article' ? { text: '' } : ti} lang=${lang} />
    <p class="unit-meta">
      <span>${uiCite(data, unitId, null)}</span>
      <span>${data.stageLabel(stageId)}</span>
      <${StageStatusTag} data=${data} stageId=${stageId} />
      <${ExtLink} href=${fedlexUrl}>${t('read.onFedlex')}</${ExtLink}>
    </p>
  </header>`;
}

function OriginLegend({ data, version, route }) {
  if (!version || !version.blocks) return null;
  const acts = [...new Set(version.blocks.map((b) => b.o).filter((o) => o && !data.isBase(o)))];
  if (!acts.length) return html`<div class="act-legend"><h2 class="act-legend-title">${t('read.originBy')}</h2><p class="muted">${t('read.originBase')}</p></div>`;
  const when = (c) => {
    const ds = [...new Set(version.blocks.filter((b) => b.o === c).map((b) => data.blockInForce(b)).filter(Boolean))].sort();
    if (!ds.length) return '';
    const fut = ds.filter((d) => d > data.today), past = ds.filter((d) => d <= data.today);
    return [past.length ? t('blocks.inForceSince', { date: past.map((d) => fmtDate(d)).join(', ') }) : '', fut.length ? t('blocks.inForceFrom', { date: fut.map((d) => fmtDate(d)).join(', ') }) : ''].filter(Boolean).join('; ');
  };
  return html`<div class="act-legend">
    <h2 class="act-legend-title">${t('read.originBy')}</h2>
    <ul class="act-legend-list">
      ${acts.map((c) => { const nm = data.actName(c) !== data.actCode(c) ? data.actName(c) : ''; const w = when(c); return html`<li class="act-legend-item"><${OriginChip} data=${data} act=${c} selected=${route.act === c} active=${route.act === c} onClick=${() => go({ act: route.act === c ? null : c }, { replace: true })} title=${t('read.originToggle', { name: data.actName(c) })} /><span class="small">${[nm, w].filter(Boolean).join(', ')}</span></li>`; })}
    </ul>
  </div>`;
}

export function Read({ data, route }) {
  const lang = legalLang(data, route);
  const unitId = currentUnit(data, route);
  const mode = route.m === 'datum' ? 'datum' : 'stand';
  const date = route.d || data.today;
  const stageId = currentStage(data, route);
  const settings = settingsStore.use();
  const redline = route.red === '1';
  const mainRef = useRef();

  const version = stageId ? data.version(unitId, lang, stageId) : null;
  const prevStage = stageId ? data.prevStage(stageId) : null;
  const prev = redline && prevStage ? data.version(unitId, lang, prevStage.id) : null;
  const changedHere = stageId && data.unitChangeStages(unitId, lang).includes(stageId);
  const lcs = stageId ? data.lastChangeAt(unitId, lang, stageId) : null;
  const lastChange = lcs ? { stage: lcs } : null;

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [unitId]);
  useEffect(() => {
    if (!route.k || route.k === '*' || !mainRef.current) return;
    const el = mainRef.current.querySelector(`[data-k="${CSS.escape(route.k)}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [route.k, unitId]);

  const idx = data.unitOrder.indexOf(unitId);
  const prevU = idx > 0 ? data.unitOrder[idx - 1] : null;
  const nextU = idx < data.unitOrder.length - 1 ? data.unitOrder[idx + 1] : null;
  const panelOpen = !!route.k;
  const st = stageId ? data.stage(stageId) : null;
  const tlAt = mode === 'datum' ? data.versionAt(date) : null;
  const pdfAt = tlAt && tlAt.pdf ? tlAt.pdf[lang] || tlAt.pdf.de : null;

  return html`<div class=${'view view-read' + (panelOpen ? ' has-panel' : '')}>
    <${Toc} data=${data} route=${route} stageId=${stageId} lang=${lang} activeUnit=${unitId} />
    <main class="reader" ref=${mainRef} id="main" tabindex="-1">
      <div class="reader-tools">
        <div class="toolbar">
          <div class="tool-group">
            <span class="tool-label" id="lbl-mode">${t('read.mode.label')}</span>
            <${Seg} labelledby="lbl-mode" value=${mode} onChange=${(m) => go({ m, d: m === 'datum' ? route.d || data.today : route.d }, { replace: true })} options=${[
              { value: 'stand', label: t('read.mode.stand') },
              { value: 'datum', label: t('read.mode.datum') },
            ]} />
          </div>
          ${mode === 'datum' ? html`<label class="tool-group"><span class="tool-label">${t('read.date')}</span><input type="date" id="read-date" value=${date} onChange=${(e) => go({ d: e.target.value || null }, { replace: true })} /></label>` : null}
          <span class="spacer"></span>
          <div class="tool-cluster"><${LegalLangSwitch} data=${data} route=${route} /><${HelpLink} sec="lesen" /></div>
        </div>
        ${mode === 'stand' ? html`<${StagePicker} data=${data} unitId=${unitId} lang=${lang} stageId=${stageId} />` : null}
        <div class="toolbar toolbar-checks">
          <label class="check"><input type="checkbox" checked=${redline} onChange=${(e) => go({ red: e.target.checked ? '1' : '0' }, { replace: true })} />${t('read.redline')}</label>
          <label class="check"><input type="checkbox" checked=${settings.origin} onChange=${(e) => { settingsStore.set({ ...settings, origin: e.target.checked }); persistSettings(); }} />${t('read.originMarks')}</label>
        </div>
      </div>

      ${!stageId ? html`<article class="unit"><div class="unit-notes"><${Notice} kind="info" title=${t('read.notice.beforeXmlTitle')}>
          ${t('read.notice.beforeXml', { date: fmtDate(date), first: fmtDate(data.first.date) })}
          ${pdfAt ? html` <${ExtLink} href=${pdfAt}>${t('read.notice.pdfOf', { date: fmtDate(tlAt.date) })}</${ExtLink}>` : null}
        </${Notice}></div>
        <${EventList} data=${data} unitId=${unitId} k=${null} lang=${lang} /></article>` : html`
      <article class="unit">
        <${UnitHeader} data=${data} unitId=${unitId} version=${version} lang=${lang} stageId=${stageId} />
        <div class="unit-notes">
          ${mode === 'datum' ? html`<${Notice} kind="info" title=${t('read.notice.atTitle', { date: fmtDate(date) })}>
              ${t('read.notice.atText', { stage: data.stageLabel(stageId), from: fmtDate(st.date) })}${st.end ? ' ' + t('read.notice.atUntil', { date: fmtDate(st.end) }) : ''}
              ${tlAt && tlAt.date !== st.date ? html` ${t('read.notice.atPdfOnly', { date: fmtDate(tlAt.date) })} ${pdfAt ? html`<${ExtLink} href=${pdfAt}>${t('read.notice.pdfOf', { date: fmtDate(tlAt.date) })}</${ExtLink}>` : null}` : null}
            </${Notice}>` : null}
          ${data.isFuture(stageId) ? html`<${Notice} kind="future" icon="calendar" title=${t('status.future')}>${t('read.notice.future', { date: fmtDate(st.date) })}</${Notice}>` : null}
          ${redline && st && st.gap > 0 ? html`<${Notice} kind="warning" title=${t('read.notice.gapTitle')}>${t('read.notice.gap', { n: st.gap })}</${Notice}>` : null}
          ${redline && !prevStage ? html`<${Notice} kind="info">${t('read.notice.firstStage')}</${Notice}>` : null}
          ${redline && prevStage && !changedHere ? html`<${Notice} kind="info">${t('read.notice.notChanged')} ${lastChange && lastChange.stage !== data.first.id ? html`${t('read.notice.lastChange')} <button type="button" class="link" onClick=${() => go({ s: lastChange.stage, m: 'stand' }, { replace: true })}>${data.stageLabel(lastChange.stage)}</button>.` : t('read.notice.unchangedSinceFirst', { date: fmtDate(data.first.date) })}</${Notice}>` : null}
        </div>
        ${!version ? html`<${Empty} title=${t('read.empty.notYet')}>${data.versions(unitId, lang)[0] ? html`${t('read.empty.insertedWith')} <button type="button" class="link" onClick=${() => go({ s: data.versions(unitId, lang)[0].stage, m: 'stand' })}>${data.stageLabel(data.versions(unitId, lang)[0].stage)}</button>.` : null}</${Empty}>`
          : version.repealed ? html`<${Empty} title=${t('read.empty.repealed')}>${t('read.empty.repealedText', { stage: data.stageLabel(version.stage) })}</${Empty}>`
          : html`
            <div class="unit-bar">
              <${OriginLegend} data=${data} version=${version} route=${route} />
              <div class="unit-actions">
                <button type="button" class="btn btn-secondary" onClick=${() => go({ k: '*' })}><${Icon} name="clock" />${t('read.unitChron')}</button>
                <button type="button" class="btn btn-tertiary" onClick=${() => go({ view: 'vergleich', u: unitId, k: null, cm: 'stand', a: prevStage ? (lastChange && lastChange.stage === stageId ? prevStage.id : (data.prevStage(lastChange ? lastChange.stage : stageId) || data.first).id) : data.first.id, b: stageId })}><${Icon} name="columns" />${t('read.compare')}</button>
              </div>
            </div>
            <p class="hint"><${Icon} name="clock" />${t('read.hint')}</p>
            <div class="legal legal-read" lang=${lang}>
              <${BlockList} data=${data} unitId=${unitId} version=${version} lang=${lang} prev=${prev} redline=${redline && !!prevStage} selectedKey=${route.k}
                originMarks=${settings.origin} selAct=${route.act} onSelect=${(k) => go({ k: route.k === k ? null : k })} />
            </div>`}
        <nav class="unit-nav" aria-label=${t('read.pager')}>
          ${prevU ? html`<button type="button" class="btn btn-tertiary" onClick=${() => go({ u: prevU, k: null })}><${Icon} name="arrow-left" />${capFirst(uiCite(data, prevU, null, false))}</button>` : html`<span></span>`}
          ${nextU ? html`<button type="button" class="btn btn-tertiary" onClick=${() => go({ u: nextU, k: null })}>${capFirst(uiCite(data, nextU, null, false))}<${Icon} name="arrow-right" /></button>` : null}
        </nav>
      </article>`}
    </main>
    ${panelOpen ? html`<${ChronPanel} data=${data} unitId=${unitId} k=${route.k} lang=${lang} stageId=${stageId || data.current.id} onClose=${() => go({ k: null })} onPick=${(k) => go({ k })} />` : null}
  </div>`;
}

// ------------------------------------------------------------ Chronologie breit
export function UnitSelect({ data, value, lang, onChange, id }) {
  return html`<select id=${id} value=${value} onChange=${(e) => onChange(e.target.value)}>${data.unitOrder.map((uid) => {
    const ti = data.unitTitle(uid, lang, data.current.id);
    const meta = data.unitMeta(uid, uiLang());
    const head = meta.type === 'final' ? t('read.toc.final') : capFirst(uiCite(data, uid, null, false));
    const txt = ti.label || (ti.repealed ? t('read.toc.repealed') : '');
    const short = txt.length > 60 ? txt.slice(0, 58).replace(/\s+\S*$/, '') + ' …' : txt;
    return html`<option value=${uid} title=${txt}>${head}${short ? ': ' + short : ''}</option>`;
  })}</select>`;
}

export function KeySelect({ data, unitId, lang, value, onChange, id }) {
  const keys = new Map();
  for (const v of data.versions(unitId, lang)) for (const b of v.blocks || []) if (!keys.has(b.k) && b.ty !== 'heading') keys.set(b.k, b);
  return html`<select id=${id} value=${value} onChange=${(e) => onChange(e.target.value)}>
    <option value="*">${t('common.wholeUnit')}</option>
    ${[...keys.values()].map((b) => html`<option value=${b.k}>${capFirst(uiCite(data, unitId, b.k, false))}</option>`)}
  </select>`;
}

export function ChronikView({ data, route }) {
  const lang = legalLang(data, route);
  const unitId = currentUnit(data, route);
  const k = route.k && route.k !== '*' ? route.k : null;
  const ti = data.unitTitle(unitId, lang, data.current.id);
  const [diff, setDiff] = useState(true);
  const spec = k ? { kind: 'block', unit: unitId, key: k, lang } : { kind: 'unit', unit: unitId, key: null, lang };
  return html`<div class="view view-chronik">
    <main class="wide" id="main" tabindex="-1">
      <div class="view-tools">
        <div class="toolbar">
          <label class="field"><span class="field-label">${t('common.unit')}</span>
            <${UnitSelect} id="chr-unit" data=${data} value=${unitId} lang=${lang} onChange=${(u) => go({ u, k: null })} /></label>
          <label class="field"><span class="field-label">${t('common.provision')}</span>
            <${KeySelect} id="chr-key" data=${data} unitId=${unitId} lang=${lang} value=${k || '*'} onChange=${(v) => go({ k: v })} /></label>
          ${k ? html`<div class="field"><span class="field-label" id="lbl-disp">${t('chron.display')}</span><${Seg} labelledby="lbl-disp" value=${diff ? 'd' : 't'} onChange=${(v) => setDiff(v === 'd')} options=${[{ value: 'd', label: t('chron.showChanges') }, { value: 't', label: t('chron.showText') }]} /></div>` : null}
          <span class="spacer"></span>
          <div class="tool-cluster"><${LegalLangSwitch} data=${data} route=${route} field /><${HelpLink} sec="chronologie" /></div>
        </div>
        <div class="toolbar toolbar-actions">
          <${ExportMenu} data=${data} spec=${spec} />
          <button type="button" class="btn btn-tertiary" onClick=${() => go({ view: 'lesen', u: unitId, k: route.k })}><${Icon} name="book" />${t('chron.showInText')}</button>
        </div>
      </div>
      <header class="unit-head">
        <p class="unit-label">${t('chron.title')}</p>
        <h1 class="unit-title">${uiCite(data, unitId, k)}</h1>
        <p class="unit-meta"><${TitleText} ti=${ti} lang=${lang} /></p>
      </header>
      <div class="chron-wide">
        ${k ? html`<${BlockChronology} data=${data} unitId=${unitId} k=${k} lang=${lang} showDiff=${diff} />` : html`<${UnitChronology} data=${data} unitId=${unitId} lang=${lang} onPick=${(kk) => go({ k: kk })} />`}
        <${EventList} data=${data} unitId=${unitId} k=${k} lang=${lang} />
      </div>
    </main>
  </div>`;
}
