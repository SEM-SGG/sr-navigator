// Exportkarten zu Verweisnetz und Verweisstruktur (über die bestehende Exportstrecke export.js): Zitat, Stand, Sprache,
// Legende der Formen, Quellenzeile mit Verbindlichkeitshinweis.
import { html } from 'htm/preact';
import { cite } from '../lib/cite.js';
import { fmtDate, LANG_CODES } from '../lib/format.js';
import { t, uiLang } from '../lib/i18n.js';
import { egoGraph } from './refsgraph-model.js';
import { EgoNet, centerCite } from './refsnet.js';
import { StructChart, chartLayout, RowLabels, StructLegend, ST } from '../modules/sr/refstructure.js';
import { RefsLegend } from './refs-ui.js';
import { sourceLine } from './card.js';
import { groupName } from './refsnet.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function refsCardTitle(data, spec) {
  if (spec.kind === 'refstruct') return t('card.refstructTitle', { abbr: data.abbr(uiLang()) });
  return cap(cite(data.unitMeta(spec.unit, uiLang()), spec.key || null, uiLang(), data.abbr(uiLang())));
}
export function refsCardSubtitle(data, spec) {
  const ll = t('card.legalText', { lang: LANG_CODES[spec.lang] || spec.lang });
  return t(spec.kind === 'refstruct' ? 'card.subRefstruct' : 'card.subRefnet', { stage: data.stageLabel(spec.stage) }) + ` (${ll})`;
}
/** Breite der Karte: A4 (794 px), bei der Struktur mindestens 4 px je Einheit plus Beschriftungsspalte. */
export function refsCardWidth(spec, base) {
  if (spec.kind !== 'refstruct' || !spec.model) return base;
  return Math.max(base, Math.ceil(spec.model.columns.length * ST.minCol + ST.labelCol + 80));
}

export function RefsCard({ data, spec, fs = 16, width }) {
  const ctx = spec.ctx;
  const ui = uiLang();
  const inner = width - 80;
  let body;
  if (spec.kind === 'refnet') {
    const graph = egoGraph(ctx, spec.unit, spec.key || null, null);
    body = html`<${EgoNet} ctx=${ctx} graph=${graph} width=${inner} mode="card" centerLabel=${centerCite(data, spec.unit, spec.key)} />
      ${graph.stats.uncertain ? html`<p class="rn-unc">${t('refs.uncertainNote', { n: graph.stats.uncertain })}</p>` : null}`;
  } else {
    const m = spec.model;
    const chartW = inner - ST.labelCol;
    const { g } = chartLayout(data, m, chartW);
    body = html`<p class="rn-count">${t('refs.st.sum', { refs: m.totals.refs, arcs: m.totals.arcs })}</p>
      <div class="rs-frame rs-card-frame">
        <${RowLabels} ctx=${ctx} model=${m} g=${g} />
        <div class="rs-scroll"><${StructChart} data=${data} ctx=${ctx} model=${m} lang=${spec.lang} stageId=${spec.stage} sel=${null} onSelect=${() => {}} avail=${chartW} card=${true} /></div>
      </div>`;
  }
  return html`<article class=${'card card-a4 card-refs'} lang=${ui} style=${{ width: width + 'px', '--fs': fs + 'px' }}>
    <header class="card-head cbrk">
      <div class="card-brand"><span><b>SR</b> Navigator</span><span>${data.srLabel(ui)} | ${data.abbr(ui)}</span></div>
      <h1 class="card-title">${refsCardTitle(data, spec)}</h1>
      <p class="card-sub">${refsCardSubtitle(data, spec)}</p>
      <p class="card-unit">${spec.kind === 'refstruct' ? t('refs.st.note', { date: fmtDate(data.stageDate(spec.stage)) }) : t('refs.stageNote', { date: fmtDate(data.stageDate(spec.stage)) })}</p>
    </header>
    <div class="card-body">${body}</div>
    <footer class="card-foot cbrk">
      <div class="card-legend card-legend-refs">${spec.kind === 'refstruct' ? html`<${StructLegend} />` : html`<${RefsLegend} missing=${true} />`}</div>
      <p class="card-source">${t('card.refsMethod')}</p>
      <p class="card-source">${sourceLine(data, [spec.stage])}</p>
    </footer>
  </article>`;
}
