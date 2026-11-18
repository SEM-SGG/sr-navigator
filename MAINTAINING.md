# Pflegeanleitung

Diese Anleitung richtet sich an die Person, die den SR-Navigator pflegt. Die ersten drei Abschnitte verlangen nur einen Browser und ein GitHub-Konto mit Schreibrecht im Repository.

## Neue Version veröffentlichen

GitHub testet, baut und veröffentlicht den Navigator. Du änderst zwei Dateien.

1. Öffne im Repository die Datei `package.json` und klicke auf den Stift.
2. Erhöhe die Zahl bei `"version"`, zum Beispiel von `1.3.0` auf `1.3.1`.
3. Wähle **Commit changes**, dann **Create a new branch** und **Propose changes**.
4. Öffne im selben Zweig die Datei `CHANGELOG.md` und klicke auf den Stift.
5. Füge zuoberst einen Abschnitt mit der neuen Version ein. Die Überschrift hat die Form `## 1.3.1 (2. Dezember 2026)`. Darunter steht je Änderung eine Zeile mit `- `. Der Abschnitt wird zum Text der Release.
6. Speichere mit **Commit changes** im selben Zweig.
7. Eröffne den Pull Request. Der Workflow «CI» prüft die Änderung.
8. Führe den Pull Request zusammen, sobald der Lauf grün ist.

Der Workflow «Release» legt danach die Release `v1.3.1` an und aktualisiert die Projektseite. Ab dann zeigen alle Navigatoren mit älterer Version den Hinweis auf die neue Datei.

Welche Zahl du erhöhst:

| Änderung | Beispiel |
| --- | --- |
| Korrektur oder neue Fassung eines eingebetteten Erlasses | `1.3.0` wird `1.3.1` |
| Neue Funktion oder neuer eingebetteter Erlass | `1.3.0` wird `1.4.0` |
| Umbau, nach dem alte Projektdateien nicht mehr laden | `1.3.0` wird `2.0.0` |

## Prüfen, ob die Veröffentlichung geklappt hat

1. Öffne im Repository **Actions**. Der Lauf «Release» ist grün.
2. Öffne **Releases**. Die neue Version steht zuoberst und trägt die Datei `sr-navigator.html`.
3. Öffne die [Projektseite](https://sem-sgg.github.io/sr-navigator/). Sie nennt die neue Version.

## Wenn ein Lauf rot ist

1. Öffne unter **Actions** den roten Lauf und darin den roten Schritt. Die letzten Zeilen nennen den Fehler.
2. Häufige Ursachen:

| Meldung | Ursache | Behebung |
| --- | --- | --- |
| `CHANGELOG.md: Abschnitt … fehlt` | Zur Version in `package.json` gibt es keinen Abschnitt | Abschnitt ergänzen, Überschrift genau in der Form `## 1.3.1 (Datum)` |
| `Version … hat nicht die Form 1.2.3` | Tippfehler in `package.json` | Version berichtigen |
| Fehler im Schritt «Deploy to GitHub Pages» | Projektseite ist nicht eingerichtet | Abschnitt «Einmalige Einrichtung» |
| Ein Test schlägt fehl | Die Änderung hat ein Verhalten verändert | Änderung zurücknehmen oder berichtigen |

3. Starte einen abgebrochenen Lauf «Release» unter **Actions** über **Run workflow** neu. Er holt nach, was fehlt, und legt nichts doppelt an.

## Neue Fassung einbauen

Der Workflow «Fassungen» fragt Fedlex jeden Montag ab. Findet er eine neue Fassung oder eine ersetzte Datei eines eingebetteten Erlasses, eröffnet er das Issue «Neue Fassungen auf Fedlex».

Nutzende können neue Fassungen im Navigator selbst über **Aktualisieren** laden. Der feste Einbau erspart ihnen diesen Schritt. Er verlangt Node.js auf deinem Gerät.

1. Klone das Repository und führe `npm ci` aus.
2. Lade die Rohdaten des Erlasses, hier am Beispiel der VZAE:

   ```
   node scripts/fetch-raw.mjs cc/2007/759
   node scripts/fetch-meta.mjs cc-2007-759
   ```

   Für den vollen Testlauf brauchst du die Rohdaten aller fünf Erlasse. Die Befehle stehen im README.

   Meldet das Issue eine ersetzte Datei, führt Fedlex für einen bekannten Stand eine neue Datei-Adresse, zum Beispiel `…-20261001-it-xml-1.xml` statt `…-20261001-it-xml.xml`. `fetch-raw.mjs` vergleicht dazu jede Adresse bei Fedlex mit der Adresse in `raw/<werk>/versions.json`. Es lädt nur Dateien neu, deren Adresse abweicht, und meldet sie mit alter und neuer Adresse und Grösse, zum Beispiel `ersetzt 20261001_it.xml: …-xml.xml (348694 Bytes) -> …-xml-1.xml (348377 Bytes)`. Die übrigen Dateien bleiben liegen. Fehlt `versions.json`, lädt das Skript nur fehlende Dateien und nennt die übrigen unter «ohne Vergleich».

   - Sichere die betroffenen Dateien vor dem Lauf, wenn du alten und neuen Text vergleichen willst. Das Skript überschreibt sie.
   - `fetch-meta.mjs` meldet danach «abweichende Datei-URLs: 0». Eine andere Zahl heisst: Die Rohdaten passen nicht zu den Metadaten. Führe dann beide Befehle erneut aus.
3. Baue die Bibliothek: `node scripts/build-data.mjs`. Nach einer ersetzten Datei vergleichst du die neue `data/library.json` mit der Fassung im Repository (`git show HEAD:data/library.json`). Ändern dürfen sich nur das betroffene Werk und der betroffene Stand, dazu Datumsangaben, Datei-Adressen und die Angabe `generator` des Stands.
4. Erzeuge die Prüfberichte: `node scripts/validate.mjs` und `node scripts/validate-refs.mjs`. Lies `data/VALIDATION.md` und `data/VALIDATION_REFS.md`.
5. Führe `npm run test:core` und `npm run test:app` aus.
6. Erhöhe die Version, ergänze `CHANGELOG.md` und eröffne einen Pull Request.
7. Schliesse das Issue nach der Release.

GitHub schaltet zeitgesteuerte Workflows ab, wenn im Repository 60 Tage lang nichts geschieht. Schalte den Workflow «Fassungen» dann unter **Actions** wieder ein.

## Einstellungen

Die Datei `release.config.json` steuert Adressen und Versionsprüfung. Nach einer Änderung braucht es eine neue Version.

| Feld | Bedeutung |
| --- | --- |
| `repoUrl` | Adresse des Repositorys, Form `https://github.com/<besitzer>/<repo>` |
| `asset` | Dateiname in der Release |
| `siteUrl` | Adresse der Projektseite, Form `https://<besitzer>.github.io/<repo>/` |
| `manifest` | Name der Versionsangabe auf der Projektseite |
| `checkEveryHours` | Abstand zwischen zwei Suchen beim Start, in Stunden |
| `snoozeDays` | Tage, um die «Später erinnern» den Hinweis zurückstellt |
| `remindAfterDays` | Alter der Datei in Tagen, ab dem der Navigator ohne erreichbare Versionsangabe erinnert |

Bereits verteilte Dateien behalten die alten Adressen. Nach einer Übertragung des Repositorys leitet GitHub die Adressen unter `github.com` weiter, die Projektseite unter `github.io` nicht. Ältere Navigatoren erinnern dann nach dem Alter der Datei, und ihr Download-Link funktioniert weiter.

## Einmalige Einrichtung

1. Öffne im Repository **Settings**, dann **Pages**.
2. Wähle unter **Build and deployment** bei **Source** den Eintrag **GitHub Actions**.
3. Starte unter **Actions** den Workflow «Release» über **Run workflow**.
