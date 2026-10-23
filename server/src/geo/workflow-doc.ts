/**
 * Server side of the Workflow 지침 (gaid-workflow-model, ADR docs/adr/2026-10-20-workflow-runtime-form.md).
 *
 * `workflowDocFor` turns a stored Workflow into the IO-free `WorkflowDoc` (web/src/geo/contracts/workflow-doc.ts):
 * a gaid-workflow/v1 Workflow with `steps` is used as written; an older geo-workflow/v1 Workflow (catalogue Workflows,
 * hub packages registered before gaid-workflow/v1) gets steps derived from its primary skill's procedure (catalogue
 * details JSON or the package's atlas.yaml). Stored files are only read. `workflowDocSay` formats the `workflowDoc`
 * locale catalogue for server-rendered text (CLI export).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { formatMessage } from "../../../web/src/geo/icu.ts";
import type { Localized, WorkflowArtifact, WorkflowChoice } from "../../../web/src/geo/contracts/workspace.ts";
import {
  WORKFLOW_DOC_SCHEMA,
  legacyWorkflowDoc,
  type SkillProcedureStep,
  type WorkflowDoc,
  type WorkflowDocSay,
  type WorkflowDocSkill,
  type WorkflowDocStep,
  type WorkflowSkillSource,
} from "../../../web/src/geo/contracts/workflow-doc.ts";
import type { GeoCatalogue } from "./catalogue.ts";
import type { GeoWorkflow } from "./catalogue-types.ts";

const MAX_PROCEDURE_BYTES = 2 * 1024 * 1024;

function text(value: unknown): Localized | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { ko, en } = value as { ko?: unknown; en?: unknown };
  if (typeof ko !== "string" || !ko.trim()) return null;
  return typeof en === "string" && en.trim() ? { ko, en } : { ko };
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** Procedure nodes in the shape both the catalogue details and atlas.yaml use. */
export function procedureSteps(profile: unknown): SkillProcedureStep[] | null {
  const nodes = (profile as { procedure?: { nodes?: unknown } } | null)?.procedure?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const steps: SkillProcedureStep[] = [];
  for (const node of nodes) {
    const record = node as Record<string, unknown> | null;
    const label = text(record?.label);
    if (!record || typeof record.id !== "string" || !label) continue;
    steps.push({
      id: record.id,
      label,
      summary: text(record.summary),
      checks: Array.isArray(record.checks) ? record.checks.map(text).filter((item): item is Localized => Boolean(item)) : [],
      decisionIds: strings(record.decisionIds),
    });
  }
  return steps.length ? steps : null;
}

function readBounded(file: string): string | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_PROCEDURE_BYTES) return null;
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** The procedure of a catalogue skill (`catalogue/details/<publisher>/<slug>.json`). */
export function catalogueProcedure(catalogue: GeoCatalogue, atlasId: string): SkillProcedureStep[] | null {
  if (typeof catalogue.root !== "string") return null;
  const [publisher, slug, extra] = atlasId.split("/");
  if (!publisher || !slug || extra !== undefined || !/^[a-z0-9-]+$/.test(publisher) || !/^[a-z0-9-]+$/.test(slug)) return null;
  const raw = readBounded(path.join(catalogue.root, "catalogue", "details", publisher, `${slug}.json`));
  if (!raw) return null;
  try {
    return procedureSteps((JSON.parse(raw) as { profile?: unknown }).profile);
  } catch {
    return null;
  }
}

/** The procedure in an installed hub package's `atlas.yaml`. */
export function packageProcedure(skillDir: string): SkillProcedureStep[] | null {
  const raw = readBounded(path.join(skillDir, "atlas.yaml"));
  if (!raw) return null;
  try {
    return procedureSteps(parseYaml(raw));
  } catch {
    return null;
  }
}

export interface WorkflowDocContext {
  /** Registered hub version (gaid-hub-versions); null/absent for catalogue Workflows and drafts. */
  version?: string | null;
  /** The Workflow's skills resolved to runtime names, in `skillIds` order (primary first). */
  skills: { name: string; title?: Localized | null; source: WorkflowSkillSource; ref?: string | null }[];
  /** Procedure of the primary skill, for an older Workflow without its own steps. */
  procedure?: SkillProcedureStep[] | null;
}

function roles(workflow: GeoWorkflow): WorkflowDoc["inputRoles"] {
  return (workflow.inputRoles ?? []).map((role) => ({
    id: role.id,
    label: text(role.label) ?? { ko: role.id },
    formats: strings(role.formats),
    required: role.required === true,
    ...(text((role as { requiredWhen?: unknown }).requiredWhen) ? { requiredWhen: text((role as { requiredWhen?: unknown }).requiredWhen)! } : {}),
  }));
}

function choices(workflow: GeoWorkflow): WorkflowChoice[] {
  return (workflow.requiredScientificChoices ?? []).map((raw) => {
    const choice = raw as Record<string, unknown> & { id: string };
    const labels: Record<string, Localized> = {};
    for (const [key, value] of Object.entries((choice.optionLabels ?? {}) as Record<string, unknown>)) {
      const label = text(value);
      if (label) labels[key] = label;
    }
    return {
      id: choice.id,
      label: text(choice.label) ?? { ko: choice.id },
      ...(text(choice.why) ? { why: text(choice.why)! } : {}),
      ...(strings(choice.options).length ? { options: strings(choice.options) } : {}),
      ...(Object.keys(labels).length ? { optionLabels: labels } : {}),
    };
  });
}

function artifacts(workflow: GeoWorkflow): WorkflowArtifact[] {
  return ((workflow.expectedArtifacts ?? []) as Record<string, unknown>[]).flatMap((artifact) => typeof artifact?.id === "string" ? [{
    id: artifact.id,
    label: text(artifact.label) ?? { ko: artifact.id },
    required: artifact.required === true,
    ...(strings(artifact.files).length ? { files: strings(artifact.files) } : {}),
  }] : []);
}

/** gaid-workflow/v1 `skills[]` as written; unknown entries are dropped. */
function ownSkills(workflow: GeoWorkflow): WorkflowDocSkill[] {
  return ((workflow.skills ?? []) as Record<string, unknown>[]).flatMap((skill) => {
    if (typeof skill?.name !== "string" || !["catalogue", "bundled", "imported", "hub"].includes(skill.source as string)) return [];
    const hub = skill.hub as { skillId?: unknown; revision?: unknown; treeHash?: unknown } | undefined;
    const pin = skill.source === "hub" && typeof hub?.skillId === "string" && Number.isSafeInteger(hub.revision) && typeof hub.treeHash === "string"
      ? { skillId: hub.skillId, revision: hub.revision as number, treeHash: hub.treeHash } : null;
    if (skill.source === "hub" && !pin) return [];
    return [{
      name: skill.name,
      source: skill.source as WorkflowSkillSource,
      role: skill.role === "primary" ? "primary" as const : "supporting" as const,
      ...(typeof skill.ref === "string" ? { ref: skill.ref } : {}),
      ...(pin ? { hub: pin } : {}),
      ...(text(skill.purpose) ? { purpose: text(skill.purpose) } : {}),
      ...(text(skill.title) ? { title: text(skill.title) } : {}),
    }];
  });
}

function ownSteps(workflow: GeoWorkflow): WorkflowDocStep[] {
  return ((workflow.steps ?? []) as Record<string, unknown>[]).flatMap((step) => {
    const title = text(step?.title);
    if (typeof step?.id !== "string" || !title) return [];
    return [{
      id: step.id,
      title,
      does: text(step.does) ?? title,
      skill: typeof step.skill === "string" ? step.skill : null,
      read: text(step.read),
      checks: Array.isArray(step.checks) ? step.checks.map(text).filter((item): item is Localized => Boolean(item)) : [],
      choiceIds: strings(step.choiceIds),
      outputs: strings(step.outputs),
    }];
  });
}

/** A Workflow's 지침 document (structured when it has its own steps, else derived). */
export function workflowDocFor(workflow: GeoWorkflow, context: WorkflowDocContext): WorkflowDoc {
  const steps = workflow.schemaVersion === WORKFLOW_DOC_SCHEMA ? ownSteps(workflow) : [];
  if (steps.length) {
    const declared = ownSkills(workflow);
    const resolvedTitles = new Map(context.skills.map((skill) => [skill.name, skill.title ?? null]));
    return {
      schemaVersion: WORKFLOW_DOC_SCHEMA,
      kind: "structured",
      id: workflow.id,
      title: text(workflow.title) ?? { ko: workflow.id },
      version: context.version ?? null,
      purpose: text(workflow.description),
      inputRoles: roles(workflow),
      choices: choices(workflow),
      skills: (declared.length ? declared : context.skills.map((skill, i) => ({ ...skill, role: i === 0 ? "primary" as const : "supporting" as const })))
        .map((skill) => ({ ...skill, title: skill.title ?? resolvedTitles.get(skill.name) ?? null })),
      steps,
      artifacts: artifacts(workflow),
      boundary: text(workflow.boundary),
      instructions: text(workflow.prompt),
    };
  }
  return legacyWorkflowDoc({
    id: workflow.id,
    title: text(workflow.title) ?? { ko: workflow.id },
    description: text(workflow.description),
    inputRoles: roles(workflow),
    requiredScientificChoices: choices(workflow),
    prompt: text(workflow.prompt),
    expectedArtifacts: artifacts(workflow),
    boundary: text(workflow.boundary),
    version: context.version ?? null,
    skills: context.skills,
    procedure: context.procedure ?? null,
  });
}

// --- Wording for server-rendered text ----------------------------------------------------------------------------

const LOCALE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../web/src/geo/locales/workflowDoc");
const catalogues = new Map<string, Record<string, string>>();

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, child] of Object.entries((value ?? {}) as Record<string, unknown>)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object") flatten(child, id, out);
    else if (typeof child === "string") out[id] = child;
  }
  return out;
}

function catalogue(locale: "ko" | "en"): Record<string, string> {
  let entries = catalogues.get(locale);
  if (!entries) {
    entries = flatten(JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, `${locale}.json`), "utf8")));
    catalogues.set(locale, entries);
  }
  return entries;
}

/** `say` for renderWorkflowDocument on the server: same catalogue and formatter as the web's `t`. */
export function workflowDocSay(locale: "ko" | "en"): WorkflowDocSay {
  return (key, values = {}) => {
    const message = catalogue(locale)[key] ?? catalogue("ko")[key];
    return message === undefined ? key : formatMessage(message, locale, values);
  };
}
