"use client";
/**
 * GAID hub: the place of the main page where a researcher turns sources into a skill or
 * Workflow (authoring service `/geo/authoring/*`) and tries it in a project. One screen per
 * step; panels scroll inside, the page does not.
 */
import { MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
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
} from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { API_BASE } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import { useProjects } from "@/lib/use-projects";

import { fileBase64, hubApi, newOpId } from "./api";
import { DraftStep, TrialCard } from "./draft-step";
import { AgentRecordDialog, FeedbackDialog, FilesDialog, IssuesDialog, SourcePageDialog } from "./hub-dialogs";
import { HubHome } from "./hub-home";
import { HubShell, ProjectBar, type HubStep } from "./hub-shell";
import type { HubLocation } from "./location";
import { QuestionStep, type DraftAnswer } from "./question-step";
import { SourceStep, WorkingPanel, type Target, type WebSourceKind } from "./source-step";
import { TrialStep, useTrialCount } from "./trial-step";
import { SharedMethod } from "./shared-method";
import { MethodFlow, type StepVisual } from "./method-flow";
import { localText } from "./text";
import { InputPrep } from "./input-prep";
import { openMethodSetup } from "./handoff";
import type { HubEntry, HubFolder, HubRecommendation } from "@/geo/contracts/hub-shared";
import { hubUserName, sharedHub } from "./shared-api";
import { hubImage, SharedEntryScreen, useNamedAction } from "./shared-entry";
import { NewFolderDialog, RegisterDialog } from "./hub-dialogs";

const appText = geoText("app");
const text = geoText("hub");

export function GaidHub({
  authoringId,
  entryId = null,
  onNavigate,
  onOpenProjects,
  onOpenProject,
}: {
  authoringId: string | null;
  /** A registered entry of the shared hub to show. */
  entryId?: string | null;
  onNavigate: (next: HubLocation) => void;
  onOpenProjects: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { projects, setActive } = useProjects();
  const hubProjects = projects.filter((p) => !p.archived).map((p) => ({ id: p.id, name: p.name }));
  const { resolvedTheme, setTheme } = useTheme();
  const actions = (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={appText("projects.open_settings")}
        onClick={() => setSettingsOpen(true)}
      >
        <SettingsIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          resolvedTheme === "dark" ? appText("projects.switch_to_light_mode") : appText("projects.switch_to_dark_mode")
        }
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
    </>
  );
  return (
    <HubShell onNavigate={(place) => place === "projects" && onOpenProjects()} actions={actions}>
      {entryId ? (
        <SharedEntryScreen
          key={entryId}
          entryId={entryId}
          projects={hubProjects}
          onOpenSetup={(projectId, methodKey, workflowId, recipeId) => {
            setActive(projectId);
            onOpenProject(projectId);
            openMethodSetup({ projectId, methodKey, workflowId, recipeId });
          }}
        />
      ) : authoringId === null ? (
        <HubList
          onOpen={(id) => onNavigate({ open: true, projectId: id })}
          onOpenEntry={(id) => onNavigate({ open: true, projectId: null, entryId: id })}
        />
      ) : (
        <HubProject
          key={authoringId}
          id={authoringId}
          onBack={() => onNavigate({ open: true, projectId: null })}
          onCreated={(id) => onNavigate({ open: true, projectId: id })}
          onRegistered={(id) => onNavigate({ open: true, projectId: null, entryId: id })}
          onOpenProject={onOpenProject}
        />
      )}
      {settingsOpen && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </HubShell>
  );
}

/** `#hub/new` is a project not yet created: it is created with the first uploaded source. */
export const NEW_ID = "new-method";

function HubList({ onOpen, onOpenEntry }: { onOpen: (id: string) => void; onOpenEntry: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [folders, setFolders] = useState<(HubFolder & { entries: number })[]>([]);
  const [cards, setCards] = useState<HubRecommendation[]>([]);
  const [folderId, setFolderId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const named = useNamedAction();
  const loadShared = useCallback(async () => {
    // The shared hub may be unavailable (older server): my methods still list.
    const [f, e, r] = await Promise.allSettled([sharedHub.folders(), sharedHub.entries(), sharedHub.recommended()]);
    if (f.status === "fulfilled") setFolders(f.value.folders);
    if (e.status === "fulfilled") setEntries(e.value.entries);
    if (r.status === "fulfilled") setCards(r.value.cards);
  }, []);
  useEffect(() => {
    let live = true;
    const load = () =>
      hubApi
        .list()
        .then((r) => live && (setProjects(r.projects), setError(null)))
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    void load();
    void loadShared();
    const timer = window.setInterval(load, 10_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [loadShared]);
  const entryOf = (p: ProjectSummary) => entries.find((e) => e.revisions.some((r) => r.authoringProjectId === p.id));
  const shown = folderId === "all" ? projects : projects.filter((p) => entryOf(p)?.folderId === folderId);
  return (
    <>
      <HubHome
        recommended={cards.map((c) => ({
          id: c.id,
          title: c.title,
          line: c.line,
          image: hubImage(c.image),
          source: c.source,
          stars: c.stars,
          author: c.author,
        }))}
        folders={[
          { id: "all", name: text("home.allFolders"), count: projects.length },
          ...folders.map((f) => ({
            id: f.id,
            name: f.name,
            count: projects.filter((p) => entryOf(p)?.folderId === f.id).length,
          })),
        ]}
        folderId={folderId}
        onFolder={setFolderId}
        onNewFolder={() => named.run(() => setNewFolder(true))}
        projects={shown}
        registered={Object.fromEntries(
          projects.flatMap((p) => {
            const e = entryOf(p);
            return e
              ? [[p.id, { entryId: e.id, stars: e.stars, comments: e.comments, revision: e.latestRevision }]]
              : [];
          }),
        )}
        loading={loading}
        error={error}
        onCreate={() => onOpen(NEW_ID)}
        onOpen={onOpen}
        onOpenEntry={onOpenEntry}
        onOpenRecommended={(id) => {
          const card = cards.find((c) => c.id === id);
          if (card?.source === "shared") onOpenEntry(card.ref);
          else if (card) toast.info(text("home.catalogueHint", { title: card.title }));
        }}
      />
      <NewFolderDialog
        open={newFolder}
        onOpenChange={setNewFolder}
        onCreate={async (name) => {
          const f = await sharedHub.createFolder(name);
          await loadShared();
          setFolderId(f.id);
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
  if (!draft) return { steps, outputs, cover };
  const nodeIds = new Set(draft.profile.procedure.nodes.map((n) => n.id));
  const outputIds = new Set(draft.profile.outputs.map((o) => o.id));
  for (const [key, v] of Object.entries(project.visuals ?? {})) {
    const src = withApiToken(`${API_BASE}${hubApi.visualUrl(project.id, key)}`);
    const visual: StepVisual = { src, kind: "generated", caption: v.caption };
    if (key === "cover") cover = src;
    else if (key.startsWith("output:") && outputIds.has(key.slice(7))) outputs[key.slice(7)] = visual;
    else if (nodeIds.has(key)) steps[key] = visual;
  }
  return { steps, outputs, cover };
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
  const [target, setTarget] = useState<Target>("auto");
  const [uploading, setUploading] = useState<string | null>(null);
  const [urls, setUrls] = useState<{ url: string; kind: WebSourceKind; status: "fetching" | "failed" }[]>([]);
  const [visualsBusy, setVisualsBusy] = useState(false);
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
  const named = useNamedAction();
  useEffect(() => {
    if (!registerOpen) return;
    void sharedHub
      .folders()
      .then((r) => setHubFolders(r.folders))
      .catch(() => setHubFolders([]));
  }, [registerOpen]);
  const [page, setPage] = useState<{ sourceId: string; page: number } | null>(null);
  const [trialProject, setTrialProject] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { projects, setActive } = useProjects();
  const trialCount = useTrialCount(project?.installs ?? NO_INSTALLS, project?.drafts.at(-1)?.slug ?? "");

  const reload = useCallback(async () => {
    if (isNew) return;
    try {
      const p = await hubApi.get(id);
      setProject(p);
      setError(null);
      setGoal((g) => g || p.goal || "");
      setTarget((t) => (p.target && t === "auto" ? p.target : t));
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
  const pictures = useMemo(
    () => (project ? draftVisuals(project, draft) : draftVisuals(emptyProject(), undefined)),
    [project, draft],
  );
  const lastVisualOp = Object.values(project?.visualOperations ?? {})
    .filter((o) => o.draftRevision === draft?.revision)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .at(-1);
  const lastVisualError =
    lastVisualOp && lastVisualOp.status !== "running" && lastVisualOp.status !== "complete"
      ? (lastVisualOp.error ?? text("visuals.failed"))
      : null;
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
    // Preselect where the method was installed last, else the first project.
    const last = project?.installs.at(-1)?.projectId;
    if (!trialProject && activeProjects.length)
      setTrialProject(last && activeProjects.some((p) => p.id === last) ? last : activeProjects[0].id);
  }, [activeProjects, trialProject]);

  if (!project)
    return (
      <p className="p-10 text-sm text-muted-foreground">
        {error ? text("home.error", { detail: error }) : text("home.loading")}
      </p>
    );

  const questions = liveQuestions(project);
  const current = step ?? defaultStep(project);
  const reached: HubStep[] = ["sources"];
  // Analysis done (findings) also opens the questions step, so a run with zero questions can still create the draft.
  if (questions.length || project.findings.length || (running && running.op !== "analyze")) reached.push("questions");
  if (project.drafts.length) reached.push("draft", "publish", "trial");
  const title = project.title || text("home.new");

  const ensureProject = async (): Promise<string> => {
    if (!isNew) return id;
    const created = await hubApi.create({ goal: goal || undefined, target });
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

  const makeVisuals = async () => {
    if (!draft) return;
    setVisualsBusy(true);
    try {
      await hubApi.visuals(id, draft.revision);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVisualsBusy(false);
    }
  };

  const startAnalysis = async () => {
    try {
      await hubApi.analyze(id, { opId: newOpId(), goal: goal.trim() || undefined, target });
      setStep(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const applyAnswers = async () => {
    try {
      const open = questions.filter((q) => q.status === "open");
      // Answers already recorded (or no questions at all): start the draft directly (also the retry after a failure).
      if (open.length === 0) await hubApi.draft(id, { opId: newOpId() });
      else
        await hubApi.answers(id, {
          opId: newOpId(),
          draft: true,
          answers: open.map((q) => ({ questionId: q.id, questionRevision: q.revision, ...answers[q.id] })),
        });
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
          uploading={uploading}
          onStart={startAnalysis}
          analyzed={project.findings.length > 0}
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
          locked={new Set(questions.filter((q) => q.status !== "open").map((q) => q.id))}
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
          tags: [...draft.profile.taxonomy.tasks, ...(draft.profile.taxonomy.methods ?? [])].slice(0, 5),
          stars: 0,
          starred: false,
          trials: trialCount ?? 0,
          image: pictures.cover,
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
        visuals={pictures.steps}
        outputImages={pictures.outputs}
        visualAction={{
          busy: visualsBusy || Boolean(visualRun),
          progress: visualRun ? { done: visualRun.completed.length, total: visualRun.keys.length } : null,
          has: Object.keys(pictures.steps).length + Object.keys(pictures.outputs).length > 0,
          error: lastVisualError,
          onMake: () => void makeVisuals(),
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
            projects={activeProjects.map((p) => ({ id: p.id, name: p.name }))}
            projectId={trialProject}
            onProject={setTrialProject}
            consent={consent}
            onConsent={setConsent}
            onInstall={install}
            installing={installing}
            disabledReason={issues ? text("trial.notReady") : null}
            prepared={
              currentInstall ? (
                <InputPrep
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
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{body}</main>
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        folders={hubFolders}
        onRegister={async (folderId, note) => {
          try {
            const entry = await sharedHub.register({
              authoringProjectId: id,
              draftRevision: draft?.revision,
              folderId,
              note,
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
          await hubApi.revise(id, { opId: newOpId(), feedback });
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
          await hubApi.revise(id, { opId: newOpId(), feedback });
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

function FailedNotice({ outcome, message, onRetry }: { outcome: string; message?: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mb-4 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <span>{outcome === "interrupted" ? text("reading.interrupted") : (message ?? text("reading.failed"))}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {text("reading.retry")}
      </Button>
    </div>
  );
}
