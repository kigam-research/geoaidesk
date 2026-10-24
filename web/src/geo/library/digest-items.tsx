"use client";

/**
 * 문헌 정리 in 서재 (gaid-library-prep, approved mockup reports/2026-10-24-gaid-library-prep figure 1): the digest table and a
 * digest's detail. A GAID-made digest follows its file in the project (`문헌정리/<id>/index.md`); an 외부 정리 is an imported
 * Gemini Notebook file. Both enter as 검토 전; the researcher marks them 확인함. A digest is read first by Workflows, never
 * cited: citations stay on the original papers' pages.
 */
import { useMemo, useState } from "react";
import { FolderOpenIcon, PlayIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryCollection, LibraryDigestStatus, LibraryItemResponse, LibraryItemSummary } from "@/geo/contracts/library";
import { listProjects, type Project } from "@/lib/projects";
import { attachToProject, removeLibraryItem, setDigestStatus } from "./api";
import { ITEM_DRAG_TYPE } from "./folder-tree";
import { ItemFolders } from "./item-folders";

const D = (key: string, values?: Record<string, unknown>) => t(`digest.${key}`, values as never);
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap";
// 검토 전 is an outlined neutral mark, 확인함 the success state (same marks as research notes, RN1/S3).
const STATUS_TONE: Record<LibraryDigestStatus, string> = {
  pending: "border-gaid-control-edge bg-gaid-face text-gaid-ink",
  confirmed: "border-transparent bg-gaid-success-tint text-gaid-success",
};
const PROSE = "[&_h1]:mt-4 [&_h1]:mb-1.5 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold";

export function DigestStatusBadge({ status }: { status: LibraryDigestStatus }) {
  return <span className={cn(PILL, STATUS_TONE[status])} title={D(`status.${status}Tip`)}>{D(`status.${status}`)}</span>;
}

/** Provenance, not status: neutral (I2, S3). */
export function DigestOriginBadge({ origin }: { origin: "gaid" | "external" }) {
  return <span className={cn(PILL, "border-gaid-edge bg-gaid-face-2 text-gaid-ink-2")} title={D(`origin.${origin}Tip`)}>{D(`origin.${origin}`)}</span>;
}

function coversLine(row: LibraryItemSummary): string {
  const d = row.digest;
  if (!d) return "";
  return [D("table.covers", { count: d.covers }), d.unmatched ? D("table.unmatched", { count: d.unmatched }) : "", d.newPapers ? D("table.newPapers", { count: d.newPapers }) : ""].filter(Boolean).join(" · ");
}

export function DigestTable({ rows, selected, onSelect, compact = false }: { rows: LibraryItemSummary[]; selected: string | null; onSelect: (id: string) => void; compact?: boolean }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className={cn("px-2 py-2 font-medium", !compact && "w-[50%]")}>{D("table.digest")}</th>
          <th className="whitespace-nowrap px-2 py-2 font-medium">{D("table.date")}</th>
          {!compact && <>
          <th className="px-2 py-2 font-medium">{D("table.origin")}</th>
          <th className="px-2 py-2 font-medium">{D("table.status")}</th>
          </>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={compact ? 2 : 4} className="px-2 py-6 text-muted-foreground">{D("noMatch")}</td></tr>}
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onSelect(row.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row.id); } }}
            tabIndex={0} aria-selected={selected === row.id} aria-label={row.title}
            draggable onDragStart={(e) => { e.dataTransfer.setData(ITEM_DRAG_TYPE, row.id); e.dataTransfer.effectAllowed = "copy"; }}
            className={cn("cursor-pointer border-b align-top outline-none hover:bg-muted/50 focus-visible:bg-muted", selected === row.id && "bg-primary/5")}>
            <td className="px-2 py-2.5">
              <div className="line-clamp-2 font-medium text-foreground" title={row.title}>{row.title}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{coversLine(row)}</div>
            </td>
            <td className="gaid-numeric whitespace-nowrap px-2 py-2.5">{row.digest?.date ?? ""}</td>
            {!compact && row.digest && <>
            <td className="px-2 py-2.5"><DigestOriginBadge origin={row.digest.origin} /></td>
            <td className="px-2 py-2.5"><DigestStatusBadge status={row.digest.status} /></td>
            </>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DigestItemDetail({ data, collections, onClose, onOpenProject, onSelect, onChanged, onReload, onRemake }: {
  data: LibraryItemResponse;
  collections: LibraryCollection[];
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onReload: () => Promise<void>;
  /** Opens 문헌 정리 만들기 on the digest's folder (shown when papers were added since). */
  onRemake: (folderId: string) => void;
}) {
  const { item } = data;
  const d = item.digest!;
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const body = useMemo(() => d.text.replace(/^#\s+.+\n+/, ""), [d.text]);
  const made = d.made;
  const folderId = d.collectionId;
  const folder = folderId ? collections.find((c) => c.id === folderId) : undefined;
  // Papers added to the digest's folder since; the list row carries the same count.
  const newPapers = data.digestNewPapers ?? 0;

  const mark = async (status: LibraryDigestStatus) => {
    setBusy(true);
    try { await setDigestStatus(item.id, status); await onReload(); onChanged(); }
    catch { toast.error(D("detail.statusFailed")); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await removeLibraryItem(item.id); toast.success(D("detail.removed")); onChanged(); onClose(); }
    catch { toast.error(D("detail.removeFailed")); setBusy(false); }
  };
  // "Workflow에서 쓰기": the covered papers join the project's citation scope, so its Workflow start offers this digest.
  const useIn = async (project: Project) => {
    setBusy(true);
    try {
      for (const id of d.covers) await attachToProject(project.id, id);
      toast.success(D("detail.usedIn", { name: project.name }));
      onChanged();
      onOpenProject(project.id);
    } catch { toast.error(D("detail.useFailed")); }
    finally { setBusy(false); }
  };
  const whereLine = made
    ? made.missingAt ? D("detail.missing") : D("detail.madeLine", { workflow: D(`workflow.${made.workflow}`), project: made.projectName, date: d.createdAt.slice(0, 10) })
    : D("detail.importedLine", { file: d.external?.fileName ?? "", date: d.createdAt.slice(0, 10) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{D("category")}</span>
        <Button variant="ghost" size="icon-sm" aria-label={t("library.detail.close")} onClick={onClose}><XIcon /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5"><DigestOriginBadge origin={d.origin} /><DigestStatusBadge status={d.status} /></div>
      <h2 className="text-lg font-semibold leading-snug">{item.csl.title}</h2>
      <p className="text-sm text-muted-foreground">{whereLine}</p>
      {made?.question && <p className="text-sm"><span className="text-gaid-ink-2">{D("detail.question")} </span>{made.question}</p>}
      {d.origin === "external" && <p className="text-[13px] text-gaid-ink-2">{D("detail.externalLimit")}</p>}
      <div className="flex flex-wrap gap-2">
        <Popover onOpenChange={(open) => { if (open && !projects) listProjects().then((rows) => setProjects(rows.filter((p) => !p.archived))).catch(() => setProjects([])); }}>
          <PopoverTrigger asChild><Button disabled={busy || d.covers.length === 0}><PlayIcon data-icon="inline-start" />{D("detail.use.button")}</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <p className="px-2 pb-1 text-xs text-muted-foreground">{D("detail.useTitle")}</p>
            {(projects ?? []).map((p) => (
              <button key={p.id} type="button" onClick={() => void useIn(p)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{p.name}</button>
            ))}
          </PopoverContent>
        </Popover>
        {d.status === "pending"
          ? <Button variant="outline" disabled={busy} onClick={() => void mark("confirmed")}>{D("detail.confirm.button")}</Button>
          : <Button variant="outline" disabled={busy} onClick={() => void mark("pending")}>{D("detail.unconfirm.button")}</Button>}
        {made && !made.missingAt && <Button variant="outline" onClick={() => onOpenProject(made.projectId)}><FolderOpenIcon data-icon="inline-start" />{D("detail.openProject.button")}</Button>}
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" disabled={busy}><Trash2Icon data-icon="inline-start" />{D("detail.remove.button")}</Button></PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
            <p className="text-sm">{D(made ? "detail.removeConfirmMade" : "detail.removeConfirm")}</p>
            <Button variant="destructive" size="sm" className="self-end" disabled={busy} onClick={() => void remove()}>{D("detail.removeYes.button")}</Button>
          </PopoverContent>
        </Popover>
      </div>
      {newPapers > 0 && folder && (
        <div className="flex items-start gap-2.5 rounded-md bg-gaid-warning-tint px-3 py-2.5 text-sm">
          <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-gaid-warning" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span>{D("detail.stale", { count: newPapers, folder: folder.name })}</span>
            {d.origin === "gaid" && <span><Button variant="outline" size="sm" onClick={() => onRemake(folder.id)}>{D("detail.remake.button")}</Button></span>}
          </div>
        </div>
      )}
      <ItemFolders item={item} collections={collections} onChanged={async () => { await onReload(); onChanged(); }} />
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <h3 className="text-base font-semibold">{D("detail.coversTitle", { count: d.covers.length })}</h3>
        {data.digestPapers?.length ? data.digestPapers.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="line-clamp-2 min-w-0" title={p.title}>{p.title}</span>
            <button type="button" onClick={() => onSelect(p.id)} className="shrink-0 text-primary hover:underline">{D("detail.openPaper.action")}</button>
          </div>
        )) : <p className="text-sm text-muted-foreground">{D("detail.coversNone")}</p>}
        {d.unmatched?.length ? <p className="text-xs text-muted-foreground">{D("detail.unmatched", { count: d.unmatched.length })}</p> : null}
      </div>
      {d.headings.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border p-4">
          <h3 className="text-base font-semibold">{D("detail.outlineTitle")}</h3>
          <ol className="flex flex-col gap-0.5 text-sm">
            {d.headings.slice(0, 12).map((h, i) => <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)]"><span className="text-[13px] text-gaid-ink-3 tabular-nums">{i + 1}</span><span className="truncate" title={h}>{h}</span></li>)}
          </ol>
        </div>
      )}
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-base font-semibold">{D("detail.content")}</summary>
        {d.truncated && <p className="mt-2 text-xs text-muted-foreground">{D("detail.truncated")}</p>}
        <div className="mt-2 max-h-[420px] overflow-y-auto text-sm">
          <MessageResponse className={PROSE} libraryCitations>{body}</MessageResponse>
        </div>
      </details>
    </div>
  );
}
