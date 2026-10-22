"use client";
/**
 * GAID hub home (UI guide v2: L2, L3, N2, N5, G2, G3). A sidebar in the functional layer lists the hub's places
 * (추천, 등록된 Workflow, topic folders, 내 Workflow); the content face holds the title, the one primary action
 * (Workflow 만들기), the search and the chosen list. Featured Workflows show their concept pictures at their own
 * aspect ratio; registered Workflows are rows with the same fields in the same places.
 */
import {
  BookOpenIcon,
  CheckIcon,
  DatabaseIcon,
  DropletsIcon,
  FlaskConicalIcon,
  FolderIcon,
  FolderPlusIcon,
  ListIcon,
  LoaderCircleIcon,
  MapIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  WorkflowIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProjectSummary } from "@/geo/contracts/authoring";
import { geoLocale, geoText } from "@/geo/i18n";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import { cn } from "@/lib/utils";

import { SharedBrowse } from "./shared-browse";
import { TechnicalDetail } from "./technical";
import { ConceptPicture } from "./concept-picture";

const text = geoText("hub");

/** Authoring stage of my methods: a text chip with a status tint, never a coloured side stripe (UI guide v2 V7). */
const STAGE_TONE: Record<ProjectSummary["stage"], string> = {
  sources: "bg-gaid-face-2 text-gaid-ink-2",
  analysis: "bg-gaid-face-2 text-gaid-ink-2",
  questions: "bg-gaid-warning-tint text-gaid-warning",
  draft: "bg-gaid-signal-tint text-gaid-signal-ink",
  package: "bg-gaid-success-tint text-gaid-success",
};

/** A Workflow without a picture: a neutral plate with an icon that matches its subject (UI guide v2 S2). */
function CardArt({ title, className }: { title: string; className?: string }) {
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
    <span className={cn("flex size-full items-center justify-center bg-gaid-face-2", className)} aria-hidden>
      <Icon className="size-10 text-gaid-ink-2" strokeWidth={1.5} />
    </span>
  );
}

const GLOSSARY = ["workflow", "skill", "recipe", "draft", "revision", "trial"] as const;

/** Short definitions of the words the hub uses, behind one header action (UI guide v2 P3, W6). */
function HubGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">
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
              <dd className="text-gaid-ink-2">{text(`home.glossary.${k}.text`)}</dd>
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

type HubView = { kind: "home" } | { kind: "registry"; folder: string } | { kind: "mine" };

function CardMeta({ card }: { card: RecommendedCard }) {
  return (
    <span className="mt-auto flex items-center gap-3 pt-1 text-xs text-gaid-ink-2">
      <span className="rounded-sm border border-gaid-edge px-1.5 py-0.5 font-medium">
        {card.source === "catalogue" ? text("home.catalogue") : text("home.shared")}
      </span>
      {card.author && <span className="truncate">{card.author}</span>}
      <span className="inline-flex items-center gap-1 tabular-nums" aria-label={text("home.browse.stars", { count: card.stars })}>
        <StarIcon className="size-3.5" aria-hidden />
        {card.stars}
      </span>
    </span>
  );
}

/** Featured Workflows: the first one large, two beside it (pictures keep their aspect ratio, UI guide v2 I6). */
function Featured({ cards, onOpen }: { cards: RecommendedCard[]; onOpen?: (id: string) => void }) {
  const [lead, ...rest] = cards.slice(0, 3);
  if (!lead) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <button
        type="button"
        onClick={() => onOpen?.(lead.id)}
        className="group flex min-h-64 overflow-hidden rounded-lg border border-gaid-edge bg-gaid-face text-left transition-colors hover:border-gaid-control-edge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {lead.image ? (
          <ConceptPicture
            src={lead.image}
            themed={lead.imageThemed}
            className="flex w-[58%] shrink-0 items-center justify-center rounded-none border-0 border-r border-gaid-edge p-2.5"
            imageClassName="max-h-full"
          />
        ) : (
          <span className="flex w-[58%] shrink-0 items-center justify-center border-r border-gaid-edge bg-gaid-face-2 p-2.5">
            <CardArt title={lead.title} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-2 p-5">
          <span className="text-xl font-semibold leading-7">{lead.title}</span>
          <span className="line-clamp-4 text-sm text-gaid-ink-2" title={lead.line}>{lead.line}</span>
          <CardMeta card={lead} />
        </span>
      </button>
      {rest.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateRows: `repeat(${rest.length}, minmax(0, 1fr))` }}>
          {rest.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpen?.(card.id)}
              className="flex min-h-32 overflow-hidden rounded-lg border border-gaid-edge bg-gaid-face text-left transition-colors hover:border-gaid-control-edge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {card.image ? (
                <ConceptPicture
                  src={card.image}
                  themed={card.imageThemed}
                  className="flex w-40 shrink-0 items-center justify-center rounded-none border-0 border-r border-gaid-edge p-1.5"
                  imageClassName="max-h-full"
                />
              ) : (
                <span className="flex w-40 shrink-0 items-center justify-center border-r border-gaid-edge bg-gaid-face-2 p-1.5">
                  <CardArt title={card.title} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
                <span className="line-clamp-2 font-semibold">{card.title}</span>
                <span className="line-clamp-2 text-sm text-gaid-ink-2" title={card.line}>{card.line}</span>
                <CardMeta card={card} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HubHome({
  recommended,
  folders,
  folderId,
  onFolder,
  onNewFolder,
  registryFolders = [],
  projects,
  mineCount,
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
  /** Folders of my methods (filter of 내 Workflow). */
  folders: HubFolder[];
  folderId: string;
  onFolder: (id: string) => void;
  onNewFolder?: () => void;
  /** Topic folders of the shared registry with their entry counts (sidebar). */
  registryFolders?: HubFolder[];
  projects: ProjectSummary[];
  /** All my methods, before the folder filter. */
  mineCount?: number;
  loading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onOpenRecommended?: (id: string) => void;
}) {
  const [view, setView] = useState<HubView>({ kind: "home" });
  const [query, setQuery] = useState("");
  const registryTotal = registryFolders.reduce((n, f) => n + f.count, 0);
  const registryFolder = view.kind === "registry" ? view.folder : "all";
  const folderTitle =
    view.kind === "registry" && view.folder !== "all"
      ? registryFolders.find((f) => f.id === view.folder)?.name ?? text("home.browse.title")
      : text("home.browse.title");

  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={text("home.nav")}
        className="flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3"
      >
        <SidebarGroup>
          <SidebarItem icon={StarIcon} label={text("home.recommended")} selected={view.kind === "home"} onClick={() => setView({ kind: "home" })} />
          <SidebarItem
            icon={ListIcon}
            label={text("home.browse.title")}
            count={registryTotal}
            selected={view.kind === "registry" && view.folder === "all"}
            onClick={() => setView({ kind: "registry", folder: "all" })}
          />
        </SidebarGroup>
        <SidebarGroup
          title={text("home.foldersTitle")}
          action={
            onNewFolder && (
              <Button variant="ghost" size="icon-xs" aria-label={text("home.newFolder")} title={text("home.newFolder")} onClick={onNewFolder}>
                <FolderPlusIcon />
              </Button>
            )
          }
        >
          {registryFolders.map((f) => (
            <SidebarItem
              key={f.id}
              icon={FolderIcon}
              label={f.name}
              title={f.name}
              count={f.count}
              selected={view.kind === "registry" && view.folder === f.id}
              onClick={() => setView({ kind: "registry", folder: f.id })}
            />
          ))}
        </SidebarGroup>
        <SidebarGroup title={text("home.mineTitle")}>
          <SidebarItem icon={PencilIcon} label={text("home.mineItem")} count={mineCount ?? projects.length} selected={view.kind === "mine"} onClick={() => setView({ kind: "mine" })} />
        </SidebarGroup>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-8 pb-12 pt-7">
          <header className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex max-w-[680px] flex-col gap-1.5">
                <h1 className="text-2xl font-bold tracking-[-0.01em]">{text("home.title")}</h1>
                <p className="text-sm text-gaid-ink-2">{text("home.body")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <HubGlossary />
                <Button onClick={onCreate}>
                  <PlusIcon data-icon="inline-start" />
                  {text("home.new")}
                </Button>
              </div>
            </div>
            {view.kind !== "mine" && (
              <div className="relative w-full max-w-[640px]">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
                <Input
                  type="search"
                  className="h-10 pl-9"
                  aria-label={text("home.browse.search.label")}
                  placeholder={text("home.browse.search.placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
          </header>

          {view.kind === "home" && recommended.length > 0 && !query.trim() && (
            <section className="flex flex-col gap-3" aria-labelledby="hub-recommended">
              <h2 id="hub-recommended" className="text-lg font-semibold">{text("home.recommended")}</h2>
              <Featured cards={recommended} onOpen={onOpenRecommended} />
            </section>
          )}

          {view.kind !== "mine" && (
            <section className="flex flex-col gap-3" aria-labelledby="hub-registry">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="hub-registry" className="text-lg font-semibold">{folderTitle}</h2>
                <p className="text-xs text-gaid-ink-2">{text("home.browse.order")}</p>
              </div>
              <SharedBrowse
                folder={registryFolder}
                query={query}
                onOpen={(id) => onOpenEntry?.(id)}
                onReset={() => {
                  setQuery("");
                  setView({ kind: "registry", folder: "all" });
                }}
              />
            </section>
          )}

          {view.kind === "mine" && (
            <section className="flex min-h-0 flex-col gap-3" aria-labelledby="hub-mine">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="hub-mine" className="text-lg font-semibold">{text("home.mine")}</h2>
                {folders.length > 1 && (
                  <div className="gaid-seg flex flex-wrap items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5" role="group" aria-label={text("home.folders")}>
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={f.id === folderId}
                        onClick={() => onFolder(f.id)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                          f.id === folderId ? "bg-gaid-face text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)]" : "text-gaid-ink-2 hover:text-gaid-ink",
                        )}
                      >
                        {f.name}
                        <span className="tabular-nums text-gaid-ink-3">{f.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {error && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-destructive">{text("home.error")}</p>
                  <TechnicalDetail detail={error} />
                </div>
              )}
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-gaid-ink-2">
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  {text("home.loading")}
                </p>
              ) : projects.length === 0 ? (
                <button
                  type="button"
                  onClick={onCreate}
                  className="rounded-lg border border-dashed border-gaid-control-edge p-10 text-center text-sm text-gaid-ink-2 hover:border-gaid-signal"
                >
                  {text("home.empty")}
                </button>
              ) : (
                <ul className="border-t border-gaid-frame">
                  {projects.map((p) => (
                    <li key={p.id} className="border-b border-gaid-edge">
                      <div className="flex items-center gap-4 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => onOpen(p.id)}
                          aria-label={text("home.open", { title: p.methodTitle ?? p.title })}
                          className="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold", STAGE_TONE[p.stage])}>
                            {p.busy ? <LoaderCircleIcon className="size-3 animate-spin" aria-hidden /> : registered[p.id] ? <CheckIcon className="size-3" aria-hidden /> : null}
                            {registered[p.id] && !p.busy ? text("stage.registered") : stageLabel(p)}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold">{p.methodTitle ?? p.title}</span>
                            <span className="truncate text-sm text-gaid-ink-2">
                              {text("home.byUpdated", { author: p.author ?? text("home.noAuthor"), when: when(p.updatedAt) })}
                            </span>
                          </span>
                        </button>
                        {registered[p.id] && (
                          <Button variant="outline" size="sm" onClick={() => onOpenEntry?.(registered[p.id].entryId)}>
                            {text("home.registered", { n: registered[p.id].revision })}
                            <StarIcon data-icon="inline-end" />
                            <span className="tabular-nums">{registered[p.id].stars}</span>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
