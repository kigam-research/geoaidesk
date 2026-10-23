/** File-master research-note parsing. No filesystem access or YAML execution. */
import {
  RESEARCH_NOTE_SECTIONS, RESEARCH_NOTE_STATUSES,
  type ResearchNoteDecision, type ResearchNoteProblem, type ResearchNoteSection, type ResearchNoteStatus,
} from "../../../../web/src/geo/contracts/research-notes.ts";

export interface ParsedResearchNote {
  title: string;
  date: string;
  status: ResearchNoteStatus;
  headline: string | null;
  cover: string | null;
  supersedes: string[];
  decisions: ResearchNoteDecision[];
  problems: ResearchNoteProblem[];
}

function scalar(value: string): string {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  return text;
}

/** YAML's empty values (`cover: null`, `supersedes: ~`) mean "none", not a file or note named "null". */
function optional(value: string | undefined): string {
  const text = scalar(value ?? "");
  return /^(?:null|~)$/i.test(text) && !/^["']/.test((value ?? "").trim()) ? "" : text;
}

function list(value: string): string[] {
  if (!optional(value)) return [];
  const text = value.trim().replace(/^\[([\s\S]*)\]$/, "$1");
  return [...new Set(text.split(",").map(scalar).map(s => s.normalize("NFC")).filter(Boolean))];
}

/** Also used by the status writer; spans include the delimiters, never body text. */
export function frontmatterSpan(text: string): { start: number; bodyStart: number; bodyEnd: number; end: number } | null {
  const opening = /^(?:\uFEFF)?---\r?\n/.exec(text);
  if (!opening) return null;
  const closing = /^---(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(text);
  return match ? { start: text.startsWith("\uFEFF") ? 1 : 0, bodyStart: opening[0].length, bodyEnd: match.index, end: match.index + match[0].length } : null;
}

function parseDecisions(text: string, problems: ResearchNoteProblem[]): ResearchNoteDecision[] {
  const decisions: ResearchNoteDecision[] = [];
  const malformed = () => {
    if (!problems.some(p => p.code === "decision-format")) problems.push({ code: "decision-format", target: "decisions" });
  };
  let current: ResearchNoteDecision | undefined;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^(?:없음|none)[.!]?$/i.test(trimmed)) continue;
    const question = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
    if (question) {
      const number = Number(question[1]);
      if (number < 1 || decisions.some(d => d.number === number)) malformed();
      current = { number, question: question[2].trim(), options: [] };
      decisions.push(current);
      continue;
    }
    // A recommendation on its own line after the options (`- (권장: 나 — reason)`, `권장: 나) reason`), as models
    // and the vault's decision lines often write it.
    const standalone = /^(?:[-*]\s+)?\(?\s*(?:권장|recommended)\s*:\s*([\p{L}])(?:\)|\s*[—–:-]|\s*$)\s*(.*?)\)?\s*$/iu.exec(trimmed);
    if (standalone && current) {
      const target = current.options.find(o => o.label === standalone[1]);
      if (!target || current.options.some(o => o.recommended)) { malformed(); continue; }
      target.recommended = true;
      target.reason = standalone[2].trim() || null;
      continue;
    }
    const option = /^-\s+([\p{L}])\)\s+(.+)$/u.exec(trimmed);
    if (!option || !current) { malformed(); continue; }
    const recommendation = /\((?:권장|recommended):\s*([^)]*)\)\s*$/i.exec(option[2]);
    const optionText = (recommendation ? option[2].slice(0, recommendation.index) : option[2]).trim();
    if (!optionText || (recommendation && !recommendation[1].trim()) || current.options.some(o => o.label === option[1])) malformed();
    current.options.push({ label: option[1], text: optionText, recommended: !!recommendation, reason: recommendation ? recommendation[1].trim() || null : null });
  }
  for (const decision of decisions) {
    if (!decision.options.length || decision.options.filter(o => o.recommended).length > 1) malformed();
  }
  return decisions;
}

export function parseResearchNote(content: string, id: string): ParsedResearchNote {
  const problems: ResearchNoteProblem[] = [];
  const span = frontmatterSpan(content);
  const fields: Record<string, string> = Object.create(null);
  if (!span) problems.push({ code: "frontmatter" });
  else for (const line of content.slice(span.bodyStart, span.bodyEnd).split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!field || field[1] in fields) { problems.push({ code: "frontmatter" }); continue; }
    fields[field[1]] = field[2];
  }
  const body = span ? content.slice(span.end) : content;
  // Code examples are not headings or decisions.
  const prose = body.replace(/^(`{3,}|~{3,}).*\r?\n[\s\S]*?^\1[^\n]*(?:\n|$)/gm, "");
  const frontTitle = scalar(fields.title ?? "");
  const title = frontTitle || /^#\s+(.+)$/m.exec(prose)?.[1].trim() || id;
  if (!frontTitle) problems.push({ code: "title", target: "title" });
  const date = scalar(fields.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push({ code: "frontmatter", target: "date" });
  const rawStatus = scalar(fields.status ?? "");
  const status = RESEARCH_NOTE_STATUSES.includes(rawStatus as ResearchNoteStatus) ? rawStatus as ResearchNoteStatus : "pending";
  if (status !== rawStatus) problems.push({ code: "status", target: "status" });
  const sections: Partial<Record<ResearchNoteSection, string>> = {};
  let current: ResearchNoteSection | undefined;
  for (const line of prose.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const name = heading[1].replace(/^\d+[.)]\s*/, "").trim();
      current = (Object.keys(RESEARCH_NOTE_SECTIONS) as ResearchNoteSection[]).find(key =>
        RESEARCH_NOTE_SECTIONS[key].some(label => label.toLowerCase() === name.toLowerCase()));
      if (current) sections[current] ??= "";
    } else if (current) sections[current] += `${line}\n`;
  }
  for (const key of Object.keys(RESEARCH_NOTE_SECTIONS) as ResearchNoteSection[]) {
    if (!(key in sections)) problems.push({ code: "section-missing", target: key });
  }
  return {
    title, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : /^\d{4}-\d{2}-\d{2}/.exec(id)?.[0] ?? "",
    status, headline: optional(fields.headline) || null, cover: optional(fields.cover) || null,
    supersedes: list(fields.supersedes ?? ""), decisions: parseDecisions(sections.decisions ?? "", problems), problems,
  };
}
