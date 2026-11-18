// Übersicht je Erlass: Kennzahlen, Zeitstrahl aller Fassungen, ändernde Erlasse, Änderungsmatrix, hängige Vorhaben.
import { html } from 'htm/preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { go } from '../../state.js';
import { HelpLink, LegalLangSwitch, Icon, TitleText, ExtLink, OriginSwatch } from '../../ui/common.js';
import { fmtDate, fmtNum, plain } from '../../lib/format.js';
import { cite } from '../../lib/cite.js';
import { pickLang, langOf } from '../../data.js';
import { t, uiLang, has } from '../../lib/i18n.js';
import { legalLang, capFirst } from './read.js';
import { RefStructSection } from './refstructure.js';

// Status der Vernehmlassung: Zahl aus dem Fedlex-Vokabular (0 bis 6) oder Text der Kernbibliothek; abgeschlossen sind 5 und 6.
const CLOSED = /^(5|6|closed|completed|done|withdrawn|abgeschlossen|zurückgezogen)$/i;
export const isOpenPending = (p) => !CLOSED.test(String(p.status ?? ''));
const pendLabel = (p) => (p.statusLabel ? pickLang(p.statusLabel) : has('ov.pend.status.' + p.status) ? t('ov.pend.status.' + p.status) : String(p.status || ''));

function Figures({ data, lang }) {
  const nUnits = data.unitOrder.length;
  const changed = data.unitOrder.filter((id) => data.unitChanged(id, lang)).length;
  const amend = data.actList.filter((a) => a.kind !== 'base');
  const future = amend.filter((a) => data.isFutureAct(a.id)).length;
  const open = data.pending.filter(isOpenPending).length;
  const fig = (v, l, sub, id) => html`<div class="fig-item" id=${id}><div class="fig-v">${fmtNum(v)}</div><div class="fig-l">${l}</div>${sub ? html`<div class="fig-s">${sub}</div>` : null}</div>`;
  return html`<div class="figs">
    ${fig(data.timeline.length, t('ov.fig.versions', { n: data.timeline.length }), t('ov.fig.versionsSub', { n: data.stages.length, date: fmtDate(data.first.date) }), 'fig-versions')}
    ${fig(changed, t('ov.fig.changedUnits', { n: changed }), t('ov.fig.changedUnitsSub', { n: nUnits, date: fmtDate(data.first.date) }), 'fig-units')}
    ${fig(amend.length, t('ov.fig.acts', { n: amend.length }), future ? t('ov.fig.actsFuture', { n: future }) : t('ov.fig.actsAllInForce'), 'fig-acts')}
    ${fig(open, t('ov.fig.pending', { n: open }), t('ov.fig.pendingSub', { n: data.pending.length }), 'fig-pending')}
  </div>`;
}

const toNum = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Number(m[1]) + (Number(m[2]) - 1) / 12 + (Number(m[3]) - 1) / 365 : null; };

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

let measureCtx = null;
function textWidth(s, font) {
  try {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = font;
    return Math.ceil(measureCtx.measureText(s).width);
  } catch { return s.length * 7; }
}

/** Achse: Jahreszahlen und «heute» ohne Überlappung und ohne Überstand an den Rändern. */
export function axisLabels(w, t0, t1, now, todayLabel, measure) {
  const GAP = 8;
  const px = (v) => ((v - t0) / (t1 - t0)) * w;
  const box = (x, width) => { let l = x - width / 2; l = Math.max(0, Math.min(w - width, l)); return { l, r: l + width }; };
  const out = [];
  const tb = box(px(now), measure(todayLabel, true));
  out.push({ text: todayLabel, today: true, ...tb });
  const span = t1 - t0;
  const step = span > 24 ? 4 : span > 12 ? 2 : 1;
  for (let y = Math.ceil(t0); y <= t1; y++) {
    if ((y - Math.ceil(t0)) % step) continue;
    const b = box(px(y), measure(String(y), false));
    if (out.some((o) => b.l < o.r + GAP && b.r > o.l - GAP)) continue;
    out.push({ text: String(y), ...b });
  }
  return out;
}

function Axis({ t0, t1, now }) {
  const ref = useRef();
  const w = useWidth(ref);
  const [, setFontsReady] = useState(false);
  useEffect(() => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setFontsReady(true)); }, []);
  const labels = w ? axisLabels(w, t0, t1, now, t('ov.tl.today'), (s, bold) => textWidth(s, `${bold ? 600 : 400} 12px "IBM Plex Sans"`) + 2) : [];
  return html`<div class="vt-axis" ref=${ref} aria-hidden="true">
    ${labels.map((o) => html`<span class=${o.today ? 'vt-today' : 'vt-year'} style=${{ left: `${o.l}px` }}>${o.text}</span>`)}
  </div>`;
}

function VersionTimeline({ data, lang }) {
  const tl = data.timeline;
  const [all, setAll] = useState(false);
  if (!tl.length) return null;
  const now = toNum(data.today);
  const t0 = Math.floor(toNum(tl[0].date));
  const lastDate = tl[tl.length - 1].date;
  const t1 = Math.max(Math.ceil(Math.max(now, toNum(lastDate)) + 0.5), t0 + 2);
  const x = (v) => ((Math.min(Math.max(v, t0), t1) - t0) / (t1 - t0)) * 100;
  const years = [];
  for (let y = t0; y <= t1; y++) years.push(y);
  const segs = tl.map((v, i) => {
    const s = toNum(v.date);
    const e = i < tl.length - 1 ? toNum(tl[i + 1].date) : v.end ? toNum(v.end) : t1;
    const kind = v.date > data.today ? 'future' : v.stage ? 'xml' : 'pdf';
    return { v, s, e, kind };
  });
  const rows = [...tl].reverse();
  const shown = all ? rows : rows.slice(0, 10);
  return html`<section class="ov-sec" aria-labelledby="tl-h">
    <div class="sec-head"><h2 id="tl-h">${t('ov.tl.title')}</h2>
      <p class="sec-note">${t('ov.tl.note', { n: tl.length, x: data.stages.length })}</p>
      <${HelpLink} sec="uebersicht" />
    </div>
    <div class="vt" role="img" aria-label=${t('ov.tl.aria', { n: tl.length, x: data.stages.length, first: fmtDate(data.first.date) })}>
      <${Axis} t0=${t0} t1=${t1} now=${now} />
      <div class="vt-track">
        ${years.map((y) => html`<span class="vt-grid" style=${{ left: x(y) + '%' }}></span>`)}
        ${segs.map((g) => html`<span class=${'vt-seg vt-' + g.kind} style=${{ left: x(g.s) + '%', width: `max(2px, ${x(g.e) - x(g.s)}%)` }} title=${`${t('stage.label', { date: fmtDate(g.v.date) })}: ${t('ov.tl.kind.' + g.kind)}`}></span>`)}
        <span class="vt-now" style=${{ left: x(now) + '%' }}></span>
      </div>
    </div>
    <p class="legend-line">
      <span class="lg"><span class="vt-lg vt-xml"></span>${t('ov.tl.kind.xml')}</span>
      <span class="lg"><span class="vt-lg vt-pdf"></span>${t('ov.tl.kind.pdf')}</span>
      <span class="lg"><span class="vt-lg vt-future"></span>${t('ov.tl.kind.future')}</span>
      <span class="lg"><span class="vt-lg-now"></span>${t('ov.tl.today')} (${fmtDate(data.today)})</span>
    </p>
    <div class="tbl-scroll"><table class="tbl-data vt-table" aria-label=${t('ov.tl.tableLabel')}>
      <thead><tr><th scope="col">${t('ov.tl.colFrom')}</th><th scope="col">${t('ov.tl.colTo')}</th><th scope="col">${t('ov.tl.colText')}</th><th scope="col">${t('ov.tl.colActs')}</th><th scope="col">${t('ov.tl.colOpen')}</th></tr></thead>
      <tbody>${shown.map((v) => {
        const st = data.timelineStatus(v);
        const pdf = v.pdf ? v.pdf[lang] || v.pdf.de : null;
        return html`<tr class=${v.stage ? 'has-xml' : 'is-pdf'}>
          <td class="nw"><b>${fmtDate(v.date)}</b>${st === 'current' ? html` <span class="tag stag stag-current">${t('status.current')}</span>` : st === 'future' ? html` <span class="tag stag stag-future">${t('status.future')}</span>` : null}</td>
          <td class="nw">${v.end ? fmtDate(v.end) : ''}</td>
          <td>${v.stage ? t('ov.tl.withText') : t('ov.tl.pdfOnly')}</td>
          <td class="small">${v.acts && v.acts.length ? v.acts.slice(0, 4).map((a, i) => html`${i ? ', ' : ''}<${ExtLink} href=${data.actUrl(a)}>${data.actCode(a)}</${ExtLink}>`) : '–'}${v.acts && v.acts.length > 4 ? ' ' + t('ov.tl.more', { n: v.acts.length - 4 }) : ''}</td>
          <td class="nw">${v.stage ? html`<button type="button" class="btn btn-quiet btn-sm" onClick=${() => go({ view: 'lesen', s: v.stage, m: 'stand' })}><${Icon} name="book" />${t('ov.tl.read')}</button>` : null}
            ${pdf ? html` <${ExtLink} href=${pdf}>PDF</${ExtLink}>` : null}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    ${rows.length > 10 ? html`<p><button type="button" class="btn btn-quiet btn-sm" aria-expanded=${all ? 'true' : 'false'} onClick=${() => setAll(!all)}><${Icon} name=${all ? 'chevron-up' : 'chevron-down'} />${all ? t('common.showLess') : t('common.showAll', { n: rows.length })}</button></p>` : null}
  </section>`;
}

function ActsList({ data }) {
  const [all, setAll] = useState(false);
  const acts = data.actList.filter((a) => a.kind !== 'base').map((a) => {
    const units = new Set((a.changes || []).map((c) => c.unit).filter((u) => data.unit(u)));
    const stages = [...new Set((a.changes || []).map((c) => c.stage).filter(Boolean))];
    const stageOf = stages.length ? stages.sort().pop() : data.stages.find((s) => (s.acts || []).includes(a.id));
    return { a, units, stage: typeof stageOf === 'string' ? stageOf : stageOf ? stageOf.id : null, inForce: (a.inForce || [])[0] || '' };
  }).sort((x, y) => (y.inForce || '').localeCompare(x.inForce || '') || y.a.id.localeCompare(x.a.id));
  const shown = all ? acts : acts.slice(0, 12);
  const firstUnit = (row) => data.unitOrder.find((u) => row.units.has(u)) || data.unitOrder.find((u) => data.unitActs(u).includes(row.a.id));
  return html`<section class="ov-sec" aria-labelledby="ac-h">
    <div class="sec-head"><h2 id="ac-h">${t('ov.acts.title')}</h2><p class="sec-note">${t('ov.acts.note')}</p></div>
    <div class="tbl-scroll"><table class="tbl-data acts-table">
      <thead><tr><th scope="col">${t('ov.acts.colAs')}</th><th scope="col">${t('ov.acts.colName')}</th><th scope="col">${t('ov.acts.colInForce')}</th><th scope="col">${t('ov.acts.colStage')}</th><th scope="col">${t('ov.acts.colUnits')}</th></tr></thead>
      <tbody>${shown.map((row) => {
        const { a } = row;
        const fut = data.isFutureAct(a.id);
        const fu = firstUnit(row);
        return html`<tr class=${fut ? 'is-pending' : ''}>
          <td class="nw"><span class="ochip-inline"><${OriginSwatch} kind=${fut ? 'future' : 'amended'} /><${ExtLink} href=${data.actUrl(a.id)}>${data.actCode(a.id)}</${ExtLink}></span></td>
          <td>${pickLang(a.label) || pickLang(a.title) ? html`<span lang=${langOf(pickLang(a.label) ? a.label : a.title)}>${plain(pickLang(a.label) || pickLang(a.title))}</span>` : html`<span class="muted">${t('ov.acts.noLabel')}</span>`}${a.kind === 'corrigendum' ? html` <span class="tag tag-src">${t('kind.corrigendum')}</span>` : null}</td>
          <td class="nw">${(a.inForce || []).map((d, i) => html`${i ? html`<br />` : ''}${fmtDate(d)}`)}${fut ? html`<br /><span class="tag stag stag-future">${t('status.futureShort')}</span>` : null}</td>
          <td class="nw">${row.stage && data.stage(row.stage) ? html`<button type="button" class="btn btn-quiet btn-sm" onClick=${() => go({ view: 'lesen', s: row.stage, m: 'stand', act: a.id, u: fu || null, k: null })}>${fmtDate(data.stageDate(row.stage))}</button>` : html`<span class="muted">${(a.inForce || [])[0] && a.inForce[0] < data.first.date ? t('ov.acts.beforeXml') : t('ov.acts.noStage')}</span>`}</td>
          <td class="nw">${row.units.size ? html`<button type="button" class="btn btn-quiet btn-sm" title=${t('ov.acts.showTip')} onClick=${() => go({ view: 'lesen', act: a.id, u: fu || null, k: null, ch: '0', q: null })}><${Icon} name="filter" />${t('ov.acts.units', { n: row.units.size })}</button>` : '–'}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    ${acts.length > 12 ? html`<p><button type="button" class="btn btn-quiet btn-sm" aria-expanded=${all ? 'true' : 'false'} onClick=${() => setAll(!all)}><${Icon} name=${all ? 'chevron-up' : 'chevron-down'} />${all ? t('common.showLess') : t('common.showAll', { n: acts.length })}</button></p>` : null}
  </section>`;
}

function Matrix({ data, lang, route }) {
  const [all, setAll] = useState(false);
  const cols = data.stages.slice(1);
  const grid = useMemo(() => {
    const m = new Map();
    for (const s of cols) {
      for (const c of data.changes(s.id, lang)) {
        if (!m.has(c.unit)) m.set(c.unit, new Map());
        const row = m.get(c.unit);
        const cell = row.get(s.id) || { ins: 0, rep: 0, del: 0, unit: null };
        if (!c.key) cell.unit = c.change;
        else if (c.change === 'inserted') cell.ins++;
        else if (c.change === 'deleted') cell.del++;
        else cell.rep++;
        row.set(s.id, cell);
      }
    }
    return m;
  }, [data, lang]);
  const units = data.unitOrder.filter((id) => all || grid.has(id));
  const open = (u, s) => go({ view: 'vergleich', u, k: null, a: data.prevStage(s).id, b: s, cm: 'stand', sc: 'changed' });
  return html`<section class="ov-sec" aria-labelledby="mx-h">
    <div class="sec-head"><h2 id="mx-h">${t('ov.mx.title')}</h2>
      <p class="sec-note">${t('ov.mx.note')}</p>
      <label class="check"><input type="checkbox" checked=${all} onChange=${(e) => setAll(e.target.checked)} />${t('ov.mx.showAll')}</label>
      <${LegalLangSwitch} data=${data} route=${route} />
    </div>
    ${units.length === 0 ? html`<p class="muted">${t('ov.mx.none')}</p>` : html`
    <div class="mx-wrap" tabindex="0" role="region" aria-label=${t('ov.mx.title')}>
      <table class="mx">
        <thead><tr><th class="mx-u" scope="col">${t('common.unit')}</th>${cols.map((s) => html`<th scope="col" class=${'mx-h' + (data.isFuture(s.id) ? ' is-pending' : '') + (s.id === data.current.id ? ' is-today' : '')} title=${data.stageLabel(s.id) + (data.isFuture(s.id) ? ', ' + t('status.future') : s.id === data.current.id ? ', ' + t('status.current') : '') + (s.gap ? ', ' + t('read.stagebar.gap', { n: s.gap }) : '')}>
          <span class="mx-date">${fmtDate(s.date)}</span></th>`)}</tr></thead>
        <tbody>${units.map((u) => {
          const row = grid.get(u) || new Map();
          const meta = data.unitMeta(u, uiLang());
          const ti = data.unitTitle(u, lang, data.current.id);
          return html`<tr>
            <th scope="row" class="mx-u"><button type="button" class="link" onClick=${() => go({ view: 'lesen', u, k: null })}>${meta.type === 'final' ? t('read.toc.final') : capFirst(cite(meta, null, uiLang(), null))}</button> ${ti.repealed ? html`<span class="mx-t">${t('read.toc.repealed')}</span>` : html`<${TitleText} ti=${ti} lang=${lang} className="mx-t" />`}</th>
            ${cols.map((s) => {
              const c = row.get(s.id);
              if (!c) return html`<td class="mx-empty"></td>`;
              const sym = c.unit === 'inserted' ? '+' : c.unit === 'repealed' || c.unit === 'deleted' ? '−' : c.del && !c.ins && !c.rep ? '−' : c.ins && !c.rep && !c.del ? '+' : '±';
              const n = c.ins + c.rep + c.del;
              const what = c.unit === 'inserted' ? t('ov.mx.unitInserted') : c.unit === 'repealed' || c.unit === 'deleted' ? t('ov.mx.unitRepealed') : t('ov.mx.counts', { rep: c.rep, ins: c.ins, del: c.del });
              const label2 = `${cite(meta, null, uiLang(), data.abbr(uiLang()))}, ${data.stageLabel(s.id)}: ${what}. ${t('ov.mx.clickTip')}`;
              return html`<td class=${'mx-cell' + (data.isFuture(s.id) ? ' is-pending' : '')}>
                <button type="button" title=${label2} aria-label=${label2} onClick=${() => open(u, s.id)}><span class="mx-sym">${sym}</span>${n > 1 ? html`<span class="mx-n">${n}</span>` : null}</button></td>`;
            })}
          </tr>`;
        })}</tbody>
      </table>
    </div>`}
    <p class="legend-line"><span class="lg"><b class="mx-sym">+</b> ${t('ov.mx.lgIns')}</span><span class="lg"><b class="mx-sym">±</b> ${t('ov.mx.lgRep')}</span><span class="lg"><b class="mx-sym">−</b> ${t('ov.mx.lgDel')}</span><span class="lg">${t('ov.mx.lgNum')}</span><span class="lg"><span class="vt-lg vt-future"></span>${t('legend.future')}</span></p>
  </section>`;
}

function Pending({ data }) {
  const l = uiLang();
  const open = data.pending.filter(isOpenPending);
  const closed = data.pending.filter((p) => !isOpenPending(p));
  const item = (p) => {
    const tl = p.title && (p.title[l] ? l : langOf(p.title, l));
    return html`<li class="pend-item">
      <span class="pend-title" lang=${tl}>${plain(pickLang(p.title, l)) || p.id}</span>
      <span class="pend-meta">${p.status != null ? html`<span class="tag tag-src">${pendLabel(p)}</span>` : null}${p.date ? html` <span>${fmtDate(p.date)}</span>` : null}
        <${ExtLink} href=${p.url}>${t('ov.pend.open')}</${ExtLink}></span>
    </li>`;
  };
  return html`<section class="ov-sec" aria-labelledby="pd-h">
    <div class="sec-head"><h2 id="pd-h">${t('ov.pend.title')}</h2><p class="sec-note">${t('ov.pend.note')}</p></div>
    ${open.length ? html`<ul class="pend-list">${open.map(item)}</ul>` : html`<p class="muted">${t('ov.pend.none')}</p>`}
    ${closed.length ? html`<details class="pend-closed"><summary>${t('ov.pend.closed', { n: closed.length })}</summary><ul class="pend-list">${closed.map(item)}</ul></details>` : null}
  </section>`;
}

export function Overview({ data, route }) {
  const l = uiLang();
  const lang = legalLang(data, route);
  return html`<div class="view view-overview">
    <div class="ov-inner">
      <div class="ov-head">
        <h1>${data.abbr(l)} <span class="ov-abbr">${data.srLabel(l)}</span></h1>
        <p class="ov-lead" lang=${data.titleLang(l)}>${data.title(l)}</p>
        <p class="ov-meta">${t('ov.fetched', { date: fmtDate(data.ds.fetched) })} | ${t('lib.source.' + data.source)} | <a href="#/info" onClick=${(e) => { e.preventDefault(); go({ view: 'info' }); }}>${t('ov.methodLink')}</a> | <${ExtLink} href=${data.work.eli}>${t('ov.onFedlex')}</${ExtLink}></p>
      </div>
      <${Figures} data=${data} lang=${lang} />
      <${VersionTimeline} data=${data} lang=${lang} />
      <${RefStructSection} data=${data} route=${route} />
      <${ActsList} data=${data} />
      <${Matrix} data=${data} lang=${lang} route=${route} />
      <${Pending} data=${data} />
    </div>
  </div>`;
}
