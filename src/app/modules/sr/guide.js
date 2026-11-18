// Anleitung (DE, FR, IT): Zweck, Grundbegriffe, Schritt-für-Schritt-Anleitungen, Legende mit echten gerenderten Beispielen,
// Zitierweise, Tastatur, Grenzen. Texte aus den Wörterbüchern (guide.*); [[schlüssel]] setzt den Namen eines Bedienelements ein.
import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';
import { go } from '../../state.js';
import { Icon, StageStatusTag, OriginChip } from '../../ui/common.js';
import { BlockList } from '../../ui/blocks.js';
import { cite } from '../../lib/cite.js';
import { t, tx, uiLang } from '../../lib/i18n.js';
import { useRefsCtx, RefsLegend, useWidth } from '../../ui/refs-ui.js';
import { EgoNet, centerCite } from '../../ui/refsnet.js';
import { egoGraph, LIMITS_PANEL } from '../../ui/refsgraph-model.js';
import { StructLegend } from './refstructure.js';

/** Mini-Auszeichnung: [[schlüssel]] → Name des Bedienelements fett; **text** → fett. */
export function rich(str) {
  const out = [];
  const re = /\[\[([\w.]+)\]\]|\*\*([^*]+)\*\*/g;
  let last = 0, m;
  const s = String(str ?? '');
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] ? html`<b class="ui-ref">${t(m[1], { n: 2, date: '…', name: '…' })}</b>` : html`<b>${m[2]}</b>`);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
const list = (key) => { const v = tx(key); return Array.isArray(v) ? v : []; };

export const TASKS = ['bibliothek', 'lesen', 'inkraft', 'chronologie', 'verweisnetz', 'vergleich', 'sprachvergleich', 'export', 'aktualisieren', 'projekt', 'links', 'uebersicht', 'verweisstruktur'];
export const SECTIONS = ['zweck', 'grundbegriffe', 'aufgaben', 'legende', 'zitierweise', 'tastatur', 'grenzen'];

function Steps({ id }) {
  const intro = tx(`guide.task.${id}.intro`);
  const after = tx(`guide.task.${id}.after`);
  return html`<section class="g-task" id=${'g-' + id} tabindex="-1" aria-labelledby=${'gh-' + id}>
    <h3 id=${'gh-' + id}>${t(`guide.task.${id}.title`)}</h3>
    ${intro ? html`<p>${rich(intro)}</p>` : null}
    <ol class="g-steps">${list(`guide.task.${id}.steps`).map((s) => html`<li>${rich(s)}</li>`)}</ol>
    ${after ? html`<p class="g-after">${rich(after)}</p>` : null}
  </section>`;
}

/** Echte Blöcke aus dem Erlass: Grunderlass, geändert, beschlossen und noch nicht in Kraft. */
function sampleBlocks(data, lang) {
  const pick = { base: null, amended: null, future: null };
  const ok = (b) => b.ty !== 'table' && b.ty !== 'img' && b.ty !== 'heading' && b.t && b.t.length >= 50 && b.t.length < 260;
  const score = (b) => Math.abs(b.t.length - 150);
  const latest = data.latest.id;
  for (const id of data.unitOrder) {
    for (const sid of [data.current.id, latest]) {
      const v = data.version(id, lang, sid);
      if (!v || v.repealed) continue;
      for (const b of v.blocks || []) {
        if (!ok(b)) continue;
        const slot = data.origin(b).kind;
        if (!pick[slot] || score(b) < score(pick[slot].b)) pick[slot] = { unit: id, b: { ...b, d: 0, fn: undefined } };
      }
    }
  }
  return pick;
}

function Legend({ data, lang }) {
  const pick = sampleBlocks(data, lang);
  const blocks = ['base', 'amended', 'future'].map((k) => (pick[k] ? { ...pick[k], kind: k } : null)).filter(Boolean);
  const cur = data.current.id;
  const fut = data.stages.find((s) => data.isFuture(s.id));
  const past = data.prevStage(cur);
  return html`<div class="g-legend">
    <h3>${t('guide.legend.marks')}</h3>
    <p>${rich(t('guide.legend.marksText'))}</p>
    ${blocks.map((p) => html`<div class="g-sample" data-kind=${p.kind}>
      <p class="g-sample-cap"><b>${t('guide.legend.kind.' + p.kind)}</b> | ${cite(data.unitMeta(p.unit, uiLang()), p.b.k, uiLang(), data.abbr(uiLang()))}</p>
      <div class="legal legal-read" lang=${lang}><${BlockList} data=${data} unitId=${p.unit} version=${{ blocks: [p.b] }} lang=${lang} originMarks=${true} footnotes=${false} /></div>
    </div>`)}
    ${blocks.some((p) => p.kind === 'amended') ? html`<div class="g-sample" data-kind="selected">
      <p class="g-sample-cap"><b>${t('guide.legend.kind.selected')}</b></p>
      <div class="legal legal-read" lang=${lang}><${BlockList} data=${data} unitId=${blocks.find((p) => p.kind === 'amended').unit} version=${{ blocks: [blocks.find((p) => p.kind === 'amended').b] }} lang=${lang} originMarks=${true} footnotes=${false} selAct=${blocks.find((p) => p.kind === 'amended').b.o} /></div>
    </div>` : null}

    <h3>${t('guide.legend.status')}</h3>
    <dl class="g-defs">
      <dt><${StageStatusTag} data=${data} stageId=${cur} /></dt><dd>${t('guide.legend.statusText.current')}</dd>
      ${past ? html`<dt><${StageStatusTag} data=${data} stageId=${past.id} /></dt><dd>${t('guide.legend.statusText.past')}</dd>` : null}
      ${fut ? html`<dt><${StageStatusTag} data=${data} stageId=${fut.id} /></dt><dd>${t('guide.legend.statusText.future')}</dd>` : html`<dt><span class="tag stag stag-future">${t('status.future')}</span></dt><dd>${t('guide.legend.statusText.future')}</dd>`}
    </dl>

    <h3>${t('guide.legend.origin')}</h3>
    <dl class="g-defs">
      <dt><${OriginChip} data=${data} act=${data.base} /></dt><dd>${t('guide.legend.originBase')}</dd>
      ${pick.amended ? html`<dt><${OriginChip} data=${data} act=${pick.amended.b.o} /></dt><dd>${t('guide.legend.originAmended')}</dd>` : null}
    </dl>

    <h3>${t('guide.legend.diff')}</h3>
    <dl class="g-defs">
      <dt><span class="legal"><ins>${t('change.inserted')}</ins></span></dt><dd>${t('guide.legend.ins')}</dd>
      <dt><span class="legal"><del>${t('change.deleted')}</del></span></dt><dd>${t('guide.legend.del')}</dd>
      <dt><span class="state-tag st-changed">${t('change.amended')}</span> <span class="state-tag st-ins">${t('change.inserted')}</span> <span class="state-tag">${t('change.deleted')}</span></dt><dd>${t('guide.legend.stateTags')}</dd>
    </dl>

    <h3>${t('guide.legend.bar')}</h3>
    <dl class="g-defs">
      <dt><span class="sbar-item is-changed lg-box" aria-hidden="true"><span class="sbar-dot"></span></span></dt><dd>${t('read.stagebar.legendChanged')}</dd>
      <dt><span class="sbar-item lg-box" aria-hidden="true"><span class="sbar-dot"></span></span></dt><dd>${t('read.stagebar.legendSame')}</dd>
      <dt><span class="sbar-item is-today lg-box" aria-hidden="true"><span class="sbar-dot"></span></span></dt><dd>${t('read.stagebar.legendToday')}</dd>
      <dt><span class="sbar-item is-future lg-box" aria-hidden="true"><span class="sbar-dot"></span></span></dt><dd>${t('legend.future')}</dd>
    </dl>

    <h3>${t('guide.legend.timeline')}</h3>
    <p class="legend-line"><span class="lg"><span class="vt-lg vt-xml"></span>${t('ov.tl.kind.xml')}</span><span class="lg"><span class="vt-lg vt-pdf"></span>${t('ov.tl.kind.pdf')}</span><span class="lg"><span class="vt-lg vt-future"></span>${t('ov.tl.kind.future')}</span><span class="lg"><span class="vt-lg-now"></span>${t('ov.tl.today')}</span></p>

    <h3>${t('guide.legend.matrix')}</h3>
    <dl class="g-defs">
      <dt><span class="mx-sample"><b>+</b></span></dt><dd>${t('ov.mx.lgIns')}</dd>
      <dt><span class="mx-sample"><b>±</b> <small>3</small></span></dt><dd>${t('ov.mx.lgRep')}; ${t('ov.mx.lgNum')}</dd>
      <dt><span class="mx-sample"><b>−</b></span></dt><dd>${t('ov.mx.lgDel')}</dd>
      <dt><span class="mx-sample is-pending"><b>±</b></span></dt><dd>${t('legend.future')}</dd>
    </dl>

    <h3>${t('guide.legend.refs')}</h3>
    <p>${t('guide.legend.refsText')}</p>
    <${RefsLegend} missing=${true} />
    <${StructLegend} />
    <${RefsSample} data=${data} lang=${lang} />
  </div>`;
}

/** Echtes Verweisnetz einer Bestimmung des Erlasses (gekürzt wie in der Leiste, ohne Bedienung). */
function RefsSample({ data, lang }) {
  const st = useRefsCtx(data, lang, data.current.id);
  const box = useRef();
  const w = useWidth(box);
  let unit = null, graph = null;
  if (st.status === 'ready') {
    // Bestimmung mit Verweisen in beide Richtungen, möglichst mittelgross
    let best = null;
    for (const u of data.unitOrder) {
      const g = egoGraph(st.ctx, u, null, LIMITS_PANEL);
      if (!g.stats.inRefs || !g.stats.outRefs) continue;
      const score = Math.abs(g.stats.nodes - 9) + (g.right.length < 2 ? 4 : 0);
      if (!best || score < best.score) best = { u, g, score };
    }
    if (best) { unit = best.u; graph = best.g; }
  }
  return html`<div class="g-sample g-refs" data-kind="refs" ref=${box}>
    ${graph ? html`<p class="g-sample-cap"><b>${t('guide.legend.refsSample', { cite: centerCite(data, unit, null) + ' ' + data.abbr(uiLang()) })}</b></p>
      ${w ? html`<${EgoNet} ctx=${st.ctx} graph=${graph} width=${Math.min(560, w)} mode="card" centerLabel=${centerCite(data, unit, null)} />` : null}` : null}
  </div>`;
}

export const CITE_EXAMPLES = [
  [{ type: 'article', num: '5' }, 'p1.a.n2'], [{ type: 'article', num: '10a' }, 'p2'], [{ type: 'article', num: '26bis' }, 'p1bis'],
  [{ type: 'article', num: '30' }, 'p1.abis'], [{ type: 'annex', num: '1' }, 'n2.n1'], [{ type: 'article', num: '3' }, 'p1.a.d2'],
];

function Citation({ data }) {
  const ab = (l) => data.abbr(l);
  return html`<div class="tbl-scroll"><table class="tbl-data g-cite"><thead><tr><th>${t('guide.cite.colDe')}</th><th>${t('guide.cite.colFr')}</th><th>${t('guide.cite.colIt')}</th></tr></thead><tbody>
    ${CITE_EXAMPLES.map(([u, k]) => html`<tr><td lang="de">${cite(u, k, 'de', ab('de'))}</td><td lang="fr">${cite(u, k, 'fr', ab('fr'))}</td><td lang="it">${cite(u, k, 'it', ab('it'))}</td></tr>`)}
  </tbody></table></div>`;
}

export function GuideView({ data, route }) {
  const ref = useRef();
  useEffect(() => {
    const id = route.sec ? 'g-' + route.sec : null;
    const el = id && document.getElementById(id);
    if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }
    else if (ref.current) ref.current.scrollTop = 0;
  }, [route.sec]);
  const jump = (sec) => (e) => { e.preventDefault(); go({ sec }, { replace: true }); const el = document.getElementById('g-' + sec); if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); } };
  const lang = data && data.langs.includes(route.l) ? route.l : 'de';
  return html`<div class="view view-guide" ref=${ref}><main class="wide narrow guide" id="main" tabindex="-1">
    <header class="unit-head"><p class="unit-label"><b>SR</b> Navigator</p><h1 class="unit-title">${t('nav.anleitung')}</h1><p class="ov-lead">${t('guide.lead')}</p></header>

    <nav class="g-toc" aria-label=${t('guide.toc')}>
      <h2 class="g-toc-title">${t('guide.toc')}</h2>
      <ol>
        ${SECTIONS.map((s) => html`<li><a href=${'#/anleitung?sec=' + s} onClick=${jump(s)}>${t('guide.sec.' + s)}</a>
          ${s === 'aufgaben' ? html`<ol>${TASKS.map((x) => html`<li><a href=${'#/anleitung?sec=' + x} onClick=${jump(x)}>${t(`guide.task.${x}.title`)}</a></li>`)}</ol>` : null}</li>`)}
      </ol>
    </nav>

    <section class="g-sec" id="g-zweck" tabindex="-1" aria-labelledby="gs-zweck">
      <h2 id="gs-zweck">${t('guide.sec.zweck')}</h2>
      ${list('guide.zweck.text').map((p) => html`<p>${rich(p)}</p>`)}
      <div class="notice notice-warning" role="note"><${Icon} name="warning" /><div><strong>${t('info.binding.lead')}</strong> ${t('info.binding.text')}</div></div>
    </section>

    <section class="g-sec" id="g-grundbegriffe" tabindex="-1" aria-labelledby="gs-grundbegriffe">
      <h2 id="gs-grundbegriffe">${t('guide.sec.grundbegriffe')}</h2>
      <dl class="g-terms">${list('guide.terms').map(([term, def]) => html`<dt>${term}</dt><dd>${rich(def)}</dd>`)}</dl>
    </section>

    <section class="g-sec" id="g-aufgaben" tabindex="-1" aria-labelledby="gs-aufgaben">
      <h2 id="gs-aufgaben">${t('guide.sec.aufgaben')}</h2>
      ${TASKS.map((id) => html`<${Steps} id=${id} />`)}
    </section>

    <section class="g-sec" id="g-legende" tabindex="-1" aria-labelledby="gs-legende">
      <h2 id="gs-legende">${t('guide.sec.legende')}</h2>
      <p>${t('guide.legend.intro', { name: data ? data.abbr(uiLang()) : '' })}</p>
      ${data ? html`<${Legend} data=${data} lang=${lang} />` : html`<p class="muted">${t('guide.legend.noData')}</p>`}
    </section>

    <section class="g-sec" id="g-zitierweise" tabindex="-1" aria-labelledby="gs-zitierweise">
      <h2 id="gs-zitierweise">${t('guide.sec.zitierweise')}</h2>
      ${list('guide.cite.text').map((p) => html`<p>${rich(p)}</p>`)}
      ${data ? html`<${Citation} data=${data} />` : null}
    </section>

    <section class="g-sec" id="g-tastatur" tabindex="-1" aria-labelledby="gs-tastatur">
      <h2 id="gs-tastatur">${t('guide.sec.tastatur')}</h2>
      <dl class="g-keys">${list('guide.keys').map(([k, d]) => html`<dt>${k.split('+').map((x, i) => html`${i ? ' + ' : ''}<kbd>${x}</kbd>`)}</dt><dd>${rich(d)}</dd>`)}</dl>
    </section>

    <section class="g-sec" id="g-grenzen" tabindex="-1" aria-labelledby="gs-grenzen">
      <h2 id="gs-grenzen">${t('guide.sec.grenzen')}</h2>
      <ul class="g-list">${list('guide.limits').map((p) => html`<li>${rich(p)}</li>`)}</ul>
    </section>
  </main></div>`;
}
