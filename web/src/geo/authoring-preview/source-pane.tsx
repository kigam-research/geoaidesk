"use client";

import { FileText, Link2 } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer/pdf-viewer";
import type { PreviewSourcePaneProps } from "@/geo/contracts/authoring-preview";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("previewSource");

export function PreviewSourcePane({ source, sourceUrl, pageRequest, onPdfReady, className }: PreviewSourcePaneProps) {
  return (
    <section aria-label={text("pane.label")} className={cn("flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
        <FileText aria-hidden="true" className="size-4 shrink-0" />
        <h2 className="truncate" title={source?.name}>{source?.name ?? text("pane.label")}</h2>
      </header>
      {source && sourceUrl ? (
        <div className="min-h-0 flex-1">
          <PdfViewer key={sourceUrl} path={source.name} sourceUrl={sourceUrl} pageRequest={pageRequest}
            onDocumentReady={onPdfReady} hideAnnotationUi initialFitWidth />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          {source?.kind === "url" ? <Link2 aria-hidden="true" className="size-10 text-blue-300" /> : <FileText aria-hidden="true" className="size-10 text-blue-300" />}
          <h3 className="text-base font-semibold text-slate-900">{text(source?.kind === "url" ? "pane.urlTitle" : source ? "pane.reselectTitle" : "pane.emptyTitle")}</h3>
          <p role="status" className="max-w-sm text-sm leading-relaxed text-slate-500">
            {text(source?.kind === "url" ? "pane.urlBody" : source ? "pane.reselectBody" : "pane.emptyBody")}
          </p>
          {source?.reference && <p className="max-w-full break-all text-xs text-slate-500">{source.reference}</p>}
        </div>
      )}
    </section>
  );
}
