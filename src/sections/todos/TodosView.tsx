// Hauptansicht im ToDo-Bereich: Eingabe für neue Aufgaben + gruppierte Liste.
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import type { Todo } from "../../storage/db";
import type { SectionProps } from "../types";
import { formatDateKey, formatLongToday, todayKey } from "./dates";
import { filterTodos, TODO_VIEWS, useTodos, type TodoFilter } from "./TodosContext";

type Group = { title: string; todos: Todo[]; overdue?: boolean };

// Offene Aufgaben nach Datum gruppieren: Überfällig, Heute, Morgen, … , Ohne Datum.
function groupByDate(todos: Todo[]): Group[] {
  const today = todayKey();
  const overdue = todos.filter((t) => t.dueDate && t.dueDate < today);
  const dated = todos.filter((t) => t.dueDate && t.dueDate >= today);
  const undated = todos.filter((t) => !t.dueDate);

  const groups: Group[] = [];
  if (overdue.length) groups.push({ title: "Überfällig", todos: overdue, overdue: true });

  const dates = [...new Set(dated.map((t) => t.dueDate!))].sort();
  for (const date of dates) {
    groups.push({ title: formatDateKey(date), todos: dated.filter((t) => t.dueDate === date) });
  }

  if (undated.length) groups.push({ title: "Ohne Datum", todos: undated });
  return groups;
}

export function TodosView({ selectedId }: SectionProps) {
  const { todos, addTodo, clearDone } = useTodos();
  const filter = (selectedId ?? "today") as TodoFilter;
  const view = TODO_VIEWS.find((v) => v.id === filter) ?? TODO_VIEWS[0];
  const visible = filterTodos(todos, filter);

  const groups: Group[] =
    filter === "done" ? [{ title: "", todos: visible }] : groupByDate(visible);

  return (
    <div className="todos">
      <header className="todos-header">
        <h1>{view.label}</h1>
        {filter === "today" && (
          <p>{formatLongToday()}</p>
        )}
      </header>

      {filter !== "done" && (
        // Neue Aufgaben in "Heute" bekommen automatisch das heutige Datum.
        <NewTodoInput key={filter} defaultDate={filter === "today" ? todayKey() : null} onAdd={addTodo} />
      )}

      {visible.length === 0 && (
        <p className="todos-empty">
          {filter === "done" ? "Noch nichts erledigt." : "Keine offenen Aufgaben. 🎉"}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.title} className="todo-group">
          {group.title && (
            <h2 className={group.overdue ? "overdue" : undefined}>{group.title}</h2>
          )}
          {group.todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} />
          ))}
        </section>
      ))}

      {filter === "done" && visible.length > 0 && (
        <button className="text-button" onClick={clearDone}>
          Erledigte löschen
        </button>
      )}
    </div>
  );
}

function NewTodoInput({
  defaultDate,
  onAdd,
}: {
  defaultDate: string | null;
  onAdd: (title: string, dueDate: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), date || null);
    setTitle(""); // Datum bleibt stehen, praktisch für mehrere Aufgaben am selben Tag
  };

  return (
    <form className="todo-new" onSubmit={submit}>
      <Plus size={18} className="todo-new-icon" />
      <input
        className="todo-new-title"
        placeholder="Neue Aufgabe … (Enter zum Speichern)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="date"
        className="todo-date-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title="Fällig am"
      />
    </form>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  const { updateTodo, deleteTodo } = useTodos();
  const overdue = !todo.done && todo.dueDate !== null && todo.dueDate < todayKey();

  return (
    <div className={`todo-row ${todo.done ? "done" : ""}`}>
      <button
        className="todo-check"
        onClick={() => updateTodo(todo.id, { done: !todo.done, doneAt: todo.done ? null : Date.now() })}
        title={todo.done ? "Wieder öffnen" : "Erledigt"}
      >
        {todo.done && <Check size={13} strokeWidth={3} />}
      </button>

      <input
        className="todo-title"
        value={todo.title}
        onChange={(e) => updateTodo(todo.id, { title: e.target.value })}
      />

      <input
        type="date"
        className={`todo-date-input ${overdue ? "overdue" : ""} ${todo.dueDate ? "" : "empty"}`}
        value={todo.dueDate ?? ""}
        onChange={(e) => updateTodo(todo.id, { dueDate: e.target.value || null })}
        title="Fällig am"
      />

      <button className="todo-delete" onClick={() => deleteTodo(todo.id)} title="Löschen">
        <X size={15} />
      </button>
    </div>
  );
}
