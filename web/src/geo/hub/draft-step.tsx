"use client";
/**
 * The draft at a glance: title, state badges, one-line summary, the method flow, and three
 * compact rows (inputs, outputs, limits). A selected step opens its short detail beside the
 * flow. The right rail tries the draft in a project. Technical files, check output and the
 * agent record open only on request.
 */
import { FileTextIcon, FlaskConicalIcon, PencilLineIcon, Share2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MethodDraft } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";

import { MethodFlow, type StepVisual } from "./method-flow";
import { localText } from "./text";

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
}: {
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
            <h2 className="text-2xl font-semibold tracking-tight">{localText(profile.title)}</h2>
            <Badge variant="secondary">{text("draft.private")}</Badge>
            <Badge variant="outline">
              {trialCount > 0 ? text("draft.tested", { count: trialCount }) : text("draft.untested")}
            </Badge>
            <span className="text-xs text-muted-foreground">{text("draft.revision", { n: draft.revision })}</span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{localText(profile.tagline)}</p>
          {onRegister && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <Share2Icon className="size-5 text-primary" aria-hidden />
              <p className="min-w-0 flex-1 text-sm">{registered ? text("register.registeredLine", { n: registered }) : text("register.line")}</p>
              <Button onClick={onRegister}>{registered ? text("register.update", { n: registered }) : text("register.open")}</Button>
            </div>
          )}
        </header>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{text("draft.flow")}</h3>
          <MethodFlow profile={profile} visuals={visuals} outputImages={outputImages} />
        </section>

        <Facts title={text("draft.limits")} items={profile.limitations.map((l) => localText(l.text))} full />

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

/** A short list; longer ones open with "모두 보기". `full` (limits) never shortens an item: limits are not cut. */
function Facts({ title, items, full = false }: { title: string; items: string[]; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, 3);
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {shown.map((item, i) => (
          <li key={i} className={full || open ? undefined : "line-clamp-2"}>
            {item}
          </li>
        ))}
      </ul>
      {(items.length > 3 || (!full && items.some((item) => item.length > 60))) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="self-start text-xs text-primary underline-offset-4 hover:underline"
        >
          {open ? text("draft.showLess") : text("draft.showAll", { count: items.length })}
        </button>
      )}
    </div>
  );
}

/** Right-rail card that installs the draft into a project and opens its start settings. */
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
}: {
  /** After installation: the input preparation that leads to the start settings. */
  prepared?: ReactNode;
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
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
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
          <Button onClick={onInstall} disabled={!consent || installing || Boolean(disabledReason)}>
            {installing ? text("trial.installing") : text("trial.install")}
          </Button>
          {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
        </>
      )}
      {installedIn && <p className="text-sm text-primary">{text("trial.installed", { project: installedIn })}</p>}
    </section>
  );
}
