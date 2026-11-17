# Vorlage: Hausarbeit oder Präsentation

Mit dieser Vorlage entstehen Hausarbeiten und Präsentationen in VS Code mit Claude – und erscheinen
automatisch in der Home-App unter **Uni → Hausarbeiten** bzw. **Uni → Präsentationen**.

## Einmalig: Home-App mit GitHub verbinden
In der Home-App **Einstellungen → GitHub** öffnen und der Anleitung dort folgen (Lese-Schlüssel erstellen
und einfügen). Auf dem iPad den Schlüssel ebenfalls einmal eintragen.

## Neues Projekt starten
1. In VS Code einen neuen, leeren Ordner öffnen (z. B. `Hausarbeit Steuerrecht`).
2. Claude im Chat sagen:

   > Leg hier ein neues Uni-Projekt nach der Vorlage in
   > `~/Desktop/VS-COde/Projekt/vorlagen/projekt` an. Es ist eine Hausarbeit (bzw. Präsentation).

   Claude kopiert `CLAUDE.md` und `home.json`, fragt nach Titel, Abgabe und Vorgaben, richtet alles ein und
   legt das Projekt **privat** auf GitHub an.
3. In der Home-App unter Uni → Hausarbeiten auf **„Aktualisieren“** tippen – das Projekt erscheint.

## Danach
Einfach mit Claude arbeiten. Nach jedem Schritt aktualisiert Claude den Stand (`home.json`), baut das PDF neu
und speichert alles auf GitHub. Die Home-App zeigt dann immer das Neueste – mit Abgabetermin, Fortschritt,
Aufgaben, letzten Änderungen und dem PDF (auch ältere Fassungen, mit Stift-Notizen).
