"use client";

import { useEffect, useRef, useState } from "react";
import { PackagePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { t } from "@/geo/i18n";
import { createSkill } from "@/lib/capabilities";
import { prefillChat } from "@/lib/chat-prefill";
import { fieldClass } from "./task-setup";

export function GeoChatActions({ projectId, sessionId, isStreaming }: { projectId: string; sessionId: string | null; isStreaming: boolean }) {
  return <ChatActions key={`${projectId}:${sessionId ?? ""}`} sessionId={sessionId} isStreaming={isStreaming} />;
}

function ChatActions({ sessionId, isStreaming }: { sessionId: string | null; isStreaming: boolean }) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64 && description.trim().length > 0;
  const create = async () => {
    if (!valid || !sessionId || isStreaming) return;
    setBusy(true); setError(null);
    try {
      await createSkill({ name, description: description.trim(), scope: "project" });
      // A completed request must not prefill a different tab/project after unmount.
      if (!live.current) return;
      prefillChat(t("workspace.skill.draft", { name, description: description.trim() }));
      setOpen(false); setName(""); setDescription("");
    } catch (error) { setError(t("workspace.skill.error", { detail: (error as Error).message })); }
    finally { setBusy(false); }
  };
  return <>
    {/* Icon-only in the crowded composer toolbar; the name is the accessible label and tooltip. */}
    <Button size="icon-xs" variant="ghost" aria-label={t("workspace.skill.open")} title={t("workspace.skill.open")} disabled={!sessionId || isStreaming} onClick={() => setOpen(true)}><PackagePlusIcon aria-hidden /></Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto break-words">
        <DialogTitle>{t("workspace.skill.title")}</DialogTitle>
        <DialogDescription>{t("workspace.skill.description")}</DialogDescription>
        <label className="block space-y-1"><span>{t("workspace.skill.name")}</span><input className={fieldClass} maxLength={64} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /><span className="block text-xs text-muted-foreground">{t("workspace.skill.nameRule")}</span></label>
        <label className="block space-y-1"><span>{t("workspace.skill.task")}</span><input className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busy} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild><Button variant="outline" disabled={busy}>{t("workspace.setup.close")}</Button></DialogClose>
          <Button disabled={!valid || busy || !sessionId || isStreaming} onClick={() => void create()}>{t(busy ? "workspace.skill.creating" : "workspace.skill.create")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
