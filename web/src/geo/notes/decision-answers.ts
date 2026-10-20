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

/** The chat message for all sendable answers, or null when none is sendable. Unanswered decisions stay open. */
export function answersMessage(note: ResearchNoteSummary, answers: DecisionAnswers): string | null {
  const lines: string[] = [];
  const open: number[] = [];
  for (const decision of note.decisions) {
    const answer = answers[decision.number];
    if (!isAnswered(answer)) { open.push(decision.number); continue; }
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
