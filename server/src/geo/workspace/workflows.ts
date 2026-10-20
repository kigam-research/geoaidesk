/**
 * Catalogue workflows with their readiness in the active project
 * (`GET /geo/workflows`, contract web/src/geo/contracts/workspace.ts).
 *
 * Readiness keeps three facts apart (skill_hub gaid-product.md §4):
 *   - skills: each workflow skill is installed and enabled in the project;
 *   - environment: every declared module imports in the project environment;
 *   - run record: the workflow names an install-kind evidence record.
 * `ready` needs the first two. A missing run record never blocks and is never
 * turned into a positive claim.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import type {
  GeoWorkflowSummary,
  Localized,
  WorkflowEnvironmentState,
  WorkflowReadiness,
  WorkflowSkillState,
} from "../../../../web/src/geo/contracts/workspace.ts";
import type { GeoCatalogue } from "../catalogue.ts";
import type { GeoWorkflow, LocalizedText } from "../catalogue-types.ts";
import type { EnvironmentReadiness, GeoEnvironmentService } from "../environments.ts";
import { extensionsFor } from "./formats.ts";
import type { WorkflowDoc } from "../../../../web/src/geo/contracts/workflow-doc.ts";
import { catalogueProcedure, workflowDocFor } from "../workflow-doc.ts";

type RawRole = { id: string; label: LocalizedText; formats?: string[]; required?: boolean; requiredWhen?: LocalizedText };
type RawChoice = { id: string; label: LocalizedText; why?: LocalizedText; options?: unknown[]; optionLabels?: Record<string, unknown>; requiredWhen?: LocalizedText };
type RawArtifact = { id: string; label: LocalizedText; required?: boolean; requiredWhen?: LocalizedText; files?: unknown[] };

function text(value: unknown): Localized | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { ko?: unknown; en?: unknown };
  if (typeof record.ko !== "string") return null;
  return typeof record.en === "string" ? { ko: record.ko, en: record.en } : { ko: record.ko };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** A project skill directory of that name: `enabled` under .pi/skills, else under .pi/skills-disabled. */
export function projectSkillState(paths: ProjectPaths, runtimeName: string): { installed: boolean; enabled: boolean } {
  const enabled = fs.existsSync(path.join(paths.skillsDir, runtimeName, "SKILL.md"));
  if (enabled) return { installed: true, enabled: true };
  const disabled = fs.existsSync(path.join(paths.sandbox, ".pi", "skills-disabled", runtimeName, "SKILL.md"));
  return { installed: disabled, enabled: false };
}

export function workflowSkills(paths: ProjectPaths, catalogue: GeoCatalogue, workflow: GeoWorkflow): WorkflowSkillState[] {
  return workflow.skillIds.map((id) => {
    const entry = catalogue.index.skills.find((skill) => skill.id === id);
    const runtimeName = entry?.runtimeName ?? null;
    const state = runtimeName ? projectSkillState(paths, runtimeName) : { installed: false, enabled: false };
    return { id, runtimeName, title: text(entry?.title), ...state };
  });
}

export function environmentState(
  catalogue: GeoCatalogue,
  envId: string,
  readiness: EnvironmentReadiness | Error | undefined,
): WorkflowEnvironmentState {
  const env = catalogue.environments?.environments.find((candidate) => candidate.id === envId);
  const title = text(env?.title);
  if (!env) return { id: envId, title, state: "unknown", missing: [], detail: "Environment not declared in the catalogue" };
  if (!env.targets.includes("project")) {
    return { id: envId, title, state: "unknown", missing: [], detail: "Environment has no project target" };
  }
  if (!readiness) return { id: envId, title, state: "unknown", missing: [], detail: "Not probed" };
  if (readiness instanceof Error) return { id: envId, title, state: "unknown", missing: [], detail: readiness.message };
  const missing = [
    ...readiness.distributions.filter((row) => row.status !== "ok").map((row) => row.name),
    ...readiness.imports.filter((row) => row.status !== "ok").map((row) => `import ${row.module}`),
    ...readiness.tools.filter((row) => row.status !== "ok" && !row.optional).map((row) => row.name),
  ];
  return { id: envId, title, state: readiness.ready && missing.length === 0 ? "ready" : "missing", missing };
}

export function readinessOf(
  workflow: GeoWorkflow,
  skills: WorkflowSkillState[],
  environment: WorkflowEnvironmentState,
): WorkflowReadiness {
  const compatibilityRef = typeof workflow.compatibilityRef === "string" && workflow.compatibilityRef ? workflow.compatibilityRef : null;
  const shipped = skills.every((skill) => skill.runtimeName);
  const state = !shipped
    ? "unavailable"
    : skills.some((skill) => !skill.enabled)
      ? "missing-skills"
      : environment.state !== "ready"
        ? "needs-environment"
        : "ready";
  return { state, skills, environment, runRecord: compatibilityRef ? "recorded" : "none", compatibilityRef };
}

/** Display labels of a choice's options (gaid-method/v1 `optionLabels`); ids without a label show as ids. */
function optionLabels(choice: RawChoice): Record<string, Localized> | null {
  if (!choice.optionLabels || typeof choice.optionLabels !== "object") return null;
  const out: Record<string, Localized> = {};
  for (const option of strings(choice.options)) {
    const label = text(choice.optionLabels[option]);
    if (label) out[option] = label;
  }
  return Object.keys(out).length ? out : null;
}

export function summarizeWorkflow(workflow: GeoWorkflow, readiness: WorkflowReadiness, doc?: WorkflowDoc): GeoWorkflowSummary {
  const roles = (workflow.inputRoles ?? []) as RawRole[];
  const choices = (workflow.requiredScientificChoices ?? []) as RawChoice[];
  const artifacts = (workflow.expectedArtifacts ?? []) as RawArtifact[];
  return {
    id: workflow.id,
    title: text(workflow.title) ?? { ko: workflow.id },
    description: text(workflow.description),
    disciplines: strings(workflow.disciplines),
    inputRoles: roles.map((role) => ({
      id: role.id,
      label: text(role.label) ?? { ko: role.id },
      formats: strings(role.formats),
      extensions: extensionsFor(strings(role.formats)),
      required: role.required === true,
      ...(text(role.requiredWhen) ? { requiredWhen: text(role.requiredWhen)! } : {}),
    })),
    requiredScientificChoices: choices.map((choice) => ({
      id: choice.id,
      label: text(choice.label) ?? { ko: choice.id },
      ...(text(choice.why) ? { why: text(choice.why)! } : {}),
      ...(strings(choice.options).length ? { options: strings(choice.options) } : {}),
      ...(optionLabels(choice) ? { optionLabels: optionLabels(choice)! } : {}),
      ...(text(choice.requiredWhen) ? { requiredWhen: text(choice.requiredWhen)! } : {}),
    })),
    prompt: text(workflow.prompt),
    skillIds: [...workflow.skillIds],
    environmentProfile: workflow.environmentProfile,
    expectedArtifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      label: text(artifact.label) ?? { ko: artifact.id },
      required: artifact.required === true,
      ...(text(artifact.requiredWhen) ? { requiredWhen: text(artifact.requiredWhen)! } : {}),
      ...(strings(artifact.files).length ? { files: strings(artifact.files) } : {}),
    })),
    boundary: text(workflow.boundary),
    exampleCaseIds: strings(workflow.exampleCaseIds),
    readiness,
    ...(doc ? { doc } : {}),
  };
}

/**
 * Every catalogue workflow with readiness. Environments are probed once per
 * distinct profile (the service caches probes for a minute).
 */
export async function listWorkflows(
  paths: ProjectPaths,
  catalogue: GeoCatalogue,
  service: Pick<GeoEnvironmentService, "readiness">,
): Promise<GeoWorkflowSummary[]> {
  const probes = new Map<string, EnvironmentReadiness | Error | undefined>();
  const data = catalogue.environments;
  await Promise.all(
    [...new Set(catalogue.workflows.map((workflow) => workflow.environmentProfile))].map(async (envId) => {
      const env = data?.environments.find((candidate) => candidate.id === envId);
      if (!data || !env?.targets.includes("project")) return;
      try {
        probes.set(envId, await service.readiness(data, envId, "project", paths.sandbox));
      } catch (error) {
        probes.set(envId, error as Error);
      }
    }),
  );
  return catalogue.workflows.map((workflow) => {
    const skills = workflowSkills(paths, catalogue, workflow);
    const environment = environmentState(catalogue, workflow.environmentProfile, probes.get(workflow.environmentProfile));
    return summarizeWorkflow(workflow, readinessOf(workflow, skills, environment), catalogueWorkflowDoc(catalogue, workflow, skills));
  });
}

/** The 지침 document of a catalogue Workflow: steps from its primary skill's catalogue procedure. */
export function catalogueWorkflowDoc(catalogue: GeoCatalogue, workflow: GeoWorkflow, skills: WorkflowSkillState[]): WorkflowDoc {
  return workflowDocFor(workflow, {
    revision: null,
    skills: skills.map((skill) => ({ name: skill.runtimeName ?? skill.id, title: skill.title, source: "catalogue" as const })),
    procedure: workflow.skillIds[0] ? catalogueProcedure(catalogue, workflow.skillIds[0]) : null,
  });
}
