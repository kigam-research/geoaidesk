"use client";

/**
 * A PDF in a pane beside its list (gaid-library-pdf-panel; guide v2 P4, L3, I6): a header on the functional layer with the
 * document title and close, and the upstream pdf.js viewer in view-only mode below (original pixels, page navigation,
 * zoom, fit width and the open-in-browser-tab link in its toolbar). When pdf.js cannot render the file, the pane says so
 * and offers the same file in a new browser tab. Escape closes the pane unless focus is in a text field.
 */
import { useEffect, useRef } from "react";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PdfViewer } from "@/components/pdf-viewer/pdf-viewer";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("viewers");

export interface PdfPaneProps {
  /** Document title shown in the pane header (the paper title). */
  title: string;
  /** Same-origin or API URL of the PDF bytes (already carrying the API token). */
  url: string;
  onClose: () => void;
  /** Optional page to scroll to; bump `sequence` to repeat a jump to the same page. */
  pageRequest?: { page: number; sequence: number };
  className?: string;
}

export function PdfPane({ title, url, onClose, pageRequest, className }: PdfPaneProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus moves into the pane when it opens (A2), so Escape and the toolbar are one Tab away.
  useEffect(() => { closeRef.current?.focus(); }, [url]);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable='true']")) return;
    event.preventDefault();
    onClose();
  };
  return (
    <section aria-label={text("pdfPane.label", { title })} onKeyDown={onKeyDown}
      className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gaid-frame bg-gaid-face", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-gaid-frame bg-gaid-chrome pl-4 pr-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={title}>{title}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button ref={closeRef} variant="ghost" size="icon-sm" aria-label={text("pdfPane.close.button")} onClick={onClose}><XIcon /></Button>
          </TooltipTrigger>
          <TooltipContent>{text("pdfPane.closeHint")}</TooltipContent>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1">
        <PdfViewer key={url} path={title} sourceUrl={url} pageRequest={pageRequest} hideAnnotationUi initialFitWidth
          renderError={() => (
            <div role="alert" className="flex h-full flex-col items-start gap-3 p-6">
              <p className="text-sm">{text("pdfPane.error")}</p>
              <Button variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer"><ExternalLinkIcon data-icon="inline-start" />{text("pdfPane.newTab.button")}</a>
              </Button>
            </div>
          )} />
      </div>
    </section>
  );
}
