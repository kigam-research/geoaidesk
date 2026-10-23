"use client";
/**
 * GAID hub: the place of the main page where a researcher turns sources into a skill or
 * Workflow (authoring service `/geo/authoring/*`) and tries it in a project. One screen per
 * step; panels scroll inside, the page does not.
 */
import { PencilIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SettingsDialog } from "@/components/lazy-surfaces";
import { Button } from "@/components/ui/button";
import {
  liveQuestions,
  runningAttempt,
  type AuthoringProject,
  type CheckResult,
  type MethodDraft,
  type ProjectSummary,
  type VisualSourceInfo,
} from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { API_BASE } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import { onOpenSettings, type OpenSettingsRequest } from "@/lib/settings-nav";
import { useProjects } from "@/lib/use-projects";
import { PROVIDER_AUTH_CHANGED_EVENT } from "@/lib/use-provider-auth";
import { CAPABILITIES_CHANGED_EVENT } from "@/lib/capability-events";
import { HUB_CONNECTION_CHANGED } from "@/geo/hub-server/api";

import { fileBase64, hubApi, newOpId, HubApiError } from "./api";
import { DraftStep, TrialCard } from "./draft-step";
import { AgentRecordDialog, FeedbackDialog, FilesDialog, IssuesDialog, SourcePageDialog } from "./hub-dialogs";
import { HubHome } from "./hub-home";
import { HubSidebar, HubSidebarToggle, useHubSidebarCollapsed, type HubView } from "./hub-sidebar";
import { useShortcut } from "@/geo/shell/shortcuts";
import { HubShell, ProjectBar, type HubStep } from "./hub-shell";
import type { HubLocation } from "./location";
import { QuestionStep, sameAnswer, type DraftAnswer } from "./question-step";
import { SourceStep, WorkingPanel, type Target, type WebSourceKind } from "./source-step";
import { TrialStep, useTrialCount } from "./trial-step";
import { SharedMethod } from "./shared-method";
import { MethodFlow, type StepVisual } from "./method-flow";
import { TechnicalDetail } from "./technical";
import { localText } from "./text";
import { InputPrep } from "./input-prep";
import { openMethodSetup } from "./handoff";
import type { HubEntry, HubFolder, HubRecommendation } from "@/geo/contracts/hub-shared";
import { hubUserName, sharedHub } from "./shared-api";
import { CatalogueWorkflowScreen } from "./catalogue-workflow";
import { hubImage, SharedEntryScreen, useHubIdentity, useNamedAction } from "./shared-entry";
import { NewFolderDialog, RegisterDialog } from "./hub-dialogs";

import { SkillShelf } from "@/geo/hub-skills/shelf";
import { SkillDetail } from "@/geo/hub-skills/detail";
import { RegisterSkill } from "@/geo/hub-skills/register";
import { RemovedWorkflows } from "./removed-workflows";
import { hubVersionOf, hubRefVersion } from "@/geo/contracts/hub-version";
import { FeedScreen } from "@/geo/hub-feeds/feeds";

const text = geoText("hub");

export function GaidHub({
  authoringId,
  entryId = null,
  catalogueId = null,
  skills = false,
  feeds = false,
  removed = false,
  skillId = null,
  onNavigate,
  onOpenProjects,
  onOpenProject,
}: {
  authoringId: string | null;
  /** A registered entry of the shared hub to show. */
  entryId?: string | null;
  /** A built-in (catalogue) Workflow to show. */
  catalogueId?: string | null;
  skills?: boolean;
  /** 자료 소식 (`#hub/feeds`). */
  feeds?: boolean;
  removed?: boolean;
  skillId?: string | null;
  onNavigate: (next: HubLocation) => void;
  onOpenProjects: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequest, setSettingsRequest] = useState<OpenSettingsRequest | null>(null);
  // Deep links into Settings from hub screens (e.g. "connect the picture account" → Providers); the project list and
  // workspace listeners are off while the hub is shown.
  useEffect(
    () =>
      onOpenSettings((request) => {
        setSettingsRequest(request);
        setSettingsOpen(true);
      }),
    [],
  );
  const { projects, setActive, create } = useProjects();
  const hubProjects = projects.filter((p) => !p.archived).map((p) => ({ id: p.id, name: p.name }));
  const [registerSkill, setRegisterSkill] = useState(false);
  const skillPlace = skills || !!skillId;
  const identity = useHubIdentity();
  const listShown = !removed && !feeds && !skillPlace && !entryId && !catalogueId && authoringId === null;
  const index = useHubIndex(listShown);
  // The list the hub shows; on a detail screen, the list it was opened from (a registered Workflow opened by a link
  // belongs to 등록된 Workflow).
  const [view, setView] = useState<HubView>(() => (removed ? { kind: "removed" } : feeds ? { kind: "feeds" } : skillPlace ? { kind: "skills" } : entryId ? { kind: "registry", folder: "all" } : { kind: "home" }));
  const [mineFolder, setMineFolder] = useState("all");
  const [newFolder, setNewFolder] = useState(false);
  const named = useNamedAction();
  const [collapsed, toggleCollapsed] = useHubSidebarCollapsed();
  useShortcut("sidebar", toggleCollapsed);
  // A Workflow being made is one of mine; built-in Workflows are shown under 추천.
  const marked: HubView = removed ? { kind: "removed" } : feeds ? { kind: "feeds" } : skillPlace ? { kind: "skills" } : authoringId !== null ? { kind: "mine" } : catalogueId ? { kind: "home" } : view;
  const openList = (next: HubView) => {
    setRegisterSkill(false);
    setView(next);
    if (next.kind === "removed") { onNavigate({ open: true, projectId: null, removed: true }); return; }
    if (next.kind === "skills") { onNavigate({ open: true, projectId: null, skills: true }); return; }
    if (next.kind === "feeds") { onNavigate({ open: true, projectId: null, feeds: true }); return; }
    if (!listShown || removed) onNavigate({ open: true, projectId: null });
  };
  const toList = () => onNavigate({ open: true, projectId: null, ...(view.kind === "skills" ? { skills: true } : {}) });
  return (
    <HubShell
      onNavigate={(place) => place === "projects" && onOpenProjects()}
      onOpenSettings={() => {
        setSettingsRequest(null);
        setSettingsOpen(true);
      }}
      actions={<HubSidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />}
    >
      <div className="flex min-h-0 flex-1">
        <HubSidebar
          view={marked}
          folders={index.folders.map((f) => ({ id: f.id, name: f.name, count: f.entries }))}
          registryTotal={index.folders.reduce((n, f) => n + f.entries, 0)}
          mineCount={index.mine.length}
          removedCount={index.removed.length}
          showRemoved={Boolean(identity?.admin) || index.removed.length > 0}
          collapsed={collapsed}
          onView={openList}
          onNewFolder={() => named.run(() => setNewFolder(true))}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {removed ? (
            <RemovedWorkflows loading={index.removedLoading} error={index.removedError} entries={index.removed} onRestored={index.reloadShared} onBack={() => openList({ kind: "registry", folder: "all" })} />
          ) : feeds ? (
            <FeedScreen projects={hubProjects} />
          ) : skillPlace ? (
            skillId ? <SkillDetail key={skillId} id={skillId} projects={hubProjects} onCreateProject={(name) => create({ name })} onBack={() => onNavigate({ open: true, projectId: null, skills: true })} onWorkflow={(entryId) => onNavigate({ open: true, projectId: null, entryId })} />
            : registerSkill ? <RegisterSkill projects={hubProjects} folders={index.folders} onBack={() => setRegisterSkill(false)} onRegistered={(skill) => { setRegisterSkill(false); onNavigate({ open: true, projectId: null, skillId: skill.id }); }} />
            : <SkillShelf folders={index.folders} onOpen={(skillId) => onNavigate({ open: true, projectId: null, skillId })} onRegister={() => named.run(() => setRegisterSkill(true))} />
          ) : entryId ? (
            <SharedEntryScreen
              key={entryId}
              entryId={entryId}
              projects={hubProjects}
              onBack={toList}
              onRemoved={() => { void index.reloadShared(); openList({ kind: "registry", folder: "all" }); }}
              onOpenDraft={(id) => onNavigate({ open: true, projectId: id })}
              onOpenEntry={(id) => onNavigate({ open: true, projectId: null, entryId: id })}
              onOpenSetup={(projectId, methodKey, workflowId, recipeId) => {
                setActive(projectId);
                onOpenProject(projectId);
                openMethodSetup({ projectId, methodKey, workflowId, recipeId });
              }}
            />
          ) : catalogueId ? (
            <CatalogueWorkflowScreen key={catalogueId} id={catalogueId} onBack={toList} />
          ) : authoringId === null ? (
            <HubList
              index={index}
              view={view.kind === "skills" || view.kind === "feeds" || view.kind === "removed" ? { kind: "home" } : view}
              onView={setView}
              mineFolder={mineFolder}
              onMineFolder={setMineFolder}
              onOpen={(id) => onNavigate({ open: true, projectId: id })}
              onOpenEntry={(id) => onNavigate({ open: true, projectId: null, entryId: id })}
              onOpenCatalogue={(id) => onNavigate({ open: true, projectId: null, catalogueId: id })}
            />
          ) : (
            <HubProject
              key={authoringId}
              id={authoringId}
              onBack={toList}
              onCreated={(id) => onNavigate({ open: true, projectId: id })}
              onRegistered={(id) => {
                setView({ kind: "mine" });
                onNavigate({ open: true, projectId: null, entryId: id });
              }}
              onOpenProject={onOpenProject}
            />
          )}
        </div>
      </div>
      <NewFolderDialog
        open={newFolder}
        onOpenChange={setNewFolder}
        onCreate={async (name) => {
          const f = await sharedHub.createFolder(name);
          await index.reloadShared();
          setMineFolder(f.id);
        }}
      />
      {named.dialog}
      {settingsOpen && (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} request={settingsRequest} />
      )}
    </HubShell>
  );
}

/** `#hub/new` is a project not yet created: it is created with the first uploaded source. */
export const NEW_ID = "new-method";

interface HubIndex {
  /** My methods on a shared institute GAID: those started under my hub name, plus older ones without a recorded name. */
  mine: ProjectSummary[];
  entries: HubEntry[];
  removed: HubEntry[];
  removedLoading: boolean;
  removedError: string | null;
  folders: (HubFolder & { entries: number })[];
  cards: HubRecommendation[];
  loading: boolean;
  error: string | null;
  reloadShared: () => Promise<void>;
}

/**
 * What the hub lists (my methods, registered entries, topic folders, recommendations), shared by the sidebar and the
 * home lists. Read on entering the hub and on every return to the list; my methods refresh every 10 s while it shows.
 */
function useHubIndex(listShown: boolean): HubIndex {
  const identity = useHubIdentity();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [removed, setRemoved] = useState<HubEntry[]>([]);
  const [removedLoading, setRemovedLoading] = useState(true);
  const [removedError, setRemovedError] = useState<string | null>(null);
  const [folders, setFolders] = useState<(HubFolder & { entries: number })[]>([]);
  const [cards, setCards] = useState<HubRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadShared = useCallback(async () => {
    // The shared hub may be unavailable (older server): my methods still list.
    const [f, e, r, d] = await Promise.allSettled([sharedHub.folders(), sharedHub.entries(), sharedHub.recommended(), sharedHub.removed()]);
    if (d.status === "fulfilled") { setRemoved(d.value.entries); setRemovedError(null); }
    else { setRemoved([]); setRemovedError(String(d.reason)); }
    setRemovedLoading(false);
    if (f.status === "fulfilled") setFolders(f.value.folders);
    if (e.status === "fulfilled") setEntries(e.value.entries);
    if (r.status === "fulfilled") setCards(r.value.cards);
  }, []);
  useEffect(() => {
    const changed = () => void reloadShared();
    window.addEventListener(HUB_CONNECTION_CHANGED, changed);
    return () => window.removeEventListener(HUB_CONNECTION_CHANGED, changed);
  }, [reloadShared]);
  useEffect(() => {
    let live = true;
    const load = () =>
      hubApi
        .list()
        .then((r) => live && (setProjects(r.projects), setError(null)))
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    void load();
    void reloadShared();
    const timer = listShown ? window.setInterval(load, 10_000) : undefined;
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [listShown, reloadShared]);
  useEffect(() => { void reloadShared(); }, [identity, reloadShared]);
  const me = identity?.account ? identity.name : hubUserName();
  const mine = useMemo(() => (me ? projects.filter((p) => !p.author || p.author === me) : projects), [projects, me]);
  return { mine, entries, removed, removedLoading, removedError, folders, cards, loading, error, reloadShared };
}

function HubList({
  index,
  view,
  onView,
  mineFolder,
  onMineFolder,
  onOpen,
  onOpenEntry,
  onOpenCatalogue,
}: {
  index: HubIndex;
  view: HubView;
  onView: (view: HubView) => void;
  mineFolder: string;
  onMineFolder: (id: string) => void;
  onOpen: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onOpenCatalogue: (id: string) => void;
}) {
  const { mine, entries, folders, cards } = index;
  const named = useNamedAction();
  const entryOf = (p: ProjectSummary) =>
    entries.find(
      (e) =>
        (p.hubEntry?.mode === "edit" && e.id === p.hubEntry.entryId) ||
        e.revisions.some((r) => r.authoringProjectId === p.id),
    );
  const shown = mineFolder === "all" ? mine : mine.filter((p) => entryOf(p)?.folderId === mineFolder);
  return (
    <>
      <HubHome
        view={view}
        onView={onView}
        recommended={cards.map((c) => ({
          id: c.id,
          title: c.title,
          line: c.line,
          image: hubImage(c.image),
          imageThemed: c.imageThemed,
          source: c.source,
          stars: c.stars,
          author: c.author,
        }))}
        folders={[
          { id: "all", name: text("home.allFolders"), count: mine.length },
          ...folders.map((f) => ({
            id: f.id,
            name: f.name,
            count: mine.filter((p) => entryOf(p)?.folderId === f.id).length,
          })),
        ]}
        folderId={mineFolder}
        onFolder={onMineFolder}
        registryFolders={folders.map((f) => ({ id: f.id, name: f.name, count: f.entries }))}
        projects={shown}
        registered={Object.fromEntries(
          mine.flatMap((p) => {
            const e = entryOf(p);
            return e
              ? [[p.id, { entryId: e.id, stars: e.stars, comments: e.comments, version: hubVersionOf(e) }]]
              : [];
          }),
        )}
        loading={index.loading}
        error={index.error}
        onCreate={() => named.run(() => onOpen(NEW_ID))}
        onOpen={onOpen}
        onOpenEntry={onOpenEntry}
        onOpenRecommended={(id) => {
          const card = cards.find((c) => c.id === id);
          if (card?.source === "shared") onOpenEntry(card.ref);
          else if (card) onOpenCatalogue(card.ref);
        }}
      />
      {named.dialog}
    </>
  );
}

const NO_INSTALLS: AuthoringProject["installs"] = [];

/** Concept images of the project for the current draft: per step, per output (`output:<id>`) and the cover. */
function draftVisuals(project: AuthoringProject, draft: MethodDraft | undefined) {
  const steps: Record<string, StepVisual> = {};
  const outputs: Record<string, StepVisual> = {};
  let cover: string | null = null;
  let coverThemed = false;
  if (!draft) return { steps, outputs, cover, coverThemed };
  const nodeIds = new Set(draft.profile.procedure.nodes.map((n) => n.id));
  const outputIds = new Set(draft.profile.outputs.map((o) => o.id));
  for (const [key, v] of Object.entries(project.visuals ?? {})) {
    const src = withApiToken(`${API_BASE}${hubApi.visualUrl(project.id, key)}`);
    const visual: StepVisual = { src, kind: "generated", caption: v.caption, themed: Boolean(v.dark) };
    if (key === "cover") {
      cover = src;
      coverThemed = Boolean(v.dark);
    }
    else if (key.startsWith("output:") && outputIds.has(key.slice(7))) outputs[key.slice(7)] = visual;
    else if (nodeIds.has(key)) steps[key] = visual;
  }
  return { steps, outputs, cover, coverThemed };
}

function emptyProject(): AuthoringProject {
  const at = new Date().toISOString();
  return {
    schemaVersion: "gaid-authoring-project/v1",
    id: NEW_ID,
    owner: "",
    title: "",
    createdAt: at,
    updatedAt: at,
    sourceRevision: 0,
    sources: [],
    extractions: {},
    findings: [],
    questions: [],
    decisions: [],
    drafts: [],
    attempts: [],
    packages: [],
    installs: [],
    ops: {},
  };
}

function answersKey(id: string) {
  return `gaid:hub:answers:${id}`;
}

/** Answers the server already recorded (answered or deferred), shown as such and not sent again. */
export function recordedAnswers(p: AuthoringProject): Record<string, DraftAnswer> {
  const out: Record<string, DraftAnswer> = {};
  for (const q of p.questions) {
    if (q.status === "open") continue;
    const d = p.decisions.find((x) => x.questionId === q.id && !x.supersededBy);
    if (!d) continue;
    out[q.id] =
      d.status === "deferred" ? { defer: true } : d.optionId ? { optionId: d.optionId } : { response: d.response };
  }
  return out;
}

function defaultStep(p: AuthoringProject): HubStep {
  const running = runningAttempt(p);
  if (running?.op === "analyze") return "sources";
  if (running) return "questions";
  if (p.drafts.length) return p.installs.length ? "trial" : "draft";
  if (liveQuestions(p).length || p.findings.length) return "questions";
  return "sources";
}

function HubProject({
  id,
  onBack,
  onCreated,
  onOpenProject,
  onRegistered,
}: {
  /** The draft was registered in the shared hub: show its entry. */
  onRegistered: (entryId: string) => void;
  id: string;
  onBack: () => void;
  onCreated: (id: string) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const isNew = id === NEW_ID;
  const [project, setProject] = useState<AuthoringProject | null>(isNew ? emptyProject() : null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<HubStep | null>(null);
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState<Target>("workflow");
  const [agentModel, setAgentModel] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ url: string; kind: WebSourceKind; status: "fetching" | "failed" }[]>([]);
  const [visualsBusy, setVisualsBusy] = useState(false);
  const [visualSource, setVisualSource] = useState<VisualSourceInfo | null>(null);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(answersKey(id)) ?? "{}") as Record<string, DraftAnswer>;
    } catch {
      return {};
    }
  });
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [dialog, setDialog] = useState<null | "feedback" | "files" | "issues" | "record">(null);
  const [feedbackPrefill, setFeedbackPrefill] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [hubFolders, setHubFolders] = useState<HubFolder[]>([]);
  const [registrationEntry, setRegistrationEntry] = useState<HubEntry | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const [entryFolder, setEntryFolder] = useState<string | undefined>(undefined);
  const named = useNamedAction();
  const editedEntry = project?.hubEntry?.mode === "edit" ? project.hubEntry.entryId : null;
  useEffect(() => {
    let alive = true;
    if (registerOpen) void sharedHub.folders().then((r) => { if (alive) setHubFolders(r.folders); }).catch(() => { if (alive) setHubFolders([]); });
    setRegistrationLoading(true);
    setRegistrationFailed(false);
    // First-authored drafts have no edit link, but may already have a registered entry.
    void sharedHub.entry(editedEntry ?? `entry-${id}`).then((d) => {
      if (alive) { setEntryFolder(d.entry.folderId); setRegistrationEntry(d.entry); }
    }).catch((e) => {
      if (alive) {
        setEntryFolder(undefined); setRegistrationEntry(null);
        setRegistrationFailed(Boolean(editedEntry) || !(e instanceof HubApiError && e.status === 404));
      }
    }).finally(() => { if (alive) setRegistrationLoading(false); });
    return () => { alive = false; };
  }, [id, registerOpen, editedEntry]);
  const [page, setPage] = useState<{ sourceId: string; page: number } | null>(null);
  const [trialProject, setTrialProject] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { projects, setActive, create: createProject } = useProjects();
  const trialCount = useTrialCount(project?.installs ?? NO_INSTALLS, project?.drafts.at(-1)?.slug ?? "");

  const reload = useCallback(async () => {
    if (isNew) return;
    try {
      const p = await hubApi.get(id);
      setProject(p);
      setError(null);
      setGoal((g) => g || p.goal || "");
      setTarget("workflow");
      setAgentModel((m) => m || p.model || "");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, isNew]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const running = project ? runningAttempt(project) : undefined;
  const visualRun = project
    ? Object.values(project.visualOperations ?? {}).find((o) => o.status === "running")
    : undefined;
  const polling = Boolean(running || visualRun);
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(timer);
  }, [polling, reload]);

  useEffect(() => {
    window.localStorage.setItem(answersKey(id), JSON.stringify(answers));
  }, [answers, id]);

  const draft = project?.drafts.at(-1);
  // Consent belongs to the exact draft revision that was previewed.
  useEffect(() => { setConsent(false); }, [id, draft?.revision]);
  const showingDraft = Boolean(draft);
  useEffect(() => {
    if (!showingDraft) return;
    let live = true;
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      void hubApi.visualSource()
        .then((source) => { if (live) setVisualSource(source); })
        .catch(() => { if (live) setVisualSource(null); })
        .finally(() => { pending = false; });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(PROVIDER_AUTH_CHANGED_EVENT, refresh);
    window.addEventListener(CAPABILITIES_CHANGED_EVENT, refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PROVIDER_AUTH_CHANGED_EVENT, refresh);
      window.removeEventListener(CAPABILITIES_CHANGED_EVENT, refresh);
    };
  }, [showingDraft]);
  const pictures = useMemo(
    () => (project ? draftVisuals(project, draft) : draftVisuals(emptyProject(), undefined)),
    [project, draft],
  );
  const lastVisualOp = Object.values(project?.visualOperations ?? {})
    .filter((o) => o.draftRevision === draft?.revision)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .at(-1);
  const usageLimit = lastVisualOp?.status === "failed" ? lastVisualOp.usageLimit : undefined;
  const visualFailed = Boolean(lastVisualOp && lastVisualOp.status !== "running" && lastVisualOp.status !== "complete");
  // Researcher-facing wording (UI guide F4, R1); the server text only behind the technical disclosure.
  const lastVisualError = !visualFailed
    ? null
    : usageLimit
      ? usageLimit.resetsAt
        ? text("visuals.quotaUntil", { when: Date.parse(usageLimit.resetsAt) })
        : text("visuals.quota")
      : lastVisualOp?.status === "interrupted"
        ? text("visuals.interrupted")
        : text("visuals.failed");
  const lastVisualDetail = visualFailed && !usageLimit ? (lastVisualOp?.error ?? null) : null;
  // A usage limit is announced once, when the batch that hit it ends (also after a reload while it ran).
  const limitOp = usageLimit ? lastVisualOp?.opId : undefined;
  useEffect(() => {
    if (!limitOp) return;
    const key = `gaid:hub-limit-notice:${limitOp}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    toast.warning(text("visuals.quotaTitle"), { description: lastVisualError ?? undefined, duration: 12_000 });
  }, [limitOp, lastVisualError]);
  useEffect(() => {
    if (!draft || isNew) return setCheck(null);
    let live = true;
    hubApi
      .check(id, draft.revision)
      .then((c) => live && setCheck(c))
      .catch(() => live && setCheck(null));
    return () => {
      live = false;
    };
  }, [draft, id, isNew]);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  useEffect(() => {
    const last = project?.installs.at(-1)?.projectId;
    // Only where this method was installed before; otherwise the researcher picks (projects are shared on an institute GAID).
    if (!trialProject && last && activeProjects.some((p) => p.id === last)) setTrialProject(last);
  }, [activeProjects, trialProject]);

  if (!project)
    return (
      <div className="flex flex-col gap-2 p-10 text-sm text-muted-foreground">
        <p>{error ? text("home.error") : text("home.loading")}</p>
        {error && <TechnicalDetail detail={error} />}
      </div>
    );

  const questions = liveQuestions(project);
  const current = step ?? defaultStep(project);
  const reached: HubStep[] = ["sources"];
  // Analysis done (findings) also opens the questions step, so a run with zero questions can still create the draft.
  if (questions.length || project.findings.length || (running && running.op !== "analyze")) reached.push("questions");
  if (project.drafts.length) reached.push("draft", "publish", "trial");
  const title = project.title || text("home.new");

  // "" = the app default, sent explicitly so a project created with another model can switch back to the default.
  const withModel = { model: agentModel };
  const ensureProject = async (): Promise<string> => {
    if (!isNew) return id;
    const created = await hubApi.create({
      ...(hubUserName() ? { author: hubUserName()! } : {}),
      goal: goal || undefined,
      target,
      ...(agentModel ? { model: agentModel } : {}),
    });
    return created.id;
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    try {
      const pid = await ensureProject();
      for (const file of files) {
        setUploading(file.name);
        const kind = /\.(zip|tar\.gz|tgz)$/i.test(file.name) ? "code" : undefined;
        await hubApi.addSource(pid, {
          name: file.name,
          mediaType: file.type || "application/octet-stream",
          ...(kind ? { kind } : {}),
          contentBase64: await fileBase64(file),
        });
      }
      if (pid !== id) onCreated(pid);
      else await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const addUrl = async (url: string, kind: WebSourceKind) => {
    setUrls((cur) => [...cur.filter((u) => u.url !== url), { url, kind, status: "fetching" }]);
    try {
      const pid = await ensureProject();
      await hubApi.addUrl(pid, { url, kind });
      setUrls((cur) => cur.filter((u) => u.url !== url));
      if (pid !== id) onCreated(pid);
      else await reload();
    } catch (e) {
      setUrls((cur) => cur.map((u) => (u.url === url ? { ...u, status: "failed" } : u)));
      toast.error((e as Error).message);
    }
  };

  const makeVisuals = async (keys?: string[], instruction?: string, adapt?: boolean) => {
    if (!draft) return;
    setVisualsBusy(true);
    try {
      await hubApi.visuals(id, draft.revision, { keys, instruction, ...(adapt ? { adapt: true } : {}) });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVisualsBusy(false);
    }
  };

  const startAnalysis = async () => {
    try {
      await hubApi.analyze(id, { opId: newOpId(), goal: goal.trim() || undefined, target, ...withModel });
      setStep(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyAnswers = async () => {
    try {
      // Open questions plus recorded answers the researcher changed; the server revises an existing draft to them.
      const recorded = recordedAnswers(project);
      const send = questions.filter(
        (q) => q.status === "open" || (q.id in recorded && answers[q.id] && !sameAnswer(answers[q.id], recorded[q.id])),
      );
      // Nothing new (or no questions at all): start the draft directly (also the retry after a failure).
      if (send.length === 0) await hubApi.draft(id, { opId: newOpId(), ...withModel });
      else
        await hubApi.answers(id, {
          ...withModel,
          opId: newOpId(),
          draft: true,
          answers: send.map((q) => ({ questionId: q.id, questionRevision: q.revision, ...answers[q.id] })),
        });
      // Sent answers are now the recorded ones; drop the local copies so a reload shows the server's answers.
      setAnswers((cur) => Object.fromEntries(Object.entries(cur).filter(([qid]) => !send.some((q) => q.id === qid))));
      setStep(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const install = async () => {
    if (!draft) return;
    setInstalling(true);
    try {
      const existing = project.packages.find((p) => p.draftRevision === draft.revision);
      const pkg = existing ?? (await hubApi.pack(id, draft.revision));
      // Install only; the inputs are prepared in the project before the start settings open (InputPrep).
      await hubApi.install(id, pkg.revision, { projectId: trialProject, acknowledged: true });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  /** Open the installed method's start settings in its project (after the inputs are there). */
  const openSetup = (projectId: string, methodKey: string, packageRevision: number) => {
    const manifest = project.packages.find((p) => p.revision === packageRevision)?.manifest as
      | { workflows?: { id: string }[]; recipes?: { id: string }[] }
      | undefined;
    setActive(projectId);
    onOpenProject(projectId);
    openMethodSetup({
      projectId,
      methodKey,
      workflowId: manifest?.workflows?.[0]?.id ?? null,
      recipeId: manifest?.recipes?.[0]?.id ?? null,
    });
  };
  const currentPackage = draft ? project.packages.find((p) => p.draftRevision === draft.revision) : undefined;
  const currentInstall = currentPackage
    ? project.installs
        .filter((i) => i.projectId === trialProject && i.packageRevision === currentPackage.revision)
        .at(-1)
    : undefined;

  const failed = project.attempts.at(-1);
  const lastFailed =
    !running && failed && ["failed", "rejected", "interrupted"].includes(failed.outcome) ? failed : null;

  let body: React.ReactNode;
  if (running && (current === "sources" || current === "questions")) {
    body = (
      <WorkingPanel
        project={project}
        attempt={running}
        title={
          running.op === "analyze"
            ? text("reading.title")
            : running.op === "revise"
              ? text("drafting.revising")
              : text("drafting.title")
        }
        note={
          running.op === "analyze"
            ? text("reading.note")
            : running.op === "revise"
              ? text("drafting.reviseNote")
              : text("drafting.note", { count: project.decisions.filter((d) => !d.supersededBy).length })
        }
      />
    );
  } else if (current === "sources") {
    body = (
      <>
        {lastFailed && lastFailed.op === "analyze" && (
          <FailedNotice outcome={lastFailed.outcome} message={lastFailed.error} onRetry={startAnalysis} />
        )}
        <SourceStep
          project={project}
          goal={goal}
          onGoal={setGoal}
          target={target}
          onTarget={setTarget}
          onFiles={addFiles}
          onUrl={addUrl}
          urls={urls}
          agentModel={agentModel}
          onAgentModel={setAgentModel}
          uploading={uploading}
          onStart={startAnalysis}
          analyzed={project.findings.length > 0}
          onNext={project.findings.length > 0 ? () => setStep("questions") : undefined}
        />
      </>
    );
  } else if (current === "questions") {
    body = (
      <>
        {lastFailed && lastFailed.op !== "analyze" && (
          <FailedNotice outcome={lastFailed.outcome} message={lastFailed.error} onRetry={applyAnswers} />
        )}
        <QuestionStep
          questions={questions}
          answers={{ ...recordedAnswers(project), ...answers }}
          needsDraft={project.drafts.length === 0}
          recorded={recordedAnswers(project)}
          onAnswer={(qid, a) => setAnswers((cur) => ({ ...cur, [qid]: a }))}
          onApply={applyAnswers}
          applying={Boolean(running)}
          onOpenPage={(sourceId, p) => setPage({ sourceId, page: p })}
        />
      </>
    );
  } else if (draft && current === "publish") {
    body = (
      <SharedMethod
        preview={{
          onBack: () => setStep("draft"),
          onRegister: () => named.run(() => setRegisterOpen(true)),
        }}
        method={{
          id: project.id,
          title: localText(draft.profile.title),
          tagline: localText(draft.profile.tagline),
          summary: localText(draft.profile.summary),
          author: hubUserName() ?? project.owner,
          folder: null,
          revision: draft.revision,
          registeredAt: text("register.before"),
          kind: draft.workflow ? "workflow" : "skill",
          implementation: draft.codeFiles.length ? "implemented" : "descriptive",
          tags: [...draft.profile.taxonomy.tasks, ...(draft.profile.taxonomy.methods ?? [])].slice(0, 5),
          stars: 0,
          starred: false,
          trials: trialCount ?? 0,
          image: pictures.cover,
          imageThemed: pictures.coverThemed,
          comments: [],
        }}
        profile={draft.profile}
        flow={<MethodFlow profile={draft.profile} visuals={pictures.steps} outputImages={pictures.outputs} />}
        onStar={() => undefined}
        onComment={() => undefined}
        onTry={() => setStep("trial")}
      />
    );
  } else if (draft && current === "draft") {
    const issues = check ? check.findings.filter((f) => f.level === "error").length : null;
    body = (
      <DraftStep
        draft={draft}
        authoringId={id}
        visuals={pictures.steps}
        outputImages={pictures.outputs}
        cover={pictures.cover}
        coverThemed={pictures.coverThemed}
        visualAction={{
          busy: visualsBusy || Boolean(visualRun),
          progress: visualRun ? { done: visualRun.completed.length, total: visualRun.keys.length } : null,
          has: Boolean(pictures.cover) || Object.keys(pictures.steps).length + Object.keys(pictures.outputs).length > 0,
          error: lastVisualError,
          errorDetail: lastVisualDetail,
          usageLimit: Boolean(usageLimit),
          onMake: (keys, instruction, adapt) => void makeVisuals(keys, instruction, adapt),
          connected: visualSource?.available ?? null,
        }}
        trialCount={trialCount ?? 0}
        checkIssues={issues}
        onFeedback={() => {
          setFeedbackPrefill("");
          setDialog("feedback");
        }}
        onShowFiles={() => setDialog("files")}
        onShowIssues={() => setDialog("issues")}
        onRegister={() => setStep("publish")}
        rail={
          <TrialCard
            key={`${draft.revision}:${trialProject}`}
            authoringId={id}
            draftRevision={draft.revision}
            projects={activeProjects.map((p) => ({ id: p.id, name: p.name }))}
            projectId={trialProject}
            onProject={(next) => { setConsent(false); setTrialProject(next); }}
            consent={consent}
            onConsent={setConsent}
            onInstall={install}
            onCreateProject={async (name) => {
              const created = await createProject({ name });
              setTrialProject(created.id);
            }}
            installing={installing}
            disabledReason={issues ? text("trial.notReady") : null}
            prepared={
              currentInstall ? (
                <InputPrep
                  secondary
                  key={`${currentInstall.projectId}:${currentInstall.packageRevision}`}
                  projectId={currentInstall.projectId}
                  projectName={
                    activeProjects.find((p) => p.id === currentInstall.projectId)?.name ?? currentInstall.projectId
                  }
                  methodKey={currentInstall.methodKey}
                  onOpenSetup={() =>
                    openSetup(currentInstall.projectId, currentInstall.methodKey, currentInstall.packageRevision)
                  }
                />
              ) : null
            }
          />
        }
      />
    );
  } else if (draft) {
    body = (
      <TrialStep
        onDraft={() => setStep("draft")}
        project={project}
        projectName={(pid) => activeProjects.find((p) => p.id === pid)?.name ?? pid}
        onOpen={(install) => openSetup(install.projectId, install.methodKey, install.packageRevision)}
        onFeedback={(prefill) => {
          setFeedbackPrefill(prefill ?? "");
          setDialog("feedback");
        }}
      />
    );
  }

  const pdfSource = page ? project.sources.find((s) => s.id === page.sourceId) : undefined;
  return (
    <>
      <ProjectBar
        title={title}
        step={current}
        reached={reached}
        onStep={setStep}
        onBack={onBack}
        extra={
          project.attempts.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setDialog("record")}
            >
              {text("detail.show")}
            </button>
          ) : null
        }
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
        {project.hubEntry && <EditingNotice link={project.hubEntry} />}
        <div className="min-h-0 flex-1">{body}</div>
      </main>
      <RegisterDialog
        initialFolder={entryFolder}
        currentVersion={registrationEntry ? hubVersionOf(registrationEntry) : null}
        versionPending={registrationLoading}
        versionFailed={registrationFailed}
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        folders={hubFolders}
        onCreateFolder={async (name) => {
          const folder = await sharedHub.createFolder(name);
          setHubFolders((cur) => [...cur, folder]);
          return folder.id;
        }}
        onRegister={async (folderId, note, bump) => {
          try {
            const entry = await sharedHub.register({
              authoringProjectId: id,
              draftRevision: draft?.revision,
              folderId,
              note,
              bump,
            });
            onRegistered(entry.id);
          } catch (e) {
            toast.error((e as Error).message);
            throw e;
          }
        }}
      />
      {named.dialog}
      <FeedbackDialog
        initial={feedbackPrefill}
        open={dialog === "feedback"}
        onOpenChange={(o) => setDialog(o ? "feedback" : null)}
        onSend={async (feedback) => {
          await hubApi.revise(id, { opId: newOpId(), feedback, ...withModel });
          setStep(null);
          await reload();
        }}
      />
      {draft && (
        <FilesDialog
          open={dialog === "files"}
          onOpenChange={(o) => setDialog(o ? "files" : null)}
          load={() => hubApi.files(id, draft.revision)}
        />
      )}
      <IssuesDialog
        open={dialog === "issues"}
        onOpenChange={(o) => setDialog(o ? "issues" : null)}
        check={check}
        onFix={async (feedback) => {
          await hubApi.revise(id, { opId: newOpId(), feedback, ...withModel });
          setStep(null);
          await reload();
        }}
      />
      <AgentRecordDialog
        open={dialog === "record"}
        onOpenChange={(o) => setDialog(o ? "record" : null)}
        attempts={project.attempts}
      />
      {page && pdfSource && (
        <SourcePageDialog
          open
          onOpenChange={(o) => !o && setPage(null)}
          name={pdfSource.name}
          url={withApiToken(`${API_BASE}${hubApi.originalUrl(id, pdfSource.id)}`)}
          page={page.page}
        />
      )}
    </>
  );
}

/** Which registered method this draft edits (next revision) or copies (separate entry naming the original). */
function EditingNotice({ link }: { link: NonNullable<AuthoringProject["hubEntry"]> }) {
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <PencilIcon className="size-4 shrink-0 text-primary" aria-hidden />
      {link.mode === "edit"
        ? text("editing.edit", { version: hubRefVersion(link) ?? "" })
        : text("editing.copy", { author: link.author, title: link.title, version: hubRefVersion(link) ?? "" })}
    </p>
  );
}

function FailedNotice({ outcome, message, onRetry }: { outcome: string; message?: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mb-4 flex max-w-2xl flex-col gap-2 rounded-lg border border-destructive/30 p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{outcome === "interrupted" ? text("reading.interrupted") : text("reading.failed")}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {text("reading.retry")}
        </Button>
      </div>
      {outcome !== "interrupted" && <TechnicalDetail detail={message} />}
    </div>
  );
}
