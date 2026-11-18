// Exportkarte: Titel in Zitierweise, Inhalt (Chronologie oder Vergleich), Legende, Quellenzeile mit Verbindlichkeitshinweis.
// Sprache der Karte = Oberflächensprache bei der Erstellung (spec.ui); export.js rendert sie mit withUiLang.
import { html } from 'htm/preact';
import { cite } from '../lib/cite.js';
import { fmtDate, todayIso, LANG_CODES, plain } from '../lib/format.js';
import { t, uiLang } from '../lib/i18n.js';
import { blockSteps, unitSteps, actMetaLine, unitStepLabel } from './chronology.js';
import { compareRows, CompareTable, compareStats } from './compare.js';
import { changeLabel } from '../data.js';
import { BlockBody, Lbl } from './blocks.js';
import { RefsCard, refsCardTitle, refsCardSubtitle, refsCardWidth } from './refscard.js';

const isRefs = (spec) => spec && (spec.kind === 'refnet' || spec.kind === 'refstruct');

export const FORMATS = {
  a4: { w: 794, labelKey: 'export.fmt.a4' },
  169: { w: 1280, h: 720, labelKey: 'export.fmt.169' },
};
export const formatLabel = (f) => t((FORMATS[f] || FORMATS.a4).labelKey);

export function cardTitle(data, spec) {
  if (isRefs(spec)) return refsCardTitle(data, spec);
  return cite(data.unitMeta(spec.unit, uiLang()), spec.key || null, uiLang(), data.abbr(uiLang()));
}
export function cardSubtitle(data, spec) {
  if (isRefs(spec)) return refsCardSubtitle(data, spec);
  const legal = spec.kind === 'compare' && spec.cm === 'sprache' ? null : spec.lang;
  const ll = legal && legal !== uiLang() ? ` (${t('card.legalText', { lang: LANG_CODES[legal] })})` : '';
  if (spec.kind === 'block' || spec.kind === 'unit') return t('card.subChron') + ll;
  if (spec.cm === 'sprache') return t('card.subLang', { a: LANG_CODES[spec.la], b: LANG_CODES[spec.lb], stage: data.stageLabel(spec.a) });
  return t('card.subCompare', { a: data.stageName(spec.a), b: data.stageName(spec.b) }) + ll;
}

/** «Quelle: Fedlex, SR 142.20, Stand 1. April 2025. Massgebend ist die Amtliche Sammlung (Art. 15 Abs. 1 PublG).» */
export function sourceLine(data, stagesUsed) {
  const latest = stagesUsed.length ? stagesUsed.reduce((a, b) => (data.stageIndex(b) > data.stageIndex(a) ? b : a)) : data.current.id;
  const future = stagesUsed.filter((s) => data.isFuture(s));
  let s = t('card.source', { sr: data.srLabel(uiLang()) || data.work.id, date: fmtDate(data.stageDate(latest)) });
  s += ' ' + t('card.binding');
  if (future.length) s += ' ' + t('card.futureStages', { list: future.map((x) => fmtDate(data.stageDate(x))).join(', ') });
  s += ' ' + t('card.created', { date: fmtDate(todayIso()) });
  return s;
}

function Legend({ data, acts, diff, future }) {
  return html`<div class="card-legend">
    ${acts.map((c) => html`<span class="lg-item lg-act"><span class=${'osw osw-' + (data.isFutureAct(c) ? 'future' : 'amended')}></span><b>${data.actCode(c)}</b><span class="lg-name">${data.actName(c) !== data.actCode(c) ? data.actName(c) : ''}</span></span>`)}
    ${diff ? html`<span class="lg-item"><ins>${t('change.inserted')}</ins></span><span class="lg-item"><del>${t('change.deleted')}</del></span>` : null}
    ${future ? html`<span class="lg-item"><span class="osw osw-future"></span>${t('legend.future')}</span>` : null}
  </div>`;
}

function CardBlockChron({ data, spec, collect }) {
  const steps = blockSteps(data, spec.unit, spec.lang, spec.key);
  return html`<ol class="card-chron">${steps.map((s) => {
    if (!data.isBase(s.origin)) collect.acts.add(s.origin);
    collect.stages.add(s.stage);
    if (data.isFuture(s.stage)) collect.future = true;
    if (s.change !== 'base') collect.diff = true;
    return html`<li class=${'cstep cbrk' + (data.isFuture(s.stage) ? ' is-pending' : '')}>
      <div class="cstep-head"><b>${data.stageLabel(s.stage)}</b><span class="cstep-chg">${changeLabel(s.change === 'base' ? 'first' : s.change)}</span>${data.isFuture(s.stage) ? html`<span class="cstep-recon">${t('status.future')}</span>` : null}</div>
      <div class="cstep-meta">${actMetaLine(data, s.origin, s.inForce)}</div>
      <div class="cstep-text legal" lang=${spec.lang}><${Lbl} l=${s.block && s.block.l} />${s.block && (s.block.ty === 'table' || s.block.ty === 'img') ? html`<${BlockBody} b=${s.block} />` : html`<span dangerouslySetInnerHTML=${{ __html: s.textHtml || '' }}></span>`}</div>
    </li>`;
  })}</ol>`;
}

function CardUnitChron({ data, spec, collect }) {
  const steps = unitSteps(data, spec.unit, spec.lang);
  const meta = data.unitMeta(spec.unit, uiLang());
  return html`<ol class="card-chron">${steps.map((s) => {
    for (const a of s.acts) if (!s.first) collect.acts.add(a);
    collect.stages.add(s.stage);
    if (data.isFuture(s.stage)) collect.future = true;
    if (s.items.length) collect.diff = true;
    return html`<li class=${'cstep cbrk' + (data.isFuture(s.stage) ? ' is-pending' : '')}>
      <div class="cstep-head"><b>${data.stageLabel(s.stage)}</b><span class="cstep-chg">${unitStepLabel(data, s)}</span>${data.isFuture(s.stage) ? html`<span class="cstep-recon">${t('status.future')}</span>` : null}</div>
      ${!s.first && s.acts.length ? html`<div class="cstep-meta">${s.acts.map((a) => data.actCode(a)).join(', ')}</div>` : null}
      ${s.items.map((it) => html`<div class="citem cbrk"><div class="citem-k">${it.key ? cite(meta, it.key, uiLang(), null) : it.title ? t('chron.heading') : t('common.wholeUnit')} <span>${changeLabel(it.change)}</span></div>${it.html != null ? html`<div class="legal" lang=${spec.lang} dangerouslySetInnerHTML=${{ __html: it.html }}></div>` : null}</div>`)}
    </li>`;
  })}</ol>`;
}

function CardCompare({ data, spec, collect }) {
  const mode = spec.cm || 'stand';
  const opts = mode === 'sprache'
    ? { a: spec.a, b: spec.a, la: spec.la, lb: spec.lb, key: spec.key, mode }
    : { a: spec.a, b: spec.b, la: spec.lang, lb: spec.lang, key: spec.key, mode };
  const res = compareRows(data, spec.unit, opts);
  collect.stages.add(spec.a); if (mode !== 'sprache') collect.stages.add(spec.b);
  for (const s of collect.stages) if (data.isFuture(s)) collect.future = true;
  for (const r of res.rows) {
    if (r.right && r.right.o && !data.isBase(r.right.o) && (spec.sc === 'full' || r.status !== 'same')) collect.acts.add(r.right.o);
    if (r.status !== 'same') collect.diff = mode !== 'sprache';
  }
  const st = compareStats(res.rows);
  const headA = mode === 'sprache' ? LANG_CODES[spec.la] : t('compare.headOld', { name: data.stageName(spec.a) });
  const headB = mode === 'sprache' ? LANG_CODES[spec.lb] : t('compare.headNew', { name: data.stageName(spec.b) });
  return html`<div>
    ${mode !== 'sprache' ? html`<p class="card-stats">${t('card.stats', { c: st.changed, i: st.ins, d: st.del })}</p>` : null}
    <${CompareTable} data=${data} unitId=${spec.unit} result=${res} layout=${spec.lay || 'side'} scope=${spec.sc || 'changed'} mode=${mode} headA=${headA} headB=${headB} showOrigin=${mode !== 'sprache'} langA=${mode === 'sprache' ? spec.la : spec.lang} langB=${mode === 'sprache' ? spec.lb : spec.lang} />
  </div>`;
}

export function Card({ data, spec, fs = 16 }) {
  const f = FORMATS[spec.format] || FORMATS.a4;
  if (isRefs(spec)) return html`<${RefsCard} data=${data} spec=${spec} fs=${fs} width=${refsCardWidth(spec, f.w)} />`;
  const collect = { acts: new Set(), stages: new Set(), diff: false, future: false };
  const body = spec.kind === 'block' ? html`<${CardBlockChron} data=${data} spec=${spec} collect=${collect} />`
    : spec.kind === 'unit' ? html`<${CardUnitChron} data=${data} spec=${spec} collect=${collect} />`
    : html`<${CardCompare} data=${data} spec=${spec} collect=${collect} />`;
  return html`<${CardFrame} data=${data} spec=${spec} f=${f} fs=${fs} body=${body} collect=${collect} />`;
}

function CardFrame({ data, spec, f, fs, body, collect }) {
  const meta = data.unitMeta(spec.unit, uiLang());
  const l = spec.lang || spec.la || 'de';
  const ti = data.unitTitle(spec.unit, l, spec.b || spec.a || data.current.id);
  const ui = uiLang();
  return html`<article class=${'card card-' + spec.format} lang=${ui} style=${{ width: f.w + 'px', minHeight: f.h ? f.h + 'px' : undefined, '--fs': fs + 'px' }}>
    <header class="card-head cbrk">
      <div class="card-brand"><span><b>SR</b> Navigator</span><span>${data.srLabel(ui)} | ${data.abbr(ui)}</span></div>
      <h1 class="card-title">${cardTitle(data, spec)}</h1>
      <p class="card-sub">${cardSubtitle(data, spec)}</p>
      ${ti.label ? html`<p class="card-unit">${cite(meta, null, ui, null)}: <span lang=${l}>${plain(ti.label)}</span></p>` : null}
    </header>
    <div class="card-body">${body}</div>
    <${CardFoot} data=${data} collect=${collect} />
  </article>`;
}

function CardFoot({ data, collect }) {
  return html`<footer class="card-foot cbrk">
    <${Legend} data=${data} acts=${[...collect.acts]} diff=${collect.diff} future=${collect.future} />
    <p class="card-source">${sourceLine(data, [...collect.stages].filter(Boolean))}</p>
  </footer>`;
}
