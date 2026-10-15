import { describe, expect, it } from "vitest";
import type { PreviewEvent } from "../contracts/authoring-preview";
import { initialPreviewState, previewTransition, replacePreviewSource, restorePreviewState, revealPreparedAnalysis, SAMPLE_REFERENCE, savePreviewState } from "./state";

const defaults = { title: "Draft", summary: "Untested method" };
const move = (s: ReturnType<typeof initialPreviewState>, e: PreviewEvent) => previewTransition(s, e, defaults);
const sample = () => revealPreparedAnalysis(replacePreviewSource(initialPreviewState(), { kind: "sample", name: "Paper", reference: SAMPLE_REFERENCE }));
const draft = () => move(move(sample(), { type: "choice", value: "draft-code" }), { type: "create-draft" });

describe("source-grounded authoring preview", () => {
  it("does not reuse prepared findings for an arbitrary PDF or URL", () => {
    for (const source of [{ kind: "local-pdf" as const, name: "another.pdf" }, { kind: "url" as const, name: "site", reference: "https://example.org/paper" }]) {
      const replaced = replacePreviewSource(draft(), source);
      expect(revealPreparedAnalysis(replaced)).toEqual(replaced);
      expect(replaced).toMatchObject({ draft: null, exampleAnalysis: false, choice: null, trialData: null });
      expect(move(replaced, { type: "step", step: "trial" }).step).toBe("sources");
      const forged = { ...draft(), source };
      expect(restorePreviewState(JSON.stringify(forged))).toMatchObject({ draft: null, exampleAnalysis: false });
    }
  });
  it("requires code for the existing-code branch and never treats defer as an answer", () => {
    let s = move(sample(), { type: "choice", value: "attach-code" });
    expect(move(s, { type: "create-draft" }).draft).toBeNull();
    s = move(s, { type: "attach", role: "code", file: { name: "code.py", size: 12 } });
    expect(move(s, { type: "create-draft" }).draft).not.toBeNull();
    s = move(s, { type: "defer" });
    expect(move(s, { type: "create-draft" }).draft).toBeNull();
  });
  it("preserves edits on return but invalidates dependent drafts after decisions change", () => {
    let s = move(draft(), { type: "edit-draft", field: "title", value: "My method" });
    s = move(move(s, { type: "step", step: "method" }), { type: "create-draft" });
    expect(s.draft?.title).toBe("My method");
    expect(move(s, { type: "choice", value: "procedure" }).draft).toBeNull();
    expect(move(s, { type: "purpose", value: "New question" }).draft).toBeNull();
    expect(move(s, { type: "attach", role: "results", file: { name: "output.csv", size: 2 } }).draft).toBeNull();
  });
  it("previews a request only after required input and never restores that transient state", () => {
    let s = draft();
    expect(move(s, { type: "preview-trial-request" }).trialRequestPreview).toBe(false);
    s = move(move(s, { type: "attach", role: "trial", file: { name: "data.csv", size: 1 } }), { type: "comparison", value: "Compare ranking" });
    s = move(s, { type: "preview-trial-request" });
    expect(s.trialRequestPreview).toBe(true);
    expect(restorePreviewState(JSON.stringify(s))?.trialRequestPreview).toBe(false);
    expect(move({ ...s, choice: "procedure", trialRequestPreview: false }, { type: "preview-trial-request" }).trialRequestPreview).toBe(false);
  });
  it("records saving only after successful storage and rejects incompatible or forged sample identities", () => {
    const s = draft(); let raw = "";
    const saved = savePreviewState({ setItem: (_key, value) => { raw = value; } }, s, "2026-10-15T12:00:00Z");
    expect(restorePreviewState(raw)?.draft).toEqual(s.draft);
    expect(saved.savedAt).not.toBeNull();
    expect(() => savePreviewState({ setItem: () => { throw new Error("quota"); } }, s)).toThrow("quota");
    expect(s.savedAt).toBeNull();
    expect(restorePreviewState(JSON.stringify({ ...s, source: { kind: "sample", name: "fake", reference: "other" } }))).toBeNull();
    expect(restorePreviewState('{"version":2}')).toBeNull();
  });
});
