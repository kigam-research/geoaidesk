/**
 * `gaid-method.json` (`gaid-method/v1`) inside a hub method package's skill
 * folder: launch contract plus the lifecycle the hub recorded. Contract:
 * docs/design/hub-method-package.md (GAID consumer side; skill_hub owns the
 * producer contract). Unknown keys are ignored, so the contract can grow
 * additively. Validation reports issues instead of throwing: an invalid file
 * still lists the method, without startable workflows.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  MethodAuthoringRecord,
  MethodHubChecks,
  MethodImplementation,
  MethodIssue,
  MethodLifecycle,
  MethodRecipe,
  MethodSourceRef,
} from "../../../../web/src/geo/contracts/methods.ts";
import { GAID_METHOD_FILE, GAID_METHOD_SCHEMA, LOCAL_SKILL_PREFIX } from "../../../../web/src/geo/contracts/methods.ts";
import type { GeoWorkflow, LocalizedText } from "../catalogue-types.ts";
import { EXAMPLE_LIMITS, exampleProblems } from "../../../../web/src/geo/contracts/workflow-examples.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ATLAS_ID = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const LIFECYCLES: MethodLifecycle[] = ["draft", "submitted", "published"];
const IMPLEMENTATIONS: MethodImplementation[] = ["descriptive", "implemented"];
const MAX_FILE_BYTES = 256 * 1024;
const MAX_WORKFLOWS = 20;
const MAX_LIST = 50;
const MAX_TEXT = 4000;

export interface MethodFile {
  methodId: string;
  revision: number;
  version: string | null;
  lifecycle: MethodLifecycle;
  implementation: MethodImplementation;
  codeOrigin: "supplied" | "generated" | null;
  title: LocalizedText;
  summary: LocalizedText | null;
  sources: MethodSourceRef[];
  checks: MethodHubChecks | null;
  authoring: MethodAuthoringRecord | null;
  workflows: GeoWorkflow[];
  recipes: MethodRecipe[];
  files: { path: string; sha256: string; size: number }[] | null;
  packageDigest: string | null;
}

export interface MethodFileResult {
  /** null: no `gaid-method.json` in the folder (a plain skill, not a method). */
  present: boolean;
  method: MethodFile | null;
  issues: MethodIssue[];
}

function localized(value: unknown): LocalizedText | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { ko, en } = value as { ko?: unknown; en?: unknown };
  if (typeof ko !== "string" || !ko.trim() || ko.length > MAX_TEXT) return null;
  if (en !== undefined && (typeof en !== "string" || en.length > MAX_TEXT)) return null;
  return typeof en === "string" && en.trim() ? { ko, en } : { ko };
}

function isEmptyText(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { ko, en } = value as { ko?: unknown; en?: unknown };
  return ko === "" && (en === undefined || en === "");
}

function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** Validate one workflow; skill ids must be the method's own `local:<name>` or catalogue Atlas ids. */
function workflow(value: unknown, index: number, runtimeName: string, issues: MethodIssue[]): GeoWorkflow | null {
  const at = `workflows[${index}]`;
  const add = (field: string, message: string) => issues.push({ subject: `${at}.${field}`, message });
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ subject: at, message: "Workflow must be an object" });
    return null;
  }
  const raw = value as Record<string, unknown>;
  const before = issues.length;
  if (typeof raw.id !== "string" || !SLUG.test(raw.id)) add("id", "id must be a slug");
  if (!localized(raw.title)) add("title", "title must be {ko, en?} text");
  const skills = list(raw.skillIds);
  if (!skills || skills.length === 0) add("skillIds", "skillIds must be a non-empty list");
  else {
    for (const id of skills) {
      if (typeof id !== "string") { add("skillIds", "skillIds must be strings"); continue; }
      if (id.startsWith(LOCAL_SKILL_PREFIX)) {
        if (id !== `${LOCAL_SKILL_PREFIX}${runtimeName}`) add("skillIds", `${id} is not this package's skill (${LOCAL_SKILL_PREFIX}${runtimeName})`);
      } else if (!ATLAS_ID.test(id)) add("skillIds", `${id} is neither ${LOCAL_SKILL_PREFIX}<name> nor publisher/slug`);
    }
    if (new Set(skills).size !== skills.length) add("skillIds", "skillIds must be unique");
  }
  if (typeof raw.environmentProfile !== "string" || !SLUG.test(raw.environmentProfile)) {
    add("environmentProfile", "environmentProfile must be a catalogue environment id");
  }
  for (const [field, item] of [["inputRoles", "id"], ["requiredScientificChoices", "id"], ["expectedArtifacts", "id"]] as const) {
    if (raw[field] === undefined) continue;
    const rows = list(raw[field]);
    if (!rows || rows.length > MAX_LIST) { add(field, `${field} must be a list of at most ${MAX_LIST}`); continue; }
    rows.forEach((row, n) => {
      const record = row as Record<string, unknown> | null;
      if (!record || typeof record !== "object" || typeof record[item] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(record[item] as string)) {
        add(`${field}[${n}]`, `${field} entries need a local id`);
      } else if (!localized(record.label)) add(`${field}[${n}].label`, "label must be {ko, en?} text");
    });
  }
  if (raw.inputRoles !== undefined && list(raw.inputRoles)?.some((role) => !Array.isArray((role as { formats?: unknown }).formats))) {
    add("inputRoles", "every input role needs formats (taxonomy format ids)");
  }
  // gaid-workflow-stages: an input may take several files; a choice's default is an option id (or text without options).
  (list(raw.inputRoles) ?? []).forEach((row, n) => {
    const multiple = (row as { multiple?: unknown } | null)?.multiple;
    if (multiple !== undefined && typeof multiple !== "boolean") add(`inputRoles[${n}].multiple`, "multiple must be true or false");
  });
  (list(raw.requiredScientificChoices) ?? []).forEach((row, n) => {
    const choice = row as { default?: unknown; options?: unknown } | null;
    if (!choice || choice.default === undefined) return;
    if (typeof choice.default !== "string" || !choice.default.trim() || choice.default.length > 200) add(`requiredScientificChoices[${n}].default`, "default must be non-empty text");
    else if (Array.isArray(choice.options) && choice.options.length && !choice.options.includes(choice.default)) add(`requiredScientificChoices[${n}].default`, "default must be one of options");
  });
  // gaid-workflow/v1: `prompt` holds only the author's additional instructions, so it may be empty ({ko: ""}).
  const emptyPrompt = raw.schemaVersion === "gaid-workflow/v1" && isEmptyText(raw.prompt);
  for (const field of ["description", "prompt", "boundary"] as const) {
    if (field === "prompt" && emptyPrompt) continue;
    if (raw[field] !== undefined && !localized(raw[field])) add(field, `${field} must be {ko, en?} text`);
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== "geo-workflow/v1" && raw.schemaVersion !== "gaid-workflow/v1") {
    add("schemaVersion", "schemaVersion must be geo-workflow/v1 or gaid-workflow/v1");
  }
  if (raw.schemaVersion === "gaid-workflow/v1") gaidWorkflowParts(raw, runtimeName, add);
  // gaid-workflow-example: an input role may declare default example data (bundled under examples/ or a public URL).
  let bundled = 0;
  (list(raw.inputRoles) ?? []).forEach((row, n) => {
    const role = row as { id?: unknown; example?: unknown } | null;
    if (!role || role.example === undefined) return;
    for (const problem of exampleProblems(role.example, String(role.id))) add(`inputRoles[${n}].${problem.split(" ")[0]}`, problem);
    for (const file of ((role.example as { files?: unknown })?.files as { path?: unknown; size?: unknown }[] | undefined) ?? [])
      if (file && typeof file.path === "string" && typeof file.size === "number") bundled += file.size;
  });
  if (bundled > EXAMPLE_LIMITS.bundledTotal) add("inputRoles", `bundled example files exceed ${EXAMPLE_LIMITS.bundledTotal} bytes`);
  return issues.length === before ? (raw as unknown as GeoWorkflow) : null;
}

const SKILL_SOURCES = ["catalogue", "bundled", "imported", "hub"];
const TREE_HASH = /^[a-f0-9]{64}$/;
const MAX_STEPS = 30;

/**
 * gaid-workflow/v1 additions (ADR docs/adr/2026-10-20-workflow-runtime-form.md): `skills[]` names every skill the
 * Workflow uses with its source; `steps[]` is the procedure the 지침 document lists. A step's skill must be one of
 * `skills`, its `choiceIds` choices and its `outputs` expected artifacts of this Workflow.
 */
function gaidWorkflowParts(raw: Record<string, unknown>, runtimeName: string, add: (field: string, message: string) => void): void {
  const names = new Set<string>();
  const skills = raw.skills === undefined ? [] : list(raw.skills);
  if (!skills || skills.length > MAX_LIST) add("skills", `skills must be a list of at most ${MAX_LIST}`);
  else skills.forEach((value, n) => {
    const skill = value as Record<string, unknown> | null;
    if (!skill || typeof skill.name !== "string" || !SLUG.test(skill.name)) return add(`skills[${n}].name`, "name must be a skill folder name");
    if (!SKILL_SOURCES.includes(skill.source as string)) add(`skills[${n}].source`, `source must be one of ${SKILL_SOURCES.join("|")}`);
    if (skill.source === "bundled" && skill.name !== runtimeName) add(`skills[${n}].name`, `a bundled skill must be this package's skill (${runtimeName})`);
    if (skill.role !== "primary" && skill.role !== "supporting") add(`skills[${n}].role`, "role must be primary|supporting");
    if (skill.ref !== undefined && (typeof skill.ref !== "string" || skill.ref.length > 500)) add(`skills[${n}].ref`, "ref must be text");
    // A hub skill is pinned by revision and tree hash (ADR docs/adr/2026-10-22-hub-managed-skills.md); its hub id is its name.
    if (skill.source === "hub") {
      const hub = skill.hub as Record<string, unknown> | null | undefined;
      if (!hub || typeof hub !== "object" || hub.skillId !== skill.name || !Number.isSafeInteger(hub.revision) || (hub.revision as number) < 1 || typeof hub.treeHash !== "string" || !TREE_HASH.test(hub.treeHash))
        add(`skills[${n}].hub`, "a hub skill needs hub {skillId (= name), revision >= 1, treeHash}");
    } else if (skill.hub !== undefined) add(`skills[${n}].hub`, "hub is only for source hub");
    for (const field of ["purpose", "title"] as const) {
      if (skill[field] !== undefined && !localized(skill[field])) add(`skills[${n}].${field}`, `${field} must be {ko, en?} text`);
    }
    if (names.has(skill.name)) add(`skills[${n}].name`, "skill names must be unique");
    names.add(skill.name);
  });
  const ids = (field: string) => new Set((list(raw[field]) ?? []).map((row) => (row as { id?: unknown })?.id).filter((id): id is string => typeof id === "string"));
  const choiceIds = ids("requiredScientificChoices");
  const outputIds = ids("expectedArtifacts");
  const inputIds = ids("inputRoles");
  const steps = list(raw.steps);
  if (!steps || steps.length === 0 || steps.length > MAX_STEPS) return add("steps", `steps must be a list of 1-${MAX_STEPS}`);
  const stepIds = new Set<string>();
  steps.forEach((value, n) => {
    const step = value as Record<string, unknown> | null;
    const at = `steps[${n}]`;
    if (!step || typeof step.id !== "string" || !SLUG.test(step.id)) return add(`${at}.id`, "id must be a slug");
    if (stepIds.has(step.id)) add(`${at}.id`, "step ids must be unique");
    stepIds.add(step.id);
    if (!localized(step.title)) add(`${at}.title`, "title must be {ko, en?} text");
    if (!localized(step.does)) add(`${at}.does`, "does must be {ko, en?} text");
    if (step.read !== undefined && step.read !== null && !localized(step.read)) add(`${at}.read`, "read must be {ko, en?} text");
    if (step.skill !== undefined && step.skill !== null && (typeof step.skill !== "string" || !names.has(step.skill))) add(`${at}.skill`, "skill must be one of skills[].name");
    const checks = step.checks === undefined ? [] : list(step.checks);
    if (!checks || checks.length > MAX_LIST || checks.some((check) => !localized(check))) add(`${at}.checks`, "checks must be a list of {ko, en?} text");
    const targets = { inputIds: "inputRoles", choiceIds: "requiredScientificChoices", outputs: "expectedArtifacts" } as const;
    for (const [field, known] of [["inputIds", inputIds], ["choiceIds", choiceIds], ["outputs", outputIds]] as const) {
      const refs = step[field] === undefined ? [] : list(step[field]);
      if (!refs || refs.some((ref) => typeof ref !== "string" || !known.has(ref))) add(`${at}.${field}`, `${field} must name this Workflow's ${targets[field]}`);
    }
  });
}

export function parseMethodFile(value: unknown, runtimeName: string): { method: MethodFile | null; issues: MethodIssue[] } {
  const issues: MethodIssue[] = [];
  const add = (subject: string, message: string) => issues.push({ subject, message });
  if (!value || typeof value !== "object" || Array.isArray(value)) return { method: null, issues: [{ subject: "$", message: "gaid-method.json must be a JSON object" }] };
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== GAID_METHOD_SCHEMA) add("schemaVersion", `schemaVersion must be ${GAID_METHOD_SCHEMA}`);
  // methodId = <owner>/<slug> with the package's own slug.
  if (typeof raw.methodId !== "string" || !ATLAS_ID.test(raw.methodId) || raw.methodId.split("/")[1] !== runtimeName) add("methodId", `methodId must be <owner>/${runtimeName}`);
  if (typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 1) add("revision", "revision must be a positive integer");
  if (raw.version !== undefined && (typeof raw.version !== "string" || !SEMVER.test(raw.version))) add("version", "version must be semver");
  if (!LIFECYCLES.includes(raw.lifecycle as MethodLifecycle)) add("lifecycle", `lifecycle must be one of ${LIFECYCLES.join(", ")}`);
  if (!IMPLEMENTATIONS.includes(raw.implementation as MethodImplementation)) add("implementation", `implementation must be one of ${IMPLEMENTATIONS.join(", ")}`);
  if (raw.codeOrigin !== undefined && raw.codeOrigin !== "supplied" && raw.codeOrigin !== "generated") add("codeOrigin", "codeOrigin must be supplied or generated");
  const title = localized(raw.title);
  if (!title) add("title", "title must be {ko, en?} text");
  if (raw.summary !== undefined && !localized(raw.summary)) add("summary", "summary must be {ko, en?} text");

  const sources: MethodSourceRef[] = [];
  const sourceRows = raw.sources === undefined ? [] : list(raw.sources);
  if (!sourceRows || sourceRows.length > MAX_LIST) add("sources", `sources must be a list of at most ${MAX_LIST}`);
  else sourceRows.forEach((row, n) => {
    const record = row as Record<string, unknown> | null;
    if (!record || !["doi", "url", "file"].includes(record.kind as string) || typeof record.ref !== "string" || !record.ref.trim() || record.ref.length > 2048) {
      add(`sources[${n}]`, "source needs kind doi|url|file and ref");
      return;
    }
    const text = (key: string, max: number) => (typeof record[key] === "string" ? { [key]: (record[key] as string).slice(0, max) } : {});
    sources.push({ kind: record.kind as MethodSourceRef["kind"], ref: record.ref, ...text("title", 500), ...text("documentKind", 100), ...text("pages", 200),
      ...(typeof record.sha256 === "string" && SHA256.test(record.sha256) ? { sha256: record.sha256 } : {}) });
  });

  let checks: MethodHubChecks | null = null;
  if (raw.checks !== undefined) {
    const record = raw.checks as Record<string, unknown> | null;
    const items = list(record?.items);
    const warnings = list(record?.warnings);
    if (!record || typeof record !== "object" || record.passed !== true || typeof record.checker !== "string" || typeof record.checkedAt !== "string" || !items || !warnings || items.length > MAX_LIST) {
      add("checks", "checks must be the hub receipt {passed: true, checker, checkedAt, items, warnings}");
    } else {
      checks = {
        checker: record.checker.slice(0, 200),
        checkedAt: record.checkedAt.slice(0, 64),
        items: items.flatMap((item) => {
          const row = item as Record<string, unknown> | null;
          if (!row || typeof row.id !== "string" || (row.status !== "pass" && row.status !== "warn")) { add("checks.items", "check items need id and status pass|warn"); return []; }
          return [{ id: row.id.slice(0, 50), status: row.status, ...(typeof row.detail === "string" ? { detail: row.detail.slice(0, 1000) } : {}) }];
        }),
        warnings: warnings.slice(0, MAX_LIST).flatMap((item) => {
          const row = item as Record<string, unknown> | null;
          return row && typeof row.code === "string" && typeof row.message === "string"
            ? [{ code: row.code.slice(0, 100), path: typeof row.path === "string" ? row.path.slice(0, 300) : "", message: row.message.slice(0, 1000) }]
            : [];
        }),
      };
    }
  }

  let authoring: MethodAuthoringRecord | null = null;
  if (raw.provenance !== undefined) {
    const record = raw.provenance as Record<string, unknown> | null;
    const hub = record?.hub as Record<string, unknown> | undefined;
    if (!record || typeof record !== "object" || !hub || typeof hub.projectId !== "string" || typeof hub.draftRevision !== "number") {
      add("provenance", "provenance must carry hub {url, projectId, draftRevision}");
    } else {
      const rows = (key: string) => (list(record[key]) ?? []).slice(0, MAX_LIST) as Record<string, unknown>[];
      authoring = {
        hubUrl: typeof hub.url === "string" ? hub.url.slice(0, 500) : "",
        projectId: hub.projectId.slice(0, 200),
        draftRevision: hub.draftRevision,
        decisions: typeof record.decisions === "number" ? record.decisions : 0,
        openQuestions: rows("openQuestions").filter((q) => typeof q?.id === "string" && typeof q.text === "string").map((q) => ({ id: (q.id as string).slice(0, 100), text: (q.text as string).slice(0, MAX_TEXT) })),
        attempts: rows("attempts").filter((a) => a && typeof a === "object").map((a) => ({ route: String(a.route ?? "").slice(0, 200), model: String(a.model ?? "").slice(0, 200), at: String(a.at ?? "").slice(0, 64), outcome: String(a.outcome ?? "").slice(0, 200) })),
      };
    }
  }

  const workflows: GeoWorkflow[] = [];
  const rows = raw.workflows === undefined ? [] : list(raw.workflows);
  if (!rows || rows.length > MAX_WORKFLOWS) add("workflows", `workflows must be a list of at most ${MAX_WORKFLOWS}`);
  else {
    rows.forEach((row, n) => { const valid = workflow(row, n, runtimeName, issues); if (valid) workflows.push(valid); });
    const ids = workflows.map((row) => row.id);
    if (new Set(ids).size !== ids.length) add("workflows", "workflow ids must be unique");
  }

  // 레시피: checked like checkGeoStart against this method's own Workflows.
  const recipes: MethodRecipe[] = [];
  const recipeRows = raw.recipes === undefined ? [] : list(raw.recipes);
  if (!recipeRows || recipeRows.length > MAX_LIST) add("recipes", `recipes must be a list of at most ${MAX_LIST}`);
  else recipeRows.forEach((row, n) => {
    const at = `recipes[${n}]`;
    const record = row as Record<string, unknown> | null;
    const target = workflows.find((candidate) => candidate.id === record?.workflowId);
    const choices = record?.choices as Record<string, unknown> | undefined;
    const unresolved = list(record?.unresolvedChoices);
    if (!record || typeof record.id !== "string" || !SLUG.test(record.id) || !localized(record.title)) { add(at, "recipe needs id and title"); return; }
    if (!target) { add(`${at}.workflowId`, `Workflow not in this method: ${String(record.workflowId)}`); return; }
    if (!choices || typeof choices !== "object" || Array.isArray(choices) || !unresolved || unresolved.some((key) => typeof key !== "string")) { add(at, "recipe needs choices {} and unresolvedChoices []"); return; }
    const known = new Set((target.requiredScientificChoices ?? []).map((choice) => choice.id));
    const before = issues.length;
    for (const [key, choice] of Object.entries(choices)) {
      if (!known.has(key)) add(`${at}.choices.${key}`, `Choice not in the Workflow: ${key}`);
      if (!["string", "number", "boolean"].includes(typeof choice)) add(`${at}.choices.${key}`, "Choice must be a string, number or boolean");
    }
    for (const key of unresolved as string[]) {
      if (!known.has(key)) add(`${at}.unresolvedChoices`, `Choice not in the Workflow: ${key}`);
      if (key in choices) add(`${at}.unresolvedChoices`, `Choice both answered and unresolved: ${key}`);
    }
    if (issues.length === before) recipes.push({ id: record.id, workflowId: target.id, title: localized(record.title)!, choices: choices as MethodRecipe["choices"], unresolvedChoices: [...(unresolved as string[])] });
  });
  if (new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length) add("recipes", "recipe ids must be unique");

  let files: { path: string; sha256: string; size: number }[] | null = null;
  if (raw.files !== undefined || raw.packageDigest !== undefined) {
    const fileRows = list(raw.files);
    if (!fileRows || typeof raw.packageDigest !== "string" || !SHA256.test(raw.packageDigest)
      || fileRows.some((row) => { const f = row as Record<string, unknown> | null; return !f || typeof f.path !== "string" || typeof f.sha256 !== "string" || !SHA256.test(f.sha256) || typeof f.size !== "number"; })) {
      add("files", "files[] {path, sha256, size} and packageDigest must be present together");
    } else files = fileRows as { path: string; sha256: string; size: number }[];
  }

  if (issues.length) return { method: null, issues };
  return {
    method: {
      methodId: raw.methodId as string,
      revision: raw.revision as number,
      version: typeof raw.version === "string" ? raw.version : null,
      lifecycle: raw.lifecycle as MethodLifecycle,
      implementation: raw.implementation as MethodImplementation,
      codeOrigin: (raw.codeOrigin as MethodFile["codeOrigin"]) ?? null,
      title: title!,
      summary: localized(raw.summary),
      sources,
      checks,
      authoring,
      workflows,
      recipes,
      files,
      packageDigest: files ? raw.packageDigest as string : null,
    },
    issues,
  };
}

/** sha256 of the sorted `path\0sha256\n` listing (catalogue rule) of every file but gaid-method.json. */
export function methodTreeDigest(skillDir: string): { digest: string; files: { path: string; sha256: string; size: number }[] } {
  const files: { path: string; sha256: string; size: number }[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath);
      else if (entry.isFile() && relPath !== GAID_METHOD_FILE) {
        const data = fs.readFileSync(path.join(dir, entry.name));
        files.push({ path: relPath, sha256: crypto.createHash("sha256").update(data).digest("hex"), size: data.length });
      }
    }
  };
  walk(skillDir, "");
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { digest: crypto.createHash("sha256").update(files.map((f) => `${f.path}\0${f.sha256}\n`).join("")).digest("hex"), files };
}

/** Problems of a staged tree against its manifest's `files[]`/`packageDigest`; empty when it matches or declares none. */
export function verifyMethodTree(skillDir: string, method: MethodFile): string[] {
  if (!method.files || !method.packageDigest) return [];
  const actual = methodTreeDigest(skillDir);
  const problems: string[] = [];
  const declared = new Map(method.files.map((file) => [file.path, file]));
  for (const file of actual.files) {
    const entry = declared.get(file.path);
    if (!entry) problems.push(`File not listed in gaid-method.json: ${file.path}`);
    else if (entry.sha256 !== file.sha256 || entry.size !== file.size) problems.push(`File differs from gaid-method.json: ${file.path}`);
    declared.delete(file.path);
  }
  for (const missing of declared.keys()) problems.push(`Listed file missing: ${missing}`);
  if (!problems.length && actual.digest !== method.packageDigest) problems.push("packageDigest does not match the files");
  return problems;
}

/** Read `gaid-method.json` from an installed skill folder. */
export function readMethodFile(skillDir: string, runtimeName: string): MethodFileResult {
  const file = path.join(skillDir, GAID_METHOD_FILE);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return { present: false, method: null, issues: [] };
  }
  if (!stat.isFile()) return { present: true, method: null, issues: [{ subject: "$", message: `${GAID_METHOD_FILE} is not a regular file` }] };
  if (stat.size > MAX_FILE_BYTES) return { present: true, method: null, issues: [{ subject: "$", message: `${GAID_METHOD_FILE} is larger than ${MAX_FILE_BYTES} bytes` }] };
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    return { present: true, method: null, issues: [{ subject: "$", message: `${GAID_METHOD_FILE} is not valid JSON: ${(error as Error).message}` }] };
  }
  return { present: true, ...parseMethodFile(value, runtimeName) };
}
