"use client";
/**
 * The draft at a glance: title, state badges, one-line summary, the method flow, and three
 * compact rows (inputs, outputs, limits). A selected step opens its short detail beside the
 * flow. The right rail tries the draft in a project. Technical files, check output and the
 * agent record open only on request.
 */
import {
  FileTextIcon,
  FlaskConicalIcon,
  ImageIcon,
  LoaderCircleIcon,
  PencilLineIcon,
  Share2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MethodDraft } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";

import { MethodFlow, type StepVisual } from "./method-flow";
import { LimitsCard, OverviewBand } from "./method-overview";
import { localText } from "./text";

import { TechnicalDetail } from "./technical";
const text = geoText("hub");

export function DraftStep({
  draft,
  trialCount,
  checkIssues,
  rail,
  onFeedback,
  onShowFiles,
  onShowIssues,
  onRegister,
  registered,
  visuals,
  outputImages,
  visualAction,
}: {
  /** Concept pictures through the OpenAI Codex subscription only (no fallback); explicit action only. */
  visualAction?: {
    busy: boolean;
    progress: { done: number; total: number } | null;
    has: boolean;
    error: string | null;
    /** Raw server text, shown only behind the technical disclosure. */
    errorDetail: string | null;
    /** The last batch stopped at the subscription's usage limit. */
    usageLimit: boolean;
    onMake: () => void;
    /** The OpenAI Codex login is connected (null while unknown). */
    connected: boolean | null;
  };
  /** Register the draft in the shared GAID hub (others can star and comment). */
  onRegister?: () => void;
  /** Already registered: revision shown in the hub. */
  registered?: number | null;
  visuals?: Record<string, StepVisual>;
  outputImages?: Record<string, StepVisual>;
  draft: MethodDraft;
  trialCount: number;
  /** Error findings of the latest check (0 = passed); null while unknown. */
  checkIssues: number | null;
  rail: ReactNode;
  onFeedback?: () => void;
  onShowFiles?: () => void;
  onShowIssues?: () => void;
}) {
  const profile = draft.profile;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{localText(profile.title)}</h2>
            <Badge variant="secondary">{text("draft.private")}</Badge>
            <Badge variant="outline">
              {trialCount > 0 ? text("draft.tested", { count: trialCount }) : text("draft.untested")}
            </Badge>
            <Badge variant="outline">
              {text(draft.codeFiles.length ? "draft.implementation.implemented" : "draft.implementation.descriptive")}
            </Badge>
            <span className="text-xs text-muted-foreground">{text("draft.revision", { n: draft.revision })}</span>
          </div>
          <p className="max-w-[640px] text-base">{localText(profile.tagline)}</p>
          {!draft.codeFiles.length && (
            <p className="text-sm text-muted-foreground">{text("draft.implementation.descriptiveHint")}</p>
          )}
          {onRegister && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <Share2Icon className="size-5 text-primary" aria-hidden />
              <p className="min-w-0 flex-1 text-sm">
                {registered ? text("register.registeredLine", { n: registered }) : text("register.line")}
              </p>
              <Button onClick={onRegister}>
                {registered ? text("register.update", { n: registered }) : text("register.open")}
              </Button>
            </div>
          )}
        </header>

        <OverviewBand profile={profile} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold">{text("draft.flow")}</h3>
            {visualAction && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {visualAction.connected === false && (
                  <span className="text-xs text-muted-foreground">{text("visuals.needLogin")}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visualAction.busy || visualAction.connected === false}
                  title={text("visuals.note")}
                  onClick={visualAction.onMake}
                >
                  {visualAction.busy ? (
                    <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <ImageIcon data-icon="inline-start" />
                  )}
                  {visualAction.busy
                    ? visualAction.progress
                      ? text("visuals.making", visualAction.progress)
                      : text("visuals.starting")
                    : visualAction.has
                      ? text("visuals.remake")
                      : text("visuals.make")}
                </Button>
              </div>
            )}
          </div>
          {visualAction?.error && !visualAction.busy && (
            <p
              role={visualAction.usageLimit ? "alert" : undefined}
              className={
                visualAction.usageLimit
                  ? "flex items-start gap-2 rounded-md border border-[var(--gaid-warning)]/40 px-3 py-2 text-sm text-[var(--gaid-warning)]"
                  : "text-sm text-destructive"
              }
            >
              {visualAction.usageLimit && <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {visualAction.error}
            </p>
          )}
          {visualAction && !visualAction.busy && <TechnicalDetail detail={visualAction.errorDetail} />}
          <MethodFlow profile={profile} visuals={visuals} outputImages={outputImages} />
        </section>

        <LimitsCard profile={profile} />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onFeedback}>
            <PencilLineIcon data-icon="inline-start" />
            {text("draft.feedback")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onShowFiles}>
            <FileTextIcon data-icon="inline-start" />
            {text("draft.files")}
          </Button>
          {checkIssues !== null &&
            (checkIssues === 0 ? (
              <span className="text-sm text-muted-foreground">{text("draft.checkOk")}</span>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onShowIssues}>
                {text("draft.checkFail", { count: checkIssues })}
              </Button>
            ))}
        </div>
      </div>
      <aside className="flex min-h-0 flex-col gap-4">{rail}</aside>
    </div>
  );
}

/** Right-rail card that installs the draft into a project and opens its start settings. */
/** A one-field form behind a link: name a new project and create it. */
export function NewProject({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-primary underline">
        {text("trial.newProject.action")}
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        setFailed(null);
        onCreate(name.trim())
          .then(() => {
            setOpen(false);
            setName("");
          })
          .catch((err: Error) => setFailed(err.message))
          .finally(() => setBusy(false));
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={text("trial.newProject.placeholder")}
        aria-label={text("trial.newProject.label")}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim() || busy}>
          {text("trial.newProject.button")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {text("trial.newProject.cancel")}
        </Button>
      </div>
      {failed && <p className="text-sm text-destructive">{text("trial.newProject.failed")}</p>}
      <TechnicalDetail detail={failed} />
    </form>
  );
}

export function TrialCard({
  projects,
  projectId,
  onProject,
  consent,
  onConsent,
  onInstall,
  installing,
  disabledReason,
  installedIn,
  prepared,
  onCreateProject,
}: {
  /** After installation: the input preparation that leads to the start settings. */
  prepared?: ReactNode;
  /** Make a new research project to try the draft in (selected afterwards). */
  onCreateProject?: (name: string) => Promise<void>;
  projects: { id: string; name: string }[];
  projectId: string;
  onProject: (id: string) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  onInstall: () => void;
  installing?: boolean;
  disabledReason?: string | null;
  installedIn?: string | null;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <FlaskConicalIcon className="size-5 text-primary" aria-hidden />
        <h3 className="font-semibold">{text("trial.title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{text("trial.body")}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {text("trial.project")}
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm font-normal"
          value={projectId}
          onChange={(event) => onProject(event.target.value)}
        >
          <option value="" disabled>
            {text("trial.pickProject")}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {!prepared && onCreateProject && <NewProject onCreate={onCreateProject} />}
      {prepared ? (
        prepared
      ) : (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={consent}
              onChange={(event) => onConsent(event.target.checked)}
            />
            {text("trial.consent")}
          </label>
          <Button variant="outline" onClick={onInstall} disabled={!consent || installing || !projectId || Boolean(disabledReason)}>
            {installing ? text("trial.installing") : text("trial.install")}
          </Button>
          {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
        </>
      )}
      {installedIn && <p className="text-sm text-primary">{text("trial.installed", { project: installedIn })}</p>}
    </section>
  );
}
