import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { LibraryStore, newItemId } from "../src/geo/library/store.ts";
import { makeLibraryTools, makeNoteCitationExtension } from "../src/geo/library/tools.ts";
import { writeProjectLiterature } from "../src/geo/library/uses.ts";
import type { LibraryItem } from "../../web/src/geo/contracts/library.ts";

let root: string, store: LibraryStore, paths: ProjectPaths, projectId: string, paper: LibraryItem;
beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-digest-tools-"));
  store = new LibraryStore(path.join(root, "library"));
  const project = createProject({ name: "Digest tool test" });
  projectId = project.id; paths = resolvePaths(projectId);
  paper = await store.addGaidItem({ csl: { type: "article-journal", title: "Original paper", author: [{ family: "Hong" }], issued: { "date-parts": [[2026]] } }, metadataOrigin: "manual" });
});
afterEach(() => { deleteProject(projectId); fs.rmSync(root, { recursive: true, force: true }); });

async function digest(text = "# Digest\n## Question\nQuestion text\n## Results\nResult text\n", external = false) {
  return store.put({ ...paper, id: newItemId(), kind: "digest", citationKey: undefined, csl: { type: "document", title: "Prepared digest" },
    digest: { origin: external ? "external" : "gaid", status: "pending", covers: [paper.id], text, headings: ["Question", "Results"], createdAt: "2026-10-24T00:00:00Z", unmatched: [{ title: "Unknown original", doi: "10.1234/unmatched" }] } });
}
const tool = () => makeLibraryTools(paths, () => store).find((t) => t.name === "library_digest")!;
async function read(params: { key: string; section?: string; offset?: number }) {
  const result = await tool().execute("test", params, undefined as never, undefined as never, undefined as never);
  return { text: result.content[0].text as string, details: result.details as { offset: number; end: number; nextOffset?: number } };
}
const attach = () => writeProjectLiterature(paths, { itemIds: [paper.id], collectionIds: [] });

describe("library_digest", () => {
  it("refuses unknown items, non-digests and digests without an attached covered paper", async () => {
    const item = await digest();
    expect((await read({ key: `digest:${item.id}` })).text).toContain("covers no paper");
    expect((await read({ key: paper.id })).text).toContain("no literature digest");
    expect((await read({ key: "digest:li-000000000000" })).text).toContain("no literature digest");
    const other = await store.addGaidItem({ csl: { type: "book", title: "Other" }, metadataOrigin: "manual" });
    writeProjectLiterature(paths, { itemIds: [other.id], collectionIds: [] });
    expect((await read({ key: item.id })).text).toContain("covers no paper");
    attach();
    expect((await read({ key: item.id })).text).toContain("[@hong2026] Original paper");
  });

  it("labels external summaries as reference only, shows review state, unmatched sources and later folder papers", async () => {
    const folder = await store.addGaidCollection("Evidence");
    await store.mutate(paper.id, (p) => { p.collectionIds = [folder.id]; });
    const item = await digest(undefined, true);
    await store.mutate(item.id, (p) => { p.digest!.collectionId = folder.id; p.digest!.status = "confirmed"; });
    const extra = await store.addGaidItem({ csl: { type: "book", title: "Added paper" }, metadataOrigin: "manual" });
    await store.mutate(extra.id, (p) => { p.collectionIds = [folder.id]; });
    attach();
    const result = await read({ key: item.id });
    expect(result.text).toContain("외부 정리 (Gemini Notebook, reference only)");
    expect(result.text).toContain("확인함");
    expect(result.text).toContain("Unknown original");
    expect(result.text).toContain("1 paper(s) added/not covered");
    expect(result.text).toContain("Never cite the digest");
  });

  it("returns exact sections and full-text offsets, excluding headings inside fenced code", async () => {
    const text = "# Digest\n## Question\n```md\n## Fake\n```\nquestion\n## Results\nresults 😀\n## Limits\nlimits\n";
    const item = await digest(text); attach();
    const section = await read({ key: item.id, section: "## Results" });
    expect(section.details.offset).toBe(text.indexOf("## Results"));
    expect(section.text).toContain("results 😀");
    expect(section.text).not.toContain("limits\n");
    const offset = await read({ key: item.id, offset: text.indexOf("results") });
    expect(offset.text).toContain("results 😀\n## Limits");
    expect((await read({ key: item.id, section: "Fake" })).text).toContain("no level-2 section");
    expect((await read({ key: item.id, offset: -1 })).text).toContain("offset must be");
    expect((await read({ key: item.id, offset: text.length + 1 })).text).toContain("offset must be");
    expect((await read({ key: item.id, offset: text.indexOf("😀") + 1 })).text).toContain("splits a Unicode");
  });

  it("pages through Korean and emoji within 24 KiB with no gaps or replacement characters", async () => {
    const text = "## Results\n" + "한국어 😀 내용\n".repeat(7000);
    const item = await digest(text); attach();
    let offset = 0, joined = "", calls = 0;
    do {
      const result = await read({ key: item.id, offset });
      expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(24 * 1024);
      expect(result.text).not.toContain("�");
      const part = result.text.split(/--- text .*? ---\n/)[1].replace(/\n\[(?:More text:.*|End of selected text\.)\]$/, "");
      joined += part;
      expect(result.details.end).toBeGreaterThan(offset);
      offset = result.details.nextOffset ?? text.length;
      calls++;
    } while (offset < text.length && calls < 30);
    expect(joined).toBe(text);
    expect(calls).toBeGreaterThan(1);
  });

  it("bounds large provenance lists without losing the paging metadata", async () => {
    const item = await digest("😀".repeat(20000)); attach();
    await store.mutate(item.id, (p) => { p.digest!.unmatched = Array.from({ length: 100 }, () => ({ title: "가".repeat(5000) })); });
    const result = await read({ key: item.id, section: undefined });
    expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(24 * 1024);
    expect(result.text).toContain("entries omitted");
    expect(result.details.nextOffset).toBeGreaterThan(0);
  });
});

it("flags digest citations in research notes and tells the agent to replace them with original-page citations", async () => {
  const item = await digest(); attach();
  let handler: (event: unknown) => Promise<{ content: { text: string }[] } | undefined>;
  makeNoteCitationExtension(paths, () => store)({ on: (name: string, callback: never) => { if (name === "tool_result") handler = callback; } } as never);
  const relative = "연구노트/2026-10-24-test/index.md";
  const file = path.join(paths.sandbox, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `# Note\nClaim [@digest:${item.id}; @hong2026, p. 2; @unknown2024].`);
  const result = await handler!({ toolName: "write", input: { path: relative }, isError: false, content: [{ type: "text", text: "ok" }] });
  expect(result?.content[1].text).toContain("cites a literature digest");
  expect(result?.content[1].text).toContain("replace with [@paperKey, p. N]");
  expect(result?.content[1].text).toContain("@unknown2024 not in");
  expect(result?.content[1].text).not.toContain(`@digest:${item.id} not in`);
});
