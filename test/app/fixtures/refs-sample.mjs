// Handgeschriebener Beispiel-Index nach SPEC §12.2 (Formen von buildRefIndex), für die Modelltests ohne src/core/refs.js.
// Erlass A (cc-a, «AG») mit Art. 1 bis 6 und Anhang 1; Erlass B (cc-b, «BV») der Bibliothek verweist auf A.
const R = (unit, key, at, to, extra = {}) => ({ from: { unit, key }, text: extra.text || 'Artikel', at, to, ...extra });

export const OWN = 'cc-a';
export const OTHER = 'cc-b';
export const UNITS = ['art_1', 'art_2', 'art_3', 'art_4', 'art_5', 'art_6', 'annex_1'];

export const indexA = {
  work: OWN, lang: 'de', stage: '20250101',
  refs: [
    // Art. 1 Abs. 1 → Art. 2 (zweimal an verschiedenen Stellen), Art. 3 Abs. 2
    R('art_1', 'p1', [10, 19], { kind: 'internal', unit: 'art_2', label: 'Art. 2' }),
    R('art_1', 'p1', [40, 49], { kind: 'internal', unit: 'art_2', key: 'p1', label: 'Art. 2 Abs. 1' }),
    R('art_1', 'p2', [5, 25], { kind: 'internal', unit: 'art_3', key: 'p2', label: 'Art. 3 Abs. 2' }),
    // Aufzählung «Artikel 4 Absätze 1 und 2»: eine Fundstelle, zwei Ziele derselben Einheit → einmal
    R('art_1', 'p2.a', [0, 30], { kind: 'internal', unit: 'art_4', key: 'p1', label: 'Art. 4 Abs. 1' }),
    R('art_1', 'p2.a', [0, 30], { kind: 'internal', unit: 'art_4', key: 'p2', label: 'Art. 4 Abs. 2' }),
    // Bereich «Artikel 5–6»: eine Fundstelle, zwei Einheiten → je einmal
    R('art_1', 'p3', [3, 18], { kind: 'internal', unit: 'art_5', label: 'Art. 5' }),
    R('art_1', 'p3', [3, 18], { kind: 'internal', unit: 'art_6', label: 'Art. 6' }),
    // relativer Verweis in derselben Einheit: keine Kante
    R('art_1', 'p3', [30, 39], { kind: 'internal', unit: 'art_1', key: 'p2', label: 'Abs. 2' }),
    // unsicher: keine Kante, gezählt
    R('art_1', 'p3', [50, 60], { kind: 'internal', label: '?' }, { uncertain: true, why: 'mehrdeutig' }),
    // fehlt am Stand
    R('art_1', 'p1', [70, 80], { kind: 'internal', unit: 'art_99', label: 'Art. 99', missing: true }),
    // SR ausserhalb, EU, Bibliothek
    R('art_1', 'p1', [90, 110], { kind: 'sr', sr: '311.0', abbr: 'StGB', unit: 'art_66_a', label: 'Art. 66a StGB' }),
    R('art_1', 'p2', [60, 80], { kind: 'sr', sr: '311.0', abbr: 'StGB', unit: 'art_66_a', key: 'p1', label: 'Art. 66a Abs. 1 StGB' }),
    R('art_1', 'p2', [90, 120], { kind: 'eu', eu: { type: 'regulation', year: 2016, no: 399, celex: '32016R0399' }, label: 'Verordnung (EU) 2016/399' }),
    R('art_1', 'p1', [120, 140], { kind: 'sr', work: OTHER, sr: '101', abbr: 'BV', unit: 'art_121', label: 'Art. 121 BV' }),
    // Art. 2 → Art. 1 (Rückverweis), Art. 3 → Art. 1 Abs. 2
    R('art_2', 'p1', [0, 10], { kind: 'internal', unit: 'art_1', label: 'Art. 1' }),
    R('art_3', 'p1', [0, 15], { kind: 'internal', unit: 'art_1', key: 'p2', label: 'Art. 1 Abs. 2' }),
    R('art_3', 'p1', [20, 35], { kind: 'internal', unit: 'art_1', key: 'p2.a', label: 'Art. 1 Abs. 2 Bst. a' }),
    // Anhang → Art. 6
    R('annex_1', 'n1', [0, 9], { kind: 'internal', unit: 'art_6', label: 'Art. 6' }),
  ],
  stats: {},
};

export const indexB = {
  work: OTHER, lang: 'de', stage: '20240101',
  refs: [
    R('art_10', 'p1', [0, 20], { kind: 'sr', work: OWN, abbr: 'AG', unit: 'art_1', label: 'Art. 1 AG' }),
    R('art_11', 'p1', [0, 20], { kind: 'sr', work: OWN, abbr: 'AG', unit: 'art_1', key: 'p1', label: 'Art. 1 Abs. 1 AG' }),
    R('art_11', 'p2', [0, 20], { kind: 'sr', work: OWN, abbr: 'AG', unit: 'art_5', label: 'Art. 5 AG' }),
    // intern in B: zählt nicht für A
    R('art_12', 'p1', [0, 20], { kind: 'internal', unit: 'art_1', label: 'Art. 1' }),
  ],
  stats: {},
};

export function sampleCtx() {
  const pos = { [OWN]: new Map(UNITS.map((u, i) => [u, i])), [OTHER]: new Map(['art_10', 'art_11', 'art_12', 'art_121'].map((u, i) => [u, i])) };
  return {
    work: OWN, lang: 'de', stage: '20250101',
    index: indexA,
    others: [{ work: OTHER, index: indexB }],
    libOrder: [OWN, OTHER],
    unitPos: (w, u) => (pos[w] && pos[w].has(u) ? pos[w].get(u) : Infinity),
  };
}
