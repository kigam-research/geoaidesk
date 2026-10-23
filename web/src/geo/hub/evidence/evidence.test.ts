import { describe, expect, it } from "vitest";

import type { ExtractionRecord, Question, SourceDocument } from "@/geo/contracts/authoring";

import { evidenceItems, optionItem } from "./evidence-items";
import { mergeLineBoxes } from "./evidence-pdf";
import { locateQuote, quoteLines, quoteSpans } from "./quote-match";

describe("locateQuote", () => {
  it("finds a quote across spacing, case, ligatures and line-break hyphens", () => {
    const text = "Nested cross-\nvalidation  separates tuning from ﬁnal testing.";
    const r = locateQuote("cross-validation separates tuning from final", text)!;
    expect(r.partial).toBe(false);
    expect(text.slice(r.start, r.end)).toBe("cross-\nvalidation  separates tuning from ﬁnal");
  });

  it("marks only part of a quote whose ending differs, and refuses short or absent quotes", () => {
    const text = "We use spatial blocks of 50 km for evaluation.";
    const r = locateQuote("spatial blocks of 50 km for the outer folds", text)!;
    expect(r.partial).toBe(true);
    expect(text.slice(r.start, r.end)).toContain("spatial blocks");
    expect(locateQuote("50 km", text)).toBeNull();
    expect(locateQuote("random forest with 500 trees", text)).toBeNull();
  });
});

describe("quoteSpans and quoteLines", () => {
  it("picks the text-layer spans of the quote and skips manuscript line numbers", () => {
    const spans = ["18", "surfaces to exploration priorities. This study", "19", "develops a framework", "Figure 2"];
    expect(quoteSpans(spans, "This study develops a framework")).toEqual({ spans: [1, 3], partial: false, from: 36, to: 20 });
    expect(spans[1].slice(36)).toBe("This study");
    expect(quoteSpans(spans, "an absent sentence here")).toBeNull();
  });

  it("gives the 1-based lines of a quote in a file", () => {
    const file = "import numpy as np\n\ndef fit(x):\n    return model.fit(x, block_size=50)\n";
    expect(quoteLines(file, "return model.fit(x, block_size=50)")).toEqual({ first: 4, last: 4, partial: false });
    expect(quoteLines(file, "def fit(x):\n    return model")).toEqual({ first: 3, last: 4, partial: false });
  });
});

const source = (id: string, kind: SourceDocument["kind"], name = id): SourceDocument => ({
  id,
  kind,
  name,
  mediaType: "",
  sha256: "",
  size: 1,
  addedAt: "",
  status: "extracted",
});
const extraction = (sourceId: string, more: Partial<ExtractionRecord>): ExtractionRecord => ({
  sourceId,
  sourceSha256: "",
  tool: "",
  coveredPages: [],
  emptyPages: [],
  figures: [],
  characters: 1,
  at: "",
  ...more,
});

describe("mergeLineBoxes", () => {
  it("joins adjacent boxes of one line and keeps lines apart", () => {
    const line = (left: number, width: number, top = 100) => ({ left, top, width, height: 10 });
    expect(mergeLineBoxes([line(10, 50), line(62, 6), line(70, 30), line(10, 80, 112)])).toEqual([
      { left: 10, top: 100, width: 90, height: 10 },
      line(10, 80, 112),
    ]);
  });
});

describe("evidenceItems", () => {
  const sources = [source("p", "pdf", "paper.pdf"), source("w", "web"), source("c", "code"), source("d", "data")];
  const extractions = {
    p: extraction("p", { pages: 9 }),
    w: extraction("w", { pages: 2 }),
    c: extraction("c", { files: [{ path: "run.py", size: 1, sha256: "", text: true }] }),
    d: extraction("d", {
      files: [{ path: "wells.csv", size: 1, sha256: "", text: true, data: { format: "csv", family: "table", inspector: "t" } }],
    }),
  };
  const question: Question = {
    id: "q1",
    key: "scope",
    revision: 1,
    text: "",
    reason: "",
    affects: "",
    answerType: "choice-or-text",
    materiality: "required",
    status: "open",
    attemptId: "",
    draftRevision: 0,
    createdAt: "",
    evidence: [
      { sourceId: "p", page: 4, quote: "blocks of 50 km", verified: true },
      { sourceId: "w", page: 1, quote: "a web passage", verified: true },
      { sourceId: "gone", page: 1, quote: "removed source", verified: true },
      { sourceId: "p", quote: "not found anywhere", verified: false },
    ],
    options: [
      { id: "a", label: "A", evidence: [{ sourceId: "p", page: 4, quote: "blocks of 50 km", verified: true }] },
      { id: "b", label: "B", evidence: [{ sourceId: "c", path: "run.py", quote: "model.fit(x)", verified: true }] },
      { id: "c", label: "C", evidence: [{ sourceId: "d", path: "wells.csv", quote: "depth,grade", verified: true }] },
    ],
  };

  it("lists each passage once with its place, the options citing it and removed sources", () => {
    const items = evidenceItems(question, sources, extractions);
    expect(items.map((i) => [i.anchor.sourceId, i.place, i.question, i.optionIds])).toEqual([
      ["p", "pdf", true, ["a"]],
      ["w", "page", true, []],
      ["gone", "none", true, []],
      ["p", "none", true, []],
      ["c", "file", false, ["b"]],
      ["d", "data", false, ["c"]],
    ]);
    expect(items[0].pages).toBe(9);
    expect(items[2].source).toBeUndefined();
    expect(optionItem(items, "b")?.anchor.path).toBe("run.py");
    expect(optionItem(items, "z")).toBeUndefined();
  });
});
