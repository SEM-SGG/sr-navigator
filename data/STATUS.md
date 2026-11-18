# Status Agent DATEN (SR-Navigator) — Schlussfassung

Stand: 16. November 2026. `data/library.json` (schema 2): order `cc-2007-758` AIG, `cc-2007-759` VZAE, `cc-2018-493` VEV,
`cc-1999-358` AsylG, `cc-2021-734` EESV (EESV auf Entscheid vom 15. November zusätzlich eingebettet). Prüfbericht `data/VALIDATION.md`.

Nachtrag 18. November 2026 (Version 1.3.1): Fedlex hat die Dateien der VZAE-Fassung 20261001 in DE, FR und IT ersetzt
(`…-20261001-<lang>-xml-1.xml` statt `…-xml.xml`). Rohdaten und Metadaten der VZAE sind am 18. November 2026 neu abgerufen
(`fetched` 2026-11-18), die der übrigen Erlasse stammen vom 12. bis 15. November 2026. Geändert hat sich nur der italienische
Wortlaut von Art. 83a Abs. 1 und die Fussnoten zu Art. 83a Abs. 1 und Art. 87 Abs. 1bis Bst. g (IT). `fetch-raw.mjs` lädt
eine vorhandene Datei neu, wenn ihre Adresse bei Fedlex von der in `versions.json` gespeicherten abweicht.

Reproduzieren: `node scripts/fetch-meta.mjs <id …>` (SPARQL-Antworten nach `raw/<id>/fedlex/`, nur bei neuem Abruf),
`node scripts/build-data.mjs` (ca. 15 s), `node scripts/validate.mjs [--no-net]` (ca. 90 s), `node --test test/core/*.test.mjs`
(26 Tests; Netztest mit `SR_NO_NET=1` abschaltbar).

## Signaturen (tatsächlich)

- `parser.js`: `parseFedlex(xmlString, { DOMParser })` -> `{ kind:'fedlex', parser, eli, sr, lang, date, dateDocument, dateEntryInForce, generator, names, units, toc, notes }`
- `model.js`:
  - `buildBundle(input, { DOMParser, langs, onProgress, yield })` ist **async** (Promise). `onProgress({ done, total, label })`.
  - `getVersion(ds, unitId, lang, stageId)`, `blockHistory(ds, unitId, lang, key)`, `changesOfStage(ds, stageId, lang)`,
    `stageAt(ds, isoDate)`, `unitActs(ds, unitId, lang)`, `unitEvents(ds, unitId)` wie SPEC §6.
  - zusätzlich `tocAt(ds, stageId, lang)` -> Gliederung genau dieses Stands (Titel vor ihrer ersten Einheit, `depth`, `parent`),
    `headingAt(ds, tocEntry, lang, stageId)`, `actLabelFromFn(text)`.
- `fedlex.js`: `searchWorks`, `fetchWorkMeta`, `loadWork`, `checkUpdates`, `updateWork` wie SPEC §6; zusätzlich `fetchActsMeta(ids, opts)`,
  `sparqlString`, `normalizeImpacts`, `normalizeVersions`, `normalizePending`. `loadWork` akzeptiert zusätzlich `today` (Datum für `fetched`).
  SPARQL-Texte zuletzt am 15. November 23.08 Uhr geändert (Abfrage `acts` mit `dcterms:identifier`); seither unverändert.

## Bestätigungen (Rückfragen des Orchestrators)

- (a) Massgebend für «geändert» sind `changesOfStage` und `blockHistory`, nicht das Vorhandensein einer Version.
- (b) Eine reine Verschiebung der Fussnotennummer `n` löst keine neue Version aus (Vergleich über den Fussnotentext ohne Nummer;
  Test «Verschobene Fussnotennummer n …» in `test/core/model.test.mjs`).
- (c) Eine Version, die nur Fussnoten ändert, trägt `fnOnly: true`; die betroffenen Blöcke tragen `x: "fn"`. `changesOfStage` und
  `blockHistory` melden sie nicht.
- Werte von Block-`x`:
  - `editorial`: Wortlaut geändert, ohne Änderungshinweis mit Inkrafttreten im Intervall (Vorstand, Stand] und ohne Impact zur Einheit.
    `blockHistory` meldet `change: 'editorial'`.
  - `origin`: Wortlaut gleich, Herkunft `o` neu (neuer Änderungshinweis, z. B. Änderung nur in einer anderen Sprache). `changesOfStage`
    und `blockHistory` melden einen Schritt ohne Wortlautänderung; die Oberfläche darf ihn ausblenden oder als «neu gefasst ohne
    Änderung des Wortlauts in dieser Sprache» zeigen.
  - `fn`: nur Fussnoten geändert (siehe c), kein Schritt.
- Rein typografische Unterschiede (`…`/`...`, `’`/`'`, U+2011/`-`, `n°`/`n<sup>o</sup>`, hochgestellte Ziffern, Leerraum) lösen keine
  Version aus; der Wortlaut stammt dann aus der Fassung der letzten inhaltlichen Änderung. Zahlen je Erlass: VALIDATION.md Kap. 2.
  Hinweis für die Info-Ansicht: `notes[]` mit `code: "typography"` (Text DE/FR/IT).
- Bereichs-Artikel («Art. 111g und 111h», «Art. 105–107»): eigene Einheiten mit Id aus dem eId (`art_111_g_111_h`, `art_105_107`).
  Entsteht ein Bereich, meldet `changesOfStage` `{ key: null, change: 'inserted' }`. Fällt er weg, erhält die Einheit eine Version
  `{ repealed: true, missing: true, blocks: [] }`, ggf. mit `splitInto: [Einzelartikel]` bzw. bei Einzelartikeln `mergedInto: '<Bereich>'`;
  `changesOfStage` meldet `{ key: null, change: 'deleted', mergedInto, splitInto }`; `toc[].to` ist der Stand des Wegfalls.
  AIG: `art_111_g_111_h` endet 20221122 (splitInto `art_111_g`, `art_111_h`), `art_108_109` und `art_126_e_126_f` enden 20250615,
  `art_105`–`art_107` gehen 20250615 in `art_105_107` auf. VEV: `art_46`–`art_53` gehen 20220501 in `art_46_53` auf.

## Abweichungen vom Vertrag und Erweiterungen (alle additiv, Schema 2 unverändert)

1. Herkunft `o`: erste AS-Fundstelle (`href`) des **jüngsten Teils** eines Änderungshinweises. Beispiel SPEC §5 nennt für
   «Fassung gemäss Ziff. I des BG vom 16. Dez. 2016 (Integration) … (AS 2017 6521, 2018 3171)» `oc/2018/509`; laut Fedlex ist
   AS 2018 3171 (`oc/2018/509`) die Inkraftsetzungsverordnung, der genannte Erlass ist AS 2017 6521 (`oc/2017/718`). Verwendet: `oc/2017/718`.
   Geltungsbereich: Hinweis an der Nummer (Artikel, Absatz, Buchstabe) gilt für die ganze Bestimmung samt Unterblöcken; Hinweis am Text
   oder am Titel nur für diesen Text bzw. Titel; Hinweise an Kapitel- oder Abschnittstiteln nur für den Titel. Ohne Hinweis `o = work.base`
   (immer gesetzt). Fussnote am Artikeltitel: `version.o`, `version.ch`.
2. Mehrteilige Hinweise («Eingefügt durch A … Fassung gemäss B …»): `fn.events[]` mit je `action, act, acts, as, inForce, until, label`;
   jeder frühere Teil ergibt einen eigenen Eintrag in `acts[].changes` (Feld `part: true`, Inkrafttreten aus dem Teil, sonst aus einem
   Impact desselben Erlasses auf dieselbe Einheit, sonst leer). Erkannt auch «Bereinigt gemäss», «Mise à jour par», «Aggiornato»,
   «Erratum», «Correzione», Verlängerungen («verlängert», «Validità prorogata»; ändern die Herkunft nicht).
3. `ch`: `inserted | replaced | repealed | amended | term`; Berichtigung, Verlängerung und Teiländerungen («Zweiter Satz eingefügt») -> `amended`.
   Fussnote: `{ n, t, kind: amend|corr|ref|renum|other, action, partial, act, acts, as, inForce, until, label, events }`.
4. Version: zusätzlich `fn` (Fussnoten an Nummer/Titel), `o`, `ch`, `repealed`, `missing`, `mergedInto`, `splitInto`, `fnOnly`.
   Abgelaufene befristete Bestimmungen (Hülle mit «in Kraft vom … bis …») gelten als `repealed`.
5. Schlüssel: wie SPEC; zusätzlich `p3-4`, `p7bis-7ter` (zusammengefasste Absätze), `sh` (Verweiszeile unter dem Titel), `s1…` für Text
   direkt unter der Einheit (Präambel, Anhang), `l2.` vor Punkten einer zweiten Liste unter demselben Elternteil, `~2` bei doppeltem eId
   der Quelle, `+a` bei Kollision im Abgleich mit der Vorfassung. Steht das Gliederungszeichen wegen eines Platzhalters `[tab]` im Text,
   wird der Schlüssel daraus abgeleitet (`dquater`), der Text bleibt unverändert.
6. Gliederung `toc`: Titelverlauf `heading[lang][]` mit zusätzlich `at` (erste Einheit danach), `parent`, `sub`, `fn`, `gone: true` (Titel
   fehlt ab diesem Stand), `same: true` (nur verschoben). Die Reihenfolge von `toc` ist die des jüngsten Stands; frühere Stände über `tocAt`.
   Umnummerierte Gliederungsknoten behalten ihre Id; ein neuer Knoten mit bereits belegter Id erhält `<eId>+2` (AIG 2025: `chap_14_b+2`).
   Nicht zuordenbare Titel einer Sprache: Id `<eId>@<lang>`.
7. Schluss- und Übergangsbestimmungen: Id `disp_uN` nach Reihenfolge, über den Titel an frühere Stände gebunden.
   Anhänge: Id aus der Bezeichnung («Anhang 2» -> `annex_2`), eId als Kontrolle.
8. `stages[]` zusätzlich `generator` je Sprache. Erster Stand: `acts` = Erlasse seit der vorangehenden Fassung ohne XML (Metadaten).
9. `acts[]`: `label` ist eine aus der Fussnote gelesene Kurzbezeichnung mit Datum («BG vom 16. Dez. 2016 (Integration)») oder `null`;
   `title` amtlicher Titel aus Fedlex (nur `<i> <b> <sup> <sub>`), sonst `label`. `changes[]` zusätzlich `part`, `comment` (Impact-Kommentar
   je Sprache), `impactType`, `impactDate` (verworfenes Datum, siehe 10). Aktionen aus Impacts: `amended | repealed | inForce | corrected | extended`.
10. Impact-Daten, die vor dem Inkrafttreten des Erlasses liegen oder dem Dokumentdatum entsprechen (alte Erfassung, z. B. `oc/2006/727`
    2005-12-16), gelten nicht als Inkrafttreten (`inForce: null`, Rohwert in `impactDate`). AIG 6, AsylG 3 Fälle.
11. `pending[]`: `{ id, type, title{}, date (frühestes Start- bzw. geplantes Startdatum), status (preparation|planned|ongoing|closed-pending|
    closed-report|closed|withdrawn), statusLabel{}, url }`, auch abgeschlossene Vernehmlassungen; die Oberfläche filtert.
12. `notes[]`: `before-xml`, `footnote-latest-only`, `typography`, `gap`, sowie je Stand und Sprache zusammengefasst `pseudo-annex`, `dup-key`,
    `lang-mismatch`, `lang-unit`, `unit-missing`, `key-from-text`, `article-head-in-text`, … mit `count`, `examples`, `text.de`.
13. `updateWork` lädt bei neuen oder geänderten Fassungen das ganze Werk neu (die Bibliothek speichert keine Volltexte);
    ohne Änderung nur `pending` aktualisiert.

## Bekannte Auffälligkeiten der Quelle (nicht korrigiert, ausgewiesen)

- VEV DE 20220115, 20220501, 20220610: Art. 34e und 34f stehen in der Fedlex-Datei als Absätze in Art. 34d (doppelte eId `art_34_d/para_1`, `para_2`;
  Kopf «<b>Art. 34</b><i>e</i> Abschluss …» als Text). FR und IT führen Art. 34e und 34f getrennt. Datensatz: DE-Text vollständig in `art_34_d`
  (Schlüssel `p1~2`, `p2~2` …), `notes` `article-head-in-text`, `dup-key`, `lang-unit`; ab 20220622 korrekt.
- AsylG IT 20210101 bis 20230901: Kapitel 8 und Abschnitt 7/3 als Anhang ausgezeichnet (`pseudo-annex`), Artikel dort mit eId-Präfix `annex_3/`.
- AIG IT 20250401: Anhang 2 enthält ein Inhaltsverzeichnis («Indice …»), ab 20250528 entfernt (als `editorial` ausgewiesen).
