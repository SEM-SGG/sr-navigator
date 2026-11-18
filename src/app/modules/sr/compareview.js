// Vergleich: zwei Stände (nebeneinander oder Redline) oder zwei Sprachen im selben Stand.
import { html } from 'htm/preact';
import { go } from '../../state.js';
import { Seg, Notice, Icon, HelpLink, LegalLangSwitch } from '../../ui/common.js';
import { compareRows, CompareTable, compareStats } from '../../ui/compare.js';
import { ExportMenu } from '../../ui/exportmenu.js';
import { currentUnit, uiCite, UnitSelect, KeySelect, StageSelect, legalLang } from './read.js';
import { fmtDate } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';

export function defaultPair(data, unitId, lang) {
  const ch = data.unitChangeStages(unitId, lang);
  const past = ch.filter((s) => data.stageIndex(s) <= data.stageIndex(data.current.id));
  const b = past.length ? past[past.length - 1] : ch.length ? ch[ch.length - 1] : null;
  if (b) return { a: data.prevStage(b).id, b };
  return { a: data.first.id, b: data.current.id };
}

export function CompareView({ data, route }) {
  const lang = legalLang(data, route);
  const unitId = currentUnit(data, route);
  const mode = route.cm === 'sprache' ? 'sprache' : 'stand';
  const def = defaultPair(data, unitId, lang);
  const a = route.a && data.stage(route.a) ? route.a : def.a;
  const b = route.b && data.stage(route.b) ? route.b : def.b;
  const la = lang;
  const lb = route.l2 && route.l2 !== la && data.langs.includes(route.l2) ? route.l2 : data.langs.find((x) => x !== la) || la;
  const key = route.k && route.k !== '*' ? route.k : null;
  const stA = mode === 'sprache' ? (route.b && data.stage(route.b) ? route.b : data.current.id) : a;
  const opts = mode === 'sprache' ? { a: stA, b: stA, la, lb, key, mode } : { a, b, la: lang, lb: lang, key, mode };
  const res = compareRows(data, unitId, opts);
  const st = compareStats(res.rows);
  const spec = mode === 'sprache'
    ? { kind: 'compare', cm: 'sprache', unit: unitId, key, a: stA, la, lb, lay: 'side', sc: 'full' }
    : { kind: 'compare', cm: 'stand', unit: unitId, key, a, b, lang, lay: route.lay, sc: route.sc };
  const swapped = mode === 'stand' && data.stageIndex(a) > data.stageIndex(b);
  const gaps = mode === 'stand' ? data.stages.filter((s) => data.stageIndex(s.id) > Math.min(data.stageIndex(a), data.stageIndex(b)) && data.stageIndex(s.id) <= Math.max(data.stageIndex(a), data.stageIndex(b))).reduce((n, s) => n + (s.gap || 0), 0) : 0;
  const future = (mode === 'sprache' ? [stA] : [a, b]).filter((s) => data.isFuture(s));
  const langName = (l) => `${t('lang.name.' + l)} (${l.toUpperCase()})`;
  const headA = mode === 'sprache' ? langName(la) : t('compare.headOld', { name: data.stageName(a) });
  const headB = mode === 'sprache' ? langName(lb) : t('compare.headNew', { name: data.stageName(b) });
  return html`<div class="view view-compare">
    <main class="wide" id="main" tabindex="-1">
      <div class="view-tools">
        <div class="toolbar">
          <div class="field"><span class="field-label" id="lbl-cm">${t('compare.kind')}</span>
            <${Seg} labelledby="lbl-cm" value=${mode} onChange=${(v) => go({ cm: v }, { replace: true })} options=${[{ value: 'stand', label: t('compare.byStage') }, { value: 'sprache', label: t('compare.byLang') }]} /></div>
          <label class="field"><span class="field-label">${t('common.unit')}</span>
            <${UnitSelect} id="cmp-unit" data=${data} value=${unitId} lang=${lang} onChange=${(u) => { const d = defaultPair(data, u, lang); go({ u, k: null, a: d.a, b: d.b }, { replace: true }); }} /></label>
          <label class="field"><span class="field-label">${t('common.provision')}</span>
            <${KeySelect} id="cmp-key" data=${data} unitId=${unitId} lang=${lang} value=${key || '*'} onChange=${(v) => go({ k: v === '*' ? null : v }, { replace: true })} /></label>
          <span class="spacer"></span>
          <div class="tool-cluster">${mode === 'stand' ? html`<${LegalLangSwitch} data=${data} route=${route} field />` : null}<${HelpLink} sec=${mode === 'sprache' ? 'sprachvergleich' : 'vergleich'} /></div>
        </div>
        <div class="toolbar">
          ${mode === 'stand' ? html`
            <div class="tool-cluster">
            <label class="field"><span class="field-label">${t('compare.oldStage')}</span><${StageSelect} id="cmp-a" data=${data} value=${a} unitId=${unitId} lang=${lang} onChange=${(v) => go({ a: v }, { replace: true })} /></label>
            <button type="button" class="btn-icon btn-swap" aria-label=${t('compare.swap')} title=${t('compare.swap')} onClick=${() => go({ a: b, b: a }, { replace: true })}><${Icon} name="swap" /></button>
            <label class="field"><span class="field-label">${t('compare.newStage')}</span><${StageSelect} id="cmp-b" data=${data} value=${b} unitId=${unitId} lang=${lang} onChange=${(v) => go({ b: v }, { replace: true })} /></label>
            </div>
          ` : html`
            <label class="field"><span class="field-label">${t('common.stage')}</span><${StageSelect} id="cmp-s" data=${data} value=${stA} unitId=${unitId} lang=${lang} onChange=${(v) => go({ b: v }, { replace: true })} /></label>
            <label class="field"><span class="field-label">${t('compare.left')}</span><select id="cmp-la" value=${la} onChange=${(e) => go({ l: e.target.value }, { replace: true })}>${data.langs.map((l) => html`<option value=${l}>${t('lang.name.' + l)}</option>`)}</select></label>
            <label class="field"><span class="field-label">${t('compare.right')}</span><select id="cmp-lb" value=${lb} onChange=${(e) => go({ l2: e.target.value }, { replace: true })}>${data.langs.filter((l) => l !== la).map((l) => html`<option value=${l}>${t('lang.name.' + l)}</option>`)}</select></label>
            <span class="spacer"></span>
            <${ExportMenu} data=${data} spec=${spec} />
          `}
        </div>
        ${mode === 'stand' ? html`<div class="toolbar">
          <div class="field"><span class="field-label" id="lbl-lay">${t('compare.layout')}</span><${Seg} labelledby="lbl-lay" value=${route.lay} onChange=${(v) => go({ lay: v }, { replace: true })} options=${[{ value: 'side', label: t('compare.sideBySide') }, { value: 'redline', label: t('compare.redline') }]} /></div>
          <div class="field"><span class="field-label" id="lbl-sc">${t('compare.scope')}</span><${Seg} labelledby="lbl-sc" value=${route.sc} onChange=${(v) => go({ sc: v }, { replace: true })} options=${[{ value: 'changed', label: t('compare.onlyChanges') }, { value: 'full', label: t('compare.fullText') }]} /></div>
          <span class="spacer"></span>
          <${ExportMenu} data=${data} spec=${spec} />
        </div>` : null}
      </div>

      <header class="unit-head">
        <p class="unit-label">${mode === 'sprache' ? t('compare.langTitle') : t('compare.heading')}</p>
        <h1 class="unit-title">${uiCite(data, unitId, key)}</h1>
        <p class="unit-meta">
          ${mode === 'sprache'
            ? html`<span>${data.stageLabel(stA)}</span><span>${la.toUpperCase()} | ${lb.toUpperCase()}</span>`
            : html`<span>${t('compare.statChanged', { n: st.changed })}</span><span>${t('compare.statIns', { n: st.ins })}</span><span>${t('compare.statDel', { n: st.del })}</span>${res.titleChanged ? html`<span>${t('compare.titleChanged')}</span>` : null}`}
        </p>
      </header>
      <div class="unit-notes">
        ${swapped ? html`<${Notice} kind="warning">${t('compare.swapped')}</${Notice}>` : null}
        ${gaps > 0 ? html`<${Notice} kind="warning" title=${t('read.notice.gapTitle')}>${t('compare.gap', { n: gaps })}</${Notice}>` : null}
        ${future.length ? html`<${Notice} kind="future" icon="calendar" title=${t('status.future')}>${t('compare.future', { list: future.map((s) => fmtDate(data.stageDate(s))).join(', ') })}</${Notice}>` : null}
        ${mode === 'sprache' && res.rows.some((r) => r.status === 'missing') ? html`<${Notice} kind="warning">${t('compare.structureDiffers')}</${Notice}>` : null}
      </div>
      <${CompareTable} data=${data} unitId=${unitId} result=${res} layout=${route.lay} scope=${route.sc} mode=${mode} headA=${headA} headB=${headB} langA=${mode === 'sprache' ? la : lang} langB=${mode === 'sprache' ? lb : lang}
        onPick=${(k) => go({ view: 'lesen', u: unitId, k, s: mode === 'sprache' ? stA : b, m: 'stand' })} />
    </main>
  </div>`;
}
