"use client";
/** On-demand detail of the GAID hub: change request, generated files, check issues, agent record, source page. */
import { useEffect, useState } from "react";

import { PdfViewer } from "@/components/pdf-viewer/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { AuthoringAttempt, CheckResult, DraftFileView } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", { dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function FeedbackDialog({
  open,
  onOpenChange,
  onSend,
  initial = "",
}: DialogProps & { onSend: (feedback: string) => Promise<void>; initial?: string }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text("draft.feedback")}</DialogTitle>
        </DialogHeader>
        <Textarea rows={5} value={value} onChange={(e) => setValue(e.target.value)} placeholder={text("draft.feedbackPlaceholder")} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text("draft.close")}
          </Button>
          <Button
            disabled={!value.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSend(value.trim());
                setValue("");
                onOpenChange(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {text("draft.feedbackSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FilesDialog({ open, onOpenChange, load }: DialogProps & { load: () => Promise<{ files: DraftFileView[] }> }) {
  const [files, setFiles] = useState<DraftFileView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    load()
      .then((r) => live && (setFiles(r.files), setSelected(0)))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [open, load]);
  const file = files?.[selected];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{text("draft.files")}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-3">
          <ul className="min-h-0 overflow-y-auto rounded-lg border p-1 text-sm">
            {(files ?? []).map((f, i) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn("w-full truncate rounded px-2 py-1 text-left font-mono text-xs", i === selected ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
          <pre className="min-h-0 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
            {file ? (file.encoding === "utf8" ? file.content : `(${file.encoding})`) : ""}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Feedback that asks the coauthor to fix the check errors (technical text stays in the request, not on screen). */
export function issuesFeedback(check: CheckResult): string {
  const errors = check.findings.filter((f) => f.level === "error");
  return [
    "패키지 검사에서 나온 고칠 점을 모두 고쳐 주세요. 다른 내용은 바꾸지 마세요.",
    ...errors.map((f) => `- [${f.check}/${f.code}] ${f.path}: ${f.message}`),
  ].join("\n");
}

export function IssuesDialog({
  open,
  onOpenChange,
  check,
  onFix,
}: DialogProps & { check: CheckResult | null; onFix?: (feedback: string) => Promise<void> }) {
  const findings = check?.findings ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{text("draft.checkFix")}</DialogTitle>
        </DialogHeader>
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto text-sm">
          {findings.map((f, i) => (
            <li key={i} className={cn("rounded-lg border p-3", f.level === "error" ? "border-destructive/40" : "")}>
              <p>{f.plain ?? f.message}</p>
              {f.plain && (
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{text("detail.show")}</summary>
                  <code className="break-all">
                    {f.check} · {f.code} · {f.path}: {f.message}
                  </code>
                </details>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {onFix && check && findings.some((f) => f.level === "error") && (
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onFix(issuesFeedback(check));
                  onOpenChange(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {text("draft.autoFix")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AgentRecordDialog({ open, onOpenChange, attempts }: DialogProps & { attempts: AuthoringAttempt[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{text("detail.title")}</DialogTitle>
        </DialogHeader>
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto text-sm">
          {attempts
            .slice()
            .reverse()
            .map((a) => (
              <li key={a.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  {text("detail.outcome", { op: text(`detail.op.${a.op}`), outcome: text(`detail.result.${a.outcome}`) })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {text("detail.model")}: {a.model}
                  {a.thinkingLevel ? ` · ${a.thinkingLevel}` : ""} · {when(a.startedAt)}
                  {a.endedAt ? ` → ${when(a.endedAt)}` : ""}
                </p>
                {a.error && <p className="mt-1 text-xs text-destructive">{a.error}</p>}
                {a.validationErrors.some((e) => e.length) && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">{text("detail.validation")}</summary>
                    <pre className="whitespace-pre-wrap">{a.validationErrors.map((e) => e.join("\n")).join("\n---\n")}</pre>
                  </details>
                )}
              </li>
            ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function SourcePageDialog({ open, onOpenChange, name, url, page }: DialogProps & { name: string; url: string; page: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {name} · {text("questions.page", { page })}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          <PdfViewer path={name} sourceUrl={url} pageRequest={{ page, sequence: page }} hideAnnotationUi initialFitWidth />
        </div>
      </DialogContent>
    </Dialog>
  );
}
