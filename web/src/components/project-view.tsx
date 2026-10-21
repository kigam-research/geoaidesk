"use client";
import { geoText, geoLocale } from "@/geo/i18n";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SettingsDialog } from "@/components/lazy-surfaces";
import { ProjectCreateDialog } from "@/components/project-create-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PROJECT_ID, type Project } from "@/lib/projects";
import type { ProjectActivitySummary } from "@/lib/project-activity";
import { onOpenSettings, type OpenSettingsRequest } from "@/lib/settings-nav";
import { useProjects } from "@/lib/use-projects";
import { GaidHubEntry, GaidTopNav } from "@/geo/hub/top-nav";
import { LibraryScreen } from "@/geo/library/library-screen";
import { ResearchTabs, useResearchTab } from "@/geo/library/research-tabs";
import { cn } from "@/lib/utils";
import { APP_VERSION, isVersioned } from "@/lib/version";

const appText = geoText("app");

interface ProjectViewProps {
  onOpenProject: (projectId: string) => void;
  projectActivities?: Readonly<Record<string, ProjectActivitySummary>>;
  /** False while hidden behind a workspace; gates the Settings deep-link listener. */
  isActive?: boolean;
  /** GAID: opens the GAID hub (header switch and entry card). */
  onOpenHub?: () => void;
}

type ProjectSort = "recent" | "name" | "status";

function projectActivityLabel(project: Project): string {
  const value = project.updatedAt || project.createdAt;
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return appText("projects.no_recent_activity");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (today.getTime() - then.getTime()) / 86_400_000,
  );
  if (dayDifference === 0) return appText("projects.updated_today");
  if (dayDifference === 1) return appText("projects.updated_yesterday");
  if (dayDifference > 1 && dayDifference < 7) {
    return appText("projects.updatedDays", { count: dayDifference });
  }
  return appText("projects.updatedDate", { date: new Intl.DateTimeFormat(geoLocale(), { month: "short", day: "numeric", year: "numeric" }).format(date) });
}

function projectActivityPriority(
  activity: ProjectActivitySummary | undefined,
): number {
  if (!activity) return 0;
  if (activity.needsInput > 0) return 5;
  if (activity.errors > 0) return 4;
  if (activity.blocked > 0) return 3;
  if (activity.running > 0) return 2;
  if (activity.done > 0) return 1;
  return 0;
}

function projectTimestamp(project: Project): number {
  const timestamp = Date.parse(project.updatedAt || project.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortProjects(
  projects: Project[],
  sort: ProjectSort,
  activities: Readonly<Record<string, ProjectActivitySummary>>,
): Project[] {
  return [...projects].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "status") {
      const priority =
        projectActivityPriority(activities[b.id]) -
        projectActivityPriority(activities[a.id]);
      if (priority !== 0) return priority;
    }
    return projectTimestamp(b) - projectTimestamp(a);
  });
}

function projectBudgetLabel(limit: number): string {
  return appText("projects.budget", { amount: new Intl.NumberFormat(geoLocale(), { style: "currency", currency: "USD", maximumFractionDigits: limit % 1 === 0 ? 0 : 2 }).format(limit) });
}

export function ProjectView({
  onOpenProject,
  projectActivities = {},
  isActive = true,
  onOpenHub,
}: ProjectViewProps) {
  const {
    projects,
    activeProjectId,
    loading,
    error,
    setActive,
    refresh,
    update,
    remove,
  } = useProjects();
  const { resolvedTheme, setTheme } = useTheme();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [mounted, setMounted] = useState(false);
  // GAID (gaid-research-hub): 내 연구 has a 프로젝트 / 서재 tab bar; 서재 replaces the project list below it.
  const [researchTab, setResearchTab] = useResearchTab();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequest, setSettingsRequest] = useState<OpenSettingsRequest | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Deep links into Settings while the Projects view is on screen.
  useEffect(() => {
    if (!isActive) return;
    return onOpenSettings((request) => {
      setSettingsRequest(request);
      setSettingsOpen(true);
    });
  }, [isActive]);

  const { visibleProjects, archivedProjects } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = query
      ? projects.filter((project) =>
          [
            project.name,
            project.description,
            project.id,
            ...project.tags,
          ].some((value) => value.toLowerCase().includes(query)),
        )
      : projects;
    return {
      visibleProjects: sortProjects(
        matching.filter((project) => !project.archived),
        sort,
        projectActivities,
      ),
      archivedProjects: sortProjects(
        matching.filter((project) => project.archived),
        sort,
        projectActivities,
      ),
    };
  }, [projectActivities, projects, search, sort]);
  const showArchived = archivedOpen || search.trim().length > 0;

  const openCreate = useCallback(() => setCreateOpen(true), []);

  // Editing lives in Settings → Project, aimed at this card's project.
  const openEdit = useCallback((project: Project) => {
    setSettingsRequest({ tab: "project", projectId: project.id });
    setSettingsOpen(true);
  }, []);

  const handleOpen = useCallback(
    (projectId: string) => {
      setActive(projectId);
      onOpenProject(projectId);
    },
    [onOpenProject, setActive],
  );

  const handleToggleArchive = useCallback(
    async (project: Project) => {
      try {
        await update(project.id, { archived: !project.archived });
      } catch (exc) {
        toast.error(
          exc instanceof Error ? exc.message : appText("projects.could_not_update_project"),
        );
      }
    },
    [update],
  );

  const handleDelete = useCallback(
    async (project: Project) => {
      if (project.id === DEFAULT_PROJECT_ID) return;
      const confirmed = await confirm({
        title: appText("projects.confirm.delete", { name: project.name }),
        description:
          appText("projects.its_sandbox_files_and_chats_will_be"),
        confirmLabel: appText("projects.delete_project"),
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await remove(project.id);
      } catch (exc) {
        toast.error(
          exc instanceof Error ? exc.message : appText("projects.could_not_delete_project"),
        );
      }
    },
    [confirm, remove],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-gaid-frame">
      {confirmDialog}
      <header className="relative flex h-14 items-center justify-between border-b border-gaid-line-strong bg-gaid-header px-6">
        <a
          href="https://github.com/kigam-research/geoaidesk"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={appText("header.productName")}
          className="flex items-center gap-2"
        >{/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gaid-compact-color.svg" alt="" width={73} height={24} className="h-6 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gaid-compact-on-dark.svg" alt="" width={73} height={24} className="hidden h-6 w-auto dark:block" />
          <span className="hidden text-sm font-semibold sm:inline">{appText("header.productName")}</span>
          {isVersioned && (
            <span className="text-xs text-muted-foreground">
              v{APP_VERSION}
            </span>
          )}
        </a>

        {onOpenHub && <GaidTopNav current="projects" className="absolute left-1/2 -translate-x-1/2" onNavigate={(place) => place === "hub" && onOpenHub()} />}

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={appText("projects.open_settings")}
            onClick={() => {
              setSettingsRequest(null);
              setSettingsOpen(true);
            }}
          >
            <SettingsIcon />
          </Button>
          {mounted && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                resolvedTheme === "dark"
                  ? appText("projects.switch_to_light_mode")
                  : appText("projects.switch_to_dark_mode")
              }
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
          )}
        </div>
      </header>

      {onOpenHub && <ResearchTabs value={researchTab} onChange={setResearchTab} />}
      {onOpenHub && researchTab === "library" && <LibraryScreen onOpenProject={handleOpen} />}
      <main className={cn("mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8", onOpenHub && researchTab === "library" && "hidden")}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-[960px] flex-col gap-2">
            <h1 className="text-xl font-semibold leading-snug">
              {appText("projects.choose_a_project")}</h1>
            <p className="text-sm leading-relaxed text-gaid-body">
              {appText("projects.each_project_keeps_its_files_chats_notebook")}</p>
          </div>
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            {appText("projects.new_project")}</Button>
        </div>

        {onOpenHub && <GaidHubEntry onOpen={onOpenHub} />}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="max-w-sm bg-background">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={appText("projects.search_projects")}
              placeholder={appText("projects.search_projects_2")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={appText("projects.clear_project_search")}
                  onClick={() => setSearch("")}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as ProjectSort)}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label={appText("projects.sort_projects")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="recent">{appText("projects.recent_activity")}</SelectItem>
                <SelectItem value="name">{appText("projects.project_name")}</SelectItem>
                <SelectItem value="status">{appText("projects.needs_attention")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{appText("projects.projects_could_not_be_loaded")}</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                {appText("projects.try_again")}</Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {appText("projects.loading_projects")}</div>
        ) : (
          <div className="flex flex-col gap-8">
            <ProjectSection
              title={appText("projects.projects")}
              projects={visibleProjects}
              projectActivities={projectActivities}
              activeProjectId={activeProjectId}
              onOpen={handleOpen}
              onEdit={openEdit}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
              emptyMessage={
                search.trim()
                  ? appText("projects.no_active_projects_match_your_search")
                  : appText("projects.create_your_first_project_to_start_researching")
              }
            />

            {archivedProjects.length > 0 && (
              <ProjectSection
                title={appText("projects.archived")}
                projects={archivedProjects}
                projectActivities={projectActivities}
                activeProjectId={activeProjectId}
                onOpen={handleOpen}
                onEdit={openEdit}
                onToggleArchive={handleToggleArchive}
                onDelete={handleDelete}
                collapsible
                open={showArchived}
                onOpenChange={setArchivedOpen}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        {appText("projects.all_project_data_stays_on_this_machine")}</footer>

      <ProjectCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => handleOpen(project.id)}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} request={settingsRequest} />
    </div>
  );
}

interface ProjectSectionProps {
  title: string;
  projects: Project[];
  projectActivities: Readonly<Record<string, ProjectActivitySummary>>;
  activeProjectId: string;
  emptyMessage?: string;
  onOpen: (projectId: string) => void;
  onEdit: (project: Project) => void;
  onToggleArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function ProjectSection({
  title,
  projects,
  projectActivities,
  activeProjectId,
  emptyMessage,
  onOpen,
  onEdit,
  onToggleArchive,
  onDelete,
  collapsible = false,
  open = true,
  onOpenChange,
}: ProjectSectionProps) {
  const content =
    projects.length === 0 ? (
      <div className="border-y px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage ?? appText("projects.no_projects")}
      </div>
    ) : (
      <div role="list" className="divide-y border-y border-border">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            activity={projectActivities[project.id]}
            active={project.id === activeProjectId}
            onOpen={() => onOpen(project.id)}
            onEdit={() => onEdit(project)}
            onToggleArchive={() => onToggleArchive(project)}
            onDelete={() => onDelete(project)}
          />
        ))}
      </div>
    );

  if (collapsible) {
    return (
      <section aria-labelledby={`${title}-heading`}>
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <h2 id={`${title}-heading`}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group -ml-3 text-muted-foreground"
                aria-label={appText("projects.archivedToggle", { state: open ? "hide" : "show", count: projects.length })}
              >
                <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
                <span className="text-sm font-semibold">
                  {title}
                </span>
                <Badge variant="secondary">{projects.length}</Badge>
              </Button>
            </CollapsibleTrigger>
          </h2>
          <CollapsibleContent className="pt-3">{content}</CollapsibleContent>
        </Collapsible>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`${title}-heading`}>
      <div className="flex items-center gap-3">
        <h2
          id={`${title}-heading`}
          className="text-sm font-semibold text-foreground"
        >
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{projects.length}</span>
      </div>
      {content}
    </section>
  );
}

interface ProjectRowProps {
  project: Project;
  activity?: ProjectActivitySummary;
  active: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function ProjectRow({
  project,
  activity,
  active,
  onOpen,
  onEdit,
  onToggleArchive,
  onDelete,
}: ProjectRowProps) {
  const visibleTagLimit = project.spendLimitUsd == null ? 3 : 2;

  return (
    <div role="listitem" className="group/project relative grid grid-cols-[minmax(0,1fr)_176px_32px] items-center gap-6 px-4 py-4 transition-colors hover:bg-accent/50">
      <button
        type="button"
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={appText("projects.openNamed", { name: project.name })}
        onClick={onOpen}
      />
      <div className="pointer-events-none min-w-0 space-y-1.5">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{project.name}</span>
          {active && <Badge variant="secondary">{appText("projects.current")}</Badge>}
        </div>
        {project.description && <p className="line-clamp-1 text-sm text-gaid-body">{project.description}</p>}
        {(project.tags.length > 0 || project.spendLimitUsd != null) && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {project.spendLimitUsd != null && <span>{projectBudgetLabel(project.spendLimitUsd)}</span>}
            {project.tags.slice(0, visibleTagLimit).map((tag) => <span key={tag}>{tag}</span>)}
            {project.tags.length > visibleTagLimit && <span>+{project.tags.length - visibleTagLimit}</span>}
          </div>
        )}
      </div>
      <div className="pointer-events-none flex flex-col items-start gap-1.5">
        {activity && <ProjectActivityBadges activity={activity} />}
        <span className="text-xs text-muted-foreground">{projectActivityLabel(project)}</span>
        <span className="flex items-center gap-1 text-xs font-medium text-gaid-link">
          {appText("projects.open")}<ArrowUpRightIcon className="size-3.5" />
        </span>
      </div>
      <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={appText("projects.actions", { name: project.name })}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onEdit}>
                  <SettingsIcon />
                  {appText("projects.project_settings")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleArchive}>
                  {project.archived ? (
                    <ArchiveRestoreIcon />
                  ) : (
                    <ArchiveIcon />
                  )}
                  {project.archived ? appText("projects.unarchive") : appText("projects.archive")}
                </DropdownMenuItem>
                {project.id !== DEFAULT_PROJECT_ID && (
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2Icon />
                    {appText("projects.delete")}</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  );
}

function ProjectActivityBadges({
  activity,
}: {
  activity: ProjectActivitySummary;
}) {
  const activeOrAttention =
    activity.running > 0 ||
    activity.needsInput > 0 ||
    activity.errors > 0 ||
    activity.blocked > 0;
  const items = [
    activity.needsInput > 0
      ? {
          key: "input",
          label:
            activity.needsInput === 1
              ? appText("projects.needs_your_input")
              : appText("projects.needsInput", { count: activity.needsInput }),
          className: "border-gaid-warning/30 bg-gaid-warning-bg text-gaid-warning",
        }
      : null,
    activity.errors > 0
      ? {
          key: "error",
          label: activity.errors === 1 ? appText("projects.error") : appText("projects.errors", { count: activity.errors }),
          className: "border-destructive/30 bg-destructive/10 text-destructive",
        }
      : null,
    activity.blocked > 0
      ? {
          key: "blocked",
          label: activity.blocked === 1 ? appText("projects.blocked") : appText("projects.blockedCount", { count: activity.blocked }),
          className: "border-gaid-warning/30 bg-gaid-warning-bg text-gaid-warning",
        }
      : null,
    activity.running > 0
      ? {
          key: "running",
          label: activity.running === 1 ? appText("projects.running") : appText("projects.runningCount", { count: activity.running }),
          className: "border-border bg-gaid-pending-bg text-muted-foreground",
        }
      : null,
    !activeOrAttention && activity.done > 0
      ? {
          key: "done",
          label: appText("projects.done"),
          className: "border-border bg-gaid-pending-bg text-muted-foreground",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={appText("projects.project_activity")}>
      {items.map((item, index) => (
        <Badge
          key={item.key}
          variant="outline"
          className={cn("gap-1.5", index === 0 ? item.className : "border-border bg-gaid-pending-bg text-muted-foreground")}
        >
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
