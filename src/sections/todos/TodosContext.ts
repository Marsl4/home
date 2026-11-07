// Gemeinsamer Zustand des ToDo-Bereichs, den Leiste (Zähler) und Ansicht (Liste) brauchen.
import { createContext, useContext } from "react";
import { CalendarClock, CircleCheck, Sun, type LucideIcon } from "lucide-react";
import type { Todo } from "../../storage/db";
import { todayKey } from "./dates";

export type TodosState = {
  todos: Todo[];
  addTodo: (title: string, dueDate: string | null) => void;
  updateTodo: (id: string, changes: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  clearDone: () => void;
};

export const TodosContext = createContext<TodosState | null>(null);

export function useTodos(): TodosState {
  const todos = useContext(TodosContext);
  if (!todos) throw new Error("useTodos muss innerhalb von <TodosProvider> benutzt werden");
  return todos;
}

// Die drei Ansichten (= Unterbereiche in der Leiste) und welche Aufgaben dazugehören.
export type TodoFilter = "today" | "upcoming" | "done";

export const TODO_VIEWS: { id: TodoFilter; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Heute", icon: Sun },
  { id: "upcoming", label: "Anstehend", icon: CalendarClock },
  { id: "done", label: "Erledigt", icon: CircleCheck },
];

export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  const today = todayKey();
  switch (filter) {
    case "today": // fällig heute oder überfällig
      return todos.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= today);
    case "upcoming": // alle offenen
      return todos.filter((t) => !t.done);
    case "done":
      return todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  }
}
