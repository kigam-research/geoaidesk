"use client";
/** Sources: drop files, say what to make, start reading. While reading, show real progress only. */
import { CheckIcon, FileArchiveIcon, FileTextIcon, LoaderCircleIcon, UploadIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthoringAttempt, AuthoringProject, SourceDocument } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

export type Target = "auto" | "skill" | "workflow";

export function sourceLine(project: AuthoringProject, source: SourceDocument): string {
  const x = project.extractions[source.id];
  if (source.kind === "pdf" && x?.pages) return text("sources.added", { name: source.name, pages: x.pages });
  if (source.kind === "code" && x?.files) return text("sources.addedCode", { name: source.name, count: x.files.length });
  return text("sources.addedPlain", { name: source.name });
}

export function SourceStep({
  project,
  goal,
  onGoal,
  target,
  onTarget,
  onFiles,
  onRemove,
  uploading,
  onStart,
  pdfText = true,
}: {
  project: AuthoringProject;
  goal: string;
  onGoal: (value: string) => void;
  target: Target;
  onTarget: (value: Target) => void;
  onFiles: (files: File[]) => void;
  onRemove?: (sourceId: string) => void;
  uploading?: string | null;
  onStart: () => void;
  pdfText?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const targets: { id: Target; label: string }[] = [
    { id: "auto", label: text("sources.targetAuto") },
    { id: "skill", label: text("sources.targetSkill") },
    { id: "workflow", label: text("sources.targetWorkflow") },
  ];
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-2">
      <h2 className="text-xl font-semibold">{text("sources.title")}</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center",
          over && "border-primary bg-primary/5",
        )}
      >
        <UploadIcon className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{text("sources.drop")}</p>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          {text("sources.pick")}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,.zip,.tar.gz,.tgz,.md,.txt,.py,.r,.ipynb,application/pdf"
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {!pdfText && <p className="text-sm text-muted-foreground">{text("sources.noPdfText")}</p>}
      {(project.sources.length > 0 || uploading) && (
        <ul className="flex flex-col gap-2">
          {project.sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              {s.kind === "code" ? (
                <FileArchiveIcon className="size-4 text-muted-foreground" aria-hidden />
              ) : (
                <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{sourceLine(project, s)}</span>
              {onRemove && (
                <button
                  type="button"
                  aria-label={text("sources.remove", { name: s.name })}
                  onClick={() => onRemove(s.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </li>
          ))}
          {uploading && (
            <li className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              {text("sources.uploading", { name: uploading })}
            </li>
          )}
        </ul>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {text("sources.goal")}
        <Input value={goal} onChange={(e) => onGoal(e.target.value)} placeholder={text("sources.goalPlaceholder")} />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{text("sources.target")}</legend>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={target === t.id}
              onClick={() => onTarget(t.id)}
              className={cn(
                "h-8 flex-1 rounded-md text-sm font-medium",
                target === t.id ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Button size="lg" onClick={onStart} disabled={!project.sources.length || Boolean(uploading)}>
        {text("sources.start")}
      </Button>
      {!project.sources.length && <p className="-mt-3 text-sm text-muted-foreground">{text("sources.needSource")}</p>}
    </section>
  );
}

function elapsed(since: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return { minutes: Math.floor(s / 60), seconds: s % 60 };
}

/** Progress of a running attempt: what the program has actually done, plus elapsed time. */
export function WorkingPanel({
  project,
  attempt,
  title,
  note,
}: {
  project: AuthoringProject;
  attempt: AuthoringAttempt;
  title: string;
  note: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pages = project.sources
    .filter((s) => s.kind === "pdf")
    .reduce((n, s) => n + (project.extractions[s.id]?.coveredPages.length ?? 0), 0);
  const files = project.sources
    .filter((s) => s.kind === "code")
    .reduce((n, s) => n + (project.extractions[s.id]?.files?.length ?? 0), 0);
  const done = [
    text("reading.received", { count: project.sources.length }),
    ...(pages ? [text("reading.pages", { pages })] : []),
    ...(files ? [text("reading.files", { count: files })] : []),
  ];
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5 py-10" aria-live="polite">
      <div className="flex items-center gap-3">
        <LoaderCircleIcon className="size-6 animate-spin text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {done.map((line) => (
          <li key={line} className="flex items-center gap-2">
            <CheckIcon className="size-4 text-primary" aria-hidden />
            {line}
          </li>
        ))}
        <li className="flex items-center gap-2 font-medium">
          <LoaderCircleIcon className="size-4 animate-spin text-primary" aria-hidden />
          {attempt.op === "analyze" ? text("reading.analysis") : title}
          <span className="font-normal text-muted-foreground">· {text("reading.elapsed", elapsed(attempt.startedAt, now))}</span>
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">{note}</p>
    </section>
  );
}
