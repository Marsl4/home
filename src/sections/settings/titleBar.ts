// Mac-Web-App (Safari "Zum Dock hinzufügen"): Neuere Safari-Versionen legen die Fensterleiste oben
// (Titel, Pfeile, Teilen …) ÜBER die App, ohne Bescheid zu sagen. Dann wäre oben etwas verdeckt.
// Erkennung: Liegt die Leiste über der App, ist das Fenster innen genauso hoch wie außen.
// Dann lässt die App oben Platz (CSS-Variable --titlebar-space).
// In Einstellungen → Darstellung kann man das auch fest an- oder ausschalten.
import { readStored } from "../../storage/uiState";

export type TitleBarChoice = "auto" | "on" | "off";
export const TITLEBAR_KEY = "ui:titlebarSpace";
const SPACE = "44px"; // Höhe der Safari-Leiste

function detectOverlay(): boolean {
  const standalone = matchMedia("(display-mode: standalone)").matches;
  const desktop = matchMedia("(pointer: fine)").matches && !("ontouchend" in document);
  const outerMinusInner = window.outerHeight - window.innerHeight;
  return standalone && desktop && outerMinusInner < 8;
}

export function applyTitleBarSpace(choice: TitleBarChoice = readStored<TitleBarChoice>(TITLEBAR_KEY, "auto")) {
  const on = choice === "on" || (choice === "auto" && detectOverlay());
  document.documentElement.style.setProperty("--titlebar-space", on ? SPACE : "0px");
}

// Beim Start und bei jeder Größenänderung (z. B. wenn man in Safari die Leiste umschaltet) neu prüfen.
export function initTitleBarSpace() {
  applyTitleBarSpace();
  window.addEventListener("resize", () => applyTitleBarSpace());
}
