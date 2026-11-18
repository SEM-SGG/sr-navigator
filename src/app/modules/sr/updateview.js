// Aktualisieren: auf neue Fassungen prüfen (gewählter Erlass oder alle), Ergebnis neu, geändert, unverändert, dann laden.
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { go } from '../../state.js';
import { Icon, Notice, HelpLink, ExtLink } from '../../ui/common.js';
import { core, pickLang, langOf } from '../../data.js';
import { libraryStore, jobStore, workBundle } from '../../app.js';
import { JobProgress, runLoad, errorText } from './library.js';
import { fmtDate } from '../../lib/format.js';
import { t, uiLang } from '../../lib/i18n.js';

const abbrOf = (s, l = uiLang()) => (s && s.abbr && (s.abbr[l] || s.abbr.de)) || (s && s.sr ? `SR ${s.sr}` : s && s.id) || '';

function Result({ e, r, onLoaded }) {
  const job = jobStore.use();
  const [err, setErr] = useState(null);
  const s = e.summary || { id: e.id };
  if (r.error) return html`<li class="upd-item"><p class="upd-name"><b>${abbrOf(s)}</b></p><${Notice} kind="error" title=${t('lib.err.title')}>${r.error}</${Notice}></li>`;
  const { newVersions = [], changedFiles = [], pending = [] } = r.res;
  const knownP = new Set((r.known || []).map((p) => p.id));
  const newPending = r.res.newPending || pending.filter((p) => !knownP.has(p.id));
  const hasXml = (v) => v.xml != null ? v.xml : Object.values(v.files || {}).some((f) => f && f.xml);
  const nothing = !newVersions.length && !changedFiles.length;
  const load = async () => {
    setErr(null);
    try {
      const bundle = await workBundle(e.id);
      const out = await runLoad({ id: e.id, name: abbrOf(s), kind: 'update', bundle, langs: bundle.langs });
      if (out) onLoaded(e.id, out);
    } catch (ex) { setErr(errorText(ex)); }
  };
  return html`<li class="upd-item" data-work=${e.id}>
    <p class="upd-name"><b>${abbrOf(s)}</b> <span class="mono">${s.sr ? (uiLang() === 'de' ? 'SR ' : 'RS ') + s.sr : ''}</span> <span class=${'tag ' + (nothing ? 'upd-same' : 'upd-new')}>${nothing ? t('upd.unchanged') : t('upd.changed')}</span></p>
    ${newVersions.length ? html`<div class="upd-block"><h3>${t('upd.newVersions', { n: newVersions.length })}</h3><ul class="upd-list">${newVersions.map((v) => html`<li><b>${fmtDate(v.date)}</b> ${v.date > new Date().toISOString().slice(0, 10) ? html`<span class="tag stag stag-future">${t('status.future')}</span>` : null} <span class="small">${hasXml(v) ? t('upd.withXml') : t('upd.pdfOnly')}</span></li>`)}</ul></div>` : null}
    ${changedFiles.length ? html`<div class="upd-block"><h3>${t('upd.changedFiles', { n: changedFiles.length })}</h3><ul class="upd-list">${changedFiles.map((c) => html`<li>${c.xmlNew ? t('upd.xmlNow', { date: fmtDate(c.date) }) : t('upd.fileChanged', { date: fmtDate(`${c.stage.slice(0, 4)}-${c.stage.slice(4, 6)}-${c.stage.slice(6, 8)}`), lang: (c.lang || '').toUpperCase() })}</li>`)}</ul></div>` : null}
    ${nothing ? html`<p class="small">${t('upd.nothing', { n: s.versions || 0 })}</p>` : null}
    <div class="upd-block"><h3>${t('upd.pending', { n: pending.length })}</h3>
      ${newPending.length ? html`<ul class="upd-list">${newPending.map((p) => html`<li><span lang=${langOf(p.title)}>${pickLang(p.title) || p.id}</span> <${ExtLink} href=${p.url}>${t('ov.pend.open')}</${ExtLink}></li>`)}</ul>` : html`<p class="small">${t('upd.noNewPending')}</p>`}
    </div>
    <div class="tool-cluster">
      <button type="button" class=${'btn ' + (nothing ? 'btn-tertiary' : 'btn-primary') + ' btn-load'} disabled=${!!job} onClick=${load}><${Icon} name="download" />${nothing ? t('upd.reload') : t('upd.load')}</button>
      <button type="button" class="btn btn-tertiary" onClick=${() => go({ view: 'uebersicht', w: e.id })}><${Icon} name="book" />${t('lib.open')}</button>
    </div>
    ${err ? html`<${Notice} kind="error" title=${t('lib.err.title')}>${err}</${Notice}>` : null}
  </li>`;
}

export function UpdateView({ route }) {
  const list = libraryStore.use();
  const job = jobStore.use();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState({});
  const cur = list.find((e) => e.id === route.w);
  const check = async (entries) => {
    setBusy(true);
    const out = { ...results };
    for (const e of entries) {
      try {
        const bundle = await workBundle(e.id);
        const res = await core.checkUpdates(bundle, { fetch: (u, o) => window.fetch(u, o) });
        out[e.id] = { res, known: bundle.pending || [] };
      } catch (ex) { out[e.id] = { error: errorText(ex) }; }
      setResults({ ...out });
    }
    setBusy(false);
  };
  const onLoaded = (id, outcome) => setResults((r) => ({ ...r, [id]: { loaded: outcome } }));
  const shown = list.filter((e) => results[e.id]);
  return html`<div class="view view-update"><main class="wide narrow-l" id="main" tabindex="-1">
    <header class="unit-head page-head"><p class="unit-label">${t('nav.aktualisieren')}</p><h1 class="unit-title">${t('upd.title')}</h1><${HelpLink} sec="aktualisieren" /></header>
    <p class="ov-lead">${t('upd.lead')}</p>
    <div class="tool-cluster">
      ${cur ? html`<button type="button" class="btn btn-primary" id="btn-check-one" disabled=${busy || !!job} onClick=${() => check([cur])}><${Icon} name="refresh" />${t('upd.checkOne', { name: abbrOf(cur.summary) })}</button>` : null}
      <button type="button" class=${'btn ' + (cur ? 'btn-tertiary' : 'btn-primary')} id="btn-check-all" disabled=${busy || !!job} onClick=${() => check(list)}><${Icon} name="refresh" />${t('upd.checkAll', { n: list.length })}</button>
    </div>
    <p class="hint"><${Icon} name="info" />${t('lib.search.netHint')}</p>
    ${busy ? html`<p class="muted" role="status">${t('upd.checking')}</p>` : null}
    <${JobProgress} job=${job} />
    ${shown.length ? html`<ul class="upd-results">${shown.map((e) => results[e.id].loaded
      ? html`<li class="upd-item" data-work=${e.id}><p class="upd-name"><b>${abbrOf(e.summary)}</b> <span class="tag upd-same">${t('upd.loaded')}</span></p><p class="small">${t('upd.loadedText', { added: results[e.id].loaded.added ? results[e.id].loaded.added.length : 0, replaced: results[e.id].loaded.replaced ? results[e.id].loaded.replaced.length : 0 })}</p></li>`
      : html`<${Result} e=${e} r=${results[e.id]} onLoaded=${onLoaded} key=${e.id} />`)}</ul>` : null}
  </main></div>`;
}
