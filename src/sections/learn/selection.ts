// Was im Lern-Bereich offen ist, steckt im Auswahl-Text:
//   null                → Übersicht
//   "today"             → alle heute fälligen Karten lernen
//   "quiz"              → Abfragemodus (KI stellt Fragen)
//   "deck:<id>"         → ein Stapel (Karten ansehen, hinzufügen, mit KI erstellen)
//   "deck:<id>:learn"   → diesen Stapel lernen
//   "mindmap:<id>"      → eine Mindmap
export type LearnSelection =
  | { kind: "overview" }
  | { kind: "today" }
  | { kind: "quiz" }
  | { kind: "deck"; id: string; learning: boolean }
  | { kind: "mindmap"; id: string };

export function parseLearnSelection(selectedId: string | null): LearnSelection {
  if (selectedId === "today") return { kind: "today" };
  if (selectedId === "quiz") return { kind: "quiz" };
  if (selectedId?.startsWith("deck:")) {
    const [, id, mode] = selectedId.split(":");
    return { kind: "deck", id, learning: mode === "learn" };
  }
  if (selectedId?.startsWith("mindmap:")) return { kind: "mindmap", id: selectedId.slice(8) };
  return { kind: "overview" };
}

export const mindmapSelection = (id: string) => `mindmap:${id}`;

export const deckSelection = (id: string, learning = false) => `deck:${id}${learning ? ":learn" : ""}`;
