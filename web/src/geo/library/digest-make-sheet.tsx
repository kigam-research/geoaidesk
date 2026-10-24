"use client";

/**
 * 문헌 정리 만들기 (gaid-library-prep, approved mockup reports/2026-10-24-gaid-library-prep figure 3): the researcher picks the
 * papers (a 서재 folder, subfolders included), one general literature Workflow, a research question and the project to work
 * in. The server attaches the papers to that project's citation scope and returns the request message; the project opens
 * a new chat holding it (sent by the researcher). When the AI agent writes the file, 서재 shows it as 검토 전.
 * One 720 px sheet (UI guide D2) with one filled action (B1).
 */
import { useEffect, useMemo, useState } from "react";
import { PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { t } from "@/geo/i18n";
import { DIGEST_WORKFLOWS, type DigestWorkflowId, type LibraryCollection } from "@/geo/contracts/library";
import { OptionCard } from "@/geo/workspace/setup-steps";
import { listProjects, type Project } from "@/lib/projects";
import { checkFolder, LibraryApiError, listLibrary, makeDigest } from "./api";
import { requestDigestChat } from "./digest-handoff";

const D = (key: string, values?: Record<string, unknown>) => t(`digest.make.${key}`, values as never);
const FIELD = "w-full min-w-0 rounded-md border border-gaid-control-edge bg-gaid-face px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Label({ id, title, hint }: { id?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pb-2">
      <span id={id} className="text-sm font-semibold">{title}</span>
      {hint && <span className="text-[13px] text-gaid-ink-2">{hint}</span>}
    </div>
  );
}

export function DigestMakeSheet({ open, onOpenChange, collections, folderId, onOpenProject }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: LibraryCollection[];
  /** Folder to cover (the selected one); the researcher can choose another. */
  folderId: string | null;
  onOpenProject: (projectId: string) => void;
}) {
  const [folder, setFolder] = useState<string>(folderId ?? "");
  const [workflow, setWorkflow] = useState<DigestWorkflowId | null>(null);
  const [question, setQuestion] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [attachedTo, setAttachedTo] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ papers: number; pdfs: number } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFolder(folderId ?? ""); setQuestion(""); setWorkflow(null); setError(null); setBusy(false);
    listProjects().then((rows) => setProjects(rows.filter((p) => !p.archived))).catch(() => setProjects([]));
  }, [open, folderId]);
  // The projects whose citation scope already has this folder come first and are the default.
  useEffect(() => {
    if (!open || !folder) { setAttachedTo([]); return; }
    let live = true;
    checkFolder(folder).then((r) => live && setAttachedTo(r.projects.map((p) => p.id))).catch(() => live && setAttachedTo([]));
    setCounts(null);
    // The folder's papers (subfolders included) and how many have a PDF GAID can read.
    listLibrary({ kind: "paper", collectionId: folder, limit: 500 })
      .then((r) => live && setCounts({ papers: r.total, pdfs: r.items.filter((i) => i.storedPdf || i.hasPdf).length }))
      .catch(() => live && setCounts(null));
    return () => { live = false; };
  }, [open, folder]);
  const ordered = useMemo(() => {
    const rows = projects ?? [];
    return [...rows.filter((p) => attachedTo.includes(p.id)), ...rows.filter((p) => !attachedTo.includes(p.id))];
  }, [projects, attachedTo]);
  useEffect(() => {
    if (!ordered.length) return;
    setProjectId((current) => (current && ordered.some((p) => p.id === current) ? (attachedTo.length && !attachedTo.includes(current) ? ordered[0].id : current) : ordered[0].id));
  }, [ordered, attachedTo]);

  const papers = counts?.papers ?? 0;
  const pdfs = counts && counts.papers <= 500 ? counts.pdfs : undefined;
  // 논문 비교 needs two papers or more; a single paper is summarised.
  const recommended: DigestWorkflowId = papers >= 2 ? "compare-papers" : "summarize-paper";
  const chosen = workflow ?? recommended;
  const reason = !folder ? D("reason.folder") : !counts ? D("reason.counting") : papers === 0 ? D("reason.empty") : !question.trim() ? D("reason.question") : !projectId ? D("reason.project") : null;

  const start = async () => {
    if (reason) return;
    setBusy(true); setError(null);
    try {
      const made = await makeDigest({ projectId, workflow: chosen, question: question.trim(), collectionId: folder });
      requestDigestChat({ projectId, task: { title: D("chatTitle"), text: made.message, attachedFiles: [], skills: [] } });
      onOpenChange(false);
      onOpenProject(projectId);
    } catch (e) {
      const status = e instanceof LibraryApiError ? e.status : 0;
      setError({ message: status === 413 ? D("error.tooMany") : status === 404 ? D("error.gone") : D("error.failed"), detail: e instanceof Error ? e.message : undefined });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <div className="flex flex-col gap-1 border-b border-gaid-edge px-6 pb-3.5 pt-4">
          <DialogTitle className="pr-10 text-xl leading-snug">{D("title")}</DialogTitle>
          <DialogDescription className="text-sm text-gaid-ink-2">{D("context")}</DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <section>
            <Label id="dg-papers" title={D("papers")} hint={D("papersHint")} />
            <select aria-labelledby="dg-papers" value={folder} onChange={(e) => setFolder(e.target.value)} className={FIELD}>
              <option value="">{D("folderNone")}</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {folder && counts && <p className="mt-1 text-[13px] text-gaid-ink-2 tabular-nums">{pdfs === undefined ? D("papersCount", { count: papers }) : D("papersCountPdf", { count: papers, pdf: pdfs })}</p>}
            {folder && pdfs !== undefined && papers > pdfs && <p className="mt-0.5 text-[13px] text-gaid-ink-2">{D("noPdf", { count: papers - pdfs })}</p>}
          </section>
          <section role="radiogroup" aria-labelledby="dg-kind">
            <Label id="dg-kind" title={D("kind")} hint={D("kindHint")} />
            <div className="flex flex-col gap-2">
              {DIGEST_WORKFLOWS.map((id) => (
                <OptionCard key={id} selected={chosen === id} onSelect={() => setWorkflow(id)} title={D(`kinds.${id}`)}
                  badge={id === recommended ? <span className="inline-flex items-center rounded-sm bg-gaid-signal-tint px-2 py-0.5 text-xs font-semibold text-gaid-signal-ink">{D("recommended")}</span> : undefined}
                  hint={D(`kinds.${id}Hint`)} />
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-gaid-ink-2">{D(`why.${recommended}`)}</p>
          </section>
          <section>
            <Label id="dg-question" title={D("question")} hint={D("questionHint")} />
            <textarea aria-labelledby="dg-question" rows={2} maxLength={600} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={D("questionPlaceholder")} className={`${FIELD} resize-none leading-6`} />
          </section>
          <section>
            <Label id="dg-project" title={D("where")} hint={D("whereHint")} />
            <select aria-labelledby="dg-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={FIELD} disabled={!projects}>
              {!projects && <option value="">{D("projectsLoading")}</option>}
              {ordered.map((p) => <option key={p.id} value={p.id}>{attachedTo.includes(p.id) ? D("projectAttached", { name: p.name }) : p.name}</option>)}
            </select>
            {projects && projects.length === 0 && <p className="mt-1 text-[13px] text-gaid-ink-2">{D("noProjects")}</p>}
          </section>
        </div>
        <div className="flex flex-col gap-2 border-t border-gaid-edge px-6 py-3">
          {error && <div role="alert" className="flex flex-col gap-1 text-sm text-destructive"><p>{error.message}</p><TechnicalDetail detail={error.detail} /></div>}
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[13px] text-gaid-ink-2">{reason ?? D("footer")}</span>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{D("cancel")}</Button>
            <Button onClick={() => void start()} disabled={Boolean(reason) || busy}><PlayIcon data-icon="inline-start" />{busy ? D("starting") : D("start")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
