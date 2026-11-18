# Status Agent VERWEISE-KERN — `src/core/refs.js` (Schlussfassung)

Änderungsprotokoll (Signaturen und Datenformen; alle Änderungen nach der ersten Fassung sind **additiv**, keine bestehende Form geändert):

- 18.11.2026 00.41 Uhr: erste Fassung (Signaturen, Datenformen, Zählregeln).
- 18.11.2026 01.32 Uhr, Nachtrag nach der Gegenprüfung des Orchestrators, additiv (keine Signatur geändert):
  - `Ref.whyCode` (bei jedem unsicheren Ref) aus der festen Liste `WHY_CODES` (neuer Export), Bedeutung unten; `why` bleibt.
  - `Target.euText`: EU-Bezeichnung so, wie sie an der Fundstelle steht; `to.label` verwendet sie jetzt auch
    («Verordnung (EG) Nr. 810/2009», «Schengener Grenzkodex»; früher teils normalisiert «Verordnung Nr. 810/2009»).
  - `path.sec`: Grossbuchstabe einer Gliederung in Staatsverträgen («Artikel 1 Buchstabe C», FR «section C», IT «sezione C»); auch in `targetKey`.
  - Neue Regel «Brücke zur Erlassangabe» (behebt falsche interne Verweise VEV Art. 12 und AsylG Art. 63/64); Option `bridge: false`
    nur für den Vorher-Nachher-Vergleich im Prüfbericht.
  - Blöcke ganz ohne Ziffer und Grossbuchstabe werden nicht mehr übersprungen, wenn sie ein Stichwort enthalten (FR «la let. c»).
- 18.11.2026 01.30 Uhr, Schlussfassung, additiv:
  - neue Exporte `isSourceBlock(unitType, block)`, `artUnitId(num)`, `REFS_VERSION`.
  - `RefIndex.conflicts` (Widersprüche im Kürzel-/Titelregister, zur Ausweisung).
  - `Target.via`: `'range'` (Zitat fällt in einen Bereichsartikel wie `art_105_107`), `'group'` (Erlassangabe aus dem unmittelbar
    folgenden Zitat übernommen, z. B. FR «art. 10, par. 6, et à l’art. 11, par. 6, du règlement …»).
  - Option `buildRefIndex(…, { works, listRule: 'wide' })` nur für den Vorher-Nachher-Vergleich im Prüfbericht; die Oberfläche setzt sie nicht.
  - Verweiszeilen am Anfang eines Anhangs («(Art. 2 Abs. 4 und 64a Abs. 4)», Schlüssel `s1`) sind jetzt wie `sh` keine Quelle.

Befehle: `SR_NO_NET=1 node --test test/core/*.test.mjs` (49 Tests: 48 bestanden, 1 übersprungen; davon 23 in `test/core/refs.test.mjs`),
`node scripts/validate-refs.mjs [--no-net] [--refresh]` → `data/VALIDATION_REFS.md` (ca. 15 s; Fedlex-Zitatmetadaten aus dem
Zwischenspeicher `scripts/dev/cache/fedlex-citations.json`, mit `--refresh` neu abgefragt). Der Index selbst braucht kein Netz.

## Signaturen (ESM, isomorph, ohne DOM/Netz, deterministisch)

```js
import { buildRefIndex, plainText, highlight, refsFrom, refsTo, targetKey, nodeKey, edges, externalUrl,
         worksFromLibrary, isSourceBlock, artUnitId, WHY_CODES } from '../core/refs.js';

worksFromLibrary(library) -> Work[]            // library = Inhalt von data/library.json bzw. { order, works }
// Work = { id, sr, eli, abbr:{de,fr,it}, title:{de,fr,it}, short:{de,fr,it}, bundle? }
//   bundle optional; ohne bundle wird die Ziel-Einheit im Bibliotheks-Erlass nicht geprüft (to.unchecked = true)

buildRefIndex(bundle, lang, stageId, { works }) -> RefIndex
RefIndex = { work, lang, stage, date: 'JJJJ-MM-TT', refs: Ref[],
             stats: { total, internal, sr, library, eu, other, uncertain, dangling, citations, blocks, ms },
             abbr: { '<Kürzel oder EU-Name>': { sr, eli } | { eu } },        // Register dieses Erlasses (Anzeige/Prüfung)
             conflicts: [ { key, values: [sr…], at: ['<unit> <key>', …] } ] }

Ref = { id,                  // 0..n-1 in Dokumentreihenfolge (Block, dann Position), deterministisch
        cid,                 // Fundstelle (Zitat), 0..citations-1; alle Refs aus demselben Zitat teilen die cid
        from: { unit, key }, // Quelle: Einheit und Block (Schlüssel wie im Bundle)
        text,                // Zitat im Wortlaut ohne Markup, inkl. Erlassangabe («Artikel 26 Absatz 1bis AsylG»)
        at: [start, end],    // Position von text in plainText(block.t)  (Quelle enthält geschützte Leerzeichen U+00A0)
        hit: [start, end],   // Zahl/Buchstabe, die genau dieses Ziel bezeichnet (innerhalb von at); bei Nennungen = at
        to: Target,
        uncertain?: true, why?: string,   // why: deutscher Klartext
        whyCode?: string }                // sprachunabhängig, einer von WHY_CODES (siehe unten)

Target = { kind: 'internal' | 'sr' | 'eu' | 'other',
           work?,     // Bibliotheks-Id: 'internal' immer eigener Erlass; 'sr' gesetzt, wenn der Ziel-Erlass in der Bibliothek liegt
           stage?,    // Bibliotheks-Ziel: Stand des Ziel-Erlasses am Datum des Quell-Stands (stageAt)
           sr?, eli?, abbr?, title?,
           unit?,     // Ziel-Einheit (art_64, art_66_a_bis, annex_1); ausserhalb der Bibliothek nach derselben Regel gebildet (artUnitId)
           key?,      // Ziel-Block, nur wenn eindeutig vorhanden
           euText?,   // EU: Bezeichnung wie an der Fundstelle («Verordnung (EG) Nr. 810/2009», «Visakodex», «(EU) 2019/818»)
           path,      // zitierte Gliederung, sprachunabhängig { art?, annex?, sec?, par?, let?, num? } ('66abis', '1bis', 'a', '2.1'); Bereich 'von-bis'
                      // {} = Nennung des ganzen Erlasses ohne Artikel («nach dem Bundesgesetz vom 13. Juni 2008», «Schengener Grenzkodex»)
           label,     // in der Sprache des Index, Zitierweise wie src/app/lib/cite.js («Art. 66a StGB», «art. 26, al. 1bis, LAsi», «art. 5 cpv. 1»)
           eu?: { type: 'R'|'L'|'D'|'F', year, no, celex },   // R Verordnung, L Richtlinie, D Beschluss, F Rahmenbeschluss
           missing?: true,    // Ziel-Einheit fehlt am Stand (aufgehoben, weggefallen, nie vorhanden)
           keyMissing?: true, // Einheit vorhanden, zitierte Unterteilung nicht eindeutig gefunden; dann kein key
           unchecked?: true,  // Bibliotheks-Ziel ohne Bundle bzw. Ziel-Erlass am Datum noch ohne Stand
           range?: true,      // Ziel aus einem Bereich
           via?: 'range' | 'group' }

plainText(html) -> string          // Blocktext ohne Markup; <br> = 1 Leerzeichen; Entitäten aufgelöst
highlight(html, ranges, open = '<mark>', close = '</mark>') -> html   // markiert [s,e] (plainText-Positionen) im Inline-HTML
refsFrom(index, unit, key = null, { deep = true, uncertain = false }) -> Ref[]    // ausgehend; deep: key und key.*
refsTo(index, { work, unit, key = null }, { deep = true, uncertain = false }) -> Ref[]   // eingehend, auch aus Index eines anderen Erlasses
targetKey(to) -> string            // sprachunabhängige Identität (Grundlage Sprachgleichheit): 'w:<work>#<unit>#k=<key>' | 'w:…#…#<path>' | 'sr:<sr>#<path>' | 'eu:<celex>#<path>'
nodeKey(to, { units = true }) -> string   // 'w:<work>#<unit>', 'w:<work>', 'sr:<sr>[#<unit>]', 'eu:<celex>[#art_<n>]'
edges(index, { externalUnits = false }) -> [ { from: unit, to: nodeKey, target, n, refs } ]
externalUrl(to, lang) -> string | null    // SR mit ELI: https://www.fedlex.admin.ch/eli/cc/…/<lang>[#<unit>]; EU mit CELEX: EUR-Lex; sonst null
isSourceBlock(unitType, block) -> boolean // gleiche Quellenregel wie der Index
artUnitId('109lquater') -> 'art_109_l_quater'
```

Bibliothek in der Oberfläche: `works = worksFromLibrary(library)` einmal bilden; eingehende Verweise einer Einheit des Erlasses A:
`refsTo(buildRefIndex(B, lang, stageAt(B, datumDesStandsVonA), { works }), { work: A.id, unit })` für jeden Erlass B ≠ A, dazu der eigene Index.
Der Index wird je (Bundle, Sprache, Stand) berechnet; Zwischenspeicher hängen per WeakMap am Bundle-Objekt (Bundle nicht verändern).

## `whyCode` (feste Liste, `WHY_CODES`)

| Code | Bedeutung |
|---|---|
| `anaphor` | Rückverweis auf einen vorher genannten Erlass («dieser Verordnungen», «desdits règlements», «di tali regolamenti», «de la même loi» ohne eindeutigen Bezug) |
| `act-type` | Demonstrativ auf einen Erlass anderer Art («dieser Verordnung» in einem Gesetz) |
| `act` | Erlass nicht bestimmbar (Gattungswort ohne Datum/Kürzel, kein SR-Nachweis, z. B. aufgehobene Erlasse) |
| `no-sr` | Erlass mit Titel genannt, aber ohne SR-Fussnote und ohne Registereintrag |
| `abbr` | Kürzel unbekannt bzw. mit angehängter Zahl («LAsi40») |
| `eu` | EU-Rechtsakt nicht bestimmbar (ohne Nummer, ohne Gattung, Kurzname mehrdeutig) |
| `fn` | SR-Fussnote nicht eindeutig zuordenbar, Fussnote nennt mehrere SR-Nummern, Bezeichnung im Erlass mehrdeutig |
| `sub` | Unterteilung ohne Artikel bei fremdem Erlass («Absatz 7 DSG» ohne Artikel) |
| `annex` | Anhang mit römischer Zahl ohne EU-Bezug oder Anhang eines nicht bestimmbaren Erlasses |
| `list` | Aufzählungspunkt: Einleitungssatz nennt einen anderen Erlass als Ganzes |
| `group` | Zitat ohne Erlassangabe unmittelbar vor einem Zitat eines anderen Erlasses |
| `range` | Bereich am Stand nicht auflösbar |
| `other` | sonstiger Grund (kommt derzeit nicht vor) |

## EU-Bezeichnung und CELEX

`to.label` = zitierte Gliederung in der Zitierweise der Sprache + EU-Bezeichnung **wie an der Fundstelle** (`to.euText`, ohne den
vorangehenden Artikel «des/du/del»; bei «Verordnungen (EU) 2019/817 und (EU) 2019/818» je Ziel der eigene Teil). CELEX = «3» + Jahr +
Typ (R Verordnung inkl. Durchführungs-/delegierte, L Richtlinie, D Beschluss/Entscheidung, F Rahmenbeschluss) + Nummer vierstellig.
Jahr/Nummer: «(EU) JJJJ/N» (ab 2015), «(EG) Nr. N/JJJJ» (alte Verordnungen; zweistellige Jahre → 19xx), «JJJJ/N/EG|JI…» (Richtlinien,
Beschlüsse). Ein erkannter EU-Akt hat immer CELEX; ohne Gattung oder Nummer wird der Verweis unsicher (`whyCode: 'eu'`).
Nicht abgedeckt: Berichtigungen, konsolidierte Fassungen; gemeinsame Massnahmen der dritten Säule (z. B. «Beschluss 94/795/JI») sind als D geführt.

## Zählregeln (für Netz und Struktur verbindlich, in `edges` umgesetzt)

- **Fundstelle** = Zitat (`cid`). «Artikel 7 und 8» ist eine Fundstelle mit zwei Refs. Zahl der Fundstellen einer Kante = Zahl
  verschiedener `cid` (nicht Zahl der Refs); «Artikel 62 Absatz 1 und Absatz 2» = zwei Refs auf `art_62`, eine Fundstelle.
- **Keine Kanten**: unsichere Refs (`uncertain`), `kind: 'other'`, Verweise in dieselbe Einheit des eigenen Erlasses.
- **Ziel-Knoten**: eigener Erlass und Bibliothek je Einheit (`w:<work>#<unit>`; ohne unit = ganzer Erlass `w:<work>`); SR ausserhalb und
  EU standardmässig je Erlass (`sr:<sr>`, `eu:<celex>`), mit `externalUnits: true` je Artikel.
- **Bereiche**: «Artikel 10–12» → je am Stand vorhandener Artikel ein Ref (eingefügte wie 11a eingeschlossen; aufgehobene Hüllen nur
  als Anfang/Ende), `range: true`, gleiche cid. Ausserhalb der Bibliothek ein Ref mit `path.art = '10-12'`, ohne `unit`.
  Unterbereiche («Absätze 1–3», «Buchstaben b–d») je vorhandener Block; ohne Treffer ein Ref mit `keyMissing`.
- **`missing: true`** (gestrichelt, «fehlt an diesem Stand») zählt als Kante. **Nennungen ganzer Erlasse** (`path` = {}) sind Kanten zum Erlass-Knoten.

## Erkennung (Kurzfassung)

- **Quellen**: alle Blöcke der am Stand vorhandenen Einheiten (auch Ingress, Schluss- und Übergangsbestimmungen, Anhänge); nicht:
  Fussnoten, Titel, Gliederungstitel, `ty: heading | table | img`, Verweiszeilen (`sh`, Anhang-`s1` «(Art. …)»).
- **Zitate**: DE Artikel/Artikeln/Artikels/Art.(auch «Art» ohne Punkt vor Zahl, Quelle), Absatz/Absätze/Abs., Buchstabe(n)/Bst., Ziffer(n)/Ziff.,
  Nummer, Anhang; FR article(s)/art., alinéa(s)/al., paragraphe/par., lettre(s)/let., point/pt., chiffre(s)/ch., annexe; IT articolo/i/art./artt.,
  capoverso/i/cpv., paragrafo/par., lettera/e/lett., numero/i/n., punto, allegato. Aufzählung («,», und/oder/sowie/bzw., et/ou, e/o/ed/nonché),
  Bereich («–», «−», «‑», FR «à»), lateinische Zusätze (auch Markup-Artefakt «42 <i>ter</i>»), Satzangaben («dritter Satz», «3e phrase»,
  «terzo periodo») und «Teil B» werden übersprungen.
- **Stufe einer blossen Zahl** nach einer Unterstufe: Einzahl («Absatz 4 und 8» → Art. 8), Mehrzahl («Absätze 1 und 3»), Abkürzung nach
  Nähe der Zahl; «Artikeln/articoli» in der Mehrzahl verlangt einen weiteren Artikel; FR «, et» schliesst die Unterstufe; nach oben die erste
  passende Stufe («ch. 5, et 76a» → Art. 76a); folgt ein Stichwort derselben Stufe, geht die Zahl nach oben. Bei Bibliothekszielen
  wird der Block am Ziel geprüft (`keyMissing`).
- **Erlassangabe** nach dem Zitat: Selbstbezug («dieses Gesetzes», «de la présente loi», «della presente legge»; Art des Erlasses muss
  passen, sonst unsicher), Kürzel (eigenes, Bibliothek, im Erlass eingeführt), Titel mit Datum («des Asylgesetzes vom 26. Juni 1998»,
  auch abgekürzte Monate und «L/LF/O du …»), benannte Gesetzbücher («Strafgesetzbuch», «code pénal», «Codice civile»), Stämme
  («des Ausweisgesetzes»), EU-Rechtsakte mit Nummer («Verordnung (EU) 2016/399», «[EU]», Mehrzahl «(UE) 2019/817 et (UE) 2019/818») oder
  über Kurznamen aus der EU-Fussnote («Schengener Grenzkodex», «code des visas»), «derselben/de la même loi» nur bei genau einem
  vorher im Block genannten Erlass, «Ziffer 2 des Anhangs 1 [des X]».
- **SR-Nummer**: aus den Fussnoten des Blocks (Art `ref`, «SR 311.0» mit ELI). Die Fussnotenposition fehlt im Bundle; die Zuordnung
  Fussnote ↔ Bezeichnung erfolgt über die Reihenfolge (dynamische Programmierung, Kürzel hart, Titel weich, Fussnote am Block geht vor
  Registerwissen). Register je Erlass und Sprache aus diesen Zuordnungen (zwei Durchgänge, Widersprüche → `null` → unsicher).
  Bibliotheks-Titel nur mit Gattung + Datum + ersten drei Wörtern danach (Erlasse gleichen Datums, z. B. VZAE und GebV-AIG vom 24. Okt. 2007).
- **EU-Zählung**: FR/IT «23 bis», «42 ter», «9 undecies» = DE «23a», «42b», «9j» (EU nummeriert so); `path` führt die Buchstabenform.
- **Brücke zur Erlassangabe** (Nachtrag 01.32 Uhr): Ein Zitat ohne Erlassangabe gehört zu dem Erlass, in den seine Fortsetzung im
  selben Satzteil mündet, wenn dazwischen nur eine schliessende Klammer (das Zitat steht in Klammern: «Titel III (Art. 4–36) des
  Visakodex»), Gliederungsangaben mit Grossbuchstabe/römischer Zahl/Zahl («Buchstabe C», «section C», «sezione C», «Abschnitt A»,
  «Titel III», «Kapitel 2», «Teil B») oder weitere Unterteilungen («Ziffern 1–6», «ch. 1 à 6») stehen; ein neues Artikel-Stichwort,
  ein Satzende oder anderer Text beenden die Suche. Ist die Erlassangabe nicht bestimmbar, wird das Zitat unsicher, nie intern.
- **Aufzählungen** (Befund des Orchestrators, verfeinert): Ein blosser Artikelverweis in einem Aufzählungspunkt gehört zum eigenen
  Erlass. Ausnahmen: der Einleitungssatz weist die Punkte ausdrücklich zu («nachfolgend genannten Artikel und Absätze des Visakodex:»,
  «articles et paragraphes suivants du …», «seguenti disposizioni della …») → Punkte werden diesem Erlass zugeordnet; der letzte Satz
  des Einleitungssatzes nennt einen anderen Erlass **als Ganzes** (ohne eigene Artikelangabe, z. B. «relatifs au règlement (UE) 2017/2226 …:»)
  → unsicher. Ein vollständiges Zitat im Einleitungssatz («nach Artikel 66a StGB …:») ändert nichts.
- **Unsicher** (immer mit `why`): Rückverweise («dieser Verordnungen», «desdits règlements», «di tali regolamenti»), Gattungswort ohne
  bestimmbaren Erlass («des Abkommens», «de la loi fédérale» ohne Datum), Erlass ohne SR-Fussnote und ohne Register (aufgehobene
  Erlasse wie BG vom 26. März 1931), unbekanntes Kürzel direkt nach dem Zitat, Kürzel mit angehängter Zahl («LAsi40»), EU-Nummer ohne
  Gattung, Unterteilung ohne Artikel bei fremdem Erlass, römischer Anhang ohne EU-Bezug, nicht eindeutige Fussnotenzuordnung,
  Zitat ohne Erlassangabe direkt vor einem Zitat eines anderen Erlasses mit nicht nur Bindewort/Präposition dazwischen.

## Bekannte Grenzen

- Fussnotenposition fehlt im Bundle (Parser legt Fussnoten nur je Block ab). **Kleinste Ergänzung** (nicht umgesetzt, Parser-Sache):
  je Fussnote die Zeichenposition im Klartext des Blocks (`fn[].at`). Damit entfiele die Zuordnung über die Reihenfolge.
- Nennungen ohne Datum und ohne Kürzel («la loi sur l’asile», «valeurs constitutionnelles») werden nicht erkannt → Sprachabweichungen
  bei Nennungen ganzer Erlasse (im Prüfbericht als «Quelle» ausgewiesen).
- Kapitel-/Abschnittsverweise («nach dem 2. Abschnitt») und unnummerierte «Anhang» werden nicht geführt.
- Zitate, die die Quelle auf zwei Blöcke verteilt (VEV Art. 34c DE «[EU] 2019/» | «817 …»), bleiben unsicher.
- Laufzeit AIG je Stand und Sprache: Median ca. 60–80 ms, Maximum ca. 120–210 ms ohne Last (unter starker Last des Rechners bis ca. 700 ms gemessen).
