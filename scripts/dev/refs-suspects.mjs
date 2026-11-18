// Verdachtsfälle falscher interner Verweise (a)–(d); auch von scripts/validate-refs.mjs genutzt.
// node scripts/dev/refs-suspects.mjs [work] [stage]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRefIndex, worksFromLibrary, plainText, isSourceBlock } from '../../src/core/refs.js';
import { getVersion } from '../../src/core/model.js';

const ART_KW = { de: /(?<![\p{L}])(?:Artikeln?|Artikels|Art\.?)\s*\d/u, fr: /(?<![\p{L}])(?:articles?|art\.?)\s*\d/iu, it: /(?<![\p{L}])(?:articol[oi]|artt?\.)\s*\d/iu };
const DET = { de: '(?:des|der|dem|den)', fr: '(?:du|des|de\\s+la|de\\s+l[’\']|de)', it: '(?:del|della|dello|dell[’\']|dei|degli|delle|di)' };
const EU_RX = /(?:[(\[](?:EU|EG|UE|CE|EWG|CEE)[)\]]\s*(?:Nr\.|n\.|no)?\s*\d{1,4}\/\d{1,4}|\d{4}\/\d{1,4}\/(?:EU|EG|UE|CE|JI|JAI|GAI))/u;
const ACT_DE = /(?<![\p{L}])\p{Lu}[\p{L}-]*(?:gesetz|gesetzes|gesetzbuch|gesetzbuchs|verordnung|verordnungen|abkommen|abkommens|übereinkommen|übereinkommens|protokoll|protokolls|konvention|vertrag|vertrags|kodex|kodexes|verfassung|richtlinie|beschluss|beschlusses)(?![\p{L}])/u;
const ACT_RO = { fr: /(?<![\p{L}])(?:loi|ordonnance|accord|convention|protocole|code|traité|règlement|directive|décision|constitution)(?![\p{L}])/iu,
  it: /(?<![\p{L}])(?:legge|ordinanza|accordo|convenzione|protocollo|codice|trattato|regolamento|direttiva|decisione|costituzione)(?![\p{L}])/iu };
const SELF = /(?:dieses|des vorliegenden|dieser|der vorliegenden)\s+(?:Gesetzes|Verordnung|Erlasses)|(?:de la présente|du présent)\s+\p{L}+|(?:della presente|del presente)\s+\p{L}+/u;

const DATE_AFTER = { de: /^[^.;:]{0,60}?\bvom\s+\d{1,2}\.\s/u, fr: /^[^.;:]{0,60}?\bdu\s+\d{1,2}(?:er)?\s+\p{L}/u, it: /^[^.;:]{0,60}?\b(?:del|dell[’'])\s?\d{1,2}°?\s+\p{L}/u };
const NAMED = { de: /(?<![\p{L}])(?:Strafgesetzbuch|Zivilgesetzbuch|Militärstrafgesetz|Bundesverfassung|Obligationenrecht|Schengener Grenzkodex|Visakodex|Flüchtlingskonvention)/u,
  fr: /(?<![\p{L}])(?:code pénal|code civil|Constitution|code frontières Schengen|code des visas)/iu, it: /(?<![\p{L}])(?:codice penale|codice civile|Costituzione|codice frontiere Schengen|codice dei visti)/iu };
function findDesig(t, lang, abbrs) {
  // erste Erlassangabe in t (Position) oder -1: EU-Nummer, benannter Erlass, Gattungswort mit Datum, bekanntes Kürzel
  const cands = [];
  const e = EU_RX.exec(t); if (e) cands.push(e.index);
  const n = NAMED[lang].exec(t); if (n) cands.push(n.index);
  const act = lang === 'de' ? new RegExp(ACT_DE.source, 'gu') : new RegExp(ACT_RO[lang].source, 'giu');
  for (const a of t.matchAll(act)) if (DATE_AFTER[lang].test(t.slice(a.index))) { cands.push(a.index); break; }
  for (const m of t.matchAll(/(?<![\p{L}\d-])\p{Lu}[\p{L}]{0,9}(?:[-‑]\p{Lu}[\p{L}]{0,8})?(?![\p{L}\d-])/gu)) if (abbrs.has(m[0])) { cands.push(m.index); break; }
  return cands.length ? Math.min(...cands) : -1;
}

export function suspects(L, works, id, lang, stage, opts = {}) {
  const ds = L.works[id];
  const ix = buildRefIndex(ds, lang, stage, { works, ...opts });
  const abbrs = new Set([...Object.keys(ix.abbr), ...works.map((w) => w.abbr && w.abbr[lang]).filter(Boolean)]);
  if (ds.work.abbr && ds.work.abbr[lang]) abbrs.delete(ds.work.abbr[lang]);
  const byBlock = new Map();
  for (const r of ix.refs) { const k = r.from.unit + ' ' + r.from.key; if (!byBlock.has(k)) byBlock.set(k, []); byBlock.get(k).push(r); }
  const out = [];
  const seen = new Set();
  for (const r of ix.refs) {
    if (r.uncertain || r.to.kind !== 'internal' || seen.has(r.cid)) continue;
    seen.add(r.cid);
    const v = getVersion(ds, r.from.unit, lang, stage);
    const b = v.blocks.find((x) => x.k === r.from.key);
    const P = plainText(b.t);
    const same = byBlock.get(r.from.unit + ' ' + r.from.key);
    const nTargets = same.filter((x) => x.cid === r.cid).length;
    const flags = [];
    let desigPos = -1;
    // (a) Zitat in Klammern, nach der schliessenden Klammer eine Erlassangabe
    const before = P.slice(0, r.at[0]);
    if (before.lastIndexOf('(') > before.lastIndexOf(')')) {
      const close = P.indexOf(')', r.at[1] - 1);
      if (close >= 0) {
        const after = P.slice(close + 1, close + 120);
        const lead = new RegExp(`^\\s*,?\\s*(?:${DET[lang]}\\s*)?`, 'u').exec(after)[0].length;
        const d0 = findDesig(after.slice(lead, lead + 60), lang, abbrs);
        if (d0 === 0 && !SELF.test(after.slice(0, 40))) { flags.push('a'); desigPos = close + 1 + lead; }
      }
    }
    // (b) bis zum Satzende ohne neues Artikel-Stichwort eine Erlassangabe
    const restFull = P.slice(r.at[1]);
    const endM = /(?<!(?:^|[\s(])(?:al|ch|let|art|Art|Abs|Bst|Ziff|n|cpv|lett|par|Nr|no|pt|artt|Ziff|lit))[.;:](?:\s|$)/u.exec(restFull);
    let rest = endM ? restFull.slice(0, endM.index) : restFull;
    const nk = ART_KW[lang].exec(rest);
    if (nk) rest = rest.slice(0, nk.index);
    const dp = findDesig(rest, lang, abbrs);
    if (dp >= 0) { flags.push('b'); if (desigPos < 0) desigPos = r.at[1] + dp; }
    // (c) Grossbuchstabe nach Buchstabe/lettre/lettera
    if (/(?:Buchstaben?|Bst\.|lettres?|let\.|lettere?|lett\.)\s+[A-Z](?![\p{L}])/u.test(P.slice(r.at[0], r.at[1] + 25))) flags.push('c');
    // (d) Bereich mit mehr als 15 internen Zielen
    if (nTargets > 15) flags.push('d');
    if (!flags.length) continue;
    // Entscheid: Erlassangabe gehört zu einer eigenen Nennung/einem eigenen Zitat im Block?
    let decision = null;
    if (desigPos >= 0) {
      const other = same.find((x) => x.cid !== r.cid && x.to.kind !== 'internal' && desigPos >= x.at[0] - 1 && desigPos < x.at[1]);
      if (other) decision = `richtig: Erlassangabe gehört zu eigenem Zitat/Nennung «${other.text.replace(/\s+/g, ' ').slice(0, 60)}»`;
      else {
        const otherU = same.find((x) => x.cid !== r.cid && x.uncertain && desigPos >= x.at[0] - 1 && desigPos < x.at[1]);
        if (otherU) decision = `richtig: Erlassangabe gehört zu eigenem (unsicherem) Zitat «${otherU.text.replace(/\s+/g, ' ').slice(0, 60)}»`;
      }
    }
    out.push({ id, lang, stage, unit: r.from.unit, key: r.from.key, text: r.text.replace(/\s+/g, ' '), flags, nTargets, ctx: P.slice(r.at[0], Math.min(P.length, r.at[1] + 90)).replace(/\s+/g, ' '), decision, desigText: desigPos >= 0 ? P.slice(desigPos, desigPos + 40).replace(/\s+/g, ' ') : '' });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const L = JSON.parse(fs.readFileSync(new URL('../../data/library.json', import.meta.url), 'utf8'));
  const works = worksFromLibrary(L);
  const ids = process.argv[2] ? [process.argv[2]] : L.order;
  for (const id of ids) {
    const ds = L.works[id];
    for (const st of process.argv[3] ? [process.argv[3]] : [ds.stages[0].id, 'cur']) {
      const stage = st === 'cur' ? ds.stages.filter((s) => s.date <= '2026-11-18').at(-1).id : st;
      for (const lang of ['de', 'fr', 'it']) for (const x of suspects(L, works, id, lang, stage)) console.log(`${id} ${stage} ${lang} ${x.unit} ${x.key} [${x.flags}] n=${x.nTargets} «${x.ctx}» → ${x.decision || 'ZU PRÜFEN (' + x.desigText + ')'}`);
    }
  }
}
