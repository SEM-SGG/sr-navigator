// Reine Funktionen für den Einbau neuer Fassungen (scripts/apply-fassungen.mjs) und den Pull Request dazu
// (scripts/fassungen-pr.mjs): Version, Changelog, Fingerabdruck des Befunds, Vergleich der Bibliothek vor und nach dem
// Einbau, Urteil über die Prüfberichte und Text des Pull Requests. Kein Netz, kein Dateizugriff.
import { createHash } from 'node:crypto';
import { getVersion, changesOfStage } from '../../src/core/model.js';
import { normText } from '../../src/core/text.js';

export const LANG_NAMES = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch' };
export const LANG_ORDER = ['de', 'fr', 'it'];

/** Datum JJJJ-MM-TT als «1. Oktober 2026». */
export const fmtDate = (iso) => new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
/** Stand JJJJMMTT als JJJJ-MM-TT. */
export const stageDate = (id) => `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
/** Heutiges Datum in Zürich als JJJJ-MM-TT. */
export const todayZurich = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);

/** «a», «a und b», «a, b und c» */
export function joinDe(items) {
  const a = [...items];
  if (a.length <= 1) return a.join('');
  return a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
}
const langList = (langs) => joinDe(LANG_ORDER.filter((l) => langs.includes(l)).map((l) => LANG_NAMES[l]));
const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

// ------------------------------------------------------------------ Version und Changelog

/** 1.3.1 -> 1.3.2 */
export function bumpPatch(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  if (!m) throw new Error(`Version «${version}» hat nicht die Form 1.2.3.`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/**
 * Erhöht die Version in package.json und package-lock.json (Wurzel und packages[""]) und lässt den übrigen Text
 * unverändert. Ergebnis { version, pkg, lock } mit den neuen Texten.
 */
export function bumpVersionFiles(pkgText, lockText) {
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);
  const from = pkg.version;
  const version = bumpPatch(from);
  if (lock.version !== from || !lock.packages || !lock.packages[''] || lock.packages[''].version !== from) {
    throw new Error(`package-lock.json nennt nicht die Version ${from} aus package.json. Führe «npm install» aus und committe die Lock-Datei.`);
  }
  const re = new RegExp(`("version"\\s*:\\s*)"${from.replace(/\./g, '\\.')}"`);
  const pkgOut = pkgText.replace(re, `$1"${version}"`);
  let n = 0;
  const lockOut = lockText.replace(new RegExp(re.source, 'g'), (m, p) => (n++ < 2 ? `${p}"${version}"` : m));
  const p2 = JSON.parse(pkgOut), l2 = JSON.parse(lockOut);
  if (p2.version !== version || l2.version !== version || l2.packages[''].version !== version) throw new Error('Version liess sich nicht eindeutig ersetzen.');
  // Sonst darf sich nichts ändern
  p2.version = from; l2.version = from; l2.packages[''].version = from;
  if (JSON.stringify(p2) !== JSON.stringify(pkg) || JSON.stringify(l2) !== JSON.stringify(lock)) throw new Error('Beim Ersetzen der Version hätte sich mehr geändert.');
  return { from, version, pkg: pkgOut, lock: lockOut };
}

/** Fügt zuoberst in CHANGELOG.md den Abschnitt «## <version> (<Datum>)» mit den Zeilen ein. */
export function insertChangelog(markdown, version, dateText, lines) {
  if (!lines.length) throw new Error('Changelog ohne Einträge.');
  const md = String(markdown);
  if (md.split(/\r?\n/).some((l) => /^## /.test(l) && l.slice(3).trim().split(/\s+/)[0] === version)) throw new Error(`CHANGELOG.md hat schon einen Abschnitt ${version}.`);
  const section = `## ${version} (${dateText})\n\n${lines.map((l) => '- ' + l).join('\n')}\n\n`;
  const at = md.search(/^## /m);
  if (at >= 0) return md.slice(0, at) + section + md.slice(at);
  const head = /^# .*\n+/.exec(md);
  return head ? md.slice(0, head[0].length) + section + md.slice(head[0].length) : section + md;
}

// ------------------------------------------------------------------ Befund

/** Befundzeilen (scripts/check-fassungen.mjs) mit neuen Fassungen oder ersetzten Dateien. */
export const findingRows = (rows) => rows.filter((r) => !r.error && (r.newVersions.length || r.changedFiles.length));

/** Ersetzte Dateien je Stand: [{ stage, langs, files: [{ lang, url }] }] */
export function replacedStages(row) {
  const m = new Map();
  for (const c of row.changedFiles) {
    if (!m.has(c.stage)) m.set(c.stage, { stage: c.stage, langs: [], files: [] });
    const s = m.get(c.stage);
    if (!s.langs.includes(c.lang)) s.langs.push(c.lang);
    s.files.push({ lang: c.lang, url: c.url || null });
  }
  for (const s of m.values()) s.langs.sort((a, b) => LANG_ORDER.indexOf(a) - LANG_ORDER.indexOf(b));
  return [...m.values()].sort((a, b) => a.stage.localeCompare(b.stage));
}

/**
 * Fingerabdruck des Befunds: gleich, solange Fedlex dieselben Fassungen und Datei-Adressen führt und die
 * Ausgangsversion gleich bleibt. 16 Hex-Zeichen.
 */
export function fingerprint(rows, { version = '' } = {}) {
  const norm = findingRows(rows).map((r) => ({
    id: r.id,
    neu: [...r.newVersions].sort(),
    dateien: [...(r.newFiles || [])].map((f) => `${f.date}|${f.lang}|${f.url}`).sort(),
    ersetzt: r.changedFiles.map((c) => `${c.stage}|${c.lang}|${c.url || ''}`).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify({ version, befund: norm })).digest('hex').slice(0, 16);
}

export const FP_MARK = 'sr-fassungen-fingerabdruck';
export const STATUS_MARK = 'sr-fassungen-status';
/** Fingerabdruck aus dem Text eines Pull Requests, sonst null. */
export const fingerprintOf = (body) => { const m = new RegExp(`<!-- ${FP_MARK}: ([0-9a-f]+) -->`).exec(body || ''); return m ? m[1] : null; };
/** Status («ok» oder «fehler») aus dem Text eines Pull Requests, sonst null. */
export const statusOf = (body) => { const m = new RegExp(`<!-- ${STATUS_MARK}: (\\w+) -->`).exec(body || ''); return m ? m[1] : null; };

/**
 * Was der Lauf mit dem Pull Request tut. existing: offener Pull Request des Workflows auf dem Einbau-Zweig oder null.
 *   create  kein offener Pull Request
 *   update  anderer Befund, oder der letzte Einbau ist gescheitert (neuer Versuch)
 *   skip    derselbe Befund ist schon eingebaut
 */
export function planPr(existing, fp) {
  if (!existing) return 'create';
  if (fingerprintOf(existing.body) === fp && statusOf(existing.body) !== 'fehler') return 'skip';
  return 'update';
}

/** Fester Zweig für den Einbau. Gegen main: fassungen/einbau; sonst mit dem Namen des Zielzweigs. */
export function branchName(base, probelauf = false) {
  const b = String(base || 'main').replace(/[^0-9A-Za-z._-]+/g, '-');
  if (probelauf) return `fassungen/probelauf-${b}`;
  return b === 'main' ? 'fassungen/einbau' : `fassungen/einbau-${b}`;
}

/** Tabelle des Befunds wie im Issue. */
export function befundTable(rows) {
  const lines = ['| Erlass | SR | Neue Fassungen | Ersetzte Dateien |', '| --- | --- | --- | --- |'];
  for (const r of rows) {
    const neu = r.newVersions.length ? r.newVersions.map(fmtDate).join(', ') : 'keine';
    const ers = r.changedFiles.length ? r.changedFiles.map((c) => `${c.stage} (${c.lang.toUpperCase()})`).join(', ') : 'keine';
    lines.push(`| ${r.url ? `[${r.abbr}](${r.url})` : r.abbr} | ${r.sr} | ${r.error ? 'Prüfung fehlgeschlagen: ' + cell(r.error) : neu} | ${r.error ? '' : ers} |`);
  }
  return lines.join('\n');
}

/** Wie eine neue Fassung in der gebauten Bibliothek steht: text (Stand mit Wortlaut), ohne-xml (nur Zeitachse), fehlt. */
export function stageKind(bundle, date) {
  const stage = date.replace(/-/g, '');
  if (bundle.stages.some((x) => x.id === stage)) return 'text';
  return bundle.timeline.some((t) => t.date === date) ? 'ohne-xml' : 'fehlt';
}

/**
 * Zeilen für CHANGELOG.md, je Befund eine. kinds: { '<werk>|<datum>': text | ohne-xml | fehlt } aus der gebauten
 * Bibliothek (stageKind); ohne Angabe gilt text. Nur Fassungen mit Wortlaut heissen «enthält die neue Fassung».
 */
export function changelogLines(rows, kinds = {}) {
  const out = [];
  for (const r of findingRows(rows)) {
    const name = `${r.abbr} (SR ${r.sr})`;
    const kind = (date) => kinds[`${r.id}|${date}`] || 'text';
    const text = r.newVersions.filter((d) => kind(d) === 'text');
    if (text.length) {
      const d = joinDe(text.map(fmtDate));
      out.push(text.length === 1 ? `${name}: Der Navigator enthält die neue Fassung vom ${d}.` : `${name}: Der Navigator enthält die neuen Fassungen vom ${d}.`);
    }
    for (const date of r.newVersions.filter((d) => kind(d) === 'ohne-xml')) out.push(`${name}: Fedlex führt die Fassung vom ${fmtDate(date)} ohne Text im Format XML. Der Navigator zeigt sie auf der Zeitachse, ohne Wortlaut.`);
    for (const date of r.newVersions.filter((d) => kind(d) === 'fehlt')) out.push(`${name}: Die Fassung vom ${fmtDate(date)} liess sich nicht einbauen.`);
    for (const s of replacedStages(r)) {
      const what = s.langs.length === 1 ? `die Datei in ${langList(s.langs)}` : `die Dateien in ${langList(s.langs)}`;
      out.push(`${name}, Stand vom ${fmtDate(stageDate(s.stage))}: Fedlex hat ${what} neu veröffentlicht. Der Navigator enthält jetzt die neue${s.langs.length === 1 ? '' : 'n'} Datei${s.langs.length === 1 ? '' : 'en'}.`);
    }
  }
  return out;
}

/** Betreff von Commit und Pull Request, z. B. «SR-Navigator 1.3.2: VZAE-Fassung vom 1. Oktober 2026 nachgeführt». */
export function commitSubject(version, rows) {
  const f = findingRows(rows);
  const dates = (r) => [...new Set([...r.newVersions, ...r.changedFiles.map((c) => stageDate(c.stage))])].sort();
  let what;
  if (f.length === 1) {
    const d = dates(f[0]);
    what = d.length === 1 ? `${f[0].abbr}-Fassung vom ${fmtDate(d[0])} nachgeführt` : `${f[0].abbr}-Fassungen vom ${joinDe(d.map(fmtDate))} nachgeführt`;
  } else what = `Fassungen von ${joinDe(f.map((r) => r.abbr))} nachgeführt`;
  return `SR-Navigator ${version}: ${what}`;
}

// ------------------------------------------------------------------ Vergleich der Bibliothek

/** Bestimmung in Worten: p1.a -> «Abs. 1 Bst. a». Unbekannte Formen bleiben als Schlüssel stehen. */
export function keyLabel(key) {
  if (key === null || key === undefined) return 'ganze Bestimmung';
  if (key === '_title') return 'Titel';
  const parts = [];
  for (const seg of String(key).split('.')) {
    let m;
    if (seg === 'p') continue;
    if ((m = /^p(\d+[a-z]*)$/.exec(seg))) parts.push(`Abs. ${m[1]}`);
    else if ((m = /^n(\d+[a-z]*)$/.exec(seg))) parts.push(`Ziff. ${m[1]}`);
    else if ((m = /^d(\d+)$/.exec(seg))) parts.push(`Strich ${m[1]}`);
    else if (/^[a-z]{1,2}(bis|ter|quater|quinquies|sexies|septies|octies|novies|decies)?$/.test(seg)) parts.push(`Bst. ${seg}`);
    else return `Teil «${key}»`;
  }
  return parts.length ? parts.join(' ') : 'Text';
}

const CHANGE_DE = { inserted: 'eingefügt', replaced: 'geändert', amended: 'geändert', editorial: 'redaktionell geändert', deleted: 'gestrichen', repealed: 'aufgehoben', base: 'neu', fn: 'Fussnoten geändert' };

// Vergleich wie im Datenmodell: Text nach normText (rein typografische Unterschiede zählen nicht), Fussnoten als Menge
// ihrer Texte ohne Nummer.
const nt = (s) => normText(plain(s));
const fnSet = (list) => (list || []).map((f) => nt(f.t)).sort().join('\u0001');
const sameText = (a, b) => nt(a.t) === nt(b.t) && nt(a.l) === nt(b.l) && nt(a.html) === nt(b.html);
const canonVersion = (v) => (v ? JSON.stringify([nt(v.label), nt(v.title), !!v.missing, !!v.repealed, fnSet(v.fn), v.blocks.map((b) => [b.k, nt(b.l), nt(b.t), nt(b.html), fnSet(b.fn)])]) : null);
const unitLabel = (b, uid, lang, stage) => { const v = getVersion(b, uid, lang, stage); return (v && plain(v.label)) || uid; };

/**
 * Bestimmungen, deren Wortlaut oder Fussnoten im Stand sich zwischen alter und neuer Bibliothek unterscheiden
 * (ersetzte Datei). Rein typografische Unterschiede zählen nicht. Ergebnis [{ unit, label, changes: [{ key, change }] }]
 */
export function stageDiff(oldB, newB, stageId, lang) {
  const out = [];
  const ids = [...new Set([...newB.toc.map((e) => e.id), ...Object.keys(oldB.units), ...Object.keys(newB.units)])].filter((id) => oldB.units[id] || newB.units[id]);
  for (const uid of ids) {
    const a = oldB.units[uid] ? getVersion(oldB, uid, lang, stageId) : null;
    const b = newB.units[uid] ? getVersion(newB, uid, lang, stageId) : null;
    if (canonVersion(a) === canonVersion(b)) continue;
    const changes = [];
    const av = a && !a.missing ? a : null, bv = b && !b.missing ? b : null;
    if (!av && bv) changes.push({ key: null, change: 'inserted' });
    else if (av && !bv) changes.push({ key: null, change: 'deleted' });
    else if (av && bv) {
      if (nt(av.title) !== nt(bv.title) || nt(av.label) !== nt(bv.label)) changes.push({ key: '_title', change: 'replaced' });
      const pm = new Map(av.blocks.map((x) => [x.k, x]));
      const bm = new Set(bv.blocks.map((x) => x.k));
      for (const x of bv.blocks) {
        const p = pm.get(x.k);
        if (!p) changes.push({ key: x.k, change: 'inserted' });
        else {
          if (!sameText(p, x)) changes.push({ key: x.k, change: 'replaced' });
          if (fnSet(p.fn) !== fnSet(x.fn)) changes.push({ key: x.k, change: 'fn' });
        }
      }
      for (const x of av.blocks) if (!bm.has(x.k)) changes.push({ key: x.k, change: 'deleted' });
      if (fnSet(av.fn) !== fnSet(bv.fn)) changes.push({ key: null, change: 'fn' });
      if (!!av.repealed !== !!bv.repealed) changes.push({ key: null, change: bv.repealed ? 'repealed' : 'inserted' });
    }
    if (!changes.length) continue; // «fehlt» gegen «nicht vorhanden»: kein Unterschied im Wortlaut
    out.push({ unit: uid, label: unitLabel(b ? newB : oldB, uid, lang, stageId), changes });
  }
  return out;
}

/** Bestimmungen, die ein neuer Stand gegenüber dem Vorstand ändert (changesOfStage), je Bestimmung gruppiert. */
export function stageChanges(newB, stageId, lang) {
  const by = new Map();
  for (const c of changesOfStage(newB, stageId, lang)) {
    if (!by.has(c.unit)) by.set(c.unit, { unit: c.unit, label: unitLabel(newB, c.unit, lang, stageId), changes: [] });
    by.get(c.unit).changes.push({ key: c.key, change: c.change });
  }
  return [...by.values()];
}

/** «Art. 83a: Abs. 1 geändert, Fussnoten geändert» */
export function describeUnit(u) {
  const whole = u.changes.find((c) => c.key === null && c.change !== 'fn');
  if (whole) return `${u.label}: ${CHANGE_DE[whole.change] || whole.change}`;
  const parts = [];
  const seen = new Set();
  for (const c of u.changes) {
    const t = c.change === 'fn' ? (c.key === null ? 'Fussnoten geändert' : `Fussnoten zu ${keyLabel(c.key)} geändert`) : `${keyLabel(c.key)} ${CHANGE_DE[c.change] || c.change}`;
    if (!seen.has(t)) { seen.add(t); parts.push(t); }
  }
  return `${u.label}: ${parts.join(', ')}`;
}

// Was sich an einem Bundle ändern darf, ohne dass es inhaltlich geändert ist: Datumsangaben, Datei-Adressen, generator.
function stripAllowed(b) {
  const c = JSON.parse(JSON.stringify(b));
  delete c.fetched;
  for (const s of c.stages || []) { if (s.source) delete s.source.url; delete s.generator; }
  for (const t of c.timeline || []) delete t.pdf;
  return c;
}
function diffPaths(a, b, path = '', out = [], max = 12) {
  if (out.length >= max || a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) { out.push(path || '/'); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], `${path}/${k}`, out, max);
  return out;
}
const FIELD_DE = { units: 'Bestimmungen (Auszeichnung)', acts: 'ändernde Erlasse', pending: 'laufende Vorhaben', notes: 'Hinweise', toc: 'Gliederung', timeline: 'Zeitachse', stages: 'Stände', work: 'Angaben zum Erlass', langs: 'Sprachen', schema: 'Schema' };

/**
 * Vergleicht alte und neue Bibliothek. affected: { <werk>: [Stände] } mit neuen und ersetzten Ständen.
 * Ergebnis [{ id, abbr, affected, text: [{ stage, lang, units: [Bezeichnung] }], meta: [Feld] }]
 *   text  Wortlaut oder Fussnoten eines nicht betroffenen Stands geändert, Stand fehlt oder Stand neu ohne Befund (Warnung)
 *   meta  andere Felder eines nicht betroffenen Erlasses geändert (Hinweis)
 */
export function foreignChanges(oldLib, newLib, affected) {
  const out = [];
  const ids = [...new Set([...(oldLib.order || []), ...(newLib.order || [])])];
  for (const id of ids) {
    const a = oldLib.works[id], b = newLib.works[id];
    const isAff = Object.prototype.hasOwnProperty.call(affected, id);
    const abbr = ((b || a).work.abbr && (b || a).work.abbr.de) || id;
    const r = { id, abbr, affected: isAff, text: [], meta: [] };
    if (!a || !b) { r.text.push({ stage: null, lang: null, units: [a ? 'Erlass fehlt in der neuen Bibliothek' : 'Erlass neu in der Bibliothek'] }); out.push(r); continue; }
    const skip = new Set(isAff ? affected[id] : []);
    const newStages = new Set(b.stages.map((s) => s.id));
    for (const st of a.stages) {
      if (skip.has(st.id)) continue;
      if (!newStages.has(st.id)) { r.text.push({ stage: st.id, lang: null, units: ['Stand fehlt in der neuen Bibliothek'] }); continue; }
      for (const l of a.langs) {
        const units = stageDiff(a, b, st.id, l).map((u) => u.label);
        if (units.length) r.text.push({ stage: st.id, lang: l, units });
      }
    }
    // Ein Stand, der neu ist und nicht im Befund steht (Prüfung des Erlasses gescheitert oder Fedlex seither nachgeführt)
    const oldStages = new Set(a.stages.map((s) => s.id));
    for (const st of b.stages) if (!oldStages.has(st.id) && !skip.has(st.id)) r.text.push({ stage: st.id, lang: null, units: ['Stand neu in der Bibliothek, steht aber nicht im Befund'] });
    if (!isAff) r.meta = [...new Set(diffPaths(stripAllowed(a), stripAllowed(b)).map((p) => p.split('/')[1] || '/'))].map((f) => FIELD_DE[f] || f);
    if (r.text.length || r.meta.length) out.push(r);
  }
  return out;
}

// ------------------------------------------------------------------ Prüfberichte

const byId = (s) => new Map(((s && s.results) || []).map((r) => [r.id, r]));
const sum = (s, f) => ((s && s.results) || []).reduce((n, r) => n + f(r), 0);
const pctDe = (x) => (x * 100).toFixed(2).replace('.', ',').replace(/,00$/, '') + ' %';

/**
 * Urteil je Prüfung aus data/validation-summary.json vorher und nachher (scripts/validate.mjs, SPEC §8).
 * names: { <werk>: Kürzel }. verdict: ok (bestanden), fail (nicht bestanden), note (Hinweis, kein Hindernis).
 * Ergebnis { rows, passed }.
 * Bestanden gilt:
 *   Wortlaut         Abdeckung 100 % in jedem Erlass, Stand und jeder Sprache, keine fehlenden oder zusätzlichen Wörter
 *   Fussnoten        keine fehlende Fussnote
 *   Impacts offen    kein Impact-Eintrag ohne gefundene oder erklärte Änderung
 *   Schlüssel        nicht mehr Schlüsselwechsel als vorher, in keinem Erlass
 *   Markup           kein unerlaubtes Markup
 *   loadWork = Build keine Abweichung
 * Hinweis: mehr redaktionelle oder strukturelle Änderungen, mehr Sprachausnahmen (alle einzeln in data/VALIDATION.md
 * begründet), echter Abruf des nicht eingebetteten Vergleichserlasses (betrifft die eingebetteten Erlasse nicht).
 */
export function judgeValidation(before, after, names = {}) {
  const rows = [];
  const B = byId(before), A = byId(after);
  const abbr = (id) => names[id] || id;
  const worse = (f) => [...A].filter(([id, r]) => f(r) > (B.has(id) ? f(B.get(id)) : 0)).map(([id]) => id);
  const row = (key, label, vb, va, verdict, text = '') => rows.push({ key, label, before: vb, after: va, verdict, text });
  {
    const minCov = (s) => Math.min(1, ...((s && s.results) || []).map((r) => r.minCov));
    const badWort = [...A.values()].filter((r) => r.minCov < 1 || r.miss || r.extra).map((r) => abbr(r.id));
    row('wortlaut', 'Wortlaut vollständig (kleinste Abdeckung)', before ? pctDe(minCov(before)) : '–', pctDe(minCov(after)), badWort.length ? 'fail' : 'ok', badWort.length ? `Abweichung in ${joinDe(badWort)}` : '');
    const fnA = sum(after, (r) => r.fnMiss);
    row('fussnoten', 'Fussnoten vollständig (fehlende)', before ? sum(before, (r) => r.fnMiss) : '–', fnA, fnA ? 'fail' : 'ok');
    const ed = (r) => r.spur.editorial, stc = (r) => r.spur.structural;
    const more = [...new Set([...worse(ed), ...worse(stc)])].map((id) => abbr(id));
    row('belege', 'Änderungen ohne Beleg (redaktionell / strukturell)', before ? `${sum(before, ed)} / ${sum(before, stc)}` : '–', `${sum(after, ed)} / ${sum(after, stc)}`, more.length ? 'note' : 'ok', more.length ? `mehr als vorher in ${joinDe(more)}; einzeln aufgeführt in \`data/VALIDATION.md\`, Kapitel 3` : '');
    const openA = sum(after, (r) => r.rev.open);
    row('impacts', 'Impact-Einträge ohne Änderung (offen)', before ? sum(before, (r) => r.rev.open) : '–', openA, openA ? 'fail' : 'ok');
    const exc = (r) => r.lang[1] - r.lang[0];
    const moreExc = worse(exc).map((id) => abbr(id));
    row('sprachen', 'Sprachausnahmen (Gliederung DE, FR, IT verschieden)', before ? sum(before, exc) : '–', sum(after, exc), moreExc.length ? 'note' : 'ok', moreExc.length ? `mehr als vorher in ${joinDe(moreExc)}; begründet in \`data/VALIDATION.md\`, Kapitel 4` : '');
    const kv = (r) => r.keys[1];
    const moreKeys = worse(kv).map((id) => abbr(id));
    row('schluessel', 'Schlüsselwechsel unveränderter Bestimmungen', before ? sum(before, kv) : '–', sum(after, kv), moreKeys.length ? 'fail' : 'ok', moreKeys.length ? `mehr als vorher in ${joinDe(moreKeys)}` : '');
    const mk = sum(after, (r) => r.markup);
    row('markup', 'Unerlaubtes Markup', before ? sum(before, (r) => r.markup) : '–', mk, mk ? 'fail' : 'ok');
    const ld = (s) => ((s && s.load) || []).reduce((n, x) => n + x.diffs, 0);
    row('load', 'Laden über Fedlex-Abfragen = Bau (Abweichungen)', before ? ld(before) : '–', ld(after), ld(after) ? 'fail' : 'ok');
    const live = (s) => { const l = s && s.live; if (!l) return 'nicht ausgeführt'; if (l.error) return 'Fehler'; const ok = (l.rows || []).every((x) => x === 1) && !l.rawCmp; return ok ? 'vollständig' : 'Abweichung'; };
    const la = live(after);
    row('live', 'Echter Abruf eines nicht eingebetteten Erlasses (GebV-AIG)', before ? live(before) : '–', la, la === 'vollständig' ? 'ok' : 'note', la === 'vollständig' ? '' : 'betrifft die eingebetteten Erlasse nicht');
  }
  return { rows, passed: !rows.some((r) => r.verdict === 'fail') };
}

// ------------------------------------------------------------------ Tests

/** Zahlen aus der Ausgabe von node --test (TAP oder spec) oder Playwright (list). */
export function testCounts(output) {
  const s = String(output || '');
  const c = {};
  for (const m of s.matchAll(/^[#ℹ]\s*(pass|fail|skipped|todo|cancelled)\s+(\d+)\s*$/gmu)) c[m[1]] = Number(m[2]);
  if (!Object.keys(c).length) for (const m of s.matchAll(/^\s*(\d+)\s+(passed|failed|skipped|flaky|did not run)\b/gm)) c[{ passed: 'pass', failed: 'fail', skipped: 'skipped', flaky: 'flaky', 'did not run': 'notrun' }[m[2]]] = Number(m[1]);
  return c;
}

// ------------------------------------------------------------------ Text des Pull Requests

const VERDICT_DE = { ok: '**bestanden**', fail: '**nicht bestanden**', note: 'Hinweis' };
const MAX_UNITS = 30;
const MAX_WARN = 20; // Warnzeilen je Erlass unter «Übrige Erlasse und Stände»
/** GitHub nimmt höchstens 65536 Zeichen im Text eines Pull Requests an. */
export const MAX_BODY = 60000;

function unitLines(perLang) {
  // perLang: { de: [unit], fr: [...], it: [...] } -> Zeilen; gleiche Listen werden zusammengefasst
  const groups = [];
  for (const l of LANG_ORDER) {
    if (!perLang[l]) continue;
    const text = perLang[l].map(describeUnit);
    const key = JSON.stringify(text);
    const g = groups.find((x) => x.key === key);
    if (g) g.langs.push(l); else groups.push({ key, langs: [l], text });
  }
  const out = [];
  for (const g of groups) {
    const who = langList(g.langs);
    if (!g.text.length) { out.push(`  - ${who}: keine Bestimmung geändert`); continue; }
    out.push(`  - ${who}: ${g.text.length} ${g.text.length === 1 ? 'Bestimmung' : 'Bestimmungen'}`);
    for (const t of g.text.slice(0, MAX_UNITS)) out.push(`    - ${t}`);
    if (g.text.length > MAX_UNITS) out.push(`    - und ${g.text.length - MAX_UNITS} weitere`);
  }
  return out;
}
const fileName = (u) => (u ? String(u).split('/').pop() : 'unbekannt');
const bytes = (n) => (typeof n === 'number' ? `${n} Bytes` : 'Grösse unbekannt');

/**
 * Text des Pull Requests. e: Ergebnis von apply-fassungen.mjs (einbau.json), tests: Ergebnis der Tests (tests.json)
 * oder null. Ergebnis { title, body, failed, reasons }.
 */
export function prText(e, tests, { probelauf = false } = {}) {
  const reasons = [];
  if (e.error) reasons.push(`Einbau gescheitert (${e.step || 'unbekannter Schritt'}): ${e.error}`);
  if (e.validation && !e.validation.passed) reasons.push('Mindestens eine Prüfung ist nicht bestanden (Abschnitt «Prüfberichte»).');
  for (const w of e.works || []) {
    for (const s of w.newStages) if (s.kind === 'fehlt') reasons.push(`${w.abbr}: Die neue Fassung vom ${fmtDate(stageDate(s.stage))} fehlt nach dem Einbau.`);
    for (const s of w.replacedStages) if (s.missing) reasons.push(`${w.abbr}: Der Stand vom ${fmtDate(stageDate(s.stage))} fehlt nach dem Einbau.`);
  }
  const textWarn = (e.foreign || []).filter((w) => w.text.length);
  if (textWarn.length) reasons.push('Ein nicht betroffener Erlass oder Stand hat sich inhaltlich geändert (Abschnitt «Übrige Erlasse und Stände»).');
  if (!e.error) {
    if (!tests) reasons.push('Die Tests sind nicht gelaufen.');
    else for (const t of tests.results.filter((x) => !x.ok)) reasons.push(`Test fehlgeschlagen: ${t.label}.`);
  }
  const failed = reasons.length > 0;
  const subject = e.subject || `SR-Navigator: Fassungen nachgeführt`;
  const title = (probelauf ? 'Probelauf: ' : '') + subject;
  const L = [];
  L.push(`<!-- ${FP_MARK}: ${e.fingerprint} -->`, `<!-- ${STATUS_MARK}: ${failed ? 'fehler' : 'ok'} -->`);
  if (failed) {
    L.push('> [!CAUTION]', '> **Nicht zusammenführen.** Der automatische Einbau ist nicht vollständig gelungen. Dieser Pull Request ist darum ein Entwurf.', '>');
    for (const r of reasons) L.push(`> - ${cell(r)}`);
    L.push('>', '> Was du tust, steht in `MAINTAINING.md`, Abschnitt «Neue Fassung einbauen».', '');
  }
  if (probelauf) L.push('> [!NOTE]', `> **Probelauf.** Dieser Pull Request dient nur dem Test des Workflows «Fassungen». Führe ihn nicht zusammen. Schliesse ihn nach der Durchsicht.`, '');
  L.push(`Fedlex führt neue Fassungen oder ersetzte Dateien der eingebetteten Erlasse. Der Workflow «Fassungen» hat sie eingebaut. Die Version steigt von ${e.versionBefore} auf **${e.version || '–'}**.`, '');
  L.push('## Befund', '', `Prüfung vom ${fmtDate(e.today)}.`, '', befundTable(e.rows), '');
  if (e.changelog) L.push('## Text im Changelog', '', 'Dieser Abschnitt in `CHANGELOG.md` wird zum Text der Release:', '', '```markdown', e.changelog, '```', '');
  if ((e.works || []).length) {
    L.push('## Was sich ändert', '');
    for (const w of e.works) {
      L.push(`### ${w.abbr} (SR ${w.sr})`, '');
      for (const s of w.newStages) {
        const d = fmtDate(stageDate(s.stage));
        if (s.kind === 'fehlt') L.push(`- Neue Fassung vom ${d}: **fehlt nach dem Einbau in der Bibliothek.**`);
        else if (s.kind === 'ohne-xml') L.push(`- Neue Fassung vom ${d}: Fedlex führt dazu keinen Text im Format XML. Der Navigator zeigt sie nur auf der Zeitachse.`);
        else { L.push(`- Neuer Stand vom ${d}. Geänderte Bestimmungen gegenüber dem Stand davor:`); L.push(...unitLines(s.langs || {})); }
      }
      for (const s of w.replacedStages) {
        L.push(`- Stand vom ${fmtDate(stageDate(s.stage))}: Datei ersetzt in ${langList(s.files.map((f) => f.lang))}.`, '');
        L.push('  | Sprache | bisherige Datei | neue Datei |', '  | --- | --- | --- |');
        for (const f of s.files) L.push(`  | ${LANG_NAMES[f.lang]} | ${cell(fileName(f.oldUrl))} (${bytes(f.oldBytes)}) | ${cell(fileName(f.newUrl))} (${bytes(f.newBytes)}) |`);
        L.push('', '  Geänderte Bestimmungen in diesem Stand, alte gegen neue Datei:');
        L.push(...unitLines(s.langs || {}));
      }
      L.push('');
    }
  }
  if (e.validation) {
    L.push('## Prüfberichte', '', 'Zahlen aus `data/validation-summary.json` über alle eingebetteten Erlasse, vor und nach dem Einbau. Einzelheiten stehen in `data/VALIDATION.md` und `data/VALIDATION_REFS.md`.', '');
    L.push('| Prüfung | vorher | nachher | Urteil |', '| --- | --- | --- | --- |');
    for (const r of e.validation.rows) L.push(`| ${r.label} | ${r.before} | ${r.after} | ${VERDICT_DE[r.verdict]}${r.text ? ': ' + cell(r.text) : ''} |`);
    L.push('', '«Hinweis» hindert das Zusammenführen nicht. «nicht bestanden» macht den Pull Request zum Entwurf.', '');
  }
  if (e.foreign) {
    L.push('## Übrige Erlasse und Stände', '');
    if (!e.foreign.length) L.push('Alle übrigen Erlasse und Stände sind inhaltlich unverändert. Geändert haben sich nur Datumsangaben, Datei-Adressen und Angaben zur Herkunft der Dateien.');
    for (const w of e.foreign) {
      for (const t of w.text.slice(0, MAX_WARN)) L.push(`- **Warnung:** ${w.abbr}${t.stage ? `, Stand vom ${fmtDate(stageDate(t.stage))}` : ''}${t.lang ? `, ${LANG_NAMES[t.lang]}` : ''}: ${t.units.slice(0, 12).map(cell).join(', ')}${t.units.length > 12 ? ` und ${t.units.length - 12} weitere` : ''}`);
      if (w.text.length > MAX_WARN) L.push(`- **Warnung:** ${w.abbr}: ${w.text.length - MAX_WARN} weitere Stände und Sprachen mit Abweichungen.`);
      if (w.meta.length) L.push(`- Hinweis: ${w.abbr}: Fedlex hat Metadaten nachgeführt (${joinDe(w.meta)}). Der Wortlaut ist unverändert.`);
    }
    L.push('');
  }
  L.push('## Tests', '');
  if (!tests) L.push(e.error ? 'Nicht ausgeführt, weil der Einbau gescheitert ist.' : 'Nicht ausgeführt.');
  else {
    L.push('| Test | Ergebnis |', '| --- | --- |');
    for (const t of tests.results) {
      const c = t.counts || {};
      const n = ['pass', 'fail', 'skipped'].filter((k) => c[k] !== undefined).map((k) => `${c[k]} ${{ pass: 'bestanden', fail: 'fehlgeschlagen', skipped: 'übersprungen' }[k]}`).join(', ');
      L.push(`| ${t.label} | ${t.ok ? '**bestanden**' : '**fehlgeschlagen**'}${n ? ` (${n})` : ''} |`);
    }
    const bad = tests.results.filter((t) => !t.ok && t.tail);
    for (const t of bad) L.push('', `<details><summary>Letzte Zeilen von «${t.label}»</summary>`, '', '```', t.tail, '```', '', '</details>');
  }
  L.push('');
  L.push('## So prüfst du diesen Pull Request', '');
  L.push(
    '1. Vergleiche den Abschnitt «Befund» mit der Meldung auf Fedlex. Die Links in der Tabelle führen zum Erlass.',
    '2. Prüfe die Abschnitte «Prüfberichte» und «Tests». Jede Zeile zeigt «bestanden» oder «Hinweis». Unter «Übrige Erlasse und Stände» steht keine Warnung.',
    '3. Öffne den Reiter **Checks**. Der Lauf «CI» ist grün. Er startet einige Minuten nach dem Pull Request.',
    '4. Lies den Abschnitt «Text im Changelog». Du darfst ihn vor dem Zusammenführen verbessern: Öffne **Files changed**, bei `CHANGELOG.md` das Menü **…** und **Edit file**. Speichere mit **Commit changes** im selben Zweig.',
    `5. Wähle **Merge pull request**. Der Workflow «Release» veröffentlicht danach die Version ${e.version || 'mit der neuen Nummer'}.`,
    '',
    'Ist der Pull Request ein Entwurf, führe ihn nicht zusammen. Das Vorgehen steht in `MAINTAINING.md`, Abschnitt «Neue Fassung einbauen».',
  );
  const closes = e.issue && !probelauf ? `\nCloses #${e.issue}\n` : '';
  let body = L.join('\n') + '\n';
  if (body.length + closes.length > MAX_BODY) body = body.slice(0, MAX_BODY - closes.length - 200) + '\n\n… Text gekürzt, weil GitHub die Länge begrenzt. Der volle Text liegt im Artefakt «einbau» des Laufs (`pr.md`).\n';
  return { title, body: body + closes, failed, reasons };
}
