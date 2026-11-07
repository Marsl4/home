// Alle Hauptbereiche der App, in der Reihenfolge der linken Leiste.
// Neuen Bereich hinzufügen = hier einen Eintrag ergänzen.
// Bereiche, die noch nicht fertig sind, nutzen PlaceholderPanel/PlaceholderView.
import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  FileText,
  GraduationCap,
  ListTodo,
  NotebookPen,
  PenLine,
  Palette,
  Settings,
  Sparkles,
  DatabaseBackup,
  Cloud,
} from "lucide-react";

import { NotesPanel } from "./notes/NotesPanel";
import { NotesProvider } from "./notes/NotesProvider";
import { NotesView } from "./notes/NotesView";
import { PdfsPanel } from "./pdfs/PdfsPanel";
import { PdfsProvider } from "./pdfs/PdfsProvider";
import { PdfsView } from "./pdfs/PdfsView";
import { PlaceholderPanel } from "./placeholder/PlaceholderPanel";
import { PlaceholderView } from "./placeholder/PlaceholderView";
import { TodosPanel } from "./todos/TodosPanel";
import { TodosProvider } from "./todos/TodosProvider";
import { TodosView } from "./todos/TodosView";
import { SettingsView } from "./settings/SettingsView";
import { ThemeProvider } from "./settings/ThemeProvider";
import type { Section } from "./types";
import { UniPanel } from "./uni/UniPanel";
import { UniView } from "./uni/UniView";

export const sections: Section[] = [
  {
    id: "notes",
    label: "Notizen",
    icon: NotebookPen,
    Panel: NotesPanel,
    View: NotesView,
    Provider: NotesProvider,
  },
  {
    id: "uni",
    label: "Uni",
    icon: GraduationCap,
    // Fächer kommen aus den Daten; das hier sind die festen Unterbereiche unter "Planung".
    subItems: [
      { id: "timetable", label: "Stundenplan", icon: CalendarDays },
      { id: "exams", label: "Prüfungen", icon: ClipboardCheck },
      { id: "papers", label: "Hausarbeiten", icon: PenLine },
    ],
    Panel: UniPanel,
    View: UniView,
  },
  {
    id: "pdfs",
    label: "PDFs",
    icon: FileText,
    Panel: PdfsPanel,
    View: PdfsView,
    Provider: PdfsProvider,
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
    Panel: TodosPanel,
    View: TodosView,
    Provider: TodosProvider,
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
  {
    id: "settings",
    label: "Einstellungen",
    icon: Settings,
    placement: "bottom",
    subItems: [
      { id: "backup", label: "Daten & Backup", icon: DatabaseBackup },
      { id: "appearance", label: "Darstellung", icon: Palette },
      { id: "ai", label: "KI", icon: Sparkles },
      { id: "account", label: "Konto & Sync", icon: Cloud },
    ],
    Panel: PlaceholderPanel,
    View: SettingsView,
    Provider: ThemeProvider,
  },
];
