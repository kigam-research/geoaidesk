"use client";
import { useState } from "react";
import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { HandoffDialog } from "@/geo/hub-handoff/dialog";

export function GeoChatActions(props: { projectId: string; sessionId: string | null; isStreaming: boolean }) {
  return <ChatActions key={`${props.projectId}:${props.sessionId ?? ""}`} {...props} />;
}
function ChatActions({ projectId, sessionId, isStreaming }: { projectId: string; sessionId: string | null; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button size="icon-xs" variant="ghost" aria-label={t("hubHandoff.open")} title={t("hubHandoff.open")} disabled={!sessionId || isStreaming} onClick={() => setOpen(true)}><SendIcon aria-hidden /></Button>
    {open && sessionId && <HandoffDialog projectId={projectId} sessionId={sessionId} isStreaming={isStreaming} onClose={() => setOpen(false)} />}
  </>;
}
