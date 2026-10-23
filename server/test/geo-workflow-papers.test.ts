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
import { LibraryStore } from "../src/geo/library/store.ts";
import { makeLibraryTools } from "../src/geo/library/tools.ts";
import { resolveWorkflowPapers, workflowPaperSources } from "../src/geo/library/workflow-papers.ts";
import type { MethodSourceRef } from "../../web/src/geo/contracts/methods.ts";

const csl = (title: string, family: string, year: number, doi?: string) => ({ type: "article-journal", title, author: [{ family, given: "A" }], issued: { "date-parts": [[year]] }, ...(doi ? { DOI: doi } : {}) });

// What a hub package records (server/src/geo/authoring/package.ts): a DOI per paper, else the file name and title.
const SOURCES: MethodSourceRef[] = [
  { kind: "doi", ref: "10.1190/geo2024-0001.1", title: "PGI ore body from airborne magnetics", documentKind: "paper", sha256: "a".repeat(64) },
  { kind: "file", ref: "astic2020.pdf", title: "Petrophysically and geologically guided inversion", documentKind: "paper", sha256: "b".repeat(64) },
  { kind: "doi", ref: "10.5555/not-in-library", title: "A paper the installer does not have", documentKind: "paper" },
  { kind: "file", ref: "inversion.py", title: "inversion.py", documentKind: "code" },
  { kind: "file", ref: "2026-10-23-pgi.md", title: "PGI 정리 노트", documentKind: "research-note" },
];

let dir: string, store: LibraryStore, paths: ProjectPaths, projectId: string;

function installMethod(sources: MethodSourceRef[] = SOURCES) {
  const skill = path.join(paths.skillsDir, "pocheon-pgi");
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, "SKILL.md"), "---\nname: pocheon-pgi\ndescription: Use when estimating an ore body with PGI.\n---\n\n# PGI\n");
  fs.writeFileSync(path.join(skill, "gaid-method.json"), JSON.stringify({
    schemaVersion: "gaid-method/v1", methodId: "kim/pocheon-pgi", revision: 2, lifecycle: "draft", implementation: "implemented",
    title: { ko: "항공자력·시추 코어 PGI 광체 추정" }, sources, workflows: [],
  }));
}

async function app() {
  const server = Fastify();
  server.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? projectId), done));
  await registerAuthoringRoutes(server, { store: new AuthoringStore(path.join(dir, "authoring")) });
  await registerGeoLibraryRoutes(server, { store: () => store, paths: () => paths });
  return server;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-workflow-papers-"));
  store = new LibraryStore(path.join(dir, "library"));
  const project = createProject({ name: "포천 PGI" });
  projectId = project.id;
  paths = resolvePaths(project.id);
});
afterEach(() => {
  deleteProject(projectId);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Workflow source papers", () => {
  it("picks papers from a package's sources and matches them by DOI, else by exact title", async () => {
    expect(workflowPaperSources(SOURCES).map((s) => s.ref)).toEqual(["10.1190/geo2024-0001.1", "astic2020.pdf", "10.5555/not-in-library"]);
    const heo = await store.addGaidItem({ csl: csl("PGI ore body from airborne magnetics (2025)", "Heo", 2025, "https://doi.org/10.1190/GEO2024-0001.1"), metadataOrigin: "crossref" });
    const astic = await store.addGaidItem({ csl: csl("Petrophysically and Geologically Guided Inversion.", "Astic", 2020), metadataOrigin: "manual" });
    // Same title, another DOI: a different paper.
    await store.addGaidItem({ csl: csl("A paper the installer does not have", "Other", 2019, "10.9999/other"), metadataOrigin: "manual" });
    const papers = resolveWorkflowPapers(SOURCES, await store.all(), { schema: "gaid-project-literature/v1", collectionIds: [], itemIds: [] });
    expect(papers).toEqual([
      expect.objectContaining({ doi: "10.1190/geo2024-0001.1", state: "in-library", itemId: heo.id, citationKey: "heo2025", matchedBy: "doi" }),
      expect.objectContaining({ ref: "astic2020.pdf", state: "in-library", itemId: astic.id, matchedBy: "title" }),
      expect.objectContaining({ doi: "10.5555/not-in-library", state: "not-in-library" }),
    ]);
    expect(papers[2].itemId).toBeUndefined();
  });

  it("attaches only on request, only the Workflow's own papers, and closes the cycle in library uses", async () => {
    const heo = await store.addGaidItem({ csl: csl("PGI ore body from airborne magnetics", "Heo", 2025, "10.1190/geo2024-0001.1"), metadataOrigin: "crossref" });
    const astic = await store.addGaidItem({ csl: csl("Petrophysically and geologically guided inversion", "Astic", 2020), metadataOrigin: "manual" });
    const other = await store.addGaidItem({ csl: csl("Unrelated", "Park", 2021), metadataOrigin: "manual" });
    installMethod();
    const server = await app();

    expect((await server.inject({ method: "GET", url: "/geo/library/workflow-papers?method=missing-method" })).statusCode).toBe(404);
    const before = (await server.inject({ method: "GET", url: "/geo/library/workflow-papers?method=pocheon-pgi" })).json();
    expect(before.papers.map((p: { state: string }) => p.state)).toEqual(["in-library", "in-library", "not-in-library"]);
    // Looking does not attach anything.
    expect((await server.inject({ method: "GET", url: "/geo/library/project" })).json()).toMatchObject({ itemIds: [] });
    // The installed Workflow already shows as a use of its papers in 서재.
    const heoBefore = (await server.inject({ method: "GET", url: `/geo/library/items/${heo.id}` })).json();
    expect(heoBefore.uses).toContainEqual({ kind: "workflow", title: "항공자력·시추 코어 PGI 광체 추정", projectId, projectName: "포천 PGI" });

    const attached = await server.inject({ method: "POST", url: "/geo/library/workflow-papers/attach", payload: { method: "pocheon-pgi", itemIds: [heo.id, astic.id, other.id] } });
    expect(attached.statusCode).toBe(200);
    expect(attached.json().added).toEqual([heo.id, astic.id]);
    expect(attached.json().papers.map((p: { state: string }) => p.state)).toEqual(["attached", "attached", "not-in-library"]);
    expect((await server.inject({ method: "GET", url: "/geo/library/project" })).json().itemIds).toEqual([heo.id, astic.id]);

    // The agent now finds the papers, and a note citing one shows in the paper's uses.
    const [search] = makeLibraryTools(paths, () => store);
    expect((await search.execute("t1", { query: "airborne magnetics" }, undefined as never, undefined as never, undefined as never)).content[0].text).not.toContain("No papers are attached");
    const note = path.join(paths.sandbox, "연구노트", "2026-10-23-pgi", "index.md");
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, "---\ntitle: PGI 광체 추정\n---\n# PGI 광체 추정\n\n물성 경계는 선행연구를 따랐습니다 [@heo2025].\n");
    const heoAfter = (await server.inject({ method: "GET", url: `/geo/library/items/${heo.id}` })).json();
    expect(heoAfter.uses).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "note", noteId: "2026-10-23-pgi", title: "PGI 광체 추정" }),
      expect.objectContaining({ kind: "project", projectId }),
      expect.objectContaining({ kind: "workflow", projectId }),
    ]));
    // Unrelated papers stay out of the scope; a repeated request adds nothing.
    const again = (await server.inject({ method: "POST", url: "/geo/library/workflow-papers/attach", payload: { method: "pocheon-pgi", itemIds: [other.id] } })).json();
    expect(again.added).toEqual([]);
    await server.close();
  });

  it("shows nothing for a Workflow without recorded papers", async () => {
    installMethod([]);
    const server = await app();
    expect((await server.inject({ method: "GET", url: "/geo/library/workflow-papers?method=pocheon-pgi" })).json()).toEqual({ method: "pocheon-pgi", papers: [] });
    await server.close();
  });
});
