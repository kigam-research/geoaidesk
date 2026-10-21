"use client";

/**
 * 서재 (gaid-research-hub; layout chosen 2026-10-21: draft 다안 first screen + 나안 table + 가안 detail pane).
 * Left: large search, filter chips, the library table. Right: library status and recent papers, replaced by the
 * selected paper's detail ("내 연구에서 쓰인 곳", read coverage, next actions).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, FolderIcon, PlusIcon, SearchIcon, WorkflowIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listProjects, type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryItemResponse, LibraryItemSummary, LibraryListQuery, LibraryListResponse, LibraryUse, ReadCoverage } from "@/geo/contracts/library";
import { attachToProject, exportUrl, getLibraryItem, libraryPdfUrl, listLibrary, readItemText, sendItemToZotero, startWorkflowFromItem, zoteroSelectUrl } from "./api";
import { AddPaperDialog } from "./add-paper-dialog";
import { ZoteroCard } from "./zotero-card";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap";
const SOURCE_TONE = { zotero: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300", gaid: "border-primary/30 bg-primary/10 text-primary" } as const;
const COVERAGE_TONE: Record<ReadCoverage, string> = {
  full: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  partial: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  abstract: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  none: "border-border text-muted-foreground",
};
type Filter = "all" | "zotero" | "gaid" | "unread" | "cited";

function Badge({ label, hint, tone }: { label: string; hint: string; tone: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><span tabIndex={0} className={cn(PILL, tone)}>{label}</span></TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

function usedLine(row: LibraryItemSummary): string {
  const parts = [
    row.used.notes ? L("table.usedNotes", { n: row.used.notes }) : "",
    row.used.workflows ? L("table.usedWorkflows", { n: row.used.workflows }) : "",
    !row.used.notes && !row.used.workflows && row.used.projects ? L("table.usedProjects", { n: row.used.projects }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : L("table.none");
}

export interface LibraryScreenProps {
  onOpenProject: (projectId: string) => void;
}

export function LibraryScreen({ onOpenProject }: LibraryScreenProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<LibraryListResponse | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const q: LibraryListQuery = { q: query.trim() || undefined };
    if (filter === "zotero" || filter === "gaid") q.source = filter;
    if (filter === "unread" || filter === "cited") q.filter = filter;
    try {
      setData(await listLibrary(q));
      setError(false);
    } catch {
      setError(true);
    }
  }, [query, filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const zoteroLine = useMemo(() => {
    const synced = data?.zotero.map((z) => z.lastSyncAt).filter(Boolean).sort().at(-1);
    return synced ? L("screen.zoteroSynced", { when: new Date(synced).toLocaleTimeString() }) : L("screen.zoteroNone");
  }, [data]);

  const counts = data?.counts;
  const chips: { id: Filter; label: string }[] = counts
    ? [
        { id: "all", label: L("filter.all", { n: counts.all }) },
        { id: "zotero", label: L("filter.zotero", { n: counts.zotero }) },
        { id: "gaid", label: L("filter.gaid", { n: counts.gaid }) },
        { id: "unread", label: L("filter.unread", { n: counts.unread }) },
        { id: "cited", label: L("filter.cited", { n: counts.cited }) },
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 px-4 py-6 sm:px-8">
      <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label={L("screen.title")}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{L("screen.title")}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{zoteroLine}</span>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><DownloadIcon data-icon="inline-start" />{L("export.button")}</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1.5">
                {(["bibtex", "ris", "csl-json"] as const).map((f) => (
                  <a key={f} href={exportUrl(f)} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">{L(`export.${f === "csl-json" ? "csl" : f}`)}</a>
                ))}
              </PopoverContent>
            </Popover>
            <Button onClick={() => setAdding(true)}><PlusIcon data-icon="inline-start" />{L("add.button")}</Button>
          </div>
        </div>
        <label className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L("screen.search")} aria-label={L("screen.search")} className="h-full flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={L("filter.label")}>
            {chips.map((c) => (
              <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}
                className={cn(PILL, "px-2.5 py-0.5", filter === c.id ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{c.label}</button>
            ))}
          </div>
        )}
        {error ? (
          <p className="py-8 text-sm text-muted-foreground">{L("screen.error")}</p>
        ) : !data ? (
          <p className="py-8 text-sm text-muted-foreground">{L("screen.loading")}</p>
        ) : data.counts.all === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">{L("screen.empty")}</p>
            <Button variant="outline" onClick={() => setAdding(true)}><PlusIcon data-icon="inline-start" />{L("add.button")}</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{L("screen.state", { shown: data.total, total: data.counts.all })}</p>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="w-[52%] px-2 py-2 font-medium">{L("table.paper")}</th>
                    <th className="px-2 py-2 text-right font-medium">{L("table.year")}</th>
                    <th className="px-2 py-2 font-medium">{L("table.source")}</th>
                    <th className="px-2 py-2 font-medium">{L("table.read")}</th>
                    <th className="px-2 py-2 font-medium">{L("table.used")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-6 text-muted-foreground">{L("screen.noMatch")}</td></tr>
                  )}
                  {data.items.map((row) => (
                    <tr key={row.id} onClick={() => setSelected(row.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(row.id); } }}
                      tabIndex={0} aria-selected={selected === row.id} aria-label={row.title}
                      className={cn("cursor-pointer border-b align-top outline-none hover:bg-muted/50 focus-visible:bg-muted", selected === row.id && "bg-primary/5")}>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-foreground">{row.title}</div>
                        <div className="text-xs text-muted-foreground">{[row.authors, row.container].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="gaid-numeric px-2 py-2.5 text-right">{row.year ?? ""}</td>
                      <td className="px-2 py-2.5"><Badge label={L(`source.${row.source}`)} hint={L(`source.${row.source}Hint`)} tone={SOURCE_TONE[row.source]} /></td>
                      <td className="px-2 py-2.5">
                        {row.retracted
                          ? <Badge label={L("coverage.retracted")} hint={L("coverage.retractedHint")} tone="border-destructive/40 bg-destructive/10 text-destructive" />
                          : <Badge label={L(`coverage.${row.coverage}`)} hint={L(`coverage.${row.coverage}Hint`)} tone={COVERAGE_TONE[row.coverage]} />}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">{usedLine(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <aside className="flex w-[380px] shrink-0 flex-col gap-3">
        {selected ? (
          <ItemDetail id={selected} zoteroConnected={(data?.zotero ?? []).some((z) => z.state === "ok")} onClose={() => setSelected(null)} onOpenProject={onOpenProject} onChanged={load} />
        ) : (
          <SidePanel data={data} onSelect={setSelected} onChanged={load} />
        )}
      </aside>
      <AddPaperDialog open={adding} onOpenChange={setAdding} onAdded={(item) => { void load(); if (item) setSelected(item.id); }} />
    </div>
  );
}

function SidePanel({ data, onSelect, onChanged }: { data: LibraryListResponse | null; onSelect: (id: string) => void; onChanged: () => void }) {
  if (!data) return null;
  const byAdded = [...data.items].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="text-base font-semibold">{L("side.statusTitle")}</h2>
        <p className="text-sm">{L("side.papers", { n: data.counts.all })}</p>
        {data.counts.unread > 0 && <p className="text-sm text-muted-foreground">{L("side.unread", { n: data.counts.unread })}</p>}
      </div>
      <ZoteroCard libraries={data.zotero} onChanged={onChanged} />
      {byAdded.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-base font-semibold">{L("side.recentTitle")}</h2>
          {byAdded.slice(0, 4).map((row) => (
            <button key={row.id} type="button" onClick={() => onSelect(row.id)} className="border-l-2 border-primary pl-2.5 text-left text-sm hover:text-primary">
              <span className="line-clamp-2 font-medium">{row.title}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function useLabel(use: LibraryUse): string {
  if (use.kind === "note") return L("detail.useNote", { title: use.title });
  if (use.kind === "workflow") return L("detail.useWorkflow", { title: use.title });
  return L("detail.useProject", { name: use.projectName });
}

function ItemDetail({ id, zoteroConnected, onClose, onOpenProject, onChanged }: { id: string; zoteroConnected: boolean; onClose: () => void; onOpenProject: (projectId: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<LibraryItemResponse | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    getLibraryItem(id).then((r) => live && setData(r)).catch(() => live && setData(null));
    return () => { live = false; };
  }, [id]);
  if (!data) return <div className="rounded-xl border p-4 text-sm text-muted-foreground">{L("screen.loading")}</div>;
  const { item, uses } = data;
  const year = item.csl.issued?.["date-parts"]?.[0]?.[0];
  const authors = (item.csl.author ?? []).map((a) => a.family || a.literal || "").filter(Boolean);
  const hasPdf = item.attachments.some((a) => a.kind === "pdf" && a.stored);
  const zotero = zoteroSelectUrl(item);
  const r = item.read;

  const openUse = (use: LibraryUse) => {
    if (use.kind === "workflow" && use.authoringId) window.location.hash = `#hub/${use.authoringId}`;
    else if (use.kind === "note" || use.kind === "project") onOpenProject(use.projectId);
  };
  const attach = async (project: Project) => {
    try {
      await attachToProject(project.id, item.id);
      toast.success(L("detail.attached", { name: project.name }));
      onChanged();
      setData(await getLibraryItem(item.id));
    } catch {
      toast.error(L("detail.attachFailed"));
    }
  };
  const canRead = item.source === "zotero" && !hasPdf && item.attachments.some((a) => a.kind === "pdf" && a.zoteroAttachmentKey);
  const readText = async () => {
    try { await readItemText(item.id); toast.success(L("read.done")); setData(await getLibraryItem(item.id)); onChanged(); }
    catch { toast.error(L("read.failed")); }
  };
  const send = async () => {
    toast.info(L("send.confirm"));
    try { await sendItemToZotero(item.id); toast.success(L("send.done")); setData(await getLibraryItem(item.id)); onChanged(); }
    catch { toast.error(L("send.failed")); }
  };
  const makeWorkflow = async () => {
    try {
      const { authoringId } = await startWorkflowFromItem(item.id);
      toast.success(L("detail.workflowStarted"));
      window.location.hash = `#hub/${authoringId}`;
    } catch {
      toast.error(L("detail.workflowNeedsPdf"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{L(`source.${item.source}`)}</span>
        <Button variant="ghost" size="icon-sm" aria-label={L("detail.close")} onClick={onClose}><XIcon /></Button>
      </div>
      <h2 className="text-lg font-semibold leading-snug">{item.csl.title}</h2>
      <p className="text-sm text-muted-foreground">
        {[authors.length > 3 ? `${authors.slice(0, 3).join(", ")} …` : authors.join(", "), year, item.csl["container-title"] as string | undefined, item.csl.DOI ? L("detail.doi", { doi: item.csl.DOI }) : ""].filter(Boolean).join(" · ")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Popover onOpenChange={(open) => { if (open && !projects) listProjects().then(setProjects).catch(() => setProjects([])); }}>
          <PopoverTrigger asChild><Button><FolderIcon data-icon="inline-start" />{L("detail.attach.button")}</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <p className="px-2 pb-1 text-xs text-muted-foreground">{L("detail.attachTitle")}</p>
            {(projects ?? []).filter((p) => !p.archived).map((p) => (
              <button key={p.id} type="button" onClick={() => void attach(p)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{p.name}</button>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="outline" onClick={() => void makeWorkflow()} disabled={!hasPdf} title={hasPdf ? undefined : L("detail.workflowNeedsPdf")}>
          <WorkflowIcon data-icon="inline-start" />{L("detail.workflow.button")}
        </Button>
        {hasPdf && <Button variant="outline" asChild><a href={libraryPdfUrl(item.id)} target="_blank" rel="noreferrer"><FileTextIcon data-icon="inline-start" />{L("detail.pdf.button")}</a></Button>}
        {canRead && <Button variant="outline" onClick={() => void readText()}><BookOpenIcon data-icon="inline-start" />{L("read.button")}</Button>}
        {item.source === "gaid" && zoteroConnected && <Button variant="outline" onClick={() => void send()}><ExternalLinkIcon data-icon="inline-start" />{L("send.button")}</Button>}
        {zotero && <Button variant="outline" asChild><a href={zotero}><ExternalLinkIcon data-icon="inline-start" />{L("detail.zotero.button")}</a></Button>}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <h3 className="text-base font-semibold">{L("detail.usesTitle")}</h3>
        {uses.length === 0 && <p className="text-sm text-muted-foreground">{L("detail.usesEmpty")}</p>}
        {uses.map((use, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              {useLabel(use)}
              {use.kind === "note" && use.locators.length > 0 && <span className="text-muted-foreground"> · {use.locators.join(", ")}</span>}
            </span>
            <button type="button" onClick={() => openUse(use)} className="shrink-0 text-primary hover:underline">{L(`detail.open.${use.kind}.action`)}</button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-xl border p-4">
        <h3 className="flex items-center gap-1.5 text-base font-semibold"><BookOpenIcon className="size-4" aria-hidden />{L("detail.readTitle")}</h3>
        <p className="text-sm">
          {r.coverage === "full" ? L("detail.readFull", { pages: r.pagesTotal ?? 0 })
            : r.coverage === "partial" ? L("detail.readPartial", { read: r.pagesRead ?? 0, total: r.pagesTotal ?? 0, pages: (r.unreadablePages ?? []).join(", ") })
            : L("detail.readNone")}
        </p>
      </div>
    </div>
  );
}
