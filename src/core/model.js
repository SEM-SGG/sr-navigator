// SR-Navigator — Datenmodell «Bundle» (schema 2) (ESM, isomorph, keine Node-APIs)
//
// buildBundle({ meta, versions, texts, impacts, pending, actsMeta, fetched }, { DOMParser, langs, onProgress }) -> Bundle
// getVersion(ds, unitId, lang, stageId) -> version | null
// blockHistory(ds, unitId, lang, key) -> [ { stage, act, change, block|null } ]
// changesOfStage(ds, stageId, lang) -> [ { unit, key, change, act } ]
// stageAt(ds, isoDate) -> stageId | null
// unitActs(ds, unitId, lang) -> [actId, …]
// unitEvents(ds, unitId) -> [ { date, act, action, key, stage|null, src } ]
//
// Eingaben (von fedlex.js aufbereitet):
//   meta:     { id, eli, sr, title{}, short{}, abbr{}, dateDocument, dateEntryInForce, status, base }
//   versions: [ { date, end, files: { de: { xml, pdf, html }, … } } ]   alle Fassungen laut Fedlex
//   texts:    { '<JJJJMMTT>_<lang>': xmlString } oder Map
//   impacts:  [ { id, act, from, target, unit, type, action, inForce, comment } ]
//   pending:  [ { id, type, title{}, date, status, statusLabel{}, url } ]
//   actsMeta: { 'oc/2018/509': { title{}, as{}, dateDocument, dateEntryInForce } }

import { normText } from './text.js';
import { parseFedlex, plain } from './parser.js';

export const SCHEMA = 2;
export const MODEL_VERSION = 1;
const DEFAULT_LANGS = ['de', 'fr', 'it'];
const ELI = 'https://fedlex.data.admin.ch/eli/';

// ------------------------------------------------------------------ Vergleich

export function blockText(b) { return normText(((b.l || '') + ' ' + (b.t || '')).trim()); }
function bodyText(b) { return normText(b.t || ''); }
const isTrivial = (b) => { const t = bodyText(b); return !t || /^[.\s-]*$/.test(t); };
function sameWording(a, b) { return !!a && !!b && blockText(a) === blockText(b); }
function sameBlock(a, b) { return sameWording(a, b) && (a.o || null) === (b.o || null); }
const parentKey = (k) => { const i = k.lastIndexOf('.'); return i < 0 ? '' : k.slice(0, i); };
const lastSeg = (k) => { const i = k.lastIndexOf('.'); return i < 0 ? k : k.slice(i + 1); };
const sd = (date) => String(date).replace(/-/g, '');
const dateOfStageId = (id) => `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;

const fnKey = (list) => (list || []).map((f) => normText(plain(f.t))).sort().join('\u0001');
function unitWordingKey(v) { return normText([v.label || '', v.title || '', ...v.blocks.map((b) => (b.l || '') + ' ' + (b.t || ''))].join(' ')); }
function allFnKey(v) { return fnKey([...(v.fn || []), ...v.blocks.flatMap((b) => b.fn || [])]); }
const originSet = (v) => [...new Set(v.blocks.map((b) => b.o || ''))].sort().join('|') + '#' + (v.o || '');
function sameUnitWording(a, b) {
  return !!a.repealed === !!b.repealed && unitWordingKey(a) === unitWordingKey(b) && allFnKey(a) === allFnKey(b) && originSet(a) === originSet(b);
}
function versionsEqual(a, b) {
  if (!a || !b) return false;
  if (fnKey(a.fn) !== fnKey(b.fn)) return false;
  if (!!a.repealed !== !!b.repealed || !!a.missing !== !!b.missing) return false;
  if (normText(a.title || '') !== normText(b.title || '')) return false;
  if (normText(a.label || '') !== normText(b.label || '')) return false;
  if ((a.o || null) !== (b.o || null)) return false;
  if (a.blocks.length !== b.blocks.length) return false;
  for (let i = 0; i < a.blocks.length; i++) {
    const x = a.blocks[i], y = b.blocks[i];
    if (x.k !== y.k || !sameBlock(x, y) || fnKey(x.fn) !== fnKey(y.fn)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ Sprachabgleich der Schlüssel (innerhalb eines Stands)

// Längste gemeinsame Teilfolge zweier Schlüssellisten (Indexpaare)
function lcsPairs(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4e6) { // Notfall: nur gleiche Schlüssel in Reihenfolge
    const res = []; let j = 0;
    for (let i = 0; i < n && j < m; i++) { const f = b.indexOf(a[i], j); if (f >= 0) { res.push([i, f]); j = f + 1; } }
    return res;
  }
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const res = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { res.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return res;
}

// byLang: { lang: blocks[] } -> gleiche Schlüssel in allen Sprachen, soweit eindeutig ableitbar
export function alignLanguages(byLang, langs, log, ctx) {
  const ls = langs.filter((l) => byLang[l]);
  if (ls.length < 2) return byLang;
  const keySets = Object.fromEntries(ls.map((l) => [l, new Set(byLang[l].map((b) => b.k))]));
  const same = ls.every((l) => byLang[l].length === byLang[ls[0]].length && byLang[l].every((b, i) => b.k === byLang[ls[0]][i].k));
  if (same) return byLang;
  // Bezugssprache: deren Schlüssel am häufigsten in den anderen Sprachen vorkommen (Gleichstand: Reihenfolge langs)
  let ref = ls[0], best = -1;
  for (const l of ls) {
    let s = 0;
    for (const k of keySets[l]) for (const o of ls) if (o !== l && keySets[o].has(k)) s++;
    if (s > best) { best = s; ref = l; }
  }
  const R = byLang[ref];
  const out = { [ref]: R };
  for (const l of ls) {
    if (l === ref) continue;
    const B = byLang[l];
    const pairs = lcsPairs(R.map((b) => b.k), B.map((b) => b.k));
    const map = new Map();
    let pi = -1, pj = -1;
    const gaps = [];
    for (const [i, j] of [...pairs, [R.length, B.length]]) {
      if (i - pi > 1 || j - pj > 1) gaps.push([pi + 1, i, pj + 1, j]);
      pi = i; pj = j;
    }
    for (const [i0, i1, j0, j1] of gaps) {
      const rs = R.slice(i0, i1), bs = B.slice(j0, j1);
      if (rs.length === bs.length && rs.every((r, x) => r.d === bs[x].d && (r.ty || '') === (bs[x].ty || ''))) {
        rs.forEach((r, x) => {
          if (!keySets[l].has(r.k) || bs[x].k === r.k) map.set(bs[x].k, r.k);
          log.push({ code: 'lang-key', lang: l, ref, from: bs[x].k, to: r.k });
        });
      } else {
        log.push({ code: 'lang-mismatch', lang: l, ref, refKeys: rs.map((r) => r.k), keys: bs.map((b) => b.k) });
      }
    }
    out[l] = map.size ? B.map((b) => (map.has(b.k) ? { ...b, k: map.get(b.k), kSrc: b.k } : b)) : B;
  }
  return out;
}

// ------------------------------------------------------------------ Schlüsselabgleich über die Stände

// prevBy: { lang: version|null }, nextBy: { lang: blocks[] } -> { lang: blocks[] mit stabilen Schlüsseln }
export function rekey(prevBy, nextBy, log, unitId) {
  const langs = Object.keys(nextBy);
  const votes = new Map(); // candidateKey -> Map(finalKey -> [langs])
  const vote = (ck, fk, lang) => {
    if (!votes.has(ck)) votes.set(ck, new Map());
    const m = votes.get(ck);
    if (!m.has(fk)) m.set(fk, []);
    m.get(fk).push(lang);
  };
  for (const lang of langs) {
    const prev = prevBy[lang];
    const next = nextBy[lang];
    if (!prev || prev.repealed && !prev.blocks.length) continue;
    const pBlocks = prev.blocks;
    const pByKey = new Map(pBlocks.map((b) => [b.k, b]));
    const nKeys = new Set(next.map((b) => b.k));
    const used = new Set();
    const assigned = new Map();
    const textIdx = new Map();
    for (const b of pBlocks) {
      if (isTrivial(b)) continue;
      const t = blockText(b);
      if (!textIdx.has(t)) textIdx.set(t, []);
      textIdx.get(t).push(b.k);
    }
    // 1. Gleicher Schlüssel aus dem eId (nicht positionsabhängig): bleibt
    for (const b of next) if (!b.pos && pByKey.has(b.k)) { assigned.set(b.k, b.k); used.add(b.k); }
    // 2. Gleicher Wortlaut: Schlüssel der Vorfassung übernehmen (positionsabhängige oder neu benannte Schlüssel)
    for (const b of next) {
      if (assigned.has(b.k) || isTrivial(b)) continue;
      const cands = (textIdx.get(blockText(b)) || []).filter((k) => !used.has(k));
      if (!cands.length) continue;
      const pk = parentKey(b.k);
      const pFinal = pk ? (assigned.get(pk) ?? pk) : '';
      let pick = cands.find((k) => k === b.k) || cands.find((k) => parentKey(k) === pFinal && lastSeg(k) === lastSeg(b.k)) || cands.find((k) => parentKey(k) === pFinal) || (cands.length === 1 ? cands[0] : null);
      if (!pick) { log.push({ code: 'rekey-ambiguous', unit: unitId, lang, key: b.k, candidates: cands }); continue; }
      // nicht positionsabhängiger Schlüssel nur übernehmen, wenn er in der neuen Fassung nicht anderweitig vorkommt
      if (!b.pos && pick !== b.k && nKeys.has(pick)) continue;
      if (!b.pos && pick !== b.k && pByKey.has(b.k)) continue;
      assigned.set(b.k, pick); used.add(pick);
    }
    // 3. Positionsabhängig, gleicher Platz, Text geändert: Schlüssel bleibt
    for (const b of next) {
      if (assigned.has(b.k)) continue;
      const pk = parentKey(b.k);
      const pFinal = pk ? (assigned.get(pk) ?? pk) : '';
      const ck = (pFinal ? pFinal + '.' : '') + lastSeg(b.k);
      if (pByKey.has(ck) && !used.has(ck)) { assigned.set(b.k, ck); used.add(ck); }
    }
    for (const [ck, fk] of assigned) vote(ck, fk, lang);
  }
  // Sprachübergreifend entscheiden (Mehrheit, sonst Reihenfolge der Sprachen)
  const map = new Map();
  for (const [ck, m] of votes) {
    const opts = [...m.entries()].sort((a, b) => b[1].length - a[1].length || langs.indexOf(a[1][0]) - langs.indexOf(b[1][0]));
    if (opts.length > 1) log.push({ code: 'rekey-conflict', unit: unitId, key: ck, options: Object.fromEntries(opts.map(([k, l]) => [k, l])) });
    map.set(ck, opts[0][0]);
  }
  const out = {};
  for (const lang of langs) {
    const res = [];
    const usedKeys = new Set();
    for (const b of nextBy[lang]) if (map.has(b.k)) usedKeys.add(map.get(b.k));
    const done = new Map();
    for (const b of nextBy[lang]) {
      let nk;
      if (map.has(b.k)) nk = map.get(b.k);
      else {
        const pk = parentKey(b.k);
        const pf = pk ? (done.get(pk) ?? map.get(pk) ?? pk) : '';
        nk = (pf ? pf + '.' : '') + lastSeg(b.k);
        if (usedKeys.has(nk) && !(done.get(b.k) === nk)) {
          let i = 0;
          const letters = 'abcdefghijklmnopqrstuvwxyz';
          while (usedKeys.has(nk + '+' + letters[i])) i++;
          const nk2 = nk + '+' + letters[i];
          log.push({ code: 'rekey-new', unit: unitId, lang, key: b.k, to: nk2 });
          nk = nk2;
        }
      }
      done.set(b.k, nk);
      usedKeys.add(nk);
      res.push(nk === b.k ? b : { ...b, k: nk });
    }
    out[lang] = res;
  }
  return out;
}

// ------------------------------------------------------------------ Hilfen Metadaten

function fnsOf(v) {
  const out = [];
  if (v.fn) out.push(...v.fn);
  for (const b of v.blocks || []) if (b.fn) out.push(...b.fn);
  return out;
}
function cleanBlock(b, base) {
  const o = { k: b.k, d: b.d, l: b.l || '', t: b.t || '' };
  if (b.ty) o.ty = b.ty;
  if (b.html) o.html = b.html;
  o.o = b.o || base;
  if (b.ch) o.ch = b.ch;
  if (b.fn && b.fn.length) o.fn = b.fn;
  if (b.x) o.x = b.x;
  return o;
}
function asMap(texts) {
  if (!texts) return new Map();
  if (texts instanceof Map) return texts;
  return new Map(Object.entries(texts));
}
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

const NOTE_TEXT = {
  gap: (n) => ({
    de: `Zwischen dem vorangehenden Stand und diesem Stand liegen ${n} Fassung(en) ohne XML. Der Vergleich überspannt mehrere Fassungen.`,
    fr: `Entre l’état précédent et cet état, ${n} version(s) sans XML. La comparaison couvre plusieurs versions.`,
    it: `Tra lo stato precedente e questo stato vi sono ${n} versione/i senza XML. Il confronto comprende più versioni.`,
  }),
  latestOnly: () => ({
    de: 'Die Fussnote einer Bestimmung nennt nur die jüngste Änderung. Ältere Änderungen derselben Bestimmung sind aus den Fussnoten nicht ersichtlich.',
    fr: 'La note de bas de page d’une disposition ne mentionne que la dernière modification. Les modifications antérieures de la même disposition n’y figurent pas.',
    it: 'La nota a piè di pagina di una disposizione indica solo l’ultima modifica. Le modifiche precedenti della stessa disposizione non vi figurano.',
  }),
  typography: () => ({
    de: 'Rein typografische Unterschiede zwischen Fassungen (z. B. «…» und «. . .», «’» und «\'», geschützter und gewöhnlicher Bindestrich, «n°» und «n<sup>o</sup>», hochgestellte Ziffern) gelten nicht als Änderung. Der Wortlaut stammt dann aus der Fassung der letzten inhaltlichen Änderung und kann in der Schreibweise von der aktuellen Fedlex-Datei abweichen.',
    fr: 'Les différences purement typographiques entre versions (p. ex. «…» et «. . .», «’» et «\'», trait d’union insécable ou ordinaire, «n°» et «n<sup>o</sup>», chiffres en exposant) ne comptent pas comme modification. Le texte provient alors de la version de la dernière modification matérielle et peut différer, dans sa graphie, du fichier Fedlex actuel.',
    it: 'Le differenze puramente tipografiche tra versioni (p. es. «…» e «. . .», «’» e «\'», trattino unificatore o normale, «n°» e «n<sup>o</sup>», cifre in apice) non contano come modifica. Il testo proviene allora dalla versione dell’ultima modifica materiale e può differire nella grafia dal file Fedlex attuale.',
  }),
  beforeXml: (d) => ({
    de: `Wortlaut ab ${d}. Für die Zeit davor nur Ereignisse aus Fussnoten und Metadaten, ohne Wortlaut.`,
    fr: `Texte à partir du ${d}. Pour la période antérieure, seulement des événements tirés des notes et des métadonnées, sans texte.`,
    it: `Testo dal ${d}. Per il periodo precedente solo eventi tratti dalle note e dai metadati, senza testo.`,
  }),
};

// ------------------------------------------------------------------ Aufbau

export async function buildBundle(input, opts = {}) {
  const { meta, versions = [], pending = [], actsMeta = {} } = input;
  const texts = asMap(input.texts);
  const DOMParser = opts.DOMParser;
  // Impact-Daten, die kein Inkrafttreten sein können (älteste Erfassung: Beschlussdatum), nicht als Inkrafttreten führen
  const impacts = (input.impacts || []).map((im) => {
    const am = actsMeta[im.act] || {};
    if (im.inForce && ((am.dateEntryInForce && im.inForce < am.dateEntryInForce) || (am.dateDocument && im.inForce === am.dateDocument && am.dateEntryInForce !== im.inForce))) return { ...im, inForce: null, dateRaw: im.inForce };
    return im;
  });
  const langs = (opts.langs || DEFAULT_LANGS).slice();
  const onProgress = opts.onProgress || (() => {});
  const log = [];
  const base = meta.base;

  const vs = versions.slice().sort((a, b) => a.date.localeCompare(b.date));
  // Stände: Fassungen mit XML in mindestens einer gewählten Sprache und vorhandenem Text
  const stageDefs = [];
  for (const v of vs) {
    const id = sd(v.date);
    const have = langs.filter((l) => texts.has(`${id}_${l}`));
    if (have.length) stageDefs.push({ v, id, have });
  }
  const total = stageDefs.reduce((n, s) => n + s.have.length, 0);
  let done = 0;

  const ds = {
    schema: SCHEMA,
    fetched: input.fetched || null,
    work: { ...meta },
    langs,
    timeline: [],
    stages: [],
    toc: [],
    units: {},
    acts: [],
    pending: pending || [],
    notes: [],
  };

  const unitState = new Map(); // unitId -> { lastBy: {lang: version}, type, num }
  const tocMap = new Map();     // id -> entry
  const tocOrder = [];
  let prevStage = null;
  const parsedFirst = {};

  for (let si = 0; si < stageDefs.length; si++) {
    const { v, id, have } = stageDefs[si];
    const parsed = {};
    for (const l of have) {
      onProgress({ done, total, label: `${id}_${l}` });
      try { parsed[l] = parseFedlex(texts.get(`${id}_${l}`), { DOMParser }); }
      catch (e) { log.push({ code: 'parse-error', stage: id, lang: l, text: String(e && e.message || e) }); }
      for (const n of (parsed[l] ? parsed[l].notes : [])) log.push({ ...n, stage: id, lang: l, src: 'parser' });
      done++;
      if (opts.yield !== false) await yieldNow();
    }
    const pl = langs.filter((l) => parsed[l]);
    if (!pl.length) continue;
    if (si === 0) Object.assign(parsedFirst, parsed);
    const stage = {
      id, date: v.date, end: v.end || null, order: ds.stages.length, acts: [], gap: 0,
      source: { kind: 'fedlex', url: Object.fromEntries(pl.map((l) => [l, (v.files && v.files[l] && v.files[l].xml) || null])) },
      langs: [],
      generator: Object.fromEntries(pl.map((l) => [l, parsed[l].generator || null])),
    };
    if (prevStage) stage.gap = vs.filter((x) => x.date > prevStage.date && x.date < v.date).length;
    ds.stages.push(stage);

    // --- Einheiten je Sprache, Schluss- und Übergangsbestimmungen über die Überschrift zuordnen
    const unitsBy = {};
    for (const l of pl) unitsBy[l] = new Map(parsed[l].units.map((u) => [u.id, u]));
    const finalRemap = remapFinals(unitsBy, pl, unitState, log, id);

    // --- Gliederung
    mergeToc(ds, tocMap, tocOrder, parsed, pl, unitsBy, stage, log, finalRemap);

    // --- Einheiten verarbeiten
    const ids = [];
    const seen = new Set();
    for (const l of pl) for (const uid of unitsBy[l].keys()) if (!seen.has(uid)) { seen.add(uid); ids.push(uid); }
    const changed = new Set();
    for (const uid of ids) {
      const present = pl.filter((l) => unitsBy[l].has(uid));
      if (present.length < pl.length) log.push({ code: 'lang-unit', stage: id, unit: uid, langs: present, missing: pl.filter((l) => !present.includes(l)) });
      const st = unitState.get(uid) || { lastBy: {}, type: null };
      unitState.set(uid, st);
      let nextBy = {};
      for (const l of present) nextBy[l] = unitsBy[l].get(uid).blocks.map((b) => ({ ...b }));
      nextBy = alignLanguages(nextBy, langs, log.length < 1e6 ? logTo(log, { stage: id, unit: uid }) : [], { stage: id, unit: uid });
      const prevBy = Object.fromEntries(present.map((l) => [l, st.lastBy[l] || null]));
      nextBy = rekey(prevBy, nextBy, logTo(log, { stage: id }), uid);
      for (const l of present) {
        const u = unitsBy[l].get(uid);
        if (!ds.units[uid]) ds.units[uid] = { id: uid, type: u.type, num: u.num || null, versions: {} };
        const unit = ds.units[uid];
        if (!unit.versions[l]) unit.versions[l] = [];
        const ver = {
          stage: id,
          label: (u.label || '').replace(/<\/?b>/g, ''),
          title: u.title || '',
          blocks: nextBy[l].map((b) => cleanBlock(b, base)),
        };
        if (u.fn && u.fn.length) ver.fn = u.fn;
        if (u.o) { ver.o = u.o; ver.ch = u.ch; }
        if (u.repealed) ver.repealed = true;
        const prev = st.lastBy[l] || null;
        if (prev && versionsEqual(prev, ver)) continue;
        // Nur andere Aufteilung in Blöcke (Auszeichnung der Quelle), Wortlaut, Fussnoten und Herkunft gleich: keine neue Version
        if (prev && !prev.missing && sameUnitWording(prev, ver)) { log.push({ code: 'markup-only', stage: id, unit: uid, lang: l, before: prev.blocks.map((b) => b.k), after: ver.blocks.map((b) => b.k) }); continue; }
        if (prev && !prev.missing) {
          // Unveränderte Blöcke übernehmen exakt die Darstellung der Vorfassung
          const pm = new Map(prev.blocks.map((b) => [b.k, b]));
          ver.blocks = ver.blocks.map((b) => {
            const p = pm.get(b.k);
            if (p && sameBlock(p, b)) {
              const { x, ...rest } = p;
              if (fnKey(p.fn) === fnKey(b.fn)) return { ...rest, d: b.d };
              // nur Fussnoten geändert (z. B. neuer Hinweis der Redaktion): Wortlaut der Vorfassung, Fussnoten der Quelle
              const o = { ...rest, d: b.d, x: 'fn' };
              if (b.fn) o.fn = b.fn; else delete o.fn;
              return o;
            }
            if (p && sameWording(p, b)) return { ...b, x: 'origin' };
            return b;
          });
          if (normText(prev.title || '') === normText(ver.title || '')) ver.title = prev.title;
          if (normText(prev.label || '') === normText(ver.label || '')) ver.label = prev.label;
          if (versionsEqual(prev, ver)) continue;
          // Version nur wegen geänderter Fussnoten (Wortlaut, Gliederung und Herkunft gleich)
          if (!prev.missing && !!prev.repealed === !!ver.repealed && normText(prev.title || '') === normText(ver.title || '') && normText(prev.label || '') === normText(ver.label || '') && (prev.o || null) === (ver.o || null)
            && prev.blocks.length === ver.blocks.length && prev.blocks.every((b, i) => b.k === ver.blocks[i].k && sameBlock(b, ver.blocks[i]))) ver.fnOnly = true;
        }
        unit.versions[l].push(ver);
        st.lastBy[l] = ver;
        changed.add(l);
      }
    }
    // Einheiten, die in einer Sprache verschwunden sind (z. B. aufgehobene Artikel, die die Quelle zu «Art. 105–107» zusammenfasst)
    for (const [uid, st] of unitState) {
      for (const l of pl) {
        const last = st.lastBy[l];
        if (!last || last.missing || unitsBy[l].has(uid)) continue;
        const ver = { stage: id, label: last.label, title: last.title, blocks: [], repealed: true, missing: true };
        const grp = groupOf(uid, unitsBy[l]);
        if (grp) ver.mergedInto = grp;
        const parts = splitOf(uid, unitsBy[l]);
        if (parts.length) ver.splitInto = parts;
        ds.units[uid].versions[l].push(ver);
        st.lastBy[l] = ver;
        changed.add(l);
        log.push({ code: 'unit-missing', stage: id, unit: uid, lang: l });
      }
    }
    stage.langs = langs.filter((l) => changed.has(l));
    prevStage = stage;
  }

  // TOC in Reihenfolge, Einheiten mit from/to
  ds.toc = tocOrder.map((tid) => tocMap.get(tid));
  for (const e of ds.toc) { delete e._stages; delete e._units; delete e._seen; }

  annotate(ds, impacts, log);
  buildActs(ds, impacts, actsMeta, parsedFirst, log);
  buildTimeline(ds, vs, impacts);
  buildNotes(ds, log);
  onProgress({ done: total, total, label: 'fertig' });
  if (opts.log) opts.log.push(...log);
  return ds;
}

// Sammelbezeichnung wie art_105_107 oder art_111_g_111_h, die die Einheit uid umfasst
const artKey = (n, l) => [+n, l || ''];
const cmpKey = (a, b) => a[0] - b[0] || a[1].localeCompare(b[1]);
function groupOf(uid, units) {
  const m = /^art_(\d+)(?:_([a-z]))?$/.exec(uid);
  if (!m) return null;
  const k = artKey(m[1], m[2]);
  for (const id of units.keys()) {
    const g = /^art_(\d+)(?:_([a-z]))?_(\d+)(?:_([a-z]))?$/.exec(id);
    if (!g) continue;
    const a = artKey(g[1], g[2]), b = artKey(g[3], g[4]);
    if (cmpKey(a, k) <= 0 && cmpKey(k, b) <= 0 && cmpKey(a, b) < 0) return id;
  }
  return null;
}

// Umgekehrt: Sammelbezeichnung art_111_g_111_h ist weggefallen, Einzelartikel im Bereich bestehen
function splitOf(uid, units) {
  const g = /^art_(\d+)(?:_([a-z]))?_(\d+)(?:_([a-z]))?$/.exec(uid);
  if (!g) return [];
  const a = artKey(g[1], g[2]), b = artKey(g[3], g[4]);
  if (cmpKey(a, b) >= 0) return [];
  const out = [];
  for (const id of units.keys()) {
    const m = /^art_(\d+)(?:_([a-z]))?$/.exec(id);
    if (!m) continue;
    const k = artKey(m[1], m[2]);
    if (cmpKey(a, k) <= 0 && cmpKey(k, b) <= 0) out.push(id);
  }
  return out;
}

function logTo(log, extra) {
  return { push: (e) => log.push({ ...extra, ...e }) };
}

// Schluss- und Übergangsbestimmungen (disp_uN) tragen eine Positions-Id: über die Überschrift an die Vorstände binden
function remapFinals(unitsBy, pl, unitState, log, stageId) {
  const ref = pl.includes('de') ? 'de' : pl[0];
  const known = new Map(); // Titel (ref) -> uid
  for (const [uid, st] of unitState) {
    if (!/^disp_u\d+/.test(uid)) continue;
    const v = st.lastBy[ref];
    if (v) known.set(normText(v.title || ''), uid);
  }
  if (!known.size) return new Map();
  const finals = [...unitsBy[ref].values()].filter((u) => u.type === 'final' && /^disp_u\d+$/.test(u.id));
  const remap = new Map();
  for (const u of finals) {
    const t = normText(u.title || '');
    const k = known.get(t);
    if (k && k !== u.id) remap.set(u.id, k);
  }
  if (!remap.size) return remap;
  // nur eindeutige Abbildungen anwenden
  const targets = new Map();
  for (const [a, b] of remap) targets.set(b, (targets.get(b) || 0) + 1);
  const stay = new Set(finals.map((u) => u.id).filter((x) => !remap.has(x)));
  for (const l of pl) {
    const m = unitsBy[l];
    const ent = [...m.entries()];
    m.clear();
    for (const [uid, u] of ent) {
      const t = remap.get(uid);
      if (t && targets.get(t) === 1 && !stay.has(t)) { m.set(t, { ...u, id: t }); }
      else m.set(uid, u);
    }
  }
  const applied = new Map();
  for (const [a, b] of remap) if (targets.get(b) === 1 && !stay.has(b)) { applied.set(a, b); log.push({ code: 'final-remap', stage: stageId, from: a, to: b }); }
  return applied;
}

// Gliederung je Stand in die Gesamtgliederung einarbeiten.
// Gliederungsknoten werden über den Titel bzw. die enthaltenen Einheiten an die Vorstände gebunden
// (Kapitel können umnummeriert werden: «14c. Kapitel (Ursprünglich: 14b)»). Reihenfolge: jüngster Stand massgebend.
function mergeToc(ds, tocMap, tocOrder, parsed, pl, unitsBy, stage, log, finalRemap) {
  const ref = pl.includes('de') ? 'de' : pl[0];
  const idOf = (n) => n.id || n.lid;
  const anchor = (toc) => {
    const res = new Array(toc.length).fill(null);
    let next = null;
    for (let i = toc.length - 1; i >= 0; i--) { if (toc[i].unit) next = toc[i].id; else res[i] = next; }
    return res;
  };
  const unitId = (id) => finalRemap.get(id) || id;
  // Einheiten unter jedem Gliederungsknoten (Bezugssprache, stufenweise)
  const refToc = parsed[ref].toc;
  const desc = new Map();
  const parentOf = new Map(refToc.filter((n) => !n.unit).map((n) => [idOf(n), n.parent]));
  for (const n of refToc) if (n.unit) {
    let p = n.parent;
    while (p) { if (!desc.has(p)) desc.set(p, new Set()); desc.get(p).add(unitId(n.id)); p = parentOf.get(p); }
  }
  const lastHead = (e, l) => { const arr = e.heading && e.heading[l]; if (!arr) return null; for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].gone) return arr[i].text; return null; };
  const overlap = (a, b) => { if (!a || !b || !a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / Math.min(a.size, b.size); };
  // stabile Ids für die Knoten der Bezugssprache
  const stable = new Map();
  const claimed = new Set();
  for (const n of refToc) {
    if (n.unit) continue;
    const sid = idOf(n);
    const units = desc.get(sid) || new Set();
    const h = normText(n.heading || '');
    const e = tocMap.get(sid);
    let pick = null;
    if (e && !claimed.has(sid) && e.heading && (normText(lastHead(e, ref) || '') === h || overlap(e._units, units) >= 0.5 || (!e._units || !e._units.size) && !units.size)) pick = sid;
    if (!pick) {
      for (const x of tocMap.values()) {
        if (!x.heading || claimed.has(x.id) || x.type !== n.type || x.id === sid) continue;
        if (normText(lastHead(x, ref) || '') === h && h && (overlap(x._units, units) > 0 || !units.size)) { pick = x.id; break; }
      }
      if (pick) log.push({ code: 'toc-renumbered', stage: stage.id, id: sid, to: pick, label: plain(n.label || '') });
    }
    if (!pick && e) { let i = 2; while (tocMap.has(`${sid}+${i}`) || claimed.has(`${sid}+${i}`)) i++; pick = `${sid}+${i}`; log.push({ code: 'toc-new-entity', stage: stage.id, id: sid, to: pick, label: plain(n.label || '') }); }
    if (!pick) pick = sid;
    stable.set(sid, pick);
    claimed.add(pick);
  }
  const refAnchors = anchor(refToc);
  const refNodes = refToc.map((n, i) => ({ n, a: refAnchors[i] })).filter((x) => !x.n.unit);
  const seq = [];
  const inSeq = new Set();
  const order = [ref, ...pl.filter((l) => l !== ref)];
  for (const l of order) {
    const toc = parsed[l].toc;
    const an = anchor(toc);
    // Knoten dieser Sprache auf Knoten der Bezugssprache abbilden (Id, sonst Typ + Nummer + folgende Einheit)
    const m = new Map();
    const usedRef = new Set();
    if (l === ref) toc.forEach((n, i) => { if (!n.unit) m.set(i, stable.get(idOf(n))); });
    else {
      const nodes = toc.map((n, i) => ({ n, a: an[i], i })).filter((x) => !x.n.unit);
      for (const x of nodes) { const id = idOf(x.n); const r = refNodes.find((y) => idOf(y.n) === id && !usedRef.has(id)); if (r) { m.set(x.i, stable.get(id)); usedRef.add(id); } }
      for (const x of nodes) {
        if (m.has(x.i)) continue;
        const cand = refNodes.filter((r) => !usedRef.has(idOf(r.n)) && r.n.type === x.n.type && r.n.num === x.n.num && r.a === x.a);
        if (cand.length === 1) { const rid = idOf(cand[0].n); m.set(x.i, stable.get(rid)); usedRef.add(rid); log.push({ code: 'toc-map', stage: stage.id, lang: l, from: idOf(x.n), to: stable.get(rid) }); }
        else { const own = `${idOf(x.n)}@${l}`; m.set(x.i, own); log.push({ code: 'toc-unmatched', stage: stage.id, lang: l, id: idOf(x.n), label: plain(x.n.label || '') }); }
      }
    }
    const pmap = new Map();
    toc.forEach((n, i) => { if (!n.unit) pmap.set(idOf(n), m.get(i)); });
    const ancL = an.map((a) => (a ? unitId(a) : null));
    let prevId = null;
    toc.forEach((n, i) => {
      const tid = n.unit ? unitId(n.id) : m.get(i);
      const parent = n.parent ? (pmap.get(n.parent) || null) : null;
      let e = tocMap.get(tid);
      if (!e) {
        if (n.unit) { const u = unitsBy[l].get(tid); e = { id: tid, type: n.type, parent, num: (u && u.num) || null, from: stage.id, to: null }; }
        else e = { id: tid, type: n.type, parent, num: n.num || null, heading: {}, from: stage.id };
        tocMap.set(tid, e);
      } else if (l === ref) { e.parent = parent; if (!n.unit) { e.num = n.num || null; e.type = n.type; } }
      if (!inSeq.has(tid)) {
        const at = prevId ? seq.indexOf(prevId) + 1 : 0;
        seq.splice(at, 0, tid);
        inSeq.add(tid);
      }
      if (!n.unit) {
        const arr = e.heading[l] || (e.heading[l] = []);
        const last = arr[arr.length - 1];
        const label = n.label || '', text = n.heading || '';
        const at = ancL[i] || null;
        if (!last || last.gone || normText(last.text) !== normText(text) || normText(last.label) !== normText(label) || normText(last.sub || '') !== normText(n.sub || '') || (last.at || null) !== at || (last.parent || null) !== parent || fnKey(last.fn) !== fnKey(n.fn)) {
          const h = { from: stage.id, label, text, at, parent };
          if (n.sub) h.sub = n.sub;
          if (n.fn) h.fn = n.fn;
          if (last && !last.gone && normText(last.text) === normText(text) && normText(last.label) === normText(label) && normText(last.sub || '') === normText(n.sub || '')) { h.text = last.text; h.label = last.label; if (last.sub) h.sub = last.sub; h.same = true; }
          arr.push(h);
        }
        if (l === ref) e._units = desc.get(idOf(n)) || new Set();
      } else if (e.to) e.to = null;
      (e._seen || (e._seen = new Set())).add(l);
      prevId = tid;
    });
  }
  // Fehlende Einheiten bzw. Titel: Ende markieren
  for (const e of tocMap.values()) {
    if (!e.heading) { if (!(e._seen && e._seen.size) && e.to === null) e.to = stage.id; }
    else for (const l of pl) {
      const arr = e.heading[l];
      if (!arr || !arr.length) continue;
      if (!(e._seen && e._seen.has(l)) && !arr[arr.length - 1].gone) arr.push({ from: stage.id, label: '', text: '', gone: true });
    }
    delete e._seen;
  }
  // Reihenfolge: dieser Stand ist massgebend; Knoten, die nur in früheren Ständen vorkommen, nach ihrem Vorgänger
  const old = tocOrder.slice();
  const res = seq.slice();
  const pos = new Set(res);
  for (let i = 0; i < old.length; i++) {
    const id = old[i];
    if (pos.has(id)) continue;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const k = res.indexOf(old[j]); if (k >= 0) { at = k + 1; break; } }
    res.splice(at, 0, id);
    pos.add(id);
  }
  tocOrder.length = 0;
  tocOrder.push(...res);
}

// ------------------------------------------------------------------ Herkunft prüfen, Erlasse je Stand, redaktionelle Abweichungen

function inInterval(d, from, to) { return !!d && (from === null || d > from) && d <= to; }

function annotate(ds, impacts, log) {
  const stages = ds.stages;
  const byUnit = new Map();
  for (const im of impacts) if (im.unit) { if (!byUnit.has(im.unit)) byUnit.set(im.unit, []); byUnit.get(im.unit).push(im); }
  ds._editorial = [];
  for (let si = 0; si < stages.length; si++) {
    const st = stages[si];
    const from = si > 0 ? stages[si - 1].date : null;
    const acts = new Set();
    if (si > 0) {
      for (const [uid, u] of Object.entries(ds.units)) {
        for (const l of ds.langs) {
          const vsl = u.versions[l];
          if (!vsl) continue;
          const i = vsl.findIndex((v) => v.stage === st.id);
          if (i < 0) continue;
          const cur = vsl[i];
          const prev = i > 0 ? vsl[i - 1] : null;
          const unitImp = (byUnit.get(uid) || []).filter((im) => inInterval(im.inForce, from, st.date));
          const fnCover = (b) => {
            const fs = [...(b.fn || []), ...(cur.fn || [])].filter((f) => f.kind === 'amend' || f.kind === 'corr');
            return fs.some((f) => inInterval(f.inForce, from, st.date)) || (b.o && b.o !== ds.work.base && unitImp.some((im) => im.act === b.o));
          };
          // Herkunft gehört nur dann zu den Erlassen des Stands, wenn ihr eigener Hinweis bzw. ein Impact in das Intervall fällt
          const originHere = (b) => {
            if (!b.o || b.o === ds.work.base) return false;
            const fs = [...(b.fn || []), ...(cur.fn || [])].filter((f) => (f.kind === 'amend' || f.kind === 'corr') && f.act === b.o);
            return fs.some((f) => inInterval(f.inForce, from, st.date)) || unitImp.some((im) => im.act === b.o);
          };
          const pm = new Map(((prev && prev.blocks) || []).map((b) => [b.k, b]));
          for (const b of cur.blocks) {
            const p = pm.get(b.k);
            if (p && sameBlock(p, b)) continue;
            const newCorr = (b.fn || []).some((f) => f.kind === 'corr' && !((p && p.fn) || []).some((g) => normText(g.t) === normText(f.t)));
            const covered = b.x === 'origin' || fnCover(b) || unitImp.length > 0 || newCorr;
            if (!covered) {
              b.x = 'editorial';
              ds._editorial.push({ stage: st.id, unit: uid, lang: l, key: b.k, before: p ? p.t : null, after: b.t, o: b.o });
            } else if (originHere(b)) acts.add(b.o);
          }
          if (cur.o && (!prev || prev.o !== cur.o) && originHere({ o: cur.o, fn: [] })) acts.add(cur.o);
        }
      }
    }
    if (si > 0) for (const im of impacts) if (inInterval(im.inForce, from, st.date)) acts.add(im.act);
    acts.delete(null); acts.delete(undefined);
    if (si > 0) acts.delete(ds.work.base);
    st.acts = [...acts].sort();
  }
}

// ------------------------------------------------------------------ Erlasse

const ACT_RE = /^oc\/\d{4}\/[^/]+$/;
// Kurzbezeichnung des Erlasses aus der Fussnote: «BG vom 16. Dez. 2016 (Integration)», «LF du 16 déc. 2016», «DF del 13 giu. 2008».
// Ohne erkennbare Bezeichnung mit Datum: null (nie ein Satzrest).
const LABEL_RE = /(?:^|[\s’'(])((?:[A-ZÄÖÜÉ][A-Za-zÄÖÜäöüéèàç-]*\.?)(?:\s[A-ZÄÖÜ][A-Za-zÄÖÜäöü-]*\.?)?)\s(?:vom|du|del|dell[’']|de)\s?(\d{1,2}(?:er|°|º)?\.?\s[A-Za-zÄÖÜäöüéèûôàç]+\.?\s\d{4})((?:\s(?:über|betreffend|zur|zum|sur|sul|sulla|sullo|sugli|sulle|concernant|relatif|relative|portant|che|concernente|concernenti|relativo|relativa)\s[^,;()]{2,140})?(?:\s\([^()]{2,90}\))?)/;
const LABEL_WORD = /^(BG|BB|BRB|V|VO|VV|ZGB|OR|StGB|BV|Bundesgesetz|Bundesbeschluss|Verordnung|LF|AF|O|OF|ACF|ODF|L|DF|DCF|OCF|LCF|Legge|Loi|Ordonnance|Ordinanza|Decreto|Arrêté|Beschluss|Reglement|Règlement|Regolamento|Notenaustausch|Abkommen|Accord|Accordo|[A-ZÄÖÜ][A-Za-zÄÖÜäöü]*(?:gesetz|verordnung|beschluss|vertrag|abkommen))$/;
export function actLabelFromFn(label) {
  if (!label) return null;
  const m = LABEL_RE.exec(label);
  if (!m) return null;
  const word = m[1].replace(/\.$/, '');
  if (!LABEL_WORD.test(word.split(' ')[0].replace(/\.$/, '')) && !LABEL_WORD.test(word)) return null;
  const conn = /\s(vom|du|del|dell[’']|de)\s?/.exec(label.slice(m.index))[1];
  const head = `${m[1]} ${conn}${/[’']$/.test(conn) ? '' : ' '}${m[2]}`;
  // Rest der Bezeichnung nach dem Datum: bis zum Ende des Hinweistexts, damit der Name nicht mitten im Titel endet
  // («… betreffend die Übernahme der Verordnung (EU) 2018/1240 über … (ETIAS)»). Nur bei ausgeglichenen Klammern und
  // ohne Angaben zum Inkrafttreten; sonst gilt der vorsichtige Treffer des Musters.
  const dateEnd = label.indexOf(m[2], m.index) + m[2].length;
  let rest = label.slice(dateEnd).replace(/(?:[,;]\s*|\s+)(?:in Kraft|mit Wirkung|en vigueur|avec effet|in vigore|con effetto)\s[\s\S]*$/, '').replace(/[\s.,;]+$/, '');
  const balanced = (rest.match(/\(/g) || []).length === (rest.match(/\)/g) || []).length;
  const tail = rest && /^\s/.test(rest) && balanced && rest.length <= 420 ? rest : (m[3] || '');
  return `${head}${tail}`.replace(/\s+/g, ' ').trim();
}

// Text aus Metadaten: nur <i> <b> <sup> <sub> bleiben, alles andere wird maskiert
function safeInline(s) {
  return String(s).replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;').replace(/<(\/?)(i|b|sup|sub)>/g, '\u0001$1$2\u0002').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u0001/g, '<').replace(/\u0002/g, '>');
}
const IMPACT_ACTION = { 1: 'amended', 2: 'repealed', 5: 'other', 6: 'other', 7: 'other' };

function buildActs(ds, impacts, actsMeta, parsedFirst, log) {
  const acts = new Map();
  const get = (id) => {
    if (!acts.has(id)) acts.set(id, { id, kind: id === ds.work.base ? 'base' : 'amendment', as: {}, title: {}, label: {}, dateDocument: null, inForce: new Set(), bbl: new Map(), url: ELI + id, changes: [], _corr: 0, _amend: 0 });
    return acts.get(id);
  };
  if (ds.work.base) get(ds.work.base);
  const noteFn = (f, lang) => {
    if (!f.act || !ACT_RE.test(f.act)) return;
    const a = get(f.act);
    if (f.kind === 'corr') a._corr++; else a._amend++;
    if (f.inForce) a.inForce.add(f.inForce);
    if (f.as && !a.as[lang]) a.as[lang] = f.as;
    const lab = actLabelFromFn(f.label);
    if (lab && !a.label[lang]) a.label[lang] = safeInline(lab);
    const re = /<a href="(https:\/\/fedlex\.data\.admin\.ch\/eli\/fga\/[^"]+)">([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(f.t))) if (!a.bbl.has(m[1])) a.bbl.set(m[1], plain(m[2]));
  };
  // Alle Fussnoten aller Versionen
  for (const u of Object.values(ds.units)) for (const [l, vsl] of Object.entries(u.versions)) for (const v of vsl) for (const f of fnsOf(v)) noteFn(f, l);
  for (const e of ds.toc) if (e.heading) for (const [l, arr] of Object.entries(e.heading)) for (const h of arr) for (const f of h.fn || []) noteFn(f, l);
  // Änderungen aus den Ständen (Diff)
  const stIdx = new Map(ds.stages.map((s, i) => [s.id, i]));
  const changeKey = (c) => `${c.unit}|${c.key}|${c.stage}`;
  const addChange = (actId, c, src) => {
    if (!actId || !ACT_RE.test(actId)) return;
    const a = get(actId);
    const ex = a.changes.find((x) => changeKey(x) === changeKey(c));
    if (ex) { for (const s of src) if (!ex.src.includes(s)) ex.src.push(s); if (!ex.inForce && c.inForce) ex.inForce = c.inForce; return; }
    a.changes.push({ ...c, src: [...src] });
  };
  for (const [uid, u] of Object.entries(ds.units)) {
    for (const l of ds.langs) {
      const vsl = u.versions[l] || [];
      for (let i = 0; i < vsl.length; i++) {
        const v = vsl[i], p = i > 0 ? vsl[i - 1] : null;
        const si = stIdx.get(v.stage);
        if (si === 0) continue;
        const pm = new Map(((p && p.blocks) || []).map((b) => [b.k, b]));
        if (v.o && (!p || p.o !== v.o || normText(p.title || '') !== normText(v.title || ''))) {
          const f = (v.fn || []).find((x) => x.act === v.o);
          addChange(v.o, { unit: uid, key: null, action: v.repealed ? 'repealed' : (v.ch || 'replaced'), inForce: f && f.inForce || null, stage: v.stage }, ['footnote', 'diff']);
        }
        for (const b of v.blocks) {
          const q = pm.get(b.k);
          if (q && sameBlock(q, b)) continue;
          if (b.x === 'editorial') continue;
          if (!b.o || b.o === ds.work.base) continue;
          const f = (b.fn || []).find((x) => x.act === b.o) || (v.fn || []).find((x) => x.act === b.o);
          addChange(b.o, { unit: uid, key: b.k, action: q ? (b.ch || 'replaced') : (b.ch === 'repealed' ? 'repealed' : (b.ch || 'inserted')), inForce: f && f.inForce || null, stage: v.stage }, ['footnote', 'diff']);
        }
      }
    }
  }
  // Ereignisse vor der XML-Zeit: Fussnoten des ersten Stands (zeigen je Bestimmung nur die jüngste Änderung)
  const first = ds.stages[0];
  if (first) {
    for (const [uid, u] of Object.entries(ds.units)) {
      for (const l of ds.langs) {
        const v = (u.versions[l] || []).find((x) => x.stage === first.id);
        if (!v) continue;
        if (v.o && v.o !== ds.work.base) {
          const f = (v.fn || []).find((x) => x.act === v.o);
          addChange(v.o, { unit: uid, key: null, action: v.repealed ? 'repealed' : (v.ch || 'replaced'), inForce: f && f.inForce || null, stage: null }, ['footnote']);
        }
        for (const b of v.blocks) {
          if (!b.o || b.o === ds.work.base) continue;
          const f = (b.fn || []).find((x) => x.act === b.o) || (v.fn || []).find((x) => x.act === b.o);
          addChange(b.o, { unit: uid, key: b.k, action: b.ch || 'replaced', inForce: f && f.inForce || null, stage: null }, ['footnote']);
        }
      }
    }
  }
  const stageOfDate = (d) => {
    if (!d || !ds.stages.length) return null;
    for (let i = 1; i < ds.stages.length; i++) if (d > ds.stages[i - 1].date && d <= ds.stages[i].date) return ds.stages[i].id;
    return null;
  };
  // Mehrteilige Änderungshinweise («Eingefügt durch A … Fassung gemäss B …»): jeder frühere Teil als eigenes Ereignis
  const EV_ACTION = { inserted: 'inserted', replaced: 'replaced', repealed: 'repealed', term: 'term', corrected: 'amended', extended: 'amended' };
  const seenFn = new Set();
  for (const [uid, u] of Object.entries(ds.units)) {
    for (const l of ds.langs) {
      for (const v of u.versions[l] || []) {
        const items = [...(v.fn || []).map((f) => [null, f]), ...v.blocks.flatMap((b) => (b.fn || []).map((f) => [b.k, f]))];
        for (const [key, f] of items) {
          if (!f.events || f.events.length < 2 || (f.kind !== 'amend' && f.kind !== 'corr')) continue;
          const sig = `${uid}|${key}|${normText(plain(f.t))}`;
          if (seenFn.has(sig)) continue;
          seenFn.add(sig);
          for (const ev of f.events) {
            if (!ev.act || ev.act === f.act && ev.action === f.action && (ev.inForce || null) === (f.inForce || null)) continue;
            const imp = impacts.find((im) => im.act === ev.act && im.unit === uid && im.inForce);
            const inForce = ev.inForce || (imp ? imp.inForce : null);
            const stage = inForce ? stageOfDate(inForce) : (v.stage === (ds.stages[0] && ds.stages[0].id) ? null : v.stage);
            addChange(ev.act, { unit: uid, key, action: ev.partial ? 'amended' : (EV_ACTION[ev.action] || 'other'), inForce, stage, part: true }, ['footnote']);
          }
        }
      }
    }
  }
  // Impact-Metadaten
  for (const im of impacts) {
    if (!im.act || !ACT_RE.test(im.act)) continue;
    const a = get(im.act);
    if (im.inForce) a.inForce.add(im.inForce);
    if (im.label) for (const [l, s] of Object.entries(im.label)) if (s && !a.as[l]) a.as[l] = s;
    const c = { unit: im.unit || null, key: null, action: im.action || IMPACT_ACTION[im.type] || 'other', inForce: im.inForce || null, stage: stageOfDate(im.inForce) };
    if (im.comment) c.comment = im.comment;
    if (im.type) c.impactType = im.type;
    if (im.dateRaw) c.impactDate = im.dateRaw;
    // mit vorhandener Änderung derselben Einheit im selben Stand zusammenführen
    const ex = a.changes.find((x) => x.unit === c.unit && x.stage === c.stage && c.unit);
    if (ex) { if (!ex.src.includes('impact')) ex.src.push('impact'); if (!ex.inForce) ex.inForce = c.inForce; continue; }
    if (a.changes.some((x) => x.src.includes('impact') && x.unit === c.unit && x.stage === c.stage && x.action === c.action && x.inForce === c.inForce && x.comment === c.comment)) continue;
    a.changes.push({ ...c, src: ['impact'] });
  }
  // Metadaten der Erlasse
  const out = [];
  for (const a of acts.values()) {
    const m = actsMeta[a.id] || {};
    if (a.kind !== 'base' && a._corr && !a._amend) a.kind = 'corrigendum';
    if (m.kind && a.kind !== 'base') a.kind = m.kind;
    const as = { ...a.as, ...(m.as || {}) };
    const title = {};
    for (const l of ds.langs) title[l] = (m.title && m.title[l]) ? safeInline(m.title[l]) : (a.label[l] || null);
    const label = {};
    for (const l of ds.langs) label[l] = a.label[l] || null;
    const changes = a.changes.sort((x, y) => (x.inForce || '').localeCompare(y.inForce || '') || String(x.unit).localeCompare(String(y.unit)) || String(x.key).localeCompare(String(y.key)));
    out.push({
      id: a.id, kind: a.kind,
      as: Object.fromEntries(ds.langs.map((l) => [l, as[l] || null])),
      title, label,
      dateDocument: m.dateDocument || null,
      inForce: [...a.inForce].sort(),
      bbl: [...a.bbl].map(([url, lab]) => ({ label: lab, url })),
      url: a.url,
      changes,
    });
  }
  out.sort((x, y) => (x.kind === 'base' ? -1 : y.kind === 'base' ? 1 : 0) || ((x.inForce[0] || '9') + x.id).localeCompare((y.inForce[0] || '9') + y.id));
  ds.acts = out;
}

// ------------------------------------------------------------------ Zeitstrahl

function buildTimeline(ds, vs, impacts) {
  const stageIds = new Set(ds.stages.map((s) => s.id));
  const prevDate = new Map();
  ds.timeline = vs.map((v, i) => {
    const from = i > 0 ? vs[i - 1].date : null;
    prevDate.set(v.date, from);
    const acts = new Set();
    for (const im of impacts) if (inInterval(im.inForce, from, v.date)) acts.add(im.act);
    for (const a of ds.acts) if (a.kind !== 'base' && a.inForce.some((d) => inInterval(d, from, v.date))) acts.add(a.id);
    if (i === 0 && ds.work.base) acts.add(ds.work.base);
    acts.delete(undefined); acts.delete(null);
    const id = sd(v.date);
    return {
      date: v.date, end: v.end || null, stage: stageIds.has(id) ? id : null,
      pdf: Object.fromEntries(ds.langs.map((l) => [l, (v.files && v.files[l] && v.files[l].pdf) || null])),
      acts: [...acts].sort(),
    };
  });
  // Erster Stand: Erlasse seit der vorangehenden Fassung (ohne XML) laut Metadaten
  const first = ds.stages[0];
  if (first) {
    const t = ds.timeline.find((x) => x.date === first.date);
    first.acts = t ? t.acts.filter((a) => a !== ds.work.base || ds.timeline[0] === t) : [];
  }
}

// ------------------------------------------------------------------ Hinweise

function buildNotes(ds, log) {
  const notes = [];
  if (ds.stages.length) {
    const d = ds.stages[0].date;
    notes.push({ code: 'before-xml', stage: ds.stages[0].id, text: NOTE_TEXT.beforeXml(d) });
    notes.push({ code: 'footnote-latest-only', text: NOTE_TEXT.latestOnly() });
    notes.push({ code: 'typography', text: NOTE_TEXT.typography() });
  }
  for (const s of ds.stages) if (s.gap > 0) notes.push({ code: 'gap', stage: s.id, text: NOTE_TEXT.gap(s.gap) });
  // Auffälligkeiten der Quelle (zusammengefasst je Code, Stand, Sprache)
  const agg = new Map();
  for (const e of log) {
    if (!['pseudo-annex', 'dup-key', 'dup-unit', 'orphan-text', 'unknown-element', 'lang-mismatch', 'lang-unit', 'unit-missing', 'parse-error', 'rekey-ambiguous', 'toc-unmatched', 'key-from-text', 'article-head-in-text'].includes(e.code)) continue;
    const k = `${e.code}|${e.stage || ''}|${e.lang || ''}`;
    if (!agg.has(k)) agg.set(k, { code: e.code, stage: e.stage || null, lang: e.lang || null, count: 0, examples: [] });
    const a = agg.get(k);
    a.count++;
    if (a.examples.length < 5) a.examples.push(e.unit ? `${e.unit}${e.key ? ' ' + e.key : ''}` : (e.text || e.id || ''));
  }
  const DESC = {
    'pseudo-annex': 'Gliederungstitel in der Quelle als Anhang ausgezeichnet; Einheiten unverändert übernommen',
    'dup-key': 'Doppelter Schlüssel in der Quelle; mit «~n» eindeutig gemacht',
    'dup-unit': 'Einheit doppelt in der Quelle; mit «~n» eindeutig gemacht',
    'orphan-text': 'Text ausserhalb einer Einheit; als eigene Einheit übernommen',
    'unknown-element': 'Unbekanntes Element; Inhalt als Text übernommen',
    'lang-mismatch': 'Gliederung der Bestimmung weicht zwischen den Sprachen ab',
    'lang-unit': 'Einheit fehlt in einer Sprachfassung dieses Stands',
    'unit-missing': 'Einheit fehlt in der Quelle dieses Stands',
    'parse-error': 'Datei nicht lesbar',
    'rekey-ambiguous': 'Zuordnung zur Vorfassung mehrdeutig; nicht übernommen',
    'toc-unmatched': 'Gliederungstitel ohne Gegenstück in der Bezugssprache',
    'key-from-text': 'Gliederungszeichen steht in der Quelle im Text; Schlüssel daraus abgeleitet',
    'article-head-in-text': 'Quelle fehlerhaft ausgezeichnet: Der Kopf eines anderen Artikels steht im Text dieser Einheit; Wortlaut unverändert übernommen',
  };
  for (const a of agg.values()) notes.push({ code: a.code, stage: a.stage, lang: a.lang, count: a.count, examples: a.examples, text: { de: DESC[a.code] } });
  ds.notes = notes;
  delete ds._editorial;
  delete ds._prevTimeline;
}

// ------------------------------------------------------------------ Abfragen

function orderMap(ds) { return new Map(ds.stages.map((s) => [s.id, s.order])); }

export function getVersion(ds, unitId, lang, stageId) {
  const u = ds.units[unitId];
  if (!u || !u.versions[lang]) return null;
  const om = orderMap(ds);
  const target = om.get(stageId);
  if (target === undefined) return null;
  let best = null;
  for (const v of u.versions[lang]) if (om.get(v.stage) <= target) best = v;
  return best;
}

// Gliederung eines Stands in einer Sprache: Gliederungstitel vor ihrer ersten Einheit (heading[].at), Einheiten in Reihenfolge
const RANK = { part: 0, title: 1, chapter: 2, section: 3 };
export function headingAt(ds, entry, lang, stageId) {
  const arr = entry.heading && entry.heading[lang];
  if (!arr) return null;
  const om = orderMap(ds);
  const t = om.get(stageId);
  let best = null;
  for (const h of arr) if (om.get(h.from) <= t) best = h;
  return best && !best.gone ? best : null;
}
export function tocAt(ds, stageId, lang) {
  const units = [], heads = [];
  for (const e of ds.toc) {
    if (e.heading) { const h = headingAt(ds, e, lang, stageId); if (h) heads.push({ e, h }); }
    else { const v = getVersion(ds, e.id, lang, stageId); if (v && !v.missing) units.push(e); }
  }
  const present = new Set(units.map((u) => u.id));
  const byAt = new Map();
  const tail = [];
  for (const x of heads) { if (x.h.at && present.has(x.h.at)) { if (!byAt.has(x.h.at)) byAt.set(x.h.at, []); byAt.get(x.h.at).push(x); } else tail.push(x); }
  const out = [];
  const stack = [];
  const emitHead = (x) => {
    const r = RANK[x.e.type] ?? 3;
    while (stack.length && (RANK[stack[stack.length - 1].type] ?? 3) >= r) stack.pop();
    out.push({ id: x.e.id, type: x.e.type, parent: x.h.parent ?? (stack.length ? stack[stack.length - 1].id : null), num: x.e.num, label: x.h.label, text: x.h.text, sub: x.h.sub || null, fn: x.h.fn || null, depth: stack.length });
    stack.push(x.e);
  };
  for (const u of units) {
    for (const x of byAt.get(u.id) || []) emitHead(x);
    const own = u.type === 'article';
    out.push({ id: u.id, type: u.type, parent: own ? (stack.length ? stack[stack.length - 1].id : null) : u.parent, num: u.num, unit: true, depth: own ? stack.length : 0 });
  }
  for (const x of tail) emitHead(x);
  return out;
}

export function stageAt(ds, isoDate) {
  let best = null;
  for (const s of ds.stages) if (s.date <= isoDate) best = s.id;
  return best;
}

function changeOf(prev, cur, isFirst, unitRepealed) {
  if (!prev && cur) return isFirst ? 'base' : 'inserted';
  if (prev && !cur) return unitRepealed ? 'repealed' : 'deleted';
  if (cur.x === 'editorial') return 'editorial';
  if (cur.ch === 'repealed') return 'repealed';
  if (cur.ch === 'amended' || cur.ch === 'term') return 'amended';
  if (cur.ch === 'inserted' && !prev) return 'inserted';
  return 'replaced';
}

export function blockHistory(ds, unitId, lang, key) {
  const u = ds.units[unitId];
  if (!u || !u.versions[lang]) return [];
  const firstId = ds.stages.length ? ds.stages[0].id : null;
  const res = [];
  let prev = null;
  for (const v of u.versions[lang]) {
    const b = v.missing ? null : (v.blocks.find((x) => x.k === key) || null);
    if (!prev && !b) continue;
    if (prev && b && sameBlock(prev, b)) { prev = b; continue; }
    const change = changeOf(prev, b, v.stage === firstId, !!v.repealed);
    res.push({ stage: v.stage, act: b ? b.o : (v.o || null), change, block: b });
    prev = b;
  }
  return res;
}

export function changesOfStage(ds, stageId, lang) {
  const res = [];
  const firstId = ds.stages.length ? ds.stages[0].id : null;
  if (stageId === firstId) return res;
  for (const e of ds.toc) {
    const u = ds.units[e.id];
    if (!u || !u.versions[lang]) continue;
    const vsl = u.versions[lang];
    const i = vsl.findIndex((v) => v.stage === stageId);
    if (i < 0) continue;
    const cur = vsl[i], prev = i > 0 ? vsl[i - 1] : null;
    if (!prev) { res.push({ unit: e.id, key: null, change: 'inserted', act: cur.o || null }); for (const b of cur.blocks) res.push({ unit: e.id, key: b.k, change: 'inserted', act: b.o }); continue; }
    if (cur.missing && !prev.missing) { res.push({ unit: e.id, key: null, change: 'deleted', act: null, mergedInto: cur.mergedInto || null, splitInto: cur.splitInto || null }); continue; }
    if (prev.missing && !cur.missing) res.push({ unit: e.id, key: null, change: 'inserted', act: cur.o || null });
    if (cur.repealed && !prev.repealed) res.push({ unit: e.id, key: null, change: 'repealed', act: cur.o || null });
    if (normText(prev.title || '') !== normText(cur.title || '')) res.push({ unit: e.id, key: '_title', change: 'replaced', act: cur.o || null });
    const pm = new Map(prev.blocks.map((b) => [b.k, b]));
    const cm = new Set(cur.blocks.map((b) => b.k));
    for (const b of cur.blocks) {
      const p = pm.get(b.k);
      if (!p) res.push({ unit: e.id, key: b.k, change: b.x === 'editorial' ? 'editorial' : 'inserted', act: b.o });
      else if (!sameBlock(p, b)) res.push({ unit: e.id, key: b.k, change: changeOf(p, b, false, false), act: b.o });
    }
    for (const b of prev.blocks) if (!cm.has(b.k)) res.push({ unit: e.id, key: b.k, change: 'deleted', act: cur.o || null });
  }
  return res;
}

export function unitEvents(ds, unitId) {
  const res = [];
  for (const a of ds.acts || []) for (const c of a.changes) if (c.unit === unitId) res.push({ date: c.inForce || null, act: a.id, action: c.action, key: c.key, stage: c.stage, src: c.src });
  res.sort((x, y) => (x.date || '').localeCompare(y.date || '') || x.act.localeCompare(y.act) || String(x.key).localeCompare(String(y.key)));
  return res;
}

export function unitActs(ds, unitId, lang) {
  const set = new Set();
  const u = ds.units[unitId];
  if (u && u.versions[lang]) for (const v of u.versions[lang]) { if (v.o) set.add(v.o); for (const b of v.blocks) if (b.o) set.add(b.o); }
  for (const e of unitEvents(ds, unitId)) set.add(e.act);
  const order = new Map((ds.acts || []).map((a, i) => [a.id, i]));
  return [...set].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
}
