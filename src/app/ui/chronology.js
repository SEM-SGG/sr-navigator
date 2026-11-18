// Chronologie einer Bestimmung bzw. einer ganzen Einheit ab der ersten Fassung mit Wortlaut,
// dazu die Ereignisliste für die Zeit davor (ohne Wortlaut, aus Fussnoten und Metadaten).
import { html } from 'htm/preact';
import { OriginChip, StageStatusTag, ExtLink } from './common.js';
import { BlockBody, Lbl } from './blocks.js';
import { diffText, markAll } from '../lib/diff.js';
import { safeInline } from '../lib/sanitize.js';
import { cite } from '../lib/cite.js';
import { fmtDate } from '../lib/format.js';
import { changeLabel } from '../data.js';
import { t, uiLang } from '../lib/i18n.js';
import { blockSig } from '../fallback-model.js';
import { go } from '../state.js';

const uc = (data, unitId, key, abbr = true) => cite(data.unitMeta(unitId, uiLang()), key, uiLang(), abbr ? data.abbr(uiLang()) : null);

/** Zeile unter dem Kopf eines Schritts: Erlass, Inkrafttreten */
export function actMetaLine(data, act, inForce) {
  if (!act || data.isBase(act)) return t('act.base');
  const parts = [data.actName(act)];
  if (data.actCode(act) !== parts[0]) parts.push(data.actCode(act));
  if (inForce) parts.push((inForce > data.today ? t('blocks.inForceFrom', { date: fmtDate(inForce) }) : t('blocks.inForceSince', { date: fmtDate(inForce) })));
  return parts.join(' | ');
}

/** Schritte der Chronologie eines Blocks (für Anzeige und Export). */
export function blockSteps(data, unitId, lang, key) {
  const hist = data.history(unitId, lang, key);
  return hist.map((h, i) => {
    const prev = i > 0 ? hist[i - 1].block : null;
    const b = h.block;
    let textHtml = null;
    if (b && b.ty !== 'table' && b.ty !== 'img') {
      if (!prev) textHtml = i === 0 ? safeInline(b.t) : markAll(safeInline(b.t), 'ins');
      else textHtml = diffText(safeInline(prev.t), safeInline(b.t)).redline;
    } else if (!b && prev) textHtml = markAll(safeInline(prev.t), 'del');
    const origin = (b && b.o) || h.act || data.base;
    const inForce = b ? data.blockInForce(b) : null;
    return { ...h, prev, textHtml, plainHtml: b ? safeInline(b.t) : '', origin, inForce };
  });
}

function StepHead({ data, s, label }) {
  const gap = data.stage(s.stage) && data.stage(s.stage).gap;
  return html`<div class="step-head">
    <span class="step-date">${data.stageLabel(s.stage)}</span>
    <span class=${'chg chg-' + (s.change || 'none')}>${label || changeLabel(s.change === 'base' ? 'first' : s.change)}</span>
    <${StageStatusTag} data=${data} stageId=${s.stage} />
    ${gap ? html`<span class="tag tag-gap" title=${t('read.notice.gap', { n: gap })}>${t('chron.gapTag', { n: gap })}</span>` : null}
  </div>`;
}

export function BlockChronology({ data, unitId, k, lang, showDiff = true, compact = false }) {
  const steps = blockSteps(data, unitId, lang, k);
  if (!steps.length) return html`<p class="muted">${t('chron.noVersion', { cite: uc(data, unitId, k) })}</p>`;
  return html`<ol class=${'chron' + (compact ? ' chron-compact' : '')}>
    ${steps.map((s, i) => html`<li class=${'step' + (data.isFuture(s.stage) ? ' is-pending' : '') + (data.isBase(s.origin) ? ' o-base' : ' o-amended')}>
      <${StepHead} data=${data} s=${s} />
      <div class="step-meta"><${OriginChip} data=${data} act=${s.origin} small />${data.isBase(s.origin) ? null : html` <span>${actMetaLine(data, s.origin, s.inForce)}</span>`}</div>
      ${s.block && s.block.x === 'editorial' ? html`<div class="step-meta"><span class="tag tag-src" title=${t('chron.editorialTip')}>${t('chron.editorial')}</span></div>` : null}
      <div class="step-text legal" lang=${lang}>
        ${s.block ? html`<${Lbl} l=${s.block.l} />` : null}
        ${s.block && (s.block.ty === 'table' || s.block.ty === 'img')
          ? html`<${BlockBody} b=${s.block} compareTo=${i > 0 ? s.prev : undefined} />`
          : html`<span dangerouslySetInnerHTML=${{ __html: showDiff ? s.textHtml || '' : s.plainHtml || (s.prev ? safeInline(s.prev.t) : '') }}></span>`}
        ${!s.block ? html` <span class="state-tag" lang=${uiLang()}>${changeLabel(s.change)}</span>` : null}
      </div>
    </li>`)}
  </ol>`;
}

/** Änderungsschritte einer ganzen Einheit. */
export function unitSteps(data, unitId, lang) {
  const vs = data.versions(unitId, lang);
  return vs.map((v, i) => {
    const p = i > 0 ? vs[i - 1] : null;
    const items = [];
    const acts = new Set();
    if (p) {
      if (v.repealed && !p.repealed) items.push({ key: null, change: 'repealed' });
      else if (!v.repealed) {
        const pm = new Map((p.blocks || []).map((b) => [b.k, b]));
        const nm = new Map((v.blocks || []).map((b) => [b.k, b]));
        if ((v.title || '') !== (p.title || '')) items.push({ key: null, change: 'amended', title: true, html: diffText(safeInline(p.title || ''), safeInline(v.title || '')).redline });
        for (const b of v.blocks || []) {
          const o = pm.get(b.k);
          if (!o) { items.push({ key: b.k, change: 'inserted', b, html: b.ty === 'table' || b.ty === 'img' ? null : markAll(safeInline(b.t), 'ins') }); if (b.o) acts.add(b.o); }
          else if (blockSig(o) !== blockSig(b)) { items.push({ key: b.k, change: b.x === 'editorial' ? 'editorial' : 'replaced', b, prev: o, html: b.ty === 'table' || b.ty === 'img' ? null : diffText(safeInline(o.t), safeInline(b.t)).redline }); if (b.o) acts.add(b.o); }
        }
        for (const b of p.blocks || []) if (!nm.has(b.k)) items.push({ key: b.k, change: 'deleted', b, html: markAll(safeInline(b.t), 'del') });
      }
    }
    const st = data.stage(v.stage);
    const actList = acts.size ? [...acts].filter((a) => !data.isBase(a)) : (st && st.acts) || [];
    return { stage: v.stage, first: i === 0, version: v, items, acts: actList };
  }).filter((s) => s.first || s.items.length); // Versionen, die nur Fussnoten ändern, sind keine Änderung
}

export function unitStepLabel(data, s) {
  return s.first ? (s.stage === data.first.id ? t('change.first') : t('change.inserted')) : t('chron.nChanges', { n: s.items.length });
}

export function UnitChronology({ data, unitId, lang, onPick }) {
  const steps = unitSteps(data, unitId, lang);
  return html`<ol class="chron">
    ${steps.map((s) => html`<li class=${'step' + (data.isFuture(s.stage) ? ' is-pending' : '')}>
      <${StepHead} data=${data} s=${s} label=${unitStepLabel(data, s)} />
      ${s.acts.length && !s.first ? html`<div class="step-meta step-acts">${s.acts.map((a) => html`<${OriginChip} data=${data} act=${a} small />`)}</div>` : null}
      ${s.items.length ? html`<ul class="step-items">
        ${s.items.map((it) => html`<li>
          <div class="item-head">
            ${it.key && onPick ? html`<button type="button" class="link" onClick=${() => onPick(it.key)} title=${t('chron.openProvision')}>${uc(data, unitId, it.key, false)}</button>` : html`<span class="item-cite">${it.key ? uc(data, unitId, it.key, false) : it.title ? t('chron.heading') : uc(data, unitId, null, false)}</span>`}
            <span class=${'chg chg-' + it.change}>${changeLabel(it.change)}</span>
          </div>
          ${it.html != null ? html`<div class="legal item-text" lang=${lang}><${Lbl} l=${it.b && it.b.l} /><span dangerouslySetInnerHTML=${{ __html: it.html }}></span></div>` : it.b ? html`<div class="legal item-text" lang=${lang}><${BlockBody} b=${it.b} compareTo=${it.prev} /></div>` : null}
        </li>`)}
      </ul>` : null}
    </li>`)}
  </ol>`;
}

/** Ereignisse vor der ersten Fassung mit Wortlaut (key: nur diese Bestimmung und ihre Eltern bzw. Kinder). */
export function preXmlEvents(data, unitId, key) {
  const ev = data.unitEvents(unitId).filter((e) => !e.stage && e.date && e.date < data.first.date);
  if (!key) return ev;
  return ev.filter((e) => !e.key || e.key === key || key.startsWith(e.key + '.') || e.key.startsWith(key + '.'));
}

export function EventList({ data, unitId, k, lang, compact }) {
  const ev = preXmlEvents(data, unitId, k);
  const firstDate = data.first.date;
  return html`<section class=${'events' + (compact ? ' events-compact' : '')} aria-labelledby=${'ev-h-' + (compact ? 'p' : 'w')}>
    <h3 class="events-title" id=${'ev-h-' + (compact ? 'p' : 'w')}>${t('chron.events.title', { date: fmtDate(firstDate) })}</h3>
    <p class="events-note">${t('chron.events.note')}</p>
    ${ev.length ? html`<ol class="ev-list">${ev.map((e) => {
      const tl = data.versionAt(e.date);
      const pdf = tl && tl.pdf ? tl.pdf[lang] || tl.pdf.de : null;
      return html`<li class="ev">
        <span class="ev-date">${fmtDate(e.date)}</span>
        <span class="ev-what"><span class=${'chg chg-' + (e.action || 'other')}>${changeLabel(e.action || 'other')}</span>${e.key ? html` <span class="ev-cite">${uc(data, unitId, e.key, false)}</span>` : ''}</span>
        <span class="ev-act"><${ExtLink} href=${data.actUrl(e.act)}>${data.actCode(e.act)}</${ExtLink}>${data.actName(e.act) !== data.actCode(e.act) ? html` <span class="muted">${data.actName(e.act)}</span>` : null}</span>
        <span class="ev-src">${(e.src || []).map((x) => t('chron.events.src.' + x)).join(', ')}</span>
        ${pdf ? html`<span class="ev-pdf"><${ExtLink} href=${pdf}>${t('chron.events.pdf', { date: fmtDate(tl.date) })}</${ExtLink}></span>` : null}
      </li>`;
    })}</ol>` : html`<p class="muted">${t('chron.events.none')}</p>`}
  </section>`;
}

export const openChron = (unitId, key) => go({ view: 'chronik', u: unitId, k: key || '*' });
