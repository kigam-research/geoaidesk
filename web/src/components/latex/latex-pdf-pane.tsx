"use client";
import { geoText } from "@/geo/i18n";

import {
  PdfViewer,
  type PdfSyncClick,
  type PdfSyncHighlight,
} from "@/components/pdf-viewer/pdf-viewer";
import { FileTextIcon } from "lucide-react";
import { memo } from "react";

const filesText = geoText("files");

export const LatexPdfPane = memo(function LatexPdfPane({
  pdfPath,
  reloadToken,
  syncHighlight,
  onSyncClick,
  modKey,
}: {
  pdfPath: string | null;
  reloadToken: number;
  syncHighlight: PdfSyncHighlight | null;
  onSyncClick: (pos: PdfSyncClick) => void;
  modKey: string;
}) {
  if (!pdfPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50">
          <FileTextIcon className="size-6 text-muted-foreground/30" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{filesText("latex_pdf_pane.no_pdf_yet")}</p>
          <p className="text-xs text-muted-foreground/60">{filesText("latex_pdf_pane.compile_hint", { key: `${modKey}↵` })}</p>
        </div>
      </div>
    );
  }
  return (
    <PdfViewer
      path={pdfPath}
      reloadToken={reloadToken}
      syncHighlight={syncHighlight}
      onSyncClick={onSyncClick}
      hideAnnotationUi
      initialFitWidth
      className="flex-1 min-h-0"
    />
  );
});
