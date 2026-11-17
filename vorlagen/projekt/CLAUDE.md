# Uni-Projekt (Hausarbeit oder Präsentation)

Dieses Projekt ist eine Hausarbeit oder Präsentation fürs Studium. Es wird in VS Code mit Claude erstellt
und liegt als **privates** GitHub-Repository online. Die persönliche App „Home“ liest es von dort und zeigt
Abgabe, Fortschritt, Aufgaben, letzte Änderungen und das Ergebnis-PDF an (Mac und iPad).

## Über mich
- Ich habe keine Programmiererfahrung. Erkläre Schritte, die ich selbst machen muss, kurz und einfach.
- Frag nach, bevor du neue Programme/Pakete installierst.
- Antworte auf Deutsch.

## Damit die Home-App alles anzeigt – nach JEDEM Arbeitsschritt
1. **`home.json` aktuell halten** (Format siehe unten): Status, Umfang (`ist` = aktuelle Wörter bzw. Folien),
   Aufgaben (erledigte abhaken, neue ergänzen), Abgabetermin.
2. **Ergebnis-PDF neu erzeugen** und unter dem Pfad aus `ergebnis` ablegen (z. B. `ausgabe/hausarbeit.pdf`).
   Das PDF wird mit eingecheckt (die App zeigt es an, auch ältere Fassungen).
3. **Commit + Push** mit einer kurzen, verständlichen Beschreibung auf Deutsch, z. B.
   „Kapitel 3 überarbeitet (Argumentation gestrafft)“ – die erscheint in der App unter „Letzte Änderungen“.

## Neues Projekt einrichten (einmalig)
- Fragen: Hausarbeit oder Präsentation? Titel, Fach/Seminar, Abgabetermin, Vorgaben (Umfang, Zitierweise,
  Seitenformat, Sprache, ob Word-Datei verlangt ist). Die Vorgaben in `VORGABEN.md` festhalten.
- `home.json` ausfüllen (`typ`: `"hausarbeit"` oder `"praesentation"`).
- Werkzeug fürs PDF vorschlagen und erst nach Rückfrage installieren. Empfehlung: **Typst** (ein kleines
  Programm, schnelle saubere PDFs, Literaturverzeichnis eingebaut; `brew install typst`). Für Folien ebenfalls
  Typst (z. B. Paket „touying“). Verlangt die Uni eine Word-Datei: zusätzlich mit Pandoc eine `.docx` erzeugen.
- Git-Repository anlegen und **privat** auf GitHub veröffentlichen:
  `~/.local/bin/gh repo create <name> --private --source . --push`
  (Niemals öffentlich – es sind meine Texte.)

## home.json – Format
```json
{
  "typ": "hausarbeit",
  "titel": "Titel der Arbeit",
  "fach": "Seminar / Fach",
  "abgabe": "2026-12-31",
  "status": "Schreiben",
  "ergebnis": "ausgabe/hausarbeit.pdf",
  "umfang": { "ist": 3200, "ziel": 5000, "einheit": "Wörter" },
  "aufgaben": [
    { "text": "Gliederung", "erledigt": true },
    { "text": "Kapitel 3 schreiben", "erledigt": false }
  ]
}
```
- `status`: kurz, z. B. „Thema“, „Recherche“, „Gliederung“, „Schreiben“, „Korrektur“, „Fertig“ (bei
  Präsentationen z. B. „Folien“, „Proben“). „Fertig“/„Abgegeben“ sortiert das Projekt in der App nach hinten.
- `umfang`: Hausarbeit in Wörtern (nur Fließtext, ohne Verzeichnisse), Präsentation in Folien
  (`"einheit": "Folien"`) oder Minuten.
- `abgabe`: Datum als `JJJJ-MM-TT`.

## Ordner
- `text/` bzw. `folien/` – die Quelldateien (z. B. Typst)
- `literatur/` – Literaturliste (z. B. `quellen.bib`) und Notizen zu Quellen
- `ausgabe/` – das fertige PDF (und ggf. `.docx`)
- `VORGABEN.md` – Vorgaben des Lehrstuhls

## Schreiben
- Wissenschaftlich, sachlich, klar gegliedert; Zitierweise laut `VORGABEN.md`.
- Quellen nie erfinden. Wenn eine Angabe belegt werden muss und keine Quelle vorliegt: als offene Aufgabe in
  `home.json` eintragen („Beleg für … suchen“) statt etwas zu behaupten.
- Größere Umbauten (Gliederung ändern, Kapitel streichen) vorher kurz mit mir absprechen.
