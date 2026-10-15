/**
 * `gaid-method.json` (`gaid-method/v1`) inside a hub method package's skill
 * folder: launch contract plus the lifecycle the hub recorded. Contract:
 * docs/design/hub-method-package.md (GAID consumer side; skill_hub owns the
 * producer contract). Unknown keys are ignored, so the contract can grow
 * additively. Validation reports issues instead of throwing: an invalid file
 * still lists the method, without startable workflows.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  MethodHubCheck,
  MethodImplementation,
  MethodIssue,
  MethodLifecycle,
  MethodSourceRef,
} from "../../../../web/src/geo/contracts/methods.ts";
import { GAID_METHOD_FILE, GAID_METHOD_SCHEMA, LOCAL_SKILL_PREFIX } from "../../../../web/src/geo/contracts/methods.ts";
import type { GeoWorkflow, LocalizedText } from "../catalogue-types.ts";

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ATLAS_ID = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const METHOD_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const REVISION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const LIFECYCLES: MethodLifecycle[] = ["draft", "submitted", "published"];
const IMPLEMENTATIONS: MethodImplementation[] = ["descriptive", "implemented"];
const MAX_FILE_BYTES = 256 * 1024;
const MAX_WORKFLOWS = 20;
const MAX_LIST = 50;
const MAX_TEXT = 4000;

export interface MethodFile {
  methodId: string;
  revision: string;
  lifecycle: MethodLifecycle;
  implementation: MethodImplementation;
  title: LocalizedText;
  summary: LocalizedText | null;
  sources: MethodSourceRef[];
  checks: MethodHubCheck[];
  workflows: GeoWorkflow[];
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
  for (const field of ["description", "prompt", "boundary"] as const) {
    if (raw[field] !== undefined && !localized(raw[field])) add(field, `${field} must be {ko, en?} text`);
  }
  return issues.length === before ? (raw as unknown as GeoWorkflow) : null;
}

export function parseMethodFile(value: unknown, runtimeName: string): { method: MethodFile | null; issues: MethodIssue[] } {
  const issues: MethodIssue[] = [];
  const add = (subject: string, message: string) => issues.push({ subject, message });
  if (!value || typeof value !== "object" || Array.isArray(value)) return { method: null, issues: [{ subject: "$", message: "gaid-method.json must be a JSON object" }] };
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== GAID_METHOD_SCHEMA) add("schemaVersion", `schemaVersion must be ${GAID_METHOD_SCHEMA}`);
  if (typeof raw.methodId !== "string" || !METHOD_ID.test(raw.methodId)) add("methodId", "methodId must be a hub identity");
  if (typeof raw.revision !== "string" || !REVISION.test(raw.revision)) add("revision", "revision must be a hub revision id");
  if (!LIFECYCLES.includes(raw.lifecycle as MethodLifecycle)) add("lifecycle", `lifecycle must be one of ${LIFECYCLES.join(", ")}`);
  if (!IMPLEMENTATIONS.includes(raw.implementation as MethodImplementation)) add("implementation", `implementation must be one of ${IMPLEMENTATIONS.join(", ")}`);
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
    } else sources.push({ kind: record.kind as MethodSourceRef["kind"], ref: record.ref, ...(typeof record.title === "string" ? { title: record.title.slice(0, 500) } : {}) });
  });

  const checks: MethodHubCheck[] = [];
  const checkRows = raw.checks === undefined ? [] : list(raw.checks);
  if (!checkRows || checkRows.length > MAX_LIST) add("checks", `checks must be a list of at most ${MAX_LIST}`);
  else checkRows.forEach((row, n) => {
    const record = row as Record<string, unknown> | null;
    if (!record || typeof record.name !== "string" || !["pass", "fail", "warn"].includes(record.state as string)) add(`checks[${n}]`, "check needs name and state pass|fail|warn");
    else checks.push({ name: record.name.slice(0, 100), state: record.state as MethodHubCheck["state"], ...(typeof record.detail === "string" ? { detail: record.detail.slice(0, 1000) } : {}) });
  });

  const workflows: GeoWorkflow[] = [];
  const rows = raw.workflows === undefined ? [] : list(raw.workflows);
  if (!rows || rows.length > MAX_WORKFLOWS) add("workflows", `workflows must be a list of at most ${MAX_WORKFLOWS}`);
  else {
    rows.forEach((row, n) => { const valid = workflow(row, n, runtimeName, issues); if (valid) workflows.push(valid); });
    const ids = workflows.map((row) => row.id);
    if (new Set(ids).size !== ids.length) add("workflows", "workflow ids must be unique");
  }
  if (issues.length) return { method: null, issues };
  return {
    method: {
      methodId: raw.methodId as string,
      revision: raw.revision as string,
      lifecycle: raw.lifecycle as MethodLifecycle,
      implementation: raw.implementation as MethodImplementation,
      title: title!,
      summary: localized(raw.summary),
      sources,
      checks,
      workflows,
    },
    issues,
  };
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
