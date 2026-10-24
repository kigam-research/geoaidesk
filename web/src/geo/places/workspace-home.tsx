"use client";
/**
 * GAID Workspace home (ADR 2026-10-24 gaid-connect-workspace; mockup reports/2026-10-24-gaid-ia-connect-workspace fig. 1):
 * a sidebar (홈, 프로젝트, 설치한 Workflow, recent projects, 보관한 프로젝트) beside the selected view. 홈 shows what the
 * researcher can continue across projects, recent projects and installed Workflows, with one primary action (분석 시작).
 * The project list and the archived list are the existing project-view content, passed in as `projectsView`/`archivedView`.
 */
import { ArchiveIcon, ChevronRightIcon, FolderIcon, HomeIcon, PackageIcon, PlayIcon, PlusIcon, WaypointsIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkspaceHomeRecent, WorkspaceHomeWorkflow } from "@/geo/contracts/workspace-home";
import { openMethodSetup } from "@/geo/hub/handoff";
import { geoLocale, geoText } from "@/geo/i18n";
import { requestOpenResearchNote } from "@/geo/notes/open-note";
import { PageBody, PageHeader } from "@/geo/shell/page-header";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import type { Project } from "@/lib/projects";
import type { ProjectActivitySummary } from "@/lib/project-activity";
import { cn } from "@/lib/utils";

import { useWorkspaceHome } from "./api";
import { requestWorkspaceOpen } from "./navigation";

const text = geoText("places");

export type WorkspaceSection = "home" | "projects" | "workflows" | "archived";

const CHIP = "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold";
const SIDEBAR = "flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3";

/** "3시간 전" / "어제" style time of a recent entry. */
export function relativeWhen(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const format = new Intl.RelativeTimeFormat(geoLocale(), { numeric: "auto" });
  const minutes = Math.round((then - now) / 60_000);
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

function StateChip({ entry }: { entry: WorkspaceHomeRecent }) {
  switch (entry.state) {
    case "running":
      return (
        <span className={cn(CHIP, "bg-gaid-signal-tint text-gaid-signal-ink")}>
          <span className="gaid-orbit" aria-hidden />
          {text("home.continue.running")}
        </span>
      );
    case "decisions":
      return <span className={cn(CHIP, "bg-gaid-warning-tint text-gaid-warning tabular-nums")}>{text("home.continue.decisions", { count: entry.decisions })}</span>;
    case "checked":
      return <span className={cn(CHIP, "bg-gaid-success-tint text-gaid-success")}>{text("home.continue.checked")}</span>;
    case "unreviewed":
      return <span className={cn(CHIP, "border border-gaid-edge text-gaid-ink-2")}>{text("home.continue.unreviewed")}</span>;
    default:
      return <span className={cn(CHIP, "text-gaid-ink-2")}>{text("home.continue.chat")}</span>;
  }
}

function SectionHead({ id, title, trailing }: { id: string; title: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      {trailing}
    </div>
  );
}

function SourceTag({ workflow }: { workflow: WorkspaceHomeWorkflow }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-gaid-edge px-1.5 py-0.5 text-xs font-medium text-gaid-ink-2">
      {text(`home.workflows.${workflow.source}`)}
      {workflow.version && <span className="tabular-nums">{workflow.version}</span>}
    </span>
  );
}

function WorkflowRows({ workflows, onStart }: { workflows: WorkspaceHomeWorkflow[]; onStart: (w: WorkspaceHomeWorkflow) => void }) {
  return (
    <ul className="border-t border-gaid-frame">
      {workflows.map((w) => (
        <li key={`${w.source}:${w.id}`} className="flex min-h-14 items-center gap-3 border-b border-gaid-edge px-3 py-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold" title={w.title}>{w.title}</span>
            <span className="truncate text-sm text-gaid-ink-2" title={w.line}>
              {w.line || text("home.workflows.projects", { count: w.projects.length })}
            </span>
          </span>
          <SourceTag workflow={w} />
          <span className={cn(CHIP, w.ready ? "bg-gaid-success-tint text-gaid-success" : "bg-gaid-warning-tint text-gaid-warning")}>
            {text(w.ready ? "home.workflows.ready" : "home.workflows.notReady")}
          </span>
          <Button variant="ghost" size="sm" aria-label={text("home.workflows.startLabel", { title: w.title })} onClick={() => onStart(w)}>
            {text("home.workflows.start")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Choosing the project for 분석 시작 or for a Workflow installed in several projects. */
function ProjectPicker({
  open,
  title,
  projects,
  onPick,
  onCreate,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  projects: { id: string; name: string }[];
  onPick: (projectId: string) => void;
  onCreate?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{text("home.pick.context")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] overflow-y-auto border-t border-gaid-frame">
          {projects.map((p) => (
            <li key={p.id} className="border-b border-gaid-edge">
              <button
                type="button"
                onClick={() => onPick(p.id)}
                className="flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring"
              >
                <FolderIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <ChevronRightIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{text("home.pick.cancel")}</Button>
          {onCreate && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onCreate();
              }}
            >
              <PlusIcon data-icon="inline-start" />
              {text("home.pick.new")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceHome({
  isActive,
  projects,
  projectActivities,
  projectLine,
  onOpenProject,
  onCreateProject,
  onOpenConnect,
  projectsView,
  archivedView,
  projectsActions,
}: {
  isActive: boolean;
  projects: Project[];
  projectActivities: Readonly<Record<string, ProjectActivitySummary>>;
  /** One line under a project name (e.g. "오늘 수정"). */
  projectLine: (project: Project) => string;
  onOpenProject: (projectId: string) => void;
  onCreateProject: () => void;
  onOpenConnect?: () => void;
  /** The full project list (search, sort, cards). */
  projectsView: ReactNode;
  /** The archived projects. */
  archivedView: ReactNode;
  /** Header actions of the project list view. */
  projectsActions?: ReactNode;
}) {
  const [section, setSection] = useState<WorkspaceSection>("home");
  const { data, error } = useWorkspaceHome(isActive && section !== "projects" && section !== "archived");
  const [picker, setPicker] = useState<{ title: string; projects: { id: string; name: string }[]; onPick: (id: string) => void; create: boolean } | null>(null);

  const active = useMemo(
    () =>
      projects
        .filter((p) => !p.archived)
        .slice()
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
    [projects],
  );
  const archivedCount = projects.length - active.length;
  const running = (id: string) => (projectActivities[id]?.running ?? 0) > 0;

  const openRecent = (entry: WorkspaceHomeRecent) => {
    // A chat opens in a tab; a research note opens in its project's notebook tab (the same request as from 서재).
    if (entry.kind === "chat") requestWorkspaceOpen({ projectId: entry.projectId, sessionId: entry.id, title: entry.title });
    else requestOpenResearchNote({ projectId: entry.projectId, noteId: entry.id });
    onOpenProject(entry.projectId);
  };

  const startWorkflowIn = (workflow: WorkspaceHomeWorkflow, projectId: string) => {
    setPicker(null);
    if (workflow.source !== "catalogue") openMethodSetup({ projectId, methodKey: workflow.id, workflowId: null, recipeId: null });
    else requestWorkspaceOpen({ projectId, workflows: true });
    onOpenProject(projectId);
  };
  const startWorkflow = (workflow: WorkspaceHomeWorkflow) => {
    if (workflow.projects.length === 1) startWorkflowIn(workflow, workflow.projects[0].id);
    else
      setPicker({
        title: text("home.pick.workflowTitle"),
        projects: workflow.projects,
        onPick: (id) => startWorkflowIn(workflow, id),
        create: false,
      });
  };
  const startAnalysis = () =>
    setPicker({
      title: text("home.pick.title"),
      projects: active.map((p) => ({ id: p.id, name: p.name })),
      onPick: (id) => {
        setPicker(null);
        requestWorkspaceOpen({ projectId: id, workflows: true });
        onOpenProject(id);
      },
      create: true,
    });

  const findInConnect = onOpenConnect && (
    <Button variant="link" size="sm" className="h-auto px-0" onClick={onOpenConnect}>
      <WaypointsIcon data-icon="inline-start" />
      {text("home.workflows.find")}
    </Button>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <nav aria-label={text("home.nav")} className={SIDEBAR}>
        <SidebarGroup>
          <SidebarItem icon={HomeIcon} label={text("home.side.home")} selected={section === "home"} onClick={() => setSection("home")} />
          <SidebarItem icon={FolderIcon} label={text("home.side.projects")} count={active.length} selected={section === "projects"} onClick={() => setSection("projects")} />
          <SidebarItem
            icon={PackageIcon}
            label={text("home.side.workflows")}
            count={data ? data.workflows.length : undefined}
            selected={section === "workflows"}
            onClick={() => setSection("workflows")}
          />
        </SidebarGroup>
        {active.length > 0 && (
          <SidebarGroup title={text("home.side.recent")}>
            {active.slice(0, 3).map((p) => (
              <SidebarItem key={p.id} icon={FolderIcon} label={p.name} title={p.name} onClick={() => onOpenProject(p.id)}>
                {running(p.id) && <span className="gaid-orbit" aria-hidden />}
              </SidebarItem>
            ))}
          </SidebarGroup>
        )}
        {archivedCount > 0 && (
          <SidebarGroup>
            <SidebarItem icon={ArchiveIcon} label={text("home.side.archived")} count={archivedCount} selected={section === "archived"} onClick={() => setSection("archived")} />
          </SidebarGroup>
        )}
      </nav>

      {section === "home" && (
        <PageBody labelledBy="ws-home-title" className="gap-8">
          <PageHeader
            titleId="ws-home-title"
            title={text("home.title")}
            context={text("home.context")}
            actions={
              <>
                <Button variant="outline" onClick={onCreateProject}>
                  <PlusIcon data-icon="inline-start" />
                  {text("home.newProject")}
                </Button>
                <Button onClick={startAnalysis} disabled={active.length === 0}>
                  <PlayIcon data-icon="inline-start" />
                  {text("home.start")}
                </Button>
              </>
            }
          />

          <section className="flex flex-col gap-3" aria-labelledby="ws-continue">
            <SectionHead id="ws-continue" title={text("home.continue.heading")} />
            {error ? (
              <p className="text-sm text-gaid-ink-2">{text("home.continue.error")}</p>
            ) : data && data.recent.length === 0 ? (
              <p className="text-sm text-gaid-ink-2">{text("home.continue.empty")}</p>
            ) : (
              <ul className="border-t border-gaid-frame" aria-busy={!data}>
                {(data?.recent ?? []).map((entry) => (
                  <li key={`${entry.kind}:${entry.projectId}:${entry.id}`} className="border-b border-gaid-edge">
                    <button
                      type="button"
                      aria-label={text("home.continue.open", { title: entry.title })}
                      onClick={() => openRecent(entry)}
                      className="flex min-h-14 w-full items-center gap-4 px-3 py-2 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="flex w-24 shrink-0"><StateChip entry={entry} /></span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{entry.title}</span>
                        <span className="truncate text-sm text-gaid-ink-2">
                          {[entry.projectName, entry.workflow && `Workflow ${entry.workflow.title}${entry.workflow.version ? ` ${entry.workflow.version}` : ""}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm text-gaid-ink-2">{relativeWhen(entry.updatedAt)}</span>
                      <ChevronRightIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data && data.unreadableProjects > 0 && (
              <p className="text-xs text-gaid-ink-2">{text("home.continue.partial", { count: data.unreadableProjects })}</p>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="flex flex-col gap-3" aria-labelledby="ws-projects">
              <SectionHead
                id="ws-projects"
                title={text("home.projects.heading")}
                trailing={
                  <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setSection("projects")}>
                    {text("home.projects.all", { count: active.length })}
                  </Button>
                }
              />
              <ul className="border-t border-gaid-frame">
                {active.slice(0, 5).map((p) => (
                  <li key={p.id} className="border-b border-gaid-edge">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <FolderIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{p.name}</span>
                        <span className="truncate text-sm text-gaid-ink-2">{p.description || projectLine(p)}</span>
                      </span>
                      {running(p.id) && <span className="gaid-orbit" aria-hidden />}
                      {p.description && <span className="shrink-0 text-sm text-gaid-ink-2">{projectLine(p)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="ws-workflows">
              <SectionHead id="ws-workflows" title={text("home.workflows.heading")} trailing={findInConnect} />
              {data && data.workflows.length === 0 ? (
                <p className="text-sm text-gaid-ink-2">{text("home.workflows.empty")}</p>
              ) : (
                <WorkflowRows workflows={(data?.workflows ?? []).slice(0, 5)} onStart={startWorkflow} />
              )}
            </section>
          </div>
        </PageBody>
      )}

      {section === "workflows" && (
        <PageBody labelledBy="ws-workflows-title" className="gap-6">
          <PageHeader titleId="ws-workflows-title" title={text("home.side.workflows")} actions={findInConnect} />
          {data && data.workflows.length === 0 ? (
            <p className="text-sm text-gaid-ink-2">{text("home.workflows.empty")}</p>
          ) : (
            <WorkflowRows workflows={data?.workflows ?? []} onStart={startWorkflow} />
          )}
        </PageBody>
      )}

      {section === "projects" && (
        <PageBody labelledBy="ws-projects-title" className="gap-6">
          <PageHeader titleId="ws-projects-title" title={text("home.side.projects")} actions={projectsActions} />
          {projectsView}
        </PageBody>
      )}

      {section === "archived" && (
        <PageBody labelledBy="ws-archived-title" className="gap-6">
          <PageHeader titleId="ws-archived-title" title={text("home.side.archived")} />
          {archivedView}
        </PageBody>
      )}

      <ProjectPicker
        open={picker !== null}
        title={picker?.title ?? ""}
        projects={picker?.projects ?? []}
        onPick={(id) => picker?.onPick(id)}
        onCreate={picker?.create ? onCreateProject : undefined}
        onOpenChange={(open) => !open && setPicker(null)}
      />
    </div>
  );
}
