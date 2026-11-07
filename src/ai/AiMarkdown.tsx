// Zeigt die Antworten der KI lesbar an. Die KI schreibt in "Markdown"
// (z. B. **fett**, "- " für Aufzählungen, "## " für Überschriften). Hier wird nur das Nötigste
// davon umgesetzt – bewusst einfach gehalten, ohne zusätzliche Bibliothek.
import type { ReactNode } from "react";

export function AiMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    elements.push(list.ordered ? <ol key={elements.length}>{items}</ol> : <ul key={elements.length}>{items}</ul>);
    list = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    if (heading) {
      elements.push(<p key={elements.length} className="ai-md-heading">{inline(heading[2])}</p>);
    } else if (line.trim()) {
      elements.push(<p key={elements.length}>{inline(line)}</p>);
    }
  }
  flushList();
  return <div className="ai-md">{elements}</div>;
}

// **fett**, *kursiv* und `Code` innerhalb einer Zeile.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
