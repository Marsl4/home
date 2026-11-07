// Einstellungen → Darstellung: Hell, Dunkel oder wie das System.
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useState } from "react";

import { usePersistentState } from "../../storage/uiState";
import { useTheme, type ThemeChoice } from "./ThemeContext";
import { applyTitleBarSpace, TITLEBAR_KEY, type TitleBarChoice } from "./titleBar";

const OPTIONS: { id: ThemeChoice; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "light", label: "Hell", hint: "Immer helles Design", icon: Sun },
  { id: "dark", label: "Dunkel", hint: "Immer dunkles Design", icon: Moon },
  { id: "system", label: "System", hint: "Wie dein Mac/iPad eingestellt ist", icon: Monitor },
];

export function AppearanceSettings() {
  const { choice, setChoice } = useTheme();
  const [titleBar, setTitleBar] = usePersistentState<TitleBarChoice>(TITLEBAR_KEY, "auto");
  const [, rerender] = useState(0);
  const chooseTitleBar = (next: TitleBarChoice) => {
    setTitleBar(next);
    applyTitleBarSpace(next);
    rerender((n) => n + 1);
  };

  return (
    <div className="settings">
      <h1>Darstellung</h1>
      <p className="settings-intro">
        Im dunklen Design bleiben das Notizblatt und PDF-Seiten hell, damit Schrift und Farben gut
        lesbar sind.
      </p>

      <div className="theme-options">
        {OPTIONS.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            className={`theme-option ${choice === id ? "selected" : ""}`}
            onClick={() => setChoice(id)}
          >
            <Icon size={22} />
            <span className="theme-option-label">{label}</span>
            <span className="theme-option-hint">{hint}</span>
          </button>
        ))}
      </div>

      <section className="settings-card" style={{ marginTop: 24 }}>
        <div>
          <h2>Platz für die Fensterleiste (Mac-App)</h2>
          <p>
            Legt Safari seine Leiste oben über die App, lässt die App dort Platz. „Automatisch“ erkennt das
            selbst – falls oben trotzdem etwas verdeckt ist, „An“ wählen.
          </p>
        </div>
        <div className="segmented">
          {(["auto", "on", "off"] as const).map((option) => (
            <button key={option} className={titleBar === option ? "selected" : ""} onClick={() => chooseTitleBar(option)}>
              {option === "auto" ? "Automatisch" : option === "on" ? "An" : "Aus"}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
