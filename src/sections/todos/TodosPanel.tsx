// Zweite Seitenleiste im ToDo-Bereich: Heute / Anstehend / Erledigt mit Anzahl.
import type { SectionProps } from "../types";
import { filterTodos, TODO_VIEWS, useTodos } from "./TodosContext";

export function TodosPanel({ selectedId, onSelect }: SectionProps) {
  const { todos } = useTodos();
  const activeId = selectedId ?? "today";

  return (
    <nav className="panel-list">
      {TODO_VIEWS.map(({ id, label, icon: Icon }) => {
        const count = filterTodos(todos, id).length;
        return (
          <button
            key={id}
            className={`panel-item ${id === activeId ? "active" : ""}`}
            onClick={() => onSelect(id)}
          >
            <Icon size={15} className="panel-item-icon" />
            <span className="panel-item-label">{label}</span>
            {id !== "done" && count > 0 && <span className="panel-item-count">{count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
