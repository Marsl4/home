// Zweite Seitenleiste im Englisch-Bereich.
import { BookOpen, ClipboardCheck, GraduationCap, Layers, ListChecks } from "lucide-react";

import type { SectionProps } from "../types";
import { ENGLISH_PAGES, useEnglish } from "./EnglishContext";
import { isDue } from "./srs";

export function EnglishPanel({ selectedId, onSelect }: SectionProps) {
  const { english, cards } = useEnglish();
  const current = selectedId ?? (english?.level ? ENGLISH_PAGES.overview : ENGLISH_PAGES.test);
  const due = cards.filter((c) => isDue(c)).length;
  const items = [
    { id: ENGLISH_PAGES.overview, label: "Übersicht", icon: GraduationCap },
    { id: ENGLISH_PAGES.test, label: "Einstufungstest", icon: ClipboardCheck },
    { id: ENGLISH_PAGES.plan, label: "Lernplan", icon: ListChecks },
    { id: ENGLISH_PAGES.learn, label: "Vokabeln lernen", icon: Layers, count: due },
    { id: ENGLISH_PAGES.words, label: "Alle Vokabeln", icon: BookOpen },
  ];
  return (
    <nav className="panel-list">
      {english?.level && <div className="panel-section-title">Niveau {english.level}</div>}
      {items.map((item) => (
        <button key={item.id} className={`panel-item ${current === item.id ? "active" : ""}`} onClick={() => onSelect(item.id)}>
          <item.icon size={15} className="panel-item-icon" />
          <span className="panel-item-label">{item.label}</span>
          {item.count ? <span className="panel-item-count">{item.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}
