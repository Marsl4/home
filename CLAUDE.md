# Uni-App

Eine persönliche App fürs Studium: Notizen mit Text und Zeichnungen (wie Notion + Stift),
später Kalender, Todos, Ernährungstracking und Hausarbeits-Projekte.
Nur für mich privat. Läuft auf Mac (Tippen) und später iPad (Apple Pencil).

## Über mich
- Ich habe keine Programmiererfahrung. Erkläre Schritte, die ich selbst machen muss, kurz und einfach.
- Frag nach, bevor du neue Pakete installierst oder große Umbauten machst.
- Wenn es mehrere Wege gibt, empfiehl einen und sag kurz warum.

## Arbeitsweise
- Arbeite in kleinen Schritten. Ein Feature nach dem anderen.
- Prüfe, dass die App startet und funktioniert, bevor du sagst, dass etwas fertig ist.
- Mach nach jedem funktionierenden Schritt einen Git-Commit mit verständlicher Beschreibung auf Deutsch.

## Meine Daten sind heilig
- Meine Notizen dürfen nie verloren gehen.
- Wenn sich das Speicherformat ändert, müssen alte Daten automatisch übernommen werden.
- Es soll immer eine Export-Funktion geben (z. B. als JSON-Datei), damit ich ein Backup machen kann.

## Code
- TypeScript, React, Vite.
- Halte den Code einfach und gut lesbar, lieber etwas mehr Code als zu clevere Lösungen.
- Jedes Modul (Notizen, Kalender, Todos, ...) bekommt einen eigenen Ordner.
- Nutze verbreitete, gut gepflegte Bibliotheken statt alles selbst zu bauen.

---

## Projektwissen (für Claude)

### Befehle
- `npm run dev` – Entwicklung unter http://localhost:5173
- `npx tsc -b` – Typprüfung, `npm run lint` – Linter (oxlint)
- `npm run build` / `npm run preview` – fertige App bauen / lokal unter `/home/` testen
- GitHub-CLI liegt unter `~/.local/bin/gh` (nicht im PATH), angemeldet als `Marsl4`

### Aufbau
- `src/sections/index.ts` – Liste aller Bereiche (linke Leiste). Neuer Bereich = neuer Eintrag.
  Jeder Bereich hat einen Ordner unter `src/sections/<bereich>/` mit `Panel` (zweite Leiste),
  `View` (Hauptansicht) und optional `Provider` (Daten, über Context).
- `src/storage/db.ts` – **alles** Speichern läuft hier (IndexedDB über idb-keyval).
  `src/storage/backup.ts` – Export/Import aller Daten. `src/storage/uiState.ts` – Ansichts-Einstellungen (localStorage).
- `src/drawing/` – Stift-Logik (`useStrokeInput`), Zeichenschicht für Notizseiten (`DrawingLayer`, enthält
  auch die frei platzierbaren Bilder `FloatingImages`), Werkzeugleiste, Ausschnitte (`snip.ts`).
  Striche und Bilder hängen an einem Textblock (`anchorBlockId`/`anchorTop`) und wandern mit.
- Editor: BlockNote (`src/editor/schema.ts`). PDFs: pdf.js (`src/sections/pdfs/`).
- Split-Modus (`App.tsx`): ein oder zwei „Panes“, jede mit eigenem Bereich + Auswahl. Tastenkürzel und
  ⌘V nur in der aktiven Hälfte (`usePaneFocused()` aus `src/components/PaneContext.ts`). Ist derselbe
  Inhalt zweimal offen, gleichen sich die Ansichten über `src/storage/liveSync.ts` ab – neue Ansichten,
  die etwas speichern, müssen das auch tun (sonst überschreiben sie sich gegenseitig).
- KI (`src/ai/`): Gemini über `@google/genai`, direkt vom Gerät (kein Server). Schlüssel + Modell in
  localStorage (`aiConfig.ts`, bewusst nicht in IndexedDB/Backup). Anbieter-Spezifisches nur in `gemini.ts`.
  `context.ts` macht aus offener Notiz/PDF den mitgeschickten Text. Tests: Google per puppeteer-Request-
  Interception simulieren (Liste nutzt `supportedGenerationMethods`, Antworten als SSE).
- iPad-Eingabe: Im Stift-Modus zeichnen nur Stift/Maus (`pointerType !== "touch"`), Finger scrollen.
  Zoom (`src/components/usePinchZoom.ts`) nur im Blatt/PDF: Notizen per `transform: scale` (Positionen
  bleiben ungezoomt, Messung über `offsetTop`, Bildschirm-Deltas durch `zoom` teilen), PDFs per größerer
  Seitenbreite. Tests: CDP `Input.dispatchMouseEvent` mit `pointerType: "pen"`, `dispatchTouchEvent`.
- Freie Textfelder (`src/drawing/FloatingTexts.tsx`, Speicher `page-texts:`) liegen wie Bilder an Textblöcken;
  das Lasso wählt Striche, Bilder und Textfelder (`items` in `useStrokeInput`).
- Sync (`src/sync/`): Google Drive App-Ordner, eine Datei pro IndexedDB-Schlüssel. db.ts schreibt über
  `trackedSet`/`trackedDel` (vermerkt Änderungen + Grabsteine). Zusammenführen in `merge.ts` (Listen mit IDs
  vereinigen, sonst neuerer Stand). Heruntergeladenes wird per `publish` in offene Ansichten gegeben – Provider
  hören per `useLiveSync` auf ihre Listen. Neue gespeicherte Daten-Arten: in `merge.ts`/`isIdListKey` einordnen.
  Google-Zugang gilt 1 Stunde (Web-Apps bekommen keinen Dauer-Zugang). Test: `test35.mjs` (zwei Profile + Drive-Nachbau).
- Ältere Geräte: Das iPad läuft mit iPadOS 17.7 (Safari 17). pdf.js darum aus `pdfjs-dist/legacy/...`
  (die normale Ausgabe braucht Safari 18.4+). Neue Bibliotheken auf Safari-17-Tauglichkeit prüfen –
  Testskript `old-safari.mjs` im Scratchpad löscht neuere Browser-Funktionen in Chrome.
- Farben nur über die Variablen oben in `src/index.css` (`var(--text)`, `var(--surface)` …), keine
  festen Farbwerte – sonst passt es nicht zum dunklen Design. Schreibflächen (Notizblatt) bekommen
  die Klasse `light-surface` und bleiben immer hell. Hell/Dunkel/System: `src/sections/settings/ThemeProvider.tsx`.

### Datenregeln im Code
- Daten-Provider ändern Listen immer funktional (`update((current) => …)`), sonst gehen
  schnell hintereinander folgende Änderungen verloren.
- Neue Felder in gespeicherten Typen optional machen bzw. beim Laden mit Standardwert füllen,
  damit alte Daten weiter funktionieren. Unbekannte Editor-Blöcke werden beim Laden entfernt.
- Neue Speicher-Schlüssel landen automatisch im Backup (es sichert die ganze IndexedDB).

### Veröffentlichung
- Die App ist eine installierbare Web-App (PWA) namens „Home“, gehostet auf GitHub Pages
  unter `/home/` (Repo `Marsl4/home`, **öffentlich**). Jeder Push auf `main` veröffentlicht automatisch.
- Daher: keine persönlichen Daten, Notizen oder Zugangsdaten ins Repo. Commits mit der
  GitHub-Noreply-Adresse (ist in diesem Repo per `git config` eingestellt).
- Wunsch: keine Zusatzkosten (kein Apple Developer Program). Geplante Funktionen: `ROADMAP.md`.

### Testen
- Vor „fertig“: Typprüfung, Linter, Build und im Browser durchklicken (z. B. per puppeteer-core
  mit dem installierten Google Chrome, Testskripte im Scratchpad, nicht im Repo).
