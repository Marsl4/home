// Zweite Seitenleiste für Bereiche, die noch nicht fertig sind: zeigt die festen Unterbereiche.
import type { SectionProps } from "../types";

export function PlaceholderPanel({ section, selectedId, onSelect }: SectionProps) {
  const items = section.subItems ?? [];
  const activeId = selectedId ?? items[0]?.id;

  return (
    <nav className="panel-list">
      {items.map((item) => (
        <button
          key={item.id}
          className={`panel-item ${item.id === activeId ? "active" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          {item.icon && <item.icon size={15} className="panel-item-icon" />}
          <span className="panel-item-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
