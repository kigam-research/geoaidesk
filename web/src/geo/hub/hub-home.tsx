"use client";
/**
 * GAID hub home: recommended Workflows as picture cards on top; below, "나의 스킬 · Workflow" with the researcher's
 * topic folders on the left and the methods of the chosen folder as cards on the right.
 */
import {
  ArrowRightIcon,
  DatabaseIcon,
  DropletsIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  MapIcon,
  PlusIcon,
  StarIcon,
  WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

const STAGE_TONE: Record<ProjectSummary["stage"], { stripe: string; chip: string }> = {
  sources: { stripe: "border-l-slate-300", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  analysis: { stripe: "border-l-slate-300", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  questions: {
    stripe: "border-l-amber-400",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  draft: { stripe: "border-l-sky-400", chip: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  package: {
    stripe: "border-l-emerald-400",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

/** A card without a picture: a short brand-blue band with an icon that matches the Workflow's subject. */
function CardArt({ title }: { title: string }) {
  const Icon = /지도|좌표|map|crs/i.test(title)
    ? MapIcon
    : /양수|수위|지하수|pump|well/i.test(title)
      ? DropletsIcon
      : /분석값|조성|화학|assay|geochem/i.test(title)
        ? FlaskConicalIcon
        : /자료|검색|공개|data|search/i.test(title)
          ? DatabaseIcon
          : WorkflowIcon;
  return (
    <span
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/90 to-sky-500"
      aria-hidden
    >
      <Icon className="size-9 text-white/90" strokeWidth={1.5} />
    </span>
  );
}

export function stageLabel(p: ProjectSummary): string {
  if (p.busy === "analyze") return text("stage.reading");
  if (p.busy === "draft" || p.busy === "revise") return text("stage.drafting");
  if (p.stage === "questions") return text("stage.questions", { count: p.openQuestions });
  return text(`stage.${p.stage}`);
}

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", { dateStyle: "medium" }).format(
      new Date(iso),
    );
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
  registered = {},
  onOpenEntry,
}: {
  /** My methods already registered in the shared hub, by authoring project id. */
  registered?: Record<string, { entryId: string; stars: number; comments: number; revision: number }>;
  onOpenEntry?: (entryId: string) => void;
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f5eff] via-[#3b6dff] to-[#0ea5e9] px-8 py-9 text-white shadow-lg shadow-primary/20">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-sky-300/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight">{text("home.title")}</h1>
            <p className="text-lg leading-8 text-white/90 text-pretty">{text("home.body")}</p>
            <ol className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
              {(["make", "register", "feedback"] as const).map((k, i) => (
                <li key={k} className="flex items-center gap-2">
                  {i > 0 && <ArrowRightIcon className="size-4 text-white/60" aria-hidden />}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">
                    <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {text(`home.flow.${k}`)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <Button size="lg" onClick={onCreate} className="bg-white text-primary shadow-md hover:bg-white/90">
            <PlusIcon data-icon="inline-start" />
            {text("home.new")}
          </Button>
        </div>
      </section>

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
                className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <span className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
                  {card.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <CardArt title={card.title} />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-3">
                  <span className="line-clamp-2 text-base font-semibold leading-snug">{card.title}</span>
                  <span className="line-clamp-2 text-sm leading-6 text-muted-foreground">{card.line}</span>
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
                    className={cn(
                      "flex h-full w-full flex-col gap-2 rounded-2xl border border-l-4 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                      STAGE_TONE[p.stage].stripe,
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        STAGE_TONE[p.stage].chip,
                      )}
                    >
                      {p.busy && <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />}
                      {stageLabel(p)}
                    </span>
                    <span className="text-[15px] leading-snug font-semibold">{p.methodTitle ?? p.title}</span>
                    {p.methodTitle && <span className="line-clamp-1 text-sm text-muted-foreground">{p.title}</span>}
                    <span className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                      {text("home.updated", { when: when(p.updatedAt) })}
                      {registered[p.id] && (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEntry?.(registered[p.id].entryId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              onOpenEntry?.(registered[p.id].entryId);
                            }
                          }}
                          className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:underline"
                        >
                          {text("home.registered", { n: registered[p.id].revision })}
                          <StarIcon className="size-3" aria-hidden />
                          {registered[p.id].stars}
                        </span>
                      )}
                    </span>
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
