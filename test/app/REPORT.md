# SR-Navigator: Prüfbericht Oberfläche und Abnahme

Stand: 16. November 2026. Gebaut mit `node build.mjs` aus `data/library.json` (fünf Erlasse) und `src/core`.
Ergebnis: `dist/sr-navigator.html`, 2,99 MB, eine selbsttragende Datei.

Die Zahlen in Abschnitt 1 und 2 stammen aus dem Schlusslauf des Orchestrators, nicht aus den Berichten der Agents.

## 1 Tests im Schlusslauf

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Kernlogik, mit echtem Abruf gegen Fedlex (GebV-AIG, SR 142.209) | `node --test test/core/*.test.mjs` | 26 von 26 |
| Unit-Tests der Oberfläche | `npm run test:app:unit` | 14 von 14 |
| Browsertests über `file://` | `npx playwright test -c test/app/playwright.config.mjs` | 37 von 37 |
| davon Chrome | | 25 |
| davon Firefox | | 6 |
| davon Edge | | 6 |
| Layoutprüfung: 21 Ansichten, 4 Breiten (1024, 1280, 1440, 1920 px), 3 Sprachen | `test/app/layout.spec.mjs` | 252 Prüfungen, 0 Befunde |

Der echte Abruf der Oberfläche läuft gegen die ETIASV (SR 142.207). Der gemockte Hinzufügen-Test baut eine Variante ohne
EESV und fügt die EESV über «142.206» aus `raw/` hinzu.

## 2 Unabhängige Prüfung der Daten (Orchestrator)

Skripte unter `check/` (Python, eigene Textextraktion aus der Fedlex-XML, unabhängig vom Parser in `src/core`).

| Prüfung | Ergebnis |
|---|---|
| Artikel-Fassungen verglichen (5 Erlasse, alle Stände, DE, FR, IT) | 35 721 |
| Wortlaut identisch | 34 771 |
| nur typografisch verschieden («…» gegen «...», Apostroph, Bindestrich, «n°», hochgestellte Ziffern) | 950 |
| fehlende Wörter | 0 von 5 481 251 |
| geänderte Artikel laut Quelle (231 Standpaare) | 1235 |
| davon im Datensatz als Wortlautänderung ausgewiesen | 1226 |
| Scheinänderungen | 0 |
| Rest | 9: drei Bereichs-Artikel im AIG in drei Sprachen, die wegfallen; `changesOfStage` meldet sie als `deleted` mit `splitInto` |

Die Prüfzahlen des Daten-Agents je Erlass stehen in `data/VALIDATION.md`.

## 3 Abnahme nach Übergabe §12 (als Playwright-Tests)

- (a) «Art. 5» im AIG finden, Chronologie mit Wort-Diff sehen.
- (b), (c) Zwei Fassungen vergleichen, Vergleich als PNG (1588 px breit) und PDF exportieren; das Zitat steht im Titel.
- (d) Weiteren Erlass über die SR-Nummer hinzufügen: gemockt (EESV) und echt (ETIASV).

## 4 Nachbesserungen des Orchestrators nach Sichtung der Screenshots

1. Wort-Diff: Ein Absatz, der einen zweiten Satz erhält, galt als ganz ersetzt. Der Diff zeigt jetzt die Ergänzung
   (`src/app/lib/diff.js`, Test in `test/app/unit.test.mjs`).
2. Zwei Fussnotenzeichen nebeneinander lasen sich als eine Zahl («1920»). Sie sind jetzt mit Komma getrennt.
3. Herkunft am Rand: «AS 2022 462» brach nach der Jahrzahl um. Die Randspalte ist breiter.
4. Exportkarte: Die Fundstellen in der Legende überlappten. Je Erlass steht jetzt eine Zeile.
5. Kurzbezeichnung der Erlasse brach vor der ersten Klammer ab («… Übernahme der Verordnung»). Sie führt jetzt den
   ganzen Namen aus der Fussnote (`src/core/model.js`, Test in `test/core/model.test.mjs`).
6. Esc schliesst die Chronologie-Leiste unabhängig vom Fokus (ein Test scheiterte unter Last einmal von 37).
7. Farbe für «künftig» von 1,85:1 auf 3,5:1 Kontrast angehoben (`--beige-4`).

## 5 Offen oder nicht geprüft

- Safari ist nicht getestet.
- Das Datumsfeld zeigt das Format des Browsers; getestet ist `de-CH`.
- Aktualisieren ist für den Fall «unverändert» und mit gemockten Antworten geprüft, nicht mit einer echten neuen Fassung.
- Laufzeit beim Hinzufügen grosser Erlasse im Browser: AIG 11 bis 17 Sekunden, gemessen vor einer späteren Optimierung.
- Lange Listen sind nicht virtualisiert; mit dem AIG (269 Einheiten) läuft die Oberfläche flüssig, grössere Erlasse sind nicht gemessen.
- Zitierweise für Striche, Präambel und unnummerierte Textteile ist angenommen, nicht an den Weisungen belegt.
- IT-Kürzel des Publikationsgesetzes: Fedlex führt «LPubb»; so umgesetzt.
- Auffälligkeiten der Quelle bleiben unverändert und stehen in der Info-Ansicht: VEV, deutsch, 15. Januar bis 10. Juni 2022
  (Art. 34e und 34f stehen in der Fedlex-Datei als Absätze von Art. 34d); AsylG, italienisch, 2021 bis 2023 (Kapitel 8 als
  Anhang ausgezeichnet).
- Redaktionelle Änderungen der Quelle ohne Änderungshinweis: AIG 73, VZAE 9, VEV 51, AsylG 9, einzeln in `data/VALIDATION.md`.

## 6 Screenshots

37 Bilder unter `test/app/out/shots/` (alle Ansichten DE bei 1440 px, je vier Ansichten FR und IT, dazu 1024 und 1920 px).

---

# Etappe 2: Verweisnetz und Verweisstruktur

Stand: 18. November 2026. `dist/sr-navigator.html`, 3,12 MB. Spezifikation: `SPEC.md` §12. Zahlen aus dem Schlusslauf
des Orchestrators.

## 1 Tests im Schlusslauf

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Kernlogik mit Verweis-Index, mit echtem Abruf gegen Fedlex | `node --test test/core/*.test.mjs` | 49 von 49 (vorher 26) |
| Unit-Tests der Oberfläche | `npm run test:app:unit` | 22 von 22 (vorher 14) |
| Browsertests über `file://` | `npx playwright test -c test/app/playwright.config.mjs` | 46 von 46 (vorher 37): Chrome 34, Firefox 6, Edge 6 |
| Verweis-Tests zusätzlich in Firefox und Edge | `npx playwright test -c test/app/playwright.refs-browsers.config.mjs` | 18 von 18 |
| Layoutprüfung: 29 Ansichten, 4 Breiten, 3 Sprachen | `test/app/layout.spec.mjs` | 348 Prüfungen, 0 Befunde |

## 2 Verweis-Index (`src/core/refs.js`)

Verweise werden aus dem Wortlaut erkannt (Fedlex zeichnet sie nicht aus). Zahlen je Erlass, heute geltender Stand, DE:

| Erlass | Verweise | Fundstellen | intern | andere SR-Erlasse (davon Bibliothek) | EU | unsicher |
|---|---|---|---|---|---|---|
| AIG | 1021 | 636 | 672 | 254 (96) | 91 | 4 |
| VZAE | 464 | 355 | 198 | 247 (161) | 13 | 6 |
| VEV | 424 | 364 | 89 | 85 (36) | 247 | 3 |
| AsylG | 588 | 406 | 396 | 149 (46) | 37 | 6 |
| EESV | 50 | 43 | 21 | 23 (10) | 6 | 0 |

Prüfungen des Agents (`data/VALIDATION_REFS.md`): Sprachgleichheit der Ziele je Block zwischen DE, FR und IT 92,2 bis
97,2 Prozent je Erlass, jede Abweichung einzeln aufgeführt (39 davon automatisch eingeordnet, nicht einzeln nachgelesen);
interne Ziele am Stand vorhanden 96,7 bis 100 Prozent, jedes fehlende erklärt; Gegenzählung «Artikel|Art. mit Zahl» zu
100 Prozent im Index.

## 3 Unabhängige Gegenprüfung des Orchestrators

Skript `check/check_verweise.py`: eigene, einfache Extraktion der Verweise zwischen Artikeln desselben Erlasses aus der
Fedlex-XML (DE), Vergleich mit dem Index auf Ebene Artikel zu Artikel.

| Erlass | Paare eigene Extraktion | gemeinsam mit Index | Befund |
|---|---|---|---|
| AIG | 331 | 323 | Abweichungen einzeln nachgelesen: Index richtig, Extraktion zu einfach |
| VZAE | 72 | 69 | wie AIG |
| AsylG | 184 | 176 | ein falscher interner Verweis gefunden und behoben (Art. 63 Abs. 1 Bst. b) |
| VEV | 156 | 38 | 46 falsche interne Verweise gefunden und behoben (Art. 12 Abs. 1); Rest: Artikel des Visakodex und der VIS-Verordnung, die die einfache Extraktion für intern hält |
| EESV | 8 | 8 | deckungsgleich |

Zwei Fehlerklassen hat die Gegenprüfung gefunden, die Sprachgleichheit nicht (alle drei Sprachen waren gleich falsch):
«Titel III (Art. 4–36) des Visakodex» und «Artikel 1 Buchstabe C Ziffern 1–6 der Flüchtlingskonvention». Eine allgemeine
Regel behebt sie; die anschliessende Nachsuche des Agents über alle Erlasse, Sprachen und zwei Stände hat 18 falsche
interne Fundstellen behoben und keine offen gelassen. Die Vorsichtsregel für Aufzählungen ist verfeinert (AIG DE:
unsicher 12 → 4).

## 4 Offen oder nicht geprüft

- Die Erkennung kann Fehler enthalten. Die Gegenprüfung deckt nur Deutsch und nur Verweise zwischen Artikeln ab.
  Verweise auf andere Erlasse und auf EU-Rechtsakte sind über Tests und Stichproben geprüft, nicht flächig gegengelesen.
- Unsichere Fundstellen erscheinen nicht als Kante. Beispiel: Art. 115 AsylG, Bst. b und d (der Einleitungssatz nennt
  das StGB als Ganzes).
- Links nach aussen: Die Fedlex-Adresse mit Anker und die EUR-Lex-Adresse über CELEX sind gebildet, nicht am Ziel geprüft.
  CELEX für Rechtsakte der früheren dritten Säule («Beschluss 94/795/JI») ist angenommen.
- Bögen der Verweisstruktur haben nur einen Hover-Tooltip; mit der Tastatur sind Spalten, Leiste und Tabelle erreichbar.
- Rechenzeit im Browser für das AIG: Index samt eingehender Verweise aus den vier übrigen Erlassen 0,2 bis 0,6 Sekunden
  beim ersten Öffnen, danach zwischengespeichert; Strukturmodell unter 20 Millisekunden.
- Safari ist nicht getestet.

---

# Etappe 3: Version und Hinweis auf eine neuere Version

Stand: 18. November 2026. Auftrag: Nutzende im Navigator auf eine neuere Version im Repository hinweisen, mit Download-Link
(SPEC §13). Umsetzung und Prüfung durch den Orchestrator, ohne Agents.

## 1 Tests im Schlusslauf

| Suite | Ergebnis |
|---|---|
| Kern (`test/core`) | 49 Tests, 48 bestanden, 1 übersprungen (Netz), 0 fehlgeschlagen |
| Unit Oberfläche (`test/app/unit.test.mjs`) | 26 bestanden (22 bisherige, 4 neue in `release.test.mjs`) |
| Playwright (`sr`, `layout`, `refs`, `release`) | 51 bestanden (46 bisherige, 5 neue); Projekte chrome, firefox, edge gemäss Konfiguration |
| Zusatzlauf Firefox und Edge (`playwright.refs-browsers.config.mjs`) | 28 bestanden (18 Verweise, 10 Versionshinweis) |
| Layoutprüfung | DE, FR, IT je 116 Prüfungen, 0 Befunde |

## 2 Was die neuen Tests belegen

- Eine frische Datei zeigt keinen Hinweis und löst beim Start keinen Netzwerkzugriff aus.
- Eine Datei mit Build-Datum 1. Juni 2026 zeigt den Hinweis mit Alter in Tagen, Version und Build-Datum.
- Der Download-Link endet auf `/releases/latest/download/sr-navigator.html`, öffnet in neuem Tab und trägt
  `rel="noopener noreferrer"`. Andere Adressen als `https://github.com/<besitzer>/<repo>/…` bildet der Navigator nicht.
- «Später erinnern» blendet den Hinweis aus. Nach dem Neuladen bleibt der Hinweis ausgeblendet.
- Der Hinweis erscheint in DE, FR und IT bei 1024, 1280, 1440 und 1920 px ohne abgeschnittenen oder überlappenden Text.
- Die Info-Ansicht nennt Version und Build-Datum und bietet beide Links.

## 3 Offen oder nicht geprüft

- Der Download-Link ist gebildet, nicht am Ziel geprüft: Im Repository gibt es am 18. November 2026 keine Release.
- Der Navigator erkennt nicht, ob tatsächlich eine neuere Version vorliegt. Der Hinweis erscheint auch, wenn die Datei die neueste ist.
- Ob GitHub aus dem Netz des SEM erreichbar ist, ist nicht geprüft.
- Safari ist nicht getestet.

---

# Etappe 4: Ablage und Veröffentlichung auf GitHub

Stand: 18. November 2026, Version 1.2.1. Auftrag: SR-Navigator im Repository `SEM-SGG/sgg-toolkit` ablegen und alles
anpassen, was die Ablage auf GitHub verlangt oder nahelegt (SPEC §14).

## 1 Tests im Schlusslauf

| Suite | Mit `raw/` | Ohne `raw/` (frischer Klon) |
|---|---|---|
| Kern (`npm run test:core`, `SR_NO_NET=1`) | 48 bestanden, 1 übersprungen | 41 bestanden, 8 übersprungen |
| Veröffentlichung (`npm run test:release`) | 6 bestanden | 6 bestanden |
| Unit Oberfläche (`npm run test:app:unit`) | 28 bestanden | 28 bestanden |
| Playwright, alle Projekte | 51 bestanden | nicht gefahren |
| Playwright, Projekt chrome | in den 51 enthalten | 34 bestanden, 5 übersprungen, 0 fehlgeschlagen |
| Zusatzlauf Firefox und Edge | 28 bestanden | nicht gefahren |
| Layoutprüfung | DE, FR, IT je 116 Prüfungen, 0 Befunde | nicht gefahren |

Der Ablauf des Workflows «SR-Navigator» ist in einem leeren Ordner nachgestellt: `npm ci`, `node scripts/release-info.mjs`,
Kern, Veröffentlichung, Unit, `npm run build`. Alle Schritte enden ohne Fehler.

## 2 Was die neuen Tests belegen

- `scripts/publish-release.sh` legt bei der ersten Veröffentlichung beide Releases an, die Release der Version als
  «Latest», die feste Release nicht.
- Ein zweiter Lauf mit derselben Version ruft weder `create` noch `delete` auf.
- Eine neue Version lässt die frühere Release bestehen und legt die feste Release neu an.
- Bricht der Lauf nach der ersten Release ab, holt der nächste Lauf die feste Release nach.
- Ohne Build, ohne Abschnitt in `CHANGELOG.md` oder mit einer Version ausserhalb der Form 1.2.3 bricht das Skript ab,
  bevor es `gh` aufruft.
- `package.json`, `CHANGELOG.md` und `release.config.json` passen zusammen, und die Download-Adresse enthält die feste Marke.

## 3 Offen oder nicht geprüft

- Die Workflows sind auf GitHub nicht gelaufen. Diese Session hat keinen Zugriff auf das Repository `SEM-SGG/sgg-toolkit`.
  Geprüft sind die YAML-Struktur, die Skripte hinter den Schritten und der Ablauf in einem leeren Ordner.
- Die Tests der Veröffentlichung nutzen eine Attrappe für `gh`. Das Verhalten von GitHub selbst (Marke löschen und neu
  anlegen, Markierung «Latest») ist damit nicht belegt.
- Der Download-Link ist gebildet, nicht am Ziel geprüft. Die Release `sr-navigator-aktuell` entsteht mit dem ersten Lauf
  des Workflows.
- Safari ist nicht getestet.

---

# Etappe 5: Öffentliches Repository und Versionsprüfung

Stand: 18. November 2026, Version 1.3.0. Auftrag: Der SR-Navigator folgt dem SGK-Navigator (SPEC §15): öffentliches
Repository `SEM-SGG/sr-navigator`, Versionsprüfung über die Projektseite, Download ohne GitHub-Konto. Die Aussagen der
Etappen 3 und 4 zur festen Marke `sr-navigator-aktuell`, zum Ordner im SGG Toolkit und zur Anmeldung bei GitHub gelten
nicht mehr.

## 1 Tests im Schlusslauf

| Suite | Mit `raw/` (Arbeitsverzeichnis) | Frischer Ordner ohne `raw/` | Auf GitHub (Workflow «CI») |
|---|---|---|---|
| Kern (`npm run test:core`, `SR_NO_NET=1`) | 48 bestanden, 1 übersprungen | 41 bestanden, 8 übersprungen | bestanden |
| Veröffentlichung (`npm run test:release`) | 5 bestanden | 5 bestanden | bestanden |
| Unit Oberfläche (`npm run test:app:unit`) | 33 bestanden | 33 bestanden | bestanden |
| Playwright, alle Projekte | 56 bestanden | nicht gefahren | nicht gefahren |
| Playwright, Projekt chrome (`NO_NET=1`) | in den 56 enthalten | 38 bestanden, 6 übersprungen | bestanden |
| Zusatzlauf Firefox und Edge (Verweise, Versionsprüfung) | 38 bestanden | nicht gefahren | nicht gefahren |
| Layoutprüfung | DE, FR, IT je 116 Prüfungen, 0 Befunde | nicht gefahren | nicht gefahren |

## 2 Was die neuen Tests belegen

- Eine aktuelle Datei stellt beim Start genau eine Anfrage, an die Versionsangabe, und zeigt keinen Hinweis.
- Nennt die Versionsangabe eine höhere Version, erscheint der Hinweis mit Version, Datum und Download-Link. «Später
  erinnern» bleibt nach dem Neuladen bestehen, und am selben Tag folgt keine zweite Anfrage.
- Eine ältere Version in der Versionsangabe ergibt keinen Hinweis. Eine Download-Adresse ausserhalb des Repositorys
  übernimmt der Navigator nicht.
- Nicht erreichbare, fehlerhafte oder ungültige Versionsangaben bleiben beim Start ohne Meldung. Die manuelle Suche
  meldet den Fehler und findet danach die neue Version.
- Mit abgeschalteter Prüfung stellt der Navigator beim Start keine Anfrage. Die manuelle Suche geht weiterhin.
- Eine Datei mit Build-Datum 1. Juni 2026 erinnert ohne erreichbare Versionsangabe nach ihrem Alter. Nach einer
  gelungenen Prüfung mit dem Ergebnis «aktuell» verschwindet der Hinweis.
- Der Build mit `--no-update-check` stellt keine Anfrage, zeigt keinen Schalter und nennt die Projektseite nicht in der CSP.
- Hinweis und Abschnitt «Version» erscheinen in DE, FR und IT bei 1024, 1280, 1440 und 1920 px ohne abgeschnittenen
  oder überlappenden Text.
- Kein Browsertest fragt die echte Projektseite ab: `test/app/pw.mjs` ersetzt die Versionsangabe durch eine Attrappe.

## 3 Geprüft auf GitHub

| Gegenstand | Ergebnis |
|---|---|
| Workflow «CI» nach dem ersten Hochladen | alle Schritte bestanden, einschliesslich Browsertests in Chrome |
| Workflow «Release», Teil Release | Release `v1.3.0` mit `sr-navigator.html` angelegt |
| Workflow «Release», Teil Projektseite | fehlgeschlagen im Schritt `actions/configure-pages`: GitHub Pages ist im Repository nicht eingeschaltet |
| Workflow «Fassungen», von Hand gestartet | bestanden, Issue #1 «Neue Fassungen auf Fedlex» eröffnet |
| Download `…/releases/latest/download/sr-navigator.html` | HTTP 200, Datei mit Version 1.3.0 |
| Heruntergeladene Datei im Browser | startet ohne Fehler; einzige Anfrage ist die Versionsangabe; diese fehlt noch, der Navigator bleibt still |

## 4 Offen oder nicht geprüft

- Erledigt: GitHub Pages ist im Repository eingeschaltet. Projektseite und Versionsangabe sind live.
- Erledigt: Der Hinweis ist am 18. November 2026 gegen die echte Versionsangabe geprüft. Die veröffentlichte Datei 1.3.0
  meldet «aktuell». Ein Testbuild 1.2.9 zeigt den Hinweis auf 1.3.0 mit dem Download-Link der Release.
- Erledigt mit Version 1.3.1: Die Fassungsprüfung meldete für die VZAE ersetzte Dateien der Fassung vom 1. Oktober 2026.
  Die Bibliothek ist nachgeführt (Abschnitt «Version 1.3.1: VZAE nachgeführt»).
- Für den Code ist keine Lizenz festgelegt.
- Safari ist nicht getestet.

# Version 1.3.1: VZAE nachgeführt

Stand: 18. November 2026. Fedlex hat die Dateien der VZAE-Fassung vom 1. Oktober 2026 in DE, FR und IT ersetzt
(`…-20261001-<lang>-xml-1.xml` statt `…-xml.xml`). Die übrigen 45 Dateien der VZAE und die vier anderen Erlasse sind
unverändert. `scripts/fetch-raw.mjs` lädt jetzt eine vorhandene Datei neu, wenn ihre Adresse bei Fedlex abweicht.

## 1 Was sich ändert

- DE und FR: Wortlaut und Fussnoten gleich. Die Dateien unterscheiden sich nur in der Generator-Angabe, in FR zusätzlich
  in Leerzeichen nach «Chapitre N» und «Section N» und in einem `<br/>` vor dem Titel von Kapitel 4 Abschnitt 5. Der
  Parser liefert für alte und neue Datei dieselben Einheiten, dieselbe Gliederung und dieselben Fussnoten.
- IT: 14 Textstellen anders, alle in Art. 83a Abs. 1 und Art. 87 Abs. 1bis Bst. g. Wortlaut neu «Stato Schengen» statt
  «Stato vincolato dagli Accordi di associazione alla normativa di Schengen» (Art. 83a Abs. 1). Die Fussnoten verweisen
  neu auf die V vom 6. Mai 2026 (AS 2026 239), in Kraft seit 12. Juni 2026.
- Die italienische Fedlex-Datei vom 12. Juni 2026 führt noch den alten Wortlaut. Die Chronologie zeigt die Änderung darum
  beim Stand vom 1. Oktober 2026, gekennzeichnet als **redaktionell**. DE und FR zeigen sie wie bisher beim 12. Juni 2026.
- Bibliothek: Änderungen nur im Werk `cc-2007-759`, nur im Stand 20261001. Neu sind zwei italienische Versionen
  (Art. 83a, Art. 87) und zwei Einträge in `acts[].changes`; dazu Datei-Adressen, Generator, PDF-Adresse IT und Datum.
  Verweis-Index: gleiche Zahlen, nur Zeichenpositionen in Art. 83a IT verschoben.

## 2 Prüfungen

| Prüfung | Vorher (1.3.0) | Nachher (1.3.1) |
|---|---|---|
| `check-fassungen.mjs` | VZAE: 20261001 DE, FR, IT ersetzt | alle fünf Erlasse «keine» |
| `validate.mjs`, VZAE | 100 % Wortlaut, 938 von 947 gedeckt, 9 redaktionell | 100 % Wortlaut, 939 von 949 gedeckt, 10 redaktionell |
| `validate-refs.mjs`, VZAE 20261001 | Refs DE / FR / IT 464 / 461 / 460, unsicher 6 / 10 / 11 | gleiche Zahlen; Bericht unterscheidet sich nur in Laufzeiten |
| `check/check_wortlaut.py`, VZAE | 0 Abweichungen | 0 Abweichungen |
| `check/check_aenderungen.py`, VZAE | 113 von 113 übereinstimmend | 114 von 114 übereinstimmend |
| `check/check_verweise.py`, VZAE DE 20261001 | 8 von 152 Artikeln abweichend | unverändert 8 von 152 |

## 3 Tests

| Suite | Vorher (1.3.0) | Nachher (1.3.1) |
|---|---|---|
| Kern (`SR_NO_NET=1`) | 48 bestanden, 1 übersprungen | 50 bestanden, 1 übersprungen (2 neue Tests für `fetch-raw.mjs`) |
| Veröffentlichung | 5 bestanden | 5 bestanden |
| Unit Oberfläche | 33 bestanden | 33 bestanden |
| Playwright, alle Projekte | 55 bestanden, 1 fehlgeschlagen (Edge, «Abnahme d»; einzeln dreimal bestanden) | 56 bestanden |
| Zusatzlauf Firefox und Edge | 38 bestanden | 38 bestanden |
| Layoutprüfung | DE, FR, IT je 116 Prüfungen, 0 Befunde | DE, FR, IT je 116 Prüfungen, 0 Befunde |

Keine Erwartung in einem Test angepasst. Die Browsertests prüfen «Aktualisieren» nur für die EESV. Für die VZAE meldet
`checkUpdates` mit den Antworten aus `raw/` nachher keine neue Fassung und keine ersetzte Datei; vorher meldete es
20261001 DE, FR und IT.

# Gehostete Fassung unter app/

Stand: 23. November 2026, Version 1.4.0. Auftrag: Dieselbe Datei liegt zusätzlich auf der Projektseite unter
`app/` (`https://sem-sgg.github.io/sr-navigator/app/`) und lässt sich über einen Link öffnen. Es bleibt bei einem Build.
Die Datei erkennt zur Laufzeit an `location.href`, ob sie unter `siteUrl` liegt, und passt nur den Versionshinweis an.
Die Projektseite nennt «Im Browser öffnen» (`app/`) als ersten Weg.

## 1 Tests

| Suite | Vorher | Nachher |
|---|---|---|
| Kern (`npm run test:core`, `SR_NO_NET=1`, ohne `raw/`) | 43 bestanden, 8 übersprungen | 43 bestanden, 8 übersprungen |
| Veröffentlichung (`npm run test:release`) | 5 bestanden | 5 bestanden |
| Unit Oberfläche (`npm run test:app:unit`) | 33 bestanden | 37 bestanden (4 neue in `release.test.mjs`) |
| Playwright, Projekt chrome (`NO_NET=1`, ohne `raw/`), vor der Korrektur in `src/app/state.js` (siehe 3) | 36 bestanden, 2 fehlgeschlagen, 6 übersprungen | 39 bestanden, 3 fehlgeschlagen, 6 übersprungen (4 neue Tests) |
| `release.spec.mjs`, je Test dreimal (`--repeat-each=3`) | ohne Korrektur: 34 bestanden, 8 fehlgeschlagen | mit Korrektur: 42 bestanden |
| Kern mit `raw/` und Netz (`npm run test:core`), Endstand | nicht gefahren | 51 bestanden, 0 übersprungen |
| Playwright, Projekt chrome (`NO_NET=1`, mit `raw/`), Endstand mit Korrektur, zwei Läufe | nicht gefahren | je 47 bestanden, 1 übersprungen |

Keine Erwartung in einem bestehenden Test angepasst. `npm run site` legt `dist/site/app/index.html` an; die Datei ist
bytegleich zu `dist/sr-navigator.html` (`cmp`).

## 2 Was die neuen Tests belegen

- `releaseInfo` meldet `hosted` nur für `https:`-Adressen unter `siteUrl`. Nicht gehostet sind `…/sr-navigator-x/`,
  `…/sr-navigator` ohne Schrägstrich, fremde Hosts, `http:`, `file:` und eine ungültige oder fehlende `siteUrl`.
- Gehostet erscheint der Hinweis auf eine neuere Version wie bisher, der Hinweis nach Alter nie. «Später erinnern»
  wirkt gleich wie über `file://`.
- `scripts/build-site.mjs` kopiert `dist/<asset>` Byte für Byte nach `app/index.html`. Ohne Datei entsteht die Seite
  ohne `app/`; mit `--require-app` bricht das Skript mit Meldung ab und schreibt nichts.
- Im Browser unter `<siteUrl>app/` (ausgeliefert über `context.route`, ohne Netz): Start ohne Konsolenfehler und ohne
  Verstoss gegen die CSP. Anfragen nur an die Seite und an die Versionsangabe (dazu `favicon.ico` des Browsers, beantwortet mit 404). Die Ansicht Info nennt den Host,
  meldet «Diese Seite zeigt die aktuelle Version» und spricht nicht von «Datei»; der Link «Datei für die Nutzung ohne
  Netz herunterladen» zeigt auf den Download der Release. Der abgeschaltete Schalter der Versionsprüfung übersteht das
  Neuladen (IndexedDB unter dem https-Ursprung). FR und IT ohne fehlende Texte.
- Eine alte Datei (Build-Datum 1. Juni 2026) zeigt gehostet ohne erreichbare Versionsangabe keinen Hinweis.
- Bei neuerer Version zeigt der Hinweis «Seite neu laden», ohne Untertext zum Ersetzen der Datei. Der Klick lädt die
  Seite neu; am selben Tag folgt keine zweite Prüfung. «Später erinnern» übersteht das Neuladen. In der Info steht
  «Seite neu laden» statt Download. Hinweis in DE, FR und IT bei 1024 px ohne Überlauf.

## 3 Wackelnde Tests: Ursache in `src/app/state.js`, behoben

Die Fehlschläge in Abschnitt 1 betrafen Tests, die auf den Hinweis oder auf den Wechsel nach `#/info` kurz nach dem
Start warten, bestehende wie neue. Sie traten schon vor dieser Änderung auf (Lauf «Vorher»). Ursache: `createStore().use()`
las den Wert beim Rendern und meldete sich erst im `useEffect` als Empfänger an. Setzte die Versionsprüfung den Wert
dazwischen, verpasste die Komponente die Änderung, und der Hinweis erschien erst beim nächsten Rendern. In der
Datenbank stand das Ergebnis der Prüfung trotzdem richtig. Korrektur: `useRoute` und `createStore().use()` gleichen den
Wert im `useEffect` nach der Anmeldung ab. Die Läufe im Endstand (Abschnitt 1) sind ohne Fehlschlag.

Die lokalen Läufe nutzen Chrome auf macOS über eine eigene Konfiguration unter `test/app/out/`. Firefox und Edge sind
für diese Änderung nicht gefahren.
