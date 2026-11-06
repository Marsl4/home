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
- **Blöcke einfügen:** `/` tippen (Überschriften, Listen, Tabellen, Bilder, **Zeichnung** …)
- **Speichern:** passiert automatisch (im Browser, in IndexedDB)

## Aufbau des Codes

| Datei | Aufgabe |
|---|---|
| `src/App.tsx` | Hauptlayout, Seitenverwaltung |
| `src/components/Sidebar.tsx` | Seitenleiste |
| `src/components/PageEditor.tsx` | Editor für eine Seite + automatisches Speichern |
| `src/editor/schema.tsx` | Welche Blöcke es gibt + Einträge im "/"-Menü |
| `src/editor/DrawingBlock.tsx` | Zeichen-Block (Excalidraw) |
| `src/storage/db.ts` | Alles rund ums Speichern |

## Wichtig

Die Daten liegen nur in **diesem Browser** auf **diesem Mac**. Wer die Browserdaten
löscht (oder einen anderen Browser nimmt), sieht die Notizen nicht. Backup/Sync kommt später.
