// Grundlayout: [Bereiche-Leiste] [zweite Leiste mit Unterbereichen] [Hauptansicht]
import type { ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";

import { SectionRail } from "./components/SectionRail";
import { sections } from "./sections";
import { usePersistentState } from "./storage/uiState";

// Alle Daten-Provider der Bereiche ineinander schachteln, damit jeder Bereich seine Daten hat.
function SectionProviders({ children }: { children: ReactNode }) {
  return sections.reduceRight<ReactNode>(
    (inner, { id, Provider }) => (Provider ? <Provider key={id}>{inner}</Provider> : inner),
    children,
  );
}

export default function App() {
  const [activeId, setActiveId] = usePersistentState("ui:section", sections[0].id);
  const [panelOpen, setPanelOpen] = usePersistentState("ui:panelOpen", true);
  // Pro Bereich: welcher Unterbereich zuletzt offen war.
  const [selection, setSelection] = usePersistentState<Record<string, string | null>>(
    "ui:selection",
    {},
  );

  const section = sections.find((s) => s.id === activeId) ?? sections[0];
  const sectionProps = {
    section,
    selectedId: selection[section.id] ?? null,
    onSelect: (id: string | null) => setSelection({ ...selection, [section.id]: id }),
  };

  // Klick auf einen Bereich: öffnen. Klick auf den schon offenen Bereich: zweite Leiste ein-/ausklappen.
  const handleRailClick = (id: string) => {
    if (id === section.id) {
      setPanelOpen(!panelOpen);
    } else {
      setActiveId(id);
      setPanelOpen(true);
    }
  };

  const { Panel, View } = section;

  return (
    <SectionProviders>
      <div className="app">
        <SectionRail sections={sections} activeId={section.id} onClick={handleRailClick} />

        {panelOpen && (
          <aside className="panel">
            <header className="panel-header">
              <span>{section.label}</span>
              <button
                className="icon-button"
                onClick={() => setPanelOpen(false)}
                title="Leiste einklappen"
              >
                <PanelLeftClose size={16} />
              </button>
            </header>
            <Panel key={section.id} {...sectionProps} />
          </aside>
        )}

        <main className="main">
          <View key={section.id} {...sectionProps} />
        </main>
      </div>
    </SectionProviders>
  );
}
