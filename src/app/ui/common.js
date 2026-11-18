// Generische Bausteine der Oberfläche.
//
// Schaltflächen-System (styles.css, styles-sr.css):
//   .btn.btn-primary    gefüllt (Akzent), Hauptaktion einer Ansicht
//   .btn.btn-secondary  Rahmen, wichtige Aktion
//   .btn.btn-tertiary   heller Grund mit Rahmen und Icon, Nebenaktion (nie nackter Text)
//   .btn-sm             32 px hoch (Standard 40 px)
//   .btn-icon           quadratisch mit Rahmen; .btn-icon.is-bare ohne Rahmen (nur Schliessen-Kreuz)
//   .link               Textlink im Fliesstext (unterstrichen)
//   Seg                 segmentierter Umschalter (aria-pressed)
//   .chip, .tag         nicht interaktive Kennzeichnungen (Herkunft, Status); button.chip ist interaktiv
import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, uiLang } from '../lib/i18n.js';
import { go } from '../state.js';
import { safeInline, titleInline } from '../lib/sanitize.js';
import { fmtDate } from '../lib/format.js';

export const Icon = ({ name, label }) => html`<svg class="ico" aria-hidden=${label ? undefined : 'true'} role=${label ? 'img' : undefined} aria-label=${label}><use href=${'#' + name}></use></svg>`;

/** Randmarke der Herkunft (neutral; gewählt rot; künftig beige schraffiert). */
export function OriginSwatch({ kind }) {
  return html`<span class=${'osw osw-' + kind} aria-hidden="true"></span>`;
}

/** Herkunft als Kürzel ("AS 2018 3171"), ohne Farbe je Erlass. */
export function OriginChip({ data, act, small, onClick, active, selected, title }) {
  const base = data.isBase(act);
  const future = !base && data.isFutureAct(act);
  const kind = selected ? 'selected' : base ? 'base' : future ? 'future' : 'amended';
  const label = base ? t('act.baseCode') : data.actCode(act);
  const name = data.actName(act);
  const tip = title || [name !== label ? name : '', future ? t('status.future') : ''].filter(Boolean).join(', ') || label;
  const inner = html`<${OriginSwatch} kind=${kind} /><span class="chip-code">${label}</span>${future ? html`<span class="chip-note">${t('status.futureShort')}</span>` : null}`;
  const cls = 'chip ochip' + (future ? ' chip-pending' : '') + (active ? ' is-active' : '') + (small ? ' chip-sm' : '');
  return onClick
    ? html`<button type="button" class=${cls + ' chip-btn'} title=${tip} aria-pressed=${active ? 'true' : 'false'} onClick=${onClick}>${inner}</button>`
    : html`<span class=${cls} title=${tip}>${inner}</span>`;
}

/** Status einer Fassung: in Kraft, frühere Fassung, beschlossen, noch nicht in Kraft (schraffiert). */
export function StageStatusTag({ data, stageId }) {
  const st = data.stageStatus(stageId);
  if (!st.label) return null;
  return html`<span class=${'tag stag stag-' + st.kind}>${st.label}</span>`;
}

/** Segmentierter Umschalter */
export function Seg({ value, options, onChange, label, labelledby, size }) {
  return html`<div class=${'seg' + (size === 'sm' ? ' seg-sm' : '')} role="group" aria-label=${labelledby ? undefined : label} aria-labelledby=${labelledby}>
    ${options.map((o) => html`<button type="button" aria-pressed=${value === o.value ? 'true' : 'false'} disabled=${o.disabled} title=${o.title} aria-label=${o.aria} lang=${o.lang} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`;
}

export function Field({ label, children, wide }) {
  return html`<label class=${'field' + (wide ? ' field-wide' : '')}><span class="field-label">${label}</span>${children}</label>`;
}

export function Notice({ kind = 'info', title, children, icon }) {
  return html`<div class=${'notice notice-' + kind} role=${kind === 'error' ? 'alert' : 'note'}>
    <${Icon} name=${icon || (kind === 'warning' || kind === 'computed' || kind === 'error' ? 'warning' : kind === 'success' ? 'check-circle' : 'info')} />
    <div>${title ? html`<strong>${title}</strong> ` : null}${children}</div>
  </div>`;
}

/** Aufklappmenü (Exportformate) */
export function Menu({ label, icon, items, align = 'left', className = '', variant = 'secondary', small }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') { setOpen(false); const b = ref.current && ref.current.querySelector('button'); if (b) b.focus(); } };
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k);
    const first = ref.current && ref.current.querySelector('[role="menuitem"]');
    if (first) first.focus();
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const i = list.indexOf(document.activeElement);
    const n = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    if (n) { e.preventDefault(); n.focus(); }
  };
  return html`<div class=${'menu ' + className} ref=${ref} onKeyDown=${onKey}>
    <button type="button" class=${'btn btn-' + variant + (small ? ' btn-sm' : '')} aria-haspopup="true" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>
      ${icon ? html`<${Icon} name=${icon} />` : null}${label}<${Icon} name="chevron-down" />
    </button>
    ${open && html`<div class=${'menu-pop menu-' + align} role="menu">
      ${items.map((it) => it.sep ? html`<div class="menu-sep" role="separator">${it.label || ''}</div>` : html`<button type="button" role="menuitem" class="menu-item" onClick=${() => { setOpen(false); it.onClick(); }}>${it.label}${it.hint ? html`<span class="menu-hint">${it.hint}</span>` : null}</button>`)}
    </div>`}
  </div>`;
}

export function Empty({ title, children }) {
  return html`<div class="empty"><p class="empty-title">${title}</p>${children ? html`<div class="empty-body">${children}</div>` : null}</div>`;
}

/** Titel einer Einheit als Überschrift: Auszeichnung gerendert (ohne doppelte Fettung). */
export function UnitTitle({ ti, lang, tag = 'h1' }) {
  const T = tag;
  if (ti.html) return html`<${T} class="unit-title" lang=${lang} dangerouslySetInnerHTML=${{ __html: titleInline(ti.html) }} />`;
  if (ti.text) return html`<${T} class="unit-title" lang=${lang}>${ti.text}</${T}>`;
  return html`<${T} class="unit-title"></${T}>`;
}
export { safeInline };

/** Titel als Text (Inhaltsverzeichnis, Listen) in der Sprache des Rechtstexts. */
export function TitleText({ ti, lang, className = '' }) {
  if (ti && ti.text) return html`<span class=${className} lang=${lang} title=${ti.text}>${ti.text}</span>`;
  return null;
}

/** Kontextbezogener Einstieg in die Anleitung */
export function HelpLink({ sec, label, view = 'anleitung' }) {
  const text = label || t('help.open');
  return html`<a class="btn-icon help-link" href=${'#/' + view + '?sec=' + sec} title=${text} aria-label=${text}
    onClick=${(e) => { e.preventDefault(); go({ view, sec }); }}><${Icon} name="help" /></a>`;
}

/** Umschalter Sprache des Rechtstexts (unabhängig von der Oberflächensprache) */
export function LegalLangSwitch({ data, route, field }) {
  const opts = data.langs.map((l) => ({ value: l, label: l.toUpperCase(), title: t('lang.name.' + l), aria: t('lang.name.' + l) }));
  const cur = data.langs.includes(route.l) ? route.l : data.langs[0];
  const onChange = (l) => go({ l, l2: route.l2 === l ? data.langs.find((x) => x !== l) : route.l2 }, { replace: true });
  return html`<div class=${field ? 'field' : 'tool-group'}>
    <span class=${field ? 'field-label' : 'tool-label'} id="lbl-legal">${t('lang.legal')}</span>
    <${Seg} labelledby="lbl-legal" value=${cur} onChange=${onChange} options=${opts} />
  </div>`;
}

/** Externer Link (Fedlex) in neuem Tab */
export function ExtLink({ href, children, className = '' }) {
  if (!href) return html`<span class=${className}>${children}</span>`;
  return html`<a class=${'ext ' + className} href=${href} target="_blank" rel="noopener noreferrer">${children}<${Icon} name="external" /><span class="sr">${t('common.newTab')}</span></a>`;
}

/** Datum ausgeschrieben */
export const D = ({ iso }) => html`<span class="nw">${fmtDate(iso)}</span>`;

export const curLang = uiLang;
