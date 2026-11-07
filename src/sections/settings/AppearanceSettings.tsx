// Einstellungen → Darstellung: Hell, Dunkel oder wie das System.
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { useTheme, type ThemeChoice } from "./ThemeContext";

const OPTIONS: { id: ThemeChoice; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "light", label: "Hell", hint: "Immer helles Design", icon: Sun },
  { id: "dark", label: "Dunkel", hint: "Immer dunkles Design", icon: Moon },
  { id: "system", label: "System", hint: "Wie dein Mac/iPad eingestellt ist", icon: Monitor },
];

export function AppearanceSettings() {
  const { choice, setChoice } = useTheme();

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
    </div>
  );
}
