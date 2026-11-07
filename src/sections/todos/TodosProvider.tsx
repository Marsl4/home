// Lädt die Aufgaben und stellt Funktionen zum Anlegen/Ändern/Löschen bereit.
import { useEffect, useState, type ReactNode } from "react";

import { loadTodos, saveTodos, type Todo } from "../../storage/db";
import { TodosContext } from "./TodosContext";

export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[] | null>(null); // null = lädt noch

  useEffect(() => {
    loadTodos().then(setTodos);
  }, []);

  if (todos === null) return null;

  // Jede Änderung sofort speichern.
  const update = (next: Todo[]) => {
    setTodos(next);
    saveTodos(next);
  };

  const value = {
    todos,
    addTodo: (title: string, dueDate: string | null) =>
      update([
        ...todos,
        { id: crypto.randomUUID(), title, done: false, dueDate, createdAt: Date.now(), doneAt: null },
      ]),
    updateTodo: (id: string, changes: Partial<Todo>) =>
      update(todos.map((t) => (t.id === id ? { ...t, ...changes } : t))),
    deleteTodo: (id: string) => update(todos.filter((t) => t.id !== id)),
    clearDone: () => update(todos.filter((t) => !t.done)),
  };

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}
