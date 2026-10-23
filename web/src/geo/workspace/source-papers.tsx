"use client";
/**
 * 근거 논문 in the Workflow start window (gaid-workflow-cite-scope, F23): the papers an installed hub Workflow was made
 * from, found in the researcher's 서재 by DOI or exact title. The researcher attaches them to the project's citation
 * scope with one explicit action; nothing is attached otherwise. A paper not in 서재 opens the usual 논문 넣기 dialog
 * (DOI looked up, details checked by the researcher). A Workflow without recorded papers shows nothing.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import type { WorkflowPaper } from "@/geo/contracts/library";
import { AddPaperDialog } from "@/geo/library/add-paper-dialog";
import { attachWorkflowPapers, getWorkflowPapers } from "@/geo/library/api";

const IntroNote = ({ children }: { children: string }) => <span className="mt-1 block text-[13px] leading-[18px] text-gaid-ink-2">{children}</span>;
const S = (key: string, values?: Record<string, unknown>) => t(`workspace.start.papers.${key}`, values as never);

export interface WorkflowPapersState {
  papers: WorkflowPaper[] | null;
  failed: boolean;
  busy: boolean;
  attach: () => Promise<void>;
  reload: () => Promise<void>;
}

/** Source papers of an installed Workflow (`method` = its runtime name); null method: none (catalogue Workflows). */
export function useWorkflowPapers(projectId: string, method: string | null): WorkflowPapersState {
  const [papers, setPapers] = useState<WorkflowPaper[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!method) return;
    try { setPapers((await getWorkflowPapers(projectId, method)).papers); setFailed(false); }
    catch { setFailed(true); }
  }, [projectId, method]);
  useEffect(() => { setPapers(null); void reload(); }, [reload]);
  const attach = async () => {
    if (!method || !papers) return;
    setBusy(true);
    try {
      const ids = papers.flatMap((p) => (p.state === "in-library" && p.itemId ? [p.itemId] : []));
      setPapers((await attachWorkflowPapers(projectId, method, ids)).papers);
      setFailed(false);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return { papers, failed, busy, attach, reload };
}

/** Attached papers with a citation key, for the start message. */
export const citablePapers = (state: WorkflowPapersState) =>
  (state.papers ?? []).flatMap((p) => (p.state === "attached" && p.citationKey ? [{ key: p.citationKey, title: p.itemTitle ?? p.title }] : []));

/** The 근거 논문 row content: each paper with its state, then the one attach action. */
export function SourcePapers({ state }: { state: WorkflowPapersState }) {
  const [adding, setAdding] = useState<WorkflowPaper | null>(null);
  const papers = state.papers ?? [];
  const attachable = papers.filter((p) => p.state === "in-library").length;
  const missing = papers.filter((p) => p.state === "not-in-library").length;
  const attached = papers.filter((p) => p.state === "attached").length;
  return <>
    <ul className="space-y-1.5">
      {papers.map((paper) => <li key={paper.ref} className="min-w-0">
        <span className="line-clamp-2" title={paper.itemTitle ?? paper.title}>{paper.itemTitle ?? paper.title}</span>
        <span className="block text-[13px] leading-[18px] text-gaid-ink-2">
          {S(`state.${paper.state}`)}
          {paper.matchedBy === "title" && <> · {S("byTitle")}</>}
          {paper.doi && <> · <span className="font-mono text-xs">{paper.doi}</span></>}
          {paper.state === "not-in-library" && <> · <button type="button" onClick={() => setAdding(paper)} className="text-gaid-signal-ink underline-offset-4 hover:underline">{S("add")}</button></>}
        </span>
      </li>)}
    </ul>
    {attachable > 0 && <div className="mt-2 flex flex-wrap items-center gap-3">
      <Button size="sm" variant="outline" disabled={state.busy} onClick={() => void state.attach()}>{S("attach", { count: attachable })}</Button>
      <span className="text-[13px] leading-[18px] text-gaid-ink-2">{S("attachHint")}</span>
    </div>}
    {attachable === 0 && attached > 0 && <IntroNote>{S("attachedNote")}</IntroNote>}
    {missing > 0 && <IntroNote>{S("missingNote", { count: missing })}</IntroNote>}
    {state.failed && <IntroNote>{S("failed")}</IntroNote>}
    <AddPaperDialog open={adding !== null} onOpenChange={(open) => { if (!open) setAdding(null); }} initialDoi={adding?.doi}
      onAdded={() => { setAdding(null); void state.reload(); }} />
  </>;
}
