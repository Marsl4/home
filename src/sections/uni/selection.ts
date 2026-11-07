// Was im Uni-Bereich gerade offen ist, steckt in einem Text wie "subject:<id>" (Ordner),
// "page:<id>" (Notiz) oder "pdf:<id>".
// Alles andere (z. B. "timetable") ist einer der festen Unterbereiche.

export type UniSelection =
  | { kind: "subject"; id: string }
  | { kind: "page"; id: string }
  | { kind: "pdf"; id: string }
  | { kind: "other"; id: string }
  | { kind: "none" };

export const subjectSelection = (id: string) => `subject:${id}`;
export const pageSelection = (id: string) => `page:${id}`;
export const pdfSelection = (id: string) => `pdf:${id}`;

export function parseSelection(selectedId: string | null): UniSelection {
  if (!selectedId) return { kind: "none" };
  if (selectedId.startsWith("subject:")) return { kind: "subject", id: selectedId.slice(8) };
  if (selectedId.startsWith("page:")) return { kind: "page", id: selectedId.slice(5) };
  if (selectedId.startsWith("pdf:")) return { kind: "pdf", id: selectedId.slice(4) };
  return { kind: "other", id: selectedId };
}
