// Prüfung auf eine neuere Version: ruft die Versionsangabe der Projektseite ab (eine kleine JSON-Datei).
// Der Abruf sendet keine Inhalte aus dem Navigator. Er läuft beim Start höchstens einmal je Tag und lässt sich in der
// Ansicht Info abschalten. Fehler bleiben beim Start still; die manuelle Suche zeigt eine Meldung.
import { createStore } from './state.js';
import { settingsStore, persistSettings } from './app.js';
import { releaseInfo, parseManifest, shouldAutoCheck } from './lib/release.js';

/** Zustand der laufenden Sitzung: { status: 'idle' | 'checking' | 'done' | 'failed', manual } */
export const updateStore = createStore({ status: 'idle', manual: false });

const info = () => (typeof window !== 'undefined' ? releaseInfo(window.__srMeta, location.href) : releaseInfo(null));
const patch = (p) => { settingsStore.set({ ...settingsStore.get(), ...p }); persistSettings(); };

export async function checkForUpdate({ manual = false } = {}) {
  const r = info();
  if (!r.manifestUrl || updateStore.get().status === 'checking') return null;
  updateStore.set({ status: 'checking', manual });
  const tried = new Date().toISOString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(r.manifestUrl, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const m = parseManifest(await res.json(), r);
    if (!m) throw new Error('Versionsangabe ungültig');
    patch({ updateTried: tried, updateSeen: { ...m, checkedAt: tried } });
    updateStore.set({ status: 'done', manual });
    return m;
  } catch {
    patch({ updateTried: tried });
    updateStore.set({ status: 'failed', manual });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nach dem ersten Rendern aufrufen. Setzt window.__srUpdateSettled, sobald feststeht, dass nichts mehr läuft (für Tests). */
export function autoCheck() {
  const settled = () => { if (typeof window !== 'undefined') window.__srUpdateSettled = true; };
  if (!shouldAutoCheck(info(), settingsStore.get())) { settled(); return; }
  checkForUpdate().finally(settled);
}

export function setAutoCheck(on) { patch({ updateCheck: !!on }); }
