"use client";
/**
 * The five place mockups (gaid-ia-connect-workspace phase 1): Workspace home, Connect home, the full 서재 screen, and 서재
 * as a side panel in a project (citations) and in Connect authoring (picking sources). Static sample data only; nothing
 * here is wired to the server. Built from the shared parts so the screenshots show the real tokens in 계측 and 도폭.
 */
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  GlobeIcon,
  HomeIcon,
  LibraryIcon,
  ListIcon,
  NewspaperIcon,
  NotebookPenIcon,
  PanelsTopLeftIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SheetIcon,
  StarIcon,
  UploadIcon,
  WaypointsIcon,
  PackageIcon,
  XIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoText } from "@/geo/i18n";
import { StagePlate } from "@/geo/hub/stage-plate";
import { PageBody, PageHeader } from "@/geo/shell/page-header";
import { SEG_TRACK, segItem } from "@/geo/shell/segmented";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import { StepScale } from "@/geo/shell/step-scale";
import { cn } from "@/lib/utils";

import { PlacesAppBar } from "./app-bar";
import { CONTINUE, FEATURED, FEEDS, FILES, FOLDERS, INSTALLED, NOTES, PAPERS, PROJECTS, SHARED, type ContinueRow, type PaperRow } from "./fixtures";

const text = geoText("devPlaces");
const hubText = geoText("hub");

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const FRAME = "flex h-dvh flex-col overflow-hidden bg-gaid-face text-gaid-ink";
const SIDEBAR = "flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3";
const CHIP = "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold";

function SectionHead({ id, title, trailing }: { id: string; title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      {trailing}
    </div>
  );
}

function StateChip({ row }: { row: ContinueRow }) {
  if (row.state === "running")
    return (
      <span className={cn(CHIP, "bg-gaid-signal-tint text-gaid-signal-ink")}>
        <span className="gaid-orbit" aria-hidden />
        {text("workspace.continue.running")}
      </span>
    );
  if (row.state === "decisions") return <span className={cn(CHIP, "bg-gaid-warning-tint text-gaid-warning tabular-nums")}>{text("workspace.continue.decisions", { count: row.count ?? 0 })}</span>;
  if (row.state === "checked") return <span className={cn(CHIP, "bg-gaid-success-tint text-gaid-success")}>{text("workspace.continue.checked")}</span>;
  return <span className={cn(CHIP, "border border-gaid-edge text-gaid-ink-2")}>{text("workspace.continue.unreviewed")}</span>;
}

function SourceTag({ source, version }: { source: "catalogue" | "shared"; version?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-gaid-edge px-1.5 py-0.5 text-xs font-medium text-gaid-ink-2">
      {text(source === "catalogue" ? "workspace.workflows.catalogue" : "workspace.workflows.shared")}
      {version && <span className="tabular-nums">{version}</span>}
    </span>
  );
}

/* ---------------------------------------------------------------- Workspace home */

export function WorkspaceHome() {
  return (
    <div className={FRAME}>
      <PlacesAppBar place="workspace" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={text("workspace.nav")} className={SIDEBAR}>
          <SidebarGroup>
            <SidebarItem icon={HomeIcon} label={text("workspace.side.home")} selected />
            <SidebarItem icon={FolderIcon} label={text("workspace.side.projects")} count={19} />
            <SidebarItem icon={PackageIcon} label={text("workspace.side.workflows")} count={INSTALLED.length} />
          </SidebarGroup>
          <SidebarGroup title={text("workspace.side.recent")}>
            {PROJECTS.slice(0, 3).map((p) => (
              <SidebarItem key={p.id} icon={FolderIcon} label={p.name} title={p.name}>
                {p.running && <span className="gaid-orbit" aria-hidden />}
              </SidebarItem>
            ))}
          </SidebarGroup>
          <SidebarGroup>
            <SidebarItem icon={ArchiveIcon} label={text("workspace.side.archived")} count={4} />
          </SidebarGroup>
        </nav>
        <PageBody labelledBy="ws-title" className="gap-8">
          <PageHeader
            titleId="ws-title"
            title={text("workspace.title")}
            context={text("workspace.context")}
            actions={
              <>
                <Button variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  {text("workspace.newProject")}
                </Button>
                <Button>
                  <PlayIcon data-icon="inline-start" />
                  {text("workspace.start")}
                </Button>
              </>
            }
          />

          <section className="flex flex-col gap-3" aria-labelledby="ws-continue">
            <SectionHead id="ws-continue" title={text("workspace.continue.heading")} />
            <ul className="border-t border-gaid-frame">
              {CONTINUE.map((row) => (
                <li key={row.id} className="border-b border-gaid-edge">
                  <button type="button" className="flex min-h-14 w-full items-center gap-4 px-3 py-2 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="flex w-24 shrink-0"><StateChip row={row} /></span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{row.title}</span>
                      <span className="truncate text-sm text-gaid-ink-2">
                        {[row.project, row.workflow && `Workflow ${row.workflow}`, row.stage].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-gaid-ink-2">{row.when}</span>
                    <ChevronRightIcon className="size-4 shrink-0 text-gaid-ink-2" aria-label={text("workspace.continue.open")} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="flex flex-col gap-3" aria-labelledby="ws-projects">
              <SectionHead
                id="ws-projects"
                title={text("workspace.projects.heading")}
                trailing={<Button variant="link" size="sm" className="h-auto px-0">{text("workspace.projects.all", { count: 19 })}</Button>}
              />
              <ul className="border-t border-gaid-frame">
                {PROJECTS.map((p) => (
                  <li key={p.id} className="border-b border-gaid-edge">
                    <button type="button" className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-gaid-hover">
                      <FolderIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{p.name}</span>
                        <span className="truncate text-sm text-gaid-ink-2">{p.line}</span>
                      </span>
                      {p.running && <span className="gaid-orbit" aria-hidden />}
                      <span className="shrink-0 text-sm text-gaid-ink-2">{p.when}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="ws-workflows">
              <SectionHead
                id="ws-workflows"
                title={text("workspace.workflows.heading")}
                trailing={
                  <Button variant="link" size="sm" className="h-auto px-0">
                    <WaypointsIcon data-icon="inline-start" />
                    {text("workspace.workflows.find")}
                  </Button>
                }
              />
              <ul className="border-t border-gaid-frame">
                {INSTALLED.map((w) => (
                  <li key={w.id} className="flex min-h-14 items-center gap-3 border-b border-gaid-edge px-3 py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{w.title}</span>
                      <span className="truncate text-sm text-gaid-ink-2">{w.line}</span>
                    </span>
                    <SourceTag source={w.source} version={w.version} />
                    <span className={cn(CHIP, w.ready ? "bg-gaid-success-tint text-gaid-success" : "bg-gaid-warning-tint text-gaid-warning")}>
                      {text(w.ready ? "workspace.workflows.ready" : "workspace.workflows.envNeeded")}
                    </span>
                    <Button variant="ghost" size="sm">{text("workspace.workflows.start")}</Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </PageBody>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Connect home */

function ConnectSidebar() {
  return (
    <nav aria-label={text("connect.nav")} className={SIDEBAR}>
      <SidebarGroup>
        <SidebarItem icon={StarIcon} label={text("connect.side.recommended")} selected />
        <SidebarItem icon={ListIcon} label={text("connect.side.shared")} count={9} />
      </SidebarGroup>
      <SidebarGroup
        title={text("connect.side.folders")}
        action={<Button variant="ghost" size="icon-xs" aria-label={text("library.folders")}><FolderPlusIcon /></Button>}
      >
        <SidebarItem icon={FolderIcon} label="일반" count={1} />
        <SidebarItem icon={FolderIcon} label="광상 부존 가능성(MPM)" count={5} />
        <SidebarItem icon={FolderIcon} label="지구물리 역산" count={3} />
      </SidebarGroup>
      <SidebarGroup title={text("connect.side.mine")}>
        <SidebarItem icon={PencilIcon} label={text("connect.side.mineItem")} count={10} />
      </SidebarGroup>
      <SidebarGroup title={text("connect.side.skills")}>
        <SidebarItem icon={BookOpenIcon} label={text("connect.side.skillsAll")} />
      </SidebarGroup>
      <SidebarGroup title={text("connect.side.feeds")}>
        <SidebarItem icon={NewspaperIcon} label={text("connect.side.feedsAll")} count={12} />
      </SidebarGroup>
    </nav>
  );
}

function FeaturedCards() {
  const [lead, ...rest] = FEATURED;
  const meta = (card: (typeof FEATURED)[number]) => (
    <span className="mt-auto flex items-center gap-3 pt-1 text-xs text-gaid-ink-2">
      <span className="rounded-sm border border-gaid-edge px-1.5 py-0.5 font-medium">{text(card.source === "catalogue" ? "connect.catalogue" : "connect.sharedBadge")}</span>
      {card.author && <span>{card.author}</span>}
      <span className="inline-flex items-center gap-1 tabular-nums"><StarIcon className="size-3.5" aria-hidden />{card.stars}</span>
    </span>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <button type="button" className="flex min-h-60 overflow-hidden rounded-lg border border-gaid-edge bg-gaid-face text-left hover:border-gaid-control-edge">
        <StagePlate stages={lead.stages} max={8} large className="w-[52%] shrink-0 border-r border-gaid-edge" />
        <span className="flex min-w-0 flex-1 flex-col gap-2 p-5">
          <span className="text-xl font-semibold leading-7">{lead.title}</span>
          <span className="line-clamp-4 text-sm text-gaid-ink-2">{lead.line}</span>
          {meta(lead)}
        </span>
      </button>
      <div className="grid grid-rows-2 gap-4">
        {rest.map((card) => (
          <button key={card.id} type="button" className="flex min-h-28 overflow-hidden rounded-lg border border-gaid-edge bg-gaid-face text-left hover:border-gaid-control-edge">
            <StagePlate stages={card.stages} max={3} className="w-44 shrink-0 border-r border-gaid-edge" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
              <span className="line-clamp-2 font-semibold">{card.title}</span>
              <span className="line-clamp-2 text-sm text-gaid-ink-2">{card.line}</span>
              {meta(card)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConnectHome() {
  const routes: { id: "pdf" | "library" | "notes" | "analysis"; icon: Icon }[] = [
    { id: "pdf", icon: FileTextIcon },
    { id: "library", icon: BookOpenIcon },
    { id: "notes", icon: NotebookPenIcon },
    { id: "analysis", icon: PanelsTopLeftIcon },
  ];
  return (
    <div className={FRAME}>
      <PlacesAppBar place="connect" />
      <div className="flex min-h-0 flex-1">
        <ConnectSidebar />
        <PageBody labelledBy="cn-title" className="gap-8">
          <header className="flex flex-col gap-5">
            <PageHeader
              titleId="cn-title"
              title={text("connect.title")}
              context={text("connect.context")}
              actions={
                <>
                  <Button variant="ghost"><BookOpenIcon data-icon="inline-start" />{text("connect.glossary")}</Button>
                  <Button><PlusIcon data-icon="inline-start" />{text("connect.create")}</Button>
                </>
              }
            />
            <div className="relative w-full max-w-[640px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
              <Input type="search" className="h-10 pl-9" aria-label={text("connect.search")} placeholder={text("connect.search")} />
            </div>
          </header>

          <section className="flex flex-col gap-3" aria-labelledby="cn-featured">
            <SectionHead id="cn-featured" title={text("connect.recommended")} />
            <FeaturedCards />
          </section>

          <section className="flex flex-wrap items-center gap-x-4 gap-y-3" aria-labelledby="cn-make">
            <h2 id="cn-make" className="text-base font-semibold">{text("connect.make.heading")}</h2>
            <div className="flex flex-wrap gap-2">
              {routes.map(({ id, icon: RouteIcon }) => (
                <Button key={id} variant="outline" title={text(`connect.make.${id}Line`)}>
                  <RouteIcon data-icon="inline-start" />
                  {text(`connect.make.${id}`)}
                </Button>
              ))}
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-3" aria-labelledby="cn-shared">
              <SectionHead id="cn-shared" title={text("connect.shared.heading")} trailing={<p className="text-xs text-gaid-ink-2">{text("connect.shared.order")}</p>} />
              <ul className="border-t border-gaid-frame">
                {SHARED.map((s) => (
                  <li key={s.id} className="flex min-h-14 items-center gap-4 border-b border-gaid-edge px-3 py-2">
                    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border border-gaid-edge text-xs leading-tight text-gaid-ink-2">
                      <span className="text-sm font-semibold tabular-nums text-gaid-ink">{s.stages}</span>
                      {hubText("home.stages.unit")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{s.title}</span>
                      <span className="truncate text-sm text-gaid-ink-2">{s.folder} · {s.author}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-gaid-ink-2">{s.version}</span>
                    <span className="inline-flex w-10 shrink-0 items-center gap-1 text-sm tabular-nums text-gaid-ink-2"><StarIcon className="size-3.5" aria-hidden />{s.stars}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="cn-feeds">
              <SectionHead id="cn-feeds" title={text("connect.feeds.heading")} trailing={<Button variant="link" size="sm" className="h-auto px-0">{text("connect.feeds.all")}</Button>} />
              <ul className="border-t border-gaid-frame">
                {FEEDS.map((n) => (
                  <li key={n.id} className="flex flex-col gap-1 border-b border-gaid-edge px-1 py-2.5">
                    <span className="line-clamp-2 text-sm font-medium">{n.title}</span>
                    <span className="flex items-center gap-2 text-xs text-gaid-ink-2">
                      <span className="rounded-sm border border-gaid-edge px-1.5 py-px">{text("connect.feeds.unreviewed")}</span>
                      {n.source} · {n.when}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </PageBody>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 서재 full screen */

function SourcePill({ source }: { source: PaperRow["source"] }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-px text-xs font-medium", source === "Zotero" ? "border-gaid-control-edge text-gaid-ink-2" : "border-gaid-edge bg-gaid-face-2 text-gaid-ink-2")}>
      {source}
    </span>
  );
}

export function LibraryFull() {
  return (
    <div className={FRAME}>
      <PlacesAppBar
        place={null}
        library
        trailing={
          <Button variant="ghost" size="sm" title={text("library.closeTip")}>
            <ArrowLeftIcon data-icon="inline-start" />
            {text("library.back", { place: "Workspace" })}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={text("library.folders")} className={SIDEBAR}>
          <SidebarGroup>
            <SidebarItem icon={LibraryIcon} label={text("library.allPapers")} count={PAPERS.length} selected />
          </SidebarGroup>
          <SidebarGroup
            title={text("library.folders")}
            action={<Button variant="ghost" size="icon-xs" aria-label={text("library.folders")}><FolderPlusIcon /></Button>}
          >
            {FOLDERS.map((f) => <SidebarItem key={f.id} icon={FolderIcon} label={f.name} count={f.count} />)}
          </SidebarGroup>
        </nav>
        <PageBody labelledBy="lib-title" className="gap-6">
          <PageHeader
            titleId="lib-title"
            title={text("library.title")}
            context={text("library.context")}
            actions={
              <>
                <Button variant="outline">{text("library.export")}</Button>
                <Button><PlusIcon data-icon="inline-start" />{text("library.add")}</Button>
              </>
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className={SEG_TRACK} role="group" aria-label={text("library.title")}>
              <button type="button" aria-pressed className={segItem(true)}>{text("library.papers", { count: PAPERS.length })}</button>
              <button type="button" aria-pressed={false} className={segItem(false)}>{text("library.notes", { count: NOTES.length })}</button>
            </div>
            <div className="relative w-full max-w-[480px]">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
              <Input type="search" className="pl-9" aria-label={text("library.search")} placeholder={text("library.search")} />
            </div>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gaid-frame text-left text-xs text-gaid-ink-2">
                <th scope="col" className="py-2 pl-2 font-medium">{text("library.col.paper")}</th>
                <th scope="col" className="w-16 py-2 font-medium">{text("library.col.year")}</th>
                <th scope="col" className="w-24 py-2 font-medium">{text("library.col.source")}</th>
                <th scope="col" className="w-44 py-2 font-medium">{text("library.col.used")}</th>
              </tr>
            </thead>
            <tbody>
              {PAPERS.map((p, i) => (
                <tr key={p.id} className={cn("border-b border-gaid-edge align-top", i === 0 && "bg-gaid-signal-tint")}>
                  <td className="py-2.5 pl-2 pr-4">
                    <span className="line-clamp-2 font-medium">{p.title}</span>
                    <span className="text-xs text-gaid-ink-2">{p.authors} · {p.journal}</span>
                  </td>
                  <td className="py-2.5 tabular-nums">{p.year}</td>
                  <td className="py-2.5"><SourcePill source={p.source} /></td>
                  <td className="py-2.5 text-gaid-ink-2 tabular-nums">
                    {p.projects + p.workflows > 0 ? text("library.usedLine", { projects: p.projects, workflows: p.workflows }) : text("library.unused")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PageBody>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 서재 panel in a project */

function PanelHeader({ children, onClose = true }: { children: ReactNode; onClose?: boolean }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gaid-frame bg-gaid-chrome px-3">
      {children}
      <span className="flex-1" />
      {onClose && <Button variant="ghost" size="icon-sm" aria-label={text("panel.close")} title={text("panel.close")}><XIcon /></Button>}
    </div>
  );
}

function Cite({ paper }: { paper: PaperRow }) {
  return (
    <button type="button" title={text("project.citeTip")} className="whitespace-nowrap rounded-sm px-0.5 font-medium text-gaid-signal-ink underline decoration-gaid-signal-ink/40 underline-offset-2 hover:decoration-gaid-signal-ink">
      [@{paper.key}, p. {paper.page}]
    </button>
  );
}

export function ProjectLibraryPanel() {
  const inProject = PAPERS.filter((p) => p.inProject);
  const [heo, astic] = inProject;
  return (
    <div className={FRAME}>
      <PlacesAppBar place="workspace" project="포천 자철석 광체 추정" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={text("project.files")} className="flex w-[232px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3">
          <SidebarGroup title={text("project.files")}>
            {FILES.map((f) => <SidebarItem key={f} icon={FolderIcon} label={f} selected={f === "연구노트"} />)}
          </SidebarGroup>
          <SidebarGroup title={text("project.notes")}>
            <SidebarItem icon={NotebookPenIcon} label={text("project.noteTitle")} selected />
            <SidebarItem icon={NotebookPenIcon} label="시추 코어 대자율 정리" />
          </SidebarGroup>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-gaid-frame bg-gaid-chrome px-5">
            <span className="truncate text-sm font-semibold">{text("project.noteTitle")}</span>
            <span className={cn(CHIP, "border border-gaid-edge text-gaid-ink-2")}>{text("project.noteStatus")}</span>
          </div>
          <article className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            <div className="flex max-w-[680px] flex-col gap-4 text-[15px] leading-7">
              <h1 className="text-2xl font-bold">{text("project.noteTitle")}</h1>
              <p className="text-sm text-gaid-ink-2">{text("project.workflow")} · 2026-10-24</p>
              <h2 className="pt-2 text-lg font-semibold">결과</h2>
              <p>
                항공자력과 시추 코어 대자율을 함께 역산하면 자철석 광체는 지표 아래 40–180 m에 북동 방향으로 놓이며, 추정 부피는
                1.9 × 10⁶ m³입니다 <Cite paper={heo} />. 암석물리 제약을 넣은 역산은 경계를 시추 자료와 더 잘 맞춥니다 <Cite paper={astic} />.
              </p>
              <h2 className="pt-2 text-lg font-semibold">한계</h2>
              <p>남서쪽 가장자리에는 시추공이 없어 경계의 불확실성이 큽니다. 부피는 대자율 임계값 0.05 SI 기준의 추정값입니다.</p>
            </div>
          </article>
        </main>
        <aside aria-label={text("panel.inspector")} className="flex w-[420px] shrink-0 flex-col border-l border-gaid-frame bg-gaid-face">
          <PanelHeader>
            <div className={SEG_TRACK} role="tablist" aria-label={text("panel.inspector")}>
              <button type="button" role="tab" aria-selected={false} className={segItem(false, "h-7")}>{text("panel.agent")}</button>
              <button type="button" role="tab" aria-selected className={segItem(true, "h-7 gap-1.5")}><BookOpenIcon className="size-4" aria-hidden />{text("panel.title")}</button>
            </div>
          </PanelHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className={SEG_TRACK} role="group" aria-label={text("panel.title")}>
              <button type="button" aria-pressed className={segItem(true, "h-7 text-xs")}>{text("panel.scope")} <span className="ml-1 tabular-nums">{inProject.length}</span></button>
              <button type="button" aria-pressed={false} className={segItem(false, "h-7 text-xs")}>{text("panel.all")}</button>
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
              <Input type="search" className="pl-9" aria-label={text("library.search")} placeholder={text("library.search")} />
            </div>
            <ul className="flex flex-col border-t border-gaid-frame">
              {inProject.map((p, i) => (
                <li key={p.id} className={cn("flex flex-col gap-1 border-b border-gaid-edge px-2 py-2.5", i === 0 && "gaid-index relative bg-gaid-signal-tint")}>
                  <span className={cn("text-sm font-medium", i === 0 ? "line-clamp-3" : "line-clamp-2")}>{p.title}</span>
                  <span className="text-xs text-gaid-ink-2 tabular-nums">
                    {p.authors} · {p.year}
                    {p.cited ? ` · ${text("panel.cited", { count: p.cited })}` : ""}
                  </span>
                  {i === 0 && (
                    <span className="flex items-center gap-2 pt-1.5">
                      <Button variant="outline" size="sm"><FileTextIcon data-icon="inline-start" />{text("panel.openPdf")} {text("panel.page", { page: p.page ?? 1 })}</Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 items-center justify-end border-t border-gaid-edge px-4 py-2.5">
            <Button variant="link" size="sm" className="h-auto px-0">
              {text("panel.openFull")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 서재 panel in Connect authoring */

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
        checked ? "border-gaid-signal bg-gaid-signal text-gaid-on-signal" : "border-gaid-control-edge bg-gaid-face",
      )}
    >
      {checked && <CheckIcon className="size-3" />}
    </span>
  );
}

export function AuthoringLibraryPanel() {
  const added: { name: string; kind: "pdf" | "note" | "data"; icon: Icon }[] = [
    { name: "Heo_2025_Pocheon_PGI.pdf", kind: "pdf", icon: FileTextIcon },
    { name: "포천 자철석 PGI 2차 검증 정리", kind: "note", icon: NotebookPenIcon },
    { name: "pocheon_core_susceptibility.csv", kind: "data", icon: SheetIcon },
  ];
  const steps = (["sources", "questions", "draft", "trial", "share"] as const).map((id) => ({ label: text(`authoring.steps.${id}`) }));
  const picked = new Set(["a2", "a4"]);
  return (
    <div className={FRAME}>
      <PlacesAppBar place="connect" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={text("connect.nav")} className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gaid-frame bg-gaid-chrome py-3">
          {[StarIcon, ListIcon, PencilIcon, BookOpenIcon, NewspaperIcon].map((RailIcon, i) => (
            <span key={i} className={cn("relative flex size-9 items-center justify-center rounded-md text-gaid-ink-2", i === 2 && "gaid-index bg-gaid-signal-tint text-gaid-signal-ink before:!left-[-6px]")}>
              <RailIcon className="size-4" aria-hidden />
            </span>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7 px-8 pb-8 pt-7">
              <PageHeader title={text("authoring.title")} context={text("authoring.context")} />
              <StepScale steps={steps} current={0} label={text("authoring.steps.label")} />
              <section className="flex flex-col gap-3" aria-labelledby="au-added">
                <SectionHead id="au-added" title={text("authoring.added", { count: added.length })} />
                <ul className="border-t border-gaid-frame">
                  {added.map((a) => (
                    <li key={a.name} className="flex min-h-11 items-center gap-3 border-b border-gaid-edge px-3 py-2">
                      <a.icon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                      <span className="text-xs text-gaid-ink-2">{text(`authoring.kinds.${a.kind}`)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="flex flex-wrap items-center gap-x-4 gap-y-3" aria-labelledby="au-add">
                <h2 id="au-add" className="text-base font-semibold">{text("authoring.addHeading")}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline"><UploadIcon data-icon="inline-start" />{text("authoring.upload")}</Button>
                  <Button variant="outline"><GlobeIcon data-icon="inline-start" />{text("authoring.web")}</Button>
                  <Button variant="outline" aria-pressed className="border-transparent bg-gaid-signal-tint text-gaid-signal-ink hover:bg-gaid-signal-tint">
                    <BookOpenIcon data-icon="inline-start" />
                    {text("authoring.fromLibrary")}
                  </Button>
                </div>
              </section>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gaid-edge px-8 py-3">
            <Button variant="outline" disabled>{text("authoring.back")}</Button>
            <Button variant="outline">{text("authoring.next")}<ArrowRightIcon data-icon="inline-end" /></Button>
          </div>
        </main>
        <aside aria-label={text("panel.pickTitle")} className="flex w-[440px] shrink-0 flex-col border-l border-gaid-frame bg-gaid-face">
          <PanelHeader>
            <BookOpenIcon className="size-4 text-gaid-ink-2" aria-hidden />
            <span className="text-sm font-semibold">{text("panel.pickTitle")}</span>
          </PanelHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <p className="text-sm text-gaid-ink-2">{text("panel.pickContext")}</p>
            <div className="flex items-center gap-2">
              <div className={SEG_TRACK} role="group" aria-label={text("panel.title")}>
                <button type="button" aria-pressed className={segItem(true, "h-7 text-xs")}>{text("library.papers", { count: PAPERS.length })}</button>
                <button type="button" aria-pressed={false} className={segItem(false, "h-7 text-xs")}>{text("library.notes", { count: NOTES.length })}</button>
              </div>
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
              <Input type="search" className="pl-9" aria-label={text("library.search")} placeholder={text("library.search")} />
            </div>
            <ul className="flex flex-col border-t border-gaid-frame">
              {PAPERS.filter((p) => p.id !== "a1").map((p) => (
                <li key={p.id}>
                  <button type="button" aria-pressed={picked.has(p.id)} className={cn("flex w-full gap-3 border-b border-gaid-edge px-2 py-2.5 text-left hover:bg-gaid-hover", picked.has(p.id) && "bg-gaid-signal-tint hover:bg-gaid-signal-tint")}>
                    <CheckBox checked={picked.has(p.id)} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-2 text-sm font-medium">{p.title}</span>
                      <span className="text-xs text-gaid-ink-2">{p.authors} · {p.year} · {p.journal}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gaid-edge px-4 py-3">
            <span className="text-sm text-gaid-ink-2 tabular-nums">{text("panel.selected", { count: picked.size })}</span>
            <span className="flex items-center gap-2">
              <Button variant="link" size="sm" className="h-auto px-0">{text("panel.openFull")}</Button>
              <Button>{text("panel.addSources", { count: picked.size })}</Button>
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
