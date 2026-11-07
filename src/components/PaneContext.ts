// Im Split-Modus gibt es zwei Hälften ("Panes"). Nur die aktive Hälfte soll auf Tastenkürzel
// (⌘Z, ⌫, Esc) und Einfügen (⌘V) reagieren – sonst würde beides doppelt passieren.
import { createContext, useContext } from "react";

export const PaneFocusContext = createContext<boolean>(true);

// true = diese Hälfte ist aktiv (bzw. es gibt nur eine).
export function usePaneFocused(): boolean {
  return useContext(PaneFocusContext);
}
