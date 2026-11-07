// Merkt sich pro PDF, welche Seite gerade sichtbar ist und wie viele Seiten es hat.
// Die KI-Leiste nutzt das, um "diese Seite" bzw. sinnvolle Seitenbereiche vorzuschlagen.
import { useEffect, useState } from "react";

export type PdfPosition = { page: number; pageCount: number }; // page ab 1

const positions = new Map<string, PdfPosition>();
const listeners = new Set<() => void>();

export function setPdfPosition(pdfId: string, position: PdfPosition) {
  const current = positions.get(pdfId);
  if (current?.page === position.page && current.pageCount === position.pageCount) return;
  positions.set(pdfId, position);
  listeners.forEach((listener) => listener());
}

export function usePdfPosition(pdfId: string | null): PdfPosition | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return pdfId ? (positions.get(pdfId) ?? null) : null;
}
