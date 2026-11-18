# Fedlex: getestete Abfragen

Getestet am 12. November 2026 mit curl gegen `https://fedlex.data.admin.ch/sparqlendpoint`
(`curl -G <endpunkt> --data-urlencode "query=…" -H "Accept: text/csv"`). Beispiel-Erlass: AIG, SR 142.20, `eli/cc/2007/758`.

Präfix für alle Abfragen:

```sparql
PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
```

## 1 Antwortköpfe

SPARQL-Endpunkt mit Kopf `Origin: null`:

```
HTTP/2 200
access-control-allow-headers: *
access-control-allow-methods: GET, POST
access-control-allow-origin: *
content-type: text/csv;charset=UTF-8
```

Datei aus dem Filestore mit Kopf `Origin: null`:

```
HTTP/2 200
access-control-allow-origin: *
access-control-expose-headers: Content-Disposition
content-type: application/xml
content-length: 683835
```

Folge: Abfrage und Abruf des Volltexts funktionieren aus einer lokal geöffneten HTML-Datei.

## 2 Alle Fassungen eines Erlasses

```sparql
SELECT ?cons ?date WHERE {
  ?cons jolux:isMemberOf <https://fedlex.data.admin.ch/eli/cc/2007/758> ;
        jolux:dateApplicability ?date
} ORDER BY ?date
```

Ergebnis: 54 Fassungen, erste `…/20080101`, dann `…/20081205`, `…/20081212` usw.

## 3 Sprachen, Formate und Datei-URLs einer Fassung

```sparql
SELECT ?expr ?lang ?manif ?fmt ?file WHERE {
  <https://fedlex.data.admin.ch/eli/cc/2007/758/20250401> jolux:isRealizedBy ?expr .
  ?expr jolux:language ?lang ; jolux:isEmbodiedBy ?manif .
  OPTIONAL { ?manif jolux:userFormat ?fmt }
  OPTIONAL { ?manif jolux:isExemplifiedBy ?file }
}
```

Ergebnis (gekürzt): je Sprache DE, FR, IT, EN, RM die Formate `docx`, `html`, `pdf-a`, `xml`. Beispiel einer Datei-URL:

```
https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2007/758/20250401/de/xml/fedlex-data-admin-ch-eli-cc-2007-758-20250401-de-xml-12.xml
```

Die Zahl am Ende des Dateinamens (`-12`) ist eine Versionsnummer der Datei und unterscheidet sich je Sprache und Format.
Die URL immer aus `jolux:isExemplifiedBy` lesen.

Sprach-URIs: `http://publications.europa.eu/resource/authority/language/DEU`, `FRA`, `ITA`, `ENG`, `ROH`.
Format-URIs: `https://fedlex.data.admin.ch/vocabulary/user-format/xml`, `html`, `docx`, `doc`, `pdf-a`.

## 4 Verfügbarkeit der Formate über die Zeit

```sparql
SELECT ?fmt (COUNT(DISTINCT ?cons) AS ?n) (MIN(?date) AS ?min) (MAX(?date) AS ?max) WHERE {
  ?cons jolux:isMemberOf <https://fedlex.data.admin.ch/eli/cc/2007/758> ;
        jolux:dateApplicability ?date ; jolux:isRealizedBy ?expr .
  ?expr jolux:language <http://publications.europa.eu/resource/authority/language/DEU> ;
        jolux:isEmbodiedBy ?m .
  ?m jolux:userFormat ?fmt
} GROUP BY ?fmt
```

| Format | Fassungen | früheste | späteste |
|---|---|---|---|
| pdf-a | 54 | 2008-01-01 | 2027-01-01 |
| xml | 23 | 2020-04-01 | 2027-01-01 |
| html | 23 | 2020-04-01 | 2027-01-01 |
| docx | 23 | 2020-04-01 | 2027-01-01 |
| doc | 5 | 2020-04-01 | 2022-06-01 |

Folge: Strukturierter Text ab 1. April 2020; davor nur PDF. Künftige Fassungen sind bereits vorhanden.
Ob die Grenze 2020 für alle Erlasse gilt, in der neuen Session an weiteren Erlassen prüfen.

## 5 Eigenschaften des Erlasses

`SELECT DISTINCT ?p (SAMPLE(?o) AS ?ex) WHERE { <https://fedlex.data.admin.ch/eli/cc/2007/758> ?p ?o } GROUP BY ?p`

| Eigenschaft | Beispielwert |
|---|---|
| `jolux:historicalLegalId` | 142.20 (SR-Nummer) |
| `jolux:dateDocument` | 2005-12-16 |
| `jolux:dateEntryInForce` | 2008-01-01 |
| `jolux:basicAct` | `eli/oc/2007/758` (AS) |
| `jolux:inForceStatus` | `vocabulary/enforcement-status/0` |
| `jolux:typeDocument` | `vocabulary/resource-type/21` |
| `jolux:classifiedByTaxonomyEntry` | `vocabulary/legal-taxonomy/4851` |
| `jolux:isRealizedBy` | `eli/cc/2007/758/de` (Titel je Sprache an der Expression) |
| `dcterms:identifier` | 20020232 |

Hinweis: `SELECT ?p ?o` ohne `DISTINCT` liefert Tripel mehrfach.

## 6 Eigenschaften einer Fassung

`jolux:dateApplicability` 2025-04-01, `jolux:dateEndApplicability` 2025-05-27, `jolux:isMemberOf`, `jolux:isRealizedBy` (de, fr, it, en, rm),
`jolux:publicationDate` (mehrere), Typ `jolux:Consolidation`.

## 7 Verknüpfungen auf den Erlass

`SELECT ?p (COUNT(?s) AS ?n) (SAMPLE(?s) AS ?ex) WHERE { ?s ?p <https://fedlex.data.admin.ch/eli/cc/2007/758> } GROUP BY ?p`

| Eigenschaft | Anzahl | Beispiel |
|---|---|---|
| `jolux:isMemberOf` | 54 | `eli/cc/2007/758/20190301` |
| `jolux:legalResourceSubdivisionIsPartOf` | 172 | `eli/cc/2007/758/art_110bbis` |
| `jolux:foreseenImpactToLegalResource` | 49 | `eli/dl/proj/2026/99/cons_1` |
| `jolux:publicationProcessForConsolidationAbstract` | 36 | `eli/pudocc/cc/2007/758/20240601/2` |

## 8 Änderungen je Artikel

```sparql
SELECT ?imp ?p ?o WHERE {
  ?imp jolux:impactToLegalResource <https://fedlex.data.admin.ch/eli/cc/2007/758/art_5> ; ?p ?o
}
```

Ergebnis: vier Objekte vom Typ `jolux:LegalResourceImpact`, z. B. `eli/oc/2025/346/legal-analysis/LegalResourceImpact/5` mit

- `jolux:impactFromLegalResource` → `eli/oc/2025/346/annex_` (ändernder Erlass in der AS, hier dessen Anhang)
- `jolux:impactConsolidatedBy` → `eli/cc/2007/758/art_5/20250615` (Artikel-Fassung)
- `jolux:impactConsolidatedByExpression` → `…/art_5/20250615/de`, `/fr`, `/it`, `/en`
- `jolux:historicalImpact` → 0 oder 1

Weitere Eigenschaften (Art der Änderung, Datum) in der neuen Session abfragen. Für Artikel 5 liegen nur Einträge ab 2025 vor:
prüfen, wie weit diese Metadaten zurückreichen. Für die Zeit davor sind die Fussnoten im Text die Quelle.

## 9 Hängige Vorhaben

`?s jolux:foreseenImpactToLegalResource <…/eli/cc/2007/758>` liefert Objekte vom Typ `jolux:Consultation`, `jolux:Event`,
`jolux:LegislativeTask`, z. B. `eli/dl/proj/2026/99/cons_1`, `eli/dl/proj/2021/29/cons_1`.

## 10 Suche nach SR-Nummer

```sparql
SELECT ?expr WHERE { ?expr jolux:historicalLegalId "142.20" }
```

Getestet. Ergebnis: Sprachfassungen (Typ `jolux:Expression`) von ZWEI Erlassen: `eli/cc/2007/758/de|fr|it|en|rm` (AIG) und
`eli/cc/49/279_279_293/de|…` (der Vorgängererlass mit derselben SR-Nummer). Die SR-Nummer ist also nicht eindeutig:
über `jolux:inForceStatus` bzw. `jolux:dateEntryInForce` des Erlasses den geltenden wählen und aufgehobene als solche anzeigen.
Die SR-Nummer hängt am Erlass und an dessen Sprachfassungen.

Titel stehen an der Sprachfassung des Erlasses (`eli/cc/2007/758/de`):

| Eigenschaft | Wert |
|---|---|
| `jolux:title` | Bundesgesetz vom 16. Dezember 2005 über die Ausländerinnen und Ausländer und über die Integration (Ausländer- und Integrationsgesetz, AIG) |
| `jolux:titleShort` | AIG |
| `jolux:titleAlternative` | Ausländer- und Integrationsgesetz |
| `jolux:historicalLegalId` | 142.20 |

Eine ungezielte Suche nach dem Literal «142.20» über alle Eigenschaften liefert zusätzlich Zitate
(`jolux:citationToRs` an Ressourcen wie `eli/cc/1982/2184_2184_2184/20200926/citation/8213`).
Für die Titelsuche (Teilwort) eine Abfrage mit `FILTER(CONTAINS(LCASE(?title), …))` auf Laufzeit prüfen.

## 11 Aufbau der XML-Datei

Siehe `beispiel_AIG_142.20_20250401_de.xml`. Häufigkeit der Elemente in dieser Datei:
`p` 1540, `num` 1353, `b` 1271, `ref` 1096, `content` 636, `paragraph` 633, `authorialNote` 508, `item` 507, `i` 277, `heading` 245,
`article` 213, `blockList` 129, `listIntroduction` 129, `span` 91, `sup` 64, `inline` 32, `section` 22, `chapter` 21.

Ausschnitt:

```xml
<article eId="art_2"><num><b>Art. 2</b></num><heading>Geltungsbereich</heading>
  <paragraph eId="art_2/para_1"><num>1</num><content><p> Dieses Gesetz gilt für …</p></content></paragraph>
```

Änderungshinweis als Fussnote:

```xml
<authorialNote><p> Fassung gemäss Ziff. I des BG vom 16. Dez. 2016 (Integration), in Kraft seit 1. Jan. 2019
 (<ref href="https://fedlex.data.admin.ch/eli/oc/2017/718">AS <b>2017</b> 6521</ref>,
  <ref href="https://fedlex.data.admin.ch/eli/oc/2018/509"><b>2018</b> 3171</ref>;
  <ref href="https://fedlex.data.admin.ch/eli/fga/2013/416">BBl <b>2013</b> 2397</ref>, …).</p></authorialNote>
```

Die HTML-Fassung trägt die SR-Nummer in `p.srnummer`, den Titel in `h1.erlasstitel`, den Stand in `p.erlassdatum`
(«vom 16. Dezember 2005 (Stand am 1. April 2025)») und Fussnoten als `div.footnotes`.
