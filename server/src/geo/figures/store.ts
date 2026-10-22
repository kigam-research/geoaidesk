/** Derived figure records. Note files and observed provenance remain the sources of truth. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ProjectPaths } from "../../projects.ts";
import { apiRelative, isUserVisible, safePath } from "../../sandbox-fs.ts";
import { artifactProvenance, walkLineage } from "../../provenance/lookup.ts";
import { readProjectSteps, sha256File, type ProvenanceStep } from "../../provenance/store.ts";
import { getResearchNote, listResearchNotes } from "../notes/store.ts";
import { frontmatterSpan } from "../notes/parser.ts";
import { markdownImageTargets } from "../markdown-images.ts";
import {
  FIGURE_KINDS, FIGURE_CHECK_SCHEMA, FIGURE_OVERRIDES_FILE, FIGURE_TARGET_FILE, FIGURE_CHECKS_DIR,
  JOURNAL_FIGURES_SCHEMA, isFigurePath, kindIsAiMade,
  type FigureKind, type FigureRecord, type FigureTarget, type FigureCheck, type JournalProfile,
  type FigureListResponse, type FigureInput,
} from "../../../../web/src/geo/contracts/figures.ts";

export const SKILL_DIR = fileURLToPath(new URL("../../../../geo/skills/gaid-figures/", import.meta.url));
export class FigureError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

export function figurePath(paths: ProjectPaths, requested: unknown): { absolute: string; relative: string } {
  if (typeof requested !== "string" || !requested || requested.length > 4096 || /[\\\x00-\x1f]|^[A-Za-z]:/.test(requested) || path.isAbsolute(requested)) {
    throw new FigureError(400, "figure-path", "Expected a project-relative figure path");
  }
  const absolute = safePath(requested, paths.sandbox);
  if (!isUserVisible(absolute, paths.sandbox) || !isFigurePath(absolute)) throw new FigureError(403, "figure-path", "Not a visible project figure");
  if (fs.existsSync(absolute) && (!isUserVisible(fs.realpathSync(absolute), fs.realpathSync(paths.sandbox)) || !fs.statSync(absolute).isFile())) {
    throw new FigureError(403, "figure-path", "Not a visible project figure");
  }
  return { absolute, relative: apiRelative(paths.sandbox, absolute) };
}

function readJson(file: string): unknown {
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error("Figure state exceeds 2 MiB");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new FigureError(409, "figure-state", "Cannot read figure state");
  }
}
export function writeFigureState(paths: ProjectPaths, relative: string, value: unknown): void {
  const file = safePath(relative, paths.sandbox);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); fs.renameSync(tmp, file); }
  finally { fs.rmSync(tmp, { force: true }); }
}
type Overrides = Record<string, FigureKind>;
function overrides(paths: ProjectPaths): Overrides {
  const value = readJson(safePath(FIGURE_OVERRIDES_FILE, paths.sandbox));
  if (value === null) return {};
  if (typeof value !== "object" || Array.isArray(value) || !Object.values(value).every(v => FIGURE_KINDS.includes(v as FigureKind))) {
    throw new FigureError(409, "figure-state", "Invalid figure kinds store");
  }
  return value as Overrides;
}
const overrideKey = (relative: string, sha: string) => `${relative}:${sha}`;

export function journalProfiles(skillDir = SKILL_DIR): JournalProfile[] {
  const value = readJson(path.join(skillDir, "assets/journals.json")) as { schema?: string; profiles?: JournalProfile[] } | null;
  if (!value) return [];
  if (value.schema !== JOURNAL_FIGURES_SCHEMA || !Array.isArray(value.profiles)) throw new FigureError(503, "figure-journals", "Journal profiles are unavailable");
  return value.profiles;
}
export function figureTarget(paths: ProjectPaths): FigureTarget | null {
  const value = readJson(safePath(FIGURE_TARGET_FILE, paths.sandbox)) as FigureTarget | null;
  if (value && (typeof value.journalId !== "string" || typeof value.width !== "string" || typeof value.updatedAt !== "string")) throw new FigureError(409, "figure-state", "Invalid journal target");
  return value;
}
export function setFigureTarget(paths: ProjectPaths, journalId: unknown, width: unknown, skillDir = SKILL_DIR): FigureTarget | null {
  if (journalId === null && width === null) { writeFigureState(paths, FIGURE_TARGET_FILE, null); return null; }
  if (typeof journalId !== "string" || typeof width !== "string" || !journalProfiles(skillDir).find(p => p.id === journalId)?.widths.some(w => w.id === width)) {
    throw new FigureError(400, "figure-target", "Choose an available journal and width");
  }
  const target = { journalId, width, updatedAt: new Date().toISOString() };
  writeFigureState(paths, FIGURE_TARGET_FILE, target);
  return target;
}

const SCRIPT = /\.(py|r|jl|m|ipynb|sh)$/i;
const DIAGRAM = /\.(svg|mmd|drawio|dot|tex)$/i;
const roleOf = (file: string): FigureInput["role"] => SCRIPT.test(file) ? "script" : isFigurePath(file) ? "image" : "data";
function aiTool(step: ProvenanceStep): boolean { return /generate_image|image[_-](?:gen|edit)|images\/(?:generations|edits)/i.test(step.toolName); }
function deriveKind(step: ProvenanceStep | undefined, relative: string): FigureKind {
  if (!step) return "unknown";
  if (aiTool(step)) return step.inputs.length > 0 && step.inputs.every(i => isFigurePath(i.path)) ? "image-edit" : "ai-picture";
  if ((/^(write|edit)$/.test(step.toolName) && DIAGRAM.test(relative)) || step.inputs.some(i => DIAGRAM.test(i.path))) return "code-diagram";
  if (/bash|python|execute|run/.test(step.toolName) && step.inputs.some(i => roleOf(i.path) === "data")) return "data-figure";
  return "unknown";
}
function copySource(step: ProvenanceStep | undefined): string | null {
  if (!step || !(step.toolName === "copy" || (step.toolName === "bash" && /(?:^|[\s;&|"'])(?:cp|copy|Copy-Item)(?:\s|$)|shutil\.copy/.test(JSON.stringify(step.args))))) return null;
  const images = step.inputs.filter(i => isFigurePath(i.path));
  return images.length === 1 ? images[0].path : null;
}

export function readFigureCheck(paths: ProjectPaths, sha: string | null): FigureCheck | null {
  if (!sha) return null;
  const check = readJson(safePath(`${FIGURE_CHECKS_DIR}/${sha}.json`, paths.sandbox)) as FigureCheck | null;
  return check?.schema === FIGURE_CHECK_SCHEMA && check.sha256 === sha && Array.isArray(check.items) && Array.isArray(check.cvdPreviews) ? check : null;
}

function noteFigureReferences(paths: ProjectPaths, id: string): { relative: string; caption: string | null; noteId: string }[] {
  const { content, note } = getResearchNote(paths, id), span = frontmatterSpan(content);
  const prose = (span ? content.slice(span.end) : content).replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  return markdownImageTargets(prose).flatMap(target => {
    try {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(target)) return [];
      const requested = path.posix.join(path.posix.dirname(note.path), decodeURIComponent(target.split(/[?#]/)[0]));
      const { relative } = figurePath(paths, requested);
      const next = prose.slice(prose.indexOf(target)).split(/\r?\n/).slice(1).find(line => line.trim());
      const caption = next && /^(?:그림\s*\d+\s*[.:]|Fig(?:ure)?\.?\s*\d+\s*[.:])/i.test(next.trim()) ? next.trim() : null;
      return [{ relative, caption, noteId: note.id }];
    } catch { return []; }
  });
}

export function figureRecord(paths: ProjectPaths, requested: string, caption: string | null = null, noteId: string | null = null, skillDir = SKILL_DIR): FigureRecord {
  const { absolute, relative } = figurePath(paths, requested);
  if (noteId === null) {
    for (const note of listResearchNotes(paths).notes) {
      const reference = noteFigureReferences(paths, note.id).find(ref => ref.relative === relative);
      if (reference) { caption = reference.caption; noteId = reference.noteId; break; }
    }
  }
  const provenance = artifactProvenance(paths.id, relative);
  const sha = provenance.current?.sha256 ?? (provenance.exists ? sha256File(absolute) : null);
  const steps = readProjectSteps(paths.id);
  let source = relative, step = provenance.producedBy[0], lineage = provenance.lineage;
  let copyMatch: "edge" | "hash" | null = null;
  if (!provenance.producedBy.length && sha) {
    const match = [...steps].reverse().find(s => !s.isError && s.outputs.some(o => o.path !== relative && o.sha256 === sha && o.change !== "deleted" && o.identityAt !== "harvest"));
    const output = match?.outputs.find(o => o.path !== relative && o.sha256 === sha);
    if (match && output) {
      try { figurePath(paths, output.path); source = output.path; step = match; copyMatch = "hash"; }
      catch { /* Never follow invisible or escaped output paths. */ }
    }
  }
  if (copyMatch === "hash" && step) lineage = walkLineage(paths.sandbox, source, steps.filter(s => s.timestamp <= step.timestamp));
  const seen = new Set([relative]);
  for (let depth = 0; depth < 8; depth++) {
    const next = copySource(step);
    if (!next || seen.has(next)) break;
    try { figurePath(paths, next); } catch { break; }
    seen.add(next); source = next; copyMatch ??= "edge";
    step = Object.values(lineage.steps).find(s => s.id === lineage.nodes.find(n => n.path === source)?.stepId)!;
  }
  const inputs: FigureInput[] = lineage.nodes.filter(n => n.path !== relative && n.path !== source).flatMap(n => {
    try { const abs = safePath(n.path, paths.sandbox); if (!isUserVisible(abs, paths.sandbox)) return []; } catch { return []; }
    const edges = lineage.edges.filter(e => e.from === n.path);
    return [{ path: n.path, role: roleOf(n.path), confidence: edges.every(e => e.confidence === "observed") ? "observed" as const : "inferred" as const, changedSinceUse: n.changedSinceUse ?? null, exists: n.current !== null }];
  });
  const override = sha ? overrides(paths)[overrideKey(relative, sha)] : undefined;
  const kind = override ?? deriveKind(step, source);
  const target = figureTarget(paths), journal = target ? journalProfiles(skillDir).find(j => j.id === target.journalId) : null;
  const origin = step ? {
    sessionId: step.role === "user" ? null : step.sessionId, producedAt: new Date(step.timestamp).toISOString(),
    copiedFrom: copyMatch ? source : null, copyMatch, script: inputs.find(i => i.role === "script")?.path ?? null,
    inputs, incomplete: lineage.truncated || Object.values(lineage.steps).some(s => !!s.degraded || !!s.truncatedEdges),
    record: { toolName: step.toolName, model: step.model ?? null, environmentId: step.environmentId ?? null },
  } : null;
  return {
    path: relative, caption, noteId, exists: provenance.exists, sha256: sha, kind, kindSource: override ? "researcher" : "derived",
    staleness: provenance.staleness, inputsChanged: inputs.some(i => i.changedSinceUse === true), origin,
    check: readFigureCheck(paths, sha), policy: target ? { journalId: target.journalId, policy: kind === "unknown" ? "unknown" : journal?.aiPolicy[kind] ?? "unknown", sourceUrl: journal?.sources[0]?.url ?? null } : null,
    disclosure: kindIsAiMade(kind) && step ? disclosureDraft(kind, step, caption ?? path.basename(relative)) : null,
  };
}

/**
 * Caption/AI-statement draft in English (the language most journals ask for), from the recorded step only.
 * The researcher edits it; the record pane says it is a draft (figures.disclosure.limit).
 */
function disclosureDraft(kind: FigureKind, step: ProvenanceStep, purpose: string): string {
  const what = kind === "image-edit" ? "was edited with an AI image tool" : "was generated with an AI image tool";
  const model = step.model ? ` (model: ${step.model})` : " (model not recorded)";
  const date = new Date(step.timestamp).toISOString().slice(0, 10);
  const note = kind === "image-edit" ? "" : " It is not derived from research data.";
  return `This figure ${what}${model} on ${date} to illustrate: ${purpose}.${note}`;
}

export function setFigureKind(paths: ProjectPaths, requested: unknown, sha: unknown, kind: unknown, skillDir = SKILL_DIR): FigureRecord {
  const { absolute, relative } = figurePath(paths, requested);
  if (typeof sha !== "string" || !/^[a-f0-9]{64}$/.test(sha) || sha256File(absolute) !== sha) throw new FigureError(409, "figure-changed", "Figure changed; reload before changing its kind");
  if (kind !== null && !FIGURE_KINDS.includes(kind as FigureKind)) throw new FigureError(400, "figure-kind", "Unknown figure kind");
  const values = overrides(paths), key = overrideKey(relative, sha);
  if (kind === null) delete values[key]; else values[key] = kind as FigureKind;
  writeFigureState(paths, FIGURE_OVERRIDES_FILE, values);
  return figureRecord(paths, relative, null, null, skillDir);
}

export function listFigures(paths: ProjectPaths, noteId?: string, skillDir = SKILL_DIR): FigureListResponse {
  const ids = noteId === undefined ? listResearchNotes(paths).notes.map(n => n.id) : [noteId];
  const figures: FigureRecord[] = [], seen = new Set<string>();
  let truncated = false;
  for (const id of ids) {
    for (const reference of noteFigureReferences(paths, id)) {
      if (seen.has(reference.relative)) continue;
      seen.add(reference.relative);
      if (figures.length >= 200) { truncated = true; break; }
      figures.push(figureRecord(paths, reference.relative, reference.caption, reference.noteId, skillDir));
    }
    if (truncated) break;
  }
  return { figures, target: figureTarget(paths), truncated };
}
