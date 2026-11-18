// Info: Verbindlichkeit, Datenstand je Erlass, Fassungen des gewählten Erlasses, Methodik.
import { html } from 'htm/preact';
import { Notice, HelpLink, ExtLink } from '../../ui/common.js';
import { fmtDate, localIso } from '../../lib/format.js';
import { pickLang, coreSource } from '../../data.js';
import { libraryStore, metaStore } from '../../app.js';
import { go } from '../../state.js';
import { VersionSection } from '../../ui/updatehint.js';
import { t, tx, uiLang } from '../../lib/i18n.js';

const list = (key) => { const v = tx(key); return Array.isArray(v) ? v : []; };

export function InfoView({ data }) {
  const lib = libraryStore.use();
  const m = metaStore.use();
  const l = uiLang();
  const coreUsed = [...coreSource.model, ...coreSource.fedlex].filter(([, x]) => x).map(([n]) => n);
  return html`<div class="view view-info"><main class="wide narrow" id="main" tabindex="-1">
    <header class="unit-head page-head"><p class="unit-label">${t('nav.info')}</p><h1 class="unit-title">${t('info.title')}</h1><${HelpLink} sec="grundbegriffe" /></header>

    <section class="info-sec" aria-labelledby="vb-h" id="info-binding">
      <h2 id="vb-h">${t('info.binding.title')}</h2>
      <${Notice} kind="warning" title=${t('info.binding.lead')}>${t('info.binding.text')}</${Notice}>
      <ul class="g-list">${list('info.binding.points').map((p) => html`<li>${p}</li>`)}</ul>
    </section>

    <section class="info-sec" aria-labelledby="ds-h">
      <h2 id="ds-h">${t('info.data.title')}</h2>
      <div class="tbl-scroll"><table class="tbl-data"><thead><tr><th>${t('lib.col.abbr')}</th><th>${t('info.col.fetched')}</th><th>${t('info.col.versions')}</th><th>${t('info.col.source')}</th></tr></thead><tbody>
        ${lib.map((e) => { const s = e.summary || {}; return html`<tr>
          <td><b>${(s.abbr && (s.abbr[l] || s.abbr.de)) || e.id}</b><br /><span class="small mono">${s.sr ? (l === 'de' ? 'SR ' : 'RS ') + s.sr : ''}</span></td>
          <td class="nw">${fmtDate(s.fetched)}</td>
          <td class="small">${t('lib.xmlRange', { from: fmtDate(s.xmlFrom), to: fmtDate(s.xmlTo), n: s.xmlVersions, total: s.versions })}</td>
          <td><span class=${'tag src-' + e.source}>${t('lib.source.' + e.source)}</span></td></tr>`; })}
      </tbody></table></div>
      <dl class="facts">
        <dt>${t('info.data.built')}</dt><dd>${m.built ? fmtDate(localIso(new Date(m.built))) : ''}</dd>
        <dt>${t('info.data.basis')}</dt><dd>${m.fixtures ? t('info.data.fixtures') : t('info.data.real')}</dd>
        <dt>${t('info.data.core')}</dt><dd>${coreUsed.length ? t('info.data.coreYes', { list: coreUsed.join(', ') }) : t('info.data.coreNo')}</dd>
      </dl>
    </section>

    ${data ? html`<section class="info-sec" aria-labelledby="st-h">
      <h2 id="st-h">${t('info.stages.title', { name: data.abbr(l) })}</h2>
      <p>${t('info.stages.text', { n: data.timeline.length, x: data.stages.length, date: fmtDate(data.first.date) })}</p>
      <div class="tbl-scroll"><table class="tbl-data"><thead><tr><th>${t('info.col.stage')}</th><th>${t('info.col.until')}</th><th>${t('info.col.acts')}</th><th>${t('info.col.gap')}</th><th>${t('info.col.langs')}</th></tr></thead><tbody>
        ${data.stages.map((s) => html`<tr>
          <td class="nw"><a href=${`#/lesen?w=${data.id}&s=${s.id}`} onClick=${(e) => { e.preventDefault(); go({ view: 'lesen', s: s.id, m: 'stand' }); }}>${fmtDate(s.date)}</a>${data.isFuture(s.id) ? html` <span class="tag stag stag-future">${t('status.futureShort')}</span>` : null}</td>
          <td class="nw">${s.end ? fmtDate(s.end) : ''}</td>
          <td class="small">${(s.acts || []).map((a, i) => html`${i ? ', ' : ''}<${ExtLink} href=${data.actUrl(a)}>${data.actCode(a)}</${ExtLink}>`)}</td>
          <td class="nw">${s.gap ? t('info.gapN', { n: s.gap }) : '–'}</td>
          <td class="nw">${(s.langs || []).map((x) => x.toUpperCase()).join(', ')}</td></tr>`)}
      </tbody></table></div>
      ${data.dataNotes.length || data.notes.length ? html`<details class="info-notes"><summary>${t('info.data.notes', { n: data.dataNotes.length + data.notes.length })}</summary><ul>
        ${data.dataNotes.map((n) => html`<li>${pickLang(n.text) || n.code}${n.stage && data.stage(n.stage) ? ' (' + fmtDate(data.stageDate(n.stage)) + ')' : ''}</li>`)}
        ${data.notes.map((n) => html`<li>${t(n.k, n.v)}</li>`)}
      </ul></details>` : null}
    </section>` : null}

    <section class="info-sec" aria-labelledby="mt-h">
      <h2 id="mt-h">${t('info.method.title')}</h2>
      ${list('info.method.points').map((p) => html`<p>${p}</p>`)}
      <p><a href="#/anleitung" onClick=${(e) => { e.preventDefault(); go({ view: 'anleitung', sec: null }); }}>${t('info.method.guideLink')}</a></p>
    </section>
    <${VersionSection} />
  </main></div>`;
}
