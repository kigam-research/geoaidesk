"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibraryItemSummary } from "@/geo/contracts/library";
import { geoText } from "@/geo/i18n";
import { openLibrary } from "@/geo/places/navigation";
import { SEG_TRACK, segItem } from "@/geo/shell/segmented";
import { cn } from "@/lib/utils";
import { attachToProject, getDigestCandidates, getLibraryItem, listLibrary } from "./api";
import type { DigestCandidate } from "@/geo/contracts/library";

const text = geoText("library");
const digestText = geoText("digest");
const PAGE_SIZE = 100;

/** The project's citation scope, including attached folders and their descendants, beside the work it supports. */
export function ProjectLibraryPanel({ projectId, selectedId, citedPage, citationSequence, onOpenPdf }: {
  projectId: string;
  selectedId?: string;
  citedPage?: number;
  citationSequence?: number;
  onOpenPdf: (item: LibraryItemSummary, page: number) => void;
}) {
  const [scope, setScope] = useState<"project" | "all">("project");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LibraryItemSummary[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<LibraryItemSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [attached, setAttached] = useState<string[]>([]);
  const request = useRef(0);
  // gaid-library-prep: 문헌 정리 covering the project's papers, which its Workflow starts can read first.
  const [digests, setDigests] = useState<DigestCandidate[]>([]);
  useEffect(() => {
    let active = true;
    getDigestCandidates(projectId).then((r) => { if (active) setDigests(r.digests); }).catch(() => { if (active) setDigests([]); });
    return () => { active = false; };
  }, [projectId, refresh]);
  const selectionGeneration = useRef(0);
  const handledCitation = useRef<{ id?: string; sequence?: number }>({});

  useEffect(() => {
    let active = true;
    listLibrary({ kind: "paper", filter: "project", limit: 1 }, projectId)
      .then((res) => { if (active) setProjectCount(res.total); })
      .catch(() => { /* The list request below reports a failed read. */ });
    return () => { active = false; };
  }, [projectId, refresh]);

  useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    setError(undefined);
    // Search is server-side so papers beyond the current page are searchable too.
    const timer = setTimeout(() => {
      listLibrary({ kind: "paper", ...(scope === "project" ? { filter: "project" as const } : {}), q: query, limit: PAGE_SIZE, offset }, projectId)
        .then((res) => {
          if (current !== request.current) return;
          setRows((old) => offset ? [...old, ...res.items] : res.items);
          setTotal(res.total);
          setError(undefined);
        })
        .catch(() => { if (current === request.current) setError(text("panel.failed")); })
        .finally(() => { if (current === request.current) setLoading(false); });
    }, 150);
    return () => { clearTimeout(timer); request.current++; };
  }, [projectId, scope, query, offset, refresh]);

  // A citation selects its paper even when it is outside the project's scope or current search page.
  useEffect(() => {
    if (!selectedId || (handledCitation.current.id === selectedId && handledCitation.current.sequence === citationSequence)) return;
    let active = true;
    const generation = ++selectionGeneration.current;
    const select = (item: LibraryItemSummary) => {
      if (!active || generation !== selectionGeneration.current) return;
      handledCitation.current = { id: selectedId, sequence: citationSequence };
      setSelected(item);
    };
    const existing = rows.find((row) => row.id === selectedId);
    if (existing) { select(existing); return; }
    // A targeted citation-key lookup is not needed: the existing PDF state supplies the item id, and a paginated
    // scan is avoided by loading only the selected item's detail.
    getLibraryItem(selectedId).then(({ item }) => {
      if (!active || generation !== selectionGeneration.current) return;
      const year = item.csl.issued?.["date-parts"]?.[0]?.[0];
      select({ id: item.id, title: item.csl.title, authors: (item.csl.author ?? []).map((a) => a.family ?? a.literal ?? "").slice(0, 2).join(", "), year, citationKey: item.citationKey,
        storedPdf: item.attachments.some((a) => a.kind === "pdf" && Boolean(a.stored)), hasPdf: true,
        source: item.source, coverage: item.read.coverage, collectionIds: item.collectionIds, tags: item.tags,
        used: { notes: 0, projects: 0, workflows: 0 }, metadataConfirmed: item.metadataConfirmed, addedAt: item.addedAt, kind: "paper" });
    }).catch(() => { if (active && generation === selectionGeneration.current) setError(text("panel.failed")); });
    return () => { active = false; };
  }, [selectedId, citationSequence, rows]);

  return (
    <section aria-label={text("panel.title")} className="flex min-h-0 flex-1 flex-col bg-gaid-face">
      <header className="space-y-3 border-b border-gaid-edge bg-gaid-chrome p-4">
        <div className={cn(SEG_TRACK, "w-full flex-nowrap")} role="group" aria-label={text("panel.scope")}>
          {(["project", "all"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={scope === value}
              className={segItem(scope === value, "min-w-0 flex-1 justify-center whitespace-nowrap px-2")}
              onClick={() => { setScope(value); setOffset(0); }}>
              {text(value === "project" ? "panel.project" : "panel.all", { count: projectCount })}
            </button>
          ))}
        </div>
        <label className="relative block">
          <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-3" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setOffset(0); }}
            className="pl-9" aria-label={text("panel.search")} placeholder={text("panel.search")} />
        </label>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
        {error && <div role="alert" className="p-4 text-sm text-gaid-danger">{error}
          <Button variant="ghost" size="sm" onClick={() => setRefresh((n) => n + 1)}>{text("panel.retry")}</Button>
        </div>}
        {loading && <p role="status" className="p-4 text-sm text-gaid-ink-2">{text("panel.loading")}</p>}
        {!loading && !error && !rows.length && <p className="p-4 text-sm text-gaid-ink-2">
          {text(query.trim() ? "panel.noMatch" : scope === "project" ? "panel.emptyProject" : "panel.empty")}
        </p>}
        {scope === "project" && !query.trim() && digests.length > 0 && <div className="border-b border-gaid-edge px-4 py-3">
          <p className="pb-1.5 text-xs font-semibold text-gaid-ink-3">{digestText("panel.title", { count: digests.length })}</p>
          <ul className="flex flex-col gap-1">
            {digests.map((d) => <li key={d.itemId}>
              <button type="button" onClick={() => openLibrary({ itemId: d.itemId })} title={digestText("panel.openTip")}
                className="-mx-2 flex w-[calc(100%+1rem)] flex-col rounded-md px-2 py-1.5 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                <span className="block truncate text-xs text-gaid-ink-2 tabular-nums">{[digestText("panel.covers", { covered: d.covered, total: d.total }), digestText(`origin.${d.origin}`), digestText(`status.${d.status}`)].join(" · ")}</span>
              </button>
            </li>)}
          </ul>
        </div>}
        <ul className="divide-y divide-gaid-edge">
          {!loading && rows.map((row) => <li key={row.id}>
            <button type="button" aria-pressed={selected?.id === row.id}
              className={cn("relative flex min-h-14 w-full flex-col justify-center px-4 py-2 text-left hover:bg-gaid-hover", selected?.id === row.id && "gaid-index bg-gaid-signal-tint")}
              onClick={() => {
                // Browsing is newer than the last citation request, including a still-pending detail lookup.
                selectionGeneration.current++;
                handledCitation.current = { id: selectedId, sequence: citationSequence };
                setSelected(row);
              }}>
              <span className="block w-full truncate text-sm font-medium" title={row.title}>{row.title}</span>
              <span className="block w-full truncate text-xs text-gaid-ink-2">{[row.authors, row.year].filter(Boolean).join(" · ")}</span>
            </button>
          </li>)}
        </ul>
        {!loading && rows.length < total && <Button variant="ghost" className="m-3" onClick={() => setOffset(rows.length)}>
          {text("panel.more")}
        </Button>}
      </div>
      {selected && <div className="space-y-3 border-t border-gaid-edge bg-gaid-face-2 p-4">
        <p className="line-clamp-2 text-sm font-medium">{selected.title}</p>
        <div className="flex flex-wrap gap-2">
          {selected.storedPdf ? <Button size="sm" variant="outline" onClick={() => onOpenPdf(selected, selected.id === selectedId ? citedPage ?? 1 : 1)}>
            {text("panel.openPdf", { page: selected.id === selectedId ? citedPage ?? 1 : 1 })}
          </Button> : <span className="text-xs text-gaid-ink-2">{text("panel.noPdf")}</span>}
          {scope === "all" && <Button size="sm" variant="outline" disabled={busy || attached.includes(selected.id)} onClick={async () => {
            setBusy(true); setError(undefined);
            try { await attachToProject(projectId, selected.id); setAttached((ids) => [...ids, selected.id]); setOffset(0); setRefresh((n) => n + 1); }
            catch { setError(text("panel.attachFailed")); }
            finally { setBusy(false); }
          }}>{text(attached.includes(selected.id) ? "panel.attached" : busy ? "panel.attaching" : "panel.attach")}</Button>}
        </div>
      </div>}
      <footer className="border-t border-gaid-edge p-3">
        <Button variant="ghost" size="sm" onClick={() => openLibrary({ itemId: selected?.id })}>{text("panel.fullScreen")}</Button>
      </footer>
    </section>
  );
}
