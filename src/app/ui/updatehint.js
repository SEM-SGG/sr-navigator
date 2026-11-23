// Hinweis auf eine neuere Version (Band unter der Kopfzeile) und Abschnitt «Version» der Info-Ansicht.
// Die Logik liegt in ../lib/release.js, der Abruf der Versionsangabe in ../update.js. Links öffnen in neuem Tab.
// Gehostete Fassung (Datei von der Projektseite unter app/): «Seite neu laden» statt Download, Texte ohne «Datei».
// Die Links zur Projektseite, zur Produktdokumentation und die E-Mail-Adresse sind Links, keine Abrufe.
import { html } from 'htm/preact';
import { Icon } from './common.js';
import { t } from '../lib/i18n.js';
import { fmtDate } from '../lib/format.js';
import { releaseInfo, hintState, snooze, ageDays, lastCheck, autoCheckEnabled } from '../lib/release.js';
import { settingsStore, persistSettings } from '../app.js';
import { updateStore, checkForUpdate, setAutoCheck } from '../update.js';

const info = () => (typeof window !== 'undefined' ? releaseInfo(window.__srMeta, location.href) : releaseInfo(null));
const ext = { target: '_blank', rel: 'noopener noreferrer' };
const reload = () => location.reload();

export function UpdateHint() {
  const settings = settingsStore.use();
  const r = info();
  const st = hintState(r, settings);
  if (st.kind === 'none') return null;
  const later = () => { settingsStore.set({ ...settingsStore.get(), releaseSnooze: snooze(r, st.key) }); persistSettings(); };
  const newerKey = (r.hosted ? 'release.hostedNewer' : 'release.newer') + (st.date ? '' : 'NoDate');
  const text = st.kind === 'newer'
    ? t(newerKey, { version: st.version, date: st.date ? fmtDate(st.date) : '', current: r.version })
    : t('release.hint', { days: st.days, version: r.version, date: fmtDate(r.built) });
  return html`<aside class="update-hint" data-kind=${st.kind} role="status" aria-label=${t('release.aria')}>
    <${Icon} name="info" />
    <div class="uh-body">
      <p class="uh-text">${text}</p>
      ${r.hosted ? null : html`<p class="uh-sub">${t('release.replace')}</p>`}
    </div>
    <div class="uh-actions">
      ${r.hosted
        ? html`<button type="button" class="btn btn-primary btn-sm" onClick=${reload}>${t('release.reload')}</button>`
        : html`<a class="btn btn-primary btn-sm" href=${st.url} ...${ext}>${t('release.download')}</a>`}
      <a class="btn btn-quiet btn-sm" href=${r.listUrl} ...${ext}>${t(st.kind === 'newer' ? 'release.whatsNew' : 'release.list')}</a>
      <button type="button" class="btn btn-quiet btn-sm" onClick=${later}>${t('release.later')}</button>
    </div>
  </aside>`;
}

function CheckStatus({ r, settings, run }) {
  if (run.status === 'checking') return html`<p class="vs-status" role="status">${t('release.checking')}</p>`;
  if (run.status === 'failed' && run.manual) return html`<p class="vs-status vs-failed" role="alert">${t('release.checkFailed')}</p>`;
  const last = lastCheck(r, settings);
  if (!last) return html`<p class="vs-status" role="status">${t('release.never')}</p>`;
  const date = fmtDate(last.checkedAt.slice(0, 10));
  return html`<p class="vs-status" role="status">${last.newer ? t('release.newerKnown', { date, version: last.version }) : t(r.hosted ? 'release.hostedUpToDate' : 'release.upToDate', { date })}</p>`;
}

export function VersionSection() {
  const settings = settingsStore.use();
  const run = updateStore.use();
  const r = info();
  if (!r.version && !r.built) return null;
  const last = lastCheck(r, settings);
  const newerAction = r.hosted
    ? html`<button type="button" class="btn btn-primary btn-sm" onClick=${reload}>${t('release.reload')}</button>`
    : html`<a class="btn btn-primary btn-sm" href=${last && last.url} ...${ext}>${t('release.download')}</a>`;
  return html`<section class="info-sec" aria-labelledby="vs-h">
    <h2 id="vs-h">${t('release.title')}</h2>
    <p class="vs-line"><strong>${t('release.version', { version: r.version || '', date: r.built ? fmtDate(r.built) : '' })}</strong> ${r.built && !r.hosted ? t('release.age', { n: ageDays(r.built) }) : ''}</p>
    ${r.hosted ? html`<p class="vs-line vs-hosted">${t('release.hosted', { host: r.siteHost })}</p>` : null}
    ${r.manifestUrl ? html`
      <${CheckStatus} r=${r} settings=${settings} run=${run} />
      <p class="vs-actions">
        <button type="button" class="btn btn-quiet btn-sm" disabled=${run.status === 'checking'} onClick=${() => checkForUpdate({ manual: true })}>${t('release.checkNow')}</button>
        ${last && last.newer ? newerAction : null}
      </p>
      <label class="check vs-check"><input type="checkbox" checked=${autoCheckEnabled(settings)} onChange=${(e) => setAutoCheck(e.target.checked)} />${t('release.checkOn')}</label>
      <p class="hint-text">${t('release.checkNote', { host: r.siteHost })}</p>` : null}
    ${r.repoUrl ? html`<p class="vs-links">
      ${r.hosted && r.downloadUrl ? html`<a class="vs-offline" href=${r.downloadUrl} ...${ext}>${t('release.offlineFile')}</a>` : null}
      ${r.siteUrl ? html`<a href=${r.siteUrl} ...${ext}>${t('release.site')}</a>` : null}
      ${r.docsUrl ? html`<a href=${r.docsUrl} ...${ext}>${t('release.docs')}</a>` : null}
      <a href=${r.listUrl} ...${ext}>${t('release.list')}</a>
      <a href=${r.repoUrl} ...${ext}>${t('release.source')}</a>
      <a href=${r.issuesUrl} ...${ext}>${t('release.report')}</a>
    </p>
    <p class="hint-text">${t('release.reportNote')}</p>
    ${r.contact ? html`<p class="hint-text vs-contact">${t('release.contact')} <a href=${'mailto:' + r.contact}>${r.contact}</a></p>` : null}` : null}
  </section>`;
}
