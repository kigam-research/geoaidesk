"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowDoc, WorkflowDocSettings, WorkflowDocTarget } from "@/geo/contracts/workflow-doc";
import type { WorkflowReadiness } from "@/geo/contracts/workspace";
import type { DraftProfile } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { SkillInstructions } from "@/geo/skills/skill-instructions";
import { MethodFlow, type PictureAction, type StepVisual } from "@/geo/hub/method-flow";
import { localText } from "@/geo/hub/text";
import { workflowDocText } from "./render";
import { sizeText } from "@/geo/contracts/workflow-examples";
import { loadHubSkillSource } from "./hub-skill-source";

const text = geoText("workflowView");
export type SkillSourceLoader = (name: string) => Promise<{ content: string }>;

/** One read-only view of the structured Workflow and the exact instruction document it renders. */
export function WorkflowView({ doc, projectId, readiness, profile, visuals, outputImages, pictureAction, loadSkillSource, exportAction, showStepsHeading = true }: {
  doc: WorkflowDoc;
  showStepsHeading?: boolean;
  projectId?: string;
  readiness?: WorkflowReadiness;
  profile?: DraftProfile;
  visuals?: Record<string, StepVisual>;
  outputImages?: Record<string, StepVisual>;
  pictureAction?: PictureAction;
  loadSkillSource?: SkillSourceLoader;
  /** The CLI export action is supplied by the host, keeping this view independent of export availability. */
  exportAction?: ReactNode;
}) {
  const [reading, setReading] = useState<string | null>(null);
  return <div className="flex min-w-0 flex-col gap-4 text-sm [overflow-wrap:anywhere]">
    {doc.kind === "legacy" && <p className="text-muted-foreground">{text("legacy")}</p>}
    <section className="space-y-3">
      {showStepsHeading && <h3 className="text-base font-semibold">{text("steps")}</h3>}
      {profile ? <MethodFlow profile={profile} doc={doc} visuals={visuals} outputImages={outputImages} pictureAction={pictureAction} stepDetail={(stepId) => <StepFacts doc={doc} stepId={stepId} />} /> : <ol className="space-y-2">
        {doc.steps.map((step, i) => <li key={step.id} className="rounded-lg border p-3">
          <details open={i === 0}>
            <summary className="cursor-pointer font-semibold">{i + 1}. {localText(step.title)}</summary>
            <p className="mt-2">{localText(step.does)}</p>
            <StepFacts doc={doc} stepId={step.id} />
          </details>
        </li>)}
      </ol>}
      {doc.steps.length === 0 && <p className="text-muted-foreground">{text("noSteps")}</p>}
    </section>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">{text("skills", { count: doc.skills.length })}</summary>
      <ul className="mt-3 space-y-3">
        {doc.skills.map((skill) => {
          const installed = readiness?.skills.some((s) => s.runtimeName === skill.name && s.installed);
          // A hub skill is read as its pinned revision from the hub, whatever copy the project has.
          const hub = skill.source === "hub" && skill.hub ? skill.hub : null;
          const hubState = hub ? readiness?.skills.find((s) => s.runtimeName === skill.name)?.hub?.state : undefined;
          const readable = Boolean(hub) || Boolean(loadSkillSource && skill.source !== "imported") || Boolean(projectId && installed);
          return <li key={skill.name} className="space-y-1">
            <p className="font-medium">{localText(skill.title) || skill.name}</p>
            <p className="text-muted-foreground">{text(`source.${skill.source}`)}{skill.ref ? ` · ${skill.ref}` : ""}{hub ? ` · ${text("hubRevision", { revision: hub.revision })}` : ""}</p>
            {hubState && hubState !== "installed" && <p>{text(`hubState.${hubState}`)}</p>}
            {skill.purpose && <p>{localText(skill.purpose)}</p>}
            <div className="flex flex-wrap gap-2">
              {readable && <Button variant="outline" size="sm" onClick={() => setReading(skill.name)}>{text("instructions.button")}</Button>}
              {hub && <Button variant="ghost" size="sm" asChild><a href={`#hub/s/${encodeURIComponent(hub.skillId)}`}>{text("hubOpen")}</a></Button>}
            </div>
            {reading === skill.name && (hub
              ? <RemoteSkillSource key={skill.name} name={skill.name} load={() => loadHubSkillSource(hub.skillId, hub.revision)} onBack={() => setReading(null)} />
              : skill.source !== "imported" && loadSkillSource
              ? <RemoteSkillSource key={skill.name} name={skill.name} load={loadSkillSource} onBack={() => setReading(null)} />
              : projectId && <SkillInstructions key={skill.name} name={skill.name} scope="project" projectId={projectId} onBack={() => setReading(null)} />)}
          </li>;
        })}
      </ul>
    </details>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">{text("inputsChoices")}</summary>
      <div className="mt-3 space-y-3">
        <h4 className="font-medium">{text("inputs")}</h4>
        <ul className="list-disc space-y-1 pl-5">{doc.inputRoles.map((role) => <li key={role.id}>{localText(role.label)} · {text(role.required ? "required" : "optional")}{role.formats.length ? ` · ${role.formats.join(", ")}` : ""}{role.requiredWhen && <p>{localText(role.requiredWhen)}</p>}{role.example && <p className="text-gaid-ink-2">{text(role.example.synthetic ? "exampleSynthetic" : "example", { title: localText(role.example.title), source: localText(role.example.source), size: sizeText(role.example.files.reduce((sum, file) => sum + file.size, 0)), where: text(role.example.files.some((file) => file.url) ? "exampleRemote" : "exampleBundled") })}</p>}</li>)}</ul>
        <h4 className="font-medium">{text("choices")}</h4>
        <ul className="space-y-3">{doc.choices.map((choice) => <li key={choice.id}>
          <p className="font-medium">{localText(choice.label)}</p>
          {choice.why && <p className="text-muted-foreground">{localText(choice.why)}</p>}
          {choice.requiredWhen && <p>{localText(choice.requiredWhen)}</p>}
          {choice.options?.length ? <ul className="list-disc pl-5">{choice.options.map((option) => <li key={option}>{localText(choice.optionLabels?.[option]) || option}</li>)}</ul> : <p className="text-muted-foreground">{text("openChoice")}</p>}
        </li>)}</ul>
      </div>
    </details>
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer font-medium">{text("resultsLimits")}</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5">{doc.artifacts.map((artifact) => <li key={artifact.id}>{localText(artifact.label)} · {text(artifact.required ? "required" : "optional")}{artifact.files?.length ? <p>{artifact.files.join(", ")}</p> : null}{artifact.requiredWhen && <p>{localText(artifact.requiredWhen)}</p>}</li>)}</ul>
      {doc.boundary && <p className="mt-3 text-muted-foreground">{localText(doc.boundary)}</p>}
    </details>
    <WorkflowInstructions doc={doc} />
    {exportAction && <div className="flex flex-wrap gap-2">{exportAction}</div>}
  </div>;
}

/** The start summary uses the same renderer and current values as the chat start message. */
export function WorkflowInstructions({ doc, target = "preview", settings }: { doc: WorkflowDoc; target?: WorkflowDocTarget; settings?: WorkflowDocSettings }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const body = workflowDocText(doc, target, settings);
  return <details className="rounded-lg border p-3 text-sm">
    <summary className="cursor-pointer font-medium">{text("agentInstructions")}</summary>
    <div className="mt-3 space-y-2">
      <Button variant="outline" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(body); setCopyState("copied"); }
        catch { setCopyState("failed"); }
      }}>{text("copy.button")}</Button>
      <span role="status" className="ml-2 text-muted-foreground">{copyState !== "idle" ? text(`copy.${copyState}`) : ""}</span>
      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-sans text-sm">{body}</pre>
    </div>
  </details>;
}

export function StepFacts({ doc, stepId }: { doc: WorkflowDoc; stepId: string }) {
  const step = doc.steps.find((s) => s.id === stepId);
  if (!step) return null;
  const decisions = doc.choices.filter((c) => step.choiceIds.includes(c.id));
  const outputs = doc.artifacts.filter((a) => step.outputs.includes(a.id));
  return <div className="mt-2 space-y-2 text-sm">
    {step.skill && <p className="text-muted-foreground">{text("stepSkill", { name: step.skill })}{step.read ? ` · ${localText(step.read)}` : ""}</p>}
    {step.checks.length > 0 && <div><h5 className="font-medium">{text("checks")}</h5><ul className="list-disc pl-5">{step.checks.map((c, i) => <li key={i}>{localText(c)}</li>)}</ul></div>}
    {decisions.length > 0 && <div><h5 className="font-medium text-[var(--gaid-warning)]">{text("choices")}</h5><ul className="list-disc pl-5">{decisions.map((c) => <li key={c.id}>{localText(c.label)}</li>)}</ul></div>}
    {outputs.length > 0 && <p>{text("stepOutputs", { names: outputs.map((a) => localText(a.label)).join(", ") })}</p>}
  </div>;
}

function RemoteSkillSource({ name, load, onBack }: { name: string; load: SkillSourceLoader; onBack: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Load only on explicit request. The parent keys this reader by skill name.
  useEffect(() => {
    let alive = true;
    void load(name).then((r) => { if (alive) setContent(r.content); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [name, load]);
  return <section className="space-y-2 rounded-lg border p-3">
    <Button variant="outline" size="sm" onClick={onBack}>{text("close.button")}</Button>
    {failed ? <p role="alert">{text("sourceError")}</p> : content === null ? <p role="status">{text("loading")}</p> : <pre aria-label="SKILL.md" className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words text-sm">{content}</pre>}
  </section>;
}
