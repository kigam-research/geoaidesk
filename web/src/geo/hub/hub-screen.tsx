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
import { SourceStep, WorkingPanel, type Target } from "./source-step";
import { TrialStep } from "./trial-step";
import { openMethodSetup } from "./handoff";

const appText = geoText("app");
const text = geoText("hub");

export function GaidHub({
  authoringId,
  onNavigate,
  onOpenProjects,
  onOpenProject,
}: {
  authoringId: string | null;
  onNavigate: (next: HubLocation) => void;
  onOpenProjects: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const actions = (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={appText("projects.open_settings")} onClick={() => setSettingsOpen(true)}>
        <SettingsIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={resolvedTheme === "dark" ? appText("projects.switch_to_light_mode") : appText("projects.switch_to_dark_mode")}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
    </>
  );
  return (
    <HubShell onNavigate={(place) => place === "projects" && onOpenProjects()} actions={actions}>
      {authoringId === null ? (
        <HubList onOpen={(id) => onNavigate({ open: true, projectId: id })} />
      ) : (
        <HubProject
          key={authoringId}
          id={authoringId}
          onBack={() => onNavigate({ open: true, projectId: null })}
          onCreated={(id) => onNavigate({ open: true, projectId: id })}
          onOpenProject={onOpenProject}
        />
      )}
      {settingsOpen && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    </HubShell>
  );
}

/** `#hub/new` is a project not yet created: it is created with the first uploaded source. */
export const NEW_ID = "new-method";

function HubList({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      hubApi
        .list()
        .then((r) => live && (setProjects(r.projects), setError(null)))
        .catch((e: Error) => live && setError(e.message))
        .finally(() => live && setLoading(false));
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);
  return <HubHome projects={projects} loading={loading} error={error} onCreate={() => onOpen(NEW_ID)} onOpen={onOpen} />;
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
    out[q.id] = d.status === "deferred" ? { defer: true } : d.optionId ? { optionId: d.optionId } : { response: d.response };
  }
  return out;
}

function defaultStep(p: AuthoringProject): HubStep {
  const running = runningAttempt(p);
  if (running?.op === "analyze") return "sources";
  if (running) return "questions";
  if (p.drafts.length) return p.installs.length ? "trial" : "draft";
  if (liveQuestions(p).length) return "questions";
  return "sources";
}

function HubProject({
  id,
  onBack,
  onCreated,
  onOpenProject,
}: {
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
  const [page, setPage] = useState<{ sourceId: string; page: number } | null>(null);
  const [trialProject, setTrialProject] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [installing, setInstalling] = useState(false);
  const { projects, setActive } = useProjects();

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
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void reload(), 3000);
    return () => window.clearInterval(timer);
  }, [running, reload]);

  useEffect(() => {
    window.localStorage.setItem(answersKey(id), JSON.stringify(answers));
  }, [answers, id]);

  const draft = project?.drafts.at(-1);
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
    if (!trialProject && activeProjects.length) setTrialProject(activeProjects[0].id);
  }, [activeProjects, trialProject]);

  if (!project)
    return <p className="p-10 text-sm text-muted-foreground">{error ? text("home.error", { detail: error }) : text("home.loading")}</p>;

  const questions = liveQuestions(project);
  const current = step ?? defaultStep(project);
  const reached: HubStep[] = ["sources"];
  if (questions.length || (running && running.op !== "analyze")) reached.push("questions");
  if (project.drafts.length) reached.push("draft", "trial");
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
      await hubApi.answers(id, {
        opId: newOpId(),
        draft: true,
        answers: questions
          .filter((q) => q.status === "open")
          .map((q) => ({ questionId: q.id, questionRevision: q.revision, ...answers[q.id] })),
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
      const result = await hubApi.install(id, pkg.revision, { projectId: trialProject, acknowledged: true });
      await reload();
      setActive(trialProject);
      onOpenProject(trialProject);
      openMethodSetup({ projectId: trialProject, methodKey: result.install.methodKey, workflowId: result.workflowId, recipeId: result.recipeId });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const failed = project.attempts.at(-1);
  const lastFailed = !running && failed && ["failed", "rejected", "interrupted"].includes(failed.outcome) ? failed : null;

  let body: React.ReactNode;
  if (running && (current === "sources" || current === "questions")) {
    body = (
      <WorkingPanel
        project={project}
        attempt={running}
        title={running.op === "analyze" ? text("reading.title") : running.op === "revise" ? text("drafting.revising") : text("drafting.title")}
        note={running.op === "analyze" ? text("reading.note") : text("drafting.note", { count: project.decisions.filter((d) => !d.supersededBy).length })}
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
          locked={new Set(questions.filter((q) => q.status !== "open").map((q) => q.id))}
          onAnswer={(qid, a) => setAnswers((cur) => ({ ...cur, [qid]: a }))}
          onApply={applyAnswers}
          applying={Boolean(running)}
          onOpenPage={(sourceId, p) => setPage({ sourceId, page: p })}
        />
      </>
    );
  } else if (draft && current === "draft") {
    const issues = check ? check.findings.filter((f) => f.level === "error").length : null;
    body = (
      <DraftStep
        draft={draft}
        trialCount={project.installs.length}
        checkIssues={issues}
        onFeedback={() => {
          setFeedbackPrefill("");
          setDialog("feedback");
        }}
        onShowFiles={() => setDialog("files")}
        onShowIssues={() => setDialog("issues")}
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
        onOpen={(install) => {
          setActive(install.projectId);
          onOpenProject(install.projectId);
          const manifest = project.packages.find((p) => p.revision === install.packageRevision)?.manifest as
            | { workflows?: { id: string }[]; recipes?: { id: string }[] }
            | undefined;
          openMethodSetup({
            projectId: install.projectId,
            methodKey: install.methodKey,
            workflowId: manifest?.workflows?.[0]?.id ?? null,
            recipeId: manifest?.recipes?.[0]?.id ?? null,
          });
        }}
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
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setDialog("record")}>
              {text("detail.show")}
            </button>
          ) : null
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{body}</main>
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
        <FilesDialog open={dialog === "files"} onOpenChange={(o) => setDialog(o ? "files" : null)} load={() => hubApi.files(id, draft.revision)} />
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
      <AgentRecordDialog open={dialog === "record"} onOpenChange={(o) => setDialog(o ? "record" : null)} attempts={project.attempts} />
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
    <div role="alert" className="mx-auto mb-4 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <span>{outcome === "interrupted" ? text("reading.interrupted") : (message ?? text("reading.failed"))}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        {text("reading.retry")}
      </Button>
    </div>
  );
}
