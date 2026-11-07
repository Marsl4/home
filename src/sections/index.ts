// Alle Hauptbereiche der App, in der Reihenfolge der linken Leiste.
// Neuen Bereich hinzufügen = hier einen Eintrag ergänzen.
// Bereiche, die noch nicht fertig sind, nutzen PlaceholderPanel/PlaceholderView.
import { CalendarDays, Dumbbell, FileText, GraduationCap, ListTodo, NotebookPen } from "lucide-react";

import { NotesPanel } from "./notes/NotesPanel";
import { NotesView } from "./notes/NotesView";
import { PlaceholderPanel } from "./placeholder/PlaceholderPanel";
import { PlaceholderView } from "./placeholder/PlaceholderView";
import type { Section } from "./types";

export const sections: Section[] = [
  {
    id: "notes",
    label: "Notizen",
    icon: NotebookPen,
    Panel: NotesPanel,
    View: NotesView,
  },
  {
    id: "uni",
    label: "Uni",
    icon: GraduationCap,
    subItems: [
      { id: "subjects", label: "Fächer" },
      { id: "timetable", label: "Stundenplan" },
      { id: "exams", label: "Prüfungen" },
      { id: "papers", label: "Hausarbeiten" },
    ],
    Panel: PlaceholderPanel,
    View: PlaceholderView,
  },
  {
    id: "pdfs",
    label: "PDFs",
    icon: FileText,
    subItems: [
      { id: "all", label: "Alle PDFs" },
      { id: "recent", label: "Zuletzt geöffnet" },
      { id: "favorites", label: "Favoriten" },
    ],
    Panel: PlaceholderPanel,
    View: PlaceholderView,
  },
  {
    id: "calendar",
    label: "Kalender",
    icon: CalendarDays,
    subItems: [
      { id: "day", label: "Tag" },
      { id: "week", label: "Woche" },
      { id: "month", label: "Monat" },
    ],
    Panel: PlaceholderPanel,
    View: PlaceholderView,
  },
  {
    id: "todos",
    label: "ToDos",
    icon: ListTodo,
    subItems: [
      { id: "today", label: "Heute" },
      { id: "upcoming", label: "Anstehend" },
      { id: "done", label: "Erledigt" },
    ],
    Panel: PlaceholderPanel,
    View: PlaceholderView,
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: Dumbbell,
    subItems: [
      { id: "training", label: "Training" },
      { id: "nutrition", label: "Ernährung" },
      { id: "progress", label: "Fortschritt" },
    ],
    Panel: PlaceholderPanel,
    View: PlaceholderView,
  },
];
