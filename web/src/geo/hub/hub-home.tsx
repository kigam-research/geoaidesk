"use client";
/**
 * GAID hub home: recommended Workflows as picture cards on top; below, "나의 스킬 · Workflow" with the researcher's
 * topic folders on the left and the methods of the chosen folder as cards on the right.
 */
import { FolderIcon, FolderPlusIcon, LoaderCircleIcon, PlusIcon, StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

export function stageLabel(p: ProjectSummary): string {
  if (p.busy === "analyze") return text("stage.reading");
  if (p.busy === "draft" || p.busy === "revise") return text("stage.drafting");
  if (p.stage === "questions") return text("stage.questions", { count: p.openQuestions });
  return text(`stage.${p.stage}`);
}

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** A recommended Workflow: a catalogue Workflow or a shared method with many stars. */
export interface RecommendedCard {
  id: string;
  title: string;
  line: string;
  image: string | null;
  source: "catalogue" | "shared";
  stars: number;
  author?: string;
}

export interface HubFolder {
  id: string;
  name: string;
  count: number;
}

export function HubHome({
  recommended,
  folders,
  folderId,
  onFolder,
  onNewFolder,
  projects,
  loading,
  error,
  onCreate,
  onOpen,
  onOpenRecommended,
}: {
  recommended: RecommendedCard[];
  folders: HubFolder[];
  folderId: string;
  onFolder: (id: string) => void;
  onNewFolder?: () => void;
  projects: ProjectSummary[];
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onOpenRecommended?: (id: string) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 overflow-y-auto px-6 py-8">
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

      <section className="flex flex-col gap-3" aria-labelledby="hub-recommended">
        <h2 id="hub-recommended" className="text-lg font-semibold">
          {text("home.recommended")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.slice(0, 4).map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onOpenRecommended?.(card.id)}
                className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary/60"
              >
                <span className="aspect-[3/2] w-full overflow-hidden bg-muted">
                  {card.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.image} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-3">
                  <span className="font-semibold leading-snug">{card.title}</span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">{card.line}</span>
                  <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {card.source === "catalogue" ? text("home.catalogue") : text("home.shared")}
                    </Badge>
                    <span className="inline-flex items-center gap-0.5">
                      <StarIcon className="size-3.5" aria-hidden />
                      {card.stars}
                    </span>
                    {card.author && <span className="truncate">{card.author}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-h-0 flex-col gap-3" aria-labelledby="hub-mine">
        <h2 id="hub-mine" className="text-lg font-semibold">
          {text("home.mine")}
        </h2>
        {error && <p className="text-sm text-destructive">{text("home.error", { detail: error })}</p>}
        <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label={text("home.folders")} className="flex flex-col gap-1">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-current={f.id === folderId ? "true" : undefined}
                onClick={() => onFolder(f.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                  f.id === folderId ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                )}
              >
                <FolderIcon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.count}</span>
              </button>
            ))}
            {onNewFolder && (
              <button
                type="button"
                onClick={onNewFolder}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                <FolderPlusIcon className="size-4" aria-hidden />
                {text("home.newFolder")}
              </button>
            )}
          </nav>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              {text("home.loading")}
            </p>
          ) : projects.length === 0 ? (
            <button
              type="button"
              onClick={onCreate}
              className="rounded-xl border-2 border-dashed p-10 text-center text-sm text-muted-foreground hover:border-primary/60"
            >
              {text("home.empty")}
            </button>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    aria-label={text("home.open", { title: p.methodTitle ?? p.title })}
                    className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold leading-snug">{p.methodTitle ?? p.title}</span>
                      <Badge variant={p.stage === "questions" ? "default" : "secondary"} className="shrink-0">
                        {p.busy && <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />}
                        {stageLabel(p)}
                      </Badge>
                    </span>
                    {p.methodTitle && <span className="line-clamp-1 text-sm text-muted-foreground">{p.title}</span>}
                    <span className="mt-auto text-xs text-muted-foreground">{text("home.updated", { when: when(p.updatedAt) })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

