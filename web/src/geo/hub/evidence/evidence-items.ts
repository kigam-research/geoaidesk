/**
 * The passages one authoring question rests on, as the side viewer lists them (gaid-authoring-evidence-view). IO-free:
 * built from the question's and its options' anchors plus the project's sources and extraction records.
 */
import type {
  Anchor,
  CodeFileEntry,
  ExtractionRecord,
  Question,
  SourceDocument,
} from "@/geo/contracts/authoring";

/**
 * How the viewer shows the cited place: a PDF page (pdf.js), the text of a page (web sources), the lines of a text file
 * (code, notes, analysis bundles), the inspection summary of a data file, or no place at all (the citation names no page
 * or file that exists).
 */
export type EvidencePlace = "pdf" | "page" | "file" | "data" | "none";

export interface EvidenceItem {
  /** Stable within the question. */
  key: string;
  anchor: Anchor;
  /** The source, or undefined when it was removed from the draft after the question was asked. */
  source?: SourceDocument;
  place: EvidencePlace;
  /** The file entry for `file` and `data` places. */
  file?: CodeFileEntry;
  /** Pages of a PDF or web source, when known. */
  pages?: number;
  /** The question itself cites the passage. */
  question: boolean;
  /** Options that cite the passage, in the order the question lists them. */
  optionIds: string[];
}

const anchorKey = (a: Anchor) => `${a.sourceId}|${a.page ?? ""}|${a.path ?? ""}|${a.quote}`;

function placeOf(anchor: Anchor, source: SourceDocument | undefined, x: ExtractionRecord | undefined) {
  if (!source) return { place: "none" as const };
  if (anchor.page !== undefined) {
    if (x?.pages && anchor.page > x.pages) return { place: "none" as const };
    return { place: source.kind === "pdf" ? ("pdf" as const) : ("page" as const), pages: x?.pages };
  }
  if (anchor.path !== undefined) {
    const file = x?.files?.find((f) => f.path === anchor.path);
    if (file?.data) return { place: "data" as const, file };
    if (file?.text) return { place: "file" as const, file };
  }
  return { place: "none" as const };
}

/** Question evidence first, then each option's own passages; a passage cited twice is listed once. */
export function evidenceItems(
  question: Question,
  sources: SourceDocument[],
  extractions: Record<string, ExtractionRecord>,
): EvidenceItem[] {
  const items = new Map<string, EvidenceItem>();
  const add = (anchor: Anchor, from: { question: true } | { optionId: string }) => {
    const key = anchorKey(anchor);
    let item = items.get(key);
    if (!item) {
      const source = sources.find((s) => s.id === anchor.sourceId);
      item = { key, anchor, source, ...placeOf(anchor, source, extractions[anchor.sourceId]), question: false, optionIds: [] };
      items.set(key, item);
    }
    if ("question" in from) item.question = true;
    else if (!item.optionIds.includes(from.optionId)) item.optionIds.push(from.optionId);
  };
  for (const a of question.evidence) add(a, { question: true });
  for (const o of question.options) for (const a of o.evidence ?? []) add(a, { optionId: o.id });
  return [...items.values()];
}

/** The first passage an option cites (where the viewer moves when the option is chosen). */
export function optionItem(items: EvidenceItem[], optionId: string): EvidenceItem | undefined {
  return items.find((i) => i.optionIds.includes(optionId));
}
