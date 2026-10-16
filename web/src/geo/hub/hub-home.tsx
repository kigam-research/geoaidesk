"use client";
/** GAID hub start: what it is in one line, a create button, and the researcher's methods. */
import { LoaderCircleIcon, PlusIcon, SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";

const text = geoText("hub");

export function stageLabel(p: ProjectSummary): string {
  if (p.busy === "analyze") return text("stage.reading");
  if (p.busy === "draft" || p.busy === "revise") return text("stage.drafting");
  if (p.stage === "questions") return text("stage.questions", { count: p.openQuestions });
  return text(`stage.${p.stage}`);
}

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HubHome({
  projects,
  loading,
  error,
  onCreate,
  onOpen,
}: {
  projects: ProjectSummary[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{text("home.title")}</h1>
          <p className="text-muted-foreground">{text("home.body")}</p>
        </div>
        <Button onClick={onCreate}>
          <PlusIcon data-icon="inline-start" />
          {text("home.new")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{text("home.error", { detail: error })}</p>}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {text("home.loading")}
        </p>
      ) : projects.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 text-center text-muted-foreground hover:border-primary/60"
        >
          <SparklesIcon className="size-6" aria-hidden />
          {text("home.empty")}
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                aria-label={text("home.open", { title: p.methodTitle ?? p.title })}
                className="flex h-full w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">{p.methodTitle ?? p.title}</span>
                  <Badge variant={p.stage === "questions" ? "default" : "secondary"} className="shrink-0">
                    {p.busy && <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />}
                    {stageLabel(p)}
                  </Badge>
                </span>
                {p.methodTitle && <span className="text-sm text-muted-foreground">{p.title}</span>}
                <span className="mt-auto text-xs text-muted-foreground">{text("home.updated", { when: when(p.updatedAt) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
