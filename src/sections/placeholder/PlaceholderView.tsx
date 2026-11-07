// Hauptansicht für Bereiche, die noch nicht fertig sind.
import type { SectionProps } from "../types";

export function PlaceholderView({ section, selectedId }: SectionProps) {
  const items = section.subItems ?? [];
  const item = items.find((i) => i.id === selectedId) ?? items[0];
  const Icon = section.icon;

  return (
    <div className="placeholder-view">
      <div className="placeholder-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h1>
        {section.label}
        {item && <span className="placeholder-sub"> · {item.label}</span>}
      </h1>
      <p>Dieser Bereich kommt bald.</p>
    </div>
  );
}
