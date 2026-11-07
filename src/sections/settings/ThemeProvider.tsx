// Merkt sich die Auswahl Hell/Dunkel/System und setzt sie auf der ganzen Seite um:
// <html data-theme="light|dark">. Die Farben dazu stehen in index.css.
import { useEffect, type ReactNode } from "react";

import { usePersistentState } from "../../storage/uiState";
import { THEME_STORAGE_KEY, ThemeContext, type ThemeChoice } from "./ThemeContext";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = usePersistentState<ThemeChoice>(THEME_STORAGE_KEY, "system");

  useEffect(() => {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = choice === "dark" || (choice === "system" && systemDark.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      // Farbe der Fenster-/Statusleiste der installierten App anpassen.
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1b1b1d" : "#ffffff");
    };
    apply();
    // Bei "System": automatisch mitwechseln, wenn der Mac/das iPad umschaltet.
    systemDark.addEventListener("change", apply);
    return () => systemDark.removeEventListener("change", apply);
  }, [choice]);

  return <ThemeContext.Provider value={{ choice, setChoice }}>{children}</ThemeContext.Provider>;
}
