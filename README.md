# Studium-App

Notizen mit Text und Zeichnungen, lokal im Browser.

## Starten

Im Terminal im Projektordner:

```
npm run dev
```

Dann im Browser **http://localhost:5173** öffnen. Beenden mit `Ctrl + C` im Terminal.

(Nur beim allerersten Mal bzw. nach dem Herunterladen auf einen neuen Rechner vorher `npm install` ausführen.)

## Bedienung

- **Neue Seite:** "+ Neue Seite" unten in der Seitenleiste
- **Umbenennen:** oben auf der Seite in den großen Titel klicken
- **Löschen:** in der Seitenleiste mit der Maus über die Seite fahren → "×"
- **Blöcke einfügen:** `/` tippen (Überschriften, Listen, Tabellen, Bilder …)
- **Zeichnen:** oben rechts auf "✏️ Zeichnen" → überall auf der Seite malen (Stift, Textmarker,
  Radierer, Farben). `⌘Z` = rückgängig, `Esc` oder "Fertig" = zurück zum Tippen.
  Striche hängen am Text daneben und wandern mit, wenn du darüber Zeilen einfügst.
- **Speichern:** passiert automatisch (im Browser, in IndexedDB)

## Aufbau des Codes

| Datei | Aufgabe |
|---|---|
| `src/App.tsx` | Hauptlayout, Seitenverwaltung |
| `src/components/Sidebar.tsx` | Seitenleiste |
| `src/components/PageEditor.tsx` | Editor für eine Seite + automatisches Speichern |
| `src/editor/schema.ts` | Welche Blöcke es im Editor gibt |
| `src/drawing/DrawingLayer.tsx` | Zeichenschicht über der Seite (Zeichnen, Mitwandern, Speichern) |
| `src/drawing/DrawingToolbar.tsx` | Werkzeugleiste oben rechts |
| `src/drawing/strokes.ts` | Format und Aussehen der Striche |
| `src/storage/db.ts` | Alles rund ums Speichern |

## Wichtig

Die Daten liegen nur in **diesem Browser** auf **diesem Mac**. Wer die Browserdaten
löscht (oder einen anderen Browser nimmt), sieht die Notizen nicht. Backup/Sync kommt später.
