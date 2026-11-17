// Eine Mindmap: Hauptthema in der Mitte, Äste mit Unterpunkten.
// Bedienung: Knoten antippen = auswählen, doppelt tippen = Text ändern, ziehen = verschieben (mit Unterpunkten).
// Leiste oben: Unterpunkt / gleiche Ebene / löschen / Farbe / anordnen / KI. Zwei Finger = zoomen.
// Mac: Tab = Unterpunkt, Enter = gleiche Ebene, Entf = löschen, Leertaste = Text ändern.
// Ist dieselbe Mindmap im Split-Modus zweimal offen, gleichen sich beide Hälften live ab.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CornerDownRight, LayoutGrid, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { describeAiError, isAiServiceError } from "../../ai/provider";
import { usePaneFocused } from "../../components/PaneContext";
import { usePinchZoom } from "../../components/usePinchZoom";
import { loadMindNodes, saveMindNodes, type Mindmap, type MindNode } from "../../storage/db";
import { publish, useLiveSync } from "../../storage/liveSync";
import { useNotes } from "../notes/NotesContext";
import { folderPath } from "../uni/folders";
import { useLearn } from "./LearnContext";
import { createMindmapTree, type Material, type MindTree } from "./learnAi";
import { MaterialPicker } from "./MaterialPicker";
import {
  childrenOf,
  colorOf,
  DEFAULT_SIZE,
  layoutMindmap,
  PALETTE_SIZE,
  rootOf,
  subtreeIds,
  type Point,
  type Size,
} from "./mindLayout";

export const NEW_MINDMAP_TITLE = "Neue Mindmap";

const PAD = 320; // Platz rund um die Mindmap (zum Scrollen und Erweitern)
const DOUBLE_TAP_MS = 350;

type Drag = { ids: Set<string>; startX: number; startY: number; dx: number; dy: number; moved: boolean; nodeId: string };

export function MindmapView({ map, onDeleted }: { map: Mindmap; onDeleted: () => void }) {
  const { updateMindmap, deleteMindmap } = useLearn();
  const { subjects } = useNotes();
  const focused = usePaneFocused();
  const [nodes, setNodes] = useState<MindNode[] | null>(null);
  const nodesRef = useRef<MindNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Map<string, Size>>(() => new Map());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const auto = map.autoLayout !== false;

  // ---------- Laden, Speichern, Live-Abgleich ----------
  const storeKey = `mindmap-nodes:${map.id}`;
  const syncId = useLiveSync<MindNode[]>(storeKey, (remote) => {
    nodesRef.current = remote;
    setNodes(remote);
  });

  // Titel nur für eine ganz neue Mindmap (Hauptthema) – Umbenennen soll nicht neu laden.
  const initialTitle = useRef(map.title);
  useEffect(() => {
    let cancelled = false;
    loadMindNodes(map.id).then((loaded) => {
      if (cancelled) return;
      if (loaded.length === 0) {
        // Neue Mindmap: nur das Hauptthema, gleich zum Beschriften geöffnet
        const root: MindNode = { id: crypto.randomUUID(), parentId: null, text: initialTitle.current, x: 0, y: 0 };
        nodesRef.current = [root];
        setNodes([root]);
        saveMindNodes(map.id, [root]);
        setSelected(root.id);
        setEditing(root.id);
      } else {
        nodesRef.current = loaded;
        setNodes(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [map.id]);

  // Jede Änderung baut auf dem neuesten Stand auf, wird gespeichert und an andere Ansichten gegeben.
  const update = (change: (current: MindNode[]) => MindNode[]) => {
    const next = change(nodesRef.current);
    nodesRef.current = next;
    setNodes(next);
    saveMindNodes(map.id, next);
    publish(storeKey, syncId, next);
    const root = rootOf(next);
    if (root && root.text.trim() && root.text !== map.title) updateMindmap(map.id, { title: root.text.trim() });
  };

  // ---------- Größen der Knoten messen (für Anordnung und Linien) ----------
  const elements = useRef(new Map<string, HTMLElement>());
  const observerRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setSizes((current) => {
        let changed = false;
        const next = new Map(current);
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.id!;
          const size = { w: el.offsetWidth, h: el.offsetHeight }; // offset*: ohne Zoom
          const old = next.get(id);
          if (!old || Math.abs(old.w - size.w) > 0.5 || Math.abs(old.h - size.h) > 0.5) {
            next.set(id, size);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    observerRef.current = observer;
    elements.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  const nodeRef = (id: string) => (el: HTMLElement | null) => {
    const old = elements.current.get(id);
    if (old && old !== el) observerRef.current?.unobserve(old);
    if (el) {
      elements.current.set(id, el);
      observerRef.current?.observe(el);
    } else elements.current.delete(id);
  };

  // ---------- Positionen ----------
  const list = nodes ?? [];
  const layout = auto ? layoutMindmap(list, sizes) : null;
  const basePos = (n: MindNode): Point => layout?.get(n.id) ?? { x: n.x, y: n.y };
  const pos = (n: MindNode): Point => {
    const p = basePos(n);
    return drag?.moved && drag.ids.has(n.id) ? { x: p.x + drag.dx, y: p.y + drag.dy } : p;
  };
  const sizeOf = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;

  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const n of list) {
    const p = pos(n);
    const s = sizeOf(n.id);
    minX = Math.min(minX, p.x - s.w / 2);
    maxX = Math.max(maxX, p.x + s.w / 2);
    minY = Math.min(minY, p.y - s.h / 2);
    maxY = Math.max(maxY, p.y + s.h / 2);
  }
  const offsetX = -minX + PAD;
  const offsetY = -minY + PAD;
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;

  // ---------- Scrollen & Zoomen ----------
  const scrollRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  usePinchZoom({ scrollRef, contentRef: sizerRef, zoom, setZoom, min: 0.3, max: 3 });

  // Wächst die Mindmap nach links/oben, verschiebt sich alles – Scroll-Position mitziehen, damit nichts springt.
  // Beim ersten Anzeigen das Hauptthema in die Mitte holen.
  const lastOffset = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !nodes) return;
    const previous = lastOffset.current;
    if (!previous) {
      scroller.scrollLeft = offsetX * zoom - scroller.clientWidth / 2;
      scroller.scrollTop = offsetY * zoom - scroller.clientHeight / 2;
    } else if (previous.x !== offsetX || previous.y !== offsetY) {
      scroller.scrollLeft += (offsetX - previous.x) * zoom;
      scroller.scrollTop += (offsetY - previous.y) * zoom;
    }
    lastOffset.current = { x: offsetX, y: offsetY };
  });

  // ---------- Bearbeiten ----------
  const byId = (id: string | null) => list.find((n) => n.id === id);

  // Von Hand angeordnet: neue Knoten neben/unter die Geschwister setzen.
  const placeNew = (parent: MindNode, side: 1 | -1, after?: MindNode): Point => {
    const p = basePos(parent);
    const siblings = childrenOf(list, parent.id).filter((s) => Math.sign(basePos(s).x - p.x) === side);
    const ref = after ?? siblings[siblings.length - 1];
    const x = p.x + side * (sizeOf(parent.id).w / 2 + 56 + DEFAULT_SIZE.w / 2);
    const y = ref ? basePos(ref).y + sizeOf(ref.id).h / 2 + 14 + DEFAULT_SIZE.h / 2 : p.y;
    return { x, y };
  };

  const sideOf = (node: MindNode): 1 | -1 => {
    const root = rootOf(list);
    if (!root || node.id === root.id) return 1;
    return basePos(node).x >= basePos(root).x ? 1 : -1;
  };

  const addChild = (parentId: string) => {
    const parent = byId(parentId);
    if (!parent) return;
    let side = sideOf(parent);
    if (parent.parentId === null) {
      // am Hauptthema: auf die Seite mit weniger Ästen
      const branches = childrenOf(list, parent.id);
      const right = branches.filter((b) => sideOf(b) === 1).length;
      side = right <= branches.length - right ? 1 : -1;
    }
    const at = placeNew(parent, side);
    const node: MindNode = { id: crypto.randomUUID(), parentId, text: "", ...at };
    update((current) => [...current, node]);
    setSelected(node.id);
    setEditing(node.id);
  };

  const addSibling = (id: string) => {
    const node = byId(id);
    if (!node) return;
    if (node.parentId === null) return addChild(node.id);
    const parent = byId(node.parentId)!;
    const at = placeNew(parent, sideOf(node), node);
    const sibling: MindNode = { id: crypto.randomUUID(), parentId: node.parentId, text: "", ...at };
    update((current) => {
      const index = current.findIndex((n) => n.id === id);
      return [...current.slice(0, index + 1), sibling, ...current.slice(index + 1)];
    });
    setSelected(sibling.id);
    setEditing(sibling.id);
  };

  const remove = (id: string) => {
    const node = byId(id);
    if (!node || node.parentId === null) return; // Hauptthema bleibt
    const ids = subtreeIds(list, id);
    if (ids.size > 3 && !window.confirm(`„${node.text || "Knoten"}“ mit ${ids.size - 1} Unterpunkten löschen?`)) return;
    update((current) => current.filter((n) => !ids.has(n.id)));
    setSelected(node.parentId);
    setEditing(null);
  };

  const commitText = (id: string, text: string) => {
    setEditing(null);
    const node = byId(id);
    if (!node) return;
    // Neuer Knoten ohne Text: wieder weg
    if (!text.trim() && node.parentId !== null && !node.text) return remove(id);
    if (text.trim() && text !== node.text) update((current) => current.map((n) => (n.id === id ? { ...n, text: text.trim() } : n)));
  };

  const setColor = (id: string, color: number | undefined) =>
    update((current) => current.map((n) => (n.id === id ? { ...n, color } : n)));

  // Beim ersten Verschieben die automatische Anordnung "einfrieren" (Positionen übernehmen).
  const freezeLayout = () => {
    if (!auto || !layout) return;
    update((current) => current.map((n) => ({ ...n, ...(layout.get(n.id) ?? {}) })));
    updateMindmap(map.id, { autoLayout: false });
  };

  // ---------- Zeiger: auswählen, doppelt tippen, ziehen ----------
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const onNodePointerDown = (e: React.PointerEvent, node: MindNode) => {
    if (editing === node.id) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(node.id);
    if (editing) commitPending();
    setDrag({ ids: subtreeIds(list, node.id), startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false, nodeId: node.id });
  };
  const onNodePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / zoom;
    const dy = (e.clientY - drag.startY) / zoom;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    if (!drag.moved) freezeLayout();
    setDrag({ ...drag, dx, dy, moved: true });
  };
  const onNodePointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const current = drag;
    setDrag(null);
    if (current.moved) {
      update((all) => all.map((n) => (current.ids.has(n.id) ? { ...n, x: n.x + current.dx, y: n.y + current.dy } : n)));
      lastTap.current = null;
      return;
    }
    // kein Ziehen: Tippen – zweimal kurz hintereinander = Text ändern
    const now = e.timeStamp;
    if (lastTap.current?.id === current.nodeId && now - lastTap.current.at < DOUBLE_TAP_MS) {
      setEditing(current.nodeId);
      lastTap.current = null;
    } else lastTap.current = { id: current.nodeId, at: now };
  };

  // Text, der gerade bearbeitet wird (zum Übernehmen, wenn woanders getippt wird)
  const draftRef = useRef<{ id: string; text: string } | null>(null);
  const commitPending = () => {
    if (draftRef.current) commitText(draftRef.current.id, draftRef.current.text);
    draftRef.current = null;
  };

  // ---------- Tastatur (Mac) ----------
  useEffect(() => {
    if (!focused || editing || !selected) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (e.key === "Tab") addChild(selected);
      else if (e.key === "Enter") addSibling(selected);
      else if (e.key === "Delete" || e.key === "Backspace") remove(selected);
      else if (e.key === " " || e.key === "F2") setEditing(selected);
      else if (e.key === "Escape") setSelected(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- KI ----------
  const fillFromTree = (tree: MindTree) => {
    const result: MindNode[] = [];
    const add = (t: MindTree, parentId: string | null) => {
      const id = crypto.randomUUID();
      result.push({ id, parentId, text: t.text.trim(), x: 0, y: 0 });
      (t.children ?? []).filter((c) => c.text?.trim()).forEach((c) => add(c, id));
    };
    add(tree, null);
    update(() => result);
    updateMindmap(map.id, { autoLayout: true, title: tree.text.trim() });
    lastOffset.current = null; // neu zentrieren
    setSelected(null);
    setEditing(null);
    setAiOpen(false);
  };

  if (!nodes) return <p className="muted">Wird geladen …</p>;

  const selectedNode = byId(selected);
  const folderOptions = subjects
    .map((s) => ({ id: s.id, label: folderPath(subjects, s.id).map((f) => f.name || "Ohne Namen").join(" › ") }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  return (
    <div className="mindmap">
      <div className="mindmap-toolbar">
        <button className="secondary-button" onClick={() => selected && addChild(selected)} disabled={!selectedNode} title="Unterpunkt (Tab)">
          <CornerDownRight size={14} /> Unterpunkt
        </button>
        <button className="secondary-button" onClick={() => selected && addSibling(selected)} disabled={!selectedNode} title="Gleiche Ebene (Enter)">
          <Plus size={14} /> Gleiche Ebene
        </button>
        <button className="icon-button" onClick={() => selected && setEditing(selected)} disabled={!selectedNode} title="Text ändern (doppelt tippen)">
          <Pencil size={15} />
        </button>
        <button className="icon-button" onClick={() => selected && remove(selected)} disabled={!selectedNode || selectedNode.parentId === null} title="Löschen (Entf)">
          <Trash2 size={15} />
        </button>
        <span className="mindmap-colors">
          {Array.from({ length: PALETTE_SIZE }, (_, i) => (
            <button
              key={i}
              className={`mind-swatch c${i}`}
              disabled={!selectedNode || selectedNode.parentId === null}
              onClick={() => selected && setColor(selected, i)}
              title="Farbe"
            />
          ))}
        </span>
        <span className="mindmap-toolbar-spacer" />
        <button className="secondary-button" onClick={() => updateMindmap(map.id, { autoLayout: true })} disabled={auto} title="Automatisch anordnen">
          <LayoutGrid size={14} /> Anordnen
        </button>
        <button className={`secondary-button ${aiOpen ? "active" : ""}`} onClick={() => setAiOpen(!aiOpen)}>
          <Sparkles size={14} /> Mit KI
        </button>
        {zoom !== 1 && (
          <button className="text-button" onClick={() => setZoom(1)} title="Zoom zurücksetzen">
            {Math.round(zoom * 100)} %
          </button>
        )}
      </div>

      {aiOpen && <AiMindmap folderId={map.folderId ?? null} hasContent={nodes.length > 1} onTree={fillFromTree} />}

      <div
        className="mindmap-canvas"
        ref={scrollRef}
        onPointerDown={() => {
          commitPending();
          setSelected(null);
        }}
      >
        <div className="mindmap-sizer" ref={sizerRef} style={{ width: width * zoom, height: height * zoom }}>
          <div className="mindmap-content" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
            <svg className="mindmap-lines" width={width} height={height}>
              {list.map((n) => {
                const parent = n.parentId ? byId(n.parentId) : undefined;
                if (!parent) return null;
                const p = pos(parent);
                const c = pos(n);
                const side = c.x >= p.x ? 1 : -1;
                const x1 = p.x + (side * sizeOf(parent.id).w) / 2 + offsetX;
                const x2 = c.x - (side * sizeOf(n.id).w) / 2 + offsetX;
                const y1 = p.y + offsetY;
                const y2 = c.y + offsetY;
                const mid = (x1 + x2) / 2;
                const color = colorOf(list, n);
                return <path key={n.id} className={`mind-line c${color ?? 0}`} d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`} />;
              })}
            </svg>
            {list.map((n) => {
              const p = pos(n);
              const color = colorOf(list, n);
              const isRoot = n.parentId === null;
              return (
                <div
                  key={n.id}
                  data-id={n.id}
                  ref={nodeRef(n.id)}
                  className={`mind-node ${isRoot ? "root" : `c${color ?? 0}`} ${selected === n.id ? "selected" : ""} ${drag?.moved && drag.ids.has(n.id) ? "dragging" : ""}`}
                  style={{ left: p.x + offsetX, top: p.y + offsetY }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  onPointerCancel={() => setDrag(null)}
                >
                  {editing === n.id ? (
                    <NodeEditor
                      initial={n.text}
                      onDraft={(text) => (draftRef.current = { id: n.id, text })}
                      onDone={(text, then) => {
                        draftRef.current = null;
                        commitText(n.id, text);
                        if (then === "child" && text.trim()) addChild(n.id);
                      }}
                    />
                  ) : (
                    <span className={n.text ? "" : "muted"}>{n.text || (isRoot ? "Hauptthema" : "…")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mindmap-footer">
        <label className="deck-folder muted">
          Fach:
          <select value={map.folderId ?? ""} onChange={(e) => updateMindmap(map.id, { folderId: e.target.value || null })}>
            <option value="">– keins –</option>
            {folderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted mindmap-hint">Doppelt tippen = Text ändern · ziehen = verschieben · zwei Finger = zoomen</span>
        <button
          className="text-button"
          onClick={() => {
            if (window.confirm(`Mindmap „${map.title || "Ohne Titel"}“ löschen?`)) {
              deleteMindmap(map.id);
              onDeleted();
            }
          }}
        >
          Mindmap löschen
        </button>
      </div>
    </div>
  );
}

// Textfeld im Knoten. Enter = fertig, Tab = fertig + Unterpunkt, Esc = fertig. Wächst mit dem Text.
function NodeEditor({ initial, onDraft, onDone }: { initial: string; onDraft: (text: string) => void; onDone: (text: string, then?: "child") => void }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (then?: "child") => {
    if (done.current) return;
    done.current = true;
    onDone(text, then);
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="mind-editor"
      value={text}
      rows={1}
      onChange={(e) => {
        setText(e.target.value);
        onDraft(e.target.value);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish();
        } else if (e.key === "Tab") {
          e.preventDefault();
          finish("child");
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish();
        }
      }}
    />
  );
}

// Mindmap von der KI aus Material erstellen lassen.
function AiMindmap({ folderId, hasContent, onTree }: { folderId: string | null; hasContent: boolean; onTree: (tree: MindTree) => void }) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (!material) return;
    if (hasContent && !window.confirm("Die KI ersetzt die jetzige Mindmap. Fortfahren?")) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      onTree(await createMindmapTree(material, controller.signal));
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(isAiServiceError(e) ? describeAiError(e, { withAttachment: false }) : e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="english-card mindmap-ai">
      {busy ? (
        <div className="center">
          <Loader2 size={22} className="spin" />
          <p>Die KI erstellt die Mindmap …</p>
          <button className="text-button" onClick={() => abortRef.current?.abort()}>
            Abbrechen
          </button>
        </div>
      ) : (
        <>
          <p className="muted">Die KI macht aus einer Notiz, einem PDF oder Text eine Mindmap (ersetzt die jetzige).</p>
          <MaterialPicker folderId={folderId} onChange={setMaterial} />
          {error && <p className="settings-status error">{error}</p>}
          <button className="primary-button" onClick={run} disabled={!material}>
            <Sparkles size={15} /> Mindmap erstellen
          </button>
        </>
      )}
    </div>
  );
}
