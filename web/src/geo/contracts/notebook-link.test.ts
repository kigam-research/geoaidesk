import { describe, expect, it } from "vitest";
import { normalizeNotebookUrl, NOTEBOOK_URL_MAX } from "./notebook-link";

describe("external notebook URLs", () => {
  it("trims and normalizes HTTPS addresses, including non-Google notebook hosts", () => {
    expect(normalizeNotebookUrl("  https://NotebookLM.Google.com/notebook/abc?q=1#section  ")).toBe("https://notebooklm.google.com/notebook/abc?q=1#section");
    expect(normalizeNotebookUrl("https://example.org")).toBe("https://example.org/");
  });
  it.each([undefined, null, 12, "", "  ", "http://example.org", "javascript:alert(1)", "file:///tmp/note", "/relative", "https://", "https://user:pass@example.org", "https://user@example.org", `https://example.org/${"x".repeat(NOTEBOOK_URL_MAX)}`])("refuses an invalid address: %s", (value) => {
    expect(normalizeNotebookUrl(value)).toBeNull();
  });
  it("bounds the normalized address too (Unicode encoding can make it longer)", () => {
    expect(normalizeNotebookUrl(`https://example.org/${"가".repeat(300)}`)).toBeNull();
    const boundary = "https://example.org/" + "x".repeat(NOTEBOOK_URL_MAX - "https://example.org/".length);
    expect(normalizeNotebookUrl(boundary)).toBe(boundary);
  });
});
