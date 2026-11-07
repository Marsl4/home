// Kleine Helfer für Datumsangaben im Format "JJJJ-MM-TT" (lokale Zeit, nicht UTC).

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function tomorrowKey(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateKey(date);
}

// "Heute", "Morgen", "Gestern" oder z. B. "Mo., 10. Nov."
export function formatDateKey(key: string): string {
  if (key === todayKey()) return "Heute";
  if (key === tomorrowKey()) return "Morgen";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === toDateKey(yesterday)) return "Gestern";

  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// z. B. "Samstag, 7. November"
export function formatLongToday(): string {
  return new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}
