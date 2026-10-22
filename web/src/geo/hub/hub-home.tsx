"use client";
/**
 * GAID hub home: recommended Workflows as picture cards on top; below, "나의 스킬 · Workflow" with the researcher's
 * topic folders on the left and the methods of the chosen folder as cards on the right.
 */
import {
  BookOpenIcon,
  DatabaseIcon,
  FileTextIcon,
  DropletsIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  MapIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SharedBrowse } from "./shared-browse";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { TechnicalDetail } from "./technical";
import { ConceptPicture } from "./concept-picture";
const text = geoText("hub");

const STAGE_TONE: Record<ProjectSummary["stage"], { stripe: string; chip: string }> = {
  sources: { stripe: "border-l-border", chip: "bg-muted text-muted-foreground" },
  analysis: { stripe: "border-l-border", chip: "bg-muted text-muted-foreground" },
  questions: {
    stripe: "border-l-[var(--gaid-warning)]",
    chip: "border border-[var(--gaid-warning)]/40 text-[var(--gaid-warning)]",
  },
  draft: { stripe: "border-l-primary", chip: "bg-primary/10 text-primary" },
  package: {
    stripe: "border-l-[var(--gaid-success)]",
    chip: "border border-[var(--gaid-success)]/40 text-[var(--gaid-success)]",
  },
};

/** A card without a picture: a neutral band with an icon that matches the Workflow's subject (UI guide S2). */
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
    <span className="absolute inset-0 flex items-center justify-center bg-muted" aria-hidden>
      <Icon className="size-8 text-primary" strokeWidth={1.5} />
    </span>
  );
}

const GLOSSARY = ["workflow", "skill", "recipe", "draft", "revision", "trial"] as const;

/** Short definitions of the words the hub uses, behind one header action (UI guide P3, W6). */
function HubGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <BookOpenIcon data-icon="inline-start" />
          {text("home.glossary.button")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <h2 className="mb-2 text-sm font-semibold">{text("home.glossary.title")}</h2>
        <dl className="flex flex-col gap-2 text-sm">
          {GLOSSARY.map((k) => (
            <div key={k} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
              <dt className="font-medium">{text(`home.glossary.${k}.term`)}</dt>
              <dd className="text-muted-foreground">{text(`home.glossary.${k}.text`)}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
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
  /** The image has a dark-mode version (generated concept picture). */
  imageThemed?: boolean;
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
  const [listTab, setListTab] = useState("browse");
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 overflow-y-auto px-6 py-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex max-w-[640px] flex-col gap-1">
            <h1 className="text-xl font-semibold">{text("home.title")}</h1>
            <p className="text-sm text-muted-foreground">{text("home.body")}</p>
          </div>
          <HubGlossary />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <SearchIcon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{text("home.route.use.title")}</span>
              <span className="text-sm text-muted-foreground">{text("home.route.use.body")}</span>
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setListTab("browse");
                document.getElementById("hub-lists")?.scrollIntoView({ behavior: "instant", block: "start" });
              }}
            >
              {text("home.route.use.button")}
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileTextIcon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{text("home.route.make.title")}</span>
              <span className="text-sm text-muted-foreground">{text("home.route.make.body")}</span>
            </span>
            <Button onClick={onCreate}>
              <PlusIcon data-icon="inline-start" />
              {text("home.new")}
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="hub-recommended">
        <h2 id="hub-recommended" className="text-base font-semibold">
          {text("home.recommended")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.slice(0, 4).map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onOpenRecommended?.(card.id)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary/60"
              >
                <span className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
                  {card.image ? (
                    <ConceptPicture
                      src={card.image}
                      themed={card.imageThemed}
                      fit="cover"
                      className="size-full rounded-none border-0"
                      imageClassName="h-full"
                    />
                  ) : (
                    <CardArt title={card.title} />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-2 p-3">
                  <span className="line-clamp-2 text-sm font-semibold">{card.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground" title={card.line}>
                    {card.line}
                  </span>
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

      <Tabs id="hub-lists" value={listTab} onValueChange={setListTab} className="scroll-mt-4 gap-4">
        <TabsList aria-label={text("home.browse.tabs")}>
          <TabsTrigger value="browse">{text("home.browse.title")}</TabsTrigger>
          <TabsTrigger value="mine">{text("home.mine")}</TabsTrigger>
        </TabsList>
        <TabsContent value="browse" forceMount hidden={listTab !== "browse"} className="data-[state=inactive]:hidden">
          <SharedBrowse onOpen={(id) => onOpenEntry?.(id)} />
        </TabsContent>
        <TabsContent value="mine" forceMount hidden={listTab !== "mine"} className="data-[state=inactive]:hidden">
      <section className="flex min-h-0 flex-col gap-3" aria-labelledby="hub-mine">
        <h2 id="hub-mine" className="text-base font-semibold">
          {text("home.mine")}
        </h2>
        {error && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-destructive">{text("home.error")}</p>
            <TechnicalDetail detail={error} />
          </div>
        )}
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
                      "flex h-full w-full flex-col gap-2 rounded-lg border border-l-4 bg-card p-4 text-left transition-colors hover:border-primary/60",
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
                      {registered[p.id] && !p.busy ? text("stage.registered") : stageLabel(p)}
                    </span>
                    <span className="text-sm font-semibold">{p.methodTitle ?? p.title}</span>
                    {p.methodTitle && <span className="line-clamp-1 text-sm text-muted-foreground">{p.title}</span>}
                    <span className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                      {text("home.byUpdated", { author: p.author ?? text("home.noAuthor"), when: when(p.updatedAt) })}
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
        </TabsContent>
      </Tabs>
    </main>
  );
}
