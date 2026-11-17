// Was bei Hausarbeiten/Präsentationen offen ist, steckt im Auswahl-Text des Uni-Bereichs:
//   "papers"                         → Liste der Hausarbeiten
//   "papers:<besitzer>/<repo>"       → ein Projekt
//   "papers:<besitzer>/<repo>:latest" → sein Ergebnis-PDF (neueste Fassung; sonst Kennung des Stands)
// (Für Präsentationen dasselbe mit "presentations".) Repository-Namen enthalten nie ":".
import type { ProjectType } from "./github";

const PREFIX: Record<ProjectType, string> = { hausarbeit: "papers", praesentation: "presentations" };

export function parseProjectSelection(id: string): { typ: ProjectType; repo: string | null; version: string | null } | null {
  const [prefix, repo, version] = id.split(":");
  const typ = (Object.keys(PREFIX) as ProjectType[]).find((t) => PREFIX[t] === prefix);
  if (!typ) return null;
  return { typ, repo: repo || null, version: version || null };
}

export function projectSelection(typ: ProjectType, repo: string | null, version?: string | null): string {
  return [PREFIX[typ], repo, repo && version].filter(Boolean).join(":");
}
