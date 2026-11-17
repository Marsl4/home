// Was im Lern-Bereich offen ist, steckt im Auswahl-Text:
//   null                → Übersicht
//   "today"             → alle heute fälligen Karten lernen
//   "deck:<id>"         → ein Stapel (Karten ansehen, hinzufügen, mit KI erstellen)
//   "deck:<id>:learn"   → diesen Stapel lernen
export type LearnSelection =
  | { kind: "overview" }
  | { kind: "today" }
  | { kind: "deck"; id: string; learning: boolean };

export function parseLearnSelection(selectedId: string | null): LearnSelection {
  if (selectedId === "today") return { kind: "today" };
  if (selectedId?.startsWith("deck:")) {
    const [, id, mode] = selectedId.split(":");
    return { kind: "deck", id, learning: mode === "learn" };
  }
  return { kind: "overview" };
}

export const deckSelection = (id: string, learning = false) => `deck:${id}${learning ? ":learn" : ""}`;
