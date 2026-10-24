"use client";

/**
 * Side panel of a selected folder (gaid-library-folders): the folder is a manuscript's or topic's reference set.
 * 인용 관리 (bibliography export, reference check, citation scope of a project) and "Zotero로 보내기".
 */
import { useEffect, useState } from "react";
import { CheckCircle2Icon, DownloadIcon, FolderIcon, FolderInputIcon, ListChecksIcon, MoreHorizontalIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { listProjects, type Project } from "@/lib/projects";
import { geoLocale, t } from "@/geo/i18n";
import type { FolderCheckResponse, FolderIssue, LibraryCollection, SendToZoteroResult } from "@/geo/contracts/library";
import { attachFolderToProject, checkFolder, deleteFolder, exportUrl, sendFolderToZotero, setFolderItems, setFolderNotebook, zoteroState } from "./api";
import { NotebookLinkControl } from "@/geo/notebook-link/notebook-link-control";
import { folderPath } from "./folder-tree";

const L = (key: string, values?: Record<string, unknown>) => t(`library.folder.${key}`, values as never);
const EXPORTS = ["bibtex", "ris", "csl-json", "text"] as const;
const ISSUE_ORDER: FolderIssue["kind"][] = ["retracted", "cited-outside", "duplicate", "removed-from-zotero", "unconfirmed", "no-doi", "no-year", "no-authors", "unread"];

/** One research-language line for a send result (also used by the paper detail). */
export function sendResultLine(r: SendToZoteroResult): string {
  const parts = [
    r.created ? t("library.send.created", { n: r.created }) : "",
    r.merged ? t("library.send.merged", { n: r.merged }) : "",
    r.addedToCollections ? t("library.send.added", { n: r.addedToCollections }) : "",
    r.attachments ? t("library.send.pdfs", { n: r.attachments }) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t("library.send.nothing");
}

export interface FolderPanelProps {
  folder: LibraryCollection;
  collections: LibraryCollection[];
  count: number;
  zoteroConnected: boolean;
  onSelectItem: (id: string) => void;
  onCreateSub: () => void;
  onRename: () => void;
  onDeleted: () => void;
  onChanged: () => void;
}

export function FolderPanel({ folder, collections, count, zoteroConnected, onSelectItem, onCreateSub, onRename, onDeleted, onChanged }: FolderPanelProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [check, setCheck] = useState<FolderCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const linked = Boolean(folder.zotero);
  const lang = geoLocale() === "en" ? "en" : "ko";

  useEffect(() => { setCheck(null); setSendNote(null); }, [folder.id]);

  const runCheck = async () => {
    setChecking(true);
    try { setCheck(await checkFolder(folder.id)); }
    catch { toast.error(L("check.failed")); }
    finally { setChecking(false); }
  };
  const attach = async (project: Project) => {
    try { await attachFolderToProject(project.id, folder.id); toast.success(L("attach.toast", { name: project.name })); onChanged(); }
    catch { toast.error(L("attach.failed")); }
  };
  const remove = async () => {
    if (!(await confirm({ title: L("delete.title", { name: folder.name }), description: L("delete.body"), confirmLabel: L("delete.button"), cancelLabel: t("library.dialog.cancel.button"), destructive: true }))) return;
    try { await deleteFolder(folder.id); toast.success(L("delete.toast")); onDeleted(); }
    catch { toast.error(L("delete.failed")); }
  };
  const send = async () => {
    if (!(await confirm({ title: L("send.title", { name: folder.name }), description: L("send.body", { n: count }), confirmLabel: t("library.send.button"), cancelLabel: t("library.dialog.cancel.button") }))) return;
    setSending(true);
    setSendNote(null);
    try {
      const result = await sendFolderToZotero(folder.id);
      const line = sendResultLine(result);
      if (result.stopped) setSendNote(t("library.send.stopped", { done: line }));
      else { setSendNote(result.skipped.length ? t("library.send.skipped", { done: line, n: result.skipped.length }) : line); toast.success(t("library.send.toast")); }
      onChanged();
    } catch (error) {
      const state = zoteroState(error);
      setSendNote(state ? t(`library.zotero.states.${state}`) : t("library.send.failed"));
    } finally {
      setSending(false);
    }
  };
  const addToFolder = async (itemId: string) => {
    try { await setFolderItems(folder.id, [itemId], "add"); toast.success(L("check.added")); onChanged(); await runCheck(); }
    catch { toast.error(t("library.folders.addFailed")); }
  };

  const issues = check ? ISSUE_ORDER.map((kind) => ({ kind, rows: check.issues.filter((i) => i.kind === kind) })).filter((g) => g.rows.length) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{linked ? L("linked") : L("gaid")}</p>
          <h2 className="flex items-center gap-1.5 text-lg font-semibold leading-snug"><FolderIcon className="size-4 shrink-0" aria-hidden /><span className="truncate">{folderPath(collections, folder.id)}</span></h2>
          <p className="text-sm text-muted-foreground">{L("papers", { n: count })}</p>
        </div>
        <div className="flex items-center gap-2">
        <FolderNotebookLink key={folder.id} folder={folder} onChanged={onChanged} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={L("more")}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreateSub}>{L("sub.button")}</DropdownMenuItem>
            <DropdownMenuItem disabled={linked} onSelect={onRename}>{L("rename.button")}</DropdownMenuItem>
            <DropdownMenuItem disabled={linked} variant="destructive" onSelect={() => void remove()}>{L("delete.button")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      {linked && <p className="text-xs text-muted-foreground">{L("linkedRule")}</p>}

      <section className="flex flex-col gap-2 rounded-xl border p-4" aria-label={L("cite.title")}>
        <h3 className="text-base font-semibold">{L("cite.title")}</h3>
        <p className="text-sm text-muted-foreground">{L("cite.body")}</p>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild><Button variant="outline"><DownloadIcon data-icon="inline-start" />{L("export.button")}</Button></PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-1.5">
              {EXPORTS.map((f) => (
                <a key={f} href={exportUrl(f, folder.id, lang)} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">{L(`export.${f === "csl-json" ? "csl" : f}`)}</a>
              ))}
            </PopoverContent>
          </Popover>
          <Popover onOpenChange={(open) => { if (open && !projects) listProjects().then(setProjects).catch(() => setProjects([])); }}>
            <PopoverTrigger asChild><Button variant="outline"><FolderInputIcon data-icon="inline-start" />{L("attach.button")}</Button></PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="px-2 pb-1 text-xs text-muted-foreground">{L("attach.hint")}</p>
              {(projects ?? []).filter((p) => !p.archived).map((p) => (
                <button key={p.id} type="button" onClick={() => void attach(p)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{p.name}</button>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => void runCheck()} disabled={checking || count === 0}><ListChecksIcon data-icon="inline-start" />{L("check.button")}</Button>
        </div>
        {checking && <p className="text-sm text-muted-foreground">{L("check.busy")}</p>}
        {check && (
          <div className="flex flex-col gap-2 pt-1">
            {check.projects.length > 0 && <p className="text-xs text-muted-foreground">{L("check.projects", { names: check.projects.map((p) => p.name).join(", ") })}</p>}
            {issues.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm"><CheckCircle2Icon className="size-4 text-[var(--gaid-success)]" aria-hidden />{L("check.none", { n: check.items })}</p>
            ) : issues.map((g) => (
              <div key={g.kind} className="flex flex-col gap-1">
                <p className="text-sm font-medium">{L(`issue.${g.kind}`, { n: g.rows.length })}</p>
                <ul className="flex flex-col gap-0.5 text-sm">
                  {g.rows.slice(0, 5).map((row, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      {row.kind === "cited-outside" ? (
                        <>
                          <span className="min-w-0 text-muted-foreground">{L("issue.citedLine", { key: row.key, note: row.noteTitle, project: row.projectName })}</span>
                          {row.itemId && <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => void addToFolder(row.itemId!)}>{L("check.add.action")}</button>}
                        </>
                      ) : (
                        <button type="button" className="min-w-0 truncate text-left hover:text-primary" onClick={() => onSelectItem(row.kind === "duplicate" ? row.itemIds[0] : row.itemId)}>{row.title}</button>
                      )}
                    </li>
                  ))}
                  {g.rows.length > 5 && <li className="text-xs text-muted-foreground">{L("check.more", { n: g.rows.length - 5 })}</li>}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border p-4" aria-label={L("zotero.title")}>
        <h3 className="text-base font-semibold">{L("zotero.title")}</h3>
        <p className="text-sm text-muted-foreground">{zoteroConnected ? (linked ? L("zotero.linkedBody") : L("zotero.body")) : L("zotero.offline")}</p>
        <div>
          <Button variant="outline" onClick={() => void send()} disabled={!zoteroConnected || sending || count === 0}><SendIcon data-icon="inline-start" />{t("library.send.button")}</Button>
        </div>
        {sending && <p className="text-sm text-muted-foreground">{t("library.send.busy")}</p>}
        {sendNote && <p className="text-sm" role="status">{sendNote}</p>}
      </section>
      {dialog}
    </div>
  );
}

function FolderNotebookLink({ folder, onChanged }: { folder: LibraryCollection; onChanged: () => void }) {
  const [url, setUrl] = useState(folder.notebookUrl ?? null);
  useEffect(() => { setUrl(folder.notebookUrl ?? null); }, [folder.notebookUrl]);
  return <NotebookLinkControl context="folder" url={url} onSave={async (next) => {
    const saved = await setFolderNotebook(folder.id, next);
    setUrl(saved.notebookUrl ?? null);
    onChanged();
  }} />;
}
