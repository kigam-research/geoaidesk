"use client";
/** Sources: drop files, say what to make, start reading. While reading, show real progress only. */
import {
  CheckIcon,
  FileArchiveIcon,
  FileTextIcon,
  GlobeIcon,
  LinkIcon,
  LoaderCircleIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PdfViewer } from "@/components/pdf-viewer/pdf-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthoringAttempt, AuthoringProject, SourceDocument } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { AgentModelSelect } from "./agent-model";

const text = geoText("hub");

export type Target = "auto" | "skill" | "workflow";
export type WebSourceKind = "paper" | "blog" | "search";

function UrlForm({ onAdd }: { onAdd: (url: string, kind: WebSourceKind) => void }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<WebSourceKind>("paper");
  const valid = /^https?:\/\/\S+$/.test(url.trim());
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onAdd(url.trim(), kind);
        setUrl("");
      }}
    >
      <select
        aria-label={text("sources.urlKind")}
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={kind}
        onChange={(e) => setKind(e.target.value as WebSourceKind)}
      >
        <option value="paper">{text("sources.kindPaper")}</option>
        <option value="blog">{text("sources.kindBlog")}</option>
        <option value="search">{text("sources.kindSearch")}</option>
      </select>
      <Input
        className="flex-1"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={text("sources.urlPlaceholder")}
        aria-label={text("sources.url")}
      />
      <Button type="submit" variant="outline" disabled={!valid}>
        <LinkIcon data-icon="inline-start" />
        {text("sources.addUrl")}
      </Button>
    </form>
  );
}

export function sourceLine(project: AuthoringProject, source: SourceDocument): string {
  const x = project.extractions[source.id];
  if (source.kind === "pdf" && x?.pages) return text("sources.added", { name: source.name, pages: x.pages });
  if (source.kind === "code" && x?.files)
    return text("sources.addedCode", { name: source.name, count: x.files.length });
  if (source.kind === "web") {
    let host = source.url ?? source.name;
    try {
      host = new URL(source.url ?? "").hostname;
    } catch {
      /* keep the name */
    }
    return text("sources.addedWeb", { name: source.title ?? source.name, host });
  }
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
  onNext,
  pdfText = true,
  analyzed = false,
  onUrl,
  urls = [],
  agentModel,
  onAgentModel,
}: {
  /** Agent model for reading and drafting ("" = the app default). */
  agentModel?: string;
  onAgentModel?: (ref: string) => void;
  /** Add a web source (paper/article URL, blog, a web search result page); the server fetches it inside the institute network. */
  onUrl?: (url: string, kind: WebSourceKind) => void;
  /** Web sources already added (mockup until the server fetches URLs). */
  urls?: { url: string; kind: WebSourceKind; status: "fetched" | "fetching" | "failed"; title?: string }[];
  project: AuthoringProject;
  goal: string;
  onGoal: (value: string) => void;
  target: Target;
  onTarget: (value: Target) => void;
  onFiles: (files: File[]) => void;
  onRemove?: (sourceId: string) => void;
  uploading?: string | null;
  onStart: () => void;
  /** Sources were read: go on to the questions (the primary action then). */
  onNext?: () => void;
  pdfText?: boolean;
  /** Sources were already analyzed: starting again re-reads them (secondary action). */
  analyzed?: boolean;
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
      {onUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text("sources.url")}</span>
          <UrlForm onAdd={onUrl} />
          <span className="text-xs text-muted-foreground">{text("sources.urlNote")}</span>
        </div>
      )}
      {!pdfText && <p className="text-sm text-muted-foreground">{text("sources.noPdfText")}</p>}
      {(project.sources.length > 0 || uploading || urls.length > 0) && (
        <ul className="flex flex-col gap-2">
          {project.sources.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              {s.kind === "code" ? (
                <FileArchiveIcon className="size-4 text-muted-foreground" aria-hidden />
              ) : s.kind === "web" ? (
                <GlobeIcon className="size-4 text-muted-foreground" aria-hidden />
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
          {urls.map((u) => (
            <li key={u.url} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <GlobeIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{u.title ?? u.url}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {text(`sources.kind${u.kind === "paper" ? "Paper" : u.kind === "blog" ? "Blog" : "Search"}`)} ·{" "}
                {text(`sources.url_${u.status}`)}
              </span>
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
      {onAgentModel && <AgentModelSelect value={agentModel ?? ""} onChange={onAgentModel} />}
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
      {analyzed && onNext && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">{text("sources.readDone")}</p>
          <Button size="lg" onClick={onNext}>
            {text("sources.next")}
          </Button>
        </div>
      )}
      <Button
        size="lg"
        variant={analyzed ? "outline" : "default"}
        onClick={onStart}
        disabled={!project.sources.length || Boolean(uploading)}
      >
        {analyzed ? text("sources.reread") : text("sources.start")}
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
          <span className="font-normal text-muted-foreground">
            · {text("reading.elapsed", elapsed(attempt.startedAt, now))}
          </span>
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">{note}</p>
    </section>
  );
}

/** While the coauthor reads: the original PDF on the left (page by page), the real progress on the right. */
export function ReadingView({
  project,
  attempt,
  title,
  note,
  pdf,
}: {
  project: AuthoringProject;
  attempt: AuthoringAttempt;
  title: string;
  note: string;
  /** The first PDF source to show; null when the sources have no PDF. */
  pdf: { name: string; url: string } | null;
}) {
  if (!pdf) return <WorkingPanel project={project} attempt={attempt} title={title} note={note} />;
  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-xl border">
        <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
          <FileTextIcon className="size-4" aria-hidden />
          <span className="truncate">{pdf.name}</span>
        </header>
        <div className="min-h-0 flex-1">
          <PdfViewer path={pdf.name} sourceUrl={pdf.url} hideAnnotationUi initialFitWidth />
        </div>
      </section>
      <WorkingPanel project={project} attempt={attempt} title={title} note={note} />
    </div>
  );
}
