"use client";
/**
 * A sent 문헌 정리 request in the chat (gaid-library-prep): the researcher's one-line request and a card naming the general
 * Workflow; the instructions the AI agent received open behind a toggle, like a Workflow start (WorkflowBlockCard).
 */
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, LibraryBigIcon } from "lucide-react";

import { MessageResponse } from "@/components/ai-elements/message";
import { t } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const REQUEST_RE = /^([^\n]*)\n\n<library-digest-request id="([^"]*)" workflow="([^"]*)" path="([^"]*)">\n([\s\S]*?)\n<\/library-digest-request>\s*$/;

export interface ParsedDigestRequest { line: string; id: string; workflow: string; path: string; body: string }

export function parseDigestRequest(text: string): ParsedDigestRequest | null {
  const m = REQUEST_RE.exec(text);
  return m ? { line: m[1], id: m[2], workflow: m[3], path: m[4], body: m[5] } : null;
}

export function DigestRequestCard({ request }: { request: ParsedDigestRequest }) {
  const [open, setOpen] = useState(false);
  const label = t("digest.request.label", { workflow: t(`digest.workflow.${request.workflow}`) });
  return (
    <div className="flex flex-col gap-1.5" data-digest-request={request.id}>
      <MessageResponse>{request.line}</MessageResponse>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        aria-label={`${label}: ${t(open ? "digest.request.collapse" : "digest.request.expand")}`}
        className={cn("inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-sm font-medium", "hover:bg-background")}>
        <LibraryBigIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {open ? <ChevronDownIcon className="size-3 shrink-0" aria-hidden /> : <ChevronRightIcon className="size-3 shrink-0" aria-hidden />}
      </button>
      {open && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-background/60 px-3 py-2 font-sans text-[13px] leading-5">{request.body}</pre>}
    </div>
  );
}
