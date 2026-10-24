"use client";

/**
 * Library citations as buttons (gaid-cite-open-pdf; opening is in `citation-pdf.tsx`). `libraryCitationLinks` is a rehype
 * pass, run last so sanitize/harden never see its buttons; `CitationButton` is the Streamdown `button` component and
 * acts through `CitationPdfContext` (the workspace or 서재 provides it). Without a provider, citations stay plain text.
 * Kept free of the PDF viewer so the chat renderer does not load it.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { t } from "@/geo/i18n";
import { citationPage, citationSpans } from "@/geo/contracts/library";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Elements whose text is never a citation: code, links, buttons, math and raw blocks. */
const SKIP = new Set(["code", "pre", "a", "button", "script", "style", "svg", "math"]);

function splitText(node: HastNode): HastNode[] | null {
  const text = node.value ?? "";
  if (!text.includes("@")) return null;
  const spans = citationSpans(text);
  if (!spans.length) return null;
  const out: HastNode[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) out.push({ type: "text", value: text.slice(at, span.start) });
    out.push({
      type: "element", tagName: "button",
      properties: { type: "button", dataGaidCite: span.key, ...(span.locator ? { dataGaidCiteLocator: span.locator } : {}) },
      children: [{ type: "text", value: text.slice(span.start, span.end) }],
    });
    at = span.end;
  }
  if (at < text.length) out.push({ type: "text", value: text.slice(at) });
  return out;
}

/** Rehype plugin: each `@key, locator` inside a bracketed citation group becomes a `button[data-gaid-cite]`. */
export function libraryCitationLinks() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (!node.children || (node.tagName && SKIP.has(node.tagName))) return;
      const className = node.properties?.className;
      if (Array.isArray(className) && className.some((c) => typeof c === "string" && c.startsWith("katex"))) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text") return splitText(child) ?? [child];
        visit(child);
        return [child];
      });
    };
    visit(tree);
  };
}

export interface CitationRequest {
  key: string;
  locator?: string;
}

export interface CitationPdfOpener {
  /** Opens the cited PDF; resolves to a sentence saying why it could not, shown beside the citation (UI guide F5). */
  open: (citation: CitationRequest) => Promise<string | undefined>;
}

export const CitationPdfContext = createContext<CitationPdfOpener | null>(null);

/** Streamdown `button`: a library citation when the rehype pass marked it, else an ordinary button. */
export function CitationButton({ children, node: _node, ...rest }: Record<string, unknown> & { children?: ReactNode; node?: unknown }) {
  const opener = useContext(CitationPdfContext);
  const key = rest["data-gaid-cite"];
  if (typeof key !== "string") return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
  if (!opener) return <span>{children}</span>;
  const locator = typeof rest["data-gaid-cite-locator"] === "string" ? rest["data-gaid-cite-locator"] : undefined;
  return <LibraryCitation citation={{ key, locator }} opener={opener}>{children}</LibraryCitation>;
}

function LibraryCitation({ citation, opener, children }: { citation: CitationRequest; opener: CitationPdfOpener; children?: ReactNode }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const page = citationPage(citation.locator);
  const label = page ? t("library.cite.openPage", { key: citation.key, page }) : t("library.cite.open", { key: citation.key });
  const press = async () => {
    setBusy(true);
    try { setProblem(await opener.open(citation)); } finally { setBusy(false); }
  };
  return (
    <Popover open={Boolean(problem)} onOpenChange={(open) => { if (!open) setProblem(undefined); }}>
      <PopoverAnchor asChild>
        {/* An inline span, not a <button>: a button is an inline block, so a long citation would jump to the next line
            alone instead of wrapping with its sentence and brackets. */}
        <span role="button" tabIndex={0} data-gaid-cite={citation.key} aria-label={label} title={label} aria-busy={busy || undefined}
          onClick={() => void press()}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void press(); } }}
          className="cursor-pointer rounded-sm text-primary underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--gaid-signal)]">
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-80 p-3 text-sm" role="status">{problem}</PopoverContent>
    </Popover>
  );
}
