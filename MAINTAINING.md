# Pflegeanleitung

Diese Anleitung richtet sich an die Person, die den SR-Navigator pflegt. Ausser dem «Einbau von Hand» verlangt sie nur einen Browser und ein GitHub-Konto mit Schreibrecht im Repository.

Was Programmcode oder Node.js verlangt, erledigt ein Agent (ein KI-Werkzeug wie Claude Code im Browser oder Codex mit angebundenem Repository). Du kopierst einen der Aufträge aus [`AGENTS.md`](AGENTS.md), Abschnitt «Abläufe», gibst ihn dem Agenten und prüfst danach seinen Pull Request (Änderungsvorschlag auf GitHub).

## Neue Version veröffentlichen

GitHub testet, baut und veröffentlicht den Navigator. Du änderst zwei Dateien. Die Version in der Produktdokumentation führt ein Agent nach (Schritt 7).

1. Öffne im Repository die Datei `package.json` und klicke auf den Stift.
2. Erhöhe die Zahl bei `"version"`, zum Beispiel von `1.3.0` auf `1.3.1`.
3. Wähle **Commit changes**, dann **Create a new branch** und **Propose changes**.
4. Öffne im selben Zweig die Datei `CHANGELOG.md` und klicke auf den Stift.
5. Füge zuoberst einen Abschnitt mit der neuen Version ein. Die Überschrift hat die Form `## 1.3.1 (2. Dezember 2026)`. Darunter steht je Änderung eine Zeile mit `- `. Der Abschnitt wird zum Text der Release.
6. Speichere mit **Commit changes** im selben Zweig.
7. Eröffne den Pull Request. Der Workflow «CI» (automatischer Ablauf für die Prüfung, kurz für Continuous Integration) prüft die Änderung. Der Schritt «Check the version in the product documentation» bleibt rot, solange `docs/sr-navigator-dokumentation.html` die alte Version nennt. Kopiere dann diesen Auftrag für einen Agenten und ersetze `…` durch die Nummer des Pull Requests:

   ```
   Führe in Pull Request #… im Repository SEM-SGG/sr-navigator die Version in der Produktdokumentation nach. Halte dich an AGENTS.md.
   ```

   Der Agent passt die Datei auf dem Zweig des Pull Requests an. Danach läuft «CI» erneut und wird grün.
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
4. Öffne die [Produktdokumentation](https://sem-sgg.github.io/sr-navigator/dokumentation.html). Die Kopfzeile nennt dieselbe Version.

## Wenn ein Lauf rot ist

1. Öffne unter **Actions** den roten Lauf und darin den roten Schritt. Die letzten Zeilen nennen den Fehler.
2. Häufige Ursachen:

| Meldung | Ursache | Behebung |
| --- | --- | --- |
| `CHANGELOG.md: Abschnitt … fehlt` | Zur Version in `package.json` gibt es keinen Abschnitt | Abschnitt ergänzen, Überschrift genau in der Form `## 1.3.1 (Datum)` |
| `Version … hat nicht die Form 1.2.3` | Tippfehler in `package.json` | Version berichtigen |
| `docs/sr-navigator-dokumentation.html: Die Versionsangabe passt nicht zu package.json` | Die Produktdokumentation nennt eine andere Version | Die Meldung nennt jede betroffene Zeile. Gib einem Agenten den Auftrag aus Abschnitt «Neue Version veröffentlichen», Schritt 7 (er führt `node scripts/check-dokumentation.mjs --fix` aus). |
| Fehler im Schritt «Deploy to GitHub Pages» | Projektseite ist nicht eingerichtet | Abschnitt «Einmalige Einrichtung» |
| Ein Test schlägt fehl | Die Änderung hat ein Verhalten verändert | Änderung zurücknehmen oder berichtigen |
| Lauf «Fassungen» rot, Pull Request ist ein Entwurf | Einbau, Prüfung oder Test gescheitert | Abschnitt «Wenn der Pull Request ein Entwurf ist» |
| Am Montag ist kein Lauf «Fassungen» erschienen | GitHub hat den zeitgesteuerten Lauf verzögert, ausgelassen oder abgeschaltet | Abschnitt «Zeitgesteuerter Lauf: Übergabe, Verspätung, Start von Hand» |
| `Rohdaten von Fedlex nicht geladen` | Fedlex war nicht erreichbar | Workflow «Fassungen» später über **Run workflow** neu starten |
| `GitHub Actions is not permitted to create or approve pull requests` | Einstellung für Pull Requests fehlt | Abschnitt «Einmalige Einrichtung», Schritte 4 und 5 |
| Im Pull Request des Workflows fehlt **Approve workflows to run**, und kein Lauf «CI» erscheint | GitHub hat zum Pull Request keinen Lauf angelegt | Im Pull Request **Close pull request** und danach **Reopen pull request** wählen. Das startet «CI». |

3. Starte einen abgebrochenen Lauf «Release» unter **Actions** über **Run workflow** neu. Er holt nach, was fehlt, und legt nichts doppelt an.

## Neue Fassung einbauen

Der Workflow «Fassungen» fragt Fedlex jeden Montag ab. Findet er eine neue Fassung oder eine ersetzte Datei eines eingebetteten Erlasses, eröffnet er das Issue «Neue Fassungen auf Fedlex». Danach baut er die Fassung ein und eröffnet einen Pull Request, zum Beispiel «SR-Navigator 1.3.2: VZAE-Fassung vom 1. Oktober 2026 nachgeführt». Du prüfst den Pull Request und führst ihn zusammen. Der Workflow «Release» veröffentlicht danach die neue Version.

Nutzende können neue Fassungen im Navigator selbst über **Aktualisieren** laden. Der feste Einbau erspart ihnen diesen Schritt.

### Pull Request prüfen und zusammenführen

1. Öffne im Repository **Pull requests** und darin den Pull Request des Workflows. Er stammt von `github-actions` und liegt auf dem Zweig `fassungen/einbau`.
2. Lies den Abschnitt «Befund». Er zeigt dieselbe Tabelle wie das Issue.
3. Lies den Abschnitt «Was sich ändert». Er nennt je Erlass den neuen oder ersetzten Stand und je Sprache die geänderten Bestimmungen. Bei einer ersetzten Datei stehen die bisherige und die neue Datei mit Grösse dabei.
4. Prüfe die Abschnitte «Prüfberichte», «Übrige Erlasse und Stände» und «Tests». Woran du einen guten Pull Request erkennst, steht unten.
5. Gib den Lauf «CI» frei: Unten im Pull Request steht «Some checks are waiting for approval». Wähle dort **Approve workflows to run**. Nach einigen Minuten zeigt der Pull Request «CI / Tests and build» mit grünem Haken. GitHub verlangt diese Freigabe, weil der Pull Request von einem Workflow stammt. Die Freigabe wiederholt die bereits gelaufenen Tests aus dem Abschnitt «Tests» auf dem Stand des Pull Requests (ohne die Tests mit den Rohdaten von Fedlex). Fehlt **Approve workflows to run** und erscheint kein Lauf «CI», wähle unten **Close pull request** und danach **Reopen pull request**. Das startet «CI».
6. Lies den Abschnitt «Text im Changelog». Er wird zum Text der Release. Du darfst ihn verbessern, zum Beispiel um die geänderte Bestimmung: Öffne **Files changed**, bei `CHANGELOG.md` das Menü **…** und **Edit file**. Speichere mit **Commit changes** im selben Zweig.
7. Wähle **Merge pull request** und **Confirm merge**. Der Pull Request schliesst das Issue.
8. Prüfe die Veröffentlichung wie im Abschnitt «Prüfen, ob die Veröffentlichung geklappt hat».

Ein guter Pull Request erfüllt diese Punkte:

- Er ist kein Entwurf und beginnt nicht mit «Nicht zusammenführen».
- Die Version steigt um eins in der letzten Stelle, zum Beispiel von `1.3.1` auf `1.3.2`.
- «Was sich ändert» nennt nur die Erlasse und Stände aus dem Befund.
- Unter «Prüfberichte» zeigt jede Zeile «bestanden» oder «Hinweis». Ein Hinweis heisst: Die Zahl ist gestiegen, und `data/VALIDATION.md` begründet jeden Fall einzeln. Bei einer neuen Fassung kommt das vor.
- Unter «Übrige Erlasse und Stände» steht keine Warnung. Ein Hinweis zu Metadaten, zum Beispiel zu laufenden Vorhaben, ist unbedenklich.
- Unter «Tests» zeigt jede Zeile «bestanden».

Als bestanden gelten diese Prüfungen:

| Prüfung | bestanden, wenn |
| --- | --- |
| Wortlaut vollständig | Abdeckung 100 % in jedem Erlass, Stand und jeder Sprache |
| Fussnoten vollständig | keine fehlende Fussnote |
| Impact-Einträge ohne Änderung | keiner offen |
| Schlüsselwechsel | nicht mehr als vorher |
| Unerlaubtes Markup | keines |
| Laden über Fedlex-Abfragen = Bau | keine Abweichung |

Änderungen ohne Beleg, Sprachausnahmen und der echte Abruf eines nicht eingebetteten Erlasses ergeben höchstens einen Hinweis.

### Wenn der Pull Request ein Entwurf ist

Scheitert der Einbau, eine Prüfung oder ein Test, eröffnet der Workflow den Pull Request als Entwurf. Der Text beginnt mit «Nicht zusammenführen» und nennt die Gründe. Der Lauf «Fassungen» ist rot.

1. Führe den Entwurf nicht zusammen.
2. Lies die Gründe am Anfang des Pull Requests. Bei einem fehlgeschlagenen Test stehen die letzten Zeilen der Ausgabe unter «Tests».
3. Liegt die Ursache bei Fedlex oder im Netz, zum Beispiel `fetch failed` oder `SPARQL 503`, starte den Workflow «Fassungen» unter **Actions** über **Run workflow** neu. Er baut den Einbau neu und aktualisiert den Pull Request.
4. Bleibt der Fehler, kopiere diesen Auftrag für einen Agenten und ersetze `…` durch die Nummer des Pull Requests:

   ```
   Der Einbau der neuen Fassungen ist gescheitert. Pull Request #… im Repository SEM-SGG/sr-navigator ist ein Entwurf: Bring ihn in Ordnung. Halte dich an AGENTS.md, Ablauf «Gescheiterter Einbau neuer Fassungen».
   ```

   Der Agent baut die Fassung ein, führt Prüfungen und Tests aus und eröffnet einen eigenen Pull Request. In dessen Beschreibung nennt er die Ursache und was du kontrollieren sollst. Prüfe diesen Pull Request und führe ihn zusammen. Schliesse danach den Entwurf mit **Close pull request**.
5. Steht kein Agent zur Verfügung, baut eine Person mit Node.js die Fassung von Hand ein (Unterabschnitt «Einbau von Hand»).

Ein offener Pull Request mit demselben Befund bleibt beim nächsten Lauf unverändert. Ein Entwurf nach einem Fehler wird bei jedem Lauf neu gebaut. Führt Fedlex inzwischen weitere Fassungen, baut der Lauf alle ein und überschreibt den Zweig.

Eröffnet der Workflow das Issue, aber keinen Pull Request, ist schon das Laden der Rohdaten gescheitert. Starte den Workflow später über **Run workflow** neu.

Mit **Run workflow** und dem Schalter **Probelauf** prüfst du den Ablauf, ohne ein Issue zu eröffnen. Der Pull Request ist dann ein Entwurf mit «Probelauf:» im Titel. Schliesse ihn nach der Durchsicht.

### Einbau von Hand

Diesen Weg geht ein Agent (Auftrag oben) oder eine Person mit Node.js auf ihrem Gerät. `node scripts/apply-fassungen.mjs` führt die Schritte 2 bis 4 in einem Lauf aus, erhöht die Version in `package.json`, `package-lock.json` und in der Produktdokumentation und ergänzt `CHANGELOG.md`. Die Einzelschritte:

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
6. Erhöhe die Version in `package.json` und `package-lock.json`, ergänze `CHANGELOG.md`, setze die Version in der Produktdokumentation mit `node scripts/check-dokumentation.mjs --fix` und eröffne einen Pull Request. Hast du `apply-fassungen.mjs` verwendet, entfällt das Erhöhen: Das Skript setzt die Version an allen drei Orten selbst.
7. Schliesse das Issue nach der Release.

## Zeitgesteuerter Lauf: Übergabe, Verspätung, Start von Hand

Der Workflow «Fassungen» startet von selbst am Montagmorgen. GitHub führt ihn auf das Konto der Person aus, die ihn zuletzt eingerichtet oder wieder eingeschaltet hat. Nur diese Person erhält die Fehlermail. Verlässt sie die Organisation, läuft der Workflow weiter, aber die Fehlermails gehen weiter an sie.

**Bei der Übergabe an eine Nachfolge** (am besten vor dem Austritt der bisherigen Person):

1. Die neue zuständige Person meldet sich mit ihrem eigenen Konto bei GitHub an. Sie braucht Schreibrecht auf das Repository `SEM-SGG/sr-navigator`.
2. Unter ihrem Profilbild → **Settings** → **Notifications** → **GitHub Actions** schaltet sie **Email** ein und wählt **Only notify for failed workflows**.
3. Im Repository öffnet sie **Actions** und wählt links den Workflow «Fassungen». Sie klickt rechts auf **…** → **Disable workflow** und gleich danach auf **Enable workflow**. Ab jetzt erhält sie die Fehlermails.

**Wenn der Lauf ausbleibt:** GitHub startet zeitgesteuerte Läufe oft mehrere Stunden zu spät, an manchen Tagen auch gar nicht. Warte bis Dienstagmorgen. Fehlt der Lauf dann noch, starte ihn von Hand: **Actions** → Workflow «Fassungen» wählen → rechts **Run workflow** → Branch `main` lassen, Schalter **Probelauf** aus lassen → **Run workflow**. Ein Lauf von Hand eröffnet keine doppelten Issues oder Pull Requests: Er aktualisiert das offene Issue «Neue Fassungen auf Fedlex». Einen offenen Pull Request des Workflows lässt er stehen oder baut ihn neu, statt einen zweiten zu eröffnen.

**Wenn GitHub den Workflow abgeschaltet hat:** Bei öffentlichen Repositories schaltet GitHub zeitgesteuerte Workflows nach 60 Tagen ohne Aktivität im Repository ab. Zeigt **Actions** einen entsprechenden Hinweis, wähle den Workflow «Fassungen» und klicke **Enable workflow**. Wer das tut, erhält ab dann die Fehlermails.

## Einstellungen

Die Datei `release.config.json` steuert Adressen und Versionsprüfung. Nach einer Änderung braucht es eine neue Version.

| Feld | Bedeutung |
| --- | --- |
| `repoUrl` | Adresse des Repositorys, Form `https://github.com/<besitzer>/<repo>` |
| `asset` | Dateiname in der Release |
| `siteUrl` | Adresse der Projektseite, Form `https://<besitzer>.github.io/<repo>/` |
| `manifest` | Name der Versionsangabe auf der Projektseite |
| `contact` | Funktionsadresse für Rückmeldungen ohne GitHub-Konto (Ansicht **Info** und Projektseite) |
| `checkEveryHours` | Abstand zwischen zwei Suchen beim Start, in Stunden |
| `snoozeDays` | Tage, um die «Später erinnern» den Hinweis zurückstellt |
| `remindAfterDays` | Alter der Datei in Tagen, ab dem der Navigator ohne erreichbare Versionsangabe erinnert |

Bereits verteilte Dateien behalten die alten Adressen. Nach einer Übertragung des Repositorys leitet GitHub die Adressen unter `github.com` weiter, die Projektseite unter `github.io` nicht. Ältere Navigatoren erinnern dann nach dem Alter der Datei, und ihr Download-Link funktioniert weiter.

## Einmalige Einrichtung

1. Öffne im Repository **Settings**, dann **Pages**.
2. Wähle unter **Build and deployment** bei **Source** den Eintrag **GitHub Actions**.
3. Starte unter **Actions** den Workflow «Release» über **Run workflow**.
4. Öffne **Settings**, dann **Actions** und **General**.
5. Setze unter **Workflow permissions** das Häkchen bei **Allow GitHub Actions to create and approve pull requests** und wähle **Save**. Ohne diese Einstellung eröffnet der Workflow «Fassungen» keinen Pull Request.

Ist das Häkchen in Schritt 5 ausgegraut, sperrt die Organisation die Einstellung. Eine Person mit Admin-Recht in der Organisation setzt dasselbe Häkchen zuerst dort: Organisation **SEM-SGG**, **Settings**, **Actions**, **General**, **Workflow permissions**. Danach lässt es sich im Repository setzen.
