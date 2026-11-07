// Grundlayout: [Bereiche-Leiste] [zweite Leiste mit Unterbereichen] [eine oder zwei Hälften]
// Im Split-Modus zeigt jede Hälfte ("Pane") ihren eigenen Bereich. Die Leisten links steuern
// immer die aktive Hälfte (die, in die zuletzt geklickt wurde).
import { useRef, type ReactNode } from "react";
import { PanelLeftClose, X } from "lucide-react";

import { AiSidebar } from "./ai/AiSidebar";
import { PaneFocusContext } from "./components/PaneContext";
import { SectionRail } from "./components/SectionRail";
import { ToastHost } from "./components/ToastHost";
import { sections } from "./sections";
import { readStored, usePersistentState } from "./storage/uiState";

// Was in einer Hälfte offen ist: der Bereich und pro Bereich der zuletzt offene Unterbereich.
type PaneState = {
  id: string; // feste Kennung, damit React die Hälften beim Schließen nicht verwechselt
  sectionId: string;
  selection: Record<string, string | null>;
};

// Erste Hälfte aus den früher gespeicherten Einstellungen übernehmen (vor dem Split-Modus).
const initialPane: PaneState = {
  id: "main",
  sectionId: readStored("ui:section", sections[0].id),
  selection: readStored<Record<string, string | null>>("ui:selection", {}),
};

// Alle Daten-Provider der Bereiche ineinander schachteln, damit jeder Bereich seine Daten hat.
function SectionProviders({ children }: { children: ReactNode }) {
  return sections.reduceRight<ReactNode>(
    (inner, { id, Provider }) => (Provider ? <Provider key={id}>{inner}</Provider> : inner),
    children,
  );
}

const sectionById = (id: string) => sections.find((s) => s.id === id) ?? sections[0];

export default function App() {
  const [panes, setPanes] = usePersistentState<PaneState[]>("ui:panes", [initialPane]);
  const [focusedIndex, setFocusedIndex] = usePersistentState("ui:focusedPane", 0);
  const [panelOpen, setPanelOpen] = usePersistentState("ui:panelOpen", true);
  const [aiOpen, setAiOpen] = usePersistentState("ui:aiOpen", false);
  const [splitRatio, setSplitRatio] = usePersistentState("ui:splitRatio", 0.5); // Anteil der linken Hälfte
  const mainRef = useRef<HTMLElement>(null);

  const isSplit = panes.length > 1;
  const focused = Math.min(focusedIndex, panes.length - 1);
  const focusedPane = panes[focused];
  const focusedSection = sectionById(focusedPane.sectionId);

  const updatePane = (index: number, changes: Partial<PaneState>) =>
    setPanes(panes.map((pane, i) => (i === index ? { ...pane, ...changes } : pane)));

  // Was Leiste + Ansicht einer Hälfte bekommen.
  const propsForPane = (index: number) => {
    const pane = panes[index];
    const section = sectionById(pane.sectionId);
    return {
      section,
      selectedId: pane.selection[section.id] ?? null,
      onSelect: (id: string | null) =>
        updatePane(index, { selection: { ...pane.selection, [section.id]: id } }),
    };
  };

  // Klick auf einen Bereich: in der aktiven Hälfte öffnen. Schon offen: zweite Leiste ein-/ausklappen.
  const handleRailClick = (id: string) => {
    if (id === focusedSection.id) {
      setPanelOpen(!panelOpen);
    } else {
      updatePane(focused, { sectionId: id });
      setPanelOpen(true);
    }
  };

  // Teilen: zweite Hälfte mit demselben Inhalt öffnen (dann links in der Leiste umstellen).
  const toggleSplit = () => {
    if (isSplit) {
      closePane(focused === 0 ? 1 : 0);
    } else {
      setPanes([panes[0], { ...panes[0], id: crypto.randomUUID() }]);
      setFocusedIndex(1);
    }
  };

  const closePane = (index: number) => {
    setPanes(panes.filter((_, i) => i !== index));
    setFocusedIndex(0);
  };

  // Trennlinie ziehen = Breiten verteilen.
  const startResize = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = mainRef.current!.getBoundingClientRect();
    const onMove = (e: PointerEvent) =>
      setSplitRatio(Math.min(0.8, Math.max(0.2, (e.clientX - rect.left) / rect.width)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Aus der KI-Leiste zu Einstellungen → KI springen (in der aktiven Hälfte).
  const openAiSettings = () => {
    updatePane(focused, {
      sectionId: "settings",
      selection: { ...focusedPane.selection, settings: "ai" },
    });
    setPanelOpen(true);
  };

  const { Panel } = focusedSection;

  return (
    <SectionProviders>
      <div className="app">
        <SectionRail
          sections={sections}
          activeId={focusedSection.id}
          onClick={handleRailClick}
          isSplit={isSplit}
          onToggleSplit={toggleSplit}
          aiOpen={aiOpen}
          onToggleAi={() => setAiOpen(!aiOpen)}
        />

        {panelOpen && (
          <aside className="panel">
            <header className="panel-header">
              <span>
                {focusedSection.label}
                {isSplit && <span className="panel-pane-hint">{focused === 0 ? " · links" : " · rechts"}</span>}
              </span>
              <button
                className="icon-button"
                onClick={() => setPanelOpen(false)}
                title="Leiste einklappen"
              >
                <PanelLeftClose size={16} />
              </button>
            </header>
            {/* key mit Hälfte: beim Wechsel der aktiven Hälfte die Leiste neu aufbauen */}
            <Panel key={`${focused}-${focusedSection.id}`} {...propsForPane(focused)} />
          </aside>
        )}

        <main className="main" ref={mainRef}>
          {panes.map((pane, index) => {
            const props = propsForPane(index);
            const { View, icon: Icon, label } = props.section;
            const isFocused = !isSplit || index === focused;
            return [
              index > 0 && (
                <div
                  key="divider"
                  className="pane-divider"
                  onPointerDown={startResize}
                  title="Ziehen, um die Breite zu ändern"
                />
              ),
              <PaneFocusContext.Provider key={pane.id} value={isFocused}>
                <section
                  className={`pane ${isSplit && isFocused ? "focused" : ""}`}
                  style={{ flexGrow: isSplit ? (index === 0 ? splitRatio : 1 - splitRatio) : 1 }}
                  onPointerDownCapture={() => index !== focused && setFocusedIndex(index)}
                >
                  {isSplit && (
                    <header className="pane-header">
                      <Icon size={14} />
                      <span>{label}</span>
                      <button
                        className="icon-button"
                        title="Diese Hälfte schließen"
                        onClick={(e) => {
                          e.stopPropagation();
                          closePane(index);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </header>
                  )}
                  <View key={pane.sectionId} {...props} />
                </section>
              </PaneFocusContext.Provider>,
            ];
          })}
        </main>

        {aiOpen && (
          <AiSidebar
            sectionId={focusedSection.id}
            selectedId={focusedPane.selection[focusedSection.id] ?? null}
            onClose={() => setAiOpen(false)}
            onOpenSettings={openAiSettings}
          />
        )}
      </div>
      <ToastHost />
    </SectionProviders>
  );
}
