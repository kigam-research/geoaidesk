/**
 * Method trials (ValidationAttempt, docs/design/spatial-pu-pilot.md): one
 * record per chat started from a local method workflow, written when the
 * chat's session is created with a `method:<name>:<workflow>` exposure. The
 * record pins what was tried (method revision, package digest, installed tree
 * hash). What happened is read from the session's provenance log at request
 * time: tool calls, files read and written, models. A model's completion
 * message is never evidence here, and exit 0 is not a scientific assessment;
 * the researcher's assessment is a separate, explicit record.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import { globalSkillRoot, projectSkillRoot } from "../../agent/skills.ts";
import { getSkillProvenance, hashDirectory } from "../../agent/skills-sync.ts";
import { PROVENANCE_SCHEMA_VERSION, USER_SESSION_ID, type ProvenanceStep } from "../../provenance/store.ts";
import type { MethodTrial, MethodTrialExpected, MethodTrialFile } from "../../../../web/src/geo/contracts/methods.ts";
import { geoStateDir } from "../context.ts";
import { findInstalledMethod, parseMethodExposure } from "./local-methods.ts";
import { originOfSource, packageStore } from "./package-origin.ts";

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_FILES = 200;
const MAX_TRIALS = 200;
const MAX_NOTE = 4000;

type StoredTrial = Omit<MethodTrial, "methodChanged" | "observed" | "expected"> & {
  schemaVersion: "gaid-method-trial/v1";
  expected: { id: string; label: MethodTrialExpected["label"]; required: boolean; files: string[] }[];
};

export class MethodTrialError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}

function trialsDir(paths: ProjectPaths): string {
  return path.join(geoStateDir(paths), "method-trials");
}

/** Counts known trial records for registered package identities, without provenance scans or the list-view cap. */
export function countRegisteredMethodTrials(paths: ProjectPaths, methodId: string, packageSha256s: Set<string>): number {
  let names: string[];
  try {
    names = fs.readdirSync(trialsDir(paths)).filter((name) => name.endsWith(".json"));
  } catch {
    return 0;
  }
  let count = 0;
  for (const name of names) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(trialsDir(paths), name), "utf8")) as StoredTrial;
      if (
        record.schemaVersion === "gaid-method-trial/v1" &&
        record.methodId === methodId &&
        record.packageSha256 &&
        packageSha256s.has(record.packageSha256)
      ) count++;
    } catch {
      // Follow trialCounts: unreadable records are skipped, never rewritten or inferred successful.
    }
  }
  return count;
}

function trialFile(paths: ProjectPaths, sessionId: string): string {
  if (!SESSION_ID.test(sessionId) || sessionId === USER_SESSION_ID) throw new MethodTrialError(400, `Invalid session id "${sessionId}"`);
  return path.join(trialsDir(paths), `${sessionId}.json`);
}

function writeAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, file);
}

/**
 * Pin the trial for a new chat whose exposure names a method workflow. Returns
 * null (and writes nothing) for other exposures or a method that is no longer
 * installed. An existing record is kept: a session is created once.
 */
export function recordMethodTrial(paths: ProjectPaths, sessionId: string, mode: string, now = new Date(), store = packageStore()): StoredTrial | null {
  const ref = parseMethodExposure(mode);
  if (!ref) return null;
  const file = trialFile(paths, sessionId);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8")) as StoredTrial;
  const method = findInstalledMethod(paths, ref.runtimeName);
  const parsed = method?.file.method;
  const workflow = parsed?.workflows.find((candidate) => candidate.id === ref.workflowId);
  if (!method || !parsed || !workflow) return null;
  const root = method.scope === "global" ? globalSkillRoot() : projectSkillRoot(paths);
  const { origin } = originOfSource(getSkillProvenance(root, method.runtimeName)?.source, store);
  const artifacts = (workflow.expectedArtifacts ?? []) as { id: string; label: MethodTrialExpected["label"]; required?: boolean; files?: unknown[] }[];
  const record: StoredTrial = {
    schemaVersion: "gaid-method-trial/v1",
    sessionId,
    methodKey: method.key,
    runtimeName: method.runtimeName,
    workflowId: workflow.id,
    methodId: parsed.methodId,
    revision: parsed.revision,
    packageSha256: origin.packageSha256 ?? null,
    treeHash: hashDirectory(method.dir),
    startedAt: now.toISOString(),
    expected: artifacts.map((artifact) => ({
      id: artifact.id,
      label: artifact.label,
      required: artifact.required === true,
      files: (artifact.files ?? []).filter((name): name is string => typeof name === "string").slice(0, 50),
    })),
  };
  writeAtomic(file, record);
  return record;
}

/** `*` matches within one path segment; a pattern without `/` matches the file name. */
function matches(pattern: string, filePath: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  const target = pattern.includes("/") ? filePath : filePath.split("/").pop() ?? filePath;
  return new RegExp(`^${escaped}$`).test(target) || (pattern.includes("/") && new RegExp(`(^|/)${escaped}$`).test(filePath));
}

/**
 * Session outputs that match an artifact's declared names. When none matches exactly, a file with a declared name in
 * another folder (results/ instead of outputs/) is reported as `foundElsewhere` (gaid-hub trial).
 */
export function matchArtifact(patterns: string[], files: string[]): { found: string[]; foundElsewhere?: string[] } {
  const found = files.filter((file) => patterns.some((pattern) => matches(pattern, file))).slice(0, 50);
  if (found.length) return { found };
  const elsewhere = files
    .filter((file) => patterns.some((pattern) => pattern.includes("/") && matches(pattern.split("/").pop()!, file)))
    .slice(0, 50);
  return elsewhere.length ? { found, foundElsewhere: elsewhere } : { found };
}

/** The session's provenance rows (same file and row rules as provenance/store.ts readSteps). */
function readTrialSteps(paths: ProjectPaths, sessionId: string): ProvenanceStep[] {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(paths.provenanceDir, sessionId, "steps.jsonl"), "utf-8");
  } catch {
    return [];
  }
  const out: ProvenanceStep[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as ProvenanceStep;
      if (row.schemaVersion === PROVENANCE_SCHEMA_VERSION) out.push(row);
    } catch {
      // A truncated row is skipped.
    }
  }
  return out;
}

function observe(paths: ProjectPaths, record: StoredTrial): Pick<MethodTrial, "observed" | "expected"> {
  const steps = readTrialSteps(paths, record.sessionId);
  const outputs = new Map<string, MethodTrialFile>();
  const inputs = new Map<string, MethodTrialFile>();
  const models = new Set<string>();
  let failed = 0;
  let degraded = 0;
  let last = 0;
  for (const step of steps) {
    if (step.isError) failed += 1;
    if (step.degraded || step.truncatedEdges) degraded += 1;
    if (step.model) models.add(step.model);
    last = Math.max(last, step.timestamp);
    for (const ref of step.outputs) {
      if (ref.change === "deleted") { outputs.delete(ref.path); continue; }
      if (ref.change !== "created" && ref.change !== "modified" && ref.change !== "wrote") continue;
      outputs.set(ref.path, { path: ref.path, ...(ref.sha256 ? { sha256: ref.sha256 } : {}), size: ref.size });
    }
    for (const ref of step.inputs) {
      if (!outputs.has(ref.path) && !inputs.has(ref.path)) inputs.set(ref.path, { path: ref.path, ...(ref.sha256 ? { sha256: ref.sha256 } : {}), size: ref.size });
    }
  }
  const outputList = [...outputs.values()].slice(0, MAX_FILES);
  return {
    observed: {
      toolCalls: steps.length,
      failedToolCalls: failed,
      models: [...models].sort(),
      inputs: [...inputs.values()].slice(0, MAX_FILES),
      outputs: outputList,
      degradedSteps: degraded,
      lastStepAt: last ? new Date(last).toISOString() : null,
    },
    expected: record.expected.map((artifact) => ({ ...artifact, ...matchArtifact(artifact.files, [...outputs.keys()]) })),
  };
}

function view(paths: ProjectPaths, record: StoredTrial): MethodTrial {
  const { schemaVersion: _schema, ...rest } = record;
  const method = findInstalledMethod(paths, record.runtimeName);
  const methodChanged = !method || hashDirectory(method.dir) !== record.treeHash;
  return { ...rest, ...observe(paths, record), methodChanged };
}

export function listMethodTrials(paths: ProjectPaths, filter: { runtimeName?: string } = {}): MethodTrial[] {
  let names: string[];
  try {
    names = fs.readdirSync(trialsDir(paths)).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  const records: StoredTrial[] = [];
  for (const name of names) {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(trialsDir(paths), name), "utf-8")) as StoredTrial;
      if (value?.schemaVersion !== "gaid-method-trial/v1") continue;
      if (filter.runtimeName && value.runtimeName !== filter.runtimeName) continue;
      records.push(value);
    } catch {
      // An unreadable record is skipped, never rewritten.
    }
  }
  records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return records.slice(0, MAX_TRIALS).map((record) => view(paths, record));
}

export function getMethodTrial(paths: ProjectPaths, sessionId: string): MethodTrial {
  const file = trialFile(paths, sessionId);
  if (!fs.existsSync(file)) throw new MethodTrialError(404, `No method trial for session ${sessionId}`);
  return view(paths, JSON.parse(fs.readFileSync(file, "utf-8")) as StoredTrial);
}

/** The researcher's assessment of a trial: stored verbatim, replaceable, never inferred. */
export function assessMethodTrial(paths: ProjectPaths, sessionId: string, body: { outcome?: unknown; note?: unknown }, now = new Date()): MethodTrial {
  const file = trialFile(paths, sessionId);
  if (!fs.existsSync(file)) throw new MethodTrialError(404, `No method trial for session ${sessionId}`);
  if (!["useful", "needs-revision", "failed"].includes(body.outcome as string)) throw new MethodTrialError(400, "outcome must be useful, needs-revision or failed");
  if (body.note !== undefined && typeof body.note !== "string") throw new MethodTrialError(400, "note must be a string");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_NOTE) throw new MethodTrialError(400, `note is longer than ${MAX_NOTE} characters`);
  const record = JSON.parse(fs.readFileSync(file, "utf-8")) as StoredTrial;
  record.assessment = { outcome: body.outcome as "useful" | "needs-revision" | "failed", note, recordedAt: now.toISOString() };
  writeAtomic(file, record);
  return view(paths, record);
}

/**
 * What a hub handoff of this chat carries about its method trial: identity, revision and the researcher's
 * assessment (verbatim), plus the hub the method came from. null when the chat is not a method trial.
 */
export function trialHandoffRef(paths: ProjectPaths, sessionId: string, store = packageStore()) {
  let record: StoredTrial;
  try {
    record = JSON.parse(fs.readFileSync(trialFile(paths, sessionId), "utf-8")) as StoredTrial;
  } catch {
    return null;
  }
  if (record?.schemaVersion !== "gaid-method-trial/v1") return null;
  const method = findInstalledMethod(paths, record.runtimeName);
  const root = method?.scope === "global" ? globalSkillRoot() : projectSkillRoot(paths);
  const siteId = method ? originOfSource(getSkillProvenance(root, method.runtimeName)?.source, store).origin.siteId : undefined;
  return {
    methodId: record.methodId, revision: record.revision, workflowId: record.workflowId, packageSha256: record.packageSha256,
    startedAt: record.startedAt, ...(record.assessment ? { assessment: record.assessment } : {}), ...(siteId ? { siteId } : {}),
  };
}

/** Trial counts per `<runtimeName>:<workflowId>` with the latest assessment outcome, read from records only. */
export function trialCounts(paths: ProjectPaths): Map<string, { count: number; lastOutcome: "useful" | "needs-revision" | "failed" | null }> {
  const out = new Map<string, { count: number; lastOutcome: "useful" | "needs-revision" | "failed" | null; at: string }>();
  let names: string[] = [];
  try { names = fs.readdirSync(trialsDir(paths)).filter((name) => name.endsWith(".json")); } catch { return new Map(); }
  for (const name of names) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(trialsDir(paths), name), "utf-8")) as StoredTrial;
      if (record?.schemaVersion !== "gaid-method-trial/v1") continue;
      const key = `${record.runtimeName}:${record.workflowId}`;
      const row = out.get(key) ?? { count: 0, lastOutcome: null, at: "" };
      row.count += 1;
      if (record.assessment && record.assessment.recordedAt > row.at) { row.lastOutcome = record.assessment.outcome; row.at = record.assessment.recordedAt; }
      out.set(key, row);
    } catch {
      // Unreadable records are skipped.
    }
  }
  return new Map([...out].map(([key, { count, lastOutcome }]) => [key, { count, lastOutcome }]));
}
