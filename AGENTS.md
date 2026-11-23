# Arbeitsanleitung für Agenten

Diese Datei gilt für Codex, Claude Code und andere Agenten, die im Repository `SEM-SGG/sr-navigator` arbeiten.

Der SR-Navigator zeigt Änderungen an Erlassen der Systematischen Rechtssammlung je Bestimmung. Er ist eine einzelne HTML-Datei, die auch über einen Link auf GitHub Pages läuft. Nutzende und Pflegende sind Fachpersonen der Sektion Grundlagen Grenze (SGG) im Staatssekretariat für Migration (SEM). Sie arbeiten nur im Browser, ohne Kommandozeile und ohne lokale Installation. Sie geben dir einen der Aufträge aus dem Abschnitt «Abläufe» und prüfen danach deinen Pull Request. Schreibe deshalb jede Beschreibung so, dass eine Person ohne GitHub-Erfahrung sie versteht.

Weitere Quellen: [`README.md`](README.md) (Aufbau, Befehle, Netzzugriff, Datenregel), [`MAINTAINING.md`](MAINTAINING.md) (Weg der Fachperson im Browser), [`SPEC.md`](SPEC.md) (Entscheide), [`CHANGELOG.md`](CHANGELOG.md), [`docs/ABFRAGEN.md`](docs/ABFRAGEN.md) (Abfragen an Fedlex).

## Grundregeln

- **Sprache:** Schweizer Hochdeutsch ohne «ß», mit echten Umlauten, in Code-Kommentaren, Commits, Pull Requests und Dokumentation. Die Oberfläche gibt es in Deutsch, Französisch und Italienisch: Jeder Text in `src/app/i18n/de.js` hat dieselben Schlüssel und Platzhalter in `fr.js` und `it.js` (ein Test prüft das). Projektseite und Produktdokumentation sind ebenfalls dreisprachig.
- **Zweig:** Lege jeden Zweig ab `origin/main` an (`git fetch origin` und `git switch -c <zweig> origin/main`). Prüfe vorher mit `git status`, dass nichts Fremdes im Arbeitsbereich liegt.
- **Pull Request:** Eröffne einen Pull Request gegen `main`. Pushe nie direkt auf `main`, nutze nie `--force`, führe nie selbst zusammen. Eröffne keinen Pull Request auf einem anderen Pull Request; die Basis ist immer `main`.
- **Zweig des Workflows:** Den Zweig `fassungen/einbau` schreibt der Workflow «Fassungen» und überschreibt ihn bei jedem Lauf. Pushe nicht darauf.
- **Keine Personendaten:** keine Personennamen, keine privaten E-Mail-Adressen, keine lokalen Pfade in Dateien, Commits oder Pull Requests. Die Funktionsadresse `sektion-grenze@sem.admin.ch` ist erlaubt.
- **Auftrag:** Ändere nur, was der Auftrag verlangt. Was dir sonst auffällt, nennst du im Pull Request unter «Von der prüfenden Person zu kontrollieren» oder als offene Frage.
- **Wortlaut von Erlassen:** Er stammt ausschliesslich von Fedlex, geladen über die Skripte (`scripts/fetch-raw.mjs`, `scripts/fetch-meta.mjs`, `scripts/build-data.mjs`, `scripts/apply-fassungen.mjs`). Bearbeite `data/library.json`, `raw/` und Wortlaut nie von Hand. Schwäche keine Prüfung ab, damit sie besteht.
- **Datenregel:** Issues und Pull Requests sind öffentlich. Übernimm keine Inhalte mit dem Vermerk INTERN, VERTRAULICH oder GEHEIM, keine besonders schützenswerten Personendaten und keine Falldaten aus Verfahren in Dateien, Commits oder Pull Requests (README, Abschnitt «Datenregel»). Enthält ein Issue solche Inhalte, zitiere sie nicht und weise im Pull Request darauf hin.
- **Netzzugriff des Navigators:** Der Navigator ruft nur `fedlex.data.admin.ch` und die Versionsangabe auf `sem-sgg.github.io` ab; die Content-Security-Policy in `build.mjs` lässt nichts anderes zu. Füge keine Abrufe hinzu. Ein Link, den die Person anklickt, ist kein Abruf und ist erlaubt.
- **Produktdokumentation:** Jede Änderung an Funktion, Oberfläche oder Bedienweg zieht die Produktdokumentation `docs/sr-navigator-dokumentation.html` in allen drei Sprachen nach, dazu je nach Änderung die Anleitung im Werkzeug (`guide.*` in `src/app/i18n/`), `README.md`, die Projektseite (`site/index.template.html`) und `MAINTAINING.md`. Die Dokumentation erscheint auf der Projektseite unter `https://sem-sgg.github.io/sr-navigator/dokumentation.html`.
- **Version und Changelog:** Ein Merge auf `main` mit höherer Version in `package.json` veröffentlicht automatisch eine Release und die Projektseite (Workflow «Release»). Erhöhe die Version, sobald sich der Navigator, die Projektseite oder die eingebetteten Daten ändern:

  | Änderung | Stufe | Beispiel |
  | --- | --- | --- |
  | Korrektur, neue Fassung eines eingebetteten Erlasses, Text der Oberfläche | Patch | `1.4.1` wird `1.4.2` |
  | Neue Funktion oder neuer eingebetteter Erlass | Minor | `1.4.1` wird `1.5.0` |
  | Umbau, nach dem alte Projektdateien nicht mehr laden | Major | `1.4.1` wird `2.0.0` |

  So erhöhst du sie an allen Stellen:

  ```
  npm version <neue-version> --no-git-tag-version
  node scripts/check-dokumentation.mjs --fix
  ```

  Füge danach zuoberst in `CHANGELOG.md` einen Abschnitt `## <version> (<Tag>. <Monat> <Jahr>)` ein, zum Beispiel `## 1.4.2 (2. Dezember 2026)`, mit je einer Zeile `- ` pro Änderung, verständlich für Nutzende. Der Abschnitt wird zum Text der Release. Lautet der Auftrag, in einem bestehenden Pull Request die Version in der Produktdokumentation nachzusetzen (`MAINTAINING.md`, «Neue Version veröffentlichen», Schritt 7), führst du auf dessen Zweig `node scripts/check-dokumentation.mjs --fix` aus, committest und pushst ohne `--force`. Änderungen nur an `MAINTAINING.md`, `AGENTS.md`, Tests oder Workflows brauchen keine neue Version. Eine Änderung an `docs/sr-navigator-dokumentation.html` oder `site/` ohne neue Version stellt die Projektseite nach dem Merge neu bereit.

## Prüfbefehle

Diese Befehle laufen vor jedem Pull Request, in dieser Reihenfolge, im Wurzelverzeichnis. Sie entsprechen dem Workflow «CI» (`.github/workflows/ci.yml`). Vorausgesetzt ist Node.js 22.

| Befehl | Erwartetes Ergebnis |
| --- | --- |
| `npm ci` | endet ohne Fehler |
| `node scripts/release-info.mjs` | `Version <x>: Abschnitt in CHANGELOG.md vorhanden, Datei sr-navigator.html.` |
| `node scripts/check-dokumentation.mjs` | `docs/sr-navigator-dokumentation.html: Version <x> an allen 11 Stellen.` |
| `SR_NO_NET=1 npm run test:core` | `fail 0`; ohne Ordner `raw/` acht übersprungen |
| `npm run test:release` | `fail 0`, `skipped 0` |
| `npm run test:app:unit` | `fail 0`, `skipped 0` |
| `npm run build` | `dist/sr-navigator.html: … MB \| Daten: data/library.json (…) \| Kern: src/core`, ohne `WARNUNG` |
| `npm run site` | `dist/site: index.html, version.json, dokumentation.html (…), app/index.html (…)` |
| `NO_NET=1 npx playwright test -c test/app/playwright.config.mjs --project=chrome` | `0 failed`; ohne Ordner `raw/` sechs übersprungen |

Die Browsertests erwarten Google Chrome unter `/usr/bin/google-chrome`. Fehlt Chrome in deiner Umgebung, schreibe das im Pull Request unter «Testing»; der Lauf «CI» führt sie aus.

Wenn du Daten oder Code in `src/core/` änderst, lädst du zusätzlich die Rohdaten (rund 110 MB, Befehle im README, Abschnitt «Lokal bauen und testen») und führst `npm run test:core` ohne `SR_NO_NET` aus. Erwartet: `fail 0`, `skipped 0`. Ist `fedlex.data.admin.ch` aus deiner Umgebung nicht erreichbar, schreibe das im Pull Request.

Nach dem Eröffnen wartest du den Lauf «CI / Tests and build» im Pull Request ab und behebst, was rot ist.

## Abläufe

Jeder Ablauf beginnt mit dem Auftrag, den eine Fachperson kopiert und dir gibt. Dabei ersetzt sie `…` durch die Nummer des Pull Requests, die Nummer des Issues oder die SR-Nummer.

### Gescheiterter Einbau neuer Fassungen

```
Der Einbau der neuen Fassungen ist gescheitert. Pull Request #… im Repository SEM-SGG/sr-navigator ist ein Entwurf: Bring ihn in Ordnung. Halte dich an AGENTS.md, Ablauf «Gescheiterter Einbau neuer Fassungen».
```

Hintergrund: Der Workflow «Fassungen» (`.github/workflows/fassungen.yml`) prüft jeden Montag Fedlex, eröffnet das Issue «Neue Fassungen auf Fedlex», baut mit `scripts/apply-fassungen.mjs` ein und eröffnet mit `scripts/fassungen-pr.mjs` einen Pull Request auf dem Zweig `fassungen/einbau`. Scheitert der Einbau, eine Prüfung oder ein Test, ist der Pull Request ein Entwurf mit dem Vermerk «Nicht zusammenführen».

1. Lies den Entwurf: die Gründe im Kasten am Anfang, dann «Befund», «Prüfberichte», «Übrige Erlasse und Stände» und «Tests». Lies den roten Lauf «Fassungen» (`gh run list --workflow fassungen.yml`, `gh run view <lauf> --log-failed`) und, falls vorhanden, das Artefakt «einbau» des Laufs mit `einbau.json`, `tests.json` und `pr.md`.
2. Liegt die Ursache bei Fedlex oder im Netz (zum Beispiel `fetch failed`, `SPARQL 503`, Zeitüberschreitung), änderst du nichts. Antworte der Fachperson, dass sie den Workflow unter **Actions** über **Run workflow** neu startet (`MAINTAINING.md`, Abschnitt «Wenn der Pull Request ein Entwurf ist», Schritt 3).
3. Sonst legst du einen Zweig ab `origin/main` an, zum Beispiel `agent/fassungen-2026-12-07`.
4. Führe `npm ci` und `node scripts/apply-fassungen.mjs --out <ordner>` aus. Das Skript lädt die Rohdaten aller eingebetteten Erlasse von Fedlex, baut die Bibliothek, erzeugt die Prüfberichte, erhöht die Version um eine Patch-Stufe (`package.json`, `package-lock.json`, Produktdokumentation) und ergänzt `CHANGELOG.md`. Das Ergebnis steht in `<ordner>/einbau.json`.
5. Scheitert ein Schritt, eine Prüfung (`validation.passed` ist `false`) oder meldet `foreign` eine inhaltliche Änderung an einem nicht betroffenen Erlass, suche die Ursache im Code: Parser `src/core/parser.js`, Datenmodell `src/core/model.js`, Abruf `src/core/fedlex.js`, Prüfskripte `scripts/validate.mjs` und `scripts/validate-refs.mjs`. Behebe sie dort und belege die Korrektur mit einem Test in `test/core/` oder `test/release/`. Setze vor einem zweiten Lauf `package.json`, `package-lock.json`, `CHANGELOG.md`, `docs/sr-navigator-dokumentation.html` und `data/` auf den Stand von `origin/main` zurück (`git checkout origin/main -- <dateien>`), sonst steigt die Version zweimal.
6. Lies `data/VALIDATION.md` und `data/VALIDATION_REFS.md`. Die Kriterien für «bestanden» stehen in `MAINTAINING.md`, Abschnitt «Pull Request prüfen und zusammenführen». Jeder Hinweis braucht dort eine Begründung.
7. Führe die Prüfbefehle aus, dazu `npm run test:core` mit Rohdaten und ohne `SR_NO_NET`.
8. Committe die Dateien aus `COMMIT_FILES` in `scripts/fassungen-pr.mjs`, dazu deine Korrekturen und Tests. `raw/` ist von Git ausgeschlossen.
9. Eröffne den Pull Request gegen `main`. Titel wie der Workflow, zum Beispiel «SR-Navigator 1.4.2: VZAE-Fassung vom 1. Januar 2027 nachgeführt» (Feld `subject` in `einbau.json`). In der Beschreibung nennt «Ausgangslage» den Entwurf und den Grund, «Von der prüfenden Person zu kontrollieren» übernimmt die Tabelle «Befund» und die Prüfberichte aus `pr.md` und den Text im Changelog. Schreibe dazu: «Nach dem Zusammenführen den Entwurf #… mit **Close pull request** schliessen.» Schliesse mit `Closes #<nummer>` für das Issue «Neue Fassungen auf Fedlex» (die Nummer steht am Ende des Entwurfs).

### Erlass fest einbetten

```
Bette den Erlass SR … fest in den SR-Navigator ein. Halte dich an AGENTS.md, Ablauf «Erlass fest einbetten».
```

Fest eingebettet heisst: Der Erlass ist in der Datei enthalten, ohne dass Nutzende ihn von Fedlex laden. Die Liste steht in `EMBEDDED` in `scripts/build-data.mjs`.

1. Bestimme das Werk auf Fedlex: Die Adresse hat die Form `https://www.fedlex.admin.ch/eli/cc/<jahr>/<nummer>/de`, die ID im Repository die Form `cc-<jahr>-<nummer>`. Die Suche nach SR-Nummer steht in `docs/ABFRAGEN.md`. Prüfe, dass Fedlex Fassungen mit Text im Format XML in Deutsch, Französisch und Italienisch führt. Ist das nicht so, brich ab und nenne den Grund.
2. Lege einen Zweig ab `origin/main` an.
3. Ergänze die ID in `EMBEDDED` in `scripts/build-data.mjs`. Die Reihenfolge der Liste ist die Reihenfolge in der Bibliothek.
4. Lade die Rohdaten aller eingebetteten Erlasse, auch des neuen: `node scripts/fetch-raw.mjs cc/<jahr>/<nummer> …` und `node scripts/fetch-meta.mjs cc-<jahr>-<nummer> …`. `fetch-meta.mjs` meldet «abweichende Datei-URLs: 0».
5. Baue und prüfe: `node scripts/build-data.mjs`, `node scripts/validate.mjs`, `node scripts/validate-refs.mjs`. Lies `data/VALIDATION.md` und `data/VALIDATION_REFS.md` mit den Kriterien aus `MAINTAINING.md`. `npm run build` warnt, wenn die Datei grösser als 8 MB wird; nenne die neue Grösse im Pull Request.
6. Führe alle Stellen nach, die die eingebetteten Erlasse aufzählen oder zählen: `README.md` («Funktionen» und Befehle für die Rohdaten), `site/index.template.html` (DE, FR, IT), `guide.zweck` in `src/app/i18n/de.js`, `fr.js` und `it.js`, `docs/sr-navigator-dokumentation.html` (Liste, «fünf», Kennzahlen, DE, FR, IT) und `MAINTAINING.md`. Suche mit `grep -rn "EESV" --exclude-dir=node_modules --exclude-dir=raw .`. Passe Tests an, die die Liste oder die Zahl der eingebetteten Erlasse prüfen.
7. Erhöhe die Version um eine Minor-Stufe und ergänze `CHANGELOG.md` (Abschnitt «Grundregeln»).
8. Führe die Prüfbefehle aus, dazu `npm run test:core` mit Rohdaten und ohne `SR_NO_NET`.
9. Eröffne den Pull Request. Unter «Von der prüfenden Person zu kontrollieren» nennst du Erlass, SR-Nummer, Zahl der Fassungen mit Wortlaut, Ergebnis der Prüfberichte und die neue Dateigrösse. Der Workflow «Fassungen» prüft den Erlass ab dem nächsten Montag mit.

### Fehler aus einem Issue beheben

```
Behebe den Fehler aus Issue #… im Repository SEM-SGG/sr-navigator. Halte dich an AGENTS.md, Ablauf «Fehler aus einem Issue beheben».
```

1. Lies das Issue mit allen Kommentaren (`gh issue view <nummer> --comments`). Beachte die Datenregel: Enthält das Issue klassifizierte Inhalte oder Personendaten, zitiere sie nicht und weise im Pull Request darauf hin.
2. Lege einen Zweig ab `origin/main` an.
3. Stelle den Fehler nach: Version, Browser, Erlass, Bestimmung und Fassung stehen im Issue. Baue mit `npm run build` und öffne `dist/sr-navigator.html` mit der Adresse aus dem Issue (der Teil ab `#/`).
4. Betrifft der Fehler den Wortlaut, vergleiche mit der XML-Datei von Fedlex. Steht der Fehler schon bei Fedlex, änderst du keinen Wortlaut; erkläre das im Pull Request oder in deiner Antwort an die Fachperson.
5. Schreibe zuerst einen Test, der den Fehler zeigt: `test/core/` für Parser, Modell und Abruf, `test/app/unit.test.mjs` für reine Funktionen der Oberfläche, `test/app/*.spec.mjs` für das Verhalten im Browser. Behebe dann den Fehler.
6. Ändert sich ein Text der Oberfläche, änderst du ihn in Deutsch, Französisch und Italienisch. Ändert sich ein Bedienweg, ziehst du die Produktdokumentation und die Anleitung nach.
7. Erhöhe die Version um eine Patch-Stufe und ergänze `CHANGELOG.md`.
8. Führe die Prüfbefehle aus und eröffne den Pull Request mit `Closes #<nummer>`.

### Pull Requests von Dependabot

Das Repository erhält keine Pull Requests von Dependabot: Es gibt keine `.github/dependabot.yml`, und die automatischen Sicherheitsupdates sind ausgeschaltet. Richte Dependabot nicht ein. Meldet GitHub eine Sicherheitslücke in einer Abhängigkeit, behandelt die Fachperson sie mit dem Auftrag «Behebe den Fehler aus Issue #…», nachdem sie dazu ein Issue eröffnet hat.

## Beschreibung des Pull Requests

Die prüfende Person ist eine Fachperson ohne GitHub-Erfahrung. Sie liest die Beschreibung im Browser und entscheidet danach über das Zusammenführen. Die Vorlage `.github/pull_request_template.md` gibt die Abschnitte vor:

1. **Ausgangslage:** Welches Problem gab es, für wen, und wer hat den Auftrag gegeben (Issue, Entwurf)? Ohne Fachjargon.
2. **Änderungen:** Was sich für Nutzende und für die pflegende Person ändert, in ganzen Sätzen. Nenne Dateinamen nur, wo sie beim Prüfen helfen.
3. **Von der prüfenden Person zu kontrollieren:** Was die Person im Browser ansehen oder entscheiden soll, als nummerierte Schritte mit den Namen der Knöpfe, zum Beispiel «Öffne **Files changed** und lies `CHANGELOG.md`». Nenne ausserdem, was nach dem Zusammenführen geschieht (zum Beispiel neue Release, Aktualisierung der Projektseite).
4. **Testing:** Welche Prüfbefehle mit welchem Ergebnis gelaufen sind und was du nicht prüfen konntest (zum Beispiel Firefox und Edge, die Projektseite auf GitHub Pages).
5. **Risiko:** Was schlimmstenfalls passiert und woran die Person es merkt.
6. **Rückgängig machen:** Wie sich die Änderung zurücknehmen lässt, meist: den zusammengeführten Pull Request auf GitHub über **Revert** rückgängig machen und danach eine neue Version veröffentlichen.

Am Ende steht genau eine dieser Zeilen:

- `Produktdokumentation: nachgeführt`
- `Produktdokumentation: nicht betroffen, weil …` (mit Grund, zum Beispiel «nur Tests geändert»)
