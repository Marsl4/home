# Home

Notizen mit Text und Zeichnungen, lokal im Browser.

## Benutzen (installierte App)

Die App ist online unter **https://<dein-github-name>.github.io/home/** und lässt sich installieren:

- **Mac (Safari):** Seite öffnen → Menü *Ablage* → *Zum Dock hinzufügen*
- **Mac (Chrome):** Seite öffnen → Installieren-Symbol rechts in der Adressleiste
- **iPad (Safari):** Seite öffnen → Teilen-Symbol → *Zum Home-Bildschirm*

Danach startet „Home“ wie eine normale App mit eigenem Icon, auch ohne Internet.
Deine Daten bleiben auf dem jeweiligen Gerät (Austausch über Einstellungen → Daten & Backup).

## Weiterentwickeln

Im Terminal im Projektordner `npm run dev` und dann **http://localhost:5173** öffnen.
(Beim allerersten Mal bzw. auf einem neuen Rechner vorher `npm install`.)

Neue Versionen gehen automatisch online, sobald sie zu GitHub hochgeladen werden (`git push`).

## Bedienung

- **Bereiche** (ganz links): Notizen, Uni, PDFs, Kalender, ToDos, Fitness. Klick öffnet die zweite
  Leiste, nochmal klicken klappt sie zu. Kalender und Fitness sind noch Platzhalter.
- **Uni:** "+ Neues Fach" anlegen, im Fach "+" für neue Seiten. Fächer lassen sich auf-/zuklappen.
- **ToDos:** Aufgabe eintippen + Enter, optional Datum. Kreis anklicken = erledigt.
- **PDFs:** "PDF importieren" oder PDF einfach ins Fenster ziehen. Mit "Zeichnen" darauf schreiben,
  Stern = Favorit.
- **Neue Seite:** in Notizen "+ Neue Seite" unten in der zweiten Leiste
- **Umbenennen:** oben auf der Seite in den großen Titel klicken
- **Löschen:** in der Leiste mit der Maus über die Seite fahren → "×"
- **Blöcke einfügen:** `/` tippen (Überschriften, Listen, Tabellen, Bilder …)
- **Zeichnen:** oben rechts auf "✏️ Zeichnen" → überall auf der Seite malen (Stift, Textmarker,
  Radierer, Farben). `⌘Z` = rückgängig, `Esc` oder "Fertig" = zurück zum Tippen.
  Striche hängen am Text daneben und wandern mit, wenn du darüber Zeilen einfügst.
- **Speichern:** passiert automatisch (im Browser, in IndexedDB)

## Aufbau des Codes

| Datei | Aufgabe |
|---|---|
| `src/App.tsx` | Grundlayout: Bereiche-Leiste, zweite Leiste, Hauptansicht |
| `src/sections/index.ts` | **Liste aller Bereiche** – neuen Bereich hier eintragen |
| `src/sections/notes/` | Notizen: Seitenliste, Editor, Seitenansicht |
| `src/sections/uni/` | Uni: Fächer (nutzt die Notizseiten mit) |
| `src/sections/todos/` | ToDos |
| `src/sections/pdfs/` | PDFs: Import, Anzeige (pdf.js), Schreiben auf Seiten |
| `src/sections/placeholder/` | Platzhalter-Ansicht für Bereiche, die noch kommen |
| `src/components/SectionRail.tsx` | Leiste ganz links |
| `src/editor/schema.ts` | Welche Blöcke es im Editor gibt |
| `src/drawing/` | Zeichenschicht, Werkzeugleiste, Striche, gemeinsame Stift-Logik |
| `src/storage/db.ts` | Alles rund ums Speichern der Daten |
| `src/storage/uiState.ts` | Merkt sich, welcher Bereich zuletzt offen war |

## Wichtig

Die Daten liegen nur in **diesem Browser** auf **diesem Mac**. Wer die Browserdaten
löscht (oder einen anderen Browser nimmt), sieht die Notizen nicht. Backup/Sync kommt später.

## Neuen Bereich hinzufügen

In `src/sections/index.ts` einen Eintrag ergänzen (Name, Icon von https://lucide.dev, Unterbereiche).
Solange der Bereich noch nichts kann, `PlaceholderPanel` und `PlaceholderView` verwenden.
