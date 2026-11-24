# SR-Navigator

Der SR-Navigator zeigt, wie sich Erlasse der Systematischen Rechtssammlung der Schweiz (SR) je Bestimmung geändert haben. Er läuft im Browser, ohne Installation: über einen Link oder als einzelne HTML-Datei.

Der SR-Navigator ist kein amtliches Produkt. Er zeigt die Fassungen von Fedlex und markiert Unterschiede. Massgebend ist die Amtliche Sammlung (AS).

Die [Produktdokumentation](https://sem-sgg.github.io/sr-navigator/dokumentation.html) beschreibt Funktionen, Methodik, Netzzugriffe und Einrichtung in Deutsch, Französisch und Italienisch. Sie öffnet sich im Browser, ohne Download.

## Starten

1. Öffne die [Projektseite des SR-Navigators](https://sem-sgg.github.io/sr-navigator/) und wähle **Im Browser öffnen**. Der Navigator startet ohne Download und ohne Installation, in Chrome, Edge und Firefox. Du brauchst kein GitHub-Konto.
2. Lege ein Lesezeichen an. Die Adresse lautet `https://sem-sgg.github.io/sr-navigator/app/`.
3. Arbeite immer im gleichen Browser. Hinzugefügte Erlasse und der Sammelkorb liegen im Speicher dieses Browsers.

Die Adresse im Browser führt direkt zur gewählten Bestimmung und Fassung. Kopierst du diese Adresse und gibst sie weiter, öffnet sich bei allen dieselbe Stelle. Selbst hinzugefügte Erlasse muss die empfangende Person zuerst ebenfalls hinzufügen.

### Ohne Internetverbindung arbeiten

1. Lade auf der Projektseite die Datei herunter oder nutze den [direkten Download der aktuellen Datei](https://github.com/SEM-SGG/sr-navigator/releases/latest/download/sr-navigator.html).
2. Speichere die Datei `sr-navigator.html` in einem Ordner deiner Wahl.
3. Öffne die Datei mit einem Doppelklick.

Die Datei und der Navigator im Browser speichern ihre Daten getrennt. Mit der Projektdatei (Ansicht **Bibliothek**) nimmst du deinen Stand von einem zum anderen mit. Bei der heruntergeladenen Datei nennt die Adresse im Browser den Ordner auf deinem Rechner. Gibst du sie weiter, öffnet sich dieselbe Stelle nur, wenn die Datei bei der empfangenden Person am selben Ort liegt.

## Funktionen

- **Lesen:** jede Bestimmung in jeder Fassung, mit Fussnoten und Chronologie der Änderungen.
- **Vergleichen:** zwei Fassungen nebeneinander, Unterschiede auf Wortebene.
- **Verweise:** Netz der Verweise einer Bestimmung und Verweisstruktur des ganzen Erlasses.
- **Exportieren:** Ausschnitte als PNG oder PDF, im Hochformat A4 oder im Querformat 16:9, mit Zitat und Quelle.
- **Aktualisieren:** neue Fassungen und weitere Erlasse auf Knopfdruck von Fedlex beziehen.

Fest eingebettet sind AIG (SR 142.20), VZAE (SR 142.201), VEV (SR 142.204), AsylG (SR 142.31) und EESV (SR 142.206). Die Oberfläche gibt es in Deutsch, Französisch und Italienisch.

## Neue Versionen

Der Navigator meldet selbst, wenn eine neuere Version vorliegt. Der Hinweis erscheint unter der Kopfzeile.

Im Browser wählst du **Seite neu laden**. Deine Daten bleiben erhalten.

Bei der heruntergeladenen Datei führt der Hinweis zum Download:

1. Wenn du Erlasse hinzugefügt hast: Sichere in der Ansicht **Bibliothek** die Projektdatei.
2. Lade die neue Datei über **Neueste Version herunterladen** herunter.
3. Ersetze die alte Datei durch die neue.
4. Öffne die neue Datei und lade in der Ansicht **Bibliothek** die Projektdatei.

Alle Versionen mit ihren Änderungen stehen in den [Releases](https://github.com/SEM-SGG/sr-navigator/releases).

## Netzzugriff

Der Navigator greift auf zwei Adressen zu:

| Adresse | Anlass | Inhalt der Anfrage |
| --- | --- | --- |
| `sem-sgg.github.io` | beim Start, höchstens einmal pro Tag | Abruf der Datei `version.json`, keine Inhalte aus dem Navigator |
| `fedlex.data.admin.ch` | wenn du einen Erlass aktualisierst, suchst oder hinzufügst | Abfrage der Fassungen und Abruf der Rechtstexte; bei der Suche der eingegebene Suchbegriff |

Die Suche nach einer neuen Version schaltest du in der Ansicht **Info** im Abschnitt «Version» ab. Die Content-Security-Policy der Datei lässt keine weiteren Adressen zu.

## Français

Le SR-Navigator montre, disposition par disposition, comment les actes du Recueil systématique du droit fédéral (RS) ont été modifiés. Il s’ouvre dans le navigateur depuis la [page du projet](https://sem-sgg.github.io/sr-navigator/#fr) ou se télécharge sous la forme d’un seul fichier HTML. L’interface existe en français. Le SR-Navigator n’est pas un produit officiel. Le Recueil officiel (RO) fait foi.

## Italiano

Il SR-Navigator mostra, disposizione per disposizione, come sono cambiati gli atti della Raccolta sistematica del diritto federale (RS). Si apre nel browser dalla [pagina del progetto](https://sem-sgg.github.io/sr-navigator/#it) oppure si scarica come unico file HTML. L’interfaccia esiste in italiano. Il SR-Navigator non è un prodotto ufficiale. Fa stato la Raccolta ufficiale (RU).

## Rückmeldung und Fehler

- **Mit GitHub-Konto:** Melde Fehler und Wünsche über [ein Issue in diesem Repository](https://github.com/SEM-SGG/sr-navigator/issues/new/choose) (einen Eintrag auf GitHub). Im Navigator führt das Käfer-Symbol in der Kopfzeile neben dem Namen direkt dorthin. Ein Issue ist öffentlich sichtbar. Halte dich an die Datenregel (Abschnitt unten).
- **Ohne GitHub-Konto:** Schreibe an [sektion-grenze@sem.admin.ch](mailto:sektion-grenze@sem.admin.ch).

## Datenregel

> **Datenregel der SGG**
>
> 1. **Lokal ist jede Klassifizierungsstufe erlaubt.** Was ein Werkzeug ausschliesslich auf deinem Gerät oder lokal im Browser verarbeitet und nicht ins Internet sendet, darfst du unabhängig von der Klassifizierungsstufe bearbeiten.
> 2. **INTERN oder höher geht nicht ins Internet.** Dokumente und Inhalte mit dem Vermerk INTERN, VERTRAULICH oder GEHEIM lädst du nicht ins Internet und teilst oder verarbeitest sie nicht über externe Cloud-Dienste. Dazu gehören KI-Dienste (zum Beispiel Claude und ChatGPT), GitHub (Repositories, Issues, Pull Requests) und Online-Speicher ausserhalb der Arbeitsumgebung des Bundes.
> 3. **Personendaten.** Unabhängig von der Klassifizierung gehören keine besonders schützenswerten Personendaten und keine Falldaten zu Personen aus Verfahren ins Internet oder in externe Cloud-Dienste.
> 4. **Arbeitsumgebung des Bundes.** Für die vom Bund bereitgestellten Dienste (zum Beispiel Teams, Outlook, SharePoint) gelten die Weisungen des SEM.
>
> Als klassifiziert gilt, was einen Klassifizierungsvermerk trägt. Die Regel ergänzt die Weisungen des SEM und ersetzt sie nicht.

Für den SR-Navigator heisst das: Er arbeitet mit öffentlichen Erlasstexten von Fedlex. Deine eigenen Angaben (hinzugefügte Erlasse, Sammelkorb, Einstellungen) liegen im Speicher deines Browsers. Die Projektdatei und Exporte als PNG oder PDF speicherst du selbst lokal ab. Das fällt unter Punkt 1. An Fedlex gehen nur Abfragen nach Fassungen und Metadaten, der Abruf der Rechtstexte und bei der Suche unter «Erlass hinzufügen» der eingegebene Suchbegriff. Issues und Pull Requests (Änderungsvorschläge) auf GitHub sind öffentlich und fallen unter Punkt 2.

## Für Pflegende

Die Pflegeanleitung steht in [`MAINTAINING.md`](MAINTAINING.md): neue Version veröffentlichen, neue Fassung einbauen, Vorgehen bei einem fehlgeschlagenen Lauf, Übergabe an eine Nachfolge.

Bau- und Pflegearbeiten erledigt ein Agent (ein KI-Werkzeug wie Claude Code im Browser oder Codex mit angebundenem Repository). Seine Arbeitsanleitung steht in [`AGENTS.md`](AGENTS.md). Dort findest du auch vorgefertigte Aufträge, die du kopieren und einem Agenten geben kannst, zum Beispiel für einen gescheiterten Einbau neuer Fassungen.

### Lokal bauen und testen

Voraussetzung ist Node.js. Geprüft ist der Build mit Node.js 22.

| Zweck | Befehl | Ergebnis |
| --- | --- | --- |
| Abhängigkeiten installieren | `npm ci` | Ordner `node_modules/` |
| Navigator bauen | `npm run build` | `dist/sr-navigator.html` |
| Projektseite bauen | `npm run site` | `dist/site/` mit `index.html`, `version.json`, `dokumentation.html` und dem Navigator unter `app/index.html` |
| Kern testen | `npm run test:core` | Parser, Datenmodell, Fedlex-Abruf, Verweis-Index |
| Veröffentlichung testen | `npm run test:release` | Skripte für Release, Projektseite, Fassungen und Produktdokumentation |
| Version in der Produktdokumentation und in `package-lock.json` prüfen | `node scripts/check-dokumentation.mjs` | Meldung je abweichende Stelle; mit `--fix` setzt das Skript die Version aus `package.json` in beiden Dateien |
| Oberfläche testen | `npm run test:app` | Unit-Tests und Browsertests in Chrome, Firefox und Edge |
| Fedlex auf neue Fassungen prüfen | `npm run check:fassungen` | Befund als Tabelle, ohne Issue |
| Neue Fassungen einbauen | `npm run apply:fassungen` | Rohdaten, Bibliothek, Prüfberichte, Version und `CHANGELOG.md` |

Der volle Testlauf braucht den Ordner `raw/` mit den Rohdaten von Fedlex (rund 110 MB). Der Ordner liegt nicht im Repository. Fehlt er, überspringt der Kern sieben Tests und die Oberfläche fünf Browsertests. So lädst du die Rohdaten:

```
node scripts/fetch-raw.mjs cc/2007/758 cc/2007/759 cc/2018/493 cc/1999/358 cc/2021/734
node scripts/fetch-meta.mjs cc-2007-758 cc-2007-759 cc-2018-493 cc-1999-358 cc-2021-734
```

### Aufbau

| Pfad | Inhalt |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Arbeitsanleitung für Agenten (Codex, Claude Code und andere) |
| `SPEC.md` | Spezifikation mit allen Entscheiden |
| `CHANGELOG.md` | Änderungen je Version, zugleich Text der Releases |
| `release.config.json` | Adressen von Repository und Projektseite, Funktionsadresse für Rückmeldungen, Einstellungen der Versionsprüfung |
| `src/core/` | Parser, Datenmodell, Fedlex-Abruf, Verweis-Index |
| `src/app/` | Oberfläche (Preact), Texte DE, FR, IT, Gestaltung |
| `site/` | Vorlage der Projektseite |
| `docs/` | Produktdokumentation als eigenständige HTML-Datei (DE, FR, IT), auf der Projektseite unter `dokumentation.html`; Abfragen an Fedlex |
| `data/` | Bibliothek der eingebetteten Erlasse und Prüfberichte |
| `test/` | Tests für Kern, Veröffentlichung und Oberfläche, Prüfbericht `test/app/REPORT.md` |
| `check/` | unabhängige Prüfskripte für Wortlaut, Änderungen und Verweise |
| `scripts/` | Skripte für Rohdaten, Bibliothek, Prüfberichte, Projektseite und Veröffentlichung |
| `.github/workflows/` | Prüfung (`ci.yml`), Veröffentlichung (`release.yml`), Fassungsprüfung (`fassungen.yml`) |
| `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md` | Vorlagen für Issues und Pull Requests |
| `LICENSES/` | Lizenzen der gebündelten Software und Schriften |

### Lizenz

Für den Code des SR-Navigators ist keine Lizenz festgelegt. Die gebündelte Software und die Schriften stehen unter den Lizenzen in [`LICENSES/`](LICENSES/README.md). Die Rechtstexte stammen von Fedlex.
