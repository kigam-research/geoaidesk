"use client";
/**
 * One PDF page of an authoring source in the evidence viewer: pdf.js draws the page on a canvas (original pixels, no
 * filters or theme recolouring, UI guide I6) with its text layer on top; the cited quote is marked on the text layer
 * and scrolled into view. Page, zoom and "whole PDF" controls sit in the viewer's toolbar (functional layer).
 */
import { ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

import { Button } from "@/components/ui/button";
import { loadPdfjs } from "@/components/pdf-viewer/pdf-viewer";
import { usePdfPageRendering } from "@/components/pdf-viewer/use-pdf-page-rendering";
import { geoText } from "@/geo/i18n";

import { quoteSpans } from "./quote-match";

const text = geoText("hub");

/** Where the quote landed on the page: found (whole or part), not on the page, or not looked for (unconfirmed). */
export type LocateState = "pending" | "found" | "partial" | "absent";

/** Open documents are kept per URL while the viewer is mounted (switching between passages of one paper). */
function usePdfDocument(url: string, attempt: number) {
  const [state, setState] = useState<{ url: string; doc?: PDFDocumentProxy; error?: boolean }>({ url });
  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | undefined;
    void loadPdfjs()
      .then((pdfjs) => pdfjs.getDocument({ url, withCredentials: true, enableXfa: false }).promise)
      .then(
        (loaded) => {
          doc = loaded;
          if (cancelled) void loaded.destroy();
          else setState({ url, doc: loaded });
        },
        () => !cancelled && setState({ url, error: true }),
      );
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [url, attempt]);
  return state.url === url ? state : { url };
}

export function EvidencePdf({
  url,
  page,
  quote,
  mark,
  onLocate,
  onOpenFull,
  onRetry,
  attempt,
  loading,
  failed,
}: {
  url: string;
  page: number;
  quote: string;
  /** Mark the quote (only for anchors the server verified). */
  mark: boolean;
  onLocate: (state: LocateState) => void;
  onOpenFull?: (page: number) => void;
  onRetry: () => void;
  attempt: number;
  loading: React.ReactNode;
  failed: (retry: () => void) => React.ReactNode;
}) {
  const { doc, error } = usePdfDocument(url, attempt);
  const [shown, setShown] = useState(page);
  const [zoom, setZoom] = useState(1);
  useEffect(() => setShown(page), [page, url]);

  if (error) return <>{failed(onRetry)}</>;
  if (!doc) return <>{loading}</>;
  const pages = doc.numPages;
  const at = Math.min(Math.max(1, shown), pages);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PdfPage
        key={`${url}#${at}`}
        doc={doc}
        page={at}
        zoom={zoom}
        quote={at === page && mark ? quote : null}
        onLocate={at === page ? onLocate : undefined}
      />
      <div className="flex items-center justify-between gap-2 border-t border-gaid-edge bg-gaid-chrome px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text("evidence.prevPage")}
            disabled={at <= 1}
            onClick={() => setShown(at - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums text-gaid-ink-2">
            {text("evidence.pageOf", { page: at, pages })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text("evidence.nextPage")}
            disabled={at >= pages}
            onClick={() => setShown(at + 1)}
          >
            <ChevronRightIcon />
          </Button>
          {at !== page && (
            <Button variant="link" size="sm" onClick={() => setShown(page)}>
              {text("evidence.backToCited", { page })}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text("evidence.zoomOut")}
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
          >
            <MinusIcon />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums text-gaid-ink-2">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={text("evidence.zoomIn")}
            disabled={zoom >= 2.5}
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          >
            <PlusIcon />
          </Button>
          {onOpenFull && (
            <Button variant="ghost" size="sm" onClick={() => onOpenFull(at)}>
              <MaximizeIcon data-icon="inline-start" />
              {text("evidence.openFull.button")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Page width at 100% is the pane width; zoom scales from there. */
function PdfPage({
  doc,
  page,
  zoom,
  quote,
  onLocate,
}: {
  doc: PDFDocumentProxy;
  page: number;
  zoom: number;
  quote: string | null;
  onLocate?: (state: LocateState) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    void doc.getPage(page).then((p) => {
      if (!cancelled) setFit(p.getViewport({ scale: 1 }).width);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page]);
  const scale = fit && width ? Math.max(0.2, ((width - 24) / fit) * zoom) : null;
  return (
    <div ref={scrollRef} data-pdf-scroll className="min-h-0 flex-1 overflow-auto bg-gaid-face-2 p-3">
      {scale && <PageCanvas doc={doc} page={page} scale={scale} quote={quote} onLocate={onLocate} scroller={scrollRef} />}
    </div>
  );
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Join boxes of one line (text items split by symbols or font changes) so a quote reads as one mark per line. */
export function mergeLineBoxes(boxes: Box[], gap = 6): Box[] {
  const out: Box[] = [];
  for (const b of boxes) {
    const prev = out[out.length - 1];
    const sameLine = prev && Math.abs(prev.top + prev.height / 2 - (b.top + b.height / 2)) < Math.min(prev.height, b.height) / 2;
    if (prev && sameLine && b.left <= prev.left + prev.width + gap && b.left + b.width >= prev.left - gap) {
      const left = Math.min(prev.left, b.left);
      const top = Math.min(prev.top, b.top);
      const right = Math.max(prev.left + prev.width, b.left + b.width);
      const bottom = Math.max(prev.top + prev.height, b.top + b.height);
      out[out.length - 1] = { left, top, width: right - left, height: bottom - top };
    } else out.push(b);
  }
  return out;
}

/**
 * The quote is located in the page's text content and marked by boxes computed from each text item's own transform and
 * width (pdf.js viewport coordinates), drawn over the canvas; the page pixels are not touched.
 */
function PageCanvas({
  doc,
  page,
  scale,
  quote,
  onLocate,
  scroller,
}: {
  doc: PDFDocumentProxy;
  page: number;
  scale: number;
  quote: string | null;
  onLocate?: (state: LocateState) => void;
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  const { pageRef, canvasRef, textLayerRef, viewport, size } = usePdfPageRendering(doc, page, scale, loadPdfjs);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const located = useRef(false);
  const report = useRef(onLocate);
  report.current = onLocate;

  useEffect(() => {
    if (!quote || !viewport) return;
    let cancelled = false;
    void doc
      .getPage(page)
      .then((p) => p.getTextContent())
      .then((content) => {
        if (cancelled) return;
        const items = content.items.filter((i): i is TextItem => "str" in i);
        const hit = quoteSpans(
          items.map((i) => i.str),
          quote,
        );
        if (!hit) {
          setBoxes([]);
          report.current?.("absent");
          return;
        }
        const last = hit.spans.length - 1;
        const next = hit.spans
          .map((n, k) => ({ item: items[n], k }))
          .filter(({ item }) => item.width > 0 && item.str.length > 0)
          .map(({ item: i, k }) => {
            // Inside the first and last item, cut at the quote's characters (proportional to the item's width).
            const len = i.str.length;
            const a = k === 0 ? hit.from / len : 0;
            const b = k === last ? hit.to / len : 1;
            const [x, y] = [i.transform[4], i.transform[5]];
            const h = i.height || Math.hypot(i.transform[2], i.transform[3]);
            const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
              x + i.width * a,
              y - h * 0.2,
              x + i.width * b,
              y + h * 0.9,
            ]);
            return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
          });
        setBoxes(mergeLineBoxes(next));
        report.current?.(hit.partial ? "partial" : "found");
        const box = scroller.current;
        if (!located.current && box && next.length) {
          located.current = true;
          box.scrollTo?.({ top: Math.max(0, next[0].top + 12 - box.clientHeight / 3) });
        }
      })
      .catch(() => !cancelled && report.current?.("absent"));
    return () => {
      cancelled = true;
    };
  }, [doc, page, quote, viewport, scroller]);

  return (
    <div
      ref={pageRef}
      data-pdf-page={page}
      className="relative mx-auto bg-[var(--gaid-pic-mat)] ring-1 ring-gaid-edge"
      style={size ? { width: size.w, height: size.h } : { height: 480 }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 select-none" />
      {quote &&
        boxes.map((b, i) => (
          <div
            key={i}
            aria-hidden
            data-evidence-mark
            className="pointer-events-none absolute rounded-[2px] bg-gaid-signal/25 outline outline-1 outline-gaid-signal"
            style={{ left: b.left - 1, top: b.top - 1, width: b.width + 2, height: b.height + 2 }}
          />
        ))}
      <div ref={textLayerRef} className="pdf-text-layer absolute inset-0" />
    </div>
  );
}
