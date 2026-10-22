/**
 * Answers to a research note's decisions (gaid-note-decisions): the researcher picks an option or writes a separate
 * instruction for each decision, then sends all answers in one chat message.
 */
import { t } from "@/geo/i18n";
import type { ResearchNoteSummary } from "@/geo/contracts/research-notes";

/** One decision's answer: a listed option by label, or a separate instruction written by the researcher. */
export type DecisionAnswer = { kind: "option"; label: string } | { kind: "instruction"; text: string };
/** Answers keyed by decision number. */
export type DecisionAnswers = Record<number, DecisionAnswer>;

/** True when the answer can be sent (an instruction needs text). */
export function isAnswered(answer: DecisionAnswer | undefined): answer is DecisionAnswer {
  return answer?.kind === "option" || (answer?.kind === "instruction" && answer.text.trim().length > 0);
}

/** Number of decisions with a sendable answer. */
export function answeredCount(note: ResearchNoteSummary, answers: DecisionAnswers): number {
  return note.decisions.filter((decision) => isAnswered(answers[decision.number])).length;
}

/** The same answer (instruction text compared trimmed). */
export function sameAnswer(a: DecisionAnswer | undefined, b: DecisionAnswer | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === "option" ? a.label === (b as typeof a).label : a.text.trim() === (b as typeof a).text.trim();
}

/**
 * The chat message for all sendable answers, or null when none is sendable. Unanswered decisions stay open;
 * decisions in `settled` (answered in an earlier message) are neither sent again nor named as open.
 */
export function answersMessage(note: ResearchNoteSummary, answers: DecisionAnswers, settled: ReadonlySet<number> = new Set()): string | null {
  const lines: string[] = [];
  const open: number[] = [];
  for (const decision of note.decisions) {
    const answer = answers[decision.number];
    if (!isAnswered(answer)) { if (!settled.has(decision.number)) open.push(decision.number); continue; }
    if (answer.kind === "instruction") {
      lines.push(t("notes.decision.prompt.instruction", { number: decision.number, instruction: answer.text.trim().replace(/\s*\n\s*/g, " ") }));
      continue;
    }
    const option = decision.options.find((item) => item.label === answer.label);
    if (!option) { open.push(decision.number); continue; }
    lines.push(t("notes.decision.prompt.option", { number: decision.number, label: option.label, text: option.text }));
  }
  if (!lines.length) return null;
  // Markdown paragraphs and a list: the chat renders the message as Markdown, where single line breaks collapse.
  const closing = [open.length ? t("notes.decision.prompt.open", { numbers: open.join(", ") }) : null, t("notes.decision.prompt.tail")];
  return [
    t("notes.decision.prompt.head", { title: note.title }),
    t("notes.decision.prompt.note", { path: note.path }),
    lines.map((line) => `- ${line}`).join("\n"),
    closing.filter(Boolean).join(" "),
  ].join("\n\n");
}

/**
 * An answer that left the note (UI guide v2 RN3): `sent` when the chat sent it, `filled` when the chat only put it in its
 * chat box. Kept per browser and note; the question text ties it to the decision, so a revised note drops stale marks.
 */
export interface DeliveredAnswer { question: string; answer: DecisionAnswer; via: "sent" | "filled"; at: string }
export type DeliveredAnswers = Record<number, DeliveredAnswer>;

const deliveredKey = (projectId: string, noteId: string) => `gaid:note-answers:${projectId}:${noteId}`;

/** Delivered answers still matching the note's current decisions. */
export function loadDelivered(projectId: string, note: ResearchNoteSummary): DeliveredAnswers {
  let stored: DeliveredAnswers = {};
  try {
    const raw = window.localStorage.getItem(deliveredKey(projectId, note.id));
    if (raw) stored = JSON.parse(raw) as DeliveredAnswers;
  } catch { return {}; }
  const result: DeliveredAnswers = {};
  for (const decision of note.decisions) {
    const item = stored[decision.number];
    if (!item || item.question !== decision.question || !isAnswered(item.answer)) continue;
    if (item.answer.kind === "option" && !decision.options.some((option) => option.label === (item.answer as { label: string }).label)) continue;
    result[decision.number] = item;
  }
  return result;
}

export function saveDelivered(projectId: string, noteId: string, delivered: DeliveredAnswers): void {
  try { window.localStorage.setItem(deliveredKey(projectId, noteId), JSON.stringify(delivered)); } catch { /* storage full or blocked: the mark lasts this view only */ }
}
