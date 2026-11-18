// Vergleich zweier Fassungen (Stände oder Sprachen) einer Einheit, zeilenweise nach Blockschlüssel.
import { html } from 'htm/preact';
import { BlockBody, Lbl } from './blocks.js';
import { OriginChip } from './common.js';
import { diffText, markAll } from '../lib/diff.js';
import { safeInline, titleInline } from '../lib/sanitize.js';
import { t, uiLang } from '../lib/i18n.js';
import { blockSig } from '../fallback-model.js';
import { LANG_CODES } from '../lib/format.js';
import { cite } from '../lib/cite.js';

const inScope = (k, key) => !key || k === key || k.startsWith(key + '.');

/** Vereinigt zwei Blocklisten in Dokumentreihenfolge. */
export function alignBlocks(left, right) {
  const L = left || [], R = right || [];
  const rk = new Set(R.map((b) => b.k));
  const lm = new Map(L.map((b) => [b.k, b]));
  const rm = new Map(R.map((b) => [b.k, b]));
  const order = [];
  const after = new Map();
  let last = null;
  for (const b of L) {
    if (rk.has(b.k)) last = b.k;
    else { const a = after.get(last) || []; a.push(b.k); after.set(last, a); }
  }
  for (const k of after.get(null) || []) order.push(k);
  for (const b of R) { order.push(b.k); for (const k of after.get(b.k) || []) order.push(k); }
  return order.map((k) => ({ k, left: lm.get(k) || null, right: rm.get(k) || null }));
}

export function compareRows(data, unitId, { a, b, la, lb, key, mode }) {
  const va = data.version(unitId, la, a);
  const vb = data.version(unitId, lb, b);
  const left = va && !va.repealed ? va.blocks : [];
  const right = vb && !vb.repealed ? vb.blocks : [];
  const rows = alignBlocks(left, right).filter((r) => inScope(r.k, key));
  for (const r of rows) {
    if (mode === 'sprache') { r.status = r.left && r.right ? 'same' : 'missing'; continue; }
    if (!r.left) r.status = 'ins';
    else if (!r.right) r.status = 'del';
    else r.status = blockSig(r.left) === blockSig(r.right) ? 'same' : 'changed';
  }
  const titleChanged = mode !== 'sprache' && va && vb && (va.title || '') !== (vb.title || '');
  return { va, vb, rows, titleChanged };
}

export function compareStats(rows) {
  const s = { changed: 0, ins: 0, del: 0, same: 0, missing: 0 };
  for (const r of rows) s[r.status] = (s[r.status] || 0) + 1;
  return s;
}

function cellText(data, blk, other, side, status) {
  if (!blk) return null;
  if (blk.ty === 'table' || blk.ty === 'img') return html`<${BlockBody} b=${blk} compareTo=${side === 'right' && status !== 'same' ? other || null : undefined} />`;
  let h;
  if (status === 'changed') {
    const d = diffText(safeInline(other.t), safeInline(blk.t));
    h = side === 'left' ? diffText(safeInline(blk.t), safeInline(other.t)).oldHtml : d.newHtml;
  } else if (status === 'ins') h = markAll(safeInline(blk.t), 'ins');
  else if (status === 'del') h = markAll(safeInline(blk.t), 'del');
  else h = safeInline(blk.t);
  return html`<span class="bt" dangerouslySetInnerHTML=${{ __html: h }}></span>`;
}

const STATUS_KEY = { changed: 'change.amended', ins: 'change.inserted', del: 'change.deleted', missing: 'compare.missingLang' };
const statusLabel = (st) => (STATUS_KEY[st] ? t(STATUS_KEY[st]) : '');

/** Zitat innerhalb der Einheit, ohne Artikelnummer ("Abs. 3 Bst. a Ziff. i"). */
export function shortCite(data, unitId, k, lang = uiLang()) {
  const meta = data.unitMeta(unitId, lang);
  const full = cite(meta, k, lang, null);
  const head = cite(meta, null, lang, null);
  const s = full.startsWith(head) ? full.slice(head.length).replace(/^[\s,]+/, '') : full;
  return s || head;
}

export function CompareTable({ data, unitId, result, layout = 'side', scope = 'changed', mode = 'stand', headA, headB, onPick, showOrigin = true, langA, langB }) {
  const lang = uiLang();
  const { rows, va, vb, titleChanged } = result;
  const ta = titleInline(va && va.title ? va.title : ''), tb = titleInline(vb && vb.title ? vb.title : '');
  const td = titleChanged ? diffText(ta, tb) : null;
  const vis = scope === 'full' || mode === 'sprache' ? rows : rows.filter((r) => r.status !== 'same');
  const redline = layout === 'redline' && mode !== 'sprache';
  const origin = (blk) => (showOrigin && blk && blk.o && !data.isBase(blk.o) ? html`<${OriginChip} data=${data} act=${blk.o} small />` : null);
  const titleRow = (va || vb) && (titleChanged || scope === 'full' || mode === 'sprache')
    ? (redline
      ? html`<div class="cmp-row cmp-title st-${titleChanged ? 'changed' : 'same'}" role="row"><div class="cmp-k" role="rowheader"><span class="cmp-label">${t('compare.titleRow')}</span></div><div class="cmp-c legal" role="cell" lang=${langB}><span dangerouslySetInnerHTML=${{ __html: td ? td.redline : tb }}></span></div></div>`
      : html`<div class="cmp-row cmp-title st-${titleChanged ? 'changed' : 'same'}" role="row"><div class="cmp-k" role="rowheader"><span class="cmp-label">${t('compare.titleRow')}</span></div>
          <div class="cmp-c legal" role="cell" lang=${langA}><span dangerouslySetInnerHTML=${{ __html: td ? td.oldHtml : ta }}></span></div>
          <div class="cmp-c legal" role="cell" lang=${langB}><span dangerouslySetInnerHTML=${{ __html: td ? td.newHtml : tb }}></span></div></div>`)
    : null;
  return html`<div class=${'cmp ' + (redline ? 'cmp-redline' : 'cmp-side')} role="table" aria-label=${t('compare.tableLabel')}>
    <div class="cmp-row cmp-headrow" role="row">
      <div class="cmp-k" role="columnheader">${t('common.provision')}</div>
      ${redline ? html`<div class="cmp-c" role="columnheader">${headA} → ${headB}</div>` : html`<div class="cmp-c" role="columnheader">${headA}</div><div class="cmp-c" role="columnheader">${headB}</div>`}
    </div>
    ${va && va.repealed && mode !== 'sprache' ? html`<div class="cmp-row"><div class="cmp-k"></div><div class="cmp-c muted">${t('compare.repealedOld')}</div></div>` : null}
    ${vb && vb.repealed && mode !== 'sprache' ? html`<div class="cmp-row st-del"><div class="cmp-k"></div><div class="cmp-c"><span class="state-tag">${t('change.repealed')}</span> ${t('compare.repealedNew')}</div></div>` : null}
    ${!va && mode !== 'sprache' ? html`<div class="cmp-row st-ins"><div class="cmp-k"></div><div class="cmp-c"><span class="state-tag state-ins">${t('compare.new')}</span> ${t('compare.notInOld')}</div></div>` : null}
    ${titleRow}
    ${vis.length === 0 && !titleChanged ? html`<div class="cmp-row"><div class="cmp-k"></div><div class="cmp-c muted">${mode === 'sprache' ? t('compare.noBlocks') : t('compare.noDiff')}</div></div>` : null}
    ${vis.map((r) => {
      const lab = shortCite(data, unitId, r.k, lang);
      const keyCell = html`<div class="cmp-k" role="rowheader">
        ${onPick ? html`<button type="button" class="link cmp-label" onClick=${() => onPick(r.k)} title=${t('compare.openInText')}>${lab}</button>` : html`<span class="cmp-label">${lab}</span>`}
        ${statusLabel(r.status) ? html`<span class=${'state-tag st-' + r.status}>${statusLabel(r.status)}</span>` : null}
      </div>`;
      if (redline) {
        let body;
        if (r.status === 'changed' && r.right.ty !== 'table' && r.right.ty !== 'img') body = html`<span class="bt" dangerouslySetInnerHTML=${{ __html: diffText(safeInline(r.left.t), safeInline(r.right.t)).redline }}></span>`;
        else body = cellText(data, r.right || r.left, r.left, 'right', r.status);
        const rl = (r.right || r.left).l;
        return html`<div class=${'cmp-row cbrk st-' + r.status} role="row" style=${{ '--d': (r.right || r.left).d || 0 }}>${keyCell}<div class="cmp-c legal" role="cell" lang=${langB}><div class="cmp-ind"><${Lbl} l=${rl} />${body}</div>${origin(r.right)}</div></div>`;
      }
      const lLab = r.left && r.left.ty !== 'heading' ? r.left.l : null;
      const rLab = r.right && r.right.ty !== 'heading' ? r.right.l : null;
      return html`<div class=${'cmp-row cbrk st-' + r.status} role="row" style=${{ '--d': (r.right || r.left).d || 0 }}>${keyCell}
        <div class="cmp-c legal" role="cell" lang=${langA}><div class="cmp-ind"><${Lbl} l=${lLab} />${cellText(data, r.left, r.right, 'left', r.status) || html`<span class="muted">—</span>`}</div>${mode !== 'sprache' ? origin(r.left) : null}</div>
        <div class="cmp-c legal" role="cell" lang=${langB}><div class="cmp-ind"><${Lbl} l=${rLab} />${cellText(data, r.right, r.left, 'right', r.status) || html`<span class="muted">—</span>`}</div>${mode !== 'sprache' ? origin(r.right) : null}</div>
      </div>`;
    })}
  </div>`;
}

export const langHead = (l) => LANG_CODES[l] || l.toUpperCase();
