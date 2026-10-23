import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { LibraryStore, defaultCitationKey } from "../src/geo/library/store.ts";
import { makeLibraryTools, makeNoteCitationExtension, parsePages } from "../src/geo/library/tools.ts";

/** A minimal text PDF (Helvetica) with one text line per page; enough for pdftotext. */
function makePdf(pages: string[]): Buffer {
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((text, i) => {
    const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const csl = (title: string, family: string, year: number, doi?: string) => ({ type: "article-journal", title, author: [{ family, given: "A" }, { family: "Lee" }, { family: "Park" }], issued: { "date-parts": [[year]] }, "container-title": "Natural Resources Research", ...(doi ? { DOI: doi } : {}) });

let dir: string, store: LibraryStore, paths: ProjectPaths, projectId: string;
const filler = "Mineral prospectivity sparse labels spatial block cross validation nickel occurrences grid cells";

async function app() {
  const server = Fastify();
  server.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? projectId), done));
  await registerAuthoringRoutes(server, { store: new AuthoringStore(path.join(dir, "authoring")) });
  await registerGeoLibraryRoutes(server, { store: () => store, paths: () => paths });
  return server;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-library-"));
  store = new LibraryStore(path.join(dir, "library"));
  const project = createProject({ name: "서재 시험" });
  projectId = project.id;
  paths = resolvePaths(project.id);
});
afterEach(() => {
  deleteProject(projectId);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("library store", () => {
  it("makes unique citation keys from the first author and year", () => {
    const taken = new Set(["hong2026"]);
    expect(defaultCitationKey(csl("x", "Hong", 2026), taken)).toBe("hong2026a");
    expect(defaultCitationKey({ type: "book", title: "x" }, new Set())).toBe("refnd");
  });

  it("adds a confirmed GAID item, refuses a duplicate DOI and keeps Zotero items read-only", async () => {
    const item = await store.addGaidItem({ csl: csl("PU learning", "Hong", 2026, "https://doi.org/10.1234/ABC.5."), metadataOrigin: "crossref" });
    expect(item).toMatchObject({ source: "gaid", citationKey: "hong2026", metadataConfirmed: true, csl: { DOI: "10.1234/abc.5" } });
    await expect(store.addGaidItem({ csl: csl("Again", "Kim", 2025, "10.1234/abc.5"), metadataOrigin: "manual" })).rejects.toMatchObject({ status: 409 });
    await store.put({ ...item, id: "li-zzzzzzzzzzzz", source: "zotero", citationKey: "z2020" });
    await expect(store.editGaidItem("li-zzzzzzzzzzzz", { tags: ["a"] })).rejects.toMatchObject({ status: 409 });
    await expect(store.removeGaidItem("li-zzzzzzzzzzzz")).rejects.toMatchObject({ status: 409 });
  });
});

describe("library routes, reading and uses", () => {
  it("uploads a PDF, reads its pages, lists it, attaches it, resolves note citations and counts uses", async () => {
    const server = await app();
    const pdf = makePdf([`Page one ${filler}`, "", `Page three nickel ${filler}`]);
    const up = await server.inject({ method: "POST", url: "/geo/library/files", payload: { contentBase64: pdf.toString("base64") } });
    expect(up.statusCode).toBe(201);
    const created = await server.inject({ method: "POST", url: "/geo/library/items", payload: { csl: csl("Spatial PU learning", "Hong", 2026, "10.1234/x"), metadataOrigin: "crossref", pdfSha256: up.json().sha256 } });
    expect(created.statusCode).toBe(201);
    const item = created.json();
    expect(item.read).toMatchObject({ coverage: "partial", pagesTotal: 3, pagesRead: 2, unreadablePages: [2] });

    expect((await server.inject({ method: "PUT", url: "/geo/library/project", payload: { itemIds: [item.id, "li-000000000000"] } })).json()).toMatchObject({ itemIds: [item.id] });
    const notes = path.join(paths.sandbox, "연구노트", "2026-10-21-test");
    fs.mkdirSync(notes, { recursive: true });
    fs.writeFileSync(path.join(notes, "index.md"), "---\ntitle: 니켈 후보지\n---\n# 니켈 후보지\n\n결과는 선행연구와 같습니다 [@hong2026, p. 3; @missing2020].\n");

    const list = (await server.inject({ method: "GET", url: "/geo/library?q=spatial" })).json();
    expect(list).toMatchObject({ total: 1, counts: { all: 1, gaid: 1, cited: 1 } });
    expect(list.items[0]).toMatchObject({ authors: "Hong 외", year: 2026, coverage: "partial", hasPdf: true, storedPdf: true, used: { notes: 1, projects: 1 } });
    const detail = (await server.inject({ method: "GET", url: `/geo/library/items/${item.id}` })).json();
    expect(detail.uses).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "note", noteId: "2026-10-21-test", title: "니켈 후보지", locators: ["p. 3"] }),
      expect.objectContaining({ kind: "project", projectId }),
    ]));
    const cites = (await server.inject({ method: "GET", url: "/geo/library/citations?keys=hong2026,missing2020" })).json();
    expect(cites[0]).toMatchObject({ key: "hong2026", itemId: item.id });
    expect(cites[0].reference).toContain("https://doi.org/10.1234/x");
    expect(cites[1]).toEqual({ key: "missing2020" });

    const pdfRes = await server.inject({ method: "GET", url: `/geo/library/items/${item.id}/pdf` });
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");

    const wf = await server.inject({ method: "POST", url: `/geo/library/items/${item.id}/authoring` });
    expect(wf.statusCode).toBe(201);
    const after = (await server.inject({ method: "GET", url: `/geo/library/items/${item.id}` })).json();
    expect(after.uses).toContainEqual(expect.objectContaining({ kind: "workflow", authoringId: wf.json().authoringId, title: "Spatial PU learning" }));
    await server.close();
  });

  it("gives the agent attached papers only, page text with coverage, and flags unknown note citations", async () => {
    const pdf = await store.storePdf(makePdf([`Intro ${filler}`, `Results nickel targets ${filler}`]));
    const server = await app();
    const item = (await server.inject({ method: "POST", url: "/geo/library/items", payload: { csl: csl("Nickel targeting", "Kim", 2025), metadataOrigin: "manual", pdfSha256: pdf.sha256 } })).json();
    const [search, read] = makeLibraryTools(paths, () => store);
    expect((await search.execute("t1", { query: "nickel" }, undefined as never, undefined as never, undefined as never)).content[0].text).toContain("No papers are attached");
    await server.inject({ method: "PUT", url: "/geo/library/project", payload: { itemIds: [item.id] } });
    const found = (await search.execute("t2", { query: "nickel targets" }, undefined as never, undefined as never, undefined as never)).content[0].text;
    expect(found).toContain("[@kim2025]");
    expect(found).toContain("p. 2:");
    const page = (await read.execute("t3", { key: "@kim2025", pages: "2-9" }, undefined as never, undefined as never, undefined as never)).content[0].text;
    expect(page).toContain("read: full text, 2 pages");
    expect(page).toContain("--- p. 2 ---");
    expect(parsePages("1,3-4,9", 5)).toEqual([1, 3, 4]);

    let handler: ((e: unknown) => Promise<unknown>) | undefined;
    makeNoteCitationExtension(paths, () => store)({ on: (name: string, h: never) => { if (name === "tool_result") handler = h; } } as never);
    const note = path.join(paths.sandbox, "연구노트", "2026-10-21-a", "index.md");
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, "# a\n[@kim2025, p. 2] [@ghost2019]\n");
    const result = (await handler!({ toolName: "write", input: { path: "연구노트/2026-10-21-a/index.md" }, isError: false, content: [{ type: "text", text: "ok" }] })) as { content: { text: string }[] };
    expect(result.content[1].text).toContain("@ghost2019 not in the researcher's library");
    expect(await handler!({ toolName: "write", input: { path: "notes.md" }, isError: false, content: [] })).toBeUndefined();
    await server.close();
  });

  it("previews and confirms a BibTeX import, skips duplicates and exports with library keys", async () => {
    const server = await app();
    const bib = "@article{a1, title={Grid PU}, author={Hong, Gil}, year={2024}, journal={NRR}, doi={10.5555/grid}}\n@article{b2, title={Second}, author={Kim, S}, year={2023}}\n@article{broken, title={x}";
    const preview = (await server.inject({ method: "POST", url: "/geo/library/import", payload: { text: bib, format: "bibtex" } })).json();
    expect(preview.items).toHaveLength(2);
    expect(preview.errors.length).toBeGreaterThan(0);
    const first = (await server.inject({ method: "POST", url: "/geo/library/import/confirm", payload: { items: preview.items } })).json();
    expect(first).toEqual({ added: 2, duplicates: 0, failed: 0 });
    expect((await server.inject({ method: "POST", url: "/geo/library/import/confirm", payload: { items: preview.items.slice(0, 1) } })).json()).toMatchObject({ duplicates: 1 });
    const exported = await server.inject({ method: "GET", url: "/geo/library/export?format=bibtex" });
    expect(exported.headers["content-disposition"]).toContain("gaid-library.bib");
    expect(exported.body).toContain("@article{hong2024");
    const imported = (await store.all()).find((i) => i.citationKey === "hong2024");
    expect(imported).toMatchObject({ metadataOrigin: "import", source: "gaid" });
    await server.close();
  });
});
