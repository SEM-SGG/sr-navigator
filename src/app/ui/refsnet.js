// Verweisnetz einer Bestimmung (SPEC §12.3 A): Bereich «Verweise» der Chronologie-Leiste (Liste | Netz), Ego-Netz als SVG,
// vergrösserte Ansicht als modaler Dialog mit PNG-Export.
import { html } from 'htm/preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { egoGraph, LIMITS_PANEL, layoutEgo, bezier, strokeOf, listEntries, uncertainRefs } from './refsgraph-model.js';
import { useRefsCtx, nodeLabel, nodeLink, onInternal, refExcerpt, Excerpt, shape, RefsLegend, fitText, textWidth, useWidth, useFontsReady, Dialog, sourceCite, targetCite, refTargetLink, refSourceLink, RefLink, refsSetting, setRefsSetting, euShort } from './refs-ui.js';
import { Seg, Icon, Notice } from './common.js';
import { cite } from '../lib/cite.js';
import { fmtDate } from '../lib/format.js';
import { t, uiLang } from '../lib/i18n.js';
import { toast } from '../app.js';

const FONT = '400 12px "IBM Plex Sans"';
const FONT_C = '600 14px "IBM Plex Sans"';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Zitat der Mitte (Bestimmung bzw. Einheit) ohne Kürzel. */
export const centerCite = (data, unitId, key) => cap(cite(data.unitMeta(unitId, uiLang()), key || null, uiLang(), null));
/** Bezeichnung «ganzer Artikel» bzw. «ganzer Anhang». */
export const wholeLabel = (data, unitId) => {
  const ty = data.unitMeta(unitId, uiLang()).type;
  return t(ty === 'annex' ? 'refs.scope.annex' : ty === 'article' ? 'refs.scope.article' : 'refs.scope.unit');
};
/** Name einer Gruppe rechts bzw. eines Erlasses. */
export function groupName(ctx, group) {
  if (group === 'self') { const d = ctx.dataOf(ctx.work); return d ? d.abbr(uiLang()) : ''; }
  if (group === 'sr') return t('refs.group.sr');
  if (group === 'eu') return t('refs.group.eu');
  if (group.startsWith('lib:')) { const d = ctx.dataOf(group.slice(4)); return d ? d.abbr(uiLang()) : group.slice(4); }
  return group;
}

// ------------------------------------------------------------ Netz (SVG)
/**
 * Ego-Netz. mode: panel (gekürzt, «n weitere» öffnet den Dialog) | dialog (vollständig) | card (Export, ohne Interaktion).
 */
export function EgoNet({ ctx, graph, width, mode = 'panel', onMore, onNav, centerLabel }) {
  const [active, setActive] = useState(null);
  const interactive = mode !== 'card';
  const W = Math.max(280, Math.round(width || 360));
  const wide = W >= 640;
  const HFONT = '600 12px "IBM Plex Sans"';
  const xlA = Math.round(W * (wide ? 0.3 : 0.27)), cxA = Math.round(W * (wide ? 0.47 : 0.44)), xrA = Math.round(W * (wide ? 0.64 : 0.6));
  // Köpfe je Seite: Titel und Zähler; passt der Zähler nicht auf eine Zeile, bricht er nach «·» um (nie gekürzt)
  const sideLines = (dir, maxW) => {
    const c = sideText(dir, graph.stats);
    if (textWidth(c, FONT) <= maxW) return [c];
    return c.split(' · ').map((x, i, a) => (i < a.length - 1 ? x + ' ·' : x));
  };
  const linesL = sideLines('in', cxA - 16);
  const linesR = sideLines('out', W - xrA + 7);
  const top = 16 * (1 + Math.max(linesL.length, linesR.length)) + 6;
  const lay = useMemo(() => layoutEgo(graph, {
    width: W, row: 28, rowMissing: 42, head: 26, pad: 8, top,
    labelL: Math.round(W * (wide ? 0.3 : 0.27)), cx: Math.round(W * (wide ? 0.47 : 0.44)), labelR: Math.round(W * (wide ? 0.64 : 0.6)),
  }), [graph, W, top]);
  const labL = Math.max(40, lay.xl - 14 - 2);
  const labR = Math.max(40, W - lay.xr - 14 - 2);
  const ui = uiLang();
  const nodes = [
    ...lay.left.map((p) => ({ ...p, side: 'left' })),
    ...lay.right.flatMap((g) => g.items.map((p) => ({ ...p, side: 'right', group: g.group }))),
  ];
  const info = (n) => {
    const lab = nodeLabel(ctx, n.node, { withAbbr: n.side === 'left' && n.node.kind === 'lib', lang: ctx.lang });
    const full = nodeLabel(ctx, n.node, { withAbbr: n.node.kind === 'lib', lang: ctx.lang });
    const text = n.node.kind === 'eu' ? euShort(lab.text) : lab.text;
    return { lab, full, short: fitText(text, n.side === 'left' ? labL : labR, FONT) };
  };
  const centerText = fitText(centerLabel, Math.min(W * 0.5, 260), FONT_C);
  const activeNode = active ? nodes.find((n) => n.node.id === active.id && n.side === active.side) : null;
  const edgePath = (n) => (n.side === 'left' ? bezier(lay.xl + 7, n.y, lay.cx - 13, lay.cy) : bezier(lay.cx + 13, lay.cy, lay.xr - 7, n.y));
  const tipFor = (n) => {
    const i = info(n);
    const c = centerLabel;
    const from = n.side === 'left' ? i.full.text : c;
    const to = n.side === 'left' ? c : i.full.text;
    const ex = refExcerpt(ctx, n.node.refs[0], 60);
    return { from, to, n: n.node.n, ex, missing: n.node.missing, more: n.node.n - 1 };
  };
  const tip = interactive && activeNode ? tipFor(activeNode) : null;
  const tipX = activeNode ? Math.max(0, Math.min(W - 300, activeNode.side === 'left' ? activeNode.x - 40 : activeNode.x - 140)) : 0;
  const tipBelow = activeNode ? activeNode.y < lay.height - 120 : true;
  const enter = (n) => () => setActive({ id: n.node.id, side: n.side });
  const leave = () => setActive(null);
  const aria = (n, i) => {
    const tp = tipFor(n);
    return `${tp.from} → ${tp.to}: ${t('refs.nFund', { n: n.node.n })}${n.node.missing ? ', ' + t('refs.missing') : ''}`;
  };
  return html`<div class=${'rn-wrap rn-' + mode} style=${{ width: W + 'px' }}>
    <svg class="rn-svg" width=${W} height=${lay.height} viewBox=${`0 0 ${W} ${lay.height}`} role="group" aria-label=${t('refs.netAria', { cite: centerLabel })}>
      <g class="rn-side" data-side="in" data-refs=${graph.stats.inRefs} data-n=${graph.stats.inUnits}>
        <text class="rn-head" x="0" y=${lay.pad + 12}>${t('refs.in')}</text>
        ${linesL.map((l, i) => html`<text class="rn-sidecount" x="0" y=${lay.pad + 28 + i * 16}>${l}</text>`)}
      </g>
      <g class="rn-side" data-side="out" data-refs=${graph.stats.outRefs} data-n=${graph.stats.outNodes}>
        <text class="rn-head" x=${lay.xr - 7} y=${lay.pad + 12}>${t('refs.out')}</text>
        ${linesR.map((l, i) => html`<text class="rn-sidecount" x=${lay.xr - 7} y=${lay.pad + 28 + i * 16}>${l}</text>`)}
      </g>
      ${lay.right.map((g) => html`<text class="rn-head rn-ghead" x=${lay.xr - 7} y=${g.y + 6}>${fitText(groupName(ctx, g.group), W - lay.xr - 4, '600 12px "IBM Plex Sans"')}${g.items.length + (g.more || 0) > 1 ? ` (${g.items.length + (g.more || 0)})` : ''}</text>`)}
      <g class="rn-edges">
        ${nodes.map((n) => {
          const on = activeNode && activeNode.node.id === n.node.id && activeNode.side === n.side;
          return html`<path class=${'rn-edge' + (n.node.missing ? ' is-missing' : '') + (on ? ' is-on' : activeNode ? ' is-dim' : '')} d=${edgePath(n)} style=${{ strokeWidth: strokeOf(n.node.n).toFixed(2) + 'px' }} />`;
        })}
      </g>
      <g class="rn-center">
        ${shape('center', lay.cx, lay.cy)}
        <text class="rn-clabel" x=${lay.cx} y=${lay.cy + 28} text-anchor="middle">${centerText}</text>
      </g>
      ${nodes.map((n) => {
        const i = info(n);
        const link = interactive ? nodeLink(ctx, n.node, n.side) : null;
        const left = n.side === 'left';
        const tx = left ? lay.xl - 14 : lay.xr + 14;
        const lw = Math.min(left ? labL : labR, textWidth(i.short, FONT));
        const box = left ? { x: tx - lw - 4, w: lw + 4 + 14 + 7 } : { x: lay.xr - 9, w: 9 + 14 + lw + 4 };
        const body = html`
          <rect class="rn-focus" x=${box.x} y=${n.y - 12} width=${box.w} height=${n.node.missing ? 38 : 24} />
          ${shape(n.node.kind === 'other' ? 'sr' : n.node.kind, n.x, n.y, { missing: n.node.missing })}
          <text class=${'rn-label' + (link ? ' is-link' : '')} x=${tx} y=${n.y + 4} text-anchor=${left ? 'end' : 'start'} lang=${i.lab.lang}>${i.short}</text>
          ${n.node.missing ? html`<text class="rn-note" x=${tx} y=${n.y + 19} text-anchor=${left ? 'end' : 'start'}>${t('refs.missing')}</text>` : null}`;
        const common = { class: 'rn-node' + (link ? ' is-link' : ''), onMouseEnter: interactive ? enter(n) : undefined, onMouseLeave: interactive ? leave : undefined, onFocus: interactive ? enter(n) : undefined, onBlur: interactive ? leave : undefined, 'aria-label': interactive ? aria(n, i) : undefined, 'data-node': n.node.id, 'data-side': n.side, 'data-n': n.node.n };
        if (!interactive) return html`<g ...${common}>${body}</g>`;
        if (link && link.url) return html`<a ...${common} href=${link.url} target="_blank" rel="noopener noreferrer">${body}</a>`;
        if (link) return html`<a ...${common} href=${link.href} onClick=${onInternal(link, onNav)}>${body}</a>`;
        return html`<g ...${common} tabindex="0" role="img">${body}</g>`;
      })}
      ${graph.leftMore ? html`<${More} x=${lay.xl - 14} y=${lay.leftMoreY} anchor="end" n=${graph.leftMore} onMore=${mode === 'panel' ? onMore : null} />` : null}
      ${lay.right.filter((g) => g.more).map((g) => html`<${More} x=${lay.xr + 14} y=${g.moreY} anchor="start" n=${g.more} onMore=${mode === 'panel' ? onMore : null} />`)}
    </svg>
    ${tip ? html`<div class="rn-tip" role="tooltip" style=${tipBelow ? { left: tipX + 'px', top: (activeNode.y + 18) + 'px' } : { left: tipX + 'px', bottom: (lay.height - activeNode.y + 18) + 'px' }}>
      <p class="rn-tip-h">${tip.from} → ${tip.to}</p>
      <p class="rn-tip-n">${t('refs.nFund', { n: tip.n })}${tip.missing ? ' · ' + t('refs.missing') : ''}</p>
      ${tip.ex ? html`<p class="rn-tip-x"><${Excerpt} ex=${tip.ex} lang=${ctx.lang} /></p>` : null}
      ${tip.more > 0 ? html`<p class="rn-tip-n">${t('refs.moreFund', { n: tip.more })}</p>` : null}
    </div>` : null}
  </div>`;
}

function More({ x, y, anchor, n, onMore }) {
  const label = t('refs.more', { n });
  if (!onMore) return html`<text class="rn-more" x=${x} y=${y + 4} text-anchor=${anchor}>${label}</text>`;
  const act = (e) => { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMore(); } };
  const w = textWidth(label, FONT) + 8;
  return html`<g class="rn-more is-btn" role="button" tabindex="0" aria-label=${t('refs.moreAria', { n })} onClick=${act} onKeyDown=${act}>
    <rect class="rn-focus" x=${anchor === 'end' ? x - w + 4 : x - 4} y=${y - 11} width=${w} height="22" />
    <text x=${x} y=${y + 4} text-anchor=${anchor}>${label}</text>
  </g>`;
}

/** Zähler je Seite, gleiche Wörter in Netz, Liste und Leiste der Verweisstruktur: «9 Einheiten · 11 Fundstellen», «8 Ziele · 10 Fundstellen». */
export function sideText(dir, stats) {
  return dir === 'in'
    ? `${t('refs.countNodes', { n: stats.inUnits })} · ${t('refs.countFund', { n: stats.inRefs })}`
    : `${t('refs.countTargets', { n: stats.outNodes })} · ${t('refs.countFund', { n: stats.outRefs })}`;
}
/** Zähler als HTML (Liste, Leiste): Kennung data-side, data-refs, data-n für die Tests. */
export function SideCount({ dir, stats, className = 'rl-count' }) {
  return html`<p class=${className} data-side=${dir} data-refs=${dir === 'in' ? stats.inRefs : stats.outRefs} data-n=${dir === 'in' ? stats.inUnits : stats.outNodes}>${sideText(dir, stats)}</p>`;
}

// ------------------------------------------------------------ Liste (Textfassung)
export function RefsList({ ctx, graph, unc, onNav }) {
  const le = useMemo(() => listEntries(graph), [graph]);
  const nOut = le.out.reduce((s, g) => s + g.items.length, 0);
  const nIn = le.in.reduce((s, g) => s + g.items.length, 0);
  const item = (it, dir) => {
    const ex = refExcerpt(ctx, it.ref, 70);
    if (dir === 'out') {
      const labels = [];
      const seen = new Set();
      for (const r of it.refs) { const c = targetCite(ctx, r); if (!seen.has(c.text)) { seen.add(c.text); labels.push({ c, r }); } }
      return html`<li class="rl-item" data-node=${it.node.id}>
        <div class="rl-cite">${labels.map(({ c, r }, i) => html`${i ? ', ' : ''}<${RefLink} link=${refTargetLink(ctx, r)} lang=${c.lang} before=${onNav}>${c.text}</${RefLink}>`)}
          ${it.node.missing ? html` <span class="tag rl-missing">${t('refs.missing')}</span>` : null}
          <span class="rl-src">${t('refs.list.from', { cite: sourceCite(ctx, it.ref, { withAbbr: false }) })}</span></div>
        <p class="rl-ex"><${Excerpt} ex=${ex} lang=${ctx.lang} /></p>
      </li>`;
    }
    return html`<li class="rl-item" data-node=${it.node.id}>
      <div class="rl-cite"><${RefLink} link=${refSourceLink(ctx, it.ref)} before=${onNav}>${sourceCite(ctx, it.ref)}</${RefLink}>
        <span class="rl-src">${t('refs.list.to', { cite: targetCite(ctx, it.ref, { withAbbr: false }).text })}</span></div>
      <p class="rl-ex"><${Excerpt} ex=${ex} lang=${ctx.lang} /></p>
    </li>`;
  };
  const block = (title, groups, dir, n, id) => html`<section class="rl-sec" aria-labelledby=${id} data-side=${dir}>
    <h3 class="rl-h" id=${id}>${title}</h3>
    <${SideCount} dir=${dir} stats=${graph.stats} />
    ${groups.length ? groups.map((g) => html`<h4 class="rl-g">${groupName(ctx, g.group)}</h4><ul class="rl-items">${g.items.map((it) => item(it, dir))}</ul>`) : html`<p class="muted rl-none">${t(dir === 'out' ? 'refs.list.noneOut' : 'refs.list.noneIn')}</p>`}
  </section>`;
  return html`<div class="rl">
    ${block(t('refs.out'), le.out, 'out', nOut, 'rl-out-h')}
    ${block(t('refs.in'), le.in, 'in', nIn, 'rl-in-h')}
    ${unc && unc.length ? html`<details class="rl-unc"><summary>${t('refs.uncertainList', { n: unc.length })}</summary><ul class="rl-items">
      ${unc.map((r) => html`<li class="rl-item"><div class="rl-cite"><span lang=${ctx.lang}>${r.text}</span> <span class="rl-src">${t('refs.list.from', { cite: sourceCite(ctx, r, { withAbbr: false }) })}</span></div>
        ${r.why ? html`<p class="rl-why">${t('refs.why', { why: r.whyCode && r.whyCode !== 'other' ? t('refs.whyCode.' + r.whyCode) : r.why })}</p>` : null}
        <p class="rl-ex"><${Excerpt} ex=${refExcerpt(ctx, r, 70)} lang=${ctx.lang} /></p></li>`)}
    </ul></details>` : null}
  </div>`;
}

// ------------------------------------------------------------ Bereich «Verweise» der Leiste
export function RefsPanel({ data, unitId, k, lang, stageId }) {
  const unitLevel = !k || k === '*';
  const [scope, setScope] = useState('key');
  const [dlg, setDlg] = useState(false);
  const [view, setView] = useState(() => refsSetting('refsView', 'list'));
  const st = useRefsCtx(data, lang, stageId);
  const key = unitLevel || scope === 'unit' ? null : k;
  const graph = useMemo(() => (st.status === 'ready' ? egoGraph(st.ctx, unitId, key, LIMITS_PANEL) : null), [st, unitId, key]);
  const full = useMemo(() => (st.status === 'ready' && view === 'list' ? egoGraph(st.ctx, unitId, key, null) : null), [st, unitId, key, view]);
  const unc = useMemo(() => (st.status === 'ready' ? uncertainRefs(st.ctx, unitId, key) : []), [st, unitId, key]);
  const boxRef = useRef();
  const w = useWidth(boxRef);
  useFontsReady();
  const pick = (v) => { setView(v); setRefsSetting('refsView', v); };
  const openBtn = useRef();
  return html`<div class="rn-panel" data-scope=${key ? 'key' : 'unit'}>
    <div class="rn-tools">
      <${Seg} size="sm" label=${t('refs.view')} value=${view} onChange=${pick} options=${[{ value: 'list', label: t('refs.list.label') }, { value: 'net', label: t('refs.net') }]} />
      <button type="button" class="btn btn-tertiary btn-sm rn-open" ref=${openBtn} disabled=${st.status !== 'ready'} onClick=${() => setDlg(true)}><${Icon} name="maximize" />${t('refs.enlarge')}</button>
      ${unitLevel ? null : html`<div class="rn-scope"><span class="tool-label" id="lbl-rn-scope">${t('refs.scope.label')}</span>
        <${Seg} size="sm" labelledby="lbl-rn-scope" value=${scope} onChange=${setScope} options=${[{ value: 'key', label: centerCite(data, unitId, k) }, { value: 'unit', label: wholeLabel(data, unitId) }]} /></div>`}
    </div>
    <p class="rn-stage">${t('refs.stageNote', { date: fmtDate(data.stageDate(stageId)) })}</p>
    <div ref=${boxRef} class="rn-box">
      ${st.status === 'loading' ? html`<p class="muted rn-loading" role="status">${t('refs.loading')}</p>`
        : st.status === 'none' ? html`<${Notice} kind="info">${t('refs.noIndex')}</${Notice}>`
        : st.status === 'error' ? html`<${Notice} kind="error">${t('refs.error')}</${Notice}>`
        : html`
          ${graph.stats.refs === 0 ? html`<p class="muted rn-empty">${t('refs.none')}</p>`
            : view === 'net' ? html`<${EgoNet} ctx=${st.ctx} graph=${graph} width=${w} mode="panel" centerLabel=${centerCite(data, unitId, key)} onMore=${() => setDlg(true)} />`
            : html`<${RefsList} ctx=${st.ctx} graph=${full} unc=${unc} />`}
          ${graph.stats.uncertain ? html`<p class="rn-unc">${t('refs.uncertainNote', { n: graph.stats.uncertain })}</p>` : null}
          ${view === 'net' && graph.stats.refs ? html`<${RefsLegend} missing=${true} />` : null}`}
    </div>
    ${dlg && st.status === 'ready' ? html`<${RefsDialog} data=${data} ctx=${st.ctx} unitId=${unitId} k=${unitLevel ? null : k} initialScope=${key ? 'key' : 'unit'} stageId=${stageId} lang=${lang} onClose=${() => setDlg(false)} />` : null}
  </div>`;
}

// ------------------------------------------------------------ Dialog «Netz vergrössern»
export function RefsDialog({ data, ctx, unitId, k, initialScope = 'key', stageId, lang, onClose }) {
  const [scope, setScope] = useState(k ? initialScope : 'unit');
  const [busy, setBusy] = useState(false);
  const key = k && scope === 'key' ? k : null;
  const graph = useMemo(() => egoGraph(ctx, unitId, key, null), [ctx, unitId, key]);
  const boxRef = useRef();
  const w = useWidth(boxRef);
  useFontsReady();
  const title = cap(cite(data.unitMeta(unitId, uiLang()), key, uiLang(), data.abbr(uiLang())));
  const exportPng = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ex = await import('../export.js');
      await ex.exportPng(data, { kind: 'refnet', unit: unitId, key, lang, stage: stageId, ctx, w: data.id, format: 'a4', ui: uiLang() });
      toast(t('export.done', { kind: 'PNG' }), 'success', 3000);
    } catch (e) { console.error(e); toast(t('export.failed', { msg: e.message || String(e) }), 'error'); }
    finally { setBusy(false); }
  };
  return html`<${Dialog} labelId="rd-title" kicker=${t('refs.netTitle')} title=${title} onClose=${onClose} className="rd-net"
    footer=${html`<button type="button" class="btn btn-tertiary rd-btn" onClick=${onClose}>${t('refs.dlg.close')}</button><button type="button" class="btn btn-primary rd-btn" id="rd-png" aria-disabled=${busy ? 'true' : undefined} onClick=${exportPng}><${Icon} name="download" />${busy ? t('export.busy') : t('refs.exportPng')}</button>`}>
    <div class="rn-tools">
      ${k ? html`<div class="rn-scope"><span class="tool-label" id="lbl-rd-scope">${t('refs.scope.label')}</span>
        <${Seg} size="sm" labelledby="lbl-rd-scope" value=${scope} onChange=${setScope} options=${[{ value: 'key', label: centerCite(data, unitId, k) }, { value: 'unit', label: wholeLabel(data, unitId) }]} /></div>` : null}
      <p class="rn-stage">${t('refs.stageNote', { date: fmtDate(data.stageDate(stageId)) })} · ${t('card.legalText', { lang: lang.toUpperCase() })}</p>
    </div>
    <div ref=${boxRef} class="rn-box">
      ${graph.stats.refs === 0 ? html`<p class="muted rn-empty">${t('refs.none')}</p>` : w ? html`<${EgoNet} ctx=${ctx} graph=${graph} width=${w} mode="dialog" centerLabel=${centerCite(data, unitId, key)} onNav=${onClose} />` : null}
    </div>
    ${graph.stats.uncertain ? html`<p class="rn-unc">${t('refs.uncertainNote', { n: graph.stats.uncertain })}</p>` : null}
    <${RefsLegend} missing=${true} />
  </${Dialog}>`;
}
