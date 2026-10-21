"use client";
/**
 * GAID hub home: recommended Workflows as register rows; topic folders stay beside the shared and authored registers.
 */
import {
  BookOpenIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SharedBrowse } from "./shared-browse";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { TechnicalDetail } from "./technical";
const text = geoText("hub");

const STAGE_TONE: Record<ProjectSummary["stage"], string> = {
  sources: "bg-gaid-pending-bg text-muted-foreground",
  analysis: "bg-gaid-pending-bg text-muted-foreground",
  questions: "bg-gaid-warning-bg text-gaid-warning",
  draft: "bg-gaid-pending-bg text-gaid-body",
  package: "bg-gaid-pending-bg text-gaid-body",
};

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
    <main className="mx-auto flex w-full max-w-[1328px] flex-1 flex-col gap-6 overflow-y-auto px-8 py-8 xl:px-12">
      <section className="flex flex-col gap-6 border-b border-gaid-line-strong pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex max-w-[640px] flex-col gap-1">
            <h1 className="text-2xl font-semibold">{text("home.title")}</h1>
            <p className="text-sm text-muted-foreground">{text("home.body")}</p>
          </div>
          <HubGlossary />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex shrink-0 items-center text-muted-foreground">
              <SearchIcon className="size-4" aria-hidden />
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
          <div className="flex items-center gap-3">
            <span className="flex shrink-0 items-center text-muted-foreground">
              <FileTextIcon className="size-4" aria-hidden />
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

      <section className="grid gap-6 border-b border-gaid-line-strong pb-6 md:grid-cols-[11rem_minmax(0,1fr)]" aria-labelledby="hub-recommended">
        <h2 id="hub-recommended" className="text-base font-semibold">
          {text("home.recommended")}
        </h2>
        <ul className="grid gap-x-6 md:grid-cols-2">
          {recommended.slice(0, 4).map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onOpenRecommended?.(card.id)}
                className="group flex h-full min-h-24 w-full items-start gap-4 border-b border-border py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="line-clamp-1 text-base font-semibold" title={card.title}>{card.title}</span>
                  <span className="line-clamp-1 text-sm text-muted-foreground" title={card.line}>
                    {card.line}
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <span>{card.source === "catalogue" ? text("home.catalogue") : text("home.shared")}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <StarIcon className="size-3.5" aria-hidden />
                      {card.stars}
                    </span>
                    {card.author && <span className="truncate">{card.author}</span>}
                  </span>
                </span>
                {card.image && <span className="flex w-24 shrink-0 flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.image} alt="" className="h-16 w-full border bg-card object-contain" />
                  <span className="text-xs text-muted-foreground">{text("io.generated")}</span>
                </span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Tabs id="hub-lists" value={listTab} onValueChange={setListTab} className="scroll-mt-4 gap-4">
        <TabsList variant="line" className="rounded-none p-0 [&_[data-slot=tabs-trigger]]:rounded-none [&_[data-slot=tabs-trigger]]:px-4 [&_[data-slot=tabs-trigger]]:text-sm [&_[data-slot=tabs-trigger][data-state=active]]:text-gaid-link [&_[data-slot=tabs-trigger]]:after:bg-gaid-link" aria-label={text("home.browse.tabs")}>
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
                  "flex items-center gap-2 px-3 py-2 text-left text-sm",
                  f.id === folderId ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
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
                className="flex items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
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
              className="border border-dashed p-6 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {text("home.empty")}
            </button>
          ) : (
            <ul className="flex flex-col divide-y border-y border-border">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    aria-label={text("home.open", { title: p.methodTitle ?? p.title })}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-3 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "col-start-2 row-start-1 inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
                        STAGE_TONE[p.stage],
                      )}
                    >
                      {p.busy && <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />}
                      {registered[p.id] && !p.busy ? text("stage.registered") : stageLabel(p)}
                    </span>
                    <span className="col-start-1 row-start-1 truncate text-sm font-semibold">{p.methodTitle ?? p.title}</span>
                    {p.methodTitle && <span className="col-start-1 line-clamp-1 text-sm text-muted-foreground">{p.title}</span>}
                    <span className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
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
                          className="ml-auto inline-flex items-center gap-1 rounded-sm bg-accent px-2 py-0.5 font-medium text-gaid-link hover:underline"
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
