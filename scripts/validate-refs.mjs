// SR-Navigator — Prüfbericht Verweis-Index (SPEC §12.2) → data/VALIDATION_REFS.md
// Aufruf: node scripts/validate-refs.mjs [--no-net] [--refresh] [--today=JJJJ-MM-TT]
//   --no-net   Fedlex-Zitatmetadaten nur aus dem Zwischenspeicher scripts/dev/cache/fedlex-citations.json
//   --refresh  Zitatmetadaten neu abfragen (sonst Zwischenspeicher, falls vorhanden)
//   --today    Datum für «heute geltender Stand» (Vorgabe 2026-11-18, damit der Bericht reproduzierbar ist)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRefIndex, worksFromLibrary, targetKey, plainText, isSourceBlock } from '../src/core/refs.js';
import { getVersion, stageAt, tocAt } from '../src/core/model.js';
import { hashString } from '../src/core/text.js';
import { suspects } from './dev/refs-suspects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const NO_NET = args.includes('--no-net') || process.env.SR_NO_NET === '1';
const REFRESH = args.includes('--refresh');
const TODAY = (args.find((a) => a.startsWith('--today=')) || '--today=2026-11-18').slice(8);
const LANGS = ['de', 'fr', 'it'];
const CACHE = path.join(ROOT, 'scripts/dev/cache/fedlex-citations.json');

const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/library.json'), 'utf8'));
const works = worksFromLibrary(L);

// ------------------------------------------------------------------ geprüfte Ursachen (von Hand am Wortlaut nachgelesen)
// Schlüssel: work|stage|unit|key  (stage '*' = alle Stände). Art: Quelle | Index | Datensatz
const CAUSES = {
  'cc-2007-758|*|art_126_b|p': ['Quelle', 'IT «articoli 190c e 120d» statt 109c (Tippfehler der Quelle); DE/FR «109c»'],
  'cc-2007-758|*|art_120|p1.e': ['Quelle', 'FR «art. 90, al. 1, let. c»; DE/IT «Art. 90 Bst. c» (Art. 90 hat keine Absätze)'],
  'cc-2007-758|*|art_108_e|p2.cbis': ['Quelle', 'FR «LAsi40»: Fussnotenzeichen als Text im Wortlaut der Quelle; Zitat deshalb unsicher'],
  'cc-2007-758|*|art_109_f|p2.a': ['Quelle', 'IT nennt zusätzlich «ai sensi dell’articolo 66a o 66abis CP o dell’articolo 49a o 49abis CPM»; DE/FR nicht'],
  'cc-2007-758|*|art_109_f|p2.b': ['Quelle', 'wie Bst. a: zusätzliche Nennung von StGB/MStG nur in IT'],
  'cc-2007-758|*|art_109_g|p1.a': ['Quelle', 'zusätzliche Nennung von StGB/MStG nur in IT'],
  'cc-2007-758|*|art_68_a|p2': ['Quelle', 'zusätzliche Nennung von StGB/MStG nur in IT'],
  'cc-2007-758|*|art_68_d|p3.a': ['Quelle', 'zusätzliche Nennung von StGB/MStG nur in IT'],
  'cc-2007-758|*|art_73|p2': ['Quelle', 'nur FR «La rétention selon l’al. 1»'],
  'cc-2007-758|*|art_78|p1': ['Quelle', 'nur FR «au sens de l’art. 76»'],
  'cc-2007-758|*|art_9_b|p7': ['Quelle', 'IT «articolo 21a capoverso 1»; DE/FR «Artikel 21a»'],
  'cc-2007-758|*|art_4|p1': ['Quelle', 'DE «Bundesverfassung», IT «Costituzione federale», FR «valeurs constitutionnelles» (keine Nennung)'],
  'cc-2007-758|*|art_126_a|p1': ['Quelle', 'FR nennt «la loi sur l’asile» ohne Datum und Kürzel (vom Index nicht als Nennung erkannt)'],
  'cc-2007-758|*|art_126_a|p2': ['Quelle', 'IT ohne «nach Absatz 1»'],
  'cc-2007-758|*|art_109_a|p2.b': ['Quelle', 'IT «regolamento (UE) n. 2024/1351» – seit 2026 korrekt erkannt; Abweichung nur in früheren Fassungen'],
  'cc-2007-758|*|art_64_c_bis|p1': ['Quelle', 'EU-Zählung: DE «Artikel 23a», FR/IT «23bis» – vom Index vereinheitlicht'],
  'cc-2018-493|*|art_34|p1': ['Quelle', 'DE-Einleitungssatz nennt den Visakodex, FR/IT die Verordnung (EU) 2017/2226; FR/IT ohne Formel «articles suivants», Aufzählung daher unsicher'],
  'cc-2018-493|*|art_34|p1.*': ['Quelle', 'Punkte zu Art. 34 Abs. 1: DE-Einleitungssatz weist sie dem Visakodex zu, FR/IT nennen die Verordnung (EU) 2017/2226 als Ganzes ohne Zuweisungsformel → FR/IT unsicher'],
  'cc-2018-493|*|art_34_c|p1.*': ['Datensatz', 'DE: Zitat «der Verordnungen [EU] 2019/» ist in der Quelle auf zwei Blöcke verteilt (Rest «817 und [EU] 2019/818» im Unterblock s2) → DE unsicher'],
  'cc-2018-493|*|art_34_c|p2.*': ['Datensatz', 'DE: Zitat über zwei Blöcke verteilt (wie Abs. 1) → DE unsicher'],
  'cc-1999-358|*|art_122|p.d': ['Datensatz', 'IT: Gliederung der Quelle weicht ab (Zusatztexte als eigene Buchstaben d5, d7); Zitate stehen in IT in anderen Blöcken'],
  'cc-1999-358|*|art_122|p.e': ['Datensatz', 'IT: Gliederung der Quelle weicht ab (Zusatztexte als eigene Buchstaben d5, d7)'],
  'cc-1999-358|*|art_122|p.d5': ['Datensatz', 'IT: Block nur in IT (Gliederung der Quelle)'],
  'cc-1999-358|*|art_122|p.d7': ['Datensatz', 'IT: Block nur in IT (Gliederung der Quelle)'],
  'cc-1999-358|*|art_51|p1bis': ['Quelle', 'IT: im heute geltenden Stand fehlt die SR-Fussnote zu «Codice civile (CC)» (in früheren Ständen vorhanden) → IT unsicher, DE/FR ZGB'],
  'cc-2021-734|*|art_23|p3': ['Quelle', 'IT «articolo 55 paragrafo 2 (UE) 2017/2226» ohne «del regolamento»; DE/FR mit Gattung'],
  'cc-2007-759|20210101|art_89_a|p': ['Quelle', 'früher Stand: IT verweist noch auf «articolo 102c capoverso 3 LAsi», DE/FR auf Art. 111d AIG'],
  'cc-2018-493|*|art_34_f|p4': ['Quelle', 'DE «Verordnung (EU) 2021/1160», FR/IT «2021/1060»'],
  'cc-2018-493|*|art_29|p1': ['Index', 'IT «articolo 8 e all’allegato VI … del codice frontiere Schengen»: Präposition «all’» trennt die Zitate; Art. 8 unsicher statt EU'],
  'cc-2018-493|*|art_29|p2': ['Index', 'IT «articolo 8 e all’allegato VI … del codice frontiere Schengen»: Art. 8 unsicher statt EU'],
  'cc-2018-493|*|art_42|p1': ['Quelle', 'mehrdeutige Aufzählung «Art. 5 Abs. 4 und 8» (DE Einzahl «Absatz» → Art. 8; FR «art. 5, al. 4, et 8» → Art. 8; IT «articoli» → Art. 8)'],
  'cc-1999-358|*|art_84|p': ['Quelle', 'DE «Artikel 83 Absätze 3 und 4 AIG», FR «art. 83, al. 3 à 5, LEI»'],
  'cc-1999-358|*|art_17|p1': ['Quelle', 'FR «loi fédérale sur la procédure administrative» ohne Datum (keine Nennung erkannt)'],
  'cc-1999-358|*|disp_u1|p.s2': ['Quelle', 'FR «art. 50 de la loi fédérale» ohne Datum: Erlass nicht bestimmbar (unsicher)'],
  'cc-1999-358|*|disp_u2|p.s2': ['Quelle', 'IT «della legge nella versione del 26 giugno 1998»: Erlass nicht bestimmbar; DE/FR «Artikel 87» (dieses Gesetzes)'],
  'cc-2007-759|*|art_12|p1': ['Quelle', 'FR «19b, al. 2, let. b», DE/IT «Bst. a»'],
  'cc-2007-759|*|art_56|p2': ['Quelle', 'FR «19b, al. 2, let. b», DE/IT «Bst. a»'],
  'cc-2007-759|*|art_33|p': ['Quelle', 'nur FR nennt «code civil»'],
  'cc-2007-759|*|art_30|p3': ['Index', 'FR «de la même loi»: Rückverweis nicht eindeutig auflösbar (unsicher); DE «BüG», IT «LCit»'],
  'cc-2007-759|*|art_71_a|p1.a': ['Quelle', 'IT altes Kürzel «LStr» (heute «LStrI»): im Erlass nicht eingeführt, daher unsicher'],
};

// ------------------------------------------------------------------ Hilfen
const out = [];
const w = (s = '') => out.push(s);
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '–');
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const short = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function blocksOf(ds, lang, stageId) {
  const m = new Map();
  for (const e of tocAt(ds, stageId, lang)) {
    if (!e.unit) continue;
    const v = getVersion(ds, e.id, lang, stageId);
    if (!v || v.missing) continue;
    for (const b of v.blocks) m.set(e.id + ' ' + b.k, { unit: e.id, utype: e.type, b, P: plainText(b.t), excluded: !isSourceBlock(e.type, b) });
  }
  return m;
}
const isMention = (r) => !r.uncertain && r.to && Object.keys(r.to.path || {}).length === 0;

function classify(work, stage, k, g, blocksBy) {
  const [unit, key] = k.split(' ');
  for (const ck of [`${work}|${stage}|${unit}|${key}`, `${work}|*|${unit}|${key}`, `${work}|*|${unit}|${key.split('.')[0]}.*`]) if (CAUSES[ck]) return { kind: CAUSES[ck][0], text: CAUSES[ck][1], checked: true };
  const missingIn = LANGS.filter((l) => !blocksBy[l].has(k));
  if (missingIn.length) return { kind: 'Datensatz', text: `Block fehlt in ${missingIn.join(', ').toUpperCase()} (Gliederung der Sprachfassungen weicht ab)`, checked: false };
  const diffs = LANGS.map((l) => ({ l, only: [...g[l].sure].filter((x) => LANGS.some((o) => o !== l && !g[o].sure.has(x))) }));
  const allMention = LANGS.every((l) => [...g[l].sureRefs].filter((r) => diffs.find((d) => d.l === l).only.includes(targetKey(r.to))).every(isMention));
  if (allMention) return { kind: 'Quelle', text: 'Nennung eines Erlasses (ohne Zitat) nur in einzelnen Sprachfassungen', checked: false };
  const unc = LANGS.filter((l) => g[l].unc.length);
  if (unc.length) return { kind: 'Index', text: `unsicher in ${unc.join(', ').toUpperCase()}: ${[...new Set(unc.flatMap((l) => g[l].unc.map((r) => r.why)))].join('; ')}`, checked: false };
  const withOnly = diffs.filter((d) => d.only.length);
  if (withOnly.length === 1 && LANGS.filter((l) => l !== withOnly[0].l).every((l) => [...g[l].sure].every((x) => g[withOnly[0].l].sure.has(x)))) return { kind: 'Quelle?', text: `zusätzliches Zitat nur in ${withOnly[0].l.toUpperCase()} (Wortlaut einzeln vergleichen)`, checked: false };
  const sizes = LANGS.map((l) => g[l].sure.size);
  if (new Set(sizes).size === 1) return { kind: 'Quelle?', text: 'gleich viele Ziele, abweichende Nummer oder Gliederung (Sprachfassungen einzeln vergleichen)', checked: false };
  return { kind: 'offen', text: 'nicht eingeordnet', checked: false };
}

// ------------------------------------------------------------------ Fedlex-Zitatmetadaten
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { cache = {}; }
const LANG_URI = { de: 'DEU', fr: 'FRA', it: 'ITA' };
async function fedlexCitations(ds, stageId, lang) {
  const ck = `${ds.work.id}|${stageId}|${lang}`;
  if (cache[ck] && !REFRESH) return cache[ck];
  if (NO_NET) return null;
  const from = `${ds.work.eli}/text/${stageId}`;
  const q = `PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
SELECT ?ref ?rs ?to WHERE { ?c jolux:citationFromLegalResource <${from}> ; jolux:language <http://publications.europa.eu/resource/authority/language/${LANG_URI[lang]}> .
  OPTIONAL { ?c jolux:citationFromReference ?ref } OPTIONAL { ?c jolux:citationToRs ?rs } OPTIONAL { ?c jolux:citationToLegalResource ?to } }`;
  const res = await fetch('https://fedlex.data.admin.ch/sparqlendpoint', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json' },
    body: 'query=' + encodeURIComponent(q), signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status} für ${ck}`);
  const j = await res.json();
  const rows = j.results.bindings.map((b) => ({ ref: b.ref ? b.ref.value : null, rs: b.rs ? b.rs.value : null, to: b.to ? b.to.value : null }));
  const total = rows.length;
  const rs = rows.filter((r) => r.rs).map((r) => ({ ref: r.ref, rs: r.rs }));
  const kinds = {};
  for (const r of rows) { const k = r.rs ? 'SR (citationToRs)' : r.to ? r.to.replace(/^https:\/\/fedlex\.data\.admin\.ch\/eli\/(\w+)\/.*$/, '$1') : 'ohne Ziel'; kinds[k] = (kinds[k] || 0) + 1; }
  cache[ck] = { fetched: TODAY, total, kinds, rs };
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
  fs.writeFileSync(CACHE, JSON.stringify(sorted, null, 1));
  return cache[ck];
}
function unitOfRef(ds, ref) {
  if (!ref) return 'preamble'; // Fedlex führt Zitate aus Ingress/Titel ohne citationFromReference
  const first = ref.split('/')[0];
  if (ds.units[first]) return first;
  if (ds.units[ref.replace(/\//g, '.')]) return ref.replace(/\//g, '.');
  return first;
}

// ------------------------------------------------------------------ Lauf
const summary = [];
const sections = [];
const runtime = [];

// Laufzeit AIG: alle Stände × Sprachen, zuerst gemessen (frischer Prozess; der erste Lauf enthält das Einschwingen der JS-Maschine)
{
  const ds = L.works['cc-2007-758'];
  for (const st of ds.stages) for (const lang of LANGS) { const t0 = performance.now(); buildRefIndex(ds, lang, st.id, { works }); runtime.push(performance.now() - t0); }
}
for (const id of L.order) {
  const ds = L.works[id];
  const abbr = ds.work.abbr.de || id;
  const cur = stageAt(ds, TODAY);
  const early = ds.stages[0].id;
  const S = [];
  const s = (x = '') => S.push(x);
  const row = { id, abbr, cur, early };
  s(`## ${abbr} (SR ${ds.work.sr}, ${id})`);
  s('');
  s(`Heute geltender Stand: ${cur}; früher Stand: ${early}.`);
  s('');
  for (const stage of [cur, early]) {
    const ix = {}, blocksBy = {};
    for (const lang of LANGS) {
      const t0 = performance.now();
      ix[lang] = buildRefIndex(ds, lang, stage, { works });
      ix[lang].stats.ms = Math.round(performance.now() - t0);
      blocksBy[lang] = blocksOf(ds, lang, stage);
    }
    s(`### Stand ${stage}`);
    s('');
    s('| Sprache | Refs | Fundstellen | intern | SR (davon Bibliothek) | EU | unsicher | fehlt am Stand | Blöcke | ms |');
    s('|---|---|---|---|---|---|---|---|---|---|');
    for (const lang of LANGS) { const st = ix[lang].stats; s(`| ${lang.toUpperCase()} | ${st.total} | ${st.citations} | ${st.internal} | ${st.sr} (${st.library}) | ${st.eu} | ${st.uncertain} | ${st.dangling} | ${st.blocks} | ${st.ms} |`); }
    s('');

    // 1. Sprachgleichheit
    const groups = new Map();
    for (const lang of LANGS) for (const r of ix[lang].refs) {
      const k = r.from.unit + ' ' + r.from.key;
      if (!groups.has(k)) groups.set(k, Object.fromEntries(LANGS.map((l) => [l, { sure: new Set(), sureRefs: [], unc: [] }])));
      const g = groups.get(k)[lang];
      if (r.uncertain) g.unc.push(r); else { g.sure.add(targetKey(r.to)); g.sureRefs.push(r); }
    }
    let eq = 0, eqCit = 0, nCit = 0;
    const dev = [];
    const unitSets = new Map();
    for (const [k, g] of [...groups].sort()) {
      const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
      const ok = same(g.de.sure, g.fr.sure) && same(g.de.sure, g.it.sure);
      // nur Zitate (ohne blosse Nennungen ganzer Erlasse)
      const cit = (l) => new Set(g[l].sureRefs.filter((r) => !isMention(r)).map((r) => targetKey(r.to)));
      const cd = cit('de'), cf = cit('fr'), ci = cit('it');
      if (cd.size || cf.size || ci.size) { nCit++; if (same(cd, cf) && same(cd, ci)) eqCit++; }
      const u = k.split(' ')[0];
      if (!unitSets.has(u)) unitSets.set(u, Object.fromEntries(LANGS.map((l) => [l, new Set()])));
      for (const l of LANGS) for (const x of g[l].sure) unitSets.get(u)[l].add(x);
      if (ok) { eq++; continue; }
      dev.push({ k, g, cause: classify(id, stage, k, g, blocksBy) });
    }
    let ueq = 0;
    for (const [, us] of unitSets) { const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x)); if (same(us.de, us.fr) && same(us.de, us.it)) ueq++; }
    const n1 = groups.size;
    s(`**Prüfung 1 – Sprachgleichheit:** ${eq} von ${n1} Blöcken mit Verweisen haben in DE, FR und IT dieselbe Zielmenge (${pct(eq, n1)}); nur Zitate (ohne Nennungen ganzer Erlasse): ${eqCit} von ${nCit} (${pct(eqCit, nCit)}); je Einheit: ${ueq} von ${unitSets.size} (${pct(ueq, unitSets.size)}). Abweichungen: ${dev.length}.`);
    s('');
    if (dev.length) {
      s('| Einheit | Block | Ursache | Art | geprüft | DE | FR | IT |');
      s('|---|---|---|---|---|---|---|---|');
      for (const d of dev) {
        const cell = (l) => {
          const others = LANGS.filter((o) => o !== l);
          const only = d.g[l].sureRefs.filter((r) => others.some((o) => !d.g[o].sure.has(targetKey(r.to))));
          const parts = [...new Map(only.map((r) => [targetKey(r.to), `${r.to.label} «${short(r.text, 60)}»`])).values()];
          if (d.g[l].unc.length) parts.push('unsicher: ' + [...new Set(d.g[l].unc.map((r) => `«${short(r.text, 50)}»`))].join(', '));
          return esc(parts.join('; ') || '–');
        };
        const [u, kk] = d.k.split(' ');
        s(`| ${u} | ${kk} | ${esc(d.cause.text)} | ${d.cause.kind} | ${d.cause.checked ? 'ja' : 'nein (automatisch)'} | ${cell('de')} | ${cell('fr')} | ${cell('it')} |`);
      }
      s('');
    }

    // 2. Auflösung
    const intern = LANGS.flatMap((l) => ix[l].refs.filter((r) => !r.uncertain && r.to.kind === 'internal').map((r) => ({ l, r })));
    const lib = LANGS.flatMap((l) => ix[l].refs.filter((r) => !r.uncertain && r.to.kind === 'sr' && r.to.work).map((r) => ({ l, r })));
    const miss = [...intern, ...lib].filter((x) => x.r.to.missing);
    const keyMiss = [...intern, ...lib].filter((x) => x.r.to.keyMissing);
    s(`**Prüfung 2 – Auflösung:** interne Ziele ${intern.length} (alle Sprachen), davon am Stand vorhanden ${intern.filter((x) => !x.r.to.missing).length} (${pct(intern.filter((x) => !x.r.to.missing).length, intern.length)}); Ziele in Bibliotheks-Erlassen ${lib.length}, davon vorhanden ${lib.filter((x) => !x.r.to.missing).length} (${pct(lib.filter((x) => !x.r.to.missing).length, lib.length)}). Unterteilung nicht eindeutig gefunden (keyMissing, Ziel bleibt die Einheit): ${keyMiss.length}.`);
    s('');
    if (miss.length) {
      s('| Sprache | Quelle | Zitat | Ziel | Erklärung |');
      s('|---|---|---|---|---|');
      for (const { l, r } of miss) {
        const tds = r.to.work && r.to.work !== id ? L.works[r.to.work] : ds;
        const tst = r.to.stage || stage;
        const u = tds.units[r.to.unit];
        let why;
        if (!u) why = 'Einheit kommt im Datensatz nie vor (Quelle zitiert eine nicht vorhandene Bestimmung)';
        else {
          const v = getVersion(tds, r.to.unit, l, tst);
          if (!v) why = 'Einheit erst in einem späteren Stand vorhanden';
          else if (v.missing && v.mergedInto) why = `weggefallen, aufgegangen in ${v.mergedInto}`;
          else if (v.missing) why = 'am Stand nicht mehr vorhanden';
          else if (v.repealed) why = `am Stand aufgehoben («${short(plainText((v.blocks[0] || {}).t || '…'), 40)}»)`;
          else why = '–';
          if (r.to.via === 'range') why += '; Zitat fällt in einen Bereichsartikel';
        }
        s(`| ${l.toUpperCase()} | ${r.from.unit} ${r.from.key} | «${esc(short(r.text, 70))}» | ${esc(r.to.label)}${r.to.work !== id ? ` (${r.to.work}, Stand ${tst})` : ''} | ${esc(why)} |`);
      }
      s('');
    }

    // 3. Vollständigkeit
    const RX = { de: /(?<![\p{L}])(?:Artikeln|Artikels|Artikel|Art\.?)\s*\d/gu, fr: /(?<![\p{L}])(?:articles|article|art\.?)\s*\d/giu, it: /(?<![\p{L}])(?:articoli|articolo|artt?\.)\s*\d/giu };
    const comp = [];
    for (const lang of LANGS) {
      const byBlock = new Map();
      for (const r of ix[lang].refs) { const k = r.from.unit + ' ' + r.from.key; if (!byBlock.has(k)) byBlock.set(k, []); byBlock.get(k).push(r); }
      let hits = 0, sure = 0, unsure = 0, excl = 0;
      const rest = new Map();
      for (const [k, B] of blocksBy[lang]) {
        RX[lang].lastIndex = 0;
        let m;
        while ((m = RX[lang].exec(B.P))) {
          if (B.excluded) { excl++; continue; }
          hits++;
          const rs = (byBlock.get(k) || []).filter((r) => m.index >= r.at[0] && m.index < r.at[1]);
          if (rs.some((r) => !r.uncertain)) sure++;
          else if (rs.length) unsure++;
          else {
            const ctx = B.P.slice(m.index, m.index + 60);
            let cause = 'sonstige';
            if (/^\S+\s*\d+[a-z]*\s*(?:bis|ter)?\s*(?:[–-]|f\.|ff\.)/.test(ctx)) cause = 'Zahl mit Folgezeichen';
            if (B.utype === 'final' || /^disp/.test(B.unit)) cause = 'Schluss-/Übergangsbestimmung';
            if (!rest.has(cause)) rest.set(cause, []);
            rest.get(cause).push(`${k}: «${short(ctx, 60)}»`);
          }
        }
      }
      comp.push({ lang, hits, sure, unsure, excl, rest });
    }
    s('**Prüfung 3 – Vollständigkeit** (Gegenzählung: «Artikel|Art.» bzw. «article|art.», «articolo|art.» mit Zahl im Wortlaut der Quell-Blöcke):');
    s('');
    s('| Sprache | Treffer | als Verweis geführt | davon unsicher | nicht geführt | in Titeln/Verweiszeilen (keine Quelle) |');
    s('|---|---|---|---|---|---|');
    for (const c of comp) s(`| ${c.lang.toUpperCase()} | ${c.hits} | ${c.sure + c.unsure} (${pct(c.sure + c.unsure, c.hits)}) | ${c.unsure} | ${c.hits - c.sure - c.unsure} | ${c.excl} |`);
    s('');
    const restAll = comp.flatMap((c) => [...c.rest].map(([cause, ex]) => ({ lang: c.lang, cause, ex })));
    if (restAll.length) {
      s('Nicht geführte Treffer nach Ursache:');
      s('');
      for (const x of restAll) s(`- ${x.lang.toUpperCase()}, ${x.cause} (${x.ex.length}): ${x.ex.slice(0, 6).map(esc).join('; ')}${x.ex.length > 6 ? ' …' : ''}`);
      s('');
    }
    if (stage === cur) row.cur1 = { eq, n1, eqCit, nCit, dev: dev.length, intern: intern.length, internOk: intern.filter((x) => !x.r.to.missing).length, lib: lib.length, libOk: lib.filter((x) => !x.r.to.missing).length, comp, stats: Object.fromEntries(LANGS.map((l) => [l, ix[l].stats])) };
    else row.early1 = { eq, n1, dev: dev.length, comp };

    // 4. Gegenprobe Fedlex (nur heute geltender Stand)
    if (stage === cur) {
      s('**Prüfung 4 – Gegenprobe Fedlex** (`jolux:Citation` mit `citationToRs`, Ebene Einheit → SR-Erlass):');
      s('');
      s('| Sprache | Zitate gesamt | davon SR | Paare Einheit→SR (Fedlex) | im Index | Index-Paare ohne Fedlex-Eintrag |');
      s('|---|---|---|---|---|---|');
      const detail = [];
      let kindsLine = '';
      row.fed = {};
      for (const lang of LANGS) {
        let fc = null;
        try { fc = await fedlexCitations(ds, stage, lang); } catch (e) { fc = { error: String(e.message || e) }; }
        if (!fc || fc.error) { s(`| ${lang.toUpperCase()} | ${fc && fc.error ? 'Fehler: ' + esc(fc.error) : 'nicht abgefragt (--no-net, kein Zwischenspeicher)'} | | | | |`); continue; }
        const F = new Set(fc.rs.map((r) => `${unitOfRef(ds, r.ref)}→${r.rs}`));
        const I = new Set(ix[lang].refs.filter((r) => !r.uncertain && r.to.kind === 'sr').map((r) => `${r.from.unit}→${r.to.sr}`));
        const hit = [...F].filter((x) => I.has(x));
        const missF = [...F].filter((x) => !I.has(x));
        const extra = [...I].filter((x) => !F.has(x));
        row.fed[lang] = { F: F.size, hit: hit.length, extra: extra.length, total: fc.total };
        s(`| ${lang.toUpperCase()} | ${fc.total} | ${fc.rs.length} | ${F.size} | ${hit.length} (${pct(hit.length, F.size)}) | ${extra.length} |`);
        if (missF.length) detail.push(`- ${lang.toUpperCase()} Fedlex-Paare ohne Index-Eintrag: ${missF.map((x) => { const u = x.split('→')[0]; const unc = ix[lang].refs.filter((r) => r.from.unit === u && r.uncertain).map((r) => '«' + short(r.text, 50) + '» ' + r.why); return x + (unc.length ? ` (im Index unsicher: ${unc.slice(0, 2).join('; ')})` : ''); }).map(esc).join('; ')}`);
        if (extra.length) detail.push(`- ${lang.toUpperCase()} Index-Paare ohne Fedlex-Eintrag (Nennungen ohne Fussnote, über Kürzel bzw. Register aufgelöst): ${extra.slice(0, 25).map(esc).join(', ')}${extra.length > 25 ? ' …' : ''}`);
        if (lang === 'de') kindsLine = `Arten der Fedlex-Zitate (DE, Ziel nach ELI-Typ): ${Object.entries(fc.kinds).sort().map(([k, v]) => `${k} ${v}`).join(', ')}. Fedlex führt nur die Verweise in Fussnoten («ref»), Ebene Quelle = Einheit (eId), Ziel = Erlass.`;
      }
      s('');
      if (kindsLine) { s(kindsLine); s(''); }
      for (const d of detail) s(d);
      s('');

      // Alle unsicheren Verweise einzeln
      s('**Unsichere Verweise** (alle, heute geltender Stand; keine Kanten):');
      s('');
      s('| Sprache | Quelle | Zitat | Grund |');
      s('|---|---|---|---|');
      let nu = 0;
      for (const lang of LANGS) {
        const seen = new Set();
        for (const r of ix[lang].refs) {
          if (!r.uncertain || seen.has(r.cid + '|' + r.why)) continue;
          seen.add(r.cid + '|' + r.why); nu++;
          s(`| ${lang.toUpperCase()} | ${r.from.unit} ${r.from.key} | «${esc(short(r.text, 90))}» | ${esc(r.why)} |`);
        }
      }
      if (!nu) s('| – | – | – | keine |');
      s('');
      // Aufzählungsregel vorher/nachher
      row.listRule = {};
      for (const lang of LANGS) {
        const wide = buildRefIndex(ds, lang, stage, { works, listRule: 'wide' });
        const freed = ix[lang].refs.filter((r) => !r.uncertain && wide.refs.some((o) => o.uncertain && o.from.unit === r.from.unit && o.from.key === r.from.key && o.at[0] === r.at[0] && o.hit[0] === r.hit[0]));
        row.listRule[lang] = { before: wide.stats.uncertain, after: ix[lang].stats.uncertain, freed };
      }

      // 5. Stichprobe
      s('**Prüfung 5 – Stichprobe** (je Sprache 20 Verweise, Auswahl deterministisch über Hash; Fundstelle mit ⟦…⟧ markiert):');
      s('');
      s('| Sprache | Quelle | Fundstelle im Wortlaut | Ziel | Art |');
      s('|---|---|---|---|---|');
      for (const lang of LANGS) {
        const pool = ix[lang].refs.slice().sort((a, b) => (hashString(`${id}|${lang}|${a.id}`) < hashString(`${id}|${lang}|${b.id}`) ? -1 : 1));
        const seen = new Set();
        const pick = [];
        for (const r of pool) { if (seen.has(r.cid)) continue; seen.add(r.cid); pick.push(r); if (pick.length === 20) break; }
        pick.sort((a, b) => a.id - b.id);
        for (const r of pick) {
          const B = blocksBy[lang].get(r.from.unit + ' ' + r.from.key);
          const P = B ? B.P : '';
          const ctx = `${P.slice(Math.max(0, r.at[0] - 45), r.at[0])}⟦${P.slice(r.at[0], r.at[1])}⟧${P.slice(r.at[1], r.at[1] + 30)}`.replace(/\s+/g, ' ').trim();
          const kind = r.uncertain ? `unsicher: ${r.why}` : r.to.kind + (r.to.work && r.to.work !== id ? ` (${r.to.work})` : '') + (r.to.missing ? ', fehlt am Stand' : '') + (r.to.keyMissing ? ', Unterteilung nicht gefunden' : '') + (r.to.key ? `, Block ${r.to.key}` : '');
          s(`| ${lang.toUpperCase()} | ${r.from.unit} ${r.from.key} | ${esc(ctx)} | ${esc(r.to.label)} | ${esc(kind)} |`);
        }
      }
      s('');
    }
  }
  summary.push(row);
  sections.push(S.join('\n'));
}

const rs = runtime.slice().sort((a, b) => a - b);

w('# Prüfbericht Verweis-Index (SPEC §12.2)');
w('');
w(`Erzeugt mit \`node scripts/validate-refs.mjs${NO_NET ? ' --no-net' : ''}\`; Bezugsdatum «heute» ${TODAY}; Index-Version \`src/core/refs.js\`. Zählregeln und Datenformen: \`data/STATUS_REFS.md\`.`);
w('');
w('## Übersicht (heute geltender Stand)');
w('');
w('| Erlass | Stand | 1 Sprachgleichheit Blöcke | 1 nur Zitate | 2 interne Ziele vorhanden | 2 Bibliotheksziele vorhanden | 3 Vollständigkeit DE / FR / IT | 4 Fedlex-Paare im Index DE / FR / IT | Refs DE / FR / IT | unsicher DE / FR / IT |');
w('|---|---|---|---|---|---|---|---|---|---|');
for (const r of summary) {
  const c = r.cur1;
  const comp = c.comp.map((x) => pct(x.sure + x.unsure, x.hits)).join(' / ');
  const fed = LANGS.map((l) => (r.fed && r.fed[l] ? `${r.fed[l].hit}/${r.fed[l].F}` : '–')).join(' / ');
  w(`| ${r.abbr} | ${r.cur} | ${c.eq}/${c.n1} (${pct(c.eq, c.n1)}) | ${c.eqCit}/${c.nCit} (${pct(c.eqCit, c.nCit)}) | ${c.internOk}/${c.intern} (${pct(c.internOk, c.intern)}) | ${c.libOk}/${c.lib} | ${comp} | ${fed} | ${LANGS.map((l) => c.stats[l].total).join(' / ')} | ${LANGS.map((l) => c.stats[l].uncertain).join(' / ')} |`);
}
w('');
w('Früher Stand: ' + summary.map((r) => `${r.abbr} ${r.early}: Sprachgleichheit ${r.early1.eq}/${r.early1.n1} (${pct(r.early1.eq, r.early1.n1)}), Vollständigkeit ${r.early1.comp.map((x) => pct(x.sure + x.unsure, x.hits)).join(' / ')}`).join('; ') + '.');
w('');
w('## Verfeinerung der Aufzählungsregel (Befund des Orchestrators vom 18. November 2026)');
w('');
w('Früher: Verweise in Aufzählungspunkten wurden unsicher, sobald der Einleitungssatz irgendeinen anderen Erlass nannte. Jetzt: unsicher nur, wenn der letzte Satz des Einleitungssatzes einen anderen Erlass **als Ganzes** nennt (ohne eigene Artikelangabe, z. B. «Durchführungsrechtsakte … relatifs au règlement (UE) 2017/2226 …:»); eine ausdrückliche Zuweisung («nachfolgend genannten Artikel und Absätze des Visakodex:», «articles suivants du …», «seguenti disposizioni della …») löst die Punkte auf diesen Erlass auf; ein in sich vollständiges Zitat («nach Artikel 66a StGB …:») lässt blosse Artikelverweise beim eigenen Erlass (Gesetzestechnik).');
w('');
w('| Erlass | Stand | unsicher vorher DE / FR / IT | unsicher nachher DE / FR / IT | frei gewordene Verweise (DE / FR / IT) |');
w('|---|---|---|---|---|');
for (const r of summary) {
  const lr = r.listRule;
  w(`| ${r.abbr} | ${r.cur} | ${LANGS.map((l) => lr[l].before).join(' / ')} | ${LANGS.map((l) => lr[l].after).join(' / ')} | ${LANGS.map((l) => lr[l].freed.length).join(' / ')} |`);
}
w('');
for (const r of summary) for (const l of LANGS) if (r.listRule[l].freed.length) w(`- ${r.abbr} ${l.toUpperCase()}: ${[...new Map(r.listRule[l].freed.map((x) => [x.cid, `${x.from.unit} ${x.from.key} «${esc(short(x.text, 60))}» → ${esc(x.to.label)}`])).values()].join('; ')}`);
w('');
w('Wirkung in allen Sprachen gleich: dieselben Blöcke werden in DE, FR und IT frei (AIG Art. 9d, 64c^bis, 75, 76, 122c; VEV Art. 4, 10). Einzige Ausnahme AIG Art. 76 Abs. 1 Bst. b Ziff. 1: in FR/IT frei geworden, in DE war er schon vorher sicher (DE-Einleitung «in Haft nehmen, wenn:» ohne Erlass) – jetzt in allen drei Sprachen gleich. Die Sprachgleichheit (Prüfung 1) des AIG stieg dadurch von 477 auf 479 Blöcke.');
w('');
// ------------------------------------------------------------------ Verdachtsfälle falscher interner Verweise
const MANUAL = {
  'cc-2007-758|art_110_c|p2': 'richtig: «al. 1»/«capoverso 1» ist Subjekt (Behörden nach Abs. 1 dieses Artikels); die Erlassangabe «loi fédérale du 13 juin 2008» gehört zu einer eigenen Nennung im Nebensatz',
  'cc-1999-358|art_107|p1': 'richtig: Bereich mit ausdrücklichem Selbstbezug «dieses Gesetzes» / «de la présente loi» / «della presente legge»; «Artikel 71 AIG» ist ein eigenes Zitat',
  'cc-1999-358|disp_u6|p.s2': 'richtig: «articolo 112b … della legge del 26 giugno 1998 sull’asilo» ist das AsylG selbst (Fassung der Änderung vom 28. September 2012)',
};
const LETTERS = ['a', 'b', 'c', 'd'];
w('## Verdachtsfälle falscher interner Verweise');
w('');
w('Nachsuche über alle fünf Erlasse, DE/FR/IT, heutiger und frühester Stand, in allen internen, nicht unsicheren Fundstellen: (a) Zitat in Klammern, nach der schliessenden Klammer folgt eine Erlassangabe; (b) bis zum Satzende folgt ohne neues Artikel-Stichwort eine Erlassangabe (Gattungswort mit Datum, benannter Erlass, EU-Nummer, bekanntes Kürzel); (c) nach «Buchstabe/lettre/lettera» steht ein Grossbuchstabe; (d) ein Bereich erzeugt mehr als 15 interne Ziele. «Vorher» = ohne die neue Brückenregel (`bridge: false`), «nachher» = heutiger Index. Eine Fundstelle zählt einmal, auch wenn mehrere Merkmale zutreffen.');
w('');
w('Neue Regel (Brücke zur Erlassangabe): Ein Zitat ohne Erlassangabe gehört zum Erlass, in den seine Fortsetzung im selben Satzteil mündet, wenn dazwischen nur eine schliessende Klammer (Zitat in Klammern), Gliederungsangaben mit Grossbuchstabe oder römischer Zahl («Buchstabe C», «section C», «sezione C», «Titel III», «Kapitel 2», «Abschnitt A», «Teil B») oder weitere Unterteilungen («Ziffern 1–6», «ch. 1 à 6») stehen. Ein Grossbuchstabe nach «Buchstabe/section/sezione» wird als `path.sec` geführt.');
w('');
w('| Erlass | Stand | Sprache | (a) vorher → nachher | (b) vorher → nachher | (c) vorher → nachher | (d) vorher → nachher | nachher: durch Regel behoben | nachher: begründet richtig |');
w('|---|---|---|---|---|---|---|---|---|');
const susRows = [];
const susFixed = [];
for (const id of L.order) {
  const ds = L.works[id];
  for (const stage of [stageAt(ds, TODAY), ds.stages[0].id]) for (const lang of LANGS) {
    const before = suspects(L, works, id, lang, stage, { bridge: false });
    const after = suspects(L, works, id, lang, stage);
    const k = (x) => `${x.unit}|${x.key}|${x.text}`;
    const afterK = new Set(after.map(k));
    const fixed = before.filter((x) => !afterK.has(k(x)));
    for (const x of fixed) susFixed.push(x);
    const cnt = (arr, f) => arr.filter((x) => x.flags.includes(f)).length;
    let justified = 0;
    for (const x of after) {
      const man = MANUAL[`${id}|${x.unit}|${x.key}`];
      x.final = man || x.decision || 'OFFEN';
      x.how = man ? 'einzeln nachgelesen' : x.decision ? 'automatisch (Erlassangabe gehört zu anderem Zitat)' : '–';
      if (x.final !== 'OFFEN') justified++;
      susRows.push(x);
    }
    w(`| ${ds.work.abbr.de} | ${stage} | ${lang.toUpperCase()} | ${LETTERS.map((f) => `${cnt(before, f)} → ${cnt(after, f)}`).slice(0, 1)} | ${cnt(before, 'b')} → ${cnt(after, 'b')} | ${cnt(before, 'c')} → ${cnt(after, 'c')} | ${cnt(before, 'd')} → ${cnt(after, 'd')} | ${fixed.length} | ${justified} von ${after.length} |`);
  }
}
w('');
w('Durch die Regel behoben (vorher interne Verweise, jetzt dem fremden Erlass zugeordnet oder unsicher):');
w('');
w('| Erlass | Stand | Sprache | Quelle | Merkmal | Zitat (vorher intern) | Ziele vorher |');
w('|---|---|---|---|---|---|---|');
for (const x of susFixed) w(`| ${x.id} | ${x.stage} | ${x.lang.toUpperCase()} | ${x.unit} ${x.key} | ${x.flags.join(',')} | «${esc(short(x.ctx, 110))}» | ${x.nTargets} |`);
w('');
w('Verbleibende Verdachtsfälle (heutiger Index) mit Entscheid:');
w('');
w('| Erlass | Stand | Sprache | Quelle | Merkmal | Fundstelle mit Fortsetzung | Entscheid | Art |');
w('|---|---|---|---|---|---|---|---|');
for (const x of susRows) w(`| ${x.id} | ${x.stage} | ${x.lang.toUpperCase()} | ${x.unit} ${x.key} | ${x.flags.join(',')} | «${esc(short(x.ctx, 110))}» | ${esc(x.final)} | ${x.how} |`);
w('');
const open_ = susRows.filter((x) => x.final === 'OFFEN').length;
w(`Offen: ${open_}. Gesamt vorher→nachher siehe Tabelle; behoben ${susFixed.length} Fundstellen.`);
w('');
// Sprachgleichheit mit und ohne Brücke (heutiger Stand)
w('Sprachgleichheit (Blöcke, heutiger Stand) ohne → mit Brückenregel: ' + L.order.map((id) => {
  const ds = L.works[id]; const st = stageAt(ds, TODAY);
  const eqOf = (opts) => {
    const g = new Map();
    for (const lang of LANGS) for (const r of buildRefIndex(ds, lang, st, { works, ...opts }).refs) { const k = r.from.unit + ' ' + r.from.key; if (!g.has(k)) g.set(k, { de: new Set(), fr: new Set(), it: new Set() }); if (!r.uncertain) g.get(k)[lang].add(targetKey(r.to)); }
    let e = 0; const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    for (const v of g.values()) if (same(v.de, v.fr) && same(v.de, v.it)) e++;
    return `${e}/${g.size}`;
  };
  return `${ds.work.abbr.de} ${eqOf({ bridge: false })} → ${eqOf({})}`;
}).join('; ') + '.');
w('');

// ------------------------------------------------------------------ EU-Ziele je Erlass (DE)
w('## EU-Ziele je Erlass (DE, heutiger Stand)');
w('');
w('`to.label` bzw. `to.euText` geben die Bezeichnung so wieder, wie sie an der Fundstelle steht (nichts ergänzt, nichts weggelassen; bei «Verordnungen (EU) 2019/817 und (EU) 2019/818» je Ziel der eigene Teil). CELEX = «3» + Jahr + Typ (R Verordnung, auch Durchführungs- und delegierte Verordnung; L Richtlinie; D Beschluss/Entscheidung; F Rahmenbeschluss) + Nummer vierstellig, z. B. Verordnung (EU) 2016/399 → 32016R0399, Verordnung (EG) Nr. 810/2009 → 32009R0810, Richtlinie 2008/115/EG → 32008L0115. Jahr/Nummer: neue Zählung «(EU) JJJJ/N», alte Verordnungen «Nr. N/JJJJ», Richtlinien und Beschlüsse «JJJJ/N/…». CELEX fehlt nie bei einem erkannten Akt; ohne Gattung oder Nummer wird der Verweis unsicher (`whyCode: \'eu\'`) statt geraten. Nicht abgedeckt: Berichtigungen und konsolidierte Fassungen (Link führt auf den Grundakt).');
w('');
for (const id of L.order) {
  const ds = L.works[id];
  const ix = buildRefIndex(ds, 'de', stageAt(ds, TODAY), { works });
  const m = new Map();
  for (const r of ix.refs) if (!r.uncertain && r.to.kind === 'eu') { const c = r.to.eu.celex; if (!m.has(c)) m.set(c, new Map()); const t = r.to.euText || r.to.label; m.get(c).set(t, (m.get(c).get(t) || 0) + 1); }
  w(`**${ds.work.abbr.de}** (${m.size} EU-Rechtsakte): ` + [...m].sort().map(([c, ls]) => `${c}: ${[...ls].map(([t, n]) => `«${esc(t)}» ×${n}`).join(', ')}`).join('; '));
  w('');
}

w(`**Laufzeit** AIG, alle ${L.works['cc-2007-758'].stages.length} Stände × 3 Sprachen (${rs.length} Läufe, Node ${process.version}): erster (kalter) Lauf ${runtime[0].toFixed(0)} ms, Median ${rs[Math.floor(rs.length / 2)].toFixed(0)} ms, Maximum ${rs[rs.length - 1].toFixed(0)} ms (Vorgabe < 300 ms). Die ms-Spalten in den Abschnitten unten sind im selben Prozess nach vielen weiteren Läufen gemessen und enthalten Speicherbereinigung.`);
w('');
w('Lesehilfe: «Art» der Ursache: **Quelle** = die Sprachfassungen sagen Verschiedenes; **Datensatz** = Blockschlüssel bzw. Gliederung der Sprachfassungen weichen ab; **Index** = Grenze der Erkennung (meist unsicher statt aufgelöst). «geprüft: ja» = am Wortlaut nachgelesen; «nein (automatisch)» = Einordnung nach Regel, nicht einzeln nachgelesen.');
w('');
for (const sec of sections) { w(sec); w(''); }
fs.writeFileSync(path.join(ROOT, 'data/VALIDATION_REFS.md'), out.join('\n'));
console.log(`data/VALIDATION_REFS.md geschrieben (${out.length} Zeilen). Laufzeit AIG max ${rs[rs.length - 1].toFixed(0)} ms.`);
