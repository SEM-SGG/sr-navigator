// Darstellung des Rechtstexts: Blöcke mit hängenden Gliederungszeichen, Herkunft am Rand und Fussnoten der Quelle.
import { html } from 'htm/preact';
import { safeInline, safeTable, safeNote, isFedlexUrl } from '../lib/sanitize.js';
import { diffText, markAll } from '../lib/diff.js';
import { cite } from '../lib/cite.js';
import { t, uiLang } from '../lib/i18n.js';
import { plain } from '../lib/format.js';
import { blockSig } from '../fallback-model.js';

/** Inhalt eines Blocks (ohne Rand und Gliederungszeichen). textHtml überschreibt den Text (Diff). */
export function BlockBody({ b, textHtml, compareTo }) {
  if (b.ty === 'table') {
    return html`<div class="tbl-wrap"><div class="tbl" dangerouslySetInnerHTML=${{ __html: safeTable(b.html || '') }}></div>
      ${compareTo !== undefined && (compareTo === null || blockSig(compareTo) !== blockSig(b)) ? html`<p class="tbl-note">${compareTo === null ? t('blocks.tableInserted') : t('blocks.tableChanged')}</p>` : null}
      ${compareTo && blockSig(compareTo) !== blockSig(b) ? html`<p class="tbl-diff" dangerouslySetInnerHTML=${{ __html: diffText(safeInline(compareTo.t), safeInline(b.t)).redline }}></p>` : null}
    </div>`;
  }
  if (b.ty === 'img') {
    const src = isFedlexUrl(b.src) ? b.src : null;
    return html`<p class="fig-missing">${t('blocks.figureMissing')}${b.t ? ': ' + plain(b.t) : ''}${src ? html` <a href=${src} target="_blank" rel="noopener noreferrer">${t('blocks.figureOpen')}</a>` : null}</p>`;
  }
  return html`<span class="bt" dangerouslySetInnerHTML=${{ __html: textHtml ?? safeInline(b.t) }}></span>`;
}

/** Gliederungszeichen (kann Auszeichnung enthalten, z. B. «a<sup>bis</sup>.»), bereinigt. */
export const Lbl = ({ l, cls = 'lbl-inline' }) => (l ? html`<span class=${cls} dangerouslySetInnerHTML=${{ __html: safeInline(l) }}></span>` : null);

/** Fussnoten der Quelle (Änderungshinweise und Fundstellen) mit Nummer der Quelle. */
export function Footnotes({ notes, lang }) {
  if (!notes.length) return null;
  return html`<ol class="fns" aria-label=${t('blocks.footnotes')} lang=${lang}>${notes.map((n) => html`<li class=${'fn fn-' + (n.kind || 'ref')} id=${'fn-' + n.id}><span class="fn-n" aria-hidden="true">${n.n}</span><span class="sr">${t('blocks.footnote', { n: n.n })}</span><span class="fn-t" dangerouslySetInnerHTML=${{ __html: safeNote(n.t) }}></span></li>`)}</ol>`;
}

/**
 * Liste der Blöcke einer Version.
 * prev: Vorgängerversion für Redline (oder null). originMarks: Herkunftsrand ein/aus. selAct: hervorgehobener Erlass.
 */
export function BlockList({ data, unitId, version, lang, prev, redline, selectedKey, onSelect, originMarks = true, selAct = null, footnotes = true, idPrefix = '' }) {
  if (!version) return null;
  const meta = data.unitMeta(unitId, uiLang());
  const blocks = version.blocks || [];
  const prevMap = redline && prev ? new Map((prev.blocks || []).map((b) => [b.k, b])) : null;
  const curKeys = new Set(blocks.map((b) => b.k));
  const rows = [];
  if (prevMap) {
    const pb = prev.blocks || [];
    const removedAfter = new Map();
    let lastKept = null;
    for (const b of pb) {
      if (curKeys.has(b.k)) lastKept = b.k;
      else { const arr = removedAfter.get(lastKept) || []; arr.push(b); removedAfter.set(lastKept, arr); }
    }
    for (const b of removedAfter.get(null) || []) rows.push({ b, removed: true });
    for (const b of blocks) {
      rows.push({ b });
      for (const r of removedAfter.get(b.k) || []) rows.push({ b: r, removed: true });
    }
  } else for (const b of blocks) rows.push({ b });

  let lastOrigin = null;
  const notes = [];
  const out = rows.map(({ b, removed }) => {
    const og = removed ? null : data.origin(b);
    const kind = !og ? 'none' : selAct && og.act === selAct ? 'selected' : og.kind;
    const showCode = originMarks && og && og.kind !== 'base' && og.act !== lastOrigin;
    if (!removed) lastOrigin = og.kind === 'base' ? null : og.act;
    let textHtml;
    let state = '';
    if (prevMap && !removed && b.ty !== 'table' && b.ty !== 'img') {
      const p = prevMap.get(b.k);
      if (!p) { textHtml = markAll(safeInline(b.t), 'ins'); state = 'ins'; }
      else if (blockSig(p) !== blockSig(b)) { textHtml = diffText(safeInline(p.t), safeInline(b.t)).redline; state = 'chg'; }
    }
    if (removed) { textHtml = markAll(safeInline(b.t), 'del'); state = 'del'; }
    const refs = [];
    if (!removed && footnotes && Array.isArray(b.fn)) for (const f of b.fn) { const id = `${idPrefix}${unitId}-${b.k}-${f.n}`; refs.push({ n: f.n, id }); notes.push({ ...f, id }); }
    const sel = selectedKey === b.k && !removed;
    const label = cite(meta, b.k, uiLang(), data.abbr(uiLang()));
    const clickable = onSelect && !removed;
    const cls = ['blk', `d${Math.min(b.d || 0, 5)}`, b.ty ? 'ty-' + b.ty : '', sel ? 'is-sel' : '', removed ? 'is-removed' : '', state ? 'st-' + state : '', kind === 'future' ? 'is-pending' : ''].filter(Boolean).join(' ');
    const onKey = (e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect && onSelect(b.k); } };
    const tip = og && og.kind !== 'base' ? `${data.actName(og.act)}${og.inForce ? ', ' + (og.kind === 'future' ? t('blocks.inForceFrom', { date: fmtD(og.inForce) }) : t('blocks.inForceSince', { date: fmtD(og.inForce) })) : ''}` : t('act.base');
    return html`<div class=${cls} data-k=${b.k} style=${{ '--d': b.d || 0 }}
        role=${clickable ? 'button' : undefined} tabindex=${clickable ? 0 : undefined}
        aria-label=${clickable ? t('blocks.openChron', { cite: label }) : undefined}
        aria-pressed=${clickable ? (sel ? 'true' : 'false') : undefined}
        onClick=${clickable ? (e) => { if (e.target.closest('a, .fnref')) return; onSelect(b.k); } : undefined} onKeyDown=${clickable ? onKey : undefined}>
      <span class=${'mark' + (originMarks && og ? ' ' + MARK[kind] : '')} lang=${uiLang()} aria-hidden=${showCode ? undefined : 'true'} title=${originMarks && og ? tip : undefined}>
        ${showCode ? html`<span class="mark-code">${data.actCode(og.act)}${kind === 'future' ? html`<span class="mark-pend">${t('status.futureShort')}</span>` : null}</span>` : null}
      </span>
      ${b.ty === 'heading'
        ? html`<div class="blk-head"><${Lbl} l=${b.l} cls="hl" /><${BlockBody} b=${b} textHtml=${textHtml} />${refs.map((r) => html`<a class="fnref" href=${'#fn-' + r.id} onClick=${jumpTo(r.id)} aria-label=${t('blocks.footnote', { n: r.n })}><sup>${r.n}</sup></a>`)}</div>`
        : html`<span class="lbl" dangerouslySetInnerHTML=${{ __html: safeInline(b.l || '') }}></span><div class="txt"><${BlockBody} b=${b} textHtml=${textHtml} compareTo=${prevMap && !removed && b.ty === 'table' ? prevMap.get(b.k) || null : undefined} />${refs.map((r) => html`<a class="fnref" href=${'#fn-' + r.id} onClick=${jumpTo(r.id)} aria-label=${t('blocks.footnote', { n: r.n })}><sup>${r.n}</sup></a>`)}${state === 'del' ? html`<span class="state-tag" lang=${uiLang()}>${t('change.deleted')}</span>` : state === 'ins' ? html`<span class="state-tag state-ins" lang=${uiLang()}>${t('change.inserted')}</span>` : null}</div>`}
      ${clickable ? html`<span class="blk-go" aria-hidden="true"><svg class="ico"><use href="#clock"></use></svg></span>` : null}
    </div>`;
  });
  return html`<div class="blocks">${out}</div>${footnotes ? html`<${Footnotes} notes=${notes} lang=${lang} />` : null}`;
}

import { fmtDate } from '../lib/format.js';
// Randmarke: Klassen aus styles.css (keine Farbe je Erlass); künftige Änderungen über .blk.is-pending schraffiert
const MARK = { base: 'is-base', amended: 'has-origin', future: 'has-origin', selected: 'has-origin is-selected', none: '' };
const fmtD = (d) => fmtDate(d);
const jumpTo = (id) => (e) => {
  e.preventDefault();
  e.stopPropagation();
  const el = document.getElementById('fn-' + id);
  if (el) { el.scrollIntoView({ block: 'nearest' }); el.classList.add('is-hit'); setTimeout(() => el.classList.remove('is-hit'), 1600); }
};
