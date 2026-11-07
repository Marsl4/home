// Knopf, der den Datei-Dialog öffnet und gewählte PDFs importiert.
import { useRef, type ReactNode } from "react";

import type { PdfDoc } from "../../storage/db";
import { usePdfs } from "./PdfsContext";

type Props = {
  className: string;
  children: ReactNode;
  onImported: (added: PdfDoc[]) => void;
};

export function ImportPdfButton({ className, children, onImported }: Props) {
  const { importFiles } = usePdfs();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // damit man dieselbe Datei nochmal wählen kann
          onImported(await importFiles(files));
        }}
      />
    </>
  );
}
