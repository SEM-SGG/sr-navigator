// Verweisstruktur in der Übersicht (SPEC §12.3 C): Bogendiagramm über der Gliederung, Zeilen je Ziel-Erlass,
// Auswahl einer Einheit mit Leiste, Tabelle als Textfassung, PNG-Export. Berechnung erst in Sichtnähe.
import { html } from 'htm/preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { go } from '../../state.js';
import { HelpLink, Icon, Seg, Notice, TitleText } from '../../ui/common.js';
import { structureModel, cellLevel, arcStroke, arcPath, arcHeight, thinLabels } from '../../ui/refsstructure-model.js';
import { egoGraph, strongest } from '../../ui/refsgraph-model.js';
import { exposeRefsTestApi, useRefsCtx, nodeLabel, nodeLink, onInternal, textWidth, fitText, useWidth, useFontsReady, refsSetting, setRefsSetting, RefsLegend } from '../../ui/refs-ui.js';
import { RefsDialog, groupName, sideText } from '../../ui/refsnet.js';
import { cite } from '../../lib/cite.js';
import { fmtDate, fmtNum } from '../../lib/format.js';
import { t, uiLang } from '../../lib/i18n.js';
import { toast } from '../../app.js';

exposeRefsTestApi({ egoGraph, structureModel, structColumns: (data, lang, stageId) => structColumns(data, lang, stageId) });

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const LABEL_FONT = '400 11px "IBM Plex Sans"';
const BAND_FONT = '400 12px "IBM Plex Sans"';
const LABEL_MAX = 52; // längere Nummern («109quinquies») werden nicht beschriftet (voll im Tooltip und aria-label)
export const ST = { padX: 7, maxArc: 150, axis: 14, band: 24, row: 18, rowGap: 4, pad: 6, minCol: 4, maxCol: 40, labelCol: 176 };

/** Oberste Gliederungsebene einer Einheit (Kennung im Inhaltsverzeichnis). */
function topOf(data, unitId) {
  let e = data.tocById.get(unitId);
  let top = e ? e.id : unitId;
  while (e && e.parent && data.tocById.has(e.parent)) { e = data.tocById.get(e.parent); top = e.id; }
  return top;
}
/** Spalten: alle am Stand vorhandenen Einheiten in der Reihenfolge der Gliederung. */
export function structColumns(data, lang, stageId) {
  return data.memo(`rsc|${lang}|${stageId}`, () => data.unitOrder.filter((u) => { const v = data.version(u, lang, stageId); return v && !v.repealed; }).map((u) => ({ unit: u, top: topOf(data, u) })));
}
/** Kurzbeschriftung einer Spalte: Nummer der Einheit. */
export function colLabel(data, unitId, finals) {
  const m = data.unitMeta(unitId, uiLang());
  if (m.type === 'article') return String(m.num);
  if (m.type === 'annex') return t('refs.st.annexShort', { n: m.num || '' }).trim();
  if (m.type === 'preamble') return t('refs.st.preambleShort');
  const i = finals.indexOf(unitId);
  return finals.length > 1 ? t('refs.st.finalShortN', { n: i + 1 }) : t('refs.st.finalShort');
}
const unitCite = (data, u, abbr = false) => { const m = data.unitMeta(u, uiLang()); return m.type === 'final' ? (m.label || t('read.toc.final')) : cap(cite(m, null, uiLang(), abbr ? data.abbr(uiLang()) : null)); };
/** Band der obersten Ebene: kurz «1. Kapitel» bzw. Nummer, voll mit Titel. */
function bandText(data, top, lang, stageId) {
  const e = data.tocById.get(top);
  if (!e) return { short: '', full: '' };
  if (['article', 'annex', 'preamble', 'final'].includes(e.type)) { const c = unitCite(data, top); return { short: c, full: c, tiny: '' }; }
  const h = data.heading(e, lang, stageId);
  const label = h ? h.label.replace(/[:.\s]+$/, '') : String(e.num || '');
  return { short: label, tiny: String(e.num || ''), full: h ? `${h.label} ${h.text}`.trim() : label };
}

/** Geometrie des Diagramms (ohne DOM). */
export function structGeometry(model, colW, labelH) {
  // mindestens 96 px, damit der Tooltip über der Achse Platz hat
  const maxH = Math.max(96, Math.min(ST.maxArc, model.arcs.reduce((m, a) => Math.max(m, arcHeight(a.a * colW, a.b * colW, ST.maxArc)), 8)));
  const yAxis = ST.pad + maxH + 2;
  const yLab = yAxis + ST.axis / 2 + 2;
  const yBand = yLab + labelH + 4;
  const yRows = yBand + ST.band + 8;
  const rowsY = model.rows.map((r, i) => yRows + i * (ST.row + ST.rowGap));
  const height = (rowsY.length ? rowsY[rowsY.length - 1] + ST.row : yRows) + ST.pad;
  return { maxH, yAxis, yLab, yBand, yRows, rowsY, height, width: model.columns.length * colW };
}

/** Spaltenbreite, Beschriftungen und Geometrie für die verfügbare Breite (Diagramm, Zeilenbeschriftung, Karte). */
export function chartLayout(data, model, avail) {
  const n = model.columns.length;
  const colW = Math.max(ST.minCol, Math.min(ST.maxCol, ((avail || 800) - 2 * ST.padX) / Math.max(1, n)));
  const finals = model.columns.filter((c) => data.unitMeta(c.unit).type === 'final').map((c) => c.unit);
  const labels = model.columns.map((c) => colLabel(data, c.unit, finals));
  const widths = labels.map((l) => textWidth(l, LABEL_FONT));
  let th = thinLabels(n, colW, (i) => Math.min(widths[i], LABEL_MAX), 13, 4);
  if (th.rotate) {
    // Nie kürzen: zu lange Nummern («109quinquies») auslassen und die nächste kürzere Einheit beschriften, mit Mindestabstand
    const gap = Math.max(1, Math.ceil(15 / colW));
    const show = [];
    let last = -Infinity;
    for (let base = 0; base < n; base += th.step) {
      for (let j = Math.max(base, last + gap); j < Math.min(n, base + th.step); j++) {
        if (widths[j] <= LABEL_MAX) { show.push(j); last = j; break; }
      }
    }
    th = { ...th, show };
  }
  const labelH = th.rotate ? Math.max(...th.show.map((i) => textWidth(labels[i], LABEL_FONT)), 10) + 6 : 16;
  return { n, colW, labels, th, labelH, g: structGeometry(model, colW, labelH) };
}

// ------------------------------------------------------------ Diagramm
export function StructChart({ data, ctx, model, lang, stageId, sel, onSelect, avail, card = false }) {
  const L = useMemo(() => chartLayout(data, model, avail), [data, model, avail, uiLang()]);
  const { n, colW, labels, th, g } = L;
  const W = Math.ceil(g.width) + 2 * ST.padX; // Rand links und rechts für gedrehte Beschriftungen
  const P = ST.padX;
  const [focusIdx, setFocusIdx] = useState(sel != null ? sel : 0);
  const [tip, setTip] = useState(null);
  const svgRef = useRef();
  useEffect(() => { if (sel != null) setFocusIdx(sel); }, [sel]);
  const cx = (i) => i * colW + colW / 2;
  const lx = cx;
  const selArcs = useMemo(() => {
    if (sel == null) return null;
    const out = new Set(), inn = new Set();
    for (const a of model.arcs) { if (a.a !== sel && a.b !== sel) continue; const o = a.a === sel ? a.nab : a.nba; (o > 0 ? out : inn).add(a); }
    return { out, inn };
  }, [model, sel]);
  const statsOf = (u) => model.units.get(u) || { inRefs: 0, outRefs: 0, inUnits: 0, outNodes: 0 };
  const colAria = (i) => { const u = model.columns[i].unit; const s = statsOf(u); return `${unitCite(data, u)}: ${t('refs.st.colAria', { out: s.outRefs, inn: s.inRefs })}`; };
  const focusCol = (i) => {
    const el = svgRef.current && svgRef.current.querySelector(`rect.rs-col[data-col="${i}"]`);
    if (el) { el.focus({ preventScroll: true }); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };
  const onKey = (e) => {
    let i = focusIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = Math.min(n - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = Math.max(0, i - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(sel === focusIdx ? null : focusIdx); return; }
    else return;
    e.preventDefault();
    setFocusIdx(i);
    setTimeout(() => focusCol(i), 0);
  };
  const tipAt = (x, y, lines) => setTip({ x, y, lines });
  const onMove = (e) => {
    if (card) return;
    const tg = e.target;
    if (tg && tg.dataset && tg.dataset.arc != null) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = e.clientX - r.left - P, y = e.clientY - r.top;
    const i = Math.floor(x / colW);
    if (i < 0 || i >= n) { setTip(null); return; }
    const u = model.columns[i].unit;
    const ri = g.rowsY.findIndex((ry) => y >= ry - 1 && y <= ry + ST.row + 1);
    if (ri >= 0) {
      const row = model.rows[ri];
      const v = row.cells.get(i) || 0;
      tipAt(x, y, [`${unitCite(data, u)} → ${groupName(ctx, row.group)}`, t('refs.nFund', { n: v })]);
    } else if (y >= g.yBand && y <= g.yBand + ST.band) {
      const b = model.bands.find((bb) => i >= bb.from && i <= bb.to);
      tipAt(x, y, [bandText(data, b.top, lang, stageId).full]);
    } else {
      const s = statsOf(u);
      const ti = data.unitTitle(u, lang, stageId);
      tipAt(x, y, [unitCite(data, u) + (ti.text ? ': ' + ti.text : ''), t('refs.st.colAria', { out: s.outRefs, inn: s.inRefs })]);
    }
  };
  const onClick = (e) => {
    if (card) return;
    const r = svgRef.current.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - P) / colW);
    if (i >= 0 && i < n) { setFocusIdx(i); onSelect(sel === i ? null : i); }
  };
  const arcTip = (a) => (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const ua = model.columns[a.a].unit, ub = model.columns[a.b].unit;
    const lines = [`${unitCite(data, ua)} ↔ ${unitCite(data, ub)}`, t('refs.nFund', { n: a.n })];
    if (a.nab) lines.push(`${unitCite(data, ua)} → ${unitCite(data, ub)}: ${fmtNum(a.nab)}`);
    if (a.nba) lines.push(`${unitCite(data, ub)} → ${unitCite(data, ua)}: ${fmtNum(a.nba)}`);
    tipAt(e.clientX - r.left - P, e.clientY - r.top, lines);
  };
  const arcCls = (a) => {
    if (!selArcs) return 'rs-arc';
    if (selArcs.out.has(a)) return 'rs-arc is-out';
    if (selArcs.inn.has(a)) return 'rs-arc is-in';
    return 'rs-arc is-dim';
  };
  // Gewählte Bögen zuletzt zeichnen (oben)
  const arcsDraw = selArcs ? [...model.arcs.filter((a) => !selArcs.out.has(a) && !selArcs.inn.has(a)), ...model.arcs.filter((a) => selArcs.out.has(a) || selArcs.inn.has(a))] : model.arcs;
  // Bänder einheitlich beschriften: «5. Kapitel», wenn alle passen, sonst die Nummer, wo sie passt
  const bandMode = useMemo(() => {
    const fits = (b, txt) => textWidth(txt, BAND_FONT) <= (b.to - b.from + 1) * colW - 6;
    const named = model.bands.filter((b) => bandText(data, b.top, lang, stageId).tiny);
    return named.every((b) => fits(b, bandText(data, b.top, lang, stageId).short)) ? 'short' : 'tiny';
  }, [model, colW, lang, uiLang()]);
  const bandFit = (b) => {
    const w = (b.to - b.from + 1) * colW - 6;
    const bt = bandText(data, b.top, lang, stageId);
    const txt = bandMode === 'short' || !bt.tiny ? bt.short : bt.tiny;
    return textWidth(txt, BAND_FONT) <= w ? txt : '';
  };
  return html`<div class="rs-chart" style=${{ height: g.height + 'px', width: W + 'px' }}>
    <svg ref=${svgRef} class="rs-svg" width=${W} height=${g.height} viewBox=${`0 0 ${W} ${g.height}`} role="group" aria-label=${t('refs.st.aria', { n, arcs: model.arcs.length })}
      onMouseMove=${onMove} onMouseLeave=${() => setTip(null)} onClick=${onClick} onKeyDown=${card ? undefined : onKey} data-colw=${colW.toFixed(2)}><g transform=${`translate(${P},0)`}>
      ${sel != null ? html`<rect class="rs-selcol" x=${sel * colW} y="0" width=${Math.max(colW, 2)} height=${g.height} />` : null}
      <line class="rs-axis" x1="0" x2=${W - 2 * P} y1=${g.yAxis} y2=${g.yAxis} />
      <g class="rs-arcs">${arcsDraw.map((a) => html`<path class=${arcCls(a)} d=${arcPath(cx(a.a), cx(a.b), g.yAxis, ST.maxArc)} style=${{ strokeWidth: arcStroke(a.n).toFixed(2) + 'px' }} data-a=${a.a} data-b=${a.b} />`)}</g>
      ${card ? null : html`<g class="rs-arc-hits">${model.arcs.map((a) => html`<path class="rs-arc-hit" data-arc=${a.a + '|' + a.b} d=${arcPath(cx(a.a), cx(a.b), g.yAxis, ST.maxArc)} onMouseMove=${arcTip(a)} onMouseLeave=${() => setTip(null)} />`)}</g>`}
      ${th.show.map((i) => html`<line class="rs-tick" x1=${cx(i)} x2=${cx(i)} y1=${g.yAxis - 3} y2=${g.yAxis + 3} />`)}
      ${sel != null ? html`<circle class="rs-selpt" cx=${cx(sel)} cy=${g.yAxis} r="4" />` : null}
      <g class="rs-labels">${th.show.map((i) => th.rotate
        ? html`<text class=${'rs-lab' + (i === sel ? ' is-sel' : '')} x=${lx(i)} y=${g.yLab} transform=${`rotate(-90 ${lx(i).toFixed(1)} ${g.yLab})`} text-anchor="end" dominant-baseline="central">${labels[i]}</text>`
        : html`<text class=${'rs-lab' + (i === sel ? ' is-sel' : '')} x=${cx(i)} y=${g.yLab + 11} text-anchor="middle">${labels[i]}</text>`)}</g>
      <g class="rs-bands">${model.bands.map((b, j) => html`<g><rect class=${'rs-band' + (j % 2 ? ' is-alt' : '')} x=${b.from * colW} y=${g.yBand} width=${(b.to - b.from + 1) * colW} height=${ST.band} />
        <text class="rs-band-t" x=${b.from * colW + 4} y=${g.yBand + 16}>${bandFit(b)}</text></g>`)}</g>
      <g class="rs-rows">${model.rows.map((row, ri) => html`<g data-row=${row.group}>
        <rect class="rs-rowbg" x="0" y=${g.rowsY[ri]} width=${W - 2 * P} height=${ST.row} />
        ${[...row.cells].map(([i, v]) => html`<rect class=${'rs-cell rs-c' + cellLevel(v)} x=${i * colW + (colW > 5 ? 1 : 0.5)} y=${g.rowsY[ri] + 2} width=${Math.max(1.5, colW - (colW > 5 ? 2 : 1))} height=${ST.row - 4} data-col=${i} data-n=${v} aria-label=${`${unitCite(data, model.columns[i].unit)} → ${groupName(ctx, row.group)}: ${t('refs.nFund', { n: v })}`} />`)}
      </g>`)}</g>
      ${card ? null : html`<g class="rs-cols">${model.columns.map((c, i) => html`<rect class=${'rs-col' + (i === sel ? ' is-sel' : '')} data-col=${i} x=${i * colW} y=${g.yAxis - 6} width=${colW} height=${g.yBand + ST.band - g.yAxis + 6}
        tabindex=${i === focusIdx ? '0' : '-1'} role="button" aria-pressed=${i === sel ? 'true' : 'false'} aria-label=${colAria(i)}
        onFocus=${(e) => { setFocusIdx(i); let kb = true; try { kb = e.currentTarget.matches(':focus-visible'); } catch { kb = true; } if (kb) setTip({ x: cx(i), y: g.yLab, lines: [colAria(i)] }); }} onBlur=${() => setTip(null)} />`)}</g>`}
    </g></svg>
    ${tip ? html`<div class="rs-tip" role="tooltip" style=${{ left: (tip.x + P + 14 + 280 <= W ? tip.x + P + 14 : Math.max(0, tip.x + P - 14 - 280)) + 'px', bottom: (g.height - Math.min(tip.y, g.yAxis) + 10) + 'px' }}>${tip.lines.map((l, i) => html`<p class=${i ? '' : 'rs-tip-h'}>${l}</p>`)}</div>` : null}
  </div>`;
}

/** Beschriftung der Zeilen (bleibt beim Scrollen stehen). */
export function RowLabels({ ctx, model, g }) {
  return html`<div class="rs-rowlabels" style=${{ height: g.height + 'px' }} aria-hidden="true">
    <span class="rs-rl rs-rl-arcs" style=${{ top: Math.max(0, g.yAxis - 34) + 'px' }}>${t('refs.st.arcs')}</span>
    <span class="rs-rl" style=${{ top: (g.yBand + 4) + 'px' }}>${t('refs.st.band')}</span>
    ${model.rows.map((r, i) => html`<span class="rs-rl" style=${{ top: g.rowsY[i] + 'px' }} title=${groupName(ctx, r.group)}>${groupName(ctx, r.group)}</span>`)}
  </div>`;
}

// ------------------------------------------------------------ Leiste zur gewählten Einheit
function StructBar({ data, ctx, model, unit, lang, stageId, onNet }) {
  if (!unit) {
    return html`<aside class="rs-bar is-empty" aria-label=${t('refs.st.barLabel')}>
      <p class="rs-bar-hint">${t('refs.st.pickHint')}</p>
      <p class="rs-bar-sum">${t('refs.st.sum', { refs: model.totals.refs, arcs: model.totals.arcs })}${model.totals.uncertain ? ' ' + t('refs.st.sumUnc', { n: model.totals.uncertain }) : ''}</p>
    </aside>`;
  }
  const s = model.units.get(unit) || { inRefs: 0, inUnits: 0, outRefs: 0, outNodes: 0 };
  const g = egoGraph(ctx, unit, null, null);
  const top = strongest(g, 3);
  const ti = data.unitTitle(unit, lang, stageId);
  return html`<aside class="rs-bar" aria-label=${t('refs.st.barLabel')} aria-live="polite" data-unit=${unit}>
    <div class="rs-bar-a">
      <h3 class="rs-bar-t">${unitCite(data, unit, true)}</h3>
      ${ti.text ? html`<p class="rs-bar-st"><${TitleText} ti=${ti} lang=${lang} /></p>` : null}
    </div>
    <dl class="rs-kpi">
      <div class="rs-kpi-i" id="rs-kpi-in" data-refs=${s.inRefs} data-n=${s.inUnits}><dt>${t('refs.in')}</dt><dd class="rs-kpi-v">${sideText('in', s)}</dd></div>
      <div class="rs-kpi-i" id="rs-kpi-out" data-refs=${s.outRefs} data-n=${s.outNodes}><dt>${t('refs.out')}</dt><dd class="rs-kpi-v">${sideText('out', s)}</dd></div>
    </dl>
    ${top.length ? html`<div class="rs-top"><h4 class="rs-top-h">${t('refs.st.strongest')}</h4><ol class="rs-top-l">${top.map((e) => {
      const lab = nodeLabel(ctx, e, { withAbbr: e.kind === 'lib', lang });
      const link = nodeLink(ctx, e, e.dir === 'in' ? 'left' : 'right');
      return html`<li><span class="rs-dir" title=${e.dir === 'in' ? t('refs.in') : t('refs.out')}>${e.dir === 'in' ? '←' : '→'}</span><span class="sr">${e.dir === 'in' ? t('refs.in') : t('refs.out')}: </span>${link ? (link.url ? html`<a class="ext" href=${link.url} target="_blank" rel="noopener noreferrer" lang=${lab.lang}>${lab.text}</a>` : html`<a href=${link.href} lang=${lab.lang} onClick=${onInternal(link)}>${lab.text}</a>`) : html`<span lang=${lab.lang}>${lab.text}</span>`} <span class="muted">${t('refs.nFund', { n: e.n })}</span></li>`;
    })}</ol></div>` : html`<p class="muted rs-top">${t('refs.none')}</p>`}
    <div class="rs-bar-act">
      <button type="button" class="btn btn-primary btn-sm" id="rs-read" onClick=${() => go({ view: 'lesen', u: unit, k: null, s: null, m: 'stand' })}><${Icon} name="book" />${t('refs.st.read')}</button>
      <button type="button" class="btn btn-tertiary btn-sm" id="rs-chron" onClick=${() => go({ view: 'chronik', u: unit, k: '*' })}><${Icon} name="clock" />${t('refs.st.chron')}</button>
      <button type="button" class="btn btn-tertiary btn-sm" id="rs-net" onClick=${onNet}><${Icon} name="share" />${t('refs.st.net')}</button>
    </div>
  </aside>`;
}

// ------------------------------------------------------------ Tabelle (Textfassung)
function StructTable({ data, ctx, model, lang, stageId }) {
  const [all, setAll] = useState(() => refsSetting('refsTableAll', false));
  const libCols = model.rows.filter((r) => r.group.startsWith('lib:'));
  const units = model.columns.map((c) => c.unit).filter((u) => all || ((model.units.get(u) || {}).refs > 0));
  const num = (v) => (v ? fmtNum(v) : html`<span class="muted" aria-label="0">–</span>`);
  return html`<div>
    <p class="rs-tools2"><label class="check"><input type="checkbox" id="rs-all" checked=${all} onChange=${(e) => { setAll(e.target.checked); setRefsSetting('refsTableAll', e.target.checked); }} />${t('refs.st.showAll', { n: model.columns.length })}</label></p>
    <div class="tbl-scroll"><table class="tbl-data rs-table" aria-label=${t('refs.st.title')}>
      <thead><tr><th scope="col">${t('common.unit')}</th><th scope="col" class="num">${t('refs.st.colOutSelf')}</th><th scope="col" class="num">${t('refs.in')}</th>
        ${libCols.map((r) => html`<th scope="col" class="num">${groupName(ctx, r.group)}</th>`)}<th scope="col" class="num">${t('refs.st.colSr')}</th><th scope="col" class="num">${t('refs.st.colEu')}</th></tr></thead>
      <tbody>${units.map((u) => {
        const s = model.units.get(u) || { outSelf: 0, inRefs: 0, outLib: {}, outSr: 0, outEu: 0 };
        const ti = data.unitTitle(u, lang, stageId);
        return html`<tr data-unit=${u}><th scope="row"><a href=${`#/lesen?w=${data.id}&u=${u}`} onClick=${(e) => { e.preventDefault(); go({ view: 'lesen', u, k: null, s: null, m: 'stand' }); }}>${unitCite(data, u)}</a> <${TitleText} ti=${ti} lang=${lang} className="rs-t" /></th>
          <td class="num" data-k="outSelf">${num(s.outSelf)}</td><td class="num" data-k="in">${num(s.inRefs)}</td>
          ${libCols.map((r) => html`<td class="num" data-k=${r.group}>${num((s.outLib || {})[r.work] || 0)}</td>`)}
          <td class="num" data-k="sr">${num(s.outSr)}</td><td class="num" data-k="eu">${num(s.outEu)}</td></tr>`;
      })}</tbody>
    </table></div>
    ${units.length === 0 ? html`<p class="muted">${t('refs.none')}</p>` : null}
  </div>`;
}

/** Legende: Bögen (ausgehend, eingehend, übrige) und Deckkraftstufen der Zellen. */
export function StructLegend() {
  const arc = (cls) => html`<svg class="rn-ico" width="28" height="16" viewBox="0 0 28 16" aria-hidden="true"><path class=${cls} d="M2,14 A12,10 0 0 1 26,14" /></svg>`;
  return html`<p class="legend-line rs-lg">
    <span class="lg">${arc('rs-arc is-out')}${t('refs.st.lgOut')}</span>
    <span class="lg">${arc('rs-arc is-in')}${t('refs.st.lgIn')}</span>
    <span class="lg">${arc('rs-arc')}${t('refs.st.lgRest')}</span>
    <span class="lg">${[1, 2, 3, 4].map((lv) => html`<svg class="rn-ico" width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect class=${'rs-cell rs-c' + lv} x="1" y="1" width="10" height="12" /></svg>`)}${t('refs.st.lgCells')}</span>
  </p>`;
}

// ------------------------------------------------------------ Abschnitt
const PLACEHOLDER_H = 520;

export function RefStructSection({ data, route }) {
  const stageId = data.current.id;
  const lang = data.langs.includes(route.l) ? route.l : data.langs[0];
  const holder = useRef();
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return undefined;
    const el = holder.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const st = useRefsCtx(data, lang, stageId, near);
  const [view, setView] = useState(() => refsSetting('refsStructView', 'chart'));
  const [sel, setSel] = useState(null);
  const [dlg, setDlg] = useState(false);
  const [busy, setBusy] = useState(false);
  const columns = useMemo(() => structColumns(data, lang, stageId), [data, lang, stageId]);
  const model = useMemo(() => {
    if (st.status !== 'ready') return null;
    return data.memo(`rsm|${lang}|${stageId}|${st.key}|${st.ctx.index.refs.length}`, () => {
      const t0 = performance.now();
      const m = structureModel(st.ctx, columns);
      const ms = Math.round(performance.now() - t0);
      if (window.__srRefsTimings) window.__srRefsTimings.push({ work: data.id, lang, stage: stageId, ms, what: 'structure' });
      return m;
    });
  }, [st, columns]);
  useEffect(() => { setSel(null); }, [data, lang]);
  const scrollRef = useRef();
  const avail = useWidth(scrollRef);
  const bodyW = useWidth(holder);
  // Leiste neben dem Diagramm nur, wenn die Spalten daneben noch mindestens 4 px breit sind; sonst darunter
  const beside = !!model && bodyW > 0 && (bodyW - 320 - 24 - 178) / Math.max(1, model.columns.length) >= ST.minCol;
  useFontsReady();
  const selUnit = model && sel != null ? model.columns[sel] && model.columns[sel].unit : null;
  const pickView = (v) => { setView(v); setRefsSetting('refsStructView', v); };
  const exportPng = async () => {
    if (busy || !model) return;
    setBusy(true);
    try {
      const ex = await import('../../export.js');
      await ex.exportPng(data, { kind: 'refstruct', unit: null, key: null, lang, stage: stageId, ctx: st.ctx, model, w: data.id, format: 'a4', ui: uiLang() });
      toast(t('export.done', { kind: 'PNG' }), 'success', 3000);
    } catch (e) { console.error(e); toast(t('export.failed', { msg: e.message || String(e) }), 'error'); }
    finally { setBusy(false); }
  };
  const langOpts = data.langs.map((l) => ({ value: l, label: l.toUpperCase(), title: t('lang.name.' + l), aria: t('lang.name.' + l) }));
  const g = model ? chartLayout(data, model, avail).g : null;
  return html`<section class="ov-sec rs-sec" aria-labelledby="rs-h" id="rs-sec">
    <div class="sec-head"><h2 id="rs-h">${t('refs.st.title')}</h2>
      <p class="sec-note">${t('refs.st.note', { date: fmtDate(data.stageDate(stageId)) })}</p>
      <${HelpLink} sec="verweisstruktur" />
    </div>
    <div class="toolbar rs-toolbar">
      <div class="tool-group"><span class="tool-label" id="lbl-rs-lang">${t('lang.legal')}</span><${Seg} labelledby="lbl-rs-lang" value=${lang} onChange=${(l) => go({ l }, { replace: true })} options=${langOpts} /></div>
      <div class="tool-group"><span class="tool-label" id="lbl-rs-view">${t('refs.view')}</span><${Seg} labelledby="lbl-rs-view" value=${view} onChange=${pickView} options=${[{ value: 'chart', label: t('refs.st.chart') }, { value: 'table', label: t('refs.st.table') }]} /></div>
      <span class="spacer"></span>
      <button type="button" class="btn btn-tertiary" id="rs-png" disabled=${!model} aria-disabled=${busy ? 'true' : undefined} onClick=${exportPng}><${Icon} name="download" />${busy ? t('export.busy') : t('refs.exportPng')}</button>
    </div>
    <div class="rs-body" ref=${holder} style=${model ? undefined : { minHeight: PLACEHOLDER_H + 'px' }}>
      ${st.status === 'none' ? html`<${Notice} kind="info">${t('refs.noIndex')}</${Notice}>`
        : st.status === 'error' ? html`<${Notice} kind="error">${t('refs.error')}</${Notice}>`
        : !model ? html`<div class="rs-placeholder" style=${{ height: PLACEHOLDER_H + 'px' }} role="status"><p class="muted">${near ? t('refs.loading') : t('refs.st.later')}</p></div>`
        : view === 'table' ? html`<${StructTable} data=${data} ctx=${st.ctx} model=${model} lang=${lang} stageId=${stageId} />`
        : html`<div class=${'rs-grid ' + (beside ? 'is-beside' : 'is-below')}>
          <div class="rs-main">
            <div class="rs-frame">
              <${RowLabels} ctx=${st.ctx} model=${model} g=${g} />
              <div class="rs-scroll" ref=${scrollRef} tabindex="0" role="region" aria-label=${t('refs.st.scrollAria')}>
                ${avail ? html`<${StructChart} data=${data} ctx=${st.ctx} model=${model} lang=${lang} stageId=${stageId} sel=${sel} onSelect=${setSel} avail=${avail} />` : null}
              </div>
            </div>
            <div class="rs-legend"><${StructLegend} /></div>
          </div>
          <${StructBar} data=${data} ctx=${st.ctx} model=${model} unit=${selUnit} lang=${lang} stageId=${stageId} onNet=${() => setDlg(true)} />
        </div>`}
    </div>
    ${dlg && selUnit && st.status === 'ready' ? html`<${RefsDialog} data=${data} ctx=${st.ctx} unitId=${selUnit} k=${null} stageId=${stageId} lang=${lang} onClose=${() => setDlg(false)} />` : null}
  </section>`;
}
