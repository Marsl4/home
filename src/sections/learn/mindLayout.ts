// Automatische Anordnung einer Mindmap: Hauptthema in der Mitte, die Äste abwechselnd
// rechts (erste Hälfte) und links (zweite Hälfte), Unterpunkte jeweils untereinander daneben.
import type { MindNode } from "../../storage/db";

export type Size = { w: number; h: number };
export type Point = { x: number; y: number }; // Mittelpunkt eines Knotens

const H_GAP = 56; // Abstand zwischen Ebenen (waagerecht)
const V_GAP = 14; // Abstand zwischen Geschwistern (senkrecht)
export const DEFAULT_SIZE: Size = { w: 140, h: 38 };

export function childrenOf(nodes: MindNode[], parentId: string | null): MindNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

export function rootOf(nodes: MindNode[]): MindNode | undefined {
  return nodes.find((n) => n.parentId === null);
}

// Knoten + alle Unterpunkte (z. B. zum Verschieben oder Löschen)
export function subtreeIds(nodes: MindNode[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function layoutMindmap(nodes: MindNode[], sizes: Map<string, Size>): Map<string, Point> {
  const positions = new Map<string, Point>();
  const root = rootOf(nodes);
  if (!root) return positions;
  const size = (id: string) => sizes.get(id) ?? DEFAULT_SIZE;

  // Höhe, die ein Teilbaum braucht
  const heights = new Map<string, number>();
  const heightOf = (node: MindNode): number => {
    const cached = heights.get(node.id);
    if (cached !== undefined) return cached;
    const kids = childrenOf(nodes, node.id);
    const kidsHeight = kids.reduce((sum, k) => sum + heightOf(k), 0) + Math.max(0, kids.length - 1) * V_GAP;
    const height = Math.max(size(node.id).h, kidsHeight);
    heights.set(node.id, height);
    return height;
  };

  // Kinder eines Knotens nebeneinander (Richtung side: 1 = rechts, -1 = links) untereinander anordnen
  const place = (kids: MindNode[], parent: MindNode, side: 1 | -1) => {
    const p = positions.get(parent.id)!;
    const total = kids.reduce((sum, k) => sum + heightOf(k), 0) + Math.max(0, kids.length - 1) * V_GAP;
    let top = p.y - total / 2;
    for (const kid of kids) {
      const h = heightOf(kid);
      const x = p.x + side * (size(parent.id).w / 2 + H_GAP + size(kid.id).w / 2);
      positions.set(kid.id, { x, y: top + h / 2 });
      place(childrenOf(nodes, kid.id), kid, side);
      top += h + V_GAP;
    }
  };

  positions.set(root.id, { x: 0, y: 0 });
  const branches = childrenOf(nodes, root.id);
  const half = Math.ceil(branches.length / 2);
  place(branches.slice(0, half), root, 1);
  place(branches.slice(half), root, -1);
  return positions;
}

// Farbe eines Knotens: eigene Farbe, sonst die seines Astes (Hauptast = Reihenfolge am Hauptthema).
export function colorOf(nodes: MindNode[], node: MindNode): number | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current: MindNode | undefined = node;
  while (current) {
    if (current.color !== undefined) return current.color;
    const parent: MindNode | undefined = current.parentId ? byId.get(current.parentId) : undefined;
    if (parent && parent.parentId === null) {
      const index = childrenOf(nodes, parent.id).findIndex((n) => n.id === current!.id);
      return index % PALETTE_SIZE;
    }
    current = parent;
  }
  return null; // Hauptthema
}

export const PALETTE_SIZE = 6;
