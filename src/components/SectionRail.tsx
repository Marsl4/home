// Schmale Leiste ganz links mit den Hauptbereichen.
import { Columns2, Sparkles } from "lucide-react";

import type { Section } from "../sections/types";
import { SyncButton } from "../sync/SyncButton";

type Props = {
  sections: Section[];
  activeId: string;
  onClick: (id: string) => void;
  isSplit: boolean;
  onToggleSplit: () => void;
  aiOpen: boolean;
  onToggleAi: () => void;
  onOpenSyncSettings: () => void;
};

export function SectionRail({ sections, activeId, onClick, isSplit, onToggleSplit, aiOpen, onToggleAi, onOpenSyncSettings }: Props) {
  const renderItem = (section: Section) => {
    const Icon = section.icon;
    return (
      <button
        key={section.id}
        className={`rail-item ${section.id === activeId ? "active" : ""}`}
        onClick={() => onClick(section.id)}
        title={section.label}
      >
        <Icon size={20} strokeWidth={1.75} />
        <span className="rail-label">{section.label}</span>
      </button>
    );
  };

  return (
    <nav className="rail">
      {sections.filter((s) => s.placement !== "bottom").map(renderItem)}
      <div className="rail-spacer" />
      <SyncButton onOpenSettings={onOpenSyncSettings} />
      <button
        className={`rail-item ${aiOpen ? "active" : ""}`}
        onClick={onToggleAi}
        title={aiOpen ? "KI-Leiste schließen" : "KI-Assistent öffnen"}
      >
        <Sparkles size={20} strokeWidth={1.75} />
        <span className="rail-label">KI</span>
      </button>
      <button
        className={`rail-item ${isSplit ? "active" : ""}`}
        onClick={onToggleSplit}
        title={isSplit ? "Zweite Hälfte schließen" : "Zwei Hälften nebeneinander"}
      >
        <Columns2 size={20} strokeWidth={1.75} />
        <span className="rail-label">Teilen</span>
      </button>
      {sections.filter((s) => s.placement === "bottom").map(renderItem)}
    </nav>
  );
}
