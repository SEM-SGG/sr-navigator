# Prüfbericht Datensatz SR-Navigator (Agent DATEN)

Erzeugt von `node scripts/validate.mjs` am 2026-11-23 aus `data/library.json` (generiert 2026-11-23) und den Quelldateien in `raw/`. Alle Zahlen stammen aus maschinellen Prüfungen, die bei jedem Lauf neu ausgeführt werden.

## 1 Übersicht

| Erlass | SR | Stände (XML) | Fassungen | Einheiten | Wortlaut min. | Wörter fehlend / zusätzlich | Fussnoten fehlend / zusätzlich | Änderungen gedeckt | redaktionell | Impacts gefunden / erklärt / offen | Sprachgleich | Schlüssel stabil | Markup-Fehler | loadWork = Build |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AIG | 142.20 | 23 | 54 | 269 | 100,00 % | 0 / 0 | 0 / 0 | 3079 von 3252 | 73 | 253 / 4 / 0 von 257 | 5091 von 5116 | 3383 von 3383 | 0 von 26425 | ja |
| VZAE | 142.201 | 16 | 54 | 157 | 100,00 % | 0 / 0 | 0 / 0 | 939 von 949 | 10 | 49 / 0 / 0 von 49 | 2473 von 2489 | 1531 von 1531 | 0 von 12417 | ja |
| VEV | 142.204 | 25 | 33 | 99 | 100,00 % | 0 / 0 | 0 / 0 | 996 von 1077 | 51 | 105 / 0 / 0 von 105 | 1977 von 2025 | 2290 von 2293 | 0 von 12501 | ja |
| AsylG | 142.31 | 12 | 40 | 225 | 100,00 % | 0 / 0 | 0 / 0 | 1137 von 1188 | 9 | 91 / 2 / 0 von 93 | 2554 von 2576 | 3292 von 3292 | 0 von 21083 | ja |
| EESV | 142.206 | 6 | 6 | 27 | 100,00 % | 0 / 0 | 0 / 0 | 166 von 166 | 0 | 12 / 0 / 0 von 12 | 158 von 162 | 218 von 218 | 0 von 1907 | ja |

Lesehilfe: «Änderungen gedeckt» zählt jede zwischen zwei Ständen als geändert ausgewiesene Bestimmung (Block, Titel, Einheit) je Sprache, die durch einen Änderungshinweis mit Inkrafttreten im Intervall (Vorstand, Stand], einen Impact-Eintrag zur Einheit im selben Intervall oder einen neuen Änderungshinweis bei gleichem Wortlaut (`x: "origin"`) gedeckt ist. «redaktionell» sind Textänderungen ohne solchen Beleg (Liste in Kapitel 3). Die übrigen sind strukturelle Änderungen (gelöschte Blöcke, Gliederungswechsel), einzeln in Kapitel 3.

## 2 Wortlauttreue (Prüfung 1)

Methode: Für jeden Stand und jede Sprache wird der Quelltext unabhängig vom Parser direkt aus dem XML gelesen (reguläre Ausdrücke in `scripts/lib/wordcheck.mjs`: `<meta>`, das Titelblatt `<preface>` des Erlasses und alle `<authorialNote>` entfernt, Inline-Tags ohne Leerzeichen, übrige Tags als Leerzeichen). Daneben wird aus `data/library.json` die Folge aller Gliederungstitel, Einheitenbezeichnungen, Titel, Gliederungszeichen und Blocktexte des Stands (über `getVersion`, also mit übernommenen unveränderten Blöcken) gebildet. Beide Folgen werden nach typografischer Normalisierung (Anführungszeichen, Gedankenstriche, Auslassungspunkte, geschützte Leerzeichen) in Wörter und Satzzeichen zerlegt und mit einem Diff (Myers) verglichen. Abdeckung = gemeinsame Wörter / Wörter der Quelle. Fussnoten werden getrennt als Textmenge (ohne Nummer) verglichen.

### AIG (SR 142.20)

| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |
|---|---|---|---|---|---|---|---|---|
| 20200401 | de | 27659 | 100,00 % | 0 | 0 | 428 | 0 | 0 |
| 20200401 | fr | 38001 | 100,00 % | 0 | 0 | 435 | 0 | 0 |
| 20200401 | it | 33258 | 100,00 % | 0 | 0 | 431 | 0 | 0 |
| 20210701 | de | 27768 | 100,00 % | 0 | 0 | 429 | 0 | 0 |
| 20210701 | fr | 38133 | 100,00 % | 0 | 0 | 436 | 0 | 0 |
| 20210701 | it | 33381 | 100,00 % | 0 | 0 | 432 | 0 | 0 |
| 20211002 | de | 28019 | 100,00 % | 0 | 0 | 431 | 0 | 0 |
| 20211002 | fr | 38441 | 100,00 % | 0 | 0 | 438 | 0 | 0 |
| 20211002 | it | 33655 | 100,00 % | 0 | 0 | 434 | 0 | 0 |
| 20220501 | de | 28897 | 100,00 % | 0 | 0 | 439 | 0 | 0 |
| 20220501 | fr | 39587 | 100,00 % | 0 | 0 | 446 | 0 | 0 |
| 20220501 | it | 34678 | 100,00 % | 0 | 0 | 442 | 0 | 0 |
| 20220601 | de | 29142 | 100,00 % | 0 | 0 | 451 | 0 | 0 |
| 20220601 | fr | 39918 | 100,00 % | 0 | 0 | 458 | 0 | 0 |
| 20220601 | it | 34947 | 100,00 % | 0 | 0 | 455 | 0 | 0 |
| 20220901 | de | 29337 | 100,00 % | 0 | 0 | 460 | 0 | 0 |
| 20220901 | fr | 40184 | 100,00 % | 0 | 0 | 468 | 0 | 0 |
| 20220901 | it | 35175 | 100,00 % | 0 | 0 | 464 | 0 | 0 |
| 20221122 | de | 30342 | 100,00 % | 0 | 0 | 479 | 0 | 0 |
| 20221122 | fr | 41519 | 100,00 % | 0 | 0 | 488 | 0 | 0 |
| 20221122 | it | 36346 | 100,00 % | 0 | 0 | 486 | 0 | 0 |
| 20221217 | de | 30342 | 100,00 % | 0 | 0 | 479 | 0 | 0 |
| 20221217 | fr | 41519 | 100,00 % | 0 | 0 | 488 | 0 | 0 |
| 20221217 | it | 36346 | 100,00 % | 0 | 0 | 486 | 0 | 0 |
| 20230401 | de | 30397 | 100,00 % | 0 | 0 | 487 | 0 | 0 |
| 20230401 | fr | 41601 | 100,00 % | 0 | 0 | 496 | 0 | 0 |
| 20230401 | it | 36413 | 100,00 % | 0 | 0 | 494 | 0 | 0 |
| 20230701 | de | 30359 | 100,00 % | 0 | 0 | 492 | 0 | 0 |
| 20230701 | fr | 41551 | 100,00 % | 0 | 0 | 499 | 0 | 0 |
| 20230701 | it | 36368 | 100,00 % | 0 | 0 | 499 | 0 | 0 |
| 20230901 | de | 30310 | 100,00 % | 0 | 0 | 498 | 0 | 0 |
| 20230901 | fr | 41494 | 100,00 % | 0 | 0 | 505 | 0 | 0 |
| 20230901 | it | 36297 | 100,00 % | 0 | 0 | 505 | 0 | 0 |
| 20231015 | de | 29973 | 100,00 % | 0 | 0 | 493 | 0 | 0 |
| 20231015 | fr | 41032 | 100,00 % | 0 | 0 | 499 | 0 | 0 |
| 20231015 | it | 35885 | 100,00 % | 0 | 0 | 499 | 0 | 0 |
| 20240601 | de | 30269 | 100,00 % | 0 | 0 | 502 | 0 | 0 |
| 20240601 | fr | 41425 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20240601 | it | 36278 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20240701 | de | 30018 | 100,00 % | 0 | 0 | 500 | 0 | 0 |
| 20240701 | fr | 41117 | 100,00 % | 0 | 0 | 505 | 0 | 0 |
| 20240701 | it | 36004 | 100,00 % | 0 | 0 | 505 | 0 | 0 |
| 20250101 | de | 30224 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20250101 | fr | 41439 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250101 | it | 36271 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250401 | de | 30227 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20250401 | fr | 41443 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250401 | it | 36691 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250528 | de | 30204 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20250528 | fr | 41443 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250528 | it | 36275 | 100,00 % | 0 | 0 | 512 | 0 | 0 |
| 20250615 | de | 35033 | 100,00 % | 0 | 0 | 627 | 0 | 0 |
| 20250615 | fr | 47585 | 100,00 % | 0 | 0 | 636 | 0 | 0 |
| 20250615 | it | 41791 | 100,00 % | 0 | 0 | 635 | 0 | 0 |
| 20250801 | de | 35278 | 100,00 % | 0 | 0 | 634 | 0 | 0 |
| 20250801 | fr | 47861 | 100,00 % | 0 | 0 | 643 | 0 | 0 |
| 20250801 | it | 42055 | 100,00 % | 0 | 0 | 642 | 0 | 0 |
| 20260201 | de | 35294 | 100,00 % | 0 | 0 | 638 | 0 | 0 |
| 20260201 | fr | 47891 | 100,00 % | 0 | 0 | 647 | 0 | 0 |
| 20260201 | it | 42078 | 100,00 % | 0 | 0 | 646 | 0 | 0 |
| 20260612 | de | 38692 | 100,00 % | 0 | 0 | 713 | 0 | 0 |
| 20260612 | fr | 52392 | 100,00 % | 0 | 0 | 725 | 0 | 0 |
| 20260612 | it | 45978 | 100,00 % | 0 | 0 | 725 | 0 | 0 |
| 20261101 | de | 38731 | 100,00 % | 0 | 0 | 715 | 0 | 0 |
| 20261101 | fr | 52447 | 100,00 % | 0 | 0 | 727 | 0 | 0 |
| 20261101 | it | 46023 | 100,00 % | 0 | 0 | 727 | 0 | 0 |
| 20270101 | de | 38752 | 100,00 % | 0 | 0 | 720 | 0 | 0 |
| 20270101 | fr | 52468 | 100,00 % | 0 | 0 | 732 | 0 | 0 |
| 20270101 | it | 46132 | 100,00 % | 0 | 0 | 731 | 0 | 0 |

### VZAE (SR 142.201)

| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |
|---|---|---|---|---|---|---|---|---|
| 20210101 | de | 19530 | 100,00 % | 0 | 0 | 251 | 0 | 0 |
| 20210101 | fr | 26026 | 100,00 % | 0 | 0 | 262 | 0 | 0 |
| 20210101 | it | 23104 | 100,00 % | 0 | 0 | 261 | 0 | 0 |
| 20220101 | de | 19530 | 100,00 % | 0 | 0 | 251 | 0 | 0 |
| 20220101 | fr | 26026 | 100,00 % | 0 | 0 | 262 | 0 | 0 |
| 20220101 | it | 23101 | 100,00 % | 0 | 0 | 261 | 0 | 0 |
| 20220312 | de | 19569 | 100,00 % | 0 | 0 | 252 | 0 | 0 |
| 20220312 | fr | 26085 | 100,00 % | 0 | 0 | 263 | 0 | 0 |
| 20220312 | it | 23154 | 100,00 % | 0 | 0 | 262 | 0 | 0 |
| 20221122 | de | 19766 | 100,00 % | 0 | 0 | 257 | 0 | 0 |
| 20221122 | fr | 26372 | 100,00 % | 0 | 0 | 268 | 0 | 0 |
| 20221122 | it | 23374 | 100,00 % | 0 | 0 | 267 | 0 | 0 |
| 20230101 | de | 19766 | 100,00 % | 0 | 0 | 257 | 0 | 0 |
| 20230101 | fr | 26372 | 100,00 % | 0 | 0 | 268 | 0 | 0 |
| 20230101 | it | 23379 | 100,00 % | 0 | 0 | 267 | 0 | 0 |
| 20230123 | de | 19769 | 100,00 % | 0 | 0 | 258 | 0 | 0 |
| 20230123 | fr | 26375 | 100,00 % | 0 | 0 | 270 | 0 | 0 |
| 20230123 | it | 23382 | 100,00 % | 0 | 0 | 268 | 0 | 0 |
| 20230201 | de | 19778 | 100,00 % | 0 | 0 | 259 | 0 | 0 |
| 20230201 | fr | 26384 | 100,00 % | 0 | 0 | 271 | 0 | 0 |
| 20230201 | it | 23396 | 100,00 % | 0 | 0 | 269 | 0 | 0 |
| 20230901 | de | 19609 | 100,00 % | 0 | 0 | 260 | 0 | 0 |
| 20230901 | fr | 26203 | 100,00 % | 0 | 0 | 272 | 0 | 0 |
| 20230901 | it | 23221 | 100,00 % | 0 | 0 | 270 | 0 | 0 |
| 20240101 | de | 19609 | 100,00 % | 0 | 0 | 260 | 0 | 0 |
| 20240101 | fr | 26203 | 100,00 % | 0 | 0 | 272 | 0 | 0 |
| 20240101 | it | 23221 | 100,00 % | 0 | 0 | 270 | 0 | 0 |
| 20240601 | de | 19922 | 100,00 % | 0 | 0 | 278 | 0 | 0 |
| 20240601 | fr | 26660 | 100,00 % | 0 | 0 | 290 | 0 | 0 |
| 20240601 | it | 23606 | 100,00 % | 0 | 0 | 288 | 0 | 0 |
| 20250101 | de | 19803 | 100,00 % | 0 | 0 | 274 | 0 | 0 |
| 20250101 | fr | 26467 | 100,00 % | 0 | 0 | 286 | 0 | 0 |
| 20250101 | it | 23455 | 100,00 % | 0 | 0 | 284 | 0 | 0 |
| 20251201 | de | 19780 | 100,00 % | 0 | 0 | 273 | 0 | 0 |
| 20251201 | fr | 26447 | 100,00 % | 0 | 0 | 285 | 0 | 0 |
| 20251201 | it | 23434 | 100,00 % | 0 | 0 | 283 | 0 | 0 |
| 20260101 | de | 19780 | 100,00 % | 0 | 0 | 275 | 0 | 0 |
| 20260101 | fr | 26445 | 100,00 % | 0 | 0 | 287 | 0 | 0 |
| 20260101 | it | 23434 | 100,00 % | 0 | 0 | 285 | 0 | 0 |
| 20260422 | de | 19780 | 100,00 % | 0 | 0 | 276 | 0 | 0 |
| 20260422 | fr | 26445 | 100,00 % | 0 | 0 | 288 | 0 | 0 |
| 20260422 | it | 23435 | 100,00 % | 0 | 0 | 286 | 0 | 0 |
| 20260612 | de | 19988 | 100,00 % | 0 | 0 | 280 | 0 | 0 |
| 20260612 | fr | 26752 | 100,00 % | 0 | 0 | 292 | 0 | 0 |
| 20260612 | it | 23694 | 100,00 % | 0 | 0 | 291 | 0 | 0 |
| 20261001 | de | 20014 | 100,00 % | 0 | 0 | 281 | 0 | 0 |
| 20261001 | fr | 26796 | 100,00 % | 0 | 0 | 293 | 0 | 0 |
| 20261001 | it | 23727 | 100,00 % | 0 | 0 | 291 | 0 | 0 |

### VEV (SR 142.204)

| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |
|---|---|---|---|---|---|---|---|---|
| 20210101 | de | 10941 | 100,00 % | 0 | 0 | 103 | 0 | 0 |
| 20210101 | fr | 14366 | 100,00 % | 0 | 0 | 103 | 0 | 0 |
| 20210101 | it | 12753 | 100,00 % | 0 | 0 | 104 | 0 | 0 |
| 20210915 | de | 11332 | 100,00 % | 0 | 0 | 114 | 0 | 0 |
| 20210915 | fr | 14845 | 100,00 % | 0 | 0 | 114 | 0 | 0 |
| 20210915 | it | 13191 | 100,00 % | 0 | 0 | 114 | 0 | 0 |
| 20220101 | de | 11336 | 100,00 % | 0 | 0 | 116 | 0 | 0 |
| 20220101 | fr | 14853 | 100,00 % | 0 | 0 | 116 | 0 | 0 |
| 20220101 | it | 13197 | 100,00 % | 0 | 0 | 116 | 0 | 0 |
| 20220115 | de | 12361 | 100,00 % | 0 | 0 | 132 | 0 | 0 |
| 20220115 | fr | 16090 | 100,00 % | 0 | 0 | 132 | 0 | 0 |
| 20220115 | it | 14314 | 100,00 % | 0 | 0 | 132 | 0 | 0 |
| 20220501 | de | 11707 | 100,00 % | 0 | 0 | 137 | 0 | 0 |
| 20220501 | fr | 15132 | 100,00 % | 0 | 0 | 136 | 0 | 0 |
| 20220501 | it | 13467 | 100,00 % | 0 | 0 | 137 | 0 | 0 |
| 20220610 | de | 11835 | 100,00 % | 0 | 0 | 138 | 0 | 0 |
| 20220610 | fr | 15278 | 100,00 % | 0 | 0 | 137 | 0 | 0 |
| 20220610 | it | 13615 | 100,00 % | 0 | 0 | 137 | 0 | 0 |
| 20220622 | de | 11836 | 100,00 % | 0 | 0 | 139 | 0 | 0 |
| 20220622 | fr | 15279 | 100,00 % | 0 | 0 | 138 | 0 | 0 |
| 20220622 | it | 13616 | 100,00 % | 0 | 0 | 138 | 0 | 0 |
| 20230204 | de | 11837 | 100,00 % | 0 | 0 | 139 | 0 | 0 |
| 20230204 | fr | 15280 | 100,00 % | 0 | 0 | 138 | 0 | 0 |
| 20230204 | it | 13617 | 100,00 % | 0 | 0 | 138 | 0 | 0 |
| 20231015 | de | 11966 | 100,00 % | 0 | 0 | 149 | 0 | 0 |
| 20231015 | fr | 15422 | 100,00 % | 0 | 0 | 147 | 0 | 0 |
| 20231015 | it | 13748 | 100,00 % | 0 | 0 | 148 | 0 | 0 |
| 20240101 | de | 11962 | 100,00 % | 0 | 0 | 149 | 0 | 0 |
| 20240101 | fr | 15420 | 100,00 % | 0 | 0 | 147 | 0 | 0 |
| 20240101 | it | 13749 | 100,00 % | 0 | 0 | 148 | 0 | 0 |
| 20240201 | de | 11979 | 100,00 % | 0 | 0 | 154 | 0 | 0 |
| 20240201 | fr | 15433 | 100,00 % | 0 | 0 | 152 | 0 | 0 |
| 20240201 | it | 13772 | 100,00 % | 0 | 0 | 153 | 0 | 0 |
| 20240301 | de | 12161 | 100,00 % | 0 | 0 | 155 | 0 | 0 |
| 20240301 | fr | 15677 | 100,00 % | 0 | 0 | 153 | 0 | 0 |
| 20240301 | it | 13999 | 100,00 % | 0 | 0 | 154 | 0 | 0 |
| 20240515 | de | 12432 | 100,00 % | 0 | 0 | 166 | 0 | 0 |
| 20240515 | fr | 16015 | 100,00 % | 0 | 0 | 164 | 0 | 0 |
| 20240515 | it | 14302 | 100,00 % | 0 | 0 | 165 | 0 | 0 |
| 20240611 | de | 12432 | 100,00 % | 0 | 0 | 166 | 0 | 0 |
| 20240611 | fr | 16015 | 100,00 % | 0 | 0 | 164 | 0 | 0 |
| 20240611 | it | 14302 | 100,00 % | 0 | 0 | 165 | 0 | 0 |
| 20240801 | de | 12725 | 100,00 % | 0 | 0 | 174 | 0 | 0 |
| 20240801 | fr | 16362 | 100,00 % | 0 | 0 | 172 | 0 | 0 |
| 20240801 | it | 14613 | 100,00 % | 0 | 0 | 173 | 0 | 0 |
| 20240823 | de | 12795 | 100,00 % | 0 | 0 | 177 | 0 | 0 |
| 20240823 | fr | 16452 | 100,00 % | 0 | 0 | 175 | 0 | 0 |
| 20240823 | it | 14684 | 100,00 % | 0 | 0 | 176 | 0 | 0 |
| 20241013 | de | 12795 | 100,00 % | 0 | 0 | 177 | 0 | 0 |
| 20241013 | fr | 16452 | 100,00 % | 0 | 0 | 175 | 0 | 0 |
| 20241013 | it | 14684 | 100,00 % | 0 | 0 | 176 | 0 | 0 |
| 20250204 | de | 12746 | 100,00 % | 0 | 0 | 177 | 0 | 0 |
| 20250204 | fr | 16396 | 100,00 % | 0 | 0 | 175 | 0 | 0 |
| 20250204 | it | 14633 | 100,00 % | 0 | 0 | 176 | 0 | 0 |
| 20250401 | de | 12916 | 100,00 % | 0 | 0 | 182 | 0 | 0 |
| 20250401 | fr | 16592 | 100,00 % | 0 | 0 | 180 | 0 | 0 |
| 20250401 | it | 14815 | 100,00 % | 0 | 0 | 181 | 0 | 0 |
| 20250801 | de | 13380 | 100,00 % | 0 | 0 | 187 | 0 | 0 |
| 20250801 | fr | 17145 | 100,00 % | 0 | 0 | 185 | 0 | 0 |
| 20250801 | it | 15315 | 100,00 % | 0 | 0 | 186 | 0 | 0 |
| 20251217 | de | 13380 | 100,00 % | 0 | 0 | 187 | 0 | 0 |
| 20251217 | fr | 17145 | 100,00 % | 0 | 0 | 185 | 0 | 0 |
| 20251217 | it | 15315 | 100,00 % | 0 | 0 | 186 | 0 | 0 |
| 20260201 | de | 13381 | 100,00 % | 0 | 0 | 188 | 0 | 0 |
| 20260201 | fr | 17147 | 100,00 % | 0 | 0 | 186 | 0 | 0 |
| 20260201 | it | 15317 | 100,00 % | 0 | 0 | 187 | 0 | 0 |
| 20260408 | de | 13416 | 100,00 % | 0 | 0 | 188 | 0 | 0 |
| 20260408 | fr | 17192 | 100,00 % | 0 | 0 | 186 | 0 | 0 |
| 20260408 | it | 15353 | 100,00 % | 0 | 0 | 187 | 0 | 0 |
| 20260612 | de | 14677 | 100,00 % | 0 | 0 | 214 | 0 | 0 |
| 20260612 | fr | 18686 | 100,00 % | 0 | 0 | 210 | 0 | 0 |
| 20260612 | it | 16673 | 100,00 % | 0 | 0 | 209 | 0 | 0 |
| 20261001 | de | 14732 | 100,00 % | 0 | 0 | 222 | 0 | 0 |
| 20261001 | fr | 18755 | 100,00 % | 0 | 0 | 218 | 0 | 0 |
| 20261001 | it | 16735 | 100,00 % | 0 | 0 | 217 | 0 | 0 |

### AsylG (SR 142.31)

| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |
|---|---|---|---|---|---|---|---|---|
| 20210101 | de | 20541 | 100,00 % | 0 | 0 | 406 | 0 | 0 |
| 20210101 | fr | 29067 | 100,00 % | 0 | 0 | 406 | 0 | 0 |
| 20210101 | it | 25276 | 100,00 % | 0 | 0 | 406 | 0 | 0 |
| 20220601 | de | 20624 | 100,00 % | 0 | 0 | 416 | 0 | 0 |
| 20220601 | fr | 29194 | 100,00 % | 0 | 0 | 416 | 0 | 0 |
| 20220601 | it | 25344 | 100,00 % | 0 | 0 | 416 | 0 | 0 |
| 20220901 | de | 20772 | 100,00 % | 0 | 0 | 424 | 0 | 0 |
| 20220901 | fr | 29400 | 100,00 % | 0 | 0 | 426 | 0 | 0 |
| 20220901 | it | 25518 | 100,00 % | 0 | 0 | 424 | 0 | 0 |
| 20221122 | de | 20999 | 100,00 % | 0 | 0 | 427 | 0 | 0 |
| 20221122 | fr | 29696 | 100,00 % | 0 | 0 | 429 | 0 | 0 |
| 20221122 | it | 25813 | 100,00 % | 0 | 0 | 427 | 0 | 0 |
| 20230901 | de | 20975 | 100,00 % | 0 | 0 | 438 | 0 | 0 |
| 20230901 | fr | 29641 | 100,00 % | 0 | 0 | 440 | 0 | 0 |
| 20230901 | it | 25762 | 100,00 % | 0 | 0 | 438 | 0 | 0 |
| 20240101 | de | 20852 | 100,00 % | 0 | 0 | 438 | 0 | 0 |
| 20240101 | fr | 29419 | 100,00 % | 0 | 0 | 440 | 0 | 0 |
| 20240101 | it | 25596 | 100,00 % | 0 | 0 | 438 | 0 | 0 |
| 20240601 | de | 20868 | 100,00 % | 0 | 0 | 439 | 0 | 0 |
| 20240601 | fr | 29437 | 100,00 % | 0 | 0 | 441 | 0 | 0 |
| 20240601 | it | 25627 | 100,00 % | 0 | 0 | 439 | 0 | 0 |
| 20250101 | de | 20927 | 100,00 % | 0 | 0 | 443 | 0 | 0 |
| 20250101 | fr | 29472 | 100,00 % | 0 | 0 | 445 | 0 | 0 |
| 20250101 | it | 25688 | 100,00 % | 0 | 0 | 441 | 0 | 0 |
| 20250401 | de | 21480 | 100,00 % | 0 | 0 | 450 | 0 | 0 |
| 20250401 | fr | 30222 | 100,00 % | 0 | 0 | 452 | 0 | 0 |
| 20250401 | it | 26382 | 100,00 % | 0 | 0 | 448 | 0 | 0 |
| 20260601 | de | 23052 | 100,00 % | 0 | 0 | 461 | 0 | 0 |
| 20260601 | fr | 32305 | 100,00 % | 0 | 0 | 463 | 0 | 0 |
| 20260601 | it | 28294 | 100,00 % | 0 | 0 | 459 | 0 | 0 |
| 20260612 | de | 25543 | 100,00 % | 0 | 0 | 502 | 0 | 0 |
| 20260612 | fr | 35635 | 100,00 % | 0 | 0 | 504 | 0 | 0 |
| 20260612 | it | 31257 | 100,00 % | 0 | 0 | 499 | 0 | 0 |
| 20270101 | de | 25716 | 100,00 % | 0 | 0 | 507 | 0 | 0 |
| 20270101 | fr | 35893 | 100,00 % | 0 | 0 | 509 | 0 | 0 |
| 20270101 | it | 31483 | 100,00 % | 0 | 0 | 504 | 0 | 0 |

### EESV (SR 142.206)

| Stand | Sprache | Wörter Quelle | Abdeckung | fehlend | zusätzlich | Fussnoten Quelle | Fussnoten fehlend | Fussnoten zusätzlich |
|---|---|---|---|---|---|---|---|---|
| 20220501 | de | 3787 | 100,00 % | 0 | 0 | 22 | 0 | 0 |
| 20220501 | fr | 4929 | 100,00 % | 0 | 0 | 22 | 0 | 0 |
| 20220501 | it | 4415 | 100,00 % | 0 | 0 | 22 | 0 | 0 |
| 20230901 | de | 3779 | 100,00 % | 0 | 0 | 24 | 0 | 0 |
| 20230901 | fr | 4924 | 100,00 % | 0 | 0 | 24 | 0 | 0 |
| 20230901 | it | 4411 | 100,00 % | 0 | 0 | 24 | 0 | 0 |
| 20230913 | de | 3779 | 100,00 % | 0 | 0 | 25 | 0 | 0 |
| 20230913 | fr | 4924 | 100,00 % | 0 | 0 | 25 | 0 | 0 |
| 20230913 | it | 4420 | 100,00 % | 0 | 0 | 26 | 0 | 0 |
| 20240101 | de | 3779 | 100,00 % | 0 | 0 | 26 | 0 | 0 |
| 20240101 | fr | 4928 | 100,00 % | 0 | 0 | 26 | 0 | 0 |
| 20240101 | it | 4421 | 100,00 % | 0 | 0 | 26 | 0 | 0 |
| 20260612 | de | 3828 | 100,00 % | 0 | 0 | 28 | 0 | 0 |
| 20260612 | fr | 4986 | 100,00 % | 0 | 0 | 28 | 0 | 0 |
| 20260612 | it | 4475 | 100,00 % | 0 | 0 | 27 | 0 | 0 |
| 20261001 | de | 3858 | 100,00 % | 0 | 0 | 34 | 0 | 0 |
| 20261001 | fr | 5031 | 100,00 % | 0 | 0 | 34 | 0 | 0 |
| 20261001 | it | 4518 | 100,00 % | 0 | 0 | 33 | 0 | 0 |

### Typografische Abweichungen (vertragsgemäss)

Rein typografische Unterschiede lösen keine neue Version aus (SPEC §5.1). Der Datensatz zeigt dann die Schreibweise der Fassung der letzten inhaltlichen Änderung; die Info-Ansicht erhält dazu den Hinweis `notes[].code = "typography"`. Gezählt: Abweichungen zwischen Quelle und Datensatz ohne jede Normalisierung (nur Unicode-NFC), in Stand-Sprache-Dateien mit 100 % Abdeckung nach Normalisierung.

| Erlass | Dateien mit typografischer Abweichung | Abweichungen (Wortfolgen) | häufigste Muster (Quelle → Datensatz, Anzahl) |
|---|---|---|---|
| AIG | 51 von 69 | 718 | «…» → «...» 697; «3» → «³» 12; «‑» → «-» 9 |
| VZAE | 27 von 48 | 87 | «…» → «...» 77; «’» → «'» 10 |
| VEV | 40 von 75 | 75 | «…» → «...» 75 |
| AsylG | 16 von 36 | 299 | «…» → «...» 297; «‑» → «-» 2 |
| EESV | 0 von 18 | 0 |  |

## 3 Keine Scheinänderungen (Prüfung 2)

| Erlass | durch Fussnote | durch Impact | nur Herkunft (gleicher Wortlaut) | redaktionell | strukturell |
|---|---|---|---|---|---|
| AIG | 2297 | 699 | 83 | 73 | 100 |
| VZAE | 611 | 57 | 271 | 10 | 0 |
| VEV | 576 | 285 | 135 | 51 | 30 |
| AsylG | 993 | 120 | 24 | 9 | 42 |
| EESV | 79 | 10 | 77 | 0 | 0 |

### AIG: redaktionelle Änderungen (Block `x: "editorial"`)

- 67: Textänderung ohne Änderungshinweis mit passendem Inkrafttreten (redaktionelle Nachführung der Quelle)
- 6: Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich

| Stand | Sprache | Einheit | Schlüssel | vorher | nachher | Art |
|---|---|---|---|---|---|---|
| 20220901 | de | art_61_a | p4 |  Bei unfreiwilliger Beendigung des Arbeitsverhältnisses nach den ersten zwölf Monaten des Aufenthalts erlischt das Aufen … |  Bei unfreiwilliger Beendigung des Arbeitsverhältnisses nach den ersten zwölf Monaten des Aufenthalts erlischt das Aufen … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220901 | it | art_76 | p1.b.n5 | la decisione d’allontanamento è notificata in un centro della Confederazione e l’esecuzione dell’allontanamento è presum … | la decisione d’allontanamento è notificata in un centro della Confederazione e l’esecuzione dell’allontanamento è presum … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20230901 | de | art_111_g | p1 |  Die kantonalen Datenschutzbehörden und der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) arbeiten i … |  Die kantonalen Datenschutzbehörden und der EDÖB arbeiten im Rahmen ihrer jeweiligen Zuständigkeiten zusammen. | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20230901 | it | art_111_g | p1 |  Le autorità cantonali di protezione dei dati e l’Incaricato federale della protezione dei dati e della trasparenza (IFP … |  Le autorità cantonali di protezione dei dati e l’IFPDT cooperano nell’ambito delle rispettive competenze. | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20231015 | fr | art_97 | p3.e | d’autres décisions indiquant l’existence de besoins d’intégration particuliers conformément aux critères définis à l’art … | d’autres décisions indiquant l’existence de besoins d’intégration particuliers conformément aux critères définis à l’art … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s7 |  | Indice | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s8 |  | Capitolo 1: Oggetto e campo d’applicazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s9 |  | Capitolo 2: Principi dell’ammissione e dell’integrazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s10 |  | Capitolo 3: Entrata e partenza | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s11 |  | Abrogato Art. 8 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s12 |  | Capitolo 4: Obbligo del permesso e di notificazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s13 |  | Capitolo 5: Condizioni d’ammissione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s14 |  | Sezione 1:  Ammissione per un soggiorno con attività lucrativa | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s15 |  | Sezione 2:  Ammissione per un soggiorno senza attività lucrativa | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s16 |  | Sezione 3: Deroghe alle condizioni d’ammissione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s17 |  | Art. 30 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s18 |  | Sezione 4: Apolidi | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s19 |  | Art. 31 | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20250401 | it | annex_2 | h1.s20 |  | Capitolo 6: Regolamentazione del soggiorno | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s21 |  | Capitolo 7: Ricongiungimento familiare | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s22 |  | Capitolo 8: Integrazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s23 |  | Sezione 1:  Promozione dell’integrazione degli stranieri | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s24 |  | Sezione 2: Requisiti d’integrazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s25 |  | Capitolo 9: Documenti di viaggio e divieto di viaggiare | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s26 |  | Capitolo 10: Fine del soggiorno | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s27 |  | Sezione 1: Aiuto al ritorno e alla reintegrazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s28 |  | Art. 60 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s29 |  | Sezione 2:  Decadenza e revoca dei permessi ed estinzione del diritto di soggiorno | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s30 |  | Sezione 3:  Misure di allontanamento e di respingimento | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s31 |  | Abrogato Art. 66 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s32 |  | Sezione 4:  Rinvio coatto e operazioni internazionali di rimpatrio | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s33 |  | Sezione 5: Misure coercitive | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s34 |  | Capitolo 11: Ammissione provvisoria | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s35 |  | Unione domestica registrata Art. 88a | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s36 |  | Capitolo 12: Obblighi | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s37 |  | Sezione 1:  Obblighi degli stranieri, dei datori di lavoro e dei destinatari di servizi | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s38 |  | Sezione 2: Obblighi delle imprese di trasporto | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s39 |  | Sezione 3: Obblighi dei gestori di aeroporti | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s40 |  | Capitolo 13: Compiti e competenze delle autorità | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s41 |  | Capitolo 14: Trattamento e protezione dei dati | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s42 |  | Sezione 1: In generale | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s43 |  | Sezione 2:  Dati dei passeggeri, sorveglianza e controlli agli aeroporti e obbligo di comunicazione delle imprese di tra … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s44 |  | Sezione 3: Comunicazione di dati personali all’estero | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s45 |  | Capitolo 14a: Sistemi d’informazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s46 |  | Sezione 1:  Sistema centrale d’informazione visti e sistema nazionale visti | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s47 |  | Sezione 2:  Sistema d’informazione per l’attuazione del ritorno | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s48 |  | Sezione 3:  Sistema di gestione dei fascicoli personali e della documentazione | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s49 |  | Capitolo 14b:  Protezione dei dati nell’ambito degli Accordi di associazione alla normativa di Schengen | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s50 |  | Abrogato Art. 111e | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s51 |  | Abrogato Art. 111h | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s52 |  | Capitolo 14c: Eurodac | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s53 |  | Art. 111i | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s54 |  | Capitolo 15: Rimedi giuridici | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s55 |  | Capitolo 16:  Disposizioni penali e sanzioni amministrative | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s56 |  | Sezione 1: Disposizioni penali | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s57 |  | Sezione 2: Sanzioni amministrative | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s58 |  | Messa al sicuro e confisca di documenti Art. 121 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s59 |  | Capitolo 17: Emolumenti | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s60 |  | Art. 123 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s61 |  | Capitolo 18: Disposizioni finali | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | annex_2 | h1.s62 |  | Disposizioni transitorie della modifica del  14 dicembre 2012 | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250528 | de | art_80 | p1 |  Die Haft wird von den Behörden des Kantons angeordnet, welcher für den Vollzug der Weg- oder Ausweisung zuständig ist.  … |  Die Haft wird von den Behörden des Kantons angeordnet, welcher für den Vollzug der Weg- oder Ausweisung zuständig ist.  … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20250801 | de | art_111_b | p4 |  Der Bundesrat kann die in Absatz 2 erwähnten Kategorien von Personendaten an die neuesten Entwicklungen des Schengen-Be … |  Der Bundesrat kann die in Absatz 2 erwähnten Kategorien von Personendaten an die neuesten Entwicklungen des Schengen-Be … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260201 | fr | art_97 | p1 |  Les autorités chargées de l’exécution de la présente loi s’assistent mutuellement dans l’accomplissement de leurs tâche … |  Les autorités chargées de l’exécution de la présente loi s’assistent mutuellement dans l’accomplissement de leurs tâche … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260612 | de | art_76 | p1.b.n3 | konkrete Anzeichen befürchten lassen, dass sie sich der Ausschaffung entziehen will, insbesondere, weil sie der Mitwirku … | konkrete Anzeichen befürchten lassen, dass sie sich der Ausschaffung entziehen will, insbesondere, weil sie der Mitwirku … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260612 | it | art_82 | p2 |  La Confederazione partecipa con una somma forfettaria giornaliera alle spese d’esercizio dei Cantoni per l’esecuzione d … |  La Confederazione partecipa con una somma forfettaria giornaliera alle spese d’esercizio dei Cantoni per l’esecuzione d … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260612 | it | art_82 | p3 |  La Confederazione può, per un periodo determinato, partecipare con una somma forfettaria giornaliera alle spese d’eserc … |  La Confederazione può, per un periodo determinato, partecipare con una somma forfettaria giornaliera alle spese d’eserc … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20270101 | fr | art_103_c | p1.c | le Corps des gardes-frontière, les autorités cantonales et communales de police et les autorités migratoires cantonales  … | le Corps des gardes-frontière, les autorités cantonales et communales de police et les autorités migratoires cantonales  … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20270101 | fr | art_122_a | p1 |  L’entreprise de transport aérien qui viole le devoir de diligence prévu à l’art. 92, al. 1 ou 1bis, est tenue au paieme … |  L’entreprise de transport aérien qui viole le devoir de diligence prévu à l’art. 92, al. 1 ou 1bis, est tenue au paieme … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20270101 | it | art_85 | p3-4 |  |  … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20270101 | it | art_85 | p7bis-7ter |  |  … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20270101 | it | art_108_j | p1.b | il SIC, fedpol, il Protocollo del DFAE e la Missione svizzera a Ginevra, ai dati di cui all’articolo 108i capoverso 2 le … | il SIC, fedpol, il Protocollo del DFAE e la Missione svizzera a Ginevra, ai dati di cui all’articolo 108i capoverso 2 le … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20270101 | it | art_108_j | p1.b.s2 |  | il SIC e fedpol ai dati di cui all’articolo 108i capoverso 2 lettere k ed l, nel quadro dello svolgimento dei compiti in … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |

### AIG: strukturelle Änderungen ohne Beleg

- 20221122 de art_111_g_111_h (Einheit): deleted
- 20221122 de art_111_h (Einheit): inserted
- 20221122 fr art_111_g_111_h (Einheit): deleted
- 20221122 fr art_111_h (Einheit): inserted
- 20221122 it art_111_g_111_h (Einheit): deleted
- 20221122 it art_111_h (Einheit): inserted
- 20240701 de art_72 (Einheit): repealed
- 20240701 de art_72 _title: replaced
- 20240701 de art_72 p1: deleted
- 20240701 de art_72 p2: deleted
- 20240701 de art_72 p3: deleted
- 20240701 de art_72 p4: deleted
- 20240701 fr art_72 (Einheit): repealed
- 20240701 fr art_72 _title: replaced
- 20240701 fr art_72 p1: deleted
- 20240701 fr art_72 p2: deleted
- 20240701 fr art_72 p3: deleted
- 20240701 fr art_72 p4: deleted
- 20240701 it art_72 (Einheit): repealed
- 20240701 it art_72 _title: replaced
- 20240701 it art_72 p1: deleted
- 20240701 it art_72 p2: deleted
- 20240701 it art_72 p3: deleted
- 20240701 it art_72 p4: deleted
- 20250101 de art_126_e_126_f (Einheit): inserted
- 20250101 fr art_126_e_126_f (Einheit): inserted
- 20250101 it art_126_e_126_f (Einheit): inserted
- 20250528 it annex_2 h1.s7: deleted
- 20250528 it annex_2 h1.s8: deleted
- 20250528 it annex_2 h1.s9: deleted
- 20250528 it annex_2 h1.s10: deleted
- 20250528 it annex_2 h1.s11: deleted
- 20250528 it annex_2 h1.s12: deleted
- 20250528 it annex_2 h1.s13: deleted
- 20250528 it annex_2 h1.s14: deleted
- 20250528 it annex_2 h1.s15: deleted
- 20250528 it annex_2 h1.s16: deleted
- 20250528 it annex_2 h1.s17: deleted
- 20250528 it annex_2 h1.s18: deleted
- 20250528 it annex_2 h1.s19: deleted
- 20250528 it annex_2 h1.s20: deleted
- 20250528 it annex_2 h1.s21: deleted
- 20250528 it annex_2 h1.s22: deleted
- 20250528 it annex_2 h1.s23: deleted
- 20250528 it annex_2 h1.s24: deleted
- 20250528 it annex_2 h1.s25: deleted
- 20250528 it annex_2 h1.s26: deleted
- 20250528 it annex_2 h1.s27: deleted
- 20250528 it annex_2 h1.s28: deleted
- 20250528 it annex_2 h1.s29: deleted
- 20250528 it annex_2 h1.s30: deleted
- 20250528 it annex_2 h1.s31: deleted
- 20250528 it annex_2 h1.s32: deleted
- 20250528 it annex_2 h1.s33: deleted
- 20250528 it annex_2 h1.s34: deleted
- 20250528 it annex_2 h1.s35: deleted
- 20250528 it annex_2 h1.s36: deleted
- 20250528 it annex_2 h1.s37: deleted
- 20250528 it annex_2 h1.s38: deleted
- 20250528 it annex_2 h1.s39: deleted
- 20250528 it annex_2 h1.s40: deleted
- 20250528 it annex_2 h1.s41: deleted
- 20250528 it annex_2 h1.s42: deleted
- 20250528 it annex_2 h1.s43: deleted
- 20250528 it annex_2 h1.s44: deleted
- 20250528 it annex_2 h1.s45: deleted
- 20250528 it annex_2 h1.s46: deleted
- 20250528 it annex_2 h1.s47: deleted
- 20250528 it annex_2 h1.s48: deleted
- 20250528 it annex_2 h1.s49: deleted
- 20250528 it annex_2 h1.s50: deleted
- 20250528 it annex_2 h1.s51: deleted
- 20250528 it annex_2 h1.s52: deleted
- 20250528 it annex_2 h1.s53: deleted
- 20250528 it annex_2 h1.s54: deleted
- 20250528 it annex_2 h1.s55: deleted
- 20250528 it annex_2 h1.s56: deleted
- 20250528 it annex_2 h1.s57: deleted
- 20250528 it annex_2 h1.s58: deleted
- 20250528 it annex_2 h1.s59: deleted
- 20250528 it annex_2 h1.s60: deleted
- 20250528 it annex_2 h1.s61: deleted
- 20250528 it annex_2 h1.s62: deleted
- 20250615 de art_108_109 (Einheit): deleted
- 20250615 de art_108 (Einheit): inserted
- 20250615 de art_109 (Einheit): inserted
- 20250615 de art_126_e_126_f (Einheit): deleted
- 20250615 de art_126_f (Einheit): inserted
- 20250615 fr art_108_109 (Einheit): deleted
- 20250615 fr art_108 (Einheit): inserted
- 20250615 fr art_109 (Einheit): inserted
- 20250615 fr art_126_e_126_f (Einheit): deleted
- 20250615 fr art_126_f (Einheit): inserted
- 20250615 it art_108_109 (Einheit): deleted
- 20250615 it art_108 (Einheit): inserted
- 20250615 it art_109 (Einheit): inserted
- 20250615 it art_126_e_126_f (Einheit): deleted
- 20250615 it art_126_f (Einheit): inserted
- 20270101 it art_85 p3: deleted
- 20270101 it art_85 p7bis: deleted

### VZAE: redaktionelle Änderungen (Block `x: "editorial"`)

- 8: Textänderung ohne Änderungshinweis mit passendem Inkrafttreten (redaktionelle Nachführung der Quelle)
- 2: Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich

| Stand | Sprache | Einheit | Schlüssel | vorher | nachher | Art |
|---|---|---|---|---|---|---|
| 20230201 | de | art_87 | p1.c | DNA-Profile gemäss Artikel 33 des Bundesgesetzes vom 8. Oktober 2004 über genetische Untersuchungen beim Menschen. | DNA-Profile gemäss Artikel 50 des Bundesgesetzes vom 15. Juni 2018 über genetische Untersuchungen beim Menschen. | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20230201 | fr | art_87 | p1.c | profils d’ADN conformément à l’art. 33 de la loi fédérale du 8 octobre 2004 sur l’analyse génétique humaine. | profils d’ADN conformément à l’art. 50 de la loi fédérale du 15 juin 2018 sur l’analyse génétique humaine. | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20230201 | it | art_87 | p1.c | profili del DNA secondo l’articolo 33 della legge federale dell’8 ottobre 2004 sugli esami genetici sull’essere umano. | profili del DNA secondo l’articolo 50 della legge federale del 15 giugno 2018 sugli esami genetici sull’essere umano. | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20240601 | de | art_87 | p2quinquies |  Das Eidgenössische Justiz- und Polizeidepartment ist zudem befugt, in ausserordentlichen Situationen weitere Ausnahmen  … |  Das Eidgenössische Justiz- und Polizeidepartment ist zudem befugt, in ausserordentlichen Situationen weitere Ausnahmen  … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20240601 | fr | art_82_d | p3 |  La communication doit avoir lieu dans un délai de vingt jours |  La communication doit avoir lieu dans un délai de vingt jours: | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20260422 | de | art_77_d | p2 |  Das SEM unterstützt die Kantone bei der Prüfung der Sprachnachweise nach Absatz 2 Buchstabe d. Es kann Dritte mit diese … |  Das SEM unterstützt die Kantone bei der Prüfung der Sprachnachweise nach Absatz 1 Buchstabe d. Es kann Dritte mit diese … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260422 | fr | art_77_d | p2 |  Le SEM aide les cantons lors de l’examen des attestations des compétences linguistiques visées à l’al. 2, let. d. Il pe … |  Le SEM aide les cantons lors de l’examen des attestations des compétences linguistiques visées à l’al. 1, let. d. Il pe … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260422 | it | art_77_d | p2 |  La SEM supporta i Cantoni nel verificare la dimostrazione delle competenze linguistiche secondo il capoverso 2 lettera  … |  La SEM supporta i Cantoni nel verificare la dimostrazione delle competenze linguistiche secondo il capoverso 1 lettera  … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260422 | it | art_82 | p1 |  Le autorità di polizia, quelle giudiziarie e quelle preposte alle inchieste penali comunicano spontaneamente alle autor … |  Le autorità di polizia e giudiziarie così come le autorità istruttorie penali comunicano spontaneamente alle autorità c … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20261001 | it | art_83_a | p1 |  Le autorità cantonali della migrazione impongono senza formalità, in base alla direttiva 2001/40/CE, la partenza dalla  … |  Le autorità cantonali della migrazione impongono senza formalità, in base alla direttiva 2001/40/CE, la partenza dalla  … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |

### VEV: redaktionelle Änderungen (Block `x: "editorial"`)

- 8: Textänderung ohne Änderungshinweis mit passendem Inkrafttreten (redaktionelle Nachführung der Quelle)
- 19: Auflösung bzw. Entstehung eines doppelten eId (Auszeichnungsfehler der Quelle)
- 24: Einheit in dieser Sprachquelle bisher nicht ausgezeichnet (in anderen Sprachen schon vorhanden): Korrektur der Auszeichnung

| Stand | Sprache | Einheit | Schlüssel | vorher | nachher | Art |
|---|---|---|---|---|---|---|
| 20220101 | de | art_29 | p1 |  Das SEM legt im Einvernehmen mit der Eidgenössischen Zollverwaltung und den für die Personenkontrollen zuständigen Behö … |  Das SEM legt im Einvernehmen mit dem Bundesamt für Zoll und Grenzsicherheit und den für die Personenkontrollen zuständi … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220115 | de | art_34_d | p1~2 |  |  Das SEM ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von Durchführungsrechtsakten der  … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s2 |  | a. die Festlegung detaillierter Bestimmungen über die Funktion für die zentrale Verwaltung der Liste der anerkannten Rei … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s3 |  | b. die Festlegung detaillierter Bestimmungen über die Verwaltung der Funktion für die zentrale Verwaltung der Liste der  … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s4 |  | c. die Festlegung der Risiken, auf die sich die spezifischen Risikoindikatoren stützen (Art. 9j Abs. 3); | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s5 |  | d. die Festlegung und Weiterentwicklung des Mechanismus und der Verfahren für die Durchführung von Qualitätskontrollen s … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s6 |  | e. die Festlegung der Spezifikationen der Qualitätsstandards für die Speicherung der in das C-VIS eingegebenen Daten (Ar … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s7 |  | f. die Festlegung der für die Entwicklung des C‑VIS, der nationalen Schnittstelle in jedem Mitgliedstaat und der Kommuni … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s8 |  | g. die Festlegung der für die technische Implementierung der Funktionen des  C-VIS erforderlichen Massnahmen (Art. 45 Ab … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s9 |  | h. die Festlegung der technischen Spezifikationen für die Qualität, Auflösung und Verwendung von Fingerabdrücken und des … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s10 |  | i. die Festlegung detaillierter Bestimmungen über die Voraussetzungen für den Betrieb des Zugangs für Beförderungsuntern … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s11 |  | j. die Festlegung des Authentifizierungssystems für Beförderungsunternehmen (Art. 45c Abs. 5); | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s12 |  | k. die Festlegung der Einzelheiten der Ausweichverfahren für den Fall, dass der Datenzugriff durch Beförderungsunternehm … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~2.s13 |  | l. die Festlegung der Spezifikationen der technischen Lösung, die den Mitgliedstaaten zur Erleichterung der Datenerhebun … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p2~2 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p2~2.s2 |  | a. die Festlegung der vorgegebenen Liste von Beschäftigungen (Art. 9 Abs. 3); | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p2~2.s3 |  | b. die genauere Definition des Risikos für die Sicherheit, des Risikos der illegalen Einwanderung oder des hohen Epidemi … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p2~2.s4 |  | c. die Erstellung eines Handbuchs, das die für Abfragen, Verifizierungen und Bewertungen im Rahmen der Interoperabilität … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p1~3 |  |  Das SEM ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von Durchführungsrechtsakten der  … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p2~3 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Auflösung bzw. Entstehung eines doppelten eId |
| 20220115 | de | art_34_d | p3 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen betreffend Durchführungsrechtsakten der Europäischen … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220115 | de | art_34_d | p3.s2 |  | a. die Genehmigung von nationalen Programmen (Art. 23 Abs. 4); | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220115 | de | art_34_d | p3.s3 |  | b. die Entscheidung über Finanzkorrekturen (Art. 104 Abs. 4). | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220115 | de | art_34_d | p4 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220501 | de | art_46_53 | p |  | Aufgehoben | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220501 | fr | art_46_53 | p |  | Abrogés | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220501 | it | art_46_53 | p |  | Abrogati | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20220622 | de | art_34_e | p1 |  |  Das SEM ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von Durchführungsrechtsakten der  … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.a |  | die Festlegung detaillierter Bestimmungen über die Funktion für die zentrale Verwaltung der Liste der anerkannten Reised … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.b |  | die Festlegung detaillierter Bestimmungen über die Verwaltung der Funktion für die zentrale Verwaltung der Liste der Beh … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.c |  | die Festlegung der Risiken, auf die sich die spezifischen Risikoindikatoren stützen (Art. 9j Abs. 3); | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.d |  | die Festlegung und Weiterentwicklung des Mechanismus und der Verfahren für die Durchführung von Qualitätskontrollen sowi … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.e |  | die Festlegung der Spezifikationen der Qualitätsstandards für die Speicherung der in das C-VIS eingegebenen Daten (Art.  … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.f |  | die Festlegung der für die Entwicklung des C‑VIS, der nationalen Schnittstelle in jedem Mitgliedstaat und der Kommunikat … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.g |  | die Festlegung der für die technische Implementierung der Funktionen des | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.g.s2 |  | C-VIS erforderlichen Massnahmen (Art. 45 Abs. 2); | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.h |  | die Festlegung der technischen Spezifikationen für die Qualität, Auflösung und Verwendung von Fingerabdrücken und des Ge … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.i |  | die Festlegung detaillierter Bestimmungen über die Voraussetzungen für den Betrieb des Zugangs für Beförderungsunternehm … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.j |  | die Festlegung des Authentifizierungssystems für Beförderungsunternehmen (Art. 45c Abs. 5); | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.k |  | die Festlegung der Einzelheiten der Ausweichverfahren für den Fall, dass der Datenzugriff durch Beförderungsunternehmen  … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p1.l |  | die Festlegung der Spezifikationen der technischen Lösung, die den Mitgliedstaaten zur Erleichterung der Datenerhebung g … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p2 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p2.a |  | die Festlegung der vorgegebenen Liste von Beschäftigungen (Art. 9 Abs. 3); | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p2.b |  | die genauere Definition des Risikos für die Sicherheit, des Risikos der illegalen Einwanderung oder des hohen Epidemieri … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_e | p2.c |  | die Erstellung eines Handbuchs, das die für Abfragen, Verifizierungen und Bewertungen im Rahmen der Interoperabilität de … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p1 |  |  Das SEM ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von Durchführungsrechtsakten der  … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p2 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p3 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen betreffend Durchführungsrechtsakten der Europäischen … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p3.a |  | die Genehmigung von nationalen Programmen (Art. 23 Abs. 4); | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p3.b |  | die Entscheidung über Finanzkorrekturen (Art. 104 Abs. 4). | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |
| 20220622 | de | art_34_f | p4 |  |  Es ist zuständig für den Abschluss von völkerrechtlichen Verträgen zur Übernahme von delegierten Rechtsakten der Europä … | Einheit in dieser Sprachquelle bisher nicht ausgezeichnet |

### VEV: strukturelle Änderungen ohne Beleg

- 20220501 de art_46_53 (Einheit): inserted
- 20220501 fr art_46_53 (Einheit): inserted
- 20220501 it art_46_53 (Einheit): inserted
- 20220622 de art_34_d p2.s2: deleted
- 20220622 de art_34_d p1~2: deleted
- 20220622 de art_34_d p1~2.s2: deleted
- 20220622 de art_34_d p1~2.s3: deleted
- 20220622 de art_34_d p1~2.s4: deleted
- 20220622 de art_34_d p1~2.s5: deleted
- 20220622 de art_34_d p1~2.s6: deleted
- 20220622 de art_34_d p1~2.s7: deleted
- 20220622 de art_34_d p1~2.s8: deleted
- 20220622 de art_34_d p1~2.s9: deleted
- 20220622 de art_34_d p1~2.s10: deleted
- 20220622 de art_34_d p1~2.s11: deleted
- 20220622 de art_34_d p1~2.s12: deleted
- 20220622 de art_34_d p1~2.s13: deleted
- 20220622 de art_34_d p2~2: deleted
- 20220622 de art_34_d p2~2.s2: deleted
- 20220622 de art_34_d p2~2.s3: deleted
- 20220622 de art_34_d p2~2.s4: deleted
- 20220622 de art_34_d p2~2.s5: deleted
- 20220622 de art_34_d p1~3: deleted
- 20220622 de art_34_d p2~3: deleted
- 20220622 de art_34_d p3: deleted
- 20220622 de art_34_d p3.s2: deleted
- 20220622 de art_34_d p3.s3: deleted
- 20220622 de art_34_d p4: deleted
- 20220622 de art_34_e (Einheit): inserted
- 20220622 de art_34_f (Einheit): inserted

### AsylG: redaktionelle Änderungen (Block `x: "editorial"`)

- 7: Textänderung ohne Änderungshinweis mit passendem Inkrafttreten (redaktionelle Nachführung der Quelle)
- 2: Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich

| Stand | Sprache | Einheit | Schlüssel | vorher | nachher | Art |
|---|---|---|---|---|---|---|
| 20221122 | it | art_61 | p1 |  Se il richiedente è incarcerato in vista d’estradizione su richiesta dello Stato da cui cerca protezione in Svizzera, l … |  Le persone a cui la Svizzera ha accordato asilo o che sono state ammesse provvisoriamente come rifugiati nonché i rifug … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250101 | it | art_91 | p1-2 |  |  ... | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20250401 | de | disp_u8 | p |  | Der Bundesrat legt dem Parlament drei Jahre nach Inkrafttreten der Änderung vom 1. Oktober 2021 einen Bericht zur Zweckm … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | fr | disp_u8 | p |  | Le Conseil fédéral présente au Parlement, trois ans après l’entrée en vigueur de la modification du 1er octobre 2021, un … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20250401 | it | disp_u8 | p |  | Tre anni dopo l’entrata in vigore della modifica del 1° ottobre 2021, il Consiglio federale presenta al Parlamento un ra … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20260612 | de | art_91 | p1-2 |  | … | Absatz in der Quelle anders aufgeteilt oder zusammengefasst; Wortlaut sonst gleich |
| 20270101 | de | art_5_a | p1 |  Das Staatssekretariat für Migration (SEM) arbeitet im Rahmen seiner gesetzlichen Aufgaben bei der Terrorismusbekämpfung … |  Das Staatssekretariat für Migration (SEM) arbeitet im Rahmen seiner gesetzlichen Aufgaben bei der Terrorismusbekämpfung … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20270101 | fr | art_5_a | p1 |  Le Secrétariat d’État aux migrations (SEM) collabore avec fedpol dans le cadre de ses tâches légales dans la lutte cont … |  Le Secrétariat d’État aux migrations (SEM) collabore avec l’Office fédéral de la police (fedpol) dans le cadre de ses t … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |
| 20270101 | it | art_5_a | p1 |  Nell’ambito dei suoi compiti legali di lotta al terrorismo, la Segreteria di Stato della migrazione (SEM) collabora con … |  Nell’ambito dei suoi compiti legali di lotta al terrorismo, la Segreteria di Stato della migrazione (SEM) collabora con … | Textänderung ohne Änderungshinweis mit passendem Inkrafttreten |

### AsylG: strukturelle Änderungen ohne Beleg

- 20240101 de art_112_b (Einheit): repealed
- 20240101 de art_112_b _title: replaced
- 20240101 de art_112_b p1: deleted
- 20240101 de art_112_b p2: deleted
- 20240101 de art_112_b p3: deleted
- 20240101 de art_112_b p4: deleted
- 20240101 de art_112_b p5: deleted
- 20240101 de disp_u5 p: deleted
- 20240101 de disp_u5 p.a: deleted
- 20240101 de disp_u5 p.b: deleted
- 20240101 de disp_u5 p.s2: deleted
- 20240101 de disp_u5 p.s3: deleted
- 20240101 fr art_112_b (Einheit): repealed
- 20240101 fr art_112_b _title: replaced
- 20240101 fr art_112_b p1: deleted
- 20240101 fr art_112_b p2: deleted
- 20240101 fr art_112_b p3: deleted
- 20240101 fr art_112_b p4: deleted
- 20240101 fr art_112_b p5: deleted
- 20240101 fr disp_u5 p: deleted
- 20240101 fr disp_u5 p.a: deleted
- 20240101 fr disp_u5 p.b: deleted
- 20240101 fr disp_u5 p.s2: deleted
- 20240101 fr disp_u5 p.s3: deleted
- 20240101 it art_112_b (Einheit): repealed
- 20240101 it art_112_b _title: replaced
- 20240101 it art_112_b p1: deleted
- 20240101 it art_112_b p2: deleted
- 20240101 it art_112_b p3: deleted
- 20240101 it art_112_b p4: deleted
- 20240101 it art_112_b p5: deleted
- 20240101 it disp_u5 s1: deleted
- 20240101 it disp_u5 a: deleted
- 20240101 it disp_u5 b: deleted
- 20240101 it disp_u5 s2: deleted
- 20240101 it disp_u5 s3: deleted
- 20250101 it art_91 p1: deleted
- 20250401 de disp_u8 (Einheit): inserted
- 20250401 fr disp_u8 (Einheit): inserted
- 20250401 it art_52 _title: replaced
- 20250401 it disp_u8 (Einheit): inserted
- 20260612 de art_91 p1: deleted

### Umkehrprüfung: Impact-Einträge im XML-Zeitraum

| Erlass | Einträge (Inkrafttreten nach dem ersten Stand) | gefunden | erklärt | offen |
|---|---|---|---|---|
| AIG | 257 | 253 | 4 | 0 |
| VZAE | 49 | 49 | 0 | 0 |
| VEV | 105 | 105 | 0 | 0 |
| AsylG | 93 | 91 | 2 | 0 |
| EESV | 12 | 12 | 0 | 0 |

AIG:

- 2022-11-22 oc/2021/365 Typ 1 Ziel art_98_c (Stand 20221122): Quelle unverändert: Einheit art_98_c hat in 20221122 in DE, FR und IT dieselbe Fassung wie in 20220901 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung
- 2023-09-01 oc/2022/491 Typ 1 Ziel art_102_c (Stand 20230901): Quelle unverändert: Einheit art_102_c hat in 20230901 in DE, FR und IT dieselbe Fassung wie in 20230701 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung
- 2023-09-01 oc/2022/491 Typ 1 Ziel art_92_a (Stand 20230901): Quelle unverändert: Einheit art_92_a hat in 20230901 in DE, FR und IT dieselbe Fassung wie in 20230701 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung
- 2027-01-01 oc/2025/348 Typ 1 Ziel art_111_j (Stand 20270101): Quelle unverändert: Einheit art_111_j hat in 20270101 in DE, FR und IT dieselbe Fassung wie in 20261101 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung

AsylG:

- 2022-11-22 oc/2021/365 Typ 1 Ziel art_5_a (Stand 20221122): Quelle unverändert: Einheit art_5_a hat in 20221122 in DE, FR und IT dieselbe Fassung wie in 20220901 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung
- 2027-01-01 oc/2026/393 Typ 1 Ziel art_111 (Stand 20270101): Quelle unverändert: Einheit art_111 hat in 20270101 in DE, FR und IT dieselbe Fassung wie in 20260612 (Wortlaut, Fussnoten); Impact-Eintrag ohne sichtbare Textänderung

## 4 Sprachkonsistenz der Schlüsselmengen (Prüfung 3)

Gleiche Schlüsselfolge je Einheit und Stand in DE, FR, IT. Abweichende Blockgliederung einer Sprachquelle wird nicht vereinheitlicht (der Wortlaut jeder Sprache ist nach Prüfung 1 vollständig); wo die Folgen gleich lang und gleich tief sind, übernimmt die Sprache die Schlüssel der Bezugssprache (Protokoll `lang-key`). Jede verbleibende Ausnahme steht unten mit Begründung.

| Erlass | Einheit × Stand geprüft | gleich in DE, FR, IT | Ausnahmen |
|---|---|---|---|
| AIG | 5116 | 5091 | 25 |
| VZAE | 2489 | 2473 | 16 |
| VEV | 2025 | 1977 | 48 |
| AsylG | 2576 | 2554 | 22 |
| EESV | 162 | 158 | 4 |

AIG:

| Stand | Einheit | Abweichung | Begründung | Protokoll |
|---|---|---|---|---|
| 20210701 | art_68_a | de: ohne p2; it: ohne p2 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | lang-mismatch |
| 20211002 | art_68_a | de: ohne p2; it: ohne p2 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | lang-mismatch |
| 20220501 | art_68_a | de: ohne p2; it: ohne p2 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | lang-mismatch |
| 20220601 | art_68_a | de: ohne p2; it: ohne p2 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | lang-mismatch |
| 20220901 | art_68_a | de: ohne p2; it: ohne p2 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | lang-mismatch |
| 20221122 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20221217 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20230401 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20230701 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20230901 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20231015 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240601 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240701 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250101 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250401 | annex_2 | de: ohne h1.s7, h1.s8, h1.s9, h1.s10, h1.s11, h1.s12 (+50); fr: ohne h1.s7, h1.s8, h1.s9, h1.s10, h1.s11, h1.s12 (+50) | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250401 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250528 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250615 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250801 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20260201 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20260612 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20261101 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20270101 | art_85 | de: ohne p3-4, p7bis-7ter; fr: ohne p3-4, p7bis-7ter; it: ohne p3, p7bis | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20270101 | art_68_d | de: ohne p3.c.s2; fr: ohne p3.c.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20270101 | art_108_j | de: ohne p1.b.s2; fr: ohne p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |

VZAE:

| Stand | Einheit | Abweichung | Begründung | Protokoll |
|---|---|---|---|---|
| 20210101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20220101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20220312 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20221122 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20230101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20230123 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20230201 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20230901 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20240101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20240601 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20250101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20251201 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20260101 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20260422 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20260612 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |
| 20261001 | art_78 | de: ohne pu1; fr: ohne pu1; it: ohne sh | Verweiszeile unter dem Titel in einer Sprache als Absatz statt als Untertitel ausgezeichnet | lang-mismatch |

VEV:

| Stand | Einheit | Abweichung | Begründung | Protokoll |
|---|---|---|---|---|
| 20210101 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20210101 | annex_3 | de: ohne h1.s2, h1.s3, h1.s4, h1.s5, h1.s6, h1.s7 (+16); fr: ohne h1.s2, h1.s3, h1.s4, h1.s5, h1.s6, h1.s7 (+16); it: ohne h1.t1 | Inhalt in einer Sprache als Tabelle, in den anderen als Absätze ausgezeichnet | lang-mismatch |
| 20210915 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20210915 | annex_3 | de: ohne h1.s2, h1.s3, h1.s4, h1.s5, h1.s6, h1.s7 (+16); fr: ohne h1.s2, h1.s3, h1.s4, h1.s5, h1.s6, h1.s7 (+16); it: ohne h1.t1 | Inhalt in einer Sprache als Tabelle, in den anderen als Absätze ausgezeichnet | lang-mismatch |
| 20220101 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220115 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220115 | art_34_d | fr: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19); it: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19) | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-mismatch |
| 20220115 | art_34_e | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220115 | art_34_f | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220501 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220501 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220501 | art_34_d | fr: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19); it: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19) | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-mismatch |
| 20220501 | art_34_e | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220501 | art_34_f | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220610 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220610 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220610 | art_34_d | fr: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19); it: ohne p2.s2, p1~2, p1~2.s2, p1~2.s3, p1~2.s4, p1~2.s5 (+19) | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-mismatch |
| 20220610 | art_34_e | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220610 | art_34_f | de: (Einheit fehlt) | Einheit fehlt in der Quelle einer Sprache (Auszeichnungsfehler der Quelle, z. B. in Art. 34d eingebettet) | lang-unit |
| 20220622 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220622 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20220622 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20230204 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20230204 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20230204 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20231015 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20231015 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20231015 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20240101 | art_2 | fr: ohne p.d.s2; it: ohne p.d.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240101 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240101 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20240201 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240201 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20240301 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240301 | art_34_e | fr: ohne p1.g.s2; it: ohne p1.g.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-unit, lang-mismatch |
| 20240515 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240611 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240801 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20240823 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20241013 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250204 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250401 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20250801 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20251217 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20260201 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20260408 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20260612 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |
| 20261001 | art_34_c | fr: ohne p1.a.s2, p1.b.s2; it: ohne p1.a.s2, p1.b.s2 | Quelle teilt den Text in einer Sprache auf mehrere Absätze (<p>) auf | lang-mismatch |

AsylG:

| Stand | Einheit | Abweichung | Begründung | Protokoll |
|---|---|---|---|---|
| 20210101 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20210101 | disp_u5 | de: ohne s1, a, b, s2, s3; fr: ohne s1, a, b, s2, s3; it: ohne p, p.a, p.b, p.s2, p.s3 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | eid-final, lang-mismatch |
| 20220601 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20220601 | disp_u5 | de: ohne s1, a, b, s2, s3; fr: ohne s1, a, b, s2, s3; it: ohne p, p.a, p.b, p.s2, p.s3 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | eid-final, lang-mismatch |
| 20220901 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20220901 | disp_u5 | de: ohne s1, a, b, s2, s3; fr: ohne s1, a, b, s2, s3; it: ohne p, p.a, p.b, p.s2, p.s3 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | eid-final, lang-mismatch |
| 20221122 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20221122 | disp_u5 | de: ohne s1, a, b, s2, s3; fr: ohne s1, a, b, s2, s3; it: ohne p, p.a, p.b, p.s2, p.s3 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | eid-final, lang-mismatch |
| 20230901 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20230901 | disp_u5 | de: ohne s1, a, b, s2, s3; fr: ohne s1, a, b, s2, s3; it: ohne p, p.a, p.b, p.s2, p.s3 | Auszeichnung der Gliederung weicht zwischen den Sprachquellen ab | eid-final, lang-mismatch |
| 20240101 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20240601 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20250101 | art_91 | de: ohne p1-2; fr: ohne p1-2; it: ohne p1 | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20250101 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20250401 | art_91 | de: ohne p1-2; fr: ohne p1-2; it: ohne p1 | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20250401 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20260601 | art_91 | de: ohne p1-2; fr: ohne p1-2; it: ohne p1 | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20260601 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20260612 | art_91 | de: ohne p1; fr: ohne p1-2; it: ohne p1 | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20260612 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |
| 20270101 | art_91 | de: ohne p1; fr: ohne p1-2; it: ohne p1 | zusammengefasste Absätze («3 und 4»): Gliederungszeichen in einer Sprache teils im Text statt im Nummernfeld | – |
| 20270101 | art_122 | de: ohne p.d5, p.d7; fr: ohne p.d5, p.d7 | Aufzählung mit Strichen: Anzahl der Striche je Sprache verschieden ausgezeichnet | eid-prefix, lang-mismatch |

EESV:

| Stand | Einheit | Abweichung | Begründung | Protokoll |
|---|---|---|---|---|
| 20220501 | annex_2 | de: ohne h3; fr: ohne h1.l2.tab, h1.l2.tab~2; it: ohne h1.l2.tab, h1.l2.tab~2, h3 | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-key, lang-mismatch |
| 20230901 | annex_2 | de: ohne h3; fr: ohne h1.l2.tab, h1.l2.tab~2; it: ohne h1.l2.tab, h1.l2.tab~2, h3 | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-key, lang-mismatch |
| 20230913 | annex_2 | de: ohne h3; fr: ohne h1.l2.tab, h1.l2.tab~2; it: ohne h1.l2.tab, h1.l2.tab~2 | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-key, lang-mismatch |
| 20240101 | annex_2 | de: ohne h3; fr: ohne h1.l2.tab, h1.l2.tab~2; it: ohne h1.l2.tab, h1.l2.tab~2 | doppelter eId in der Quelle (Auszeichnungsfehler); Text vollständig übernommen | dup-key, lang-key, lang-mismatch |

## 5 Schlüsselstabilität (Prüfung 4)

Geprüft: jeder Block, dessen Wortlaut (normalisiert, ohne triviale Texte wie «…») in zwei aufeinanderfolgenden Versionen derselben Einheit und Sprache genau einmal vorkommt. Er muss in beiden Versionen denselben Schlüssel tragen.

| Erlass | Paare | Schlüsselwechsel |
|---|---|---|
| AIG | 3383 | 0 |
| VZAE | 1531 | 0 |
| VEV | 2293 | 3 |
| AsylG | 3292 | 0 |
| EESV | 218 | 0 |

- VEV annex_2 de 20210101→20240101: «h1.s5» → «h1.s7» («Nordmazedonien»)
- VEV annex_2 de 20210101→20240101: «h1.s6» → «h1.s5» («Moldau»)
- VEV annex_2 de 20210101→20240101: «h1.s7» → «h1.s6» («Montenegro»)

## 6 loadWork gegen Build (Prüfung 5)

`loadWork` mit einem `fetch`, der SPARQL-Antworten aus `raw/<id>/fedlex/` und Volltexte aus `raw/<id>/*.xml` liefert, gegen den Eintrag in `data/library.json` (Tiefenvergleich des ganzen Bundles).

| Erlass | SPARQL-Abfragen | Dateien | Laufzeit | Abweichungen |
|---|---|---|---|---|
| cc-2007-758 | 11 | 69 | 5.2 s | keine |
| cc-2007-759 | 11 | 48 | 1.7 s | keine |
| cc-2018-493 | 9 | 75 | 1.8 s | keine |
| cc-1999-358 | 10 | 36 | 2.1 s | keine |
| cc-2021-734 | 8 | 18 | 0.4 s | keine |

### Echter Abruf gegen Fedlex

Suche «142.209»: cc-2007-763 (GebV-AIG, Verordnung vom 24. Oktober 2007 über die Gebühren zum Ausländer- und Integrationsgesetz (Gebührenverordnung AIG, GebV-AIG)), Status inForce, 17 Fassungen, 6 mit XML ab 2021-01-01 (1703 ms). `loadWork` echt: 6 Stände, 17 Fassungen, 17 Einheiten in 3.7 s.

| Stand | Sprache | Wörter | Abdeckung | fehlend | zusätzlich |
|---|---|---|---|---|---|
| 20210101 | de | 2344 | 100,00 % | 0 | 0 |
| 20210101 | fr | 3117 | 100,00 % | 0 | 0 |
| 20210101 | it | 2781 | 100,00 % | 0 | 0 |
| 20211105 | de | 2383 | 100,00 % | 0 | 0 |
| 20211105 | fr | 3174 | 100,00 % | 0 | 0 |
| 20211105 | it | 2826 | 100,00 % | 0 | 0 |
| 20230111 | de | 2411 | 100,00 % | 0 | 0 |
| 20230111 | fr | 3209 | 100,00 % | 0 | 0 |
| 20230111 | it | 2855 | 100,00 % | 0 | 0 |
| 20230123 | de | 2422 | 100,00 % | 0 | 0 |
| 20230123 | fr | 3218 | 100,00 % | 0 | 0 |
| 20230123 | it | 2863 | 100,00 % | 0 | 0 |
| 20240301 | de | 2439 | 100,00 % | 0 | 0 |
| 20240301 | fr | 3243 | 100,00 % | 0 | 0 |
| 20240301 | it | 2880 | 100,00 % | 0 | 0 |
| 20240611 | de | 2440 | 100,00 % | 0 | 0 |
| 20240611 | fr | 3243 | 100,00 % | 0 | 0 |
| 20240611 | it | 2880 | 100,00 % | 0 | 0 |

Echter Abruf gegen Build aus `raw/cc-2007-763` (Tiefenvergleich, ohne Feld `fetched`): identisch.
Prüfungen 1 bis 4 und 6 auf dem echt geladenen Bundle: Wortlaut min. 100,00 %, Fussnoten fehlend 0, Änderungen 18 gedeckt / 0 redaktionell / 0 strukturell, Impacts 6 gefunden / 0 erklärt / 0 offen von 6, Sprachgleich 102 von 102, Schlüssel stabil 240 von 240, Markup-Verstösse 0.

Suche (echt, 5471 ms für fünf Suchen): «142.2» 42 Treffer (142.20 AIG (inForce), 142.201 VZAE (inForce), 142.201.1 ZV-EJPD (inForce), 142.203 VFP (inForce), 142.204 VEV (inForce), 142.205 VIntA (inForce) …); «vzae» 1 (142.201 VZAE (inForce)); «Einreise- und Ausreisesystem» 1 (142.206 EESV (inForce)); «142.204» 3 (142.204 VEV (inForce), 142.204 VEV (repealed), 142.204 VEV (repealed)); Eingabe mit SPARQL-Fragment 0 Treffer (Literal maskiert, Abfrage unverändert).

## 7 Markup (Prüfung 6)

Erlaubt in `t`, `title`, `label`, `heading`, `l`: `<i> <b> <sup> <sub> <br>` und die Entitäten `&amp; &lt; &gt; &quot;`; in Fussnoten zusätzlich `<a href="https://fedlex.data.admin.ch/…">` bzw. `https://www.fedlex.admin.ch/…`; in Tabellen (`html`) zusätzlich `table tr td th` mit `colspan`/`rowspan`. Titel und Bezeichnungen der Erlasse (`acts[]`, aus den Metadaten bzw. Fussnoten): dieselben Inline-Tags wie `t`.

| Erlass | geprüfte Felder | Verstösse |
|---|---|---|
| AIG | 26425 | 0 |
| VZAE | 12417 | 0 |
| VEV | 12501 | 0 |
| AsylG | 21083 | 0 |
| EESV | 1907 | 0 |


## 8 Grösse und Laufzeit

| Erlass | JSON | gzip |
|---|---|---|
| cc-2007-758 | 5.37 MB | 0.56 MB |
| cc-2007-759 | 1.88 MB | 0.21 MB |
| cc-2018-493 | 1.96 MB | 0.17 MB |
| cc-1999-358 | 4.16 MB | 0.38 MB |
| cc-2021-734 | 0.29 MB | 0.04 MB |
| data/library.json gesamt | 13.66 MB | 1.36 MB (base64 ≈ 1.81 MB) |

`buildBundle` für das AIG (23 Stände × 3 Sprachen = 69 Dateien, Node 22 mit linkedom als DOMParser, ohne Netz): 4.6 s, 4.8 s (zwei Läufe). Im Browser übernimmt der native DOMParser das Parsen.

Hinweis zu Fussnoten: Unveränderte Blöcke übernehmen Wortlaut und Auszeichnung der Vorfassung (SPEC §5.1). Ändert die Quelle nur Fussnoten (Text, nicht Nummer), entsteht eine Version mit `fnOnly: true` und Blöcken mit `x: "fn"`; darum ist die Spalte «Fussnoten fehlend» in Kapitel 2 überall 0. Eine reine Verschiebung der Fussnotennummer `n` löst keine Version aus (Test `test/core/model.test.mjs`).

## 9 Weitere Angaben je Erlass

| Erlass | mehrteilige Änderungshinweise (verschiedene) | daraus zusätzliche Ereignisse in acts[].changes | Kurzbezeichnungen gesetzt / null / Bruchstück | Impact-Daten verworfen (Beschluss- statt Inkrafttreten) | Kopf eines Artikels im Text (Quelle) | Versionen nur Fussnoten (fnOnly) | Blöcke x: editorial / origin / fn |
|---|---|---|---|---|---|---|---|
| AIG | 150 | 70 | 172 / 89 / 0 | 6 | 0 | 167 | 73 / 83 / 203 |
| VZAE | 60 | 30 | 139 / 59 / 0 | 0 | 0 | 108 | 9 / 271 / 133 |
| VEV | 30 | 6 | 96 / 15 / 0 | 0 | 20220115 de: art_34_d p2.s2, art_34_d p2~2.s5; 20220501 de: art_34_d p2.s2, art_34_d p2~2.s5; 20220610 de: art_34_d p2.s2, art_34_d p2~2.s5 | 38 | 51 / 135 / 78 |
| AsylG | 102 | 70 | 124 / 65 / 0 | 3 | 0 | 701 | 9 / 24 / 730 |
| EESV | 0 | 0 | 15 / 6 / 0 | 0 | 0 | 3 | 0 / 77 / 4 |

`x`-Werte: `editorial` Wortlaut geändert ohne Änderungshinweis mit passendem Inkrafttreten und ohne Impact; `origin` gleicher Wortlaut, neue Herkunft (neuer Änderungshinweis, z. B. Änderung betrifft nur eine andere Sprache); `fn` nur die Fussnoten des Blocks geändert (Version mit `fnOnly: true`). Massgebend für «geändert» sind `changesOfStage` und `blockHistory`; sie melden `fn` nie und `origin` als Schritt ohne Wortlautänderung.
