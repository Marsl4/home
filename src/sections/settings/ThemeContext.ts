// Hell / Dunkel / wie das System (Mac/iPad-Einstellung).
import { createContext, useContext } from "react";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "ui:theme";

export type ThemeState = {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
};

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme muss innerhalb von <ThemeProvider> benutzt werden");
  return theme;
}
