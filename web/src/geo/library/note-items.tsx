"use client";

/**
 * 정리 노트 in 서재 (gaid-note-library): the note table, a note item's detail and "정리 노트 가져오기". The note file in its
 * project stays the master; the library shows what it last read from the file and opens the note back in its project.
 */
import { useEffect, useMemo, useState } from "react";
import { FolderOpenIcon, NotebookTextIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryCollection, LibraryItemResponse, LibraryItemSummary, LibraryNoteCandidate, LibraryNoteStatus } from "@/geo/contracts/library";
import { stripFrontmatter, stripTitleHeading } from "@/geo/notes/note-markdown";
import { addNoteToLibrary, listNoteCandidates, removeLibraryItem } from "./api";
import { ITEM_DRAG_TYPE } from "./folder-tree";
import { ItemFolders } from "./item-folders";

const L = (key: string, values?: Record<string, unknown>) => t(`library.notes.${key}`, values as never);
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap";
// Same marks as the notes panel (RN1): 검토 전 is the signal, 확인함 the success state, 대체됨 neutral.
const STATUS_TONE: Record<LibraryNoteStatus, string> = {
  pending: "border-primary/30 bg-primary/10 text-primary",
  confirmed: "border-transparent bg-gaid-success-tint text-gaid-success",
  superseded: "border-gaid-edge text-gaid-ink-3",
};
const NOTE_PROSE = "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold";

function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? t("library.notes.date", { year: m[1], month: Number(m[2]), day: Number(m[3]) }) : date;
}

export function NoteStatusBadge({ status }: { status: LibraryNoteStatus }) {
  return <span className={cn(PILL, STATUS_TONE[status])} title={t(`notes.status.${status}Tip`)}>{t(`notes.status.${status}`)}</span>;
}

/** Note text for the library: no images or project file links, which resolve only inside the project. */
export function snapshotForLibrary(markdown: string): string {
  return stripTitleHeading(stripFrontmatter(markdown))
    .replace(/^\s*!\[[^\]]*\]\([^)]*\)\s*$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?![a-z][a-z0-9+.-]*:)[^)]*\)/gi, "$1");
}

export function NoteTable({ rows, selected, onSelect }: { rows: LibraryItemSummary[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="w-[50%] px-2 py-2 font-medium">{L("table.note")}</th>
          <th className="px-2 py-2 font-medium">{L("table.date")}</th>
          <th className="px-2 py-2 font-medium">{L("table.project")}</th>
          <th className="px-2 py-2 font-medium">{L("table.status")}</th>
          <th className="px-2 py-2 text-right font-medium">{L("table.cites")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-muted-foreground">{L("noMatch")}</td></tr>}
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onSelect(row.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row.id); } }}
            tabIndex={0} aria-selected={selected === row.id} aria-label={row.title}
            draggable onDragStart={(e) => { e.dataTransfer.setData(ITEM_DRAG_TYPE, row.id); e.dataTransfer.effectAllowed = "copy"; }}
            className={cn("cursor-pointer border-b align-top outline-none hover:bg-muted/50 focus-visible:bg-muted", selected === row.id && "bg-primary/5")}>
            <td className="px-2 py-2.5">
              <div className="font-medium text-foreground">{row.title}</div>
              {row.note?.headline && <div className="line-clamp-1 text-xs text-muted-foreground">{row.note.headline}</div>}
            </td>
            <td className="gaid-numeric whitespace-nowrap px-2 py-2.5">{row.note ? formatDate(row.note.date) : ""}</td>
            <td className="px-2 py-2.5">
              <div className="line-clamp-1">{row.note?.projectName}</div>
              {row.note && !row.note.local && <div className="text-xs text-muted-foreground">{row.note.missing ? L("missingShort") : L("otherPc", { name: row.note.originLabel })}</div>}
            </td>
            <td className="px-2 py-2.5">{row.note && <NoteStatusBadge status={row.note.status} />}</td>
            <td className="gaid-numeric px-2 py-2.5 text-right text-muted-foreground">{row.note?.cites || L("table.none")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function NoteItemDetail({ data, collections, onClose, onOpenNote, onSelect, onChanged, onReload }: {
  data: LibraryItemResponse;
  collections: LibraryCollection[];
  onClose: () => void;
  onOpenNote: (projectId: string, noteId: string) => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onReload: () => Promise<void>;
}) {
  const { item } = data;
  const note = item.note!;
  const [removing, setRemoving] = useState(false);
  const body = useMemo(() => snapshotForLibrary(note.markdown), [note.markdown]);
  const cited = note.citations.filter((c) => c.itemId);
  const notFound = note.citations.filter((c) => !c.itemId);
  const local = Boolean(data.noteLocal);
  const where = note.missingAt ? L("missing") : !local ? L("otherPcLong", { name: note.originLabel }) : null;

  const remove = async () => {
    setRemoving(true);
    try {
      await removeLibraryItem(item.id);
      toast.success(L("removed"));
      onChanged();
      onClose();
    } catch {
      toast.error(L("removeFailed"));
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{L("category")}</span>
        <Button variant="ghost" size="icon-sm" aria-label={t("library.detail.close")} onClick={onClose}><XIcon /></Button>
      </div>
      <h2 className="text-lg font-semibold leading-snug">{item.csl.title}</h2>
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>{[formatDate(note.date), L("project", { name: note.projectName })].join(" · ")}</span>
        <NoteStatusBadge status={note.status} />
      </p>
      {note.headline && <p className="text-sm">{note.headline}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onOpenNote(note.projectId, note.noteId)} disabled={!local} title={local ? undefined : where ?? undefined}>
          <FolderOpenIcon data-icon="inline-start" />{L("open.button")}
        </Button>
        <Popover>
          <PopoverTrigger asChild><Button variant="outline"><Trash2Icon data-icon="inline-start" />{L("remove.button")}</Button></PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
            <p className="text-sm">{L("removeConfirm")}</p>
            <Button variant="destructive" size="sm" className="self-end" disabled={removing} onClick={() => void remove()}>{L("removeYes.button")}</Button>
          </PopoverContent>
        </Popover>
      </div>
      {where && <p className="text-sm text-muted-foreground" role="status">{where}</p>}
      <ItemFolders item={item} collections={collections} onChanged={async () => { await onReload(); onChanged(); }} />
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <h3 className="text-base font-semibold">{L("citedTitle")}</h3>
        {cited.length === 0 && notFound.length === 0 && <p className="text-sm text-muted-foreground">{L("citedNone")}</p>}
        {cited.map((c) => (
          <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="font-mono text-xs">@{c.key}</span>
              {c.locators.length > 0 && <span className="text-muted-foreground"> · {c.locators.join(", ")}</span>}
            </span>
            <button type="button" onClick={() => onSelect(c.itemId!)} className="shrink-0 text-primary hover:underline">{L("openPaper.action")}</button>
          </div>
        ))}
        {notFound.length > 0 && <p className="text-xs text-muted-foreground">{L("citedMissing", { keys: notFound.map((c) => `@${c.key}`).join(", ") })}</p>}
      </div>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-base font-semibold"><NotebookTextIcon className="mr-1.5 inline size-4 align-[-2px]" aria-hidden />{L("content.title")}</summary>
        <p className="mt-2 text-xs text-muted-foreground">{L(note.truncated ? "content.readTruncated" : "content.read", { when: new Date(note.refreshedAt).toLocaleString() })}</p>
        <div className="mt-2 max-h-[420px] overflow-y-auto text-sm">
          <MessageResponse className={NOTE_PROSE}>{body}</MessageResponse>
        </div>
      </details>
    </div>
  );
}

/** "정리 노트 가져오기": the research notes of this GAID's projects; the chosen ones go into the library (and the folder). */
export function AddNotesDialog({ open, onOpenChange, folder, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; folder?: LibraryCollection; onAdded: (firstId?: string) => void }) {
  const [notes, setNotes] = useState<LibraryNoteCandidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const keyOf = (n: LibraryNoteCandidate) => `${n.projectId}\u0000${n.noteId}`;
  useEffect(() => {
    if (!open) return;
    let live = true;
    setNotes(null); setFailed(false); setChosen(new Set());
    listNoteCandidates().then((r) => live && setNotes(r.notes)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [open]);
  const groups = useMemo(() => {
    const out = new Map<string, LibraryNoteCandidate[]>();
    for (const n of notes ?? []) out.set(n.projectName, [...(out.get(n.projectName) ?? []), n]);
    return [...out];
  }, [notes]);
  const toggle = (n: LibraryNoteCandidate) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(keyOf(n))) next.delete(keyOf(n)); else next.add(keyOf(n));
    return next;
  });
  const save = async () => {
    setSaving(true);
    let added = 0, firstId: string | undefined;
    for (const n of (notes ?? []).filter((x) => chosen.has(keyOf(x)))) {
      try {
        const r = await addNoteToLibrary({ projectId: n.projectId, noteId: n.noteId, ...(folder ? { collectionIds: [folder.id] } : {}) });
        added++; firstId ??= r.item.id;
      } catch { /* counted below */ }
    }
    setSaving(false);
    if (added === chosen.size) toast.success(L("dialog.added", { n: added }));
    else toast.error(L("dialog.partly", { n: added, total: chosen.size }));
    onAdded(firstId);
    if (added) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{L("dialog.title")}</DialogTitle>
          <DialogDescription>{folder ? L("dialog.bodyFolder", { name: folder.name }) : L("dialog.body")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {failed ? <p className="py-4 text-sm text-muted-foreground">{L("dialog.failed")}</p>
            : !notes ? <p className="py-4 text-sm text-muted-foreground">{L("dialog.loading")}</p>
            : notes.length === 0 ? <p className="py-4 text-sm text-muted-foreground">{L("dialog.empty")}</p>
            : groups.map(([project, rows]) => (
              <fieldset key={project} className="mb-3">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">{project}</legend>
                {rows.map((n) => (
                  <label key={keyOf(n)} className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-sm", n.itemId ? "text-muted-foreground" : "cursor-pointer hover:bg-muted")}>
                    <input type="checkbox" className="mt-1" checked={Boolean(n.itemId) || chosen.has(keyOf(n))} disabled={Boolean(n.itemId) || saving} onChange={() => toggle(n)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{[formatDate(n.date), t(`notes.status.${n.status}`), n.itemId ? L("dialog.inLibrary") : ""].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("library.dialog.cancel.button")}</Button>
          <Button disabled={!chosen.size || saving} onClick={() => void save()}>{saving ? L("dialog.saving") : L("dialog.save.button", { n: chosen.size })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
