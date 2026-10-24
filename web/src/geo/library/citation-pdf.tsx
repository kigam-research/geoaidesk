"use client";

/**
 * Library citations that open their PDF (gaid-cite-open-pdf). In chat answers and research notes a Pandoc citation of a
 * 서재 paper (`[@key, p. 12]`, as the library tools and the note citation check write them) becomes a button; pressing it
 * resolves the key in the researcher's library and shows the paper's stored PDF at the cited page in a side pane
 * (`PdfPane`, original pixels). A key the library does not have, a paper without a PDF in GAID and a page beyond the PDF
 * each say so instead of doing nothing: the first two beside the citation, the last in the pane.
 *
 * Rendering and the opener context are in `citation-links.tsx`; here `useCitationPdf` (resolution and pane state) and
 * `CitationPdfPane`.
 */
import { useCallback, useRef, useState } from "react";
import { t } from "@/geo/i18n";
import { citationPage } from "@/geo/contracts/library";
import { PdfPane } from "@/geo/pdf/pdf-pane";
import { libraryPdfUrl, resolveCitations } from "./api";
import type { CitationRequest } from "./citation-links";

export interface CitationPdf {
  itemId: string;
  title: string;
  key: string;
  page?: number;
  /** Page count from the library record, then from pdf.js once the document is loaded. */
  pages?: number;
  sequence: number;
}

/**
 * Resolves a citation and keeps the PDF that is open. `open` never throws: for an unknown key, a paper without a stored
 * PDF or a failed lookup it resolves to the sentence the citation shows beside itself.
 */
export function useCitationPdf() {
  const [pdf, setPdf] = useState<CitationPdf | null>(null);
  const sequence = useRef(0);
  const open = useCallback(async ({ key, locator }: CitationRequest): Promise<string | undefined> => {
    let row;
    try {
      [row] = await resolveCitations([key]);
    } catch {
      return t("library.cite.failed", { key });
    }
    if (!row?.itemId) return t("library.cite.unknown", { key });
    if (!row.pdf) return t("library.cite.noPdf", { key, title: row.title ?? key });
    sequence.current += 1;
    setPdf({ itemId: row.itemId, title: row.title ?? key, key, page: citationPage(locator), pages: row.pdf.pages, sequence: sequence.current });
    return undefined;
  }, []);
  const close = useCallback(() => setPdf(null), []);
  const documentReady = useCallback((pages: number) => setPdf((p) => (p && p.pages !== pages ? { ...p, pages } : p)), []);
  return { pdf, open, close, documentReady };
}

/** True when the cited page lies beyond the PDF (the pane then goes to the first page and says so). */
export function pageMissing(pdf: Pick<CitationPdf, "page" | "pages">): boolean {
  return Boolean(pdf.page && pdf.pages && pdf.page > pdf.pages);
}

export function CitationPdfPane({ pdf, onClose, onDocumentReady, closeHint, className }: {
  pdf: CitationPdf;
  onClose: () => void;
  onDocumentReady: (pages: number) => void;
  closeHint?: string;
  className?: string;
}) {
  const missing = pageMissing(pdf);
  return (
    <PdfPane title={pdf.title} url={libraryPdfUrl(pdf.itemId)} onClose={onClose} onDocumentReady={onDocumentReady}
      pageRequest={{ page: pdf.page && !missing ? pdf.page : 1, sequence: pdf.sequence }}
      notice={missing ? t("library.cite.pageMissing", { key: pdf.key, page: pdf.page!, pages: pdf.pages! }) : undefined}
      closeHint={closeHint} className={className} />
  );
}
