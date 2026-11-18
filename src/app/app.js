// Globale Speicher der Anwendung: Bibliothek (eingebettete und lokal gespeicherte Erlasse), Sammelkorb, Einstellungen.
import { t } from './lib/i18n.js';
import { createStore } from './state.js';
import { kvGet, kvSet, kvDel } from './lib/store.js';
import { Data, summarize, setRefLibrary, refLibraryState } from './data.js';

export const libraryStore = createStore([]); // [{ id, summary, source: 'embedded'|'local'|'updated', order }]
export const basketStore = createStore([]);
export const toastStore = createStore([]);
export const settingsStore = createStore({ origin: true });
export const panelStore = createStore({ basket: false });
export const jobStore = createStore(null); // laufender Abruf: { kind, id, done, total, label, error, controller }
export const metaStore = createStore({});

let embedded = { index: { order: [], works: {} }, bundle: () => null, meta: {} };
const dataCache = new Map();
const localIds = new Set();

let tid = 0;
export function toast(text, kind = 'info', ms = 6000) {
  const id = ++tid;
  toastStore.set((l) => [...l, { id, text, kind }]);
  if (ms) setTimeout(() => toastStore.set((l) => l.filter((x) => x.id !== id)), ms);
  return id;
}

function rebuildList() {
  const out = [];
  const seen = new Set();
  embedded.index.order.forEach((id, i) => {
    const local = localIds.has(id);
    const sum = local ? (localSummaries.get(id) || embedded.index.works[id]) : embedded.index.works[id];
    out.push({ id, summary: sum, source: local ? 'updated' : 'embedded', embedded: true, order: i });
    seen.add(id);
  });
  for (const id of localOrder) if (!seen.has(id) && localSummaries.has(id)) out.push({ id, summary: localSummaries.get(id), source: 'local', embedded: false, order: out.length });
  libraryStore.set(out);
}
const localSummaries = new Map();
let localOrder = [];

export function initLibrary(emb) {
  embedded = emb;
  metaStore.set(emb.meta || {});
  rebuildList();
}

export async function loadPersisted() {
  basketStore.set((await kvGet('basket', [])) || []);
  settingsStore.set({ origin: true, ...((await kvGet('settings', {})) || {}) });
  const list = (await kvGet('works', [])) || [];
  localOrder = list.map((x) => x.id);
  for (const x of list) { localIds.add(x.id); localSummaries.set(x.id, x.summary); }
  rebuildList();
}
export function persistBasket() { kvSet('basket', basketStore.get()).catch(() => toast(t('basket.saveFailed'), 'error')); }
export function persistSettings() { kvSet('settings', settingsStore.get()).catch(() => {}); }

async function persistIndex() {
  await kvSet('works', localOrder.map((id) => ({ id, summary: localSummaries.get(id) })));
}

/** Data-Objekt eines Erlasses (Bundle aus IndexedDB oder Einbettung, beim ersten Zugriff entpackt). */
export async function openWork(id) {
  if (dataCache.has(id)) return dataCache.get(id);
  let bundle = null, source = 'embedded';
  if (localIds.has(id)) { bundle = await kvGet('work:' + id, null); source = embedded.index.works[id] ? 'updated' : 'local'; }
  if (!bundle && embedded.index.works[id]) { bundle = embedded.bundle(id); source = 'embedded'; }
  if (!bundle) return null;
  const d = new Data(bundle, { source });
  dataCache.set(id, d);
  return d;
}
export const cachedWork = (id) => dataCache.get(id) || null;

/** Alle Erlasse der Bibliothek öffnen und für die Auflösung der Verweisziele melden (SPEC §12.3). */
export async function openRefLibrary() {
  const order = libraryStore.get().map((e) => e.id);
  const datas = new Map();
  for (const id of order) { const d = await openWork(id); if (d) datas.set(id, d); }
  const st = refLibraryState();
  const same = st.order.join('|') === order.filter((id) => datas.has(id)).join('|') && [...datas].every(([id, d]) => st.datas.get(id) === d);
  if (!same) setRefLibrary(datas, order);
  return refLibraryState();
}
export const hasWork = (id) => !!embedded.index.works[id] || localIds.has(id);
export const isEmbedded = (id) => !!embedded.index.works[id];

/** Bundle lokal speichern (neu hinzugefügt oder aktualisiert). */
export async function saveWork(bundle) {
  const id = bundle.work.id;
  await kvSet('work:' + id, bundle);
  if (!localIds.has(id)) { localIds.add(id); if (!embedded.index.works[id]) localOrder.push(id); else localOrder.push(id); }
  localSummaries.set(id, summarize(bundle));
  await persistIndex();
  dataCache.delete(id);
  rebuildList();
}

/** Lokal gespeicherten Erlass entfernen; eingebettete fallen auf die eingebettete Fassung zurück. */
export async function removeWork(id) {
  await kvDel('work:' + id);
  localIds.delete(id);
  localSummaries.delete(id);
  localOrder = localOrder.filter((x) => x !== id);
  await persistIndex();
  dataCache.delete(id);
  rebuildList();
}

/** Bundle für Projektdatei und Aktualisierung (das tatsächlich verwendete). */
export async function workBundle(id) {
  if (localIds.has(id)) return kvGet('work:' + id, null);
  return embedded.bundle(id);
}

export function addToBasket(item) {
  basketStore.set((l) => [...l, { ...item, id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  persistBasket();
  toast(t('basket.added', { n: basketStore.get().length }), 'success', 3500);
}

// ------------------------------------------------------------ Projektdatei
export const PROJECT_KIND = 'sr-navigator-project';
export async function projectData() {
  const works = [];
  for (const id of localOrder) { const b = await kvGet('work:' + id, null); if (b) works.push(b); }
  return { kind: PROJECT_KIND, version: 1, created: new Date().toISOString(), works, basket: basketStore.get(), settings: settingsStore.get() };
}
export async function importProject(obj) {
  if (!obj || obj.kind !== PROJECT_KIND || !Array.isArray(obj.works)) throw new Error(t('lib.project.invalid'));
  let n = 0;
  for (const b of obj.works) {
    if (!b || b.schema !== 2 || !b.work || !b.work.id || !b.units) continue;
    await saveWork(b);
    n++;
  }
  if (Array.isArray(obj.basket)) { basketStore.set(obj.basket); persistBasket(); }
  if (obj.settings && typeof obj.settings === 'object') { settingsStore.set({ ...settingsStore.get(), ...obj.settings }); persistSettings(); }
  return n;
}
