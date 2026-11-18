// Bibliothek (Startansicht): Liste der Erlasse, Suche auf Fedlex, Hinzufügen mit Fortschritt und Abbruch,
// Aktualisieren und Entfernen je Erlass, Projektdatei sichern und laden.
import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { go } from '../../state.js';
import { Icon, Notice, HelpLink, ExtLink } from '../../ui/common.js';
import { core, pickLang, langOf } from '../../data.js';
import { libraryStore, jobStore, saveWork, removeWork, hasWork, isEmbedded, toast, projectData, importProject } from '../../app.js';
import { fmtDate } from '../../lib/format.js';
import { t, uiLang } from '../../lib/i18n.js';

const LANGS = ['de', 'fr', 'it'];
const srL = (sr, l = uiLang()) => (sr ? `${l === 'de' ? 'SR' : 'RS'} ${sr}` : '');
const abbrOf = (s, l = uiLang()) => (s.abbr && (s.abbr[l] || s.abbr.de)) || srL(s.sr, l) || s.id;

/** Fehlermeldung in Worten (kein Netz, Erlass ohne XML, HTTP, Abbruch). */
export function errorText(e) {
  if (!e) return '';
  if (e.name === 'AbortError') return t('lib.err.aborted');
  const code = (e.code === 'no-xml' ? 'noXml' : e.code) || (/^network/.test(e.message) ? 'network' : /^noXml/.test(e.message) ? 'noXml' : /^notFound/.test(e.message) ? 'notFound' : /^HTTP/.test(e.message) ? 'http' : null);
  if (code === 'network' || (e instanceof TypeError && /fetch|network/i.test(e.message))) return t('lib.err.network');
  if (code === 'noXml') return t('lib.err.noXml');
  if (code === 'notFound') return t('lib.err.notFound');
  if (code === 'http' || code === 'download') return t('lib.err.http', { msg: e.message });
  return t('lib.err.other', { msg: e.message || String(e) });
}

export function StatusTagW({ status }) {
  if (!status) return null;
  const cls = status === 'inForce' ? 'wst-ok' : status === 'notYetInForce' ? 'wst-future' : 'wst-off';
  return html`<span class=${'tag wst ' + cls}>${t('lib.status.' + status)}</span>`;
}

/** Fortschritt eines Abrufs mit Abbruch */
export function JobProgress({ job }) {
  if (!job) return null;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const label = job.label === 'meta' ? t('lib.job.meta') : job.label === 'files' ? t('lib.job.files', { done: job.done, total: job.total }) : job.label === 'parse' ? t('lib.job.parse', { done: job.done, total: job.total }) : job.label === 'build' ? t('lib.job.build') : t('lib.job.meta');
  return html`<div class="job" role="status" aria-live="polite">
    <div class="job-head"><b>${job.kind === 'update' ? t('lib.job.updating', { name: job.name }) : t('lib.job.adding', { name: job.name })}</b><span>${label}</span></div>
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct} aria-label=${label}><span class="progress-bar" style=${{ width: (job.label === 'meta' ? 4 : pct) + '%' }}></span></div>
    <button type="button" class="btn btn-tertiary btn-sm" id="btn-job-cancel" onClick=${() => job.controller && job.controller.abort()}><${Icon} name="close" />${t('lib.job.cancel')}</button>
  </div>`;
}

const PHASE = { meta: 'meta', download: 'files', files: 'files', parse: 'parse', build: 'build' };

/** Lädt einen Erlass von Fedlex (neu oder aktualisiert) und speichert ihn lokal. */
export async function runLoad({ id, name, langs, kind = 'add', bundle = null }) {
  if (jobStore.get()) { toast(t('lib.job.busy'), 'warning'); return null; }
  const controller = new AbortController();
  const set = (p) => jobStore.set((j) => (j ? { ...j, ...p } : j));
  jobStore.set({ kind, id, name, done: 0, total: 0, label: 'meta', controller });
  try {
    const opts = { fetch: (u, o) => window.fetch(u, o), DOMParser: window.DOMParser, langs, signal: controller.signal, onProgress: (p) => set({ done: p.done || 0, total: p.total || 0, label: PHASE[p.phase || p.label] || p.phase || p.label }) };
    let result;
    if (kind === 'update' && bundle) result = await core.updateWork(bundle, opts);
    else result = { bundle: await core.loadWork(id, opts) };
    if (!result || !result.bundle || !result.bundle.work) throw new Error('empty');
    await saveWork(result.bundle);
    jobStore.set(null);
    toast(kind === 'update' ? t('lib.job.updated', { name }) : t('lib.job.added', { name }), 'success', 5000);
    return result;
  } catch (e) {
    jobStore.set(null);
    if ((e && e.name === 'AbortError') || controller.signal.aborted) { toast(t('lib.err.aborted'), 'info', 4000); return null; }
    console.warn(e);
    throw e;
  }
}

function Search() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [langs, setLangs] = useState(LANGS);
  const [addErr, setAddErr] = useState(null);
  const job = jobStore.use();
  libraryStore.use();
  const ctl = useRef(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    if (ctl.current) ctl.current.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await core.searchWorks(q.trim(), { fetch: (u, o) => window.fetch(u, o), signal: c.signal });
      setRes(r || []);
    } catch (ex) { if (ex.name !== 'AbortError') setErr(errorText(ex)); }
    finally { setBusy(false); }
  };
  const add = async (w) => {
    setAddErr(null);
    try {
      const r = await runLoad({ id: w.id, name: abbrOf(w), langs });
      if (r) setRes((list) => list && [...list]);
    } catch (ex) { setAddErr({ id: w.id, text: errorText(ex) }); }
  };
  const toggle = (l) => setLangs((x) => (x.includes(l) ? (x.length > 1 ? x.filter((y) => y !== l) : x) : LANGS.filter((y) => y === l || x.includes(y))));
  return html`<section class="lib-sec lib-search" aria-labelledby="ls-h">
    <h2 id="ls-h">${t('lib.search.title')}</h2>
    <p class="sec-note">${t('lib.search.note')}</p>
    <form class="lib-form" role="search" onSubmit=${submit}>
      <label class="field field-grow"><span class="field-label">${t('lib.search.label')}</span>
        <input id="lib-q" type="search" value=${q} placeholder=${t('lib.search.placeholder')} onInput=${(e) => setQ(e.target.value)} /></label>
      <button type="submit" class="btn btn-primary" id="btn-lib-search" disabled=${busy || !q.trim()}><${Icon} name="search" />${busy ? t('lib.search.busy') : t('lib.search.submit')}</button>
      <fieldset class="lib-langs"><legend class="field-label">${t('lib.search.langs')}</legend>
        ${LANGS.map((l) => html`<label class="check"><input type="checkbox" checked=${langs.includes(l)} onChange=${() => toggle(l)} />${l.toUpperCase()}</label>`)}
      </fieldset>
    </form>
    <p class="hint"><${Icon} name="info" />${t('lib.search.netHint')}</p>
    ${err ? html`<${Notice} kind="error" title=${t('lib.err.title')}>${err}</${Notice}>` : null}
    <${JobProgress} job=${job} />
    ${addErr ? html`<${Notice} kind="error" title=${t('lib.err.addTitle')}>${addErr.text}</${Notice}>` : null}
    ${res ? html`<div class="lib-results" aria-live="polite">
      <p class="search-sum">${res.length ? t('lib.search.found', { n: res.length }) : t('lib.search.none')}</p>
      ${res.length ? html`<div class="tbl-scroll"><table class="tbl-data lib-res-table">
        <thead><tr><th scope="col">${t('lib.col.abbr')}</th><th scope="col">${t('lib.col.title')}</th><th scope="col">${t('lib.col.status')}</th><th scope="col">${t('lib.col.versions')}</th><th scope="col"><span class="sr">${t('lib.col.action')}</span></th></tr></thead>
        <tbody>${res.map((w) => {
          const have = hasWork(w.id);
          return html`<tr class=${w.status && w.status !== 'inForce' ? 'is-off' : ''} data-work=${w.id}>
            <td class="nw"><b>${abbrOf(w)}</b><br /><span class="small mono">${srL(w.sr)}</span></td>
            <td><span lang=${langOf(w.title)}>${pickLang(w.title) || w.id}</span><br /><${ExtLink} href=${w.eli} className="small">${t('lib.onFedlex')}</${ExtLink}></td>
            <td><${StatusTagW} status=${w.status} /></td>
            <td class="small">${t('lib.versionsN', { n: w.versions })}<br />${w.xmlVersions ? t('lib.xmlFrom', { n: w.xmlVersions, date: fmtDate(w.xmlFrom) }) : html`<span class="warn-text">${t('lib.noXml')}</span>`}</td>
            <td class="nw">${have
              ? html`<button type="button" class="btn btn-quiet btn-sm" onClick=${() => go({ view: 'uebersicht', w: w.id, u: null, k: null, s: null, a: null, b: null, act: null, q: null })}><${Icon} name="book" />${t('lib.open')}</button>`
              : html`<button type="button" class="btn btn-secondary btn-sm btn-add" disabled=${!w.xmlVersions || !!job} title=${!w.xmlVersions ? t('lib.noXml') : t('lib.addTip', { langs: langs.map((l) => l.toUpperCase()).join(', ') })} onClick=${() => add(w)}><${Icon} name="plus" />${t('lib.add')}</button>`}
              ${addErr && addErr.id === w.id ? html`<br /><span class="small warn-text">${t('lib.err.failed')}</span>` : null}</td>
          </tr>`;
        })}</tbody>
      </table></div>` : null}
    </div>` : null}
  </section>`;
}

function ProjectFile() {
  const fileRef = useRef();
  const save = async () => {
    try {
      const p = await projectData();
      const blob = new Blob([JSON.stringify(p)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `SR-Navigator_Projekt_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      toast(t('lib.project.saved', { n: p.works.length }), 'success', 4000);
    } catch (e) { toast(t('lib.project.saveFailed', { msg: e.message }), 'error'); }
  };
  const load = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const n = await importProject(obj);
      toast(t('lib.project.loaded', { n }), 'success', 5000);
    } catch (ex) { toast(t('lib.project.loadFailed', { msg: ex.message }), 'error'); }
  };
  return html`<section class="lib-sec" aria-labelledby="lp-h">
    <h2 id="lp-h">${t('lib.project.title')}</h2>
    <p class="sec-note">${t('lib.project.note')}</p>
    <div class="tool-cluster">
      <button type="button" class="btn btn-tertiary" id="btn-project-save" onClick=${save}><${Icon} name="save" />${t('lib.project.save')}</button>
      <button type="button" class="btn btn-tertiary" id="btn-project-load" onClick=${() => fileRef.current.click()}><${Icon} name="upload" />${t('lib.project.load')}</button>
      <input type="file" accept=".json,application/json" ref=${fileRef} class="sr" tabindex="-1" aria-hidden="true" onChange=${load} />
    </div>
  </section>`;
}

function WorkRow({ e }) {
  const s = e.summary || { id: e.id };
  const l = uiLang();
  const confirmRemove = async () => {
    const msg = e.embedded ? t('lib.revertConfirm', { name: abbrOf(s) }) : t('lib.removeConfirm', { name: abbrOf(s) });
    if (!window.confirm(msg)) return;
    await removeWork(e.id);
    toast(e.embedded ? t('lib.reverted', { name: abbrOf(s) }) : t('lib.removed', { name: abbrOf(s) }), 'success', 4000);
  };
  return html`<li class="lib-item" data-work=${e.id}>
    <div class="lib-main">
      <p class="lib-abbr"><b>${abbrOf(s)}</b> <span class="mono">${srL(s.sr)}</span> <${StatusTagW} status=${s.status} /></p>
      <p class="lib-title" lang=${langOf(s.title, l)}>${pickLang(s.title, l)}</p>
      <p class="lib-meta">
        <span>${t('lib.xmlRange', { from: fmtDate(s.xmlFrom), to: fmtDate(s.xmlTo), n: s.xmlVersions, total: s.versions })}</span>
        <span>${t('lib.fetchedOn', { date: fmtDate(s.fetched) })}</span>
        <span class=${'tag src-' + e.source}>${t('lib.source.' + e.source)}</span>
      </p>
    </div>
    <div class="lib-actions">
      <button type="button" class="btn btn-tertiary btn-open" onClick=${() => go({ view: 'uebersicht', w: e.id, u: null, k: null, s: null, a: null, b: null, act: null, q: null })}><${Icon} name="book" />${t('lib.open')}</button>
      <button type="button" class="btn btn-quiet btn-update" onClick=${() => go({ view: 'aktualisieren', w: e.id })}><${Icon} name="refresh" />${t('lib.update')}</button>
      ${e.source !== 'embedded' ? html`<button type="button" class="btn btn-quiet btn-remove" onClick=${confirmRemove}><${Icon} name=${e.embedded ? 'undo' : 'trash'} />${e.embedded ? t('lib.revert') : t('lib.remove')}</button>` : null}
    </div>
  </li>`;
}

export function LibraryView() {
  const list = libraryStore.use();
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, []);
  return html`<div class="view view-library" ref=${ref}><main class="wide narrow-l" id="main" tabindex="-1">
    <header class="unit-head page-head"><p class="unit-label">${t('nav.bibliothek')}</p><h1 class="unit-title">${t('lib.title')}</h1><${HelpLink} sec="bibliothek" /></header>
    <p class="ov-lead">${t('lib.lead')}</p>
    <section class="lib-sec" aria-labelledby="ll-h">
      <h2 id="ll-h">${t('lib.listTitle', { n: list.length })}</h2>
      <ul class="lib-list">${list.map((e) => html`<${WorkRow} e=${e} key=${e.id} />`)}</ul>
      ${list.some((e) => isEmbedded(e.id)) ? html`<p class="hint"><${Icon} name="info" />${t('lib.embeddedHint')}</p>` : null}
    </section>
    <${Search} />
    <${ProjectFile} />
  </main></div>`;
}
