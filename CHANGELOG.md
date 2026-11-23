# Änderungen

## 1.4.0 (23. November 2026)

- Der Navigator liegt zusätzlich auf der Projektseite unter `app/` und lässt sich dort im Browser öffnen, ohne Download. Es ist dieselbe Datei wie in der Release.
- Im Browser geöffnet, meldet der Navigator eine neue Version mit «Seite neu laden» statt mit einem Download. Der Hinweis nach dem Alter der Datei entfällt dort.
- Hinzugefügte Erlasse, Sammelkorb und Einstellungen liegen im Speicher des Browsers, getrennt von der heruntergeladenen Datei. Wer wechselt, nimmt den Stand über die Projektdatei mit (Ansicht «Bibliothek»).
- Korrektur: Der Hinweis auf eine neue Version erschien in seltenen Fällen erst nach dem nächsten Wechsel der Ansicht.
- Pflege: Der Workflow «Fassungen» baut neue Fassungen und ersetzte Dateien von Fedlex selbst ein und eröffnet dazu einen Pull Request mit Zusammenfassung, Prüfberichten und Testergebnis.

## 1.3.1 (18. November 2026)

- VZAE, Stand vom 1. Oktober 2026: Fedlex hat diesen Stand in Deutsch, Französisch und Italienisch neu veröffentlicht. Der Navigator enthält jetzt die neuen Dateien.
- Deutsch und Französisch: Der Wortlaut bleibt gleich.
- Italienisch: Art. 83a Abs. 1 spricht neu von «Stato Schengen» statt von «Stato vincolato dagli Accordi di associazione alla normativa di Schengen». Die Fussnoten zu Art. 83a Abs. 1 und Art. 87 Abs. 1bis Bst. g verweisen neu auf die Verordnung vom 6. Mai 2026 (AS 2026 239).
- Diese Änderung gilt seit dem 12. Juni 2026. Fedlex führt sie im italienischen Text aber erst im Stand vom 1. Oktober 2026. Der Navigator zeigt sie deshalb dort und kennzeichnet sie als redaktionell.

## 1.3.0 (18. November 2026)

- Der Navigator sucht selbst nach einer neuen Version. Er ruft dazu beim Start höchstens einmal pro Tag die Versionsangabe der Projektseite ab. Die Suche lässt sich in der Ansicht «Info» abschalten und dort von Hand starten.
- Der Hinweis nennt Version und Datum der neuen Datei. Der Download verlangt kein GitHub-Konto.
- Ohne erreichbare Versionsangabe erinnert der Navigator wie bisher nach 60 Tagen an eine mögliche neue Version.
- Die Ansicht «Info» führt zur Projektseite, zu allen Versionen, zum Quellcode und zur Fehlermeldung.
- Öffentliches Repository `SEM-SGG/sr-navigator` mit Projektseite, automatischer Veröffentlichung und wöchentlicher Prüfung auf neue Fassungen bei Fedlex.

## 1.2.1 (18. November 2026)

- Zwischenstand für die Ablage auf GitHub, nicht verteilt.

## 1.2.0 (18. November 2026)

- Hinweis unter der Kopfzeile, wenn die Datei 60 Tage alt ist, mit Download-Link zur neuesten Version.
- Abschnitt «Version» in der Ansicht Info.
- Adresse des Repositorys als Build-Parameter in `release.config.json`.

## 1.1.0 (18. November 2026)

- Verweisnetz je Bestimmung in der Chronologie-Leiste und als Dialog.
- Verweisstruktur des ganzen Erlasses in der Übersicht.
- Verweis-Index für alle eingebetteten Erlasse in Deutsch, Französisch und Italienisch.

## 1.0.0 (16. November 2026)

- Lesen, Vergleichen, Chronologie und Export für AIG, VZAE, VEV, AsylG und EESV.
- Aktualisieren und Hinzufügen von Erlassen über Fedlex.
- Oberfläche in Deutsch, Französisch und Italienisch.
