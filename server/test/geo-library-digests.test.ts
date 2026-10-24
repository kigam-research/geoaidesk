import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { addExternalDigest, digestFolderId, digestOutline, makeDigestExtension, mirrorDigestFile, readDigestRequests } from "../src/geo/library/digests.ts";
import { readProjectLiterature } from "../src/geo/library/uses.ts";
import type { DigestCandidatesResponse, LibraryItem, LibraryListResponse, MakeDigestResponse } from "../../web/src/geo/contracts/library.ts";

let dir: string, store: LibraryStore, paths: ProjectPaths, projectId: string;

async function app() {
  const server = Fastify();
  server.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? projectId), done));
  await registerGeoLibraryRoutes(server, { store: () => store, paths: () => paths });
  return server;
}
const paper = (family: string, year: number, doi: string) => ({ type: "article-journal", title: `${family} magnetite inversion`, author: [{ family, given: "A" }], issued: { "date-parts": [[year]] }, DOI: doi });
const digestMarkdown = (title: string) => `# ${title}\n\n## 연구 질문\n\n역산 제약\n\n## 방법 비교\n\n표 [@heo2025, p. 6]\n\n## 인용 목록\n\n- [@heo2025]\n`;
function writeDigest(relative: string, text: string) {
  const file = path.join(paths.sandbox, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-library-digests-"));
  store = new LibraryStore(path.join(dir, "library"));
  const project = createProject({ name: "포천 자철석" });
  projectId = project.id;
  paths = resolvePaths(project.id);
});
afterEach(() => {
  deleteProject(projectId);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("literature digests (문헌 정리)", () => {
  it("makes a digest request, mirrors the written file into 서재 and keeps it out of references", async () => {
    const server = await app();
    const folder = await store.addGaidCollection("포천 자철석 PGI");
    const a = await store.addGaidItem({ csl: paper("Heo", 2025, "10.1/a"), metadataOrigin: "crossref", collectionIds: [folder.id] });
    const b = await store.addGaidItem({ csl: paper("Astic", 2020, "10.1/b"), metadataOrigin: "crossref", collectionIds: [folder.id] });

    const res = await server.inject({ method: "POST", url: "/geo/library/digests/requests", payload: { projectId, workflow: "compare-papers", question: "PGI가 무엇을 더하는가", collectionId: folder.id } });
    expect(res.statusCode).toBe(200);
    const made = res.json() as MakeDigestResponse;
    expect(made.covers.sort()).toEqual([a.id, b.id].sort());
    expect(made.path).toMatch(/^문헌정리\/\d{4}-\d{2}-\d{2}-포천-자철석-PGI-문헌-정리\/index\.md$/);
    expect(made.message).toContain(`[@${a.citationKey}]`);
    expect(made.message).toContain(made.path);
    expect(made.message).toContain("Compare Papers");
    expect(made.message).not.toMatch(/Save the comparison/);
    // The agent's library tools only see attached papers.
    expect(readProjectLiterature(paths).itemIds.sort()).toEqual([a.id, b.id].sort());

    // A file nobody asked for is not mirrored.
    writeDigest("문헌정리/2026-10-24-other/index.md", digestMarkdown("다른 정리"));
    expect(await mirrorDigestFile(store, paths, projectId, "2026-10-24-other")).toBeUndefined();

    writeDigest(made.path, digestMarkdown("포천 자철석 PGI 문헌 정리"));
    const digestId = made.path.split("/")[1];
    const item = (await mirrorDigestFile(store, paths, projectId, digestId))!;
    expect(item).toMatchObject({ kind: "digest", source: "gaid", collectionIds: [folder.id], csl: { title: "포천 자철석 PGI 문헌 정리" } });
    expect(item.citationKey).toBeUndefined();
    expect(item.digest).toMatchObject({ origin: "gaid", status: "pending", headings: ["연구 질문", "방법 비교", "인용 목록"], made: { workflow: "compare-papers", projectId, digestId } });
    expect(readDigestRequests(paths)[0].itemId).toBe(item.id);
    // A second write refreshes the same item.
    writeDigest(made.path, digestMarkdown("고친 정리"));
    expect((await mirrorDigestFile(store, paths, projectId, digestId))!.id).toBe(item.id);

    // A paper added to the folder later makes the digest stale.
    await store.addGaidItem({ csl: paper("Park", 2022, "10.1/c"), metadataOrigin: "crossref", collectionIds: [folder.id] });
    const list = (await server.inject({ url: "/geo/library?kind=digest" })).json() as LibraryListResponse;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ kind: "digest", title: "고친 정리", digest: { origin: "gaid", status: "pending", covers: 2, newPapers: 1, local: true, workflow: "compare-papers" } });
    expect(list.counts).toMatchObject({ all: 3, digests: 1 });
    const papers = (await server.inject({ url: "/geo/library?kind=paper" })).json() as LibraryListResponse;
    expect(papers.items.every((i) => i.kind === "paper")).toBe(true);
    const covering = (await server.inject({ url: `/geo/library?kind=digest&covers=${a.id}` })).json() as LibraryListResponse;
    expect(covering.items.map((i) => i.id)).toEqual([item.id]);

    // Never a reference: not exported.
    const bib = await server.inject({ url: "/geo/library/export?format=csl-json" });
    expect(JSON.parse(bib.body).map((r: { title: string }) => r.title)).not.toContain("고친 정리");

    const status = await server.inject({ method: "POST", url: `/geo/library/digests/${item.id}/status`, payload: { status: "confirmed" } });
    expect(status.json().item.digest).toMatchObject({ status: "confirmed" });
    expect((await server.inject({ method: "POST", url: `/geo/library/digests/${a.id}/status`, payload: { status: "confirmed" } })).statusCode).toBe(404);

    const candidates = (await server.inject({ url: "/geo/library/digests/for-start" })).json() as DigestCandidatesResponse;
    expect(candidates.digests).toEqual([expect.objectContaining({ itemId: item.id, covered: 2, total: 2, recommended: true, status: "confirmed" })]);

    // A deleted file is marked missing and keeps its text.
    fs.rmSync(path.join(paths.sandbox, made.path));
    const after = (await server.inject({ url: `/geo/library/items/${item.id}` })).json().item as LibraryItem;
    expect(after.digest!.made!.missingAt).toBeTruthy();
    expect(after.digest!.text).toContain("고친 정리");
  });

  it("refuses requests without papers or with an unknown workflow", async () => {
    const server = await app();
    const empty = await server.inject({ method: "POST", url: "/geo/library/digests/requests", payload: { projectId, workflow: "compare-papers", question: "q", itemIds: [] } });
    expect(empty.statusCode).toBe(400);
    const p = await store.addGaidItem({ csl: paper("Heo", 2025, "10.1/a"), metadataOrigin: "crossref" });
    const wf = await server.inject({ method: "POST", url: "/geo/library/digests/requests", payload: { projectId, workflow: "web-search", question: "q", itemIds: [p.id] } });
    expect(wf.statusCode).toBe(400);
    const project = await server.inject({ method: "POST", url: "/geo/library/digests/requests", payload: { projectId: "nope", workflow: "compare-papers", question: "q", itemIds: [p.id] } });
    expect(project.statusCode).toBe(404);
  });

  it("offers external summaries for reference only, never recommended", async () => {
    const server = await app();
    const a = await store.addGaidItem({ csl: paper("Heo", 2025, "10.1/a"), metadataOrigin: "crossref" });
    await server.inject({ method: "PUT", url: "/geo/library/project", payload: { itemIds: [a.id] } });
    const file = await store.storeFile(Buffer.from("briefing"), 1024);
    const item = await addExternalDigest(store, { title: "Pocheon briefing", text: "# Briefing\n\n## Sources\n\nHeo 2025", external: { service: "gemini-notebook", fileName: "b.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", file }, covers: [a.id, "li-unknown00000"], unmatched: [{ title: "Field guide" }] });
    expect(item.digest).toMatchObject({ origin: "external", status: "pending", covers: [a.id], unmatched: [{ title: "Field guide" }], headings: ["Sources"] });
    const candidates = (await server.inject({ url: "/geo/library/digests/for-start" })).json() as DigestCandidatesResponse;
    expect(candidates.digests).toEqual([expect.objectContaining({ itemId: item.id, origin: "external", recommended: false, covered: 1, total: 1 })]);
  });

  it("mirrors through the lead write hook and reports format problems", async () => {
    const p = await store.addGaidItem({ csl: paper("Heo", 2025, "10.1/a"), metadataOrigin: "crossref" });
    const server = await app();
    const made = (await server.inject({ method: "POST", url: "/geo/library/digests/requests", payload: { projectId, workflow: "summarize-paper", question: "q", itemIds: [p.id], title: "요약" } })).json() as MakeDigestResponse;
    writeDigest(made.path, "no headings at all");
    let handler: ((event: unknown) => Promise<unknown>) | undefined;
    makeDigestExtension(paths, projectId, () => store)({ on: (_name: string, fn: (event: unknown) => Promise<unknown>) => { handler = fn; } } as never);
    const result = await handler!({ toolName: "write", isError: false, input: { path: made.path }, content: [{ type: "text", text: "ok" }] }) as { content: { text: string }[] };
    expect(result.content[1].text).toMatch(/Literature digest format check/);
    const list = (await server.inject({ url: "/geo/library?kind=digest" })).json() as LibraryListResponse;
    expect(list.items).toHaveLength(1);
    expect(await handler!({ toolName: "write", isError: false, input: { path: "notes.md" }, content: [] })).toBeUndefined();
  });

  it("names folders and outlines text", () => {
    expect(digestFolderId("포천 자철석: PGI / 문헌", "2026-10-24")).toBe("2026-10-24-포천-자철석-PGI-문헌");
    expect(digestOutline("# T\n\n```\n## not\n```\n## A\n## B ##\n")).toEqual({ title: "T", headings: ["A", "B"] });
  });
});
