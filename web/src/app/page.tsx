"use client";

import { REMOTE_COMPUTE_ENABLED } from "@/geo/features";
import { geoText } from "@/geo/i18n";
import { FileTreePanel } from "@/components/sandbox-panel";
import { FilePreviewPanel, SettingsDialog, WorkflowsPanel } from "@/components/lazy-surfaces";
import type { Model } from "@/components/model-selector";
import { ChatTab, type ChatTabHandle, type ChatTabMeta } from "@/components/chat-tab";
import { ChatTabsBar, type ChatTabDescriptor } from "@/components/chat-tabs-bar";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ProjectView } from "@/components/project-view";
import { SessionCostPill } from "@/components/session-cost-pill";
import { useSessionCost } from "@/lib/use-session-cost";
import { useProjectCost } from "@/lib/use-project-cost";
import { useProjectActivities } from "@/lib/use-project-activities";
import { useModalJobs } from "@/lib/use-modal-jobs";
import { useProjects } from "@/lib/use-projects";
import { useUpdateCheck } from "@/lib/version";
import { useSkills } from "@/lib/use-skills";
import { flattenFiles, flattenFolders, useSandbox } from "@/lib/use-sandbox";
import { ProjectScopeProvider } from "@/lib/projects";
import {
  hasProjectActivity,
  sameProjectActivity,
  summarizeProjectActivity,
  type ProjectActivitySummary,
} from "@/lib/project-activity";
import { onChatPrefill } from "@/lib/chat-prefill";
import { onOpenSettings, type OpenSettingsRequest } from "@/lib/settings-nav";
import {
  OPEN_MODAL_JOB_EVENT,
  type ModalComputeScope,
} from "@/lib/modal-jobs";
import { isJunkFilePath } from "@/lib/utils";
import {
  PanelLeftIcon,
  PanelRightIcon,
  SettingsIcon,
  ServerCogIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  deletePersistedChatState,
  flushServerProjectWorkspaceState,
  loadServerProjectWorkspaceState,
  loadWorkspaceSnapshot,
  pruneDeletedProjectState,
  revokeProjectObjectUrls,
  revokeSnapshotObjectUrls,
  saveProjectWorkspaceState,
  saveWorkspaceShellState,
  type ChatWorkspaceState,
  type ProjectWorkspaceState,
  type SandboxWorkspaceState,
  type WorkspaceScreen,
} from "@/lib/workspace-persistence";
import { seedChatStateFromTab } from "@/lib/new-tab-state";
import { onStartGeoTask } from "@/geo/workspace/events";
import { geoTaskChatState } from "@/geo/workspace/tab-state";
import { GeoTaskCatalogue } from "@/geo/workspace/task-catalogue";
import { GaidHub } from "@/geo/hub/hub-screen";
import { useHubLocation } from "@/geo/hub/location";
import { hasMethodSetup, onMethodSetupRequest } from "@/geo/hub/handoff";
import { onOpenResearchNoteRequest, takeOpenResearchNote } from "@/geo/notes/open-note";
import { CitationPdfContext } from "@/geo/library/citation-links";
import { CitationPdfPane, useCitationPdf } from "@/geo/library/citation-pdf";
import { GaidAppBar } from "@/geo/shell/app-bar";
import { SystemResourcesButton } from "@/geo/shell/system-resources";
import { focusSearchTarget, shortcutLabel, useShortcut } from "@/geo/shell/shortcuts";
import { Button } from "@/components/ui/button";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const appText = geoText("app");
const libraryText = geoText("library");

const MAX_CHAT_TABS = 10;

/**
 * Sent by the sandbox "Auto-organize files" wand. Moving a data file silently
 * breaks every script that read it by relative path, so the prompt makes the
 * agent plan first, never delete, and fix references it moved out from under.
 */
const ORGANIZE_FILES_PROMPT =
  "Organize the files in the sandbox into a clear folder structure (for example raw data, scripts, figures, results, notebooks). " +
  "First list the moves you intend to make, then carry them out. Do not delete anything, and leave dotfiles, config, lock files, and virtual environments in place. " +
  "After moving, update relative paths in any scripts, notebooks, or documents that referenced the moved files, and finish with a short summary of what moved where.";

interface ChatTabEntry {
  id: string;
  title: string;
  /** Stored session reopened into this tab (History menu), if any. */
  sessionId?: string;
}

/** Stable id for the first tab so SSR and hydration match. */
const INITIAL_TAB_ID = "tab-initial";

function makeTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTabTitle(index: number): string {
  return appText("chat.tabs.numbered", { count: index + 1 });
}

// Pane sizes (UI guide v2 L2): sidebar 272 (220–360), inspector 440 (360–640). Saved widths outside the range are clamped.
const TREE_WIDTH = { min: 220, max: 360, initial: 272 } as const;
const CHAT_WIDTH = { min: 360, max: 640, initial: 440 } as const;
const clampWidth = (value: number, range: { min: number; max: number }) => Math.max(range.min, Math.min(range.max, Math.round(value)));
/** Arrow keys move a pane border by 16 px (Shift: 64 px); Home and End go to the limits. */
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

/**
 * Thin vertical pane border (UI guide v2 L2, A4): 1 px line with an 8 px drag target, focusable as a separator and
 * resizable from the keyboard. `grows` says which arrow widens the pane it sizes.
 */
function ResizeHandle({ label, value, range, grows, onMouseDown, onResize }: {
  label: string;
  value: number;
  range: { min: number; max: number };
  grows: "right" | "left";
  onMouseDown: (e: React.MouseEvent) => void;
  onResize: (width: number) => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const sign = grows === "right" ? 1 : -1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = value + sign * step;
    else if (event.key === "ArrowLeft") next = value - sign * step;
    else if (event.key === "Home") next = range.min;
    else if (event.key === "End") next = range.max;
    if (next === null) return;
    event.preventDefault();
    onResize(clampWidth(next, range));
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      tabIndex={0}
      title={label}
      className="group relative z-10 flex w-px shrink-0 cursor-col-resize items-center justify-center bg-gaid-frame transition-colors before:absolute before:inset-y-0 before:-left-1 before:-right-1 hover:bg-gaid-signal active:bg-gaid-signal focus-visible:bg-gaid-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
    >
    </div>
  );
}

export default function HomePage() {
  const [screen, setScreen] = useState<WorkspaceScreen>("projects");
  // GAID hub: a third place of this page (URL hash), shown over the project list/workspace.
  const [hub, setHub] = useHubLocation();
  const [openedProjectIds, setOpenedProjectIds] = useState<string[]>([]);
  const [restoredProjects, setRestoredProjects] = useState<
    Record<string, ProjectWorkspaceState>
  >({});
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [projectDirectoryHydrated, setProjectDirectoryHydrated] = useState(false);
  const [projectActivities, setProjectActivities] = useState<
    Record<string, ProjectActivitySummary>
  >({});
  const {
    activeProjectId,
    projects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects();
  const serverProjectActivities = useProjectActivities(
    workspaceHydrated && screen === "projects",
  );
  const displayedProjectActivities = useMemo(
    () => ({ ...serverProjectActivities, ...projectActivities }),
    [projectActivities, serverProjectActivities],
  );

  useEffect(() => {
    if (!projectsLoading) setProjectDirectoryHydrated(true);
  }, [projectsLoading]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspaceSnapshot().then((snapshot) => {
      if (cancelled) {
        // Nothing will consume (or revoke) the restored attachment blob URLs.
        revokeSnapshotObjectUrls(snapshot);
        return;
      }
      setRestoredProjects(snapshot.projects);
      // Always start in the project overview. A project's saved workspace is
      // restored lazily only after the user chooses that project.
      setWorkspaceHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // gaid-project-resume: a project's workspace mounts once its last state was
  // read from the GAID server (any PC or browser saves it there); without a
  // server record the browser's own copy is used and uploaded by the next save.
  const [serverStateChecked, setServerStateChecked] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const serverStateRequested = useRef(new Set<string>());
  useEffect(() => {
    if (!workspaceHydrated) return;
    for (const projectId of openedProjectIds) {
      if (serverStateRequested.current.has(projectId)) continue;
      serverStateRequested.current.add(projectId);
      void loadServerProjectWorkspaceState(projectId).then((state) => {
        if (state) {
          setRestoredProjects((prev) => {
            const previous = prev[projectId];
            if (previous) revokeProjectObjectUrls(previous);
            return { ...prev, [projectId]: state };
          });
        }
        setServerStateChecked((prev) => new Set(prev).add(projectId));
      });
    }
  }, [openedProjectIds, workspaceHydrated]);

  const rememberProject = useCallback((projectId: string) => {
    setOpenedProjectIds((prev) => (
      prev.includes(projectId) ? prev : [...prev, projectId]
    ));
  }, []);

  const openProject = useCallback((projectId: string) => {
    rememberProject(projectId);
    setScreen("workspace");
  }, [rememberProject]);

  const handleProjectActivityChange = useCallback(
    (projectId: string, activity: ProjectActivitySummary) => {
      setProjectActivities((prev) => {
        const existing = prev[projectId];
        if (!hasProjectActivity(activity)) {
          if (!existing) return prev;
          const next = { ...prev };
          delete next[projectId];
          return next;
        }
        if (sameProjectActivity(existing, activity)) return prev;
        return { ...prev, [projectId]: activity };
      });
    },
    [],
  );

  // ProjectSwitcher changes the global selection from inside the currently
  // visible workspace. Mount the destination workspace without unmounting the
  // source, so any live SSE stream in the source keeps running.
  useEffect(() => {
    if (workspaceHydrated && screen === "workspace") rememberProject(activeProjectId);
  }, [activeProjectId, rememberProject, screen, workspaceHydrated]);

  // A deleted project must release its mounted workspace and persisted shell
  // state. The DELETE endpoint explicitly aborts its server-owned runs first;
  // this unmount only disconnects browser-side event observers.
  useEffect(() => {
    if (projectsLoading || !workspaceHydrated) return;
    // A failed or empty list is not "every project was deleted". On a fetch
    // error `projects` keeps its initial [] with loading=false, and the server
    // always has at least the default project, so pruning against an empty
    // set would wipe every project's persisted workspace on a backend blip.
    if (projectsError || projects.length === 0) return;
    const existing = new Set(projects.map((project) => project.id));
    setOpenedProjectIds((prev) => {
      const next = prev.filter((id) => existing.has(id));
      return next.length === prev.length ? prev : next;
    });
    setProjectActivities((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id]) => existing.has(id)),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setRestoredProjects((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([id]) => existing.has(id)),
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    void pruneDeletedProjectState(existing);
  }, [projects, projectsError, projectsLoading, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    const timer = window.setTimeout(() => {
      void saveWorkspaceShellState(screen, openedProjectIds);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [openedProjectIds, screen, workspaceHydrated]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    const flush = () => {
      void saveWorkspaceShellState(screen, openedProjectIds);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [openedProjectIds, screen, workspaceHydrated]);

  // ⌘K / Ctrl K on the hub and the project list focuses their search field (UI guide v2 N6); the workspace has its own.
  useShortcut("search", () => focusSearchTarget(), hub.open || screen === "projects");

  return (
    <>
      {hub.open && (
        <GaidHub
          authoringId={hub.projectId}
          entryId={hub.entryId ?? null}
          catalogueId={hub.catalogueId ?? null}
          skills={hub.skills}
          feeds={hub.feeds}
          removed={hub.removed}
          skillId={hub.skillId}
          onNavigate={(next) => setHub(next)}
          onOpenProjects={() => {
            setHub({ open: false, projectId: null });
            setScreen("projects");
          }}
          onOpenProject={(projectId) => {
            setHub({ open: false, projectId: null });
            openProject(projectId);
          }}
        />
      )}
      <div
        className={!hub.open && screen === "projects" ? "contents" : "hidden"}
        aria-hidden={hub.open || screen !== "projects"}
      >
        <ProjectView
          isActive={!hub.open && screen === "projects"}
          onOpenProject={openProject}
          projectActivities={displayedProjectActivities}
          onOpenHub={() => setHub({ open: true, projectId: null })}
        />
      </div>
      {projectDirectoryHydrated && openedProjectIds.map((projectId) => {
        if (!serverStateChecked.has(projectId)) return null;
        const isActive = !hub.open && screen === "workspace" && projectId === activeProjectId;
        return (
          <ProjectScopeProvider key={projectId} value={projectId}>
            <div className={isActive ? "contents" : "hidden"} aria-hidden={!isActive}>
              <WorkspacePage
                projectId={projectId}
                isActive={isActive}
                hydrated={workspaceHydrated}
                initialState={restoredProjects[projectId]}
                onProjectActivityChange={handleProjectActivityChange}
                onOpenProjectView={() => setScreen("projects")}
                onOpenHub={() => setHub({ open: true, projectId: null })}
              />
            </div>
          </ProjectScopeProvider>
        );
      })}
    </>
  );
}

function WorkspacePage({
  projectId,
  isActive,
  hydrated,
  initialState,
  onProjectActivityChange,
  onOpenProjectView,
  onOpenHub,
}: {
  projectId: string;
  isActive: boolean;
  hydrated: boolean;
  initialState?: ProjectWorkspaceState;
  onProjectActivityChange: (
    projectId: string,
    activity: ProjectActivitySummary,
  ) => void;
  onOpenProjectView: () => void;
  /** GeoAIDesk: the same 내 연구 / GAID 허브 switch as the project list (gaid-system-ui, novice review). */
  onOpenHub?: () => void;
}) {
  const [sandboxWorkspace, setSandboxWorkspace] = useState<SandboxWorkspaceState>(
    () => initialState?.sandbox ?? { openPaths: [], activePath: null },
  );
  const handleSandboxWorkspaceChange = useCallback((next: SandboxWorkspaceState) => {
    setSandboxWorkspace((current) =>
      current.activePath === next.activePath &&
      current.openPaths.length === next.openPaths.length &&
      current.openPaths.every((path, index) => path === next.openPaths[index])
        ? current
        : next,
    );
  }, []);
  const sandbox = useSandbox(
    isActive,
    undefined,
    initialState?.sandbox,
    handleSandboxWorkspaceChange,
  );
  const { updateAvailable } = useUpdateCheck();
  const { skills: allSkills, loading: skillsLoading } = useSkills();
  const { projects: projectDirectory } = useProjects();
  const [sandboxOpen, setSandboxOpen] = useState(
    () => initialState?.sandboxOpen ?? true,
  );
  const [chatOpen, setChatOpen] = useState(
    () => initialState?.chatOpen ?? true,
  );
  const toggleSandbox = useCallback(() => setSandboxOpen((value) => !value), []);
  const toggleChat = useCallback(() => setChatOpen((value) => !value), []);
  // UI guide v2 N2, N6: ⌘\ / Ctrl \ hides or shows the file list; ⌘K / Ctrl K focuses its filter, opening it first.
  const workspaceRef = useRef<HTMLDivElement>(null);
  useShortcut("sidebar", toggleSandbox, isActive);
  useShortcut("search", () => {
    if (sandboxOpen && workspaceRef.current && focusSearchTarget(workspaceRef.current)) return;
    setSandboxOpen(true);
    // The filter mounts with the list: focus it once the list is drawn.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (workspaceRef.current) focusSearchTarget(workspaceRef.current); }));
  }, isActive);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequest, setSettingsRequest] = useState<OpenSettingsRequest | null>(null);
  const [showNotebook, setShowNotebook] = useState(
    () => initialState?.showNotebook ?? false,
  );
  const [showAutomation, setShowAutomation] = useState(
    () => initialState?.showAutomation ?? false,
  );
  const [showCompute, setShowCompute] = useState(
    () => REMOTE_COMPUTE_ENABLED && (initialState?.showCompute ?? false),
  );
  const [computeScope, setComputeScope] = useState<ModalComputeScope>(
    () => initialState?.computeScope ?? "project",
  );

  // Chat tab management. We allocate the initial id once via useRef so it
  // stays stable across React's strict-mode double-invocation of
  // useState's lazy initializer (which would otherwise mint two different
  // ids — one for the tabs array and one for activeTabId).
  const initialTabId = INITIAL_TAB_ID;
  const [tabs, setTabs] = useState<ChatTabEntry[]>(() =>
    initialState?.tabs.length
      ? initialState.tabs.map(({ id, title, sessionId }) => ({ id, title, sessionId }))
      : [{ id: initialTabId, title: defaultTabTitle(0) }],
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    () => initialState?.activeTabId ?? initialTabId,
  );
  const [view, setView] = useState<"chat" | "workflows">(
    () => initialState?.view ?? "chat",
  );
  const [tabWorkspaceStates, setTabWorkspaceStates] = useState<
    Record<string, ChatWorkspaceState>
  >(() =>
    Object.fromEntries(
      (initialState?.tabs ?? []).flatMap((tab) =>
        tab.chat ? [[tab.id, tab.chat] as const] : [],
      ),
    ),
  );
  // Mirror of tabs in a ref so synchronous handlers can read length without
  // putting impure logic inside a setState updater (which strict mode runs
  // twice for purity testing).
  const tabsRef = useRef(tabs);
  // Same ref trick for what newTab seeds a fresh tab from; both change often
  // and neither should re-create the callback.
  const tabWorkspaceStatesRef = useRef(tabWorkspaceStates);
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  useEffect(() => {
    tabWorkspaceStatesRef.current = tabWorkspaceStates;
  }, [tabWorkspaceStates]);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Per-tab agent meta, populated by each <ChatTab> via onMetaChange. We
  // read from this to drive the cost pill and tab
  // strip badges (streaming spinner, message count) for the active tab.
  const [tabsMeta, setTabsMeta] = useState<Record<string, ChatTabMeta>>({});
  const tabHandles = useRef<Map<string, ChatTabHandle | null>>(new Map());
  // Stable per-tab ref callbacks so React doesn't repeatedly clear+set the
  // tab handle map on every render (inline `ref={(h) => ...}` would).
  const tabRefCallbacks = useRef<
    Map<string, (handle: ChatTabHandle | null) => void>
  >(new Map());
  const getTabRefCallback = useCallback(
    (id: string) => {
      let cb = tabRefCallbacks.current.get(id);
      if (!cb) {
        cb = (handle: ChatTabHandle | null) => {
          if (handle) tabHandles.current.set(id, handle);
          else tabHandles.current.delete(id);
        };
        tabRefCallbacks.current.set(id, cb);
      }
      return cb;
    },
    [],
  );

  // Bumped whenever any chat tab finishes a turn, so the cost pill (which
  // tracks the active tab's session) refetches.
  const [costRefreshKey, setCostRefreshKey] = useState(0);

  const handleMetaChange = useCallback(
    (tabId: string, meta: ChatTabMeta) => {
      if (meta.sessionId) {
        setTabs((current) => {
          if (!current.some((tab) => tab.id === tabId && tab.sessionId !== meta.sessionId)) {
            return current;
          }
          return current.map((tab) =>
            tab.id === tabId && tab.sessionId !== meta.sessionId
              ? { ...tab, sessionId: meta.sessionId ?? undefined }
              : tab,
          );
        });
      }
      setTabsMeta((prev) => {
        const existing = prev[tabId];
        // Token deltas stay local to ChatTab. Only workspace-visible state
        // crosses this boundary; notebook-only updates must still propagate.
        if (
          existing &&
          existing.sessionId === meta.sessionId &&
          existing.status === meta.status &&
          existing.runState === meta.runState &&
          existing.isStreaming === meta.isStreaming &&
          existing.userMessageCount === meta.userMessageCount &&
          existing.needsInput === meta.needsInput &&
          existing.notebookEntries === meta.notebookEntries &&
          existing.subagentCompletions === meta.subagentCompletions
        ) {
          return prev;
        }
        return { ...prev, [tabId]: meta };
      });
    },
    [],
  );

  const handleTabWorkspaceStateChange = useCallback(
    (tabId: string, state: ChatWorkspaceState) => {
      setTabWorkspaceStates((current) =>
        current[tabId] === state ? current : { ...current, [tabId]: state },
      );
    },
    [],
  );

  const handleTurnComplete = useCallback(() => {
    setCostRefreshKey((k) => k + 1);
  }, []);

  // Pull out the two sandbox functions we re-trigger on turn completion.
  // Destructuring keeps the deps stable below — useSandbox returns a new
  // object literal each render, so depending on `sandbox` directly would
  // make `handleSandboxRefresh` change identity every render.
  const {
    fetchTree: sandboxFetchTree,
    refreshOpenTabs: sandboxRefreshOpenTabs,
    selectFile: sandboxSelectFile,
  } = sandbox;
  const handleSandboxRefresh = useCallback(() => {
    sandboxFetchTree();
    sandboxRefreshOpenTabs();
  }, [sandboxFetchTree, sandboxRefreshOpenTabs]);


  // Drive sandbox polling cadence off the active tab's streaming state
  // (the live-poll mode used to be hard-wired to the single chat).
  const activeMeta = tabsMeta[activeTabId];
  const notebookEntries = activeMeta?.notebookEntries ?? [];
  const notebookStreaming = activeMeta?.isStreaming ?? false;
  const subagentCompletions = activeMeta?.subagentCompletions ?? 0;
  const anyStreaming = useMemo(
    () => Object.values(tabsMeta).some((m) => m.isStreaming),
    [tabsMeta],
  );
  // While any tab is streaming, poll the active sandbox more aggressively so
  // the file tree + open previews update as the agent writes files. Hidden
  // projects keep their SSE streams mounted but catch up when reopened.
  useEffect(() => {
    if (!isActive || !anyStreaming) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      if (!document.hidden) await Promise.all([sandboxFetchTree(), sandboxRefreshOpenTabs()]);
      if (!cancelled) timer = setTimeout(tick, 1500);
    };
    timer = setTimeout(tick, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [anyStreaming, isActive, sandboxFetchTree, sandboxRefreshOpenTabs]);

  const [treeWidth, setTreeWidth] = useState(
    // UI guide v2 L2: the content face is the widest pane (research first); side panes start narrow.
    () => clampWidth(initialState?.treeWidth ?? TREE_WIDTH.initial, TREE_WIDTH),
  );
  const [chatWidth, setChatWidth] = useState(
    () => clampWidth(initialState?.chatWidth ?? CHAT_WIDTH.initial, CHAT_WIDTH),
  );
  const [isResizing, setIsResizing] = useState(false);
  const dragging = useRef<"tree" | "chat" | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const startDrag = useCallback((panel: "tree" | "chat") => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = panel;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panel === "tree" ? treeWidth : chatWidth;
    setIsResizing(true);
  }, [treeWidth, chatWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragStartX.current;
      if (dragging.current === "tree") {
        setTreeWidth(clampWidth(dragStartWidth.current + delta, TREE_WIDTH));
      } else {
        setChatWidth(clampWidth(dragStartWidth.current - delta, CHAT_WIDTH));
      }
    };
    const onUp = () => {
      dragging.current = null;
      setIsResizing(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const projectWorkspaceState = useMemo<ProjectWorkspaceState>(
    () => ({
      tabs: tabs.map((tab) => ({
        ...tab,
        ...(tabWorkspaceStates[tab.id]
          ? { chat: tabWorkspaceStates[tab.id] }
          : {}),
      })),
      activeTabId,
      view,
      showNotebook,
      showCompute,
      showAutomation,
      computeScope,
      sandboxOpen,
      chatOpen,
      treeWidth,
      chatWidth,
      sandbox: sandboxWorkspace,
    }),
    [
      activeTabId,
      chatOpen,
      chatWidth,
      computeScope,
      sandboxOpen,
      sandboxWorkspace,
      showAutomation,
      showCompute,
      showNotebook,
      tabWorkspaceStates,
      tabs,
      treeWidth,
      view,
    ],
  );
  const projectWorkspaceStateRef = useRef(projectWorkspaceState);
  projectWorkspaceStateRef.current = projectWorkspaceState;

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void saveProjectWorkspaceState(projectId, projectWorkspaceState);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectId, projectWorkspaceState]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => {
      flushServerProjectWorkspaceState(projectId, projectWorkspaceStateRef.current);
      void saveProjectWorkspaceState(projectId, projectWorkspaceStateRef.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [hydrated, projectId]);

  // Ask Kady handoff: the active tab's composer (mounted even behind the
  // Workflows view) appends the text; this listener makes it visible.
  useEffect(() => {
    if (!isActive) return;
    return onChatPrefill(() => setView("chat"));
  }, [isActive]);

  // Deep links into Settings ("raise the limit in project settings", …).
  useEffect(() => {
    if (!isActive) return;
    return onOpenSettings((request) => {
      setSettingsRequest(request);
      setSettingsOpen(true);
    });
  }, [isActive]);

  // Flat list of all sandbox file paths for @ mentions (shared across tabs).
  // Cache artifacts are excluded — mentioning __pycache__/*.pyc is never useful.
  const allFiles = useMemo(
    () => flattenFiles(sandbox.tree).filter((p) => !isJunkFilePath(p)),
    [sandbox.tree],
  );
  const allFolders = useMemo(
    () => flattenFolders(sandbox.tree).filter((p) => !isJunkFilePath(p)),
    [sandbox.tree],
  );

  // ------------------------------------------------------------------
  // Tab management callbacks
  // ------------------------------------------------------------------

  const newTab = useCallback(() => {
    // Mint the id OUTSIDE any setState updater. Strict mode invokes
    // updaters twice for purity testing, which would otherwise produce
    // two different ids on a single click — the array would commit one
    // id while setActiveTabId got the other, leaving every tab with
    // isActive=false and display:none.
    if (tabsRef.current.length >= MAX_CHAT_TABS) return;
    const id = makeTabId();
    // A new chat continues the same piece of work far more often than it
    // switches models, so carry the active tab's model, thinking level, and
    // compute target over instead of resetting to the app defaults. Drafts,
    // attachments, and queued prompts stay with the tab they belong to.
    const seeded = seedChatStateFromTab(
      tabWorkspaceStatesRef.current[activeTabIdRef.current],
    );
    if (seeded) {
      setTabWorkspaceStates((prev) => ({ ...prev, [id]: seeded }));
    }
    setTabs((prev) =>
      prev.length >= MAX_CHAT_TABS
        ? prev
        : [...prev, { id, title: defaultTabTitle(prev.length) }],
    );
    setActiveTabId(id);
    setView("chat");
  }, []);

  // GAID hub: a draft installed into this project opens its start settings in the Workflows view.
  useEffect(() => {
    if (!isActive) return;
    const check = () => {
      if (hasMethodSetup(projectId)) setView("workflows");
    };
    check();
    return onMethodSetupRequest(check);
  }, [isActive, projectId]);

  // GeoAIDesk: a task started from the task list, a file suggestion or a
  // recipe opens in a new tab holding its draft (never sent automatically).
  useEffect(() => {
    if (!isActive) return;
    return onStartGeoTask((task) => {
      if (tabsRef.current.length >= MAX_CHAT_TABS) {
        task.result = "tab-limit";
        return;
      }
      const id = makeTabId();
      const state = geoTaskChatState(tabWorkspaceStatesRef.current[activeTabIdRef.current], task);
      setTabWorkspaceStates((prev) => ({ ...prev, [id]: state }));
      setTabs((prev) =>
        prev.length >= MAX_CHAT_TABS ? prev : [...prev, { id, title: task.title }],
      );
      setActiveTabId(id);
      setView("chat");
      task.result = "opened";
    });
  }, [isActive]);

  const closeTab = useCallback((id: string) => {
    // Abort an in-flight stream so the agent doesn't keep running into a
    // detached component. Safe to call on a non-streaming tab too.
    tabHandles.current.get(id)?.stop();
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((curr) => {
        if (curr !== id) return curr;
        const fallback = next[Math.min(idx, next.length - 1)];
        return fallback?.id ?? next[0].id;
      });
      return next;
    });
    tabHandles.current.delete(id);
    tabRefCallbacks.current.delete(id);
    setTabsMeta((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    setTabWorkspaceStates((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    void deletePersistedChatState(projectId, id);
  }, [projectId]);

  const renameTab = useCallback((id: string, title: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title } : t)),
    );
  }, []);

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id);
    setView("chat");
  }, []);

  // A tab whose stored session no longer exists on disk: keep the tab, drop the
  // binding, so it stops being treated as that session (dedupe, History focus)
  // and stops re-requesting it on every reload.
  const forgetTabSession = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== id || !t.sessionId) return t;
        const { sessionId: _dropped, ...rest } = t;
        void _dropped;
        return rest;
      }),
    );
  }, []);

  // Reopen a stored session (History menu). If some tab already holds that
  // session, just focus it — two tabs must never share one session.
  const openSession = useCallback(
    (sessionId: string, title: string) => {
      // Check the tab descriptors as well as reported meta: a restored or
      // just-opened tab carries its sessionId before its ChatTab has mounted
      // and reported meta, and matching on meta alone let the same session be
      // opened into a second tab.
      const openTabId =
        tabsRef.current.find((t) => t.sessionId === sessionId)?.id ??
        Object.entries(tabsMeta).find(([, meta]) => meta.sessionId === sessionId)?.[0];
      if (openTabId) {
        setActiveTabId(openTabId);
        setView("chat");
        return;
      }
      if (tabsRef.current.length >= MAX_CHAT_TABS) return;
      const id = makeTabId();
      setTabs((prev) =>
        prev.length >= MAX_CHAT_TABS ? prev : [...prev, { id, title, sessionId }],
      );
      setActiveTabId(id);
      setView("chat");
    },
    [tabsMeta],
  );

  // ------------------------------------------------------------------
  // Workflow launch — routes to the active chat tab via its imperative
  // handle and switches the view back to "chat".
  // ------------------------------------------------------------------

  const handleWorkflowLaunch = useCallback(
    async (prompt: string, model: Model, inputFiles: string[]) => {
      const handle = tabHandles.current.get(activeTabId);
      if (!handle) return;
      setView("chat");
      await handle.launchWorkflow(prompt, model, inputFiles);
    },
    [activeTabId],
  );

  const handleFileSelect = useCallback((path: string) => {
    sandboxSelectFile(path);
    setShowNotebook(false);
    setShowCompute(false);
    setShowAutomation(false);
  }, [sandboxSelectFile]);
  const handleOrganizeFiles = useCallback(() => {
    const handle = tabHandles.current.get(activeTabId);
    if (!handle) return;
    setView("chat");
    void handle.sendQuick(ORGANIZE_FILES_PROMPT);
  }, [activeTabId]);

  // ------------------------------------------------------------------
  // Chat ↔ notebook deep links (join key: tool-call id === entry id).
  // ------------------------------------------------------------------
  const [notebookFocus, setNotebookFocus] = useState<{ id: string; token: number } | null>(null);
  const handleViewInNotebook = useCallback((entryId: string) => {
    setShowCompute(false);
    setShowAutomation(false);
    setShowNotebook(true);
    setNotebookFocus({ id: entryId, token: Date.now() });
  }, []);
  // gaid-note-library: 서재 → "프로젝트에서 열기" opens the notebook tab on that research note.
  const [researchNoteFocus, setResearchNoteFocus] = useState<{ id: string; token: number } | null>(null);
  useEffect(() => {
    if (!isActive) return;
    const take = () => {
      const request = takeOpenResearchNote(projectId);
      if (!request) return;
      setShowCompute(false);
      setShowAutomation(false);
      setShowNotebook(true);
      setResearchNoteFocus({ id: request.noteId, token: Date.now() });
    };
    take();
    return onOpenResearchNoteRequest(take);
  }, [isActive, projectId]);
  const [computeFocus, setComputeFocus] = useState<{ id: string; token: number } | null>(null);
  const handleViewCompute = useCallback((jobId?: string) => {
    if (!REMOTE_COMPUTE_ENABLED) return;
    setShowNotebook(false);
    setShowAutomation(false);
    setShowCompute(true);
    if (jobId) setComputeFocus({ id: jobId, token: Date.now() });
  }, []);
  useEffect(() => {
    if (!isActive) return;
    const onOpenJob = (event: Event) => {
      const jobId = (
        event as CustomEvent<{ jobId?: string }>
      ).detail?.jobId;
      handleViewCompute(jobId);
    };
    window.addEventListener(OPEN_MODAL_JOB_EVENT, onOpenJob);
    return () => window.removeEventListener(OPEN_MODAL_JOB_EVENT, onOpenJob);
  }, [handleViewCompute, isActive]);
  const handleNotebookJumpToChat = useCallback(
    (entryId: string) => {
      // Un-hide the chat column without toggling it closed, then scroll once
      // display:none has lifted (scrollIntoView no-ops on hidden elements).
      setChatOpen(true);
      setView("chat");
      setTimeout(() => {
        const ok = tabHandles.current.get(activeTabId)?.scrollToToolCall(entryId) ?? false;
        if (!ok) toast.error(appText("header.couldn_t_find_this_entry_in_the"));
      }, 50);
    },
    [activeTabId],
  );

  // ------------------------------------------------------------------
  // Header pieces — cost pill — read from the active tab.
  // ------------------------------------------------------------------

  const activeSessionId = activeMeta?.sessionId ?? null;
  // A jump targets the chat it came from; a notebook view remounting under
  // another chat must not replay it ("That notebook entry isn't in this chat").
  useEffect(() => { setNotebookFocus(null); }, [activeSessionId]);
  const {
    activeCount: activeModalJobCount,
    loading: modalJobsLoading,
  } = useModalJobs({ projectId, enabled: isActive, limit: 200 });

  // Async subagents are ledgered when the child finishes, which can be long
  // after the parent turn ended. Without this the pill under-reported spend
  // until the next turn.
  const totalSubagentCompletions = useMemo(
    () =>
      Object.values(tabsMeta).reduce(
        (sum, meta) => sum + (meta.subagentCompletions ?? 0),
        0,
      ),
    [tabsMeta],
  );
  useEffect(() => {
    if (totalSubagentCompletions === 0) return;
    setCostRefreshKey((k) => k + 1);
  }, [totalSubagentCompletions]);

  const { summary: costSummary, loading: costLoading } = useSessionCost(
    activeSessionId,
    costRefreshKey,
  );
  const { summary: projectCost, loading: projectCostLoading } =
    useProjectCost(costRefreshKey);
  const showCost =
    projectCost.limitUsd != null ||
    (projectCost.spentUsd ?? projectCost.totalUsd ?? 0) > 0 ||
    (costSummary.totalUsd ?? 0) > 0;
  const directorySpendLimit = projectDirectory.find(
    (project) => project.id === projectId,
  )?.spendLimitUsd;
  // Match the server's admission rule: it compares *committed* money (ledgered
  // + compute reservations + in-flight runs) against the cap, and treats a
  // non-positive limit as unlimited.
  const committedUsd = projectCost.budget.committedUsd ?? projectCost.budget.totalUsd;
  const budgetBlocked =
    directorySpendLimit === undefined
      ? projectCost.budget.state === "exceeded"
      : directorySpendLimit !== null &&
        directorySpendLimit > 0 &&
        committedUsd >= directorySpendLimit;
  const projectActivity = useMemo(
    () =>
      summarizeProjectActivity(
        Object.values(tabsMeta).map((meta) => ({
          isStreaming: meta.isStreaming,
          runState: meta.runState,
          needsInput: meta.needsInput,
        })),
        budgetBlocked,
      ),
    [budgetBlocked, tabsMeta],
  );

  useEffect(() => {
    onProjectActivityChange(projectId, projectActivity);
  }, [onProjectActivityChange, projectActivity, projectId]);

  const tabDescriptors: ChatTabDescriptor[] = useMemo(
    () =>
      tabs.map((t) => ({
        id: t.id,
        title: t.title,
        isStreaming: tabsMeta[t.id]?.isStreaming ?? false,
        userMessageCount: tabsMeta[t.id]?.userMessageCount ?? 0,
      })),
    [tabs, tabsMeta],
  );

  // GeoAIDesk (gaid-cite-open-pdf): a 서재 citation pressed in a chat answer or a research note opens its PDF page in a
  // column between the preview and the chat.
  const citationPdf = useCitationPdf();
  const citationOpener = useMemo(() => ({ open: citationPdf.open }), [citationPdf.open]);

  return (
    <CitationPdfContext.Provider value={citationOpener}>
    <div className="flex h-dvh min-w-0 flex-col">
      {/* GAID app bar (UI guide v2 L2): mark, place switch, project; status and panel toggles; settings. */}
      <GaidAppBar
        place="projects"
        onNavigate={onOpenHub ? (place) => (place === "hub" ? onOpenHub() : onOpenProjectView()) : undefined}
        onHome={onOpenProjectView}
        leading={
          <>
            <span className="h-5 w-px bg-gaid-edge" aria-hidden />
            <ProjectSwitcher onOpenProjectView={onOpenProjectView} />
            {updateAvailable && (
              <InfoTooltip content={appText("header.a_newer_version_is_available_on_github")}>
                <a
                  href={process.env.NEXT_PUBLIC_RELEASES_URL ?? "https://github.com/K-Dense-AI/k-dense-byok"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-gaid-signal-ink hover:underline"
                >
                  {appText("header.update_available")}</a>
              </InfoTooltip>
            )}
          </>
        }
        trailing={
          <>
            {showCost && (
              <SessionCostPill
                summary={costSummary}
                projectSummary={projectCost}
                limitUsd={projectCost.limitUsd}
                loading={costLoading || projectCostLoading}
              />
            )}
            {activeModalJobCount > 0 ? (
              <InfoTooltip content={appText("header.computeRunning", { count: activeModalJobCount })}>
                <button
                  type="button"
                  onClick={() => handleViewCompute()}
                  aria-label={appText("header.openCompute", { count: activeModalJobCount })}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-gaid-signal-tint px-2 text-xs font-medium text-gaid-signal-ink transition-colors hover:bg-gaid-signal-tint/80"
                >
                  <span className="gaid-orbit" aria-hidden />
                  <ServerCogIcon className="size-3.5" aria-hidden />
                  <span className="tabular-nums">{activeModalJobCount}</span>
                </button>
              </InfoTooltip>
            ) : modalJobsLoading ? (
              <span className="sr-only" aria-live="polite">{appText("header.checking_compute_jobs")}</span>
            ) : null}
            {isActive && <SystemResourcesButton />}
            <span className="mx-1 h-5 w-px bg-gaid-edge" aria-hidden />
            {/* Panel visibility: collapse either side panel to give the center pane more room (UI guide v2 L2, D6). */}
            <InfoTooltip
              content={
                <>
                  <b>{appText(sandboxOpen ? "header.hide_file_browser" : "header.show_file_browser")}</b>
                  <kbd className="ml-2 font-sans text-xs opacity-80">{shortcutLabel("sidebar")}</kbd>
                  <br />
                  {appText("header.collapse_the_left_file_tree_to_widen")}</>
              }
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleSandbox}
                aria-label={sandboxOpen ? appText("header.hide_file_browser") : appText("header.show_file_browser")}
                aria-pressed={sandboxOpen}
                className={cn(sandboxOpen && "bg-gaid-hover text-gaid-ink")}
              >
                <PanelLeftIcon />
              </Button>
            </InfoTooltip>
            <InfoTooltip
              content={
                <>
                  <b>{appText(chatOpen ? "header.hide_chat" : "header.show_chat")}</b>
                  <br />
                  {appText("header.collapse_the_right_chat_panel_to_widen")}
                  <span className="xl:hidden"><br />{appText("header.chat_overlays_in_narrow_windows")}</span></>
              }
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleChat}
                aria-label={chatOpen ? appText("header.hide_chat") : appText("header.show_chat")}
                aria-pressed={chatOpen}
                className={cn(chatOpen && "bg-gaid-hover text-gaid-ink")}
              >
                <PanelRightIcon />
              </Button>
            </InfoTooltip>
          </>
        }
        onOpenSettings={() => {
          setSettingsRequest(null);
          setSettingsOpen(true);
        }}
      />

      {/* Main content area — three columns: file tree | preview | chat. Compact desktop (1024–1279 px, UI guide v2 L1):
          the chat pane becomes a sheet over the preview instead of a third column. */}
      <div
        ref={workspaceRef}
        className={cn("relative flex min-h-0 flex-1 overflow-hidden", isResizing && "select-none")}
      >

        {/* Left: file tree */}
        {isActive && sandboxOpen && (
          <div className="min-h-0 min-w-0 shrink-0 overflow-hidden w-[min(var(--tree-width),30vw)] xl:w-[var(--tree-width)]" style={{ "--tree-width": `${treeWidth}px` } as CSSProperties}>
            <FileTreePanel
              tree={sandbox.tree}
              selectedPath={sandbox.activeTabPath}
              uploading={sandbox.uploading}
              onSelect={handleFileSelect}
              onDownload={sandbox.downloadFile}
              onDelete={sandbox.deleteFile}
              onDownloadDir={sandbox.downloadDir}
              onDeleteDir={sandbox.deleteDir}
              onDownloadAll={sandbox.downloadAll}
              onRefresh={sandbox.fetchTree}
              onClose={toggleSandbox}
              onUpload={sandbox.uploadFiles}
              onOrganize={handleOrganizeFiles}
              onMove={sandbox.moveItem}
              onRename={sandbox.renameItem}
              onCreateDir={sandbox.createDir}
            />
          </div>
        )}

        {/* Drag handle: tree ↔ preview */}
        {isActive && sandboxOpen && (
          <div className="flex">
            <ResizeHandle label={appText("header.resize_file_browser")} value={treeWidth} range={TREE_WIDTH} grows="right" onMouseDown={startDrag("tree")} onResize={setTreeWidth} />
          </div>
        )}

        {/* Middle: file preview with tabs — always shown; it is the pane the
            side panels make room for (e.g. the LaTeX editor + PDF). */}
        <div className="min-h-0 flex-1 min-w-0 overflow-hidden">
            <FilePreviewPanel
              projectId={projectId}
              isActive={isActive}
              activeModelRef={tabWorkspaceStates[activeTabId]?.selectedModel.id}
              tabs={sandbox.tabs}
              activeTabPath={sandbox.activeTabPath}
              onTabSelect={handleFileSelect}
              onTabClose={sandbox.closeTab}
              onDownload={sandbox.downloadFile}
              onSaveText={sandbox.saveFile}
              onSaveImageBlob={sandbox.saveImageBlob}
              onRetry={sandbox.retryFile}
              onCompileLatex={sandbox.compileLatex}
              showNotebook={showNotebook}
              onSelectNotebook={() => {
                setShowCompute(false);
                setShowAutomation(false);
                setShowNotebook(true);
              }}
              showCompute={showCompute}
              onSelectCompute={() => {
                setShowNotebook(false);
                setShowAutomation(false);
                setShowCompute(true);
              }}
              showAutomation={showAutomation}
              onSelectAutomation={() => {
                setShowNotebook(false);
                setShowCompute(false);
                setShowAutomation(true);
              }}
              computeSessionId={activeSessionId}
              computeScope={computeScope}
              onComputeScopeChange={setComputeScope}
              computeFocus={computeFocus}
              onOpenComputeOutput={handleFileSelect}
              notebookSessionId={activeSessionId}
              notebookEntries={notebookEntries}
              notebookStreaming={notebookStreaming}
              notebookSubagentCompletions={subagentCompletions}
              onOpenNotebookFile={handleFileSelect}
              notebookFocus={notebookFocus}
              researchNoteFocus={researchNoteFocus}
              onNotebookJumpToChat={handleNotebookJumpToChat}
              onOpenNotebookChat={(sessionId, title) => { setChatOpen(true); openSession(sessionId, title); }}
              onOpenNotebookEntry={handleViewInNotebook}
            />
        </div>

        {/* GeoAIDesk (gaid-cite-open-pdf): the cited PDF shares the preview's width (the note or file that cites it stays
            readable beside it); on compact desktops it stays left of the chat sheet. */}
        {isActive && citationPdf.pdf && (
          <div
            className={cn("flex min-h-0 min-w-[360px] flex-1 border-l border-gaid-edge", chatOpen && "max-xl:mr-[min(var(--chat-width),calc(100%-48px))]")}
            style={{ "--chat-width": `${chatWidth}px` } as CSSProperties}
          >
            <CitationPdfPane pdf={citationPdf.pdf} onClose={citationPdf.close} onDocumentReady={citationPdf.documentReady}
              closeHint={libraryText("cite.closeHint")} className="min-w-0 flex-1 rounded-none border-0" />
          </div>
        )}

        {/* Drag handle: preview ↔ chat */}
        {isActive && chatOpen && (
          <div className="hidden xl:flex">
            <ResizeHandle label={appText("header.resize_chat")} value={chatWidth} range={CHAT_WIDTH} grows="left" onMouseDown={startDrag("chat")} onResize={setChatWidth} />
          </div>
        )}

        {/* Right: chat / workflows. Kept mounted (hidden via CSS when
            collapsed) so background chat streams keep running. */}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden shrink-0 bg-gaid-face",
            // Compact: a sheet over the preview (ply 2: one soft shadow and a 1 px edge, no dim; UI guide v2 S6, D6).
            "absolute inset-y-0 right-0 z-30 w-[min(var(--chat-width),calc(100%-48px))] border-l border-gaid-edge shadow-[var(--gaid-shadow-overlay)]",
            "xl:static xl:z-auto xl:w-[var(--chat-width)] xl:shadow-none",
            !chatOpen && "hidden",
          )}
          style={{ "--chat-width": `${chatWidth}px` } as CSSProperties}
        >

          <ChatTabsBar
            projectId={projectId}
            tabs={tabDescriptors}
            activeTabId={activeTabId}
            view={view}
            maxTabs={MAX_CHAT_TABS}
            onSelect={selectTab}
            onClose={closeTab}
            onNew={newTab}
            onRename={renameTab}
            onSelectWorkflows={() => setView("workflows")}
            onOpenSession={openSession}
            activeSessionId={activeSessionId}
            canExport={(activeMeta?.userMessageCount ?? 0) > 0}
          />

          {/* Chat tabs — all kept mounted so background streams continue.
              Each ChatTab hides itself with `display: none` when inactive. */}
          {tabs.map((t) => (
            <ChatTab
              key={t.id}
              ref={getTabRefCallback(t.id)}
              projectId={projectId}
              tabId={t.id}
              initialSessionId={t.sessionId ?? null}
              initialWorkspaceState={tabWorkspaceStates[t.id]}
              isActive={isActive && view === "chat" && t.id === activeTabId}
              isActiveTab={isActive && t.id === activeTabId}
              allFiles={allFiles}
              sandboxReady={sandbox.tree !== null}
              uploadFiles={sandbox.uploadFiles}
              onSandboxRefresh={handleSandboxRefresh}
              onTurnComplete={handleTurnComplete}
              allSkills={allSkills}
              skillsReady={!skillsLoading}
              budgetState={projectCost.budget.state}
              budgetTotalUsd={projectCost.budget.totalUsd}
              budgetLimitUsd={projectCost.budget.limitUsd}
              onMetaChange={handleMetaChange}
              onWorkspaceStateChange={handleTabWorkspaceStateChange}
              onSessionUnavailable={forgetTabSession}
              onViewInNotebook={handleViewInNotebook}
              onViewCompute={handleViewCompute}
              onOpenFile={handleFileSelect}
            />
          ))}

          {/* Workflows view */}
          {isActive && view === "workflows" && (
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <GeoTaskCatalogue projectId={projectId} availableFiles={allFiles}>
                {(extension) => (
                  <WorkflowsPanel
                    extension={extension}
                    onLaunch={handleWorkflowLaunch}
                    onUploadFiles={sandbox.uploadFiles}
                    availableFiles={allFiles}
                    availableFolders={allFolders}
                    filesReady={sandbox.tree !== null}
                    onRefreshFiles={sandbox.fetchTree}
                    budgetBlocked={projectCost.budget.state === "exceeded"}
                  />
                )}
              </GeoTaskCatalogue>
            </div>
          )}
        </div>

      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} request={settingsRequest} />
    </div>
    </CitationPdfContext.Provider>
  );
}
