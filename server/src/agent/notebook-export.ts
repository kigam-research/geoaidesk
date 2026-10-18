import { notebookExportText } from "../../../web/src/geo/notebook/export-text.ts";
/**
 * Render notebook entries to a Markdown lab record: a header, then one section
 * per entry with type label, title, attribution, thread links, body, embedded
 * image artifacts (other files as links), and fenced code. Elapsed is derived
 * from the first entry. Pure (no fs) — zip bundling passes artifactHref /
 * missingArtifacts to rewrite or annotate artifact references.
 */
import type { NotebookEntry } from "./notebook-store.ts";
import { deriveEvidenceThreads, evidenceLinks, notebookEntryKey, notebookTargetKey } from "../../../web/src/lib/notebook-evidence-core.ts";
import type { NotebookAnnotation } from "./notebook-annotations.ts";
import { nextExperimentsText } from "../../../web/src/lib/next-experiments.ts";
import { planHistoryText } from "../../../web/src/lib/notebook-plans.ts";
import { resultReferenceText } from "../../../web/src/lib/notebook-result-links.ts";
import { notebookExecutionText } from "../../../web/src/lib/notebook-execution.ts";


const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

/** Entry carrying the project-scope `sessionId` stamp the merge route adds. */
type ScopedEntry = NotebookEntry & { sessionId?: string };

export interface NotebookMarkdownOpts {
  lang?: string;
  /** Session-scope export: the session's id. Omit for a project-scope export. */
  sessionId?: string;
  projectName?: string;
  /**
   * Project-scope export: session id → display label. When present, entries
   * are grouped under a heading per session (mirroring the "All chats" view
   * and its PDF export) and entry headings drop a level.
   */
  sessionLabels?: ReadonlyMap<string, string>;
  /** Optional user layer included by complete-project exports. */
  annotations?: readonly NotebookAnnotation[];
  /** Rewrite an artifact link target (e.g. into a zip bundle); undefined keeps the path. */
  artifactHref?: (relPath: string) => string | undefined;
  /** Artifact paths known missing on disk — noted as text instead of linked. */
  missingArtifacts?: ReadonlySet<string>;
}

function annotationTime(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp) : date.toISOString();
}

export function notebookToMarkdown(
  entries: NotebookEntry[],
  opts: NotebookMarkdownOpts,
): string {
  const text = notebookExportText(opts.lang);
  const label = (key: string) => text("export." + key);
  const grouped = opts.sessionLabels !== undefined;
  const h = grouped ? "###" : "##";
  const lines: string[] = [];
  lines.push(`# ${label("title")}`);
  if (opts.projectName) lines.push(`**${label("project")}:** ${opts.projectName}`);
  if (opts.sessionId) lines.push(`**${label("session")}:** ${opts.sessionId}`);
  if (grouped) {
    const chats = new Set(entries.map((e) => (e as ScopedEntry).sessionId ?? ""));
    lines.push(`**${label("chats")}:** ${chats.size}`);
  }
  if (entries.length > 0) {
    const start = new Date(entries[0].timestamp).toISOString();
    const end = new Date(entries[entries.length - 1].timestamp).toISOString();
    lines.push(`**${label("span")}:** ${start} → ${end}`);
    lines.push(`**${label("entries")}:** ${entries.length}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  const byId = new Map(entries.map((e) => [notebookEntryKey(e as ScopedEntry), e]));
  const threads = deriveEvidenceThreads(entries);
  const annotationsByEntry = new Map<string, NotebookAnnotation[]>();
  const notes: NotebookAnnotation[] = [];
  const unresolved: NotebookAnnotation[] = [];
  for (const annotation of opts.annotations ?? []) {
    if (annotation.kind === "note") {
      notes.push(annotation);
    } else if (annotation.entryId && byId.has(notebookEntryKey({ id: annotation.entryId, sessionId: (annotation as { sessionId?: string }).sessionId }))) {
      const key = notebookEntryKey({ id: annotation.entryId, sessionId: (annotation as { sessionId?: string }).sessionId });
      const annotations = annotationsByEntry.get(key) ?? [];
      annotations.push(annotation);
      annotationsByEntry.set(key, annotations);
    } else {
      unresolved.push(annotation);
    }
  }

  const t0 = entries[0]?.timestamp ?? 0;
  let openSession: string | undefined;
  for (const e of entries) {
    if (grouped) {
      // Entries arrive chronologically with a sessionId stamp; start a new
      // section whenever the chat changes (same grouping as the PDF export).
      const sid = (e as ScopedEntry).sessionId ?? "";
      if (sid !== openSession) {
        openSession = sid;
        lines.push(`## ${opts.sessionLabels?.get(sid) || sid || label("unattributed")}`, "");
      }
    }
    const elapsed = Math.max(0, Math.round((e.timestamp - t0) / 1000));
    lines.push(`${h} ${text("type." + e.type)}: ${e.title}`);
    const bits = [`+${elapsed}s`, text("export.by", { role: opts.lang !== "ko" ? e.role ?? "" : e.role === "agent" ? text("role.lead") : e.role === "you" ? text("role.you") : e.role ?? "" })];
    if (e.confidence) bits.push(text("export.confidence", { confidence: text("confidence." + e.confidence) }));
    if (e.tags?.length) bits.push(e.tags.map((t) => `#${t}`).join(" "));
    lines.push(`_${bits.join(" · ")}_`);
    const thread = threads.get(notebookEntryKey(e as ScopedEntry));
    if (thread?.status) lines.push(`**${label("evidence_status")}:** ${text("hypothesis." + thread.status)} (${label("authored_interpretations")})`);
    if (thread?.reviewRequired) lines.push(`**${label("needs_review")}:** ${label("review_description")}`);
    for (const link of evidenceLinks(e)) {
      const target = byId.get(notebookTargetKey(e as ScopedEntry, link.entryId, link.sessionId));
      const rel = text((link.relation === "challenges" || link.relation === "context" ? "export.relation." : "relation.") + link.relation);
      lines.push(`_↳ ${rel} “${target?.title ?? link.entryId}” (${link.entryId})${!target ? ` — ${label("unavailable")}` : ""}_`);
      if (link.rationale) lines.push(link.rationale);
    }
    if (e.supersedes) {
      const target = byId.get(notebookTargetKey(e as ScopedEntry, e.supersedes));
      lines.push(`_↺ ${label("supersedes")} “${target?.title ?? e.supersedes}” (${e.supersedes})_`);
    }
    const superseder = thread?.supersededBy ? byId.get(thread.supersededBy) : undefined;
    if (superseder) lines.push(`_⚠ ${label("superseded_by")} “${superseder.title}”_`);
    if (e.scope) lines.push(`**${label("applicability")}:** ${e.scope}`);
    if (e.execution || e.type === "method") lines.push(notebookExecutionText(e.execution, opts.lang));
    if (e.revisitWhen) lines.push(`**${label("revisit")}:** ${e.revisitWhen}`);
    if (e.outcome) lines.push(`**${label("outcome")}:** ${text("outcome." + e.outcome)} (${label("outcome_notice")})`);
    if (e.limitations?.length) lines.push(`**${label("limitations")}:**`, ...e.limitations.map((x) => `- ${x}`));
    if (e.artifactHealth?.length) {
      lines.push(`**${label("artifact_checks")}:** ${label("artifact_notice")}`);
      for (const check of e.artifactHealth) lines.push(`- \`${check.path}\`: **${text("health." + check.status)}** — ${check.reason ?? ""} (${text("export.checked", { when: annotationTime(check.checkedAt) })})`);
    }
    if (e.artifactHealthTruncated) lines.push(`**${label("incomplete")}:** ${text("export.omitted", { count: e.artifactHealthTruncated })}`);
    const entryAnnotations = annotationsByEntry.get(notebookEntryKey(e as ScopedEntry)) ?? [];
    const pins = entryAnnotations.filter((annotation) => annotation.kind === "pin");
    if (pins.length > 0) {
      const times = pins.map((pin) => annotationTime(pin.createdAt)).join(", ");
      lines.push(`_${text("export.pinned", { times })}_`);
    }
    lines.push("");
    if (e.body) { lines.push(e.body); lines.push(""); }
    if (e.nextExperiments) lines.push(`**${label("next")}:**`, nextExperimentsText(e.nextExperiments, opts.lang), "");
    if (e.nextExperimentBinding) lines.push(`**${label("proposal_context")}:**`, "```json", JSON.stringify(e.nextExperimentBinding, null, 2), "```", "");
    if (e.nextExperimentDecision) lines.push(`**${label("preference")}:**`, "```json", JSON.stringify(e.nextExperimentDecision, null, 2), "```", "");
    if (e.analysisPlan) lines.push(`**${label("analysis_plan")}:**`, "```json", JSON.stringify(e.analysisPlan, null, 2), "```", "");
    if (e.robustness) lines.push(`**${label("robustness")}:**`, "```json", JSON.stringify(e.robustness, null, 2), "```", "");
    if (e.planHistory) lines.push(planHistoryText(e.planHistory, opts.lang), "");
    if (e.planHistoryError) lines.push(`**${label("plan_unavailable")}:** ${e.planHistoryError}`, "");
    if (e.results?.length) {
      lines.push(`**${label("result_refs")}:** ${label("result_notice")}`);
      for (const ref of e.results) {
        const sid = ref.sessionId ?? (e as ScopedEntry).sessionId ?? opts.sessionId;
        const snapshot = e.resultSnapshots?.find((s) => s.sessionId === sid && s.toolCallId === ref.toolCallId);
        lines.push(`- ${resultReferenceText(snapshot ?? ref, sid, opts.lang)}`);
      }
      lines.push("");
    }
    if (e.code) {
      lines.push("```" + (e.code.lang ?? ""));
      lines.push(e.code.source);
      lines.push("```");
      lines.push("");
    }
    if (e.artifacts?.length) {
      for (const p of e.artifacts) {
        if (opts.missingArtifacts?.has(p)) {
          lines.push(`\`${p}\` _(${label("missing_artifact")})_`);
          continue;
        }
        const name = p.split("/").pop() ?? p;
        const href = opts.artifactHref?.(p) ?? p;
        lines.push(IMAGE_RE.test(p) ? `![${name}](${href})` : `[${p}](${href})`);
      }
      lines.push("");
    }
    const comments = entryAnnotations.filter((annotation) => annotation.kind === "comment");
    if (comments.length > 0) {
      lines.push(`${h}# ${label("comments")}`, "");
      for (const comment of comments) {
        lines.push(`**${annotationTime(comment.createdAt)}**`, "", comment.body ?? "", "");
      }
    }
  }
  if (notes.length > 0) {
    lines.push(`## ${label("notes")}`, "");
    for (const note of notes) {
      lines.push(`### ${note.title?.trim() || text("type.note")}`);
      lines.push(`_${annotationTime(note.createdAt)}_`, "", note.body ?? "", "");
    }
  }
  if (unresolved.length > 0) {
    lines.push(`## ${label("unresolved")}`, "");
    for (const annotation of unresolved) {
      const target = annotation.entryId ?? label("unknown");
      const detail = annotation.kind === "comment" ? `: ${annotation.body ?? ""}` : "";
      lines.push(
        `- ${text("export.missing_entry", { kind: text("annotation." + annotation.kind), target, when: annotationTime(annotation.createdAt), comment: detail })}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
