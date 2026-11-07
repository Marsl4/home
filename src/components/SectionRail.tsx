// Schmale Leiste ganz links mit den Hauptbereichen.
import type { Section } from "../sections/types";

type Props = {
  sections: Section[];
  activeId: string;
  onClick: (id: string) => void;
};

export function SectionRail({ sections, activeId, onClick }: Props) {
  return (
    <nav className="rail">
      {sections.map((section) => {
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
      })}
    </nav>
  );
}
