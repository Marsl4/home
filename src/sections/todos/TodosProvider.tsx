// Lädt die Aufgaben und stellt Funktionen zum Anlegen/Ändern/Löschen bereit.
import { useEffect, useState, type ReactNode } from "react";

import { loadTodos, saveTodos, type Todo } from "../../storage/db";
import { useLiveSync } from "../../storage/liveSync";
import { TodosContext } from "./TodosContext";

export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[] | null>(null); // null = lädt noch
  useLiveSync<Todo[]>("todos", setTodos); // vom anderen Gerät (Sync)

  useEffect(() => {
    loadTodos().then(setTodos);
  }, []);

  if (todos === null) return null;

  // Jede Änderung baut auf dem neuesten Stand auf und wird sofort gespeichert.
  const update = (change: (current: Todo[]) => Todo[]) =>
    setTodos((current) => {
      const next = change(current ?? []);
      saveTodos(next);
      return next;
    });

  const value = {
    todos,
    addTodo: (title: string, dueDate: string | null) =>
      update((current) => [
        ...current,
        { id: crypto.randomUUID(), title, done: false, dueDate, createdAt: Date.now(), doneAt: null },
      ]),
    updateTodo: (id: string, changes: Partial<Todo>) =>
      update((current) => current.map((t) => (t.id === id ? { ...t, ...changes } : t))),
    deleteTodo: (id: string) => update((current) => current.filter((t) => t.id !== id)),
    clearDone: () => update((current) => current.filter((t) => !t.done)),
  };

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}
