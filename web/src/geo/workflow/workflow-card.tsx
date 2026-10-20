"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, WorkflowIcon } from "lucide-react";

import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import type { ParsedWorkflowBlock } from "../contracts/workflow-doc";
import { t } from "../i18n";

/**
 * A chat message that starts a Workflow (gaid-workflow-model): the card names the Workflow and its 판, the 지침 the
 * agent received opens behind a toggle, and the researcher's own text follows.
 */
export function WorkflowBlockCard({ block }: { block: ParsedWorkflowBlock }) {
  const [open, setOpen] = useState(false);
  const label = block.revision
    ? t("workflowDoc.card.labelRevision", { title: block.title, revision: block.revision })
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
        {open ? <ChevronDownIcon className="size-3 shrink-0" aria-hidden /> : <ChevronRightIcon className="size-3 shrink-0" aria-hidden />}
      </button>
      {open && (
        <div className="max-h-96 overflow-auto rounded-md border bg-background/60 px-3 py-2 text-sm">
          <MessageResponse>{block.body}</MessageResponse>
        </div>
      )}
      {block.tail && <MessageResponse>{block.tail}</MessageResponse>}
    </div>
  );
}
