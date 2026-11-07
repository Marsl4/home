import type { FC } from "react";
import type { LucideIcon } from "lucide-react";

// Ein Unterbereich in der zweiten Seitenleiste (z. B. "Woche" im Kalender).
export type SubItem = {
  id: string;
  label: string;
};

// Was jede Bereichs-Ansicht und -Leiste von der App bekommt.
export type SectionProps = {
  section: Section;
  selectedId: string | null; // welcher Unterbereich gerade offen ist
  onSelect: (id: string | null) => void;
};

// Ein Hauptbereich der App (linke Leiste), z. B. Notizen oder Kalender.
export type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  subItems?: SubItem[]; // feste Unterbereiche (für Bereiche ohne eigene Leiste)
  Panel: FC<SectionProps>; // Inhalt der zweiten Seitenleiste
  View: FC<SectionProps>; // Inhalt der großen Fläche rechts
};
