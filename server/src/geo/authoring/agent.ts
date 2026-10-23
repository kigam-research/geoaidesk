/**
 * Lead coauthor operations. The model proposes; the server validates, records and commits.
 * - analyze: grounded findings, a scope proposal and material questions from the extracted sources.
 * - draft: a method draft (skill, optional Workflow and 레시피) from verified findings and the researcher's decisions.
 * Each operation is an AuthoringAttempt with one bounded repair; a rejected proposal never replaces accepted state.
 */
import type {
  Anchor,
  AttemptOp,
  AuthoringAttempt,
  AuthoringProject,
  DraftCodeFile,
  DraftProfile,
  FindingKind,
  GroundedFinding,
  MethodDraft,
  LocalWorkflow,
  Question,
  QuestionOption,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { distributionOf, pythonImports, pythonStdlib, withBundled, type PackageFile } from "./python.ts";
import { checkMethod } from "./package.ts";
import { quoteFound, readablePage } from "./anchors.ts";
import { modelConfig, preflight, runtimeChat, type ChatFn, type ChatMessage, type ModelConfig } from "./model.ts";
import { chosenHubSkills, hubSkillQuestion, HUB_SKILLS_KEY, loadHubSkillCandidates, type HubSkillCandidate } from "./hub-skills.ts";
import { loadVocabulary, vocabularyText, type TaxonomyFacet, type Vocabulary } from "./vocabulary.ts";
import {
  ANALYZE_PROMPT_VERSION,
  ANALYZE_SYSTEM,
  DRAFT_PROMPT_VERSION,
  DRAFT_SYSTEM,
  REPAIR,
  REVISE_ADDENDUM,
} from "./prompts.ts";
import { renderDataSummary } from "./data-files.ts";
import { pageFile, safeRelative, sourceFile } from "./sources.ts";
import { AuthoringError, newId, now, type AuthoringStore } from "./store.ts";

import { procedureFor, structuredDraft, workflowProblems } from "./workflow.ts";
import { carryExamples } from "./examples.ts";

const localSkill = (slug: string) => `local:${slug}`;

export interface AgentDeps {
  /** `revise` only: the feedback text. */
  feedback?: string;
  chat?: ChatFn;
  config?: ModelConfig;
  /** Tests: a fixed vocabulary instead of the pinned catalogue. */
  vocabulary?: Vocabulary;
  /** Hub shelf skills offered to authoring (default: the shared hub's visible, usable skills). */
  hubSkills?: () => Promise<HubSkillCandidate[]>;
}

const FINDING_KINDS: FindingKind[] = [
  "question",
  "data",
  "method",
  "parameter",
  "result",
  "limitation",
  "figure",
  "code",
];
const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const KEY = /^[a-z0-9][a-z0-9-]{1,47}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{2,47}$/;
const MAX_QUESTIONS = 5;
const PAPER_BUDGET = 260_000;
const CODE_BUDGET = 120_000;
const CODE_FILE_BUDGET = 12_000;
/** Data-file summaries (format, CRS, extent, columns …) across all sources. */
const DATA_BUDGET = 40_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 4000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Parse a model reply that should be one JSON object (tolerates a code fence). */
export function parseReply(content: string): { value?: Json; error?: string } {
  let text = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { error: "JSON 객체가 없습니다 (no JSON object in the reply)." };
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return isObj(value) ? { value } : { error: "Top level must be a JSON object." };
  } catch (e) {
    return { error: `Invalid JSON: ${(e as Error).message}` };
  }
}

// ------------------------------------------------------------------------------------------------
// Source context

interface SourceContext {
  aliases: Map<string, string>;
  pages: Map<string, string[]>;
  files: Map<string, Map<string, string>>;
  text: string;
}

async function sourceContext(store: AuthoringStore, project: AuthoringProject): Promise<SourceContext> {
  const aliases = new Map<string, string>();
  const pages = new Map<string, string[]>();
  const files = new Map<string, Map<string, string>>();
  const parts: string[] = [];
  let paperBudget = PAPER_BUDGET;
  let codeBudget = CODE_BUDGET;
  let dataBudget = DATA_BUDGET;
  project.sources.forEach((s, i) => aliases.set(`S${i + 1}`, s.id));
  for (const [alias, id] of aliases) {
    const s = project.sources.find((x) => x.id === id)!;
    const x = project.extractions[id];
    const head = [
      `### ${alias}: ${s.name} (${s.kind}${s.documentKind ? `; ${s.documentKind}` : ""}${s.doi ? `; DOI ${s.doi}` : ""}${s.title && s.title !== s.name ? `; title "${s.title}"` : ""}${s.library ? `; from the researcher's library (${s.library.category})` : ""}${s.note ? `; GAID research note${s.note.snapshot ? " (library copy)" : ""}` : ""})`,
    ];
    if (x?.pages) {
      const texts: string[] = [];
      for (let p = 1; p <= x.pages; p++) {
        const t = store.exists(project.id, pageFile(id, p))
          ? (await store.readFile(project.id, pageFile(id, p))).toString("utf8")
          : "";
        texts.push(readablePage(t));
      }
      pages.set(id, texts);
      head.push(`Pages: ${x.pages}; pages without text: ${x.emptyPages.join(", ") || "none"}`);
      parts.push(head.join("\n"));
      texts.forEach((t, i) => {
        const body = t
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (!body || paperBudget <= 0) return;
        const chunk = body.slice(0, paperBudget);
        paperBudget -= chunk.length;
        parts.push(`=== ${alias} page ${i + 1} ===\n${chunk}`);
      });
      if (paperBudget <= 0) parts.push(`(${alias}: later pages omitted for length)`);
    } else if (x?.files) {
      const map = new Map<string, string>();
      head.push(
        `Files (${x.files.length}): ${x.files
          .map((f) => f.path)
          .join(", ")
          .slice(0, 6000)}`,
      );
      parts.push(head.join("\n"));
      const rank = (p: string) =>
        /(^|\/)readme/i.test(p)
          ? 0
          : /\.(md|txt)$/i.test(p)
            ? 1
            : /\.(ya?ml|toml|cfg|ini|json)$/i.test(p)
              ? 2
              : /\.(py|r|m|jl|sh)$/i.test(p)
                ? 3
                : 4;
      // Data files: the inspection summary stands for the file (anchors on the file are checked against it, plus the
      // raw text of a text table); the bytes never enter the context.
      const data = x.files.filter((f) => f.data);
      const companions = x.files.filter((f) => f.companionOf).length;
      if (data.length) {
        parts.push(`Data files read through GAID's geo inspection: ${data.length}${companions ? ` (+${companions} companion files)` : ""}`);
        for (const f of data) {
          const summary = renderDataSummary(f.path, f.size, f.data!);
          const raw = f.text ? (await store.readFile(project.id, sourceFile(id, f.path))).toString("utf8") : "";
          map.set(f.path, raw ? `${summary}\n${raw}` : summary);
          if (dataBudget <= 0) continue;
          const chunk = summary.slice(0, dataBudget);
          dataBudget -= chunk.length;
          parts.push(`=== ${alias} data ${f.path} ===\n${chunk}`);
        }
        if (dataBudget <= 0) parts.push(`(${alias}: later data summaries omitted for length)`);
      }
      for (const f of [...x.files]
        .filter((f) => f.text && !f.data)
        .sort((a, b) => rank(a.path) - rank(b.path) || (a.path < b.path ? -1 : 1))) {
        const t = (await store.readFile(project.id, sourceFile(id, f.path))).toString("utf8");
        map.set(f.path, t);
        if (codeBudget <= 0 || rank(f.path) > 3) continue;
        const chunk = t.slice(0, Math.min(CODE_FILE_BUDGET, codeBudget));
        codeBudget -= chunk.length;
        parts.push(`=== ${alias} file ${f.path} ===\n${chunk}${chunk.length < t.length ? "\n(... truncated)" : ""}`);
      }
      files.set(id, map);
    } else parts.push(`${head.join("\n")}\n(no text could be extracted)`);
  }
  return { aliases, pages, files, text: parts.join("\n\n") };
}

function checkAnchor(raw: unknown, ctx: SourceContext, errors: string[], where: string): Anchor | undefined {
  if (!isObj(raw)) {
    errors.push(`${where}: anchor must be an object`);
    return undefined;
  }
  const alias = str(raw.source, 10);
  const id = ctx.aliases.get(alias);
  const quote = str(raw.quote, 400);
  if (!id) {
    errors.push(`${where}: unknown source "${alias}"`);
    return undefined;
  }
  if (quote.length < 8) {
    errors.push(`${where}: quote must be 8-200 verbatim characters`);
    return undefined;
  }
  const pages = ctx.pages.get(id);
  if (pages) {
    const page = Number(raw.page);
    if (!Number.isInteger(page) || page < 1 || page > pages.length) {
      errors.push(`${where}: ${alias} has pages 1-${pages.length}, not ${String(raw.page)}`);
      return undefined;
    }
    if (!quoteFound(quote, pages[page - 1])) {
      errors.push(`${where}: quote not found on ${alias} page ${page}: "${quote.slice(0, 80)}"`);
      return undefined;
    }
    return { sourceId: id, page, quote, verified: true };
  }
  const files = ctx.files.get(id);
  const path = str(raw.path, 400);
  if (!files?.has(path)) {
    errors.push(`${where}: ${alias} has no file "${path}"`);
    return undefined;
  }
  if (!quoteFound(quote, files.get(path)!)) {
    errors.push(`${where}: quote not found in ${alias} ${path}`);
    return undefined;
  }
  return { sourceId: id, path, quote, verified: true };
}

// ------------------------------------------------------------------------------------------------
// Analyze

interface AnalyzeResult {
  findings: GroundedFinding[];
  questions: Question[];
  scope: string;
  errors: string[];
  fatal: boolean;
}

export function validateAnalysis(
  value: Json,
  project: AuthoringProject,
  ctx: SourceContext,
  attempt: AuthoringAttempt,
): AnalyzeResult {
  const errors: string[] = [];
  const findings: GroundedFinding[] = [];
  const rawFindings = arr(value.findings);
  if (!Array.isArray(value.findings)) errors.push('"findings" must be an array');
  rawFindings.forEach((f, i) => {
    const where = `findings[${i}]`;
    if (!isObj(f)) return errors.push(`${where}: must be an object`);
    const kind = str(f.kind, 20) as FindingKind;
    const statement = str(f.statement, 1200);
    if (!FINDING_KINDS.includes(kind)) return errors.push(`${where}: kind must be one of ${FINDING_KINDS.join("|")}`);
    if (!statement) return errors.push(`${where}: statement is required`);
    const anchors = arr(f.anchors)
      .slice(0, 4)
      .map((a, j) => checkAnchor(a, ctx, errors, `${where}.anchors[${j}]`))
      .filter((a): a is Anchor => !!a);
    if (!anchors.length) return errors.push(`${where}: dropped, no verified anchor ("${statement.slice(0, 60)}")`);
    const interpretation = str(f.interpretation, 1200);
    findings.push({
      id: newId("fd"),
      kind,
      statement,
      ...(interpretation ? { interpretation } : {}),
      anchors,
      attemptId: attempt.id,
      sourceRevision: attempt.sourceRevision,
    });
  });
  const decided = new Set(project.decisions.filter((d) => !d.supersededBy).map((d) => d.key));
  const open = new Set(project.questions.filter((q) => q.status === "open").map((q) => q.key));
  const questions: Question[] = [];
  arr(value.questions).forEach((q, i) => {
    const where = `questions[${i}]`;
    if (!isObj(q)) return errors.push(`${where}: must be an object`);
    const key = str(q.key, 48);
    if (!KEY.test(key)) return errors.push(`${where}: key must be kebab-case`);
    if (decided.has(key)) return errors.push(`${where}: "${key}" is already decided; do not ask again`);
    if (open.has(key) || questions.some((x) => x.key === key)) return;
    if (questions.length >= MAX_QUESTIONS)
      return errors.push(`${where}: more than ${MAX_QUESTIONS} questions; dropped`);
    const text = str(q.text, 600);
    const reason = str(q.reason, 600);
    const affects = str(q.affects, 300);
    if (!text || !reason || !affects) return errors.push(`${where}: text, reason and affects are required`);
    // The screen always offers a free-text "기타" next to the options.
    const answerType = q.answerType === "text" ? ("text" as const) : ("choice-or-text" as const);
    const options: QuestionOption[] = arr(q.options)
      .filter(isObj)
      .map((o) => {
        const hint = str(o.hint, 200);
        return { id: str(o.id, 48), label: str(o.label, 120), ...(hint ? { hint } : {}) };
      })
      .filter((o) => KEY.test(o.id) && o.label && !/^(other|기타)$/i.test(o.id))
      .slice(0, 4);
    if (answerType !== "text" && options.length < 2)
      return errors.push(`${where}: a choice question needs at least two options with kebab-case ids`);
    const evidence = arr(q.evidence)
      .slice(0, 3)
      .map((a, j) => checkAnchor(a, ctx, [], `${where}.evidence[${j}]`))
      .filter((a): a is Anchor => !!a);
    // The recommendation must name one of the options (by id, or by its exact label).
    const rec = str(q.recommended, 200);
    const recommended = answerType === "text" ? undefined : options.find((o) => o.id === rec || o.label === rec)?.id;
    const recommendedWhy = recommended ? str(q.recommendedWhy, 300) : "";
    questions.push({
      id: newId("q"),
      key,
      revision: 1,
      text,
      reason,
      affects,
      answerType,
      options: answerType === "text" ? [] : options,
      materiality: q.materiality === "optional" ? "optional" : "required",
      ...(recommended ? { recommendedOptionId: recommended } : {}),
      ...(recommendedWhy ? { recommendedWhy } : {}),
      evidence,
      status: "open",
      attemptId: attempt.id,
      draftRevision: project.drafts.at(-1)?.revision ?? 0,
      createdAt: now(),
    });
  });
  const fatal = !Array.isArray(value.findings) || !findings.length || findings.length < rawFindings.length / 2;
  return { findings, questions, scope: str(value.scope, 2000), errors, fatal };
}

/** "(선택)", "(필수)" and similar markers: the screens show the required flag themselves. */
export function plainLabel(label: string): string {
  return label
    .replace(/\s*[(（\[]\s*(선택|필수|선택 사항|optional|required)\s*[)）\]]\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Keys of the questions the hub always asks (when they apply), whatever the model proposes. */
export const CODE_USE_KEY = "code-use";
export const TRIAL_SCALE_KEY = "trial-scale";
/** Workflow choice the draft must carry when the researcher asked for a reduced first-trial setting. */
export const RUN_SCALE_CHOICE = "run-scale";

/**
 * Questions the hub asks for every method when they apply (gaid-hub-followups, user direction 2026-10-16: heavy
 * computation such as variograms must be reducible for a first trial; include the original code when supplied). They are
 * skipped when already decided or open, or when the model asked the same thing under a similar key.
 */
export function standardQuestions(project: AuthoringProject, proposed: Question[], attemptId: string, hubCandidates: HubSkillCandidate[] = []): Question[] {
  const live = new Set([
    ...project.decisions.filter((d) => !d.supersededBy).map((d) => d.key),
    ...project.questions.filter((q) => q.status === "open").map((q) => q.key),
    ...proposed.map((q) => q.key),
  ]);
  const similar = (re: RegExp) => [...live].some((k) => re.test(k));
  const hasCode = project.sources.some((s) => (project.extractions[s.id]?.files?.length ?? 0) > 0);
  const base = {
    revision: 1,
    answerType: "choice-or-text" as const,
    materiality: "required" as const,
    evidence: [],
    status: "open" as const,
    attemptId,
    draftRevision: project.drafts.at(-1)?.revision ?? 0,
    createdAt: now(),
  };
  const out: Question[] = [];
  if (hasCode && !live.has(CODE_USE_KEY) && !similar(/(^|-)code(-|$)/))
    out.push({
      ...base,
      id: newId("q"),
      key: CODE_USE_KEY,
      text: "원본 코드를 방법에 함께 넣을까요?",
      reason: "코드를 넣으면 에이전트가 원본과 같은 계산을 실행하고, 빼면 절차 설명만 남습니다.",
      affects: "스킬의 계산 단계",
      options: [
        { id: "include", label: "원본 코드 포함", hint: "필요한 코드 파일을 스킬에 넣고 실행 방법을 적습니다." },
        { id: "describe", label: "절차 설명만", hint: "계산 코드는 넣지 않고 단계와 판단 기준만 적습니다." },
      ],
      recommendedOptionId: "include",
      recommendedWhy: "올린 자료에 원본 코드가 있어 같은 계산을 다시 실행할 수 있습니다.",
    });
  if (!live.has(TRIAL_SCALE_KEY) && !similar(/quick|trial|scale|reduced|run-mode|compute/))
    out.push({
      ...base,
      id: newId("q"),
      key: TRIAL_SCALE_KEY,
      text: "빠른 첫 시험용 줄인 설정을 함께 만들까요?",
      reason:
        "해상도·표본 수·반복 횟수·허용 오차를 줄이면 첫 실행이 몇 분 안에 끝납니다. 분석 단계와 비교는 줄이지 않으며, 결과는 낮춘 해상도만큼만 해석합니다.",
      affects: "시작 설정과 계산 단계",
      options: [
        {
          id: "quick-and-full",
          label: "줄인 설정 포함",
          hint: "격자·표본 수·반복 횟수·허용 오차를 줄인 설정으로 먼저 실행하고, 전체 설정도 고를 수 있습니다.",
        },
        { id: "full-only", label: "전체 설정만", hint: "원본 연구와 같은 규모로만 실행합니다." },
      ],
      recommendedOptionId: "quick-and-full",
      recommendedWhy: "새 자료에서는 짧은 시험으로 흐름을 먼저 확인해야 긴 계산을 헛되이 돌리지 않습니다.",
    });
  const hubQuestion = live.has(HUB_SKILLS_KEY) ? null : hubSkillQuestion(project, hubCandidates);
  if (hubQuestion) out.push({ ...base, materiality: "optional", id: newId("q"), ...hubQuestion });
  return out;
}

// ------------------------------------------------------------------------------------------------
// Draft

function draftRequest(
  project: AuthoringProject,
  ctx: SourceContext,
  v: Vocabulary,
  includeSources = true,
): { text: string; findingIds: Map<string, string> } {
  const findingIds = new Map<string, string>();
  const aliasOf = new Map([...ctx.aliases].map(([a, id]) => [id, a]));
  const findings = project.findings.map((f, i) => {
    findingIds.set(`F${i + 1}`, f.id);
    const a = f.anchors[0];
    return `F${i + 1} [${f.kind}] ${f.statement}${f.interpretation ? ` (해석: ${f.interpretation})` : ""} — ${aliasOf.get(a.sourceId)} ${a.page ? `p.${a.page}` : a.path}: "${a.quote}"`;
  });
  const decisions = project.decisions
    .filter((d) => !d.supersededBy)
    .map((d) => {
      const q = project.questions.find((x) => x.id === d.questionId);
      return d.status === "deferred"
        ? `- ${d.key}: "${q?.text}" → deferred (unresolved)`
        : `- ${d.key}: "${q?.text}" → researcher answered: "${d.response}"${d.optionId ? ` (option ${d.optionId}: ${q?.options.find((o) => o.id === d.optionId)?.label ?? ""})` : ""}`;
    });
  const open = project.questions.filter((q) => q.status === "open").map((q) => `- ${q.key}: ${q.text} (unanswered)`);
  const code = project.sources
    .filter((s) => project.extractions[s.id]?.files?.length)
    .map(
      (s) =>
        `${aliasOf.get(s.id)} ${s.name} (copied to <skill>/${codeRoot(project, s.id)}/<path>): ${project.extractions[
          s.id
        ]
          .files!.map((f) => f.path)
          .join(", ")
          .slice(0, 8000)}`,
    );
  const scope = project.attempts.filter((a) => a.op === "analyze" && a.result?.findings).at(-1);
  const previous = project.drafts.at(-1);
  return {
    findingIds,
    text: [
      `Project: ${project.title}${project.goal ? `\nResearcher's goal: ${project.goal}` : ""}`,
      targetLine(project),
      `Sources: ${[...ctx.aliases].map(([a, id]) => `${a} = ${project.sources.find((s) => s.id === id)!.name}`).join("; ")}`,
      scope?.result?.scope ? `## Scope proposed in the analysis\n${scope.result.scope}` : "",
      `## Verified findings\n${findings.join("\n")}`,
      `## Researcher's decisions\n${decisions.join("\n") || "(none yet)"}`,
      `## Open questions\n${open.join("\n") || "(none)"}`,
      code.length
        ? `## Supplied code files\n${code.join("\n")}`
        : "## Supplied code files\n(none: the skill is descriptive)",
      previous ? `## Current draft slug\n${previous.slug} (keep it)` : "",
      `## Vocabularies\n${vocabularyText(v)}`,
      // The findings are a bounded index; the method's full procedure (every processing step, parameter, comparison and
      // interpretation criterion) is in the sources, so the first draft reads them too (same budget as analyze/revise).
      includeSources ? `## Sources (the full method; findings above are an index, not the whole method)\n${ctx.text}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

const loc = (s: string) => ({ ko: s });

/** Localized objects back to plain strings, for showing a stored draft to the model in its output format. */
function plain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plain);
  if (isObj(value)) {
    const keys = Object.keys(value);
    if (keys.length && keys.every((k) => k === "ko" || k === "en") && typeof value.ko === "string") return value.ko;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

function reviseRequest(
  project: AuthoringProject,
  ctx: SourceContext,
  v: Vocabulary,
  feedback: string,
): { text: string; findingIds: Map<string, string> } {
  const base = draftRequest(project, ctx, v, false);
  const d = structuredDraft(project.drafts.at(-1)!);
  const aliasOf = new Map([...ctx.aliases].map(([a, id]) => [id, a]));
  const current = {
    slug: d.slug,
    ...(plain(d.profile) as Json),
    procedure: d.workflow ? undefined : plain(d.profile.procedure.nodes),
    description: d.description,
    scope: d.scope,
    instructions: d.instructions,
    references: d.references,
    codeFiles: d.codeFiles.map((c) => ({
      source: aliasOf.get(c.sourceId),
      sourcePath: c.sourcePath,
    })),
    workflow: d.workflow
      ? plain({
          ...d.workflow,
          // Example data belongs to the researcher; the model neither sees nor writes it.
          inputRoles: d.workflow.inputRoles.map(({ example: _example, ...role }) => role),
          requiredScientificChoices: d.workflow.requiredScientificChoices.map((c) => ({
            ...c,
            options: (c.options ?? []).map((o) => ({ id: o, label: c.optionLabels?.[o]?.ko ?? o })),
          })),
        })
      : null,
    recipe: d.recipe ?? null,
  };
  return {
    findingIds: base.findingIds,
    text: [
      base.text,
      `## Sources (for checking details the feedback asks about)\n${ctx.text}`,
      `## Current draft (revision ${d.revision}, JSON in the output format)\n${JSON.stringify(current)}`,
      `## Feedback to address (verbatim)\n${feedback}`,
    ].join("\n\n"),
  };
}

/** Folder of a supplied code source inside the skill: scripts/upstream (one code source) or scripts/upstream-<n>. */
/** What the researcher asked to make; the draft must follow it (validated in validateDraft). */
function targetLine(project: AuthoringProject): string {
  if (project.target === "workflow")
    return "Requested output: a Workflow (the skill plus a workflow object and its recipe; workflow must not be null).";
  if (project.target === "skill") return "Requested output: a skill only (set workflow and recipe to null).";
  return "Requested output: propose skill only or skill plus Workflow, whichever fits the sources and answers.";
}

export function codeRoot(project: AuthoringProject, sourceId: string): string {
  const code = project.sources.filter((s) => project.extractions[s.id]?.files?.some((f) => f.text));
  const n = code.findIndex((s) => s.id === sourceId);
  return code.length <= 1 || n < 0 ? "scripts/upstream" : `scripts/upstream-${n + 1}`;
}

export function validateDraft(
  value: Json,
  project: AuthoringProject,
  ctx: SourceContext,
  v: Vocabulary,
  findingIds: Map<string, string>,
): {
  draft?: Omit<MethodDraft, "revision" | "baseRevision" | "origin" | "createdAt" | "attemptId">;
  errors: string[];
} {
  const errors: string[] = [];
  const notes: string[] = [];
  const known = (facet: TaxonomyFacet) => new Set(v.taxonomy[facet].map((t) => t.id));
  const filterKnown = (raw: unknown, facet: TaxonomyFacet, where: string) => {
    const ids = arr(raw)
      .map((x) => str(x, 64))
      .filter(Boolean);
    const ok = ids.filter((id) => known(facet).has(id));
    const dropped = ids.filter((id) => !known(facet).has(id));
    if (dropped.length) notes.push(`${where}: 목록에 없는 분류 ${dropped.join(", ")}를 뺐습니다.`);
    return [...new Set(ok)];
  };
  for (const key of ["publisher", "credits", "release", "state", "lifecycle", "license", "licenses"])
    if (key in value) notes.push(`모델이 제안한 ${key} 값은 hub가 정하는 항목이라 쓰지 않았습니다.`);
  const previous = project.drafts.at(-1);
  let slug = str(value.slug, 48);
  const packaged = project.packages.at(-1)?.slug;
  if (packaged && slug !== packaged) {
    if (slug) notes.push(`패키지를 만든 뒤에는 이름을 바꾸지 않습니다: ${packaged}`);
    slug = packaged;
  }
  if (!SLUG.test(slug)) errors.push("slug must be kebab-case, 3-48 characters");
  else if (v.catalogueNames.has(slug) && slug !== previous?.slug)
    errors.push(`slug "${slug}" is an existing catalogue skill name; choose another`);
  else if (v.hubNames?.has(slug)) errors.push(`slug "${slug}" is already used by another hub method; choose another`);
  const title = str(value.title, 120);
  const tagline = str(value.tagline, 200);
  const summary = str(value.summary, 2000);
  const description = str(value.description, 1024);
  if (!title || !tagline || !summary) errors.push("title, tagline and summary are required");
  if (!description || !/(use\s+(?:this\s+skill\s+)?when|사용|때|경우)/i.test(description))
    errors.push('description must say when to use the skill ("Use when ..." or Korean 때/경우)');
  const kinds = ["workflow", "package-guide", "data-access", "reporting", "foundation"] as const;
  const kind = kinds.find((k) => k === value.kind) ?? "workflow";
  const t = isObj(value.taxonomy) ? value.taxonomy : {};
  const taxonomy: DraftProfile["taxonomy"] = {
    disciplines: filterKnown(t.disciplines, "disciplines", "taxonomy.disciplines"),
    tasks: filterKnown(t.tasks, "tasks", "taxonomy.tasks"),
    methods: [
      ...new Set(
        arr(t.methods)
          .map((x) => str(x, 64))
          .filter((x) => LOCAL_ID.test(x)),
      ),
    ],
    dataTypes: filterKnown(t.dataTypes, "dataTypes", "taxonomy.dataTypes"),
    formats: filterKnown(t.formats, "formats", "taxonomy.formats"),
  };
  if (!taxonomy.disciplines.length || !taxonomy.tasks.length)
    errors.push("taxonomy.disciplines and taxonomy.tasks need at least one id from the vocabulary");
  const formats = known("formats");
  const dataTypes = known("dataTypes");
  const ids = new Set<string>();
  const uniqueId = (raw: unknown, where: string) => {
    const id = str(raw, 64);
    if (!LOCAL_ID.test(id)) {
      errors.push(`${where}: id must match ${LOCAL_ID.source}`);
      return "";
    }
    if (ids.has(`${where.split("[")[0]}:${id}`)) errors.push(`${where}: duplicate id ${id}`);
    ids.add(`${where.split("[")[0]}:${id}`);
    return id;
  };
  const CONSTRAINTS = [
    "crs",
    "verticalDatum",
    "depthConvention",
    "units",
    "columns",
    "missingValues",
    "resolution",
    "time",
  ];
  const inputs: NonNullable<DraftProfile["inputs"]> = arr(value.inputs)
    .filter(isObj)
    .map((x, i) => {
      const semanticType = str(x.semanticType, 64);
      if (!dataTypes.has(semanticType)) errors.push(`inputs[${i}].semanticType "${semanticType}" is not a dataType id`);
      const c = isObj(x.constraints) ? x.constraints : {};
      const constraints: Record<string, string | string[]> = {};
      for (const k of CONSTRAINTS) {
        if (k === "columns") {
          const cols = arr(c.columns)
            .map((y) => str(y, 120))
            .filter(Boolean);
          if (cols.length) constraints[k] = cols;
        } else if (str(c[k], 300)) constraints[k] = str(c[k], 300);
      }
      return {
        id: uniqueId(x.id, `inputs[${i}]`),
        label: loc(plainLabel(str(x.label, 200)) || str(x.id, 64)),
        semanticType,
        formats: [
          ...new Set(
            arr(x.formats)
              .map((y) => str(y, 64))
              .filter((y) => formats.has(y)),
          ),
        ],
        required: x.required !== false,
        ...(Object.keys(constraints).length
          ? {
              constraints: constraints as NonNullable<DraftProfile["inputs"]>[number]["constraints"],
            }
          : {}),
      };
    });
  const TYPES = ["input", "qa", "analysis", "decision", "human-gate", "output"] as const;
  const nodes = arr(isObj(value.workflow) ? [] : value.procedure)
    .filter(isObj)
    .map((x, i) => {
      const type = TYPES.find((tt) => tt === x.type);
      if (!type) errors.push(`procedure[${i}].type must be one of ${TYPES.join("|")}`);
      const checks = arr(x.checks)
        .map((y) => str(y, 300))
        .filter(Boolean);
      return {
        id: uniqueId(x.id, `procedure[${i}]`),
        label: loc(str(x.label, 120)),
        type: type ?? "analysis",
        summary: loc(str(x.summary, 1200)),
        ...(checks.length ? { checks: checks.map(loc) } : {}),
      };
    });
  if (!isObj(value.workflow) && (nodes.length < 3 || nodes.length > 12)) errors.push("procedure needs 3-12 steps");
  if (nodes.some((n) => !n.label.ko || !n.summary.ko)) errors.push("every procedure step needs label and summary");
  const decisions = arr(value.decisions)
    .filter(isObj)
    .map((x, i) => ({
      id: uniqueId(x.id, `decisions[${i}]`),
      cue: loc(str(x.cue, 400)),
      alternatives: arr(x.alternatives)
        .map((y) => str(y, 300))
        .filter(Boolean)
        .map(loc),
      choiceBasis: loc(str(x.choiceBasis, 800)),
      verify: loc(str(x.verify, 800)),
    }))
    .filter((d, i) => {
      const ok = d.cue.ko && d.alternatives.length && d.choiceBasis.ko && d.verify.ko;
      if (!ok) errors.push(`decisions[${i}]: cue, alternatives, choiceBasis and verify are required`);
      return ok;
    });
  const userDecisions = arr(value.userDecisions)
    .filter(isObj)
    .map((x, i) => {
      const options = arr(x.options)
        .map((y) => str(y, 200))
        .filter(Boolean);
      return {
        id: uniqueId(x.id, `userDecisions[${i}]`),
        question: loc(str(x.question, 400) || str(x.id, 64)),
        ...(options.length ? { options: options.map(loc) } : {}),
      };
    });
  const OUT_KINDS = [
    "map-raster",
    "map-vector",
    "figure",
    "table",
    "report",
    "model",
    "document",
    "dataset",
    "log",
  ] as const;
  const outputs = arr(value.outputs)
    .filter(isObj)
    .map((x, i) => {
      const k = OUT_KINDS.find((o) => o === x.kind);
      if (!k) errors.push(`outputs[${i}].kind must be one of ${OUT_KINDS.join("|")}`);
      const f = [
        ...new Set(
          arr(x.formats)
            .map((y) => str(y, 64))
            .filter((y) => formats.has(y)),
        ),
      ];
      const interpretation = str(x.interpretation, 1200);
      return {
        id: uniqueId(x.id, `outputs[${i}]`),
        label: loc(str(x.label, 200) || str(x.id, 64)),
        kind: k ?? "document",
        ...(f.length ? { formats: f } : {}),
        ...(interpretation ? { interpretation: loc(interpretation) } : {}),
      };
    });
  if (!outputs.length) errors.push("outputs needs at least one entry");
  if (!inputs.length) errors.push("inputs needs at least one entry");
  if (kind === "workflow" && (!decisions.length || !userDecisions.length))
    errors.push('kind "workflow" needs at least one entry in decisions and in userDecisions');
  const limitations = arr(value.limitations)
    .filter(isObj)
    .map((x) => ({
      kind: x.kind === "not-for" ? ("not-for" as const) : ("condition" as const),
      text: loc(str(x.text, 800)),
    }))
    .filter((l) => l.text.ko);
  if (!limitations.length) errors.push("limitations needs at least one entry");
  const dependencies = arr(value.dependencies)
    .filter(isObj)
    .map((x) => {
      const purpose = str(x.purpose, 300);
      return {
        name: str(x.name, 100),
        kind: (["required", "optional", "runtime"] as const).find((k) => k === x.kind) ?? ("required" as const),
        ...(purpose ? { purpose: loc(purpose) } : {}),
        verificationOrigin: "author-declared" as const,
      };
    })
    .filter((d) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(d.name));
  const instructions = typeof value.instructions === "string" ? value.instructions.trim() : "";
  if (!instructions) errors.push("instructions (SKILL.md body) is required");
  else if (instructions.split("\n").length > 480)
    errors.push("instructions must stay under 480 lines; move detail to references/");
  else if (/^---\s*\n/.test(instructions)) errors.push("instructions must not contain YAML frontmatter");
  const references = arr(value.references)
    .filter(isObj)
    .map((x) => ({
      path: str(x.path, 200),
      content: typeof x.content === "string" ? x.content.slice(0, 100_000) : "",
    }))
    .filter((r, i) => {
      const ok =
        /^references\/[A-Za-z0-9._/-]+\.md$/.test(r.path) &&
        safeRelative(r.path) &&
        !["references/sources.md", "references/decisions.md"].includes(r.path) &&
        r.content.trim();
      if (!ok)
        errors.push(`references[${i}]: path must be references/<name>.md (not sources.md/decisions.md) with content`);
      return ok;
    });
  const codeFiles: DraftCodeFile[] = [];
  arr(value.codeFiles)
    .filter(isObj)
    .forEach((x, i) => {
      const sourceId = ctx.aliases.get(str(x.source, 10));
      const sourcePath = str(x.sourcePath, 400);
      const entry = sourceId ? project.extractions[sourceId]?.files?.find((f) => f.path === sourcePath) : undefined;
      if (!sourceId || !entry) return errors.push(`codeFiles[${i}]: ${str(x.source, 10)} has no file "${sourcePath}"`);
      // Data and binaries stay with the researcher (their own terms); only text code/config files enter a skill.
      if (!entry.text || entry.data)
        return errors.push(
          `codeFiles[${i}]: "${sourcePath}" is data or binary; include only code or config text files`,
        );
      // Supplied code keeps its original layout so its own relative paths still resolve.
      const path = `${codeRoot(project, sourceId)}/${sourcePath}`;
      if (!safeRelative(path)) return errors.push(`codeFiles[${i}]: unsafe path ${sourcePath}`);
      if (codeFiles.some((c) => c.path === path)) return;
      codeFiles.push({ path, sourceId, sourcePath });
    });
  let procedure: DraftProfile["procedure"] = {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id, relation: "next" as const })),
  };
  let workflow: LocalWorkflow | undefined;
  let recipe: MethodDraft["recipe"];
  if (isObj(value.workflow)) {
    const w = value.workflow;
    const env = str(w.environmentProfile, 64);
    if (!v.environments.some((e) => e.id === env))
      errors.push(`workflow.environmentProfile "${env}" is not one of ${v.environments.map((e) => e.id).join(", ")}`);
    const outIds = new Set(outputs.map((o) => o.id));
    const choices = arr(w.requiredScientificChoices)
      .filter(isObj)
      .map((x, i) => {
        // Options come as [{id, label}] (preferred) or bare ids.
        const raw = arr(x.options);
        const options = raw.map((y) => (isObj(y) ? str(y.id, 64) : str(y, 64))).filter(Boolean);
        const labels: Record<string, { ko: string }> = {};
        for (const y of raw)
          if (isObj(y) && str(y.id, 64) && str(y.label, 200)) labels[str(y.id, 64)] = loc(str(y.label, 200));
        if (options.length && (options.length < 2 || options.some((o) => !LOCAL_ID.test(o))))
          errors.push(
            `workflow.requiredScientificChoices[${i}].options must be two or more {id, label} with short ids (letters, digits, - _ .)`,
          );
        return {
          id: uniqueId(x.id, `workflow.requiredScientificChoices[${i}]`),
          label: loc(str(x.label, 200)),
          why: loc(str(x.why, 600)),
          ...(options.length ? { options } : {}),
          ...(Object.keys(labels).length ? { optionLabels: labels } : {}),
        };
      });
    const inputRoles = arr(w.inputRoles)
      .filter(isObj)
      .map((x, i) => {
        const f = [
          ...new Set(
            arr(x.formats)
              .map((y) => str(y, 64))
              .filter((y) => formats.has(y)),
          ),
        ];
        if (!f.length) errors.push(`workflow.inputRoles[${i}].formats needs at least one format id`);
        return {
          id: uniqueId(x.id, `workflow.inputRoles[${i}]`),
          label: loc(plainLabel(str(x.label, 200))),
          formats: f,
          required: x.required !== false,
        };
      });
    if (!inputRoles.length) errors.push("workflow.inputRoles needs at least one input");
    const artifacts = arr(w.expectedArtifacts)
      .filter(isObj)
      .map((x, i) => {
        const output = str(x.output, 64);
        if (output && !outIds.has(output))
          errors.push(`workflow.expectedArtifacts[${i}].output "${output}" is not an output id`);
        // File names let GAID match produced files to this artifact; relative to the run's output folder.
        const files = [...new Set(arr(x.files).map((y) => str(y, 200)))].filter(Boolean);
        if (files.some((f) => !safeRelative(f)))
          errors.push(`workflow.expectedArtifacts[${i}].files must be relative file names`);
        if (!files.length)
          errors.push(`workflow.expectedArtifacts[${i}].files needs the output file name(s) the method writes`);
        return {
          id: uniqueId(x.id, `workflow.expectedArtifacts[${i}]`),
          label: loc(str(x.label, 200)),
          skill: localSkill(slug),
          ...(output && outIds.has(output) ? { output } : {}),
          ...(files.length ? { files } : {}),
          required: x.required !== false,
        };
      });
    if (!artifacts.length) errors.push("workflow.expectedArtifacts needs at least one artifact");
    const prompt = str(w.prompt, 4000);
    const boundary = str(w.boundary, 1200);
    if (!str(w.title, 120) || !str(w.description, 1200) || !boundary)
      errors.push("workflow needs title, description and boundary");
    workflow = {
      schemaVersion: "gaid-workflow/v1",
      id: slug,
      title: loc(str(w.title, 120)),
      description: loc(str(w.description, 1200)),
      disciplines: taxonomy.disciplines,
      inputRoles,
      requiredScientificChoices: choices,
      prompt: loc(prompt),
      skillIds: [localSkill(slug)],
      environmentProfile: env,
      expectedArtifacts: artifacts,
      boundary: loc(boundary),
      exampleCaseIds: [],
    };
    const skills = arr(w.skills).filter(isObj).map((x, i) => {
      const name = str(x.name, 64);
      const source = x.source === "bundled" ? "bundled" as const : x.source === "hub" ? "hub" as const : "catalogue" as const;
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) errors.push(`workflow.skills[${i}].name must be a runtime skill name`);
      if (x.source !== "bundled" && x.source !== "catalogue" && x.source !== "hub") errors.push(`workflow.skills[${i}].source must be bundled|catalogue|hub`);
      // Hub skills only as the researcher chose them, pinned to the revision offered (never a model-supplied pin).
      const hub = source === "hub" ? v.hubChosen?.find((c) => c.name === name) : undefined;
      if (source === "hub" && !hub) errors.push(`workflow.skills[${i}]: ${name} is not a hub skill the researcher chose`);
      if (x.role !== "primary" && x.role !== "supporting") errors.push(`workflow.skills[${i}].role must be primary|supporting`);
      if (source === "bundled" && name !== slug) errors.push(`workflow.skills[${i}]: only ${slug} is bundled`);
      if (source === "catalogue" && !v.catalogueNames.has(name)) errors.push(`workflow.skills[${i}]: unknown catalogue skill ${name}`);
      return {
        name, source, role: x.role === "primary" ? "primary" as const : "supporting" as const, purpose: loc(str(x.purpose, 1200)),
        ...(hub ? { hub: { skillId: hub.name, revision: hub.revision, treeHash: hub.treeHash } } : {}),
      };
    });
    const ids = (raw: unknown) => arr(raw).map((x) => str(x, 64)).filter(Boolean);
    const steps = arr(w.steps).filter(isObj).map((x, i) => ({
      id: uniqueId(x.id, `workflow.steps[${i}]`),
      title: loc(str(x.title, 120)), does: loc(str(x.does, 1200)),
      skill: str(x.skill, 64), read: loc(str(x.read, 200)),
      checks: arr(x.checks).map((x) => str(x, 300)).filter(Boolean).map(loc),
      choiceIds: ids(x.choiceIds), outputs: ids(x.outputs),
    }));
    workflow.skills = skills;
    workflow.steps = steps;
    // Hub skills are named in skills[] only (like imported ones); skillIds stay local/catalogue ids.
    workflow.skillIds = skills.filter((s) => s.source !== "hub").map((s) => s.source === "bundled" ? localSkill(slug) :
      [...v.catalogueIds].find((id) => id.split("/").at(-1) === s.name) ?? s.name);
    errors.push(...workflowProblems(workflow, slug));
    procedure = procedureFor(workflow);
    const keys = new Set(choices.map((c) => c.id));
    const r = isObj(value.recipe) ? value.recipe : {};
    const answered: Record<string, string | number | boolean> = {};
    // A start-setting default needs a researcher decision behind it: a paper value or the model's own suggestion stays
    // open ("작업 중 결정"), so the start settings follow what the researcher said rather than the study's values.
    const decisions = new Map(
      project.decisions.filter((d) => !d.supersededBy && d.status === "answered").map((d) => [d.key, d]),
    );
    let unbacked = 0;
    if (isObj(r.choices))
      for (const [k, raw] of Object.entries(r.choices)) {
        if (!keys.has(k)) {
          errors.push(`recipe.choices "${k}" is not a requiredScientificChoices id`);
          continue;
        }
        const val = isObj(raw) ? raw.value : raw;
        const basis = isObj(raw) ? str(raw.decision, 48) : "";
        if (!["string", "number", "boolean"].includes(typeof val)) continue;
        const opts = choices.find((c) => c.id === k)?.options;
        if (!basis || !decisions.has(basis) || (opts && !opts.includes(String(val)))) {
          unbacked++;
          continue;
        }
        answered[k] = val as string | number | boolean;
      }
    if (unbacked) notes.push(`연구자 답이 뒷받침하지 않는 시작 설정 기본값 ${unbacked}개는 작업 중 결정으로 두었습니다.`);
    // The researcher asked for a reduced first-trial setting: the Workflow carries a run-scale choice, set to quick.
    if (decisions.get(TRIAL_SCALE_KEY)?.optionId === "quick-and-full") {
      const scale = choices.find((c) => c.id === RUN_SCALE_CHOICE);
      if (!scale || !scale.options?.includes("quick") || !scale.options.includes("full"))
        errors.push(
          `the researcher asked for a reduced first-trial setting: add workflow.requiredScientificChoices "${RUN_SCALE_CHOICE}" with options {"id": "quick", "label": "빠른 시험"} and {"id": "full", "label": "전체 설정"}, and describe both in SKILL.md`,
        );
      else answered[RUN_SCALE_CHOICE] = "quick";
    }
    const unresolved = [...keys].filter((k) => !(k in answered));
    recipe = { choices: answered, unresolvedChoices: unresolved };
  } else if (value.workflow !== null && value.workflow !== undefined) errors.push("workflow must be an object or null");
  const evidence = arr(value.evidence)
    .filter(isObj)
    .map((x) => ({
      field: str(x.field, 64),
      findingIds: arr(x.findingIds)
        .map((y) => findingIds.get(str(y, 10)))
        .filter((y): y is string => !!y),
    }))
    .filter((e) => e.field && e.findingIds.length);
  if (project.target === "workflow" && !workflow)
    errors.push('the researcher asked for a Workflow: add the "workflow" object and its "recipe"');
  if (project.target === "skill" && workflow)
    errors.push('the researcher asked for a skill only: set "workflow" and "recipe" to null');
  if (errors.length) return { errors };
  const scopes = ["reproduction", "generalization", "both", "unknown"] as const;
  return {
    errors,
    draft: {
      sourceRevision: project.sourceRevision,
      decisionIds: project.decisions.filter((d) => !d.supersededBy).map((d) => d.id),
      slug,
      description,
      scope: scopes.find((s) => s === value.scope) ?? "unknown",
      profile: {
        title: loc(title),
        tagline: loc(tagline),
        summary: loc(summary),
        kind,
        taxonomy,
        inputs,
        procedure,
        decisions,
        userDecisions,
        outputs,
        limitations,
        dependencies,
      },
      instructions,
      references,
      codeFiles,
      ...(workflow ? { workflow, recipe } : {}),
      evidence,
      notes,
    },
  };
}

type CandidateDraft = NonNullable<ReturnType<typeof validateDraft>["draft"]>;

/**
 * Declare the third-party imports of the supplied code files that the draft includes. The import scan is
 * deterministic, so the server records these instead of asking the model to remember them.
 */
export function declareImports(draft: CandidateDraft, ctx: SourceContext, project?: AuthoringProject) {
  const asFiles = (): PackageFile[] =>
    draft.codeFiles.map((c) => ({
      path: c.path,
      sha256: "",
      size: 0,
      text: ctx.files.get(c.sourceId)?.get(c.sourcePath),
    }));
  let files = asFiles();
  if (!files.some((f) => f.path.endsWith(".py"))) return;
  const declared = withBundled((draft.profile.dependencies ?? []).map((d) => distributionOf(d.name)));
  // A module the included code imports that exists in the supplied code (a sibling script or package) is copied in,
  // never declared as a PyPI distribution (gaid-hub-followups: r1324_r22_analysis became a "dependency").
  if (project) {
    const included: string[] = [];
    for (let round = 0; round < 5; round++) {
      // Not filtered by the declared list: an earlier draft may have declared the local module as a distribution.
      const missing = pythonImports(files, pythonStdlib());
      let added = 0;
      for (const module of missing)
        for (const sourceId of new Set(draft.codeFiles.map((c) => c.sourceId))) {
          const tree = ctx.files.get(sourceId);
          if (!tree) continue;
          const paths = [...tree.keys()].filter(
            (p) => p.endsWith(".py") && (p === `${module}.py` || p.endsWith(`/${module}.py`) || p.split("/").slice(0, -1).includes(module)),
          );
          if (!paths.length) continue;
          for (const sourcePath of paths) {
            const path = `${codeRoot(project, sourceId)}/${sourcePath}`;
            if (draft.codeFiles.some((c) => c.path === path) || !safeRelative(path)) continue;
            draft.codeFiles.push({ path, sourceId, sourcePath });
            included.push(sourcePath);
            added++;
          }
          break;
        }
      if (!added) break;
      files = asFiles();
    }
    // Every module the skill now carries (included by the model or here) is local, not a distribution.
    const local = new Set<string>();
    for (const c of draft.codeFiles) {
      const parts = c.sourcePath.split("/");
      if (c.sourcePath.endsWith(".py")) local.add(distributionOf(parts.at(-1)!.replace(/\.py$/, "")));
      for (const dir of parts.slice(0, -1)) local.add(distributionOf(dir));
    }
    if (draft.profile.dependencies)
      draft.profile.dependencies = draft.profile.dependencies.filter((d) => !local.has(distributionOf(d.name)));
    if (included.length)
      draft.notes.push(`포함한 코드가 불러오는 같은 자료 안의 파일 ${included.length}개를 함께 넣었습니다: ${included.slice(0, 5).join(", ")}`);
  }
  const modules = pythonImports(files, pythonStdlib()).filter((m) => !declared.has(distributionOf(m)));
  const names = [...new Set(modules.map(distributionOf))];
  // A distribution installed with another needed one (joblib with scikit-learn) is not declared separately.
  const needed = names.filter((n) => !names.some((m) => m !== n && withBundled([m]).has(n)));
  const added: string[] = [];
  for (const name of needed) {
    const module = modules.find((m) => distributionOf(m) === name)!;
    added.push(name);
    (draft.profile.dependencies ??= []).push({
      name,
      kind: "required",
      purpose: { ko: `제공한 코드가 import합니다 (${module}).` },
      verificationOrigin: "atlas-checked",
    });
  }
  if (added.length) draft.notes.push(`제공한 코드의 import에서 의존성 ${added.join(", ")}를 추가했습니다.`);
}

async function packageErrors(store: AuthoringStore, project: AuthoringProject, draft: CandidateDraft, deps: AgentDeps) {
  const latest = project.drafts.at(-1)?.revision ?? 0;
  const candidate: MethodDraft = {
    ...draft,
    revision: latest + 1,
    baseRevision: latest,
    origin: "model",
    createdAt: now(),
  };
  try {
    const findings = await checkMethod(project, candidate, {
      store,
      vocabulary: deps.vocabulary ?? loadVocabulary(),
      checker: "gaid-hub@draft-check",
    });
    return findings
      .filter((f) => f.level === "error")
      .slice(0, 30)
      .map((f) => `package check ${f.check}/${f.code} at ${f.path}: ${f.message}`);
  } catch (e) {
    draft.notes.push(`패키지 검사를 실행하지 못했습니다: ${(e as Error).message.slice(0, 200)}`);
    return [];
  }
}

// ------------------------------------------------------------------------------------------------
// Attempts

async function begin(
  store: AuthoringStore,
  projectId: string,
  op: AttemptOp,
  opId: unknown,
  config: ModelConfig,
  feedback?: unknown,
) {
  if (typeof opId !== "string" || !/^[\w-]{6,80}$/.test(opId))
    throw new AuthoringError("작업 식별자(opId)가 필요합니다.");
  return store.mutate(projectId, (p) => {
    const existing = p.ops[opId];
    if (existing) {
      const a = p.attempts.find((x) => x.id === existing);
      if (a) return { attempt: a, fresh: false };
    }
    if (p.attempts.some((a) => a.outcome === "running"))
      throw new AuthoringError("다른 작업이 진행 중입니다. 끝난 뒤 다시 시도해 주세요.", 409);
    if (op === "analyze" && !p.sources.some((s) => p.extractions[s.id]?.characters))
      throw new AuthoringError("글자를 읽을 수 있는 자료를 먼저 추가해 주세요.", 409);
    if (op === "draft" && !p.findings.length) throw new AuthoringError("먼저 자료를 분석해 주세요.", 409);
    if (op === "revise" && !p.drafts.length)
      throw new AuthoringError("고칠 방법 초안이 없습니다. 먼저 초안을 만들어 주세요.", 409);
    if (op === "revise" && (typeof feedback !== "string" || !feedback.trim() || feedback.length > 8000))
      throw new AuthoringError("고칠 내용을 8000자 이내로 적어 주세요.");
    const attempt: AuthoringAttempt = {
      id: newId("att"),
      op,
      opId,
      model: config.ref,
      thinkingLevel: config.thinkingLevel,
      promptVersion: op === "analyze" ? ANALYZE_PROMPT_VERSION : DRAFT_PROMPT_VERSION,
      ...(op === "revise" ? { feedback: (feedback as string).trim() } : {}),
      sourceRevision: p.sourceRevision,
      baseDraftRevision: p.drafts.at(-1)?.revision ?? 0,
      startedAt: now(),
      outcome: "running",
      validationErrors: [],
    };
    p.attempts.push(attempt);
    p.ops[opId] = attempt.id;
    return { attempt, fresh: true };
  });
}

async function finish(
  store: AuthoringStore,
  projectId: string,
  attemptId: string,
  change: (p: AuthoringProject, a: AuthoringAttempt) => void,
) {
  return store.mutate(projectId, (p) => {
    const a = p.attempts.find((x) => x.id === attemptId)!;
    change(p, a);
    a.endedAt = now();
    return structuredClone(a);
  });
}

async function execute(
  store: AuthoringStore,
  projectId: string,
  attempt: AuthoringAttempt,
  deps: AgentDeps,
): Promise<AuthoringAttempt> {
  const config = deps.config ?? modelConfig();
  const call = deps.chat ?? runtimeChat();
  const responses: { content: string; finishReason?: string }[] = [];
  const errorsByResponse: string[][] = [];
  let usage: NonNullable<AuthoringAttempt["usage"]> = {};
  const record = `attempts/${attempt.id}.json`;
  const save = (messages: ChatMessage[], extra: Record<string, unknown> = {}) =>
    store.writeFile(
      projectId,
      record,
      `${JSON.stringify({ attempt: attempt.id, op: attempt.op, promptVersion: attempt.promptVersion, model: config.ref, thinkingLevel: config.thinkingLevel, messages, responses, errors: errorsByResponse, ...extra }, null, 2)}\n`,
    );
  try {
    const project = await store.read(projectId);
    const ctx = await sourceContext(store, project);
    const v = attempt.op === "analyze" ? undefined : structuredClone(deps.vocabulary ?? loadVocabulary());
    // A shelf that cannot be read only means no hub-skill question or binding; authoring itself goes on.
    const hubCandidates = await (deps.hubSkills ?? loadHubSkillCandidates)().catch(() => [] as HubSkillCandidate[]);
    if (v) v.hubChosen = chosenHubSkills(project, hubCandidates);
    if (v) {
      v.hubNames = new Set<string>();
      for (const id of await store.ids())
        if (id !== projectId) for (const pk of (await store.read(id)).packages) v.hubNames.add(pk.slug);
      for (const name of v.hubNames) v.catalogueNames.add(name);
    }
    const request =
      attempt.op === "analyze"
        ? {
            text: [
              `Project: ${project.title}${project.goal ? `\nResearcher's goal: ${project.goal}` : ""}`,
              `Already decided (do not ask again): ${
                project.decisions
                  .filter((d) => !d.supersededBy)
                  .map((d) => d.key)
                  .join(", ") || "nothing"
              }`,
              `Open questions (do not repeat): ${
                project.questions
                  .filter((q) => q.status === "open")
                  .map((q) => q.key)
                  .join(", ") || "none"
              }`,
              `## Sources\n${ctx.text}`,
            ].join("\n\n"),
            findingIds: new Map<string, string>(),
          }
        : attempt.op === "revise"
          ? reviseRequest(project, ctx, v!, attempt.feedback ?? "")
          : draftRequest(project, ctx, v!);
    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          attempt.op === "analyze"
            ? ANALYZE_SYSTEM
            : attempt.op === "revise"
              ? `${DRAFT_SYSTEM}\n\n${REVISE_ADDENDUM}`
              : DRAFT_SYSTEM,
      },
      { role: "user", content: request.text },
    ];
    type Parsed = {
      ok: boolean;
      errors: string[];
      analysis?: AnalyzeResult;
      draft?: ReturnType<typeof validateDraft>["draft"];
    };
    const ask = async (): Promise<Parsed> => {
      const reply = await call(messages, config);
      usage = {
        input: (usage.input ?? 0) + (reply.usage?.input ?? 0),
        output: (usage.output ?? 0) + (reply.usage?.output ?? 0),
        costUsd: (usage.costUsd ?? 0) + (reply.usage?.costUsd ?? 0),
      };
      responses.push({ content: reply.content, finishReason: reply.finishReason });
      messages.push({ role: "assistant", content: reply.content });
      const parsed = parseReply(reply.content);
      let result: Parsed;
      if (!parsed.value)
        result = {
          ok: false,
          errors: [
            parsed.error!,
            ...(reply.finishReason === "length" ? ["The reply was cut off (length); answer more concisely."] : []),
          ],
        };
      else if (attempt.op === "analyze") {
        const analysis = validateAnalysis(parsed.value, project, ctx, attempt);
        result = { ok: !analysis.fatal, errors: analysis.errors, analysis };
      } else {
        const d = validateDraft(parsed.value, project, ctx, v!, request.findingIds);
        // A revision that omits code or references keeps the current ones instead of dropping them.
        const previous = project.drafts.at(-1);
        if (d.draft && attempt.op === "revise" && previous) {
          if (!Array.isArray(parsed.value.codeFiles)) d.draft.codeFiles = previous.codeFiles;
          if (!Array.isArray(parsed.value.references)) d.draft.references = previous.references;
        }
        result = { ok: !!d.draft, errors: d.errors, draft: d.draft };
        // Run the package checks on the candidate so the bounded repair can fix what packaging would refuse.
        if (d.draft) {
          declareImports(d.draft, ctx, project);
          result.errors = [...result.errors, ...(await packageErrors(store, project, d.draft, deps))];
        }
      }
      errorsByResponse.push(result.errors);
      return result;
    };
    // One bounded repair: only when the first proposal is unusable or has many dropped items.
    const first = await ask();
    let chosen: Parsed | undefined = first.ok ? first : undefined;
    let outcome: "accepted" | "repaired" | "rejected" = first.ok ? "accepted" : "rejected";
    const minor = first.errors.length <= Math.max(3, (first.analysis?.findings.length ?? 0) / 4);
    if (!first.ok || !minor) {
      messages.push({ role: "user", content: REPAIR(first.errors.slice(0, 40)) });
      const second = await ask();
      const better =
        second.ok &&
        (!first.ok ||
          (attempt.op === "analyze"
            ? second.analysis!.findings.length >= first.analysis!.findings.length
            : second.errors.length <= first.errors.length));
      if (better) {
        chosen = second;
        outcome = "repaired";
      }
    }
    const analysis = chosen?.analysis;
    const draft = chosen?.draft;
    await save(messages);
    return await finish(store, projectId, attempt.id, (p, a) => {
      a.usage = usage;
      a.validationErrors = errorsByResponse;
      a.record = record;
      if (outcome === "rejected") {
        a.outcome = "rejected";
        a.error = "모델 응답이 검사를 통과하지 못했습니다. 기존 내용은 그대로입니다.";
        return;
      }
      if (attempt.op === "analyze") {
        if (p.sourceRevision !== attempt.sourceRevision) {
          a.outcome = "rejected";
          a.error = "분석 중에 자료가 바뀌었습니다. 다시 분석해 주세요.";
          return;
        }
        p.findings = analysis!.findings;
        const decided = new Set(p.decisions.filter((d) => !d.supersededBy).map((d) => d.key));
        const open = new Set(p.questions.filter((q) => q.status === "open").map((q) => q.key));
        const fresh = analysis!.questions.filter((q) => !decided.has(q.key) && !open.has(q.key));
        p.questions.push(...fresh, ...standardQuestions(p, fresh, attempt.id, hubCandidates));
        a.result = {
          findings: analysis!.findings.length,
          questions: analysis!.questions.length,
          ...(analysis!.scope ? { scope: analysis!.scope } : {}),
        };
      } else {
        const latest = p.drafts.at(-1)?.revision ?? 0;
        if (latest !== attempt.baseDraftRevision) {
          a.outcome = "rejected";
          a.error = "작성 중에 초안이 수정되었습니다. 수정본을 지키기 위해 결과를 반영하지 않았습니다.";
          return;
        }
        const changed = p.decisions.filter((d) => !d.supersededBy && !draft!.decisionIds.includes(d.id)).length;
        const next: MethodDraft = {
          ...draft!,
          revision: latest + 1,
          baseRevision: latest,
          origin: "model",
          attemptId: attempt.id,
          createdAt: now(),
          notes: [
            ...draft!.notes,
            ...(changed ? [`작성 중에 들어온 답 ${changed}개는 아직 반영되지 않았습니다.`] : []),
          ],
        };
        // The researcher's example data stays with its input role; the model never writes examples.
        carryExamples(p.drafts.at(-1), next);
        p.drafts.push(next);
        a.result = { draftRevision: next.revision };
      }
      a.outcome = outcome;
    });
  } catch (e) {
    await save([], { failure: (e as Error).message }).catch(() => {});
    return finish(store, projectId, attempt.id, (_p, a) => {
      a.outcome = "failed";
      a.usage = usage;
      a.validationErrors = errorsByResponse;
      a.record = record;
      a.error = `모델 호출이 실패했습니다: ${(e as Error).message}`.slice(0, 600);
    });
  }
}

/** Start an operation and return its attempt immediately; the model call continues in the background. */
export async function startOperation(
  store: AuthoringStore,
  projectId: string,
  op: AttemptOp,
  opId: unknown,
  deps: AgentDeps = {},
): Promise<AuthoringAttempt> {
  if (op !== "analyze" && op !== "draft" && op !== "revise") throw new AuthoringError("지원하지 않는 작업입니다.");
  // Refuse before recording an attempt when the model is unknown, not connected or over the cap.
  if (!deps.chat) await preflight(deps.config ?? modelConfig());
  const { attempt, fresh } = await begin(store, projectId, op, opId, deps.config ?? modelConfig(), deps.feedback);
  if (fresh) void execute(store, projectId, attempt, deps).catch((e) => console.error("authoring attempt", e));
  return attempt;
}

/** Run an operation to completion (tests and scripted acceptance runs). */
export async function runOperation(
  store: AuthoringStore,
  projectId: string,
  op: AttemptOp,
  opId: string,
  deps: AgentDeps = {},
): Promise<AuthoringAttempt> {
  const { attempt, fresh } = await begin(store, projectId, op, opId, deps.config ?? modelConfig(), deps.feedback);
  return fresh ? execute(store, projectId, attempt, deps) : attempt;
}
