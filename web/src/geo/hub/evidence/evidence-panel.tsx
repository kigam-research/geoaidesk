"use client";
/**
 * Side viewer of an authoring question's evidence (gaid-authoring-evidence-view): the passages of the paper and the
 * other sources the question and its options cite, next to the question card. A list of the cited places on top
 * (functional layer), the quote, and the place itself: a PDF page (pdf.js, original pixels), a web page's text, the lines
 * of a code or note file, or a data file's inspection summary. Quotes the server did not find, removed sources and places
 * that do not exist are said as such; nothing is invented.
 */
import { AlertCircleIcon, FileTextIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CodeFileEntry, DataFileSummary } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { dataLineParts } from "../source-files";
import { EvidencePdf, type LocateState } from "./evidence-pdf";
import type { EvidenceItem } from "./evidence-items";
import { locateQuote, quoteLines } from "./quote-match";

const text = geoText("hub");

/** How the viewer reaches the sources of the draft (hub-screen supplies the authoring API). */
export interface EvidenceAccess {
  pdfUrl: (sourceId: string) => string;
  pageText: (sourceId: string, page: number) => Promise<string>;
  fileText: (sourceId: string, path: string) => Promise<string>;
  /** Open the whole PDF at a page (a larger viewer). */
  openFull?: (sourceId: string, page: number) => void;
}

const sourceName = (item: EvidenceItem) => item.source?.title ?? item.source?.name ?? "";

function placeLabel(item: EvidenceItem): string {
  if (item.anchor.page !== undefined) return text("questions.page", { page: item.anchor.page });
  return item.anchor.path ?? "";
}

export function EvidencePanel({
  items,
  active,
  onActive,
  optionLabel,
  standard,
  access,
}: {
  items: EvidenceItem[];
  active: string | null;
  onActive: (key: string) => void;
  optionLabel: (optionId: string) => string;
  /** A question GAID asks for every Workflow (no source passage by design). */
  standard: boolean;
  access: EvidenceAccess;
}) {
  const item = items.find((i) => i.key === active) ?? items[0];
  return (
    <aside
      aria-label={text("evidence.title")}
      className={cn(
        "flex flex-col self-start overflow-hidden rounded-lg border border-gaid-edge bg-gaid-face",
        item && "min-h-[420px] self-stretch lg:h-full lg:min-h-0",
      )}
    >
      <div className="flex flex-col gap-2 border-b border-gaid-edge bg-gaid-chrome px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gaid-ink">{text("evidence.title")}</h3>
          {items.length > 0 && (
            <span className="text-xs tabular-nums text-gaid-ink-2">{text("evidence.count", { count: items.length })}</span>
          )}
        </div>
        {items.length > 0 && (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto pl-2.5" aria-label={text("evidence.list")}>
            {items.map((i) => (
              <li key={i.key}>
                <EvidenceRow item={i} selected={i.key === item?.key} onSelect={() => onActive(i.key)} optionLabel={optionLabel} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {item ? (
        <EvidenceView key={item.key} item={item} access={access} />
      ) : (
        <p className="px-4 py-4 text-sm text-gaid-ink-2">
          {standard ? text("evidence.standard") : text("evidence.none")}
        </p>
      )}
    </aside>
  );
}

function EvidenceRow({
  item,
  selected,
  onSelect,
  optionLabel,
}: {
  item: EvidenceItem;
  selected: boolean;
  onSelect: () => void;
  optionLabel: (optionId: string) => string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // An option chosen in the card may select a row below the list's visible part.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  const tags = [
    ...(item.question ? [text("evidence.forQuestion")] : []),
    ...item.optionIds.map((id) => text("evidence.forOption", { label: optionLabel(id) })),
  ];
  const name = item.source ? sourceName(item) : text("evidence.removedName");
  const place = placeLabel(item);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-gaid-face focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected && "gaid-index bg-gaid-signal-tint",
      )}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className={cn("min-w-0 truncate text-gaid-ink", selected && "font-medium")} title={tags.join(", ")}>
          {tags.join(", ")}
        </span>
        {!item.anchor.verified && <span className="shrink-0 text-xs text-gaid-warning">{text("evidence.unconfirmedTag")}</span>}
      </span>
      <span className="flex min-w-0 items-baseline gap-2 text-xs text-gaid-ink-2">
        <span className="min-w-0 truncate" title={name}>
          {name}
        </span>
        {place && place !== name && <span className="shrink-0 tabular-nums">{place}</span>}
      </span>
    </button>
  );
}

/** The quote, its state and the place it comes from. */
function EvidenceView({ item, access }: { item: EvidenceItem; access: EvidenceAccess }) {
  const [state, setState] = useState<LocateState>("pending");
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);
  const verified = item.anchor.verified;
  const note = !item.source
    ? text("evidence.removed")
    : !verified
      ? item.place === "none"
        ? text("evidence.unconfirmedNoPlace")
        : text("evidence.unconfirmed")
      : item.place === "none"
        ? text("evidence.noPlace")
        : state === "partial"
          ? text("evidence.partial")
          : state === "absent"
            ? text("evidence.notLocated")
            : null;
  const warn = !item.source || !verified || item.place === "none" || state === "absent";
  const loading = <p className="px-4 py-6 text-sm text-gaid-ink-2">{text("evidence.loading")}</p>;
  const failed = (again: () => void) => (
    <div className="flex flex-col items-start gap-2 px-4 py-6 text-sm">
      <p className="text-gaid-ink">{text("evidence.loadFailed")}</p>
      <Button size="sm" variant="outline" onClick={again}>
        {text("evidence.retry.button")}
      </Button>
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b border-gaid-edge px-4 py-3">
        <blockquote className="line-clamp-4 text-sm leading-relaxed text-gaid-ink" title={item.anchor.quote}>
          <q>{item.anchor.quote}</q>
        </blockquote>
        {note && (
          <p
            role="status"
            className={cn("flex items-start gap-1.5 text-xs", warn ? "text-gaid-warning" : "text-gaid-ink-2")}
          >
            {warn && <AlertCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />}
            {note}
          </p>
        )}
      </div>
      {item.source && item.place === "pdf" ? (
        <EvidencePdf
          url={access.pdfUrl(item.anchor.sourceId)}
          page={item.anchor.page!}
          quote={item.anchor.quote}
          mark={verified}
          onLocate={setState}
          onOpenFull={access.openFull ? (p) => access.openFull!(item.anchor.sourceId, p) : undefined}
          onRetry={retry}
          attempt={attempt}
          loading={loading}
          failed={failed}
        />
      ) : item.source && item.place === "page" ? (
        <Loaded key={attempt} load={() => access.pageText(item.anchor.sourceId, item.anchor.page!)} loading={loading} failed={() => failed(retry)}>
          {(body) => <PageText body={body} quote={verified ? item.anchor.quote : null} onLocate={setState} />}
        </Loaded>
      ) : item.source && item.place === "file" ? (
        <Loaded key={attempt} load={() => access.fileText(item.anchor.sourceId, item.anchor.path!)} loading={loading} failed={() => failed(retry)}>
          {(body) => <FileLines path={item.anchor.path!} body={body} quote={verified ? item.anchor.quote : null} onLocate={setState} />}
        </Loaded>
      ) : item.source && item.place === "data" && item.file?.data ? (
        <DataSummary file={item.file as CodeFileEntry & { data: DataFileSummary }} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-gaid-ink-2">
          <FileTextIcon className="size-5" aria-hidden />
          {item.source ? sourceName(item) : text("evidence.removedName")}
        </div>
      )}
    </div>
  );
}

function Loaded({
  load,
  loading,
  failed,
  children,
}: {
  load: () => Promise<string>;
  loading: React.ReactNode;
  failed: () => React.ReactNode;
  children: (body: string) => React.ReactNode;
}) {
  const [state, setState] = useState<{ body?: string; error?: boolean }>({});
  const run = useRef(load);
  useEffect(() => {
    let cancelled = false;
    run
      .current()
      .then((body) => !cancelled && setState({ body }))
      .catch(() => !cancelled && setState({ error: true }));
    return () => {
      cancelled = true;
    };
  }, []);
  if (state.error) return <>{failed()}</>;
  if (state.body === undefined) return <>{loading}</>;
  return <>{children(state.body)}</>;
}

/** Scroll the marked element into the upper third of its scroller once. */
function useScrollToMark() {
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLElement | null>(null);
  const setMark = useCallback((el: HTMLElement | null) => {
    mark.current = el;
  }, []);
  useEffect(() => {
    const b = box.current;
    const m = mark.current;
    if (!b || !m) return;
    const top = m.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop;
    b.scrollTo?.({ top: Math.max(0, top - b.clientHeight / 3) });
  }, []);
  return { box, setMark };
}

function PageText({ body, quote, onLocate }: { body: string; quote: string | null; onLocate: (s: LocateState) => void }) {
  const range = useMemo(() => (quote ? locateQuote(quote, body) : null), [quote, body]);
  useEffect(() => {
    if (quote) onLocate(range ? (range.partial ? "partial" : "found") : "absent");
  }, [quote, range, onLocate]);
  const { box, setMark } = useScrollToMark();
  return (
    <div ref={box} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="max-w-[680px] whitespace-pre-wrap text-sm leading-relaxed text-gaid-ink">
        {range ? (
          <>
            {body.slice(0, range.start)}
            <mark ref={setMark} className="rounded-[2px] bg-gaid-signal-tint text-gaid-ink outline outline-1 outline-gaid-signal">
              {body.slice(range.start, range.end)}
            </mark>
            {body.slice(range.end)}
          </>
        ) : (
          body
        )}
      </p>
    </div>
  );
}

/** Lines around the quote (the whole file when short), numbered as in the source file. */
const AROUND = 30;
const SHORT_FILE = 400;

function FileLines({
  path,
  body,
  quote,
  onLocate,
}: {
  path: string;
  body: string;
  quote: string | null;
  onLocate: (s: LocateState) => void;
}) {
  const lines = body.split("\n");
  const hit = useMemo(() => (quote ? quoteLines(body, quote) : null), [quote, body]);
  useEffect(() => {
    if (quote) onLocate(hit ? (hit.partial ? "partial" : "found") : "absent");
  }, [quote, hit, onLocate]);
  const from = lines.length <= SHORT_FILE ? 1 : Math.max(1, (hit?.first ?? 1) - AROUND);
  const to = lines.length <= SHORT_FILE ? lines.length : Math.min(lines.length, (hit?.last ?? 1) + AROUND * 2);
  const { box, setMark } = useScrollToMark();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="truncate border-b border-gaid-edge px-4 py-1.5 font-mono text-xs text-gaid-ink-2" title={path}>
        {path}
        {(from > 1 || to < lines.length) && ` · ${text("evidence.window", { first: from, last: to, total: lines.length })}`}
      </p>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-gaid-face-2 py-2">
        <pre className="font-mono text-xs leading-5 text-gaid-ink">
          {lines.slice(from - 1, to).map((line, i) => {
            const n = from + i;
            const marked = hit !== null && n >= hit.first && n <= hit.last;
            return (
              <div
                key={n}
                ref={marked && n === hit!.first ? setMark : undefined}
                className={cn("flex", marked && "bg-gaid-signal-tint")}
              >
                <span
                  aria-hidden
                  className={cn("w-12 shrink-0 select-none pr-3 text-right tabular-nums text-gaid-ink-3", marked && "text-gaid-signal-ink")}
                >
                  {n}
                </span>
                <span className="whitespace-pre pr-4">{line || " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

const LIST_LIMIT = 12;

/** A data file is shown by what the inspection read from it (the coauthor saw the same summary). */
function DataSummary({ file }: { file: CodeFileEntry & { data: DataFileSummary } }) {
  const d = file.data;
  const parts = dataLineParts([file]);
  const line = parts
    ? [
        parts.format,
        ...parts.facts.map((f) => text(`sources.fact_${f.key}`, { count: f.count })),
        ...(parts.crs === null ? [] : [parts.crs || text("sources.crsUnknown")]),
      ].join(", ")
    : "";
  const fields: { name: string; detail?: string }[] = [
    ...(d.columns ?? []).map((c) => ({ name: c.name, detail: [c.type, c.unit].filter(Boolean).join(", ") })),
    ...(d.curves ?? []).map((c) => ({ name: c.mnemonic, detail: [c.unit, c.description].filter(Boolean).join(", ") })),
    ...(d.layers ?? []).map((l) => ({ name: l.name, detail: l.geometryType })),
    ...(d.bands ?? []).map((b) => ({ name: text("evidence.band", { index: b.index }), detail: [b.dtype, b.unit].filter(Boolean).join(", ") })),
  ];
  // A table with the inspector's first rows is shown as a small table (header + those rows).
  const table = d.columns?.length && d.preview?.length ? { columns: d.columns, rows: d.preview.slice(0, 5) } : null;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="truncate font-mono text-xs text-gaid-ink-2" title={file.path}>
        {file.path}
      </p>
      <p className="mt-1 text-sm text-gaid-ink">{text("evidence.dataSummary", { summary: line })}</p>
      {table ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-gaid-edge">
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">{text("evidence.previewCaption")}</caption>
            <thead className="bg-gaid-face-2 text-left text-gaid-ink-2">
              <tr>
                {table.columns.map((c) => (
                  <th key={c.name} scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-medium">
                    {c.unit ? `${c.name} (${c.unit})` : c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gaid-edge font-mono text-gaid-ink">
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {table.columns.map((c, i) => (
                    <td key={c.name} className="whitespace-nowrap px-2.5 py-1">
                      {row[i] === null || row[i] === undefined ? "" : String(row[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : fields.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-gaid-edge rounded-md border border-gaid-edge text-sm">
          {fields.slice(0, LIST_LIMIT).map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 truncate font-mono text-xs text-gaid-ink">{f.name}</span>
              {f.detail && <span className="shrink-0 text-xs text-gaid-ink-2">{f.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {table && <p className="mt-2 text-xs text-gaid-ink-2">{text("evidence.previewNote", { count: table.rows.length })}</p>}
      {!table && fields.length > LIST_LIMIT && (
        <p className="mt-2 text-xs text-gaid-ink-2">{text("evidence.moreFields", { count: fields.length - LIST_LIMIT })}</p>
      )}
    </div>
  );
}
