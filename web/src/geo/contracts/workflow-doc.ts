/**
 * The Workflow 지침 (gaid-workflow-model, ADR docs/adr/2026-10-20-workflow-runtime-form.md): a Workflow reaches the
 * agent as one instruction document rendered here from its structured parts. The hub preview, the project preview, the
 * start settings summary, the chat's first message and the CLI export all call `renderWorkflowDocument`, so every
 * place shows the text the agent receives.
 *
 * IO-free and shared by server and web. Fixed wording comes through `say` (locale namespace `workflowDoc`): the web
 * passes `t`, the server a formatter over the same catalogue.
 */
import type { Localized, WorkflowArtifact, WorkflowChoice } from "./workspace";
import type { WorkflowInputExample } from "./workflow-examples";

export const WORKFLOW_DOC_SCHEMA = "gaid-workflow/v1";

/**
 * Where a skill comes from. `bundled` ships inside the Workflow's package; `imported` came from GitHub or similar;
 * `hub` is a hub-managed skill pinned by revision (contracts/hub-skills.ts, ADR docs/adr/2026-10-22-hub-managed-skills.md).
 */
export type WorkflowSkillSource = "catalogue" | "bundled" | "imported" | "hub";

/** Pin of a hub-managed skill revision (same shape as `HubSkillRef` in hub-skills.ts). */
export interface WorkflowHubSkillPin {
  skillId: string;
  revision: number;
  treeHash: string;
}

export interface WorkflowDocSkill {
  /** Runtime skill name (the SKILL.md folder name the agent sees). */
  name: string;
  title?: Localized | null;
  source: WorkflowSkillSource;
  /** For `imported`: where it came from (`owner/repo`, Git URL) and the ref, so readiness can offer to import it. */
  ref?: string | null;
  /** For `hub`: the pinned hub skill revision. */
  hub?: WorkflowHubSkillPin | null;
  role: "primary" | "supporting";
  /** What the Workflow uses it for. */
  purpose?: Localized | null;
}

/** A step as stored in a gaid-workflow/v1 Workflow (list fields optional); `WorkflowDocStep` is the filled form. */
export interface GaidWorkflowStep {
  id: string;
  title: Localized;
  does: Localized;
  skill?: string | null;
  read?: Localized | null;
  checks?: Localized[];
  /** Input role ids this step first uses (gaid-workflow-stages); the start window shows them on this step's page. */
  inputIds?: string[];
  choiceIds?: string[];
  outputs?: string[];
}

export interface WorkflowDocStep {
  id: string;
  title: Localized;
  /** One or two sentences: what the agent does in this step. */
  does: Localized;
  /** Runtime name of the skill this step uses. */
  skill?: string | null;
  /** Which part of that skill to read first (a SKILL.md section title). */
  read?: Localized | null;
  checks: Localized[];
  /** Ids of `inputRoles` this step first uses (empty for Workflows written before stages). */
  inputIds?: string[];
  /** Ids of `choices` this step depends on (researcher decisions). */
  choiceIds: string[];
  /** Ids of `artifacts` this step writes. */
  outputs: string[];
}

/**
 * `structured`: steps are the Workflow's own. `legacy`: a geo-workflow/v1 Workflow whose steps were derived from its
 * primary skill's procedure; the skill's SKILL.md holds the detailed procedure.
 */
export type WorkflowDocKind = "structured" | "legacy";

export interface WorkflowDoc {
  schemaVersion: typeof WORKFLOW_DOC_SCHEMA;
  kind: WorkflowDocKind;
  id: string;
  title: Localized;
  /** Registered hub version (gaid-hub-versions, e.g. 0.1.2); null for catalogue Workflows and drafts (초안). */
  version: string | null;
  purpose: Localized | null;
  inputRoles: { id: string; label: Localized; formats: string[]; required: boolean; requiredWhen?: Localized; multiple?: boolean; example?: WorkflowInputExample }[];
  choices: WorkflowChoice[];
  skills: WorkflowDocSkill[];
  steps: WorkflowDocStep[];
  artifacts: WorkflowArtifact[];
  boundary: Localized | null;
  /** The author's free-text instructions (a geo-workflow/v1 `prompt`); shown as its own section. */
  instructions: Localized | null;
}

/**
 * The researcher's start settings: input role id → project path (several paths for a `multiple` input), choice id →
 * option id or free text.
 */
export interface WorkflowDocSettings {
  inputs: Record<string, string | string[]>;
  choices: Record<string, string>;
  /** Input role ids whose path is the Workflow's example data (gaid-workflow-example), not the researcher's own file. */
  examples?: string[];
  /**
   * The Workflow's source papers in the project's citation scope (gaid-workflow-cite-scope): citation key and title.
   * Named in the chat start message so the agent can cite them in the research note.
   */
  papers?: { key: string; title: string }[];
}

/**
 * `chat`: the first message, settings filled in. `preview`: hub/project view; settings shown as what the researcher
 * will choose. `cli`: a prompt file for a CLI agent; settings come from the command's arguments.
 */
export type WorkflowDocTarget = "chat" | "preview" | "cli";

export type WorkflowDocSay = (key: string, values?: Record<string, string | number>) => string;

export interface RenderOptions {
  locale: "ko" | "en";
  target: WorkflowDocTarget;
  say: WorkflowDocSay;
  /** Researcher settings; used by `chat` (and by `preview` when given). */
  settings?: WorkflowDocSettings | null;
}

const pick = (value: Localized | null | undefined, locale: "ko" | "en") =>
  value ? (locale === "en" ? value.en ?? value.ko : value.ko) : "";

const optionText = (choice: WorkflowChoice, value: string, locale: "ko" | "en") => {
  const label = choice.optionLabels?.[value];
  return label ? pick(label, locale) : value;
};

/** A setting's paths as one line (a `multiple` input joins its files). */
export const settingPaths = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((path) => path.trim()).filter(Boolean).join(", ");

/** Render the Workflow 지침 as Markdown. Deterministic: same doc, settings and locale give the same text. */
export function renderWorkflowDocument(doc: WorkflowDoc, options: RenderOptions): string {
  const { locale, target, say } = options;
  const p = (value: Localized | null | undefined) => pick(value, locale);
  const settings = target === "cli" ? null : options.settings ?? null;
  const lines: string[] = [];
  const title = p(doc.title);
  lines.push(doc.version ? say("heading.titleVersion", { title, version: doc.version }) : say("heading.title", { title }));
  if (p(doc.purpose)) lines.push("", p(doc.purpose));

  // Settings.
  lines.push("", `## ${say("section.settings")}`);
  const exampleTitle = (example: WorkflowInputExample) =>
    example.synthetic ? say("settings.syntheticTitle", { title: p(example.title) }) : p(example.title);
  const used = new Set(settings?.examples ?? []);
  if (target === "cli") {
    lines.push(say("settings.cliArguments"), "", "$ARGUMENTS", "", say("settings.cliAsk"));
    const bundledSkill = doc.skills.find((skill) => skill.source === "bundled")?.name ?? "";
    for (const role of doc.inputRoles) {
      const ask = say("settings.inputAsk", { label: p(role.label), need: say(role.required ? "need.required" : "need.optional") });
      if (!role.example) { lines.push(`- ${ask}`); continue; }
      const files = role.example.files.map((file) => file.path
        ? say("settings.cliExampleBundled", { skill: bundledSkill, path: file.path })
        : say("settings.cliExampleRemote", { url: file.url ?? "", sha256: file.sha256, size: file.size }));
      lines.push(`- ${ask}. ${say("settings.cliExample", { title: exampleTitle(role.example), source: p(role.example.source), files: files.join("; ") })}`);
    }
    for (const choice of doc.choices) lines.push(`- ${choiceAsk(choice, locale, say)}`);
    if (doc.inputRoles.some((role) => role.example)) lines.push("", say("settings.exampleRule"));
  } else {
    for (const role of doc.inputRoles) {
      const path = settingPaths(settings?.inputs[role.id]);
      const example = role.example && used.has(role.id) && path ? role.example : null;
      const value = example
        ? say("settings.exampleUsed", { path: path!, title: exampleTitle(example), source: p(example.source) })
        : path || (settings ? say("settings.notUsed") : role.example ? say("settings.researcherPicksExample", { title: exampleTitle(role.example) }) : say("settings.researcherPicks"));
      lines.push(`- ${p(role.label)}: ${value}`);
    }
    const unresolved: string[] = [];
    for (const choice of doc.choices) {
      const answer = settings?.choices[choice.id]?.trim();
      if (answer) lines.push(`- ${p(choice.label)}: ${optionText(choice, answer, locale)}`);
      else if (settings) unresolved.push(p(choice.label));
      else lines.push(`- ${choiceAsk(choice, locale, say)}`);
    }
    // A blank line ends the Markdown list, so these sentences do not join its last item.
    lines.push("");
    if (settings) lines.push(say("settings.unresolved", { list: unresolved.length ? unresolved.join(", ") : say("settings.none") }));
    if (settings && !unresolved.length) lines.push(say("settings.runThrough"));
    else lines.push(say("settings.askBeforeStep"));
    const exampleRoles = doc.inputRoles.filter((role) => role.example && used.has(role.id) && settingPaths(settings?.inputs[role.id]));
    if (exampleRoles.length) lines.push("", say("settings.examplesUsed", { labels: exampleRoles.map((role) => p(role.label)).join(", ") }), say("settings.exampleRule"));
  }

  const papers = settings?.papers ?? [];
  if (papers.length) {
    lines.push("", `## ${say("section.papers")}`);
    for (const paper of papers) lines.push(`- [@${paper.key}] ${paper.title}`);
    lines.push("", say("papers.rule"));
  }

  // Skills.
  if (doc.skills.length) {
    lines.push("", `## ${say("section.skills")}`);
    for (const skill of doc.skills) {
      const usedIn = doc.steps.flatMap((step, i) => (step.skill === skill.name ? [i + 1] : []));
      const parts = [say(`source.${skill.source}`)];
      if (skill.source === "imported" && skill.ref) parts.push(skill.ref);
      if (skill.source === "hub" && skill.hub) parts.push(say("skill.hubRevision", { revision: skill.hub.revision }));
      if (skill.role === "primary") parts.push(say("skill.primary"));
      const what = p(skill.purpose) || p(skill.title);
      const where = usedIn.length ? say("skill.usedIn", { steps: usedIn.join(", ") }) : "";
      lines.push(`- ${skill.name} (${parts.join(", ")})${what ? `: ${what}` : ""}${where ? ` ${where}` : ""}`);
    }
    lines.push("", say("skill.readRule"));
  }

  // Steps.
  if (doc.steps.length) {
    lines.push("", `## ${say("section.steps")}`);
    if (doc.kind === "legacy") {
      const primary = doc.skills.find((skill) => skill.role === "primary")?.name ?? doc.skills[0]?.name ?? "";
      lines.push(say("steps.legacy", { skill: primary }), "");
    }
    const choiceLabel = new Map(doc.choices.map((choice) => [choice.id, p(choice.label)]));
    const artifactLabel = new Map(doc.artifacts.map((artifact) => [artifact.id, p(artifact.label)]));
    const inputLabel = new Map(doc.inputRoles.map((role) => [role.id, p(role.label)]));
    doc.steps.forEach((step, i) => {
      const decisions = step.choiceIds.map((id) => choiceLabel.get(id)).filter((x): x is string => Boolean(x));
      const head = decisions.length ? say("step.headDecision", { title: p(step.title), decisions: decisions.join(", ") }) : p(step.title);
      lines.push(`${i + 1}. ${head}: ${p(step.does)}`);
      const inputs = (step.inputIds ?? []).map((id) => inputLabel.get(id)).filter((x): x is string => Boolean(x));
      if (inputs.length) lines.push(`   ${say("step.inputs", { inputs: inputs.join(", ") })}`);
      if (step.skill) lines.push(`   ${p(step.read) ? say("step.skillRead", { skill: step.skill, read: p(step.read) }) : say("step.skill", { skill: step.skill })}`);
      if (step.checks.length) lines.push(`   ${say("step.checks", { checks: step.checks.map(p).join(" / ") })}`);
      const outputs = step.outputs.map((id) => artifactLabel.get(id)).filter((x): x is string => Boolean(x));
      if (outputs.length) lines.push(`   ${say("step.outputs", { outputs: outputs.join(", ") })}`);
    });
  }

  if (p(doc.instructions)) lines.push("", `## ${say("section.instructions")}`, p(doc.instructions));

  if (doc.artifacts.length) {
    lines.push("", `## ${say("section.artifacts")}`);
    for (const artifact of doc.artifacts) {
      const need = say(artifact.required ? "need.required" : "need.optional");
      const files = artifact.files?.length ? `${artifact.files.join(", ")}: ` : "";
      lines.push(`- ${files}${p(artifact.label)} (${need})`);
    }
  }

  if (p(doc.boundary)) lines.push("", `## ${say("section.boundary")}`, p(doc.boundary));
  lines.push("", `## ${say("section.closing")}`, say("closing.review"));
  if (settings || target === "cli") lines.push(say("closing.examples"));
  return lines.join("\n");
}

function choiceAsk(choice: WorkflowChoice, locale: "ko" | "en", say: WorkflowDocSay) {
  const label = pick(choice.label, locale);
  const options = (choice.options ?? []).map((option) => optionText(choice, option, locale));
  const ask = options.length ? say("settings.choiceOptions", { label, options: options.join(" / ") }) : say("settings.choiceOpen", { label });
  return choice.default?.trim() ? `${ask} ${say("settings.choiceDefault", { value: optionText(choice, choice.default.trim(), locale) })}` : ask;
}

// --- Chat block ------------------------------------------------------------------------------------------------

/** Attribute values are kept to one line without quotes, so the block parses back exactly. */
const attr = (value: string) => value.replace(/["\n\r]/g, " ").trim();

/**
 * The chat's first message: the rendered document in a `<workflow>` block, then the researcher's own text. The
 * transcript shows the block as a "Workflow · <title> · version <x.y.z>" card (like the skill and template chips).
 */
export function workflowBlock(doc: Pick<WorkflowDoc, "id" | "title" | "version">, body: string, locale: "ko" | "en", options: { example?: boolean } = {}): string {
  const title = attr(pick(doc.title, locale));
  const version = doc.version ? ` version="${attr(doc.version)}"` : "";
  // `data="example"`: the run uses the Workflow's example data for at least one input (gaid-workflow-example).
  const data = options.example ? ` data="example"` : "";
  return `<workflow id="${attr(doc.id)}"${version} title="${title}"${data}>\n${body}\n</workflow>`;
}

export interface ParsedWorkflowBlock {
  id: string;
  title: string;
  /** Hub version; a block written before versions (`revision="n"`) reads as 0.1.(n-1). */
  version: string | null;
  body: string;
  /** Text after the block (the researcher's additions). */
  tail: string;
  /** The run uses the Workflow's example data for at least one input. */
  example: boolean;
}

const WORKFLOW_RE = /^<workflow id="([^"]*)"(?: revision="(\d+)"| version="(\d+\.\d+\.\d+)")? title="([^"]*)"( data="example")?>\n([\s\S]*?)\n<\/workflow>(?:\n\n([\s\S]+))?$/;

export function parseWorkflowBlock(text: string): ParsedWorkflowBlock | null {
  const match = text.match(WORKFLOW_RE);
  if (!match) return null;
  // Same rule as `legacyHubVersion` (hub-version.ts); no value import, the server loads contracts without a resolver.
  const version = match[3] ?? (match[2] ? `0.1.${Math.max(0, Number(match[2]) - 1)}` : null);
  return { id: match[1], version, title: match[4], body: match[6], tail: match[7] ?? "", example: Boolean(match[5]) };
}

// --- Older Workflows -------------------------------------------------------------------------------------------

/** A procedure step of a skill (hub `atlas.yaml` / catalogue details `profile.procedure.nodes`). */
export interface SkillProcedureStep {
  id: string;
  label: Localized;
  summary?: Localized | null;
  checks?: Localized[];
  decisionIds?: string[];
}

export interface LegacyWorkflowInput {
  id: string;
  title: Localized;
  description: Localized | null;
  inputRoles: WorkflowDoc["inputRoles"];
  requiredScientificChoices: WorkflowChoice[];
  prompt: Localized | null;
  expectedArtifacts: WorkflowArtifact[];
  boundary: Localized | null;
  version?: string | null;
  /** The Workflow's skills in `skillIds` order (primary first), resolved to runtime names. */
  skills: { name: string; title?: Localized | null; source: WorkflowSkillSource; ref?: string | null; hub?: WorkflowHubSkillPin | null }[];
  /** The primary skill's procedure; absent when unknown. */
  procedure?: SkillProcedureStep[] | null;
}

/**
 * Build a document for a geo-workflow/v1 Workflow (hub entries registered before gaid-workflow/v1, their installed
 * copies, catalogue Workflows). Steps come from the primary skill's procedure; stored data is not changed.
 */
export function legacyWorkflowDoc(input: LegacyWorkflowInput): WorkflowDoc {
  const choiceIds = new Set(input.requiredScientificChoices.map((choice) => choice.id));
  const primary = input.skills[0]?.name ?? null;
  return {
    schemaVersion: WORKFLOW_DOC_SCHEMA,
    kind: "legacy",
    id: input.id,
    title: input.title,
    version: input.version ?? null,
    purpose: input.description,
    inputRoles: input.inputRoles,
    choices: input.requiredScientificChoices,
    skills: input.skills.map((skill, i) => ({ ...skill, role: i === 0 ? "primary" : "supporting" })),
    steps: (input.procedure ?? []).map((node) => ({
      id: node.id,
      title: node.label,
      does: node.summary ?? node.label,
      skill: primary,
      read: null,
      checks: node.checks ?? [],
      inputIds: [],
      choiceIds: (node.decisionIds ?? []).filter((id) => choiceIds.has(id)),
      outputs: [],
    })),
    artifacts: input.expectedArtifacts,
    boundary: input.boundary,
    instructions: input.prompt,
  };
}
