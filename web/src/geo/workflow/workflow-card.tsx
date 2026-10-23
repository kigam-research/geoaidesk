"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, WorkflowIcon, XIcon } from "lucide-react";

import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import { parseWorkflowBlock, type ParsedWorkflowBlock } from "../contracts/workflow-doc";
import { t } from "../i18n";

/** The 지침 is a document inside a chat bubble: keep its headings at body scale. */
const DOC_TEXT = "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm";

/**
 * A chat message that starts a Workflow (gaid-workflow-model): the card names the Workflow and its version, the 지침 the
 * agent received opens behind a toggle, and the researcher's own text follows.
 */
export function WorkflowBlockCard({ block }: { block: ParsedWorkflowBlock }) {
  const [open, setOpen] = useState(false);
  const label = block.version
    ? t("workflowDoc.card.labelVersion", { title: block.title, version: block.version })
    : t("workflowDoc.card.label", { title: block.title });
  return (
    <div className="flex flex-col gap-1.5" data-workflow-block={block.id}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-sm font-medium",
          "hover:bg-background",
        )}
        aria-expanded={open}
        aria-label={`${label}: ${t(open ? "workflowDoc.card.collapse" : "workflowDoc.card.expand")}`}
      >
        <WorkflowIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {block.example && <span className="shrink-0 rounded-sm border px-1 text-xs font-normal text-gaid-ink-2">{t("workflowDoc.card.example")}</span>}
        {open ? <ChevronDownIcon className="size-3 shrink-0" aria-hidden /> : <ChevronRightIcon className="size-3 shrink-0" aria-hidden />}
      </button>
      {open && (
        <div className={cn("max-h-96 overflow-auto rounded-md border bg-background/60 px-3 py-2 text-sm", DOC_TEXT)}>
          <MessageResponse>{block.body}</MessageResponse>
        </div>
      )}
      {block.tail && <MessageResponse>{block.tail}</MessageResponse>}
    </div>
  );
}

/**
 * The composer's card for a started Workflow before it is sent: the 지침 opens behind a toggle (what the agent will
 * receive), and the researcher can remove it. The typed text is sent after it.
 */
export function PendingWorkflowChip({ block, onRemove }: { block: string; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const parsed = parseWorkflowBlock(block);
  if (!parsed) return null;
  const label = parsed.version
    ? t("workflowDoc.card.labelVersion", { title: parsed.title, version: parsed.version })
    : t("workflowDoc.card.label", { title: parsed.title });
  return (
    <div className="flex w-full flex-col items-start gap-1.5 self-stretch border-b px-3 py-2 text-left" data-pending-workflow={parsed.id}>
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-sm font-medium hover:bg-background"
          aria-expanded={open}
          aria-label={`${label}: ${t(open ? "workflowDoc.card.collapse" : "workflowDoc.card.expand")}`}
        >
          <WorkflowIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          {parsed.example && <span className="shrink-0 rounded-sm border px-1 text-xs font-normal text-gaid-ink-2">{t("workflowDoc.card.example")}</span>}
          {open ? <ChevronDownIcon className="size-3 shrink-0" aria-hidden /> : <ChevronRightIcon className="size-3 shrink-0" aria-hidden />}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label={t("workflowDoc.card.remove")}>
            <XIcon className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("workflowDoc.card.pendingHint")}</p>
      {open && (
        <div className={cn("max-h-72 overflow-auto rounded-md border bg-background/60 px-3 py-2 text-sm", DOC_TEXT)}>
          <MessageResponse>{parsed.body}</MessageResponse>
        </div>
      )}
    </div>
  );
}
