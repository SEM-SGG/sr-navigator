// Einstieg: Sprache der Oberfläche, eingebettete Bibliothek und lokal gespeicherte Erlasse laden, Oberfläche rendern.
// Kein Netzwerkzugriff beim Start; Fedlex nur auf Knopfdruck (Bibliothek, Aktualisieren).
import { html } from 'htm/preact';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadEmbedded, coreSource } from './data.js';
import { useRoute, go, getState, normalizeHash } from './state.js';
import { toastStore, basketStore, panelStore, libraryStore, initLibrary, loadPersisted, persistBasket, toast, openWork, cachedWork, hasWork } from './app.js';
import { Icon, Seg } from './ui/common.js';
import { cardTitle, cardSubtitle, formatLabel } from './ui/card.js';
import { srModule } from './modules/sr/index.js';
import { UpdateHint } from './ui/updatehint.js';
import { autoCheck } from './update.js';
import { registerStrings, setUiLang, initialUiLang, useUiLang, t, withUiLang, uiLang, keysOf, UI_LANGS, HTML_LANG } from './lib/i18n.js';
import de from './i18n/de.js';
import fr from './i18n/fr.js';
import it from './i18n/it.js';

registerStrings('de', de);
registerStrings('fr', fr);
registerStrings('it', it);
setUiLang(initialUiLang(getState().ui), { persist: false });
document.documentElement.lang = HTML_LANG[uiLang()];

const VIEWS = srModule.views;

function Basket() {
  const items = basketStore.use();
  const { basket: open } = panelStore.use();
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const b = document.querySelector('.drawer .btn-icon'); if (b) b.focus();
    // Erlasse der Karten laden (für Titel und Export)
    Promise.all([...new Set(items.map((it) => it.w))].filter(hasWork).map(openWork)).then(() => setTick((x) => x + 1));
  }, [open, items.length]);
  if (!open) return null;
  const close = () => { panelStore.set({ basket: false }); const b = document.getElementById('btn-basket'); if (b) b.focus(); };
  const move = (i, d) => { const l = [...items]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); basketStore.set(l); persistBasket(); };
  const remove = (i) => { basketStore.set(items.filter((_, j) => j !== i)); persistBasket(); };
  const pairs = async () => {
    const out = [];
    for (const it of items) { const d = await openWork(it.w); if (d) out.push({ data: d, spec: it }); }
    return out;
  };
  const pdf = async () => {
    setBusy(true);
    try { const ex = await import('./export.js'); const p = await pairs(); await ex.exportPdf(p); toast(t('basket.pdfDone', { n: p.length }), 'success', 3000); }
    catch (e) { console.error(e); toast(t('basket.pdfFailed', { msg: e.message }), 'error'); }
    finally { setBusy(false); }
  };
  const print = async () => { const ex = await import('./export.js'); await ex.printCards(await pairs()); };
  return html`<div class="drawer-scrim" onClick=${close}></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="bk-h" onKeyDown=${(e) => e.key === 'Escape' && close()}>
    <div class="panel-head"><h2 id="bk-h" class="panel-title">${t('basket.title')}</h2><button type="button" class="btn-icon is-bare" aria-label=${t('basket.close')} title=${t('basket.close')} onClick=${close}><${Icon} name="close" /></button></div>
    <div class="panel-body">
      ${items.length === 0 ? html`<p class="muted">${t('basket.empty', { menu: t('export.label'), item: t('export.basketA4') })}</p>` : html`<ol class="bk-list">
        ${items.map((it, i) => {
          const d = cachedWork(it.w);
          let ti = it.unit, s = '';
          if (d) { try { withUiLang(it.ui, () => { ti = cardTitle(d, it); s = cardSubtitle(d, it); }); } catch { ti = it.unit; } }
          return html`<li class="bk-item"><div class="bk-text"><b>${ti}</b><span>${s}</span><span class="muted">${formatLabel(it.format)}${it.ui ? ' | ' + t('basket.cardLang', { lang: it.ui.toUpperCase() }) : ''}</span></div>
            <div class="bk-tools">
              <button type="button" class="btn-icon" aria-label=${t('basket.up')} title=${t('basket.up')} disabled=${i === 0} onClick=${() => move(i, -1)}><${Icon} name="arrow-up" /></button>
              <button type="button" class="btn-icon" aria-label=${t('basket.down')} title=${t('basket.down')} disabled=${i === items.length - 1} onClick=${() => move(i, 1)}><${Icon} name="arrow-down" /></button>
              <button type="button" class="btn-icon" aria-label=${t('basket.remove')} title=${t('basket.remove')} onClick=${() => remove(i)}><${Icon} name="trash" /></button>
            </div></li>`;
        })}
      </ol>`}
    </div>
    <div class="panel-foot">
      <button type="button" class="btn btn-primary" id="btn-basket-pdf" disabled=${!items.length || busy} onClick=${pdf}><${Icon} name="file-pdf" />${busy ? t('basket.pdfBusy') : t('basket.pdfAll')}</button>
      <button type="button" class="btn btn-tertiary" disabled=${!items.length} onClick=${print}><${Icon} name="print" />${t('basket.print')}</button>
      <button type="button" class="btn btn-tertiary" disabled=${!items.length} onClick=${() => { basketStore.set([]); persistBasket(); }}><${Icon} name="trash" />${t('basket.clear')}</button>
    </div>
  </aside>`;
}

function Toasts() {
  const list = toastStore.use();
  return html`<div class="toasts" aria-live="polite" role="status">${list.map((x) => html`<div class=${'toast toast-' + x.kind}><${Icon} name=${x.kind === 'error' || x.kind === 'warning' ? 'warning' : x.kind === 'success' ? 'check-circle' : 'info'} /><span>${x.text}</span>
    <button type="button" class="btn-icon is-bare" aria-label=${t('common.closeMsg')} title=${t('common.closeMsg')} onClick=${() => toastStore.set((l) => l.filter((y) => y.id !== x.id))}><${Icon} name="close" /></button></div>`)}</div>`;
}

function UiLangSwitch() {
  const l = useUiLang();
  return html`<div class="tool-group head-lang">
    <span class="tool-label" id="lbl-ui">${t('lang.ui')}</span>
    <${Seg} labelledby="lbl-ui" size="sm" value=${l} onChange=${(v) => { setUiLang(v); go({}, { replace: true }); }}
      options=${UI_LANGS.map((x) => ({ value: x, label: x.toUpperCase(), title: t('lang.uiName.' + x), aria: t('lang.uiName.' + x), lang: x }))} />
  </div>`;
}

/** Auswahl des Erlasses (Kürzel, SR-Nummer) als erkennbares Bedienelement. */
function WorkPicker({ route, data }) {
  const list = libraryStore.use();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') { setOpen(false); const b = ref.current && ref.current.querySelector('.btn-work'); if (b) b.focus(); } };
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k);
    const sel = ref.current && (ref.current.querySelector('[role="menuitemradio"][aria-checked="true"]') || ref.current.querySelector('[role="menuitemradio"]'));
    if (sel) sel.focus();
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const l = uiLang();
  const pick = (id) => {
    setOpen(false);
    const v = VIEWS.find((x) => x.id === route.view);
    go({ w: id, view: v && v.work ? route.view : 'uebersicht', u: null, k: null, s: null, a: null, b: null, act: null, q: null, m: 'stand', d: null });
  };
  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...ref.current.querySelectorAll('[role^="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    if (n) { e.preventDefault(); n.focus(); }
  };
  const ab = (s) => (s && s.abbr && (s.abbr[l] || s.abbr.de)) || (s && s.sr ? `SR ${s.sr}` : '');
  return html`<div class="workpicker" ref=${ref} onKeyDown=${onKey}>
    <span class="tool-label" id="lbl-work">${t('head.work')}</span>
    <button type="button" class="btn btn-tertiary btn-work" id="btn-work" aria-haspopup="true" aria-expanded=${open ? 'true' : 'false'} aria-describedby="lbl-work" onClick=${() => setOpen(!open)}>
      ${data ? html`<span class="wp-abbr">${data.abbr(l)}</span><span class="wp-sr">${data.srLabel(l)}</span>` : html`<span class="wp-abbr">${t('head.pickWork')}</span>`}
      <${Icon} name="chevron-down" />
    </button>
    ${open ? html`<div class="menu-pop menu-left wp-pop" role="menu" aria-labelledby="lbl-work">
      ${list.map((e) => html`<button type="button" role="menuitemradio" aria-checked=${route.w === e.id ? 'true' : 'false'} class="menu-item wp-item" onClick=${() => pick(e.id)}>
        <span class="wp-abbr">${ab(e.summary)}</span><span class="wp-sr">${e.summary && e.summary.sr ? (l === 'de' ? 'SR ' : 'RS ') + e.summary.sr : ''}</span>
        <span class="menu-hint" lang=${e.summary && e.summary.title && e.summary.title[l] ? l : 'de'}>${(e.summary && e.summary.title && (e.summary.title[l] || e.summary.title.de)) || ''}</span></button>`)}
      <div class="menu-sep" role="separator"></div>
      <button type="button" role="menuitem" class="menu-item" onClick=${() => { setOpen(false); go({ view: 'bibliothek' }); }}><${Icon} name="folder" /> ${t('head.toLibrary')}</button>
    </div>` : null}
  </div>`;
}

function Header({ route, data }) {
  const items = basketStore.use();
  return html`<header class="app-head">
    <a class="skip" href="#main" onClick=${(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); }}>${t('common.skip')}</a>
    <a class="brand" href="#/bibliothek" onClick=${(e) => { e.preventDefault(); go({ view: 'bibliothek' }); }}>
      <span class="brand-name"><strong><b>SR</b> Navigator</strong><span>${t('app.subtitle')}</span></span>
    </a>
    <${WorkPicker} route=${route} data=${data} />
    <span class="spacer"></span>
    <div class="head-tools">
      <${UiLangSwitch} />
      <button type="button" class="btn btn-tertiary btn-basket" id="btn-basket" onClick=${() => panelStore.set({ basket: true })}><${Icon} name="basket" />${t('basket.title')}${items.length ? html`<span class="badge" aria-label=${t('basket.count', { n: items.length })}>${items.length}</span>` : null}</button>
    </div>
  </header>
  <div class="app-subhead">
    <nav class="views" aria-label=${t('nav.views')}>
      ${VIEWS.map((v) => {
        const disabled = v.work && !route.w;
        return disabled
          ? html`<span class="views-off" aria-disabled="true" title=${t('head.needWork')}>${t(v.labelKey)}</span>`
          : html`<a href=${'#/' + v.id + (route.w ? '?w=' + route.w : '')} aria-current=${route.view === v.id ? 'page' : undefined} onClick=${(e) => { e.preventDefault(); go({ view: v.id, sec: null }); }}>${t(v.labelKey)}</a>`;
      })}
    </nav>
  </div>`;
}

function App() {
  const route = useRoute();
  const ui = useUiLang();
  const list = libraryStore.use();
  const view = VIEWS.find((v) => v.id === route.view) || VIEWS[0];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const wantId = route.w || (view.sample && list.length ? list[0].id : null);
  useEffect(() => {
    let alive = true;
    if (!wantId) { setData(null); return undefined; }
    if (!hasWork(wantId)) { setData(null); if (route.w) { toast(t('app.unknownWork', { id: route.w }), 'warning'); go({ w: null, view: 'bibliothek' }, { replace: true }); } return undefined; }
    const c = cachedWork(wantId);
    if (c) { setData(c); return undefined; }
    setLoading(true);
    openWork(wantId).then((d) => { if (alive) { setData(d); setLoading(false); } }).catch((e) => { console.error(e); if (alive) { setLoading(false); toast(t('app.openFailed', { msg: e.message }), 'error'); } });
    return () => { alive = false; };
  }, [wantId, list]);
  useEffect(() => { if (view.work && !route.w) go({ view: 'bibliothek' }, { replace: true }); }, [view.id, route.w]);
  useEffect(() => { document.title = `${t(view.labelKey)}${data && route.w ? ' ' + data.abbr(ui) : ''} | SR-Navigator`; }, [view.id, ui, data]);
  const ready = !view.work || (data && data.id === route.w);
  const workData = route.w && data && data.id === route.w ? data : null;
  const V = view.component;
  return html`<div class="app" data-ui=${ui}>
    <${Header} route=${route} data=${workData} />
    <${UpdateHint} />
    ${(window.__srMeta || {}).fixtures ? html`<div class="fixture-bar" role="note">${t('app.fixtures')}</div>` : null}
    ${ready ? html`<${V} data=${view.sample ? data : workData} route=${route} key=${view.id + (route.w || '')} />` : html`<p class="loading" role="status">${loading ? t('common.loading') : ''}</p>`}
    <${Basket} />
    <${Toasts} />
  </div>`;
}

async function boot() {
  const root = document.getElementById('app');
  normalizeHash();
  try {
    const emb = loadEmbedded();
    window.__srMeta = emb.meta;
    initLibrary(emb);
    await loadPersisted();
    render(html`<${App} />`, root);
    window.__sr = { ready: true, data: () => cachedWork(getState().w), open: openWork, i18n: { t, uiLang, keysOf }, core: coreSource, library: () => libraryStore.get() };
    setTimeout(autoCheck, 0); // Versionsprüfung nach dem ersten Rendern, blockiert den Start nicht
  } catch (e) {
    console.error(e);
    root.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'fatal';
    p.textContent = t('app.loadFailed', { msg: e.message });
    root.appendChild(p);
  }
}
boot();
