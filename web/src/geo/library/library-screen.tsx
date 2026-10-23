"use client";

/**
 * 서재 (gaid-research-hub; layout chosen 2026-10-21: draft 다안 first screen + 나안 table + 가안 detail pane).
 * Left: the folder tree (gaid-library-folders). Middle: large search, filter chips, the library table of all papers or
 * of the selected folder (subfolders included). Right: library status and recent papers, the selected folder's 인용 관리,
 * or the selected paper's detail ("내 연구에서 쓰인 곳", folders, read coverage, next actions).
 * gaid-note-library: a 논문 / 정리 노트 switch above the table; research notes have their own table and detail
 * (web/src/geo/library/note-items.tsx).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, FolderIcon, NotebookTextIcon, PlusIcon, SearchIcon, WorkflowIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listProjects, type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryCollection, LibraryItemKind, LibraryItemResponse, LibraryItemSummary, LibraryListQuery, LibraryListResponse, LibraryUse, ReadCoverage } from "@/geo/contracts/library";
import { attachToProject, createFolder, exportUrl, getLibraryItem, libraryPdfUrl, listLibrary, readItemText, renameFolder, sendItemToZotero, setFolderItems, startWorkflowFromItem, zoteroSelectUrl, zoteroState } from "./api";
import { requestOpenResearchNote } from "@/geo/notes/open-note";
import { AddNotesDialog, NoteItemDetail, NoteTable } from "./note-items";
import { ItemFolders } from "./item-folders";
import { AddPaperDialog } from "./add-paper-dialog";
import { ZoteroCard } from "./zotero-card";
import { zoteroStatus } from "./zotero-status";
import { FolderTree, ITEM_DRAG_TYPE, folderPath } from "./folder-tree";
import { FolderPanel, sendResultLine } from "./folder-panel";
import { FolderNameDialog } from "./folder-name-dialog";
import { OrcidCard } from "@/geo/orcid/orcid-card";
import { OrcidImportDialog } from "@/geo/orcid/import-dialog";
import { getOrcid } from "@/geo/orcid/api";
import type { OrcidStatus } from "@/geo/contracts/orcid";
import { LibrarySyncLine } from "./sync-line";
import { PaperMapEntry } from "./paper-map-entry";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap";
// Source is provenance, not status: both stay neutral (guide v2 I2, S3); read coverage is the row's one status mark (S2).
const SOURCE_TONE = { zotero: "border-gaid-control-edge text-gaid-ink-2", gaid: "border-gaid-edge bg-gaid-face-2 text-gaid-ink-2" } as const;
const COVERAGE_TONE: Record<ReadCoverage, string> = {
  full: "border-transparent bg-gaid-success-tint text-gaid-success",
  partial: "border-transparent bg-gaid-warning-tint text-gaid-warning",
  abstract: "border-transparent bg-gaid-warning-tint text-gaid-warning",
  none: "border-gaid-edge text-gaid-ink-3",
};
type Filter = "all" | "zotero" | "gaid" | "unread" | "cited" | "mine" | "pending" | "confirmed";

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
  // A research note opens in its project's notebook tab (the workspace takes the request after the switch).
  const openNote = useCallback((projectId: string, noteId: string) => {
    requestOpenResearchNote({ projectId, noteId });
    onOpenProject(projectId);
  }, [onOpenProject]);
  const [category, setCategory] = useState<LibraryItemKind>("paper");
  const [addingNotes, setAddingNotes] = useState(false);
  const [orcid, setOrcid] = useState<OrcidStatus | null>(null);
  const [orcidError, setOrcidError] = useState(false);
  const [orcidOpen, setOrcidOpen] = useState(false);
  const [orcidStarted, setOrcidStarted] = useState(false);
  const loadOrcid = useCallback(async () => {
    try { setOrcid(await getOrcid()); setOrcidError(false); }
    catch { setOrcidError(true); }
  }, []);
  useEffect(() => { void loadOrcid(); }, [loadOrcid]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<LibraryListResponse | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ mode: "create" | "rename"; parentId?: string } | null>(null);

  const load = useCallback(async () => {
    const q: LibraryListQuery = { q: query.trim() || undefined, collectionId: folderId ?? undefined, kind: category };
    if (category === "note") { if (filter === "pending" || filter === "confirmed") q.noteStatus = filter; }
    else if (filter === "zotero" || filter === "gaid") q.source = filter;
    else if (filter === "unread" || filter === "cited" || filter === "mine") q.filter = filter;
    try {
      setData(await listLibrary(q));
      setError(false);
    } catch {
      setError(true);
    }
  }, [query, filter, folderId, category]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Same status as the Zotero card (zoteroStatus): a failed refresh is never shown as connected or not connected.
  const zoteroLine = useMemo(() => {
    const status = zoteroStatus(data?.zotero ?? []);
    if (status.kind === "synced") return L("screen.zoteroSynced", { when: new Date(status.at).toLocaleTimeString() });
    if (status.kind === "not-synced") return L("screen.zoteroNotSynced");
    if (status.kind === "failed") return L("screen.zoteroFailed");
    return L("screen.zoteroNone");
  }, [data]);

  const collections = data?.collections ?? [];
  const folder = folderId ? collections.find((c) => c.id === folderId) : undefined;
  const zoteroConnected = (data?.zotero ?? []).some((z) => z.state === "ok");
  const counts = data?.counts;
  const addToFolder = async (target: string, itemId: string) => {
    try {
      const r = await setFolderItems(target, [itemId], "add");
      const name = collections.find((c) => c.id === target)?.name ?? "";
      if (r.changed) toast.success(r.writtenToZotero ? L("folders.addedZotero", { name }) : L("folders.added", { name }));
      void load();
    } catch (error) {
      const state = zoteroState(error);
      toast.error(state ? t(`library.zotero.states.${state}`) : L("folders.addFailed"));
    }
  };
  const submitName = async (name: string) => {
    if (naming?.mode === "rename" && folderId) await renameFolder(folderId, name);
    else { const made = await createFolder(name, naming?.parentId); setFolderId(made.id); setSelected(null); }
    await load();
  };
  const refreshAfterOrcid = () => { void loadOrcid(); void load(); };
  const notes = category === "note";
  const chips: { id: Filter; label: string }[] = !counts ? [] : notes
    ? [
        { id: "all", label: L("filter.all", { n: counts.notes }) },
        { id: "pending", label: L("notes.filter.pending", { n: counts.notesPending }) },
        { id: "confirmed", label: L("notes.filter.confirmed", { n: counts.notesConfirmed }) },
      ]
    : [
        { id: "all", label: L("filter.all", { n: counts.all }) },
        { id: "zotero", label: L("filter.zotero", { n: counts.zotero }) },
        { id: "gaid", label: L("filter.gaid", { n: counts.gaid }) },
        { id: "unread", label: L("filter.unread", { n: counts.unread }) },
        { id: "cited", label: L("filter.cited", { n: counts.cited }) },
      ]
  if (counts && !notes && (counts.mine > 0 || orcid?.profile || filter === "mine")) chips.splice(1, 0, { id: "mine", label: L("filter.mine", { n: counts.mine }) });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-5 px-4 py-6 sm:px-6">
      <FolderTree collections={collections} counts={data?.folderCounts ?? {}} total={(notes ? counts?.notes : counts?.all) ?? 0} allLabel={notes ? L("notes.allFolder") : undefined} selected={folderId}
        onSelect={(id) => { setFolderId(id); setSelected(null); }} onCreate={() => setNaming({ mode: "create" })} onDropItem={(f, item) => void addToFolder(f, item)} />
      <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label={L("screen.title")}>
        <LibrarySyncLine onSynced={load} refreshKey={data} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-xl font-semibold">{folder ? folderPath(collections, folder.id) : L("screen.title")}</h1>
          <div className="flex items-center gap-3">
            {!notes && <span className="text-xs text-muted-foreground">{zoteroLine}</span>}
            {notes ? (
              <Button onClick={() => setAddingNotes(true)}><NotebookTextIcon data-icon="inline-start" />{L("notes.add.button")}</Button>
            ) : (<>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline"><DownloadIcon data-icon="inline-start" />{L("export.button")}</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1.5">
                {(["bibtex", "ris", "csl-json"] as const).map((f) => (
                  <a key={f} href={exportUrl(f, folderId ?? undefined)} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">{L(`export.${f === "csl-json" ? "csl" : f}`)}</a>
                ))}
              </PopoverContent>
            </Popover>
            <Button onClick={() => setAdding(true)}><PlusIcon data-icon="inline-start" />{L("add.button")}</Button>
            </>)}
          </div>
        </div>
        <div className="gaid-seg flex w-fit items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5" role="group" aria-label={L("category.label")}>
          {(["paper", "note"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={category === k}
              onClick={() => { if (category !== k) { setCategory(k); setFilter("all"); setSelected(null); } }}
              className={cn("rounded-md px-3 py-1 text-sm font-medium", category === k ? "bg-gaid-face text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {L(`category.${k}`, { n: (k === "note" ? counts?.notes : counts?.all) ?? 0 })}
            </button>
          ))}
        </div>
        <label className="flex h-11 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={folder ? L("screen.searchFolder", { name: folder.name }) : notes ? L("notes.search") : L("screen.search")} aria-label={folder ? L("screen.searchFolder", { name: folder.name }) : notes ? L("notes.search") : L("screen.search")} className="h-full flex-1 bg-transparent text-[15px] outline-none" />
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
        ) : folder && data.total === 0 && !query.trim() && filter === "all" ? (
          <p className="py-8 text-sm text-muted-foreground">{L("folders.emptyFolder")}</p>
        ) : notes && data.counts.notes === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">{L("notes.empty")}</p>
            <Button variant="outline" onClick={() => setAddingNotes(true)}><NotebookTextIcon data-icon="inline-start" />{L("notes.add.button")}</Button>
          </div>
        ) : notes ? (
          <>
            <p className="text-xs text-muted-foreground">{folder ? L("notes.stateFolder", { shown: data.total, total: data.folderCounts[folder.id] ?? 0 }) : L("notes.state", { shown: data.total, total: data.counts.notes })}</p>
            <div className="min-h-0 flex-1 overflow-auto"><NoteTable rows={data.items} selected={selected} onSelect={setSelected} /></div>
          </>
        ) : data.counts.all === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">{L("screen.empty")}</p>
            <Button variant="outline" onClick={() => setAdding(true)}><PlusIcon data-icon="inline-start" />{L("add.button")}</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{folder ? L("screen.stateFolder", { shown: data.total, total: data.folderCounts[folder.id] ?? 0 }) : L("screen.state", { shown: data.total, total: data.counts.all })}</p>
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
                      draggable onDragStart={(e) => { e.dataTransfer.setData(ITEM_DRAG_TYPE, row.id); e.dataTransfer.effectAllowed = "copy"; }}
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
      <aside className="flex w-[340px] shrink-0 flex-col gap-3">
        {selected ? (
          <ItemDetail id={selected} collections={collections} zoteroConnected={zoteroConnected} onClose={() => setSelected(null)} onOpenProject={onOpenProject} onOpenNote={openNote} onSelect={setSelected} onChanged={load} />
        ) : folder ? (
          <FolderPanel folder={folder} collections={collections} count={data?.folderCounts[folder.id] ?? 0} zoteroConnected={zoteroConnected}
            onSelectItem={setSelected} onCreateSub={() => setNaming({ mode: "create", parentId: folder.id })} onRename={() => setNaming({ mode: "rename" })}
            onDeleted={() => { setFolderId(null); void load(); }} onChanged={load} />
        ) : (
          <>
            {!notes && <OrcidCard status={orcid} loadError={orcidError} onStatus={setOrcid} onChanged={refreshAfterOrcid} onRetry={() => void loadOrcid()} onImport={() => { setOrcidStarted(true); setOrcidOpen(true); }} />}
            <SidePanel data={data} notes={notes} onSelect={setSelected} onChanged={load} />
          </>
        )}
      </aside>
      {orcidStarted && orcid?.profile && <OrcidImportDialog profile={orcid.profile} key={orcid.profile.orcid} open={orcidOpen} onOpenChange={setOrcidOpen} collections={collections} onImported={refreshAfterOrcid} />}
      <AddNotesDialog open={addingNotes} onOpenChange={setAddingNotes} folder={folder} onAdded={(firstId) => { void load(); if (firstId) setSelected(firstId); }} />
      <AddPaperDialog open={adding} onOpenChange={setAdding} onAdded={(item) => {
        if (item && folderId) void addToFolder(folderId, item.id); else void load();
        if (item) setSelected(item.id);
      }} />
      <FolderNameDialog mode={naming?.mode ?? null} initialName={naming?.mode === "rename" ? folder?.name : undefined}
        parentName={naming?.parentId ? collections.find((c) => c.id === naming.parentId)?.name : undefined}
        onClose={() => setNaming(null)} onSubmit={submitName} />
    </div>
  );
}

function SidePanel({ data, notes, onSelect, onChanged }: { data: LibraryListResponse | null; notes: boolean; onSelect: (id: string) => void; onChanged: () => void }) {
  if (!data) return null;
  const byAdded = [...data.items].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="text-base font-semibold">{L("side.statusTitle")}</h2>
        <p className="text-sm">{L("side.papers", { n: data.counts.all })}</p>
        {data.counts.notes > 0 && <p className="text-sm">{L("notes.side", { n: data.counts.notes })}</p>}
        {data.counts.unread > 0 && <p className="text-sm text-muted-foreground">{L("side.unread", { n: data.counts.unread })}</p>}
      </div>
      {/* Research notes never go to Zotero; its card belongs to the papers. */}
      {!notes && <ZoteroCard libraries={data.zotero} papers={data.counts.zotero} onChanged={onChanged} />}
      {byAdded.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-base font-semibold">{L(notes ? "notes.recentTitle" : "side.recentTitle")}</h2>
          {byAdded.slice(0, 4).map((row) => (
            <button key={row.id} type="button" onClick={() => onSelect(row.id)} className="-mx-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gaid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="line-clamp-2 font-medium">{row.title}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function useLabel(use: LibraryUse): string {
  if (use.kind === "note") return use.remote ? L("detail.useNoteRemote", { title: use.title, name: use.projectName }) : L("detail.useNote", { title: use.title });
  if (use.kind === "workflow") return L("detail.useWorkflow", { title: use.title });
  return L("detail.useProject", { name: use.projectName });
}

function ItemDetail({ id, collections, zoteroConnected, onClose, onOpenProject, onOpenNote, onSelect, onChanged }: { id: string; collections: LibraryCollection[]; zoteroConnected: boolean; onClose: () => void; onOpenProject: (projectId: string) => void; onOpenNote: (projectId: string, noteId: string) => void; onSelect: (id: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<LibraryItemResponse | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setSendNote(null);
    getLibraryItem(id).then((r) => live && setData(r)).catch(() => live && setData(null));
    return () => { live = false; };
  }, [id]);
  if (!data) return <div className="rounded-xl border p-4 text-sm text-muted-foreground">{L("screen.loading")}</div>;
  if (data.item.kind === "note" && data.item.note)
    return <NoteItemDetail data={data} collections={collections} onClose={onClose} onOpenNote={onOpenNote} onSelect={onSelect} onChanged={onChanged} onReload={async () => setData(await getLibraryItem(id))} />;
  const { item, uses } = data;
  const year = item.csl.issued?.["date-parts"]?.[0]?.[0];
  const authors = (item.csl.author ?? []).map((a) => a.family || a.literal || "").filter(Boolean);
  const hasPdf = item.attachments.some((a) => a.kind === "pdf" && a.stored);
  const zotero = zoteroSelectUrl(item);
  const r = item.read;

  const openUse = (use: LibraryUse) => {
    if (use.kind === "workflow" && use.authoringId) window.location.hash = `#hub/${use.authoringId}`;
    // A note whose project is on another PC opens as its library item; a local note opens in its project.
    else if (use.kind === "note") { if (use.remote && use.libraryItemId) onSelect(use.libraryItemId); else onOpenNote(use.projectId, use.noteId); }
    else if (use.kind === "project") onOpenProject(use.projectId);
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
    setSendNote(L("send.confirm"));
    try {
      const r = await sendItemToZotero(item.id);
      setSendNote(r.stopped ? L("send.stopped", { done: sendResultLine(r) }) : r.skipped.length ? L("send.skipped", { done: sendResultLine(r), n: r.skipped.length }) : sendResultLine(r));
      if (!r.stopped) toast.success(L("send.toast"));
      // A paper merged into its Zotero copy now lives under that item's id.
      setData(await getLibraryItem(r.item?.id ?? item.id));
      onChanged();
    } catch (error) {
      const state = zoteroState(error);
      setSendNote(state ? t(`library.zotero.states.${state}`) : L("send.failed"));
    }
  };
  // A Zotero paper whose PDF GAID has not read yet: "Workflow 만들기" reads it first (the draft needs the PDF in GAID).
  const canWorkflow = hasPdf || canRead;
  const makeWorkflow = async () => {
    setWorkflowBusy(true);
    try {
      if (!hasPdf) {
        try { await readItemText(item.id); }
        catch { toast.error(L("read.failed")); return; }
        onChanged();
      }
      const { authoringId } = await startWorkflowFromItem(item.id);
      toast.success(L("detail.workflowStarted"));
      window.location.hash = `#hub/${authoringId}`;
    } catch {
      toast.error(L("detail.workflowNeedsPdf"));
    } finally {
      setWorkflowBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{L(`source.${item.source}`)}</span>
        <Button variant="ghost" size="icon-sm" aria-label={L("detail.close")} onClick={onClose}><XIcon /></Button>
      </div>
      <h2 className="text-lg font-semibold leading-snug">{item.csl.title}</h2>
      {item.ownWork && <p className="text-xs text-gaid-ink-2">{L("detail.ownWork")}</p>}
      {item.metadataOrigin === "orcid" && <p className="text-xs text-gaid-ink-2">{L("detail.orcidOrigin")}</p>}
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
        <Button variant="outline" onClick={() => void makeWorkflow()} disabled={!canWorkflow || workflowBusy} title={hasPdf || !canWorkflow ? undefined : L("detail.workflowReadsPdf")}>
          <WorkflowIcon data-icon="inline-start" />{workflowBusy && !hasPdf ? L("detail.workflowReading") : L("detail.workflow.button")}
        </Button>
        {hasPdf && <Button variant="outline" asChild><a href={libraryPdfUrl(item.id)} target="_blank" rel="noreferrer"><FileTextIcon data-icon="inline-start" />{L("detail.pdf.button")}</a></Button>}
        {canRead && <Button variant="outline" onClick={() => void readText()}><BookOpenIcon data-icon="inline-start" />{L("read.button")}</Button>}
        {item.source === "gaid" && zoteroConnected && <Button variant="outline" onClick={() => void send()}><ExternalLinkIcon data-icon="inline-start" />{L("send.button")}</Button>}
        {zotero && <Button variant="outline" asChild><a href={zotero}><ExternalLinkIcon data-icon="inline-start" />{L("detail.zotero.button")}</a></Button>}
      </div>
      {!canWorkflow && <p className="text-xs text-muted-foreground">{L("detail.workflowNoPdf")}</p>}
      {sendNote && <p className="text-sm" role="status">{sendNote}</p>}
      <ItemFolders item={item} collections={collections} onChanged={async () => { setData(await getLibraryItem(item.id)); onChanged(); }} />
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{L("detail.usesTitle")}</h3>
          <PaperMapEntry itemId={item.id} uses={uses} onOpenProject={onOpenProject} onOpenPaper={onSelect} />
        </div>
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
