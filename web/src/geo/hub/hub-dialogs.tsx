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

import { setHubUserName } from "./shared-api";

const text = geoText("hub");

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
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
      <DialogContent className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>{text("draft.feedback")}</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={6}
          className="max-h-[50vh] min-h-24 overflow-y-auto"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={text("draft.feedbackPlaceholder")}
        />
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

export function FilesDialog({
  open,
  onOpenChange,
  load,
}: DialogProps & { load: () => Promise<{ files: DraftFileView[] }> }) {
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
                  className={cn(
                    "w-full truncate rounded px-2 py-1 text-left font-mono text-xs",
                    i === selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
          <pre className="min-h-0 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
            {file ? (file.encoding === "utf8" ? file.content : (decodeText(file.content) ?? `(${file.encoding})`)) : ""}
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
        <IssueGroups findings={findings} />
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

/** Text of a base64 file when it is valid UTF-8 without control bytes (e.g. a LICENSE copied from code), else null. */
function decodeText(base64: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /[\u0000-\u0008\u000e-\u001f]/.test(value) ? null : value;
  } catch {
    return null;
  }
}

/** Errors grouped by their plain sentence with a count; technical lines and warnings stay folded. */
function IssueGroups({ findings }: { findings: CheckResult["findings"] }) {
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");
  const groups = new Map<string, typeof errors>();
  for (const f of errors) {
    const key = f.plain ?? f.message;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto text-sm">
      {[...groups].map(([sentence, items]) => (
        <div key={sentence} className="rounded-lg border border-destructive/40 p-3">
          <p>
            {sentence}
            {items.length > 1 && (
              <span className="text-muted-foreground"> {text("draft.issueCount", { count: items.length })}</span>
            )}
          </p>
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">{text("draft.issueDetail")}</summary>
            <ul className="mt-1 flex flex-col gap-1">
              {items.map((f, i) => (
                <li key={i} className="break-all">
                  {f.message}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      {warnings.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{text("draft.warnings", { count: warnings.length })}</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {warnings.map((f, i) => (
              <li key={i} className="break-all">
                {f.plain ? `${f.plain} ` : ""}
                {f.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
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
                  {text("detail.outcome", {
                    op: text(`detail.op.${a.op}`),
                    outcome: text(`detail.result.${a.outcome}`),
                  })}
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
                    <pre className="whitespace-pre-wrap">
                      {a.validationErrors.map((e) => e.join("\n")).join("\n---\n")}
                    </pre>
                  </details>
                )}
              </li>
            ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function SourcePageDialog({
  open,
  onOpenChange,
  name,
  url,
  page,
}: DialogProps & { name: string; url: string; page: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {name} · {text("questions.page", { page })}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
          <PdfViewer
            path={name}
            sourceUrl={url}
            pageRequest={{ page, sequence: page }}
            hideAnnotationUi
            initialFitWidth
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Register a draft in the shared GAID hub: folder, a short note for other researchers, what is and is not shared. */
export function RegisterDialog({
  open,
  onOpenChange,
  folders,
  onRegister,
}: DialogProps & {
  folders: { id: string; name: string }[];
  onRegister: (folderId: string, note: string) => Promise<void>;
}) {
  const [folder, setFolder] = useState(folders[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{text("register.title")}</DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {text("register.folder")}
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm font-normal"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {text("register.note")}
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={text("register.notePlaceholder")}
          />
        </label>
        <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
          <li>{text("register.shared")}</li>
          <li className="text-muted-foreground">{text("register.notShared")}</li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {text("draft.close")}
          </Button>
          <Button
            disabled={busy || !folder}
            onClick={async () => {
              setBusy(true);
              try {
                await onRegister(folder, note.trim());
                onOpenChange(false);
              } catch {
                // The caller reported the error; the dialog stays open with the researcher's note.
              } finally {
                setBusy(false);
              }
            }}
          >
            {text("register.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The display name other researchers see on registrations, stars and comments (asked once, kept in this browser). */
export function HubUserDialog({ open, onOpenChange, onSaved }: DialogProps & { onSaved: () => void }) {
  const [name, setName] = useState("");
  const valid = name.trim().length >= 1 && name.trim().length <= 40;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{text("user.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{text("user.body")}</p>
        <input
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={text("user.placeholder")}
          aria-label={text("user.title")}
        />
        <DialogFooter>
          <Button
            disabled={!valid}
            onClick={() => {
              setHubUserName(name);
              onSaved();
            }}
          >
            {text("user.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A new shared topic folder of the hub. */
export function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: DialogProps & { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{text("folder.title")}</DialogTitle>
        </DialogHeader>
        <input
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={text("folder.placeholder")}
          aria-label={text("folder.name")}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onCreate(name.trim());
                setName("");
                onOpenChange(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {text("folder.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
