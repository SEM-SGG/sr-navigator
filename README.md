# SR-Navigator

Der SR-Navigator zeigt, wie sich Erlasse der Systematischen Rechtssammlung der Schweiz (SR) je Bestimmung geändert haben. Er ist eine einzelne HTML-Datei und läuft im Browser, ohne Installation.

Der SR-Navigator ist kein amtliches Produkt. Er zeigt die Fassungen von Fedlex und markiert Unterschiede. Massgebend ist die Amtliche Sammlung (AS).

## Herunterladen und starten

1. Öffne die [Projektseite des SR-Navigators](https://sem-sgg.github.io/sr-navigator/) und lade die Datei herunter. Du brauchst dafür kein GitHub-Konto.
2. Speichere die Datei `sr-navigator.html` in einem Ordner deiner Wahl.
3. Öffne die Datei mit einem Doppelklick. Sie läuft in Chrome, Edge und Firefox.

Du kannst die [aktuelle Datei auch direkt herunterladen](https://github.com/SEM-SGG/sr-navigator/releases/latest/download/sr-navigator.html).

Arbeite immer im gleichen Browser. Hinzugefügte Erlasse und der Sammelkorb liegen im Speicher dieses Browsers.

Die [Produktdokumentation](docs/sr-navigator-dokumentation.html) beschreibt den SR-Navigator in Deutsch, Französisch und Italienisch. Sie ist eine eigenständige HTML-Datei mit Sprachumschalter und lässt sich offline lesen. GitHub zeigt HTML-Dateien als Quelltext an und eine Datei dieser Grösse gar nicht: Öffne die Dateiseite, wähle **Download raw file** und öffne die heruntergeladene Datei im Browser.

## Funktionen

- **Lesen:** jede Bestimmung in jeder Fassung, mit Fussnoten und Chronologie der Änderungen.
- **Vergleichen:** zwei Fassungen nebeneinander, Unterschiede auf Wortebene.
- **Verweise:** Netz der Verweise einer Bestimmung und Verweisstruktur des ganzen Erlasses.
- **Exportieren:** Ausschnitte als PNG oder PDF, im Hochformat A4 oder im Querformat 16:9, mit Zitat und Quelle.
- **Aktualisieren:** neue Fassungen und weitere Erlasse auf Knopfdruck von Fedlex beziehen.

Fest eingebettet sind AIG (SR 142.20), VZAE (SR 142.201), VEV (SR 142.204), AsylG (SR 142.31) und EESV (SR 142.206). Die Oberfläche gibt es in Deutsch, Französisch und Italienisch.

## Neue Versionen

Der Navigator meldet selbst, wenn eine neuere Version vorliegt. Der Hinweis erscheint unter der Kopfzeile und führt zum Download.

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
| `fedlex.data.admin.ch` | wenn du einen Erlass aktualisierst oder hinzufügst | Abfrage der Fassungen und Abruf der Rechtstexte |

Die Suche nach einer neuen Version schaltest du in der Ansicht **Info** im Abschnitt «Version» ab. Die Content-Security-Policy der Datei lässt keine weiteren Adressen zu.

## Français

Le SR-Navigator montre, disposition par disposition, comment les actes du Recueil systématique du droit fédéral (RS) ont été modifiés. Il s’agit d’un seul fichier HTML, à télécharger depuis la [page du projet](https://sem-sgg.github.io/sr-navigator/#fr). L’interface existe en français. Le SR-Navigator n’est pas un produit officiel. Le Recueil officiel (RO) fait foi.

## Italiano

Il SR-Navigator mostra, disposizione per disposizione, come sono cambiati gli atti della Raccolta sistematica del diritto federale (RS). È un unico file HTML, da scaricare dalla [pagina del progetto](https://sem-sgg.github.io/sr-navigator/#it). L’interfaccia esiste in italiano. Il SR-Navigator non è un prodotto ufficiale. Fa stato la Raccolta ufficiale (RU).

## Fehler melden

Melde Fehler über [ein Issue in diesem Repository](https://github.com/SEM-SGG/sr-navigator/issues/new/choose). Eine Meldung verlangt ein GitHub-Konto und ist öffentlich sichtbar. Trage keine vertraulichen Inhalte ein.

## Für Pflegende

Die Pflegeanleitung steht in [`MAINTAINING.md`](MAINTAINING.md): neue Version veröffentlichen, neue Fassung einbauen, Vorgehen bei einem fehlgeschlagenen Lauf.

### Lokal bauen und testen

Voraussetzung ist Node.js. Geprüft ist der Build mit Node.js 22.

| Zweck | Befehl | Ergebnis |
| --- | --- | --- |
| Abhängigkeiten installieren | `npm ci` | Ordner `node_modules/` |
| Navigator bauen | `npm run build` | `dist/sr-navigator.html` |
| Projektseite bauen | `npm run site` | `dist/site/` mit `index.html` und `version.json` |
| Kern testen | `npm run test:core` | Parser, Datenmodell, Fedlex-Abruf, Verweis-Index |
| Veröffentlichung testen | `npm run test:release` | Skript für die Release |
| Oberfläche testen | `npm run test:app` | Unit-Tests und Browsertests in Chrome, Firefox und Edge |
| Fedlex auf neue Fassungen prüfen | `npm run check:fassungen` | Befund als Tabelle, ohne Issue |

Der volle Testlauf braucht den Ordner `raw/` mit den Rohdaten von Fedlex (rund 110 MB). Der Ordner liegt nicht im Repository. Fehlt er, überspringt der Kern sieben Tests und die Oberfläche fünf Browsertests. So lädst du die Rohdaten:

```
node scripts/fetch-raw.mjs cc/2007/758 cc/2007/759 cc/2018/493 cc/1999/358 cc/2021/734
node scripts/fetch-meta.mjs cc-2007-758 cc-2007-759 cc-2018-493 cc-1999-358 cc-2021-734
```

### Aufbau

| Pfad | Inhalt |
| --- | --- |
| `SPEC.md` | Spezifikation mit allen Entscheiden |
| `CHANGELOG.md` | Änderungen je Version, zugleich Text der Releases |
| `release.config.json` | Adressen von Repository und Projektseite, Einstellungen der Versionsprüfung |
| `src/core/` | Parser, Datenmodell, Fedlex-Abruf, Verweis-Index |
| `src/app/` | Oberfläche (Preact), Texte DE, FR, IT, Gestaltung |
| `site/` | Vorlage der Projektseite |
| `docs/` | Produktdokumentation als eigenständige HTML-Datei (DE, FR, IT), Abfragen an Fedlex |
| `data/` | Bibliothek der eingebetteten Erlasse und Prüfberichte |
| `test/` | Tests für Kern, Veröffentlichung und Oberfläche, Prüfbericht `test/app/REPORT.md` |
| `check/` | unabhängige Prüfskripte für Wortlaut, Änderungen und Verweise |
| `scripts/` | Skripte für Rohdaten, Bibliothek, Prüfberichte, Projektseite und Veröffentlichung |
| `.github/workflows/` | Prüfung (`ci.yml`), Veröffentlichung (`release.yml`), Fassungsprüfung (`fassungen.yml`) |
| `LICENSES/` | Lizenzen der gebündelten Software und Schriften |

### Lizenz

Für den Code des SR-Navigators ist keine Lizenz festgelegt. Die gebündelte Software und die Schriften stehen unter den Lizenzen in [`LICENSES/`](LICENSES/README.md). Die Rechtstexte stammen von Fedlex.
