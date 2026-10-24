/**
 * Several sources and new source kinds in hub authoring (gaid-authoring-sources): data files read through the geo
 * inspection dispatcher, file sets, research notes from projects and 서재, capacity limits, removal.
 */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { LibraryItem } from "../../web/src/geo/contracts/library.ts";
import { AUTHORING_SOURCE_LIMITS } from "../../web/src/geo/contracts/authoring.ts";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { addLibrarySources, libraryDeps } from "../src/geo/authoring/library-sources.ts";
import type { ChatFn } from "../src/geo/authoring/model.ts";
import { registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { addExternalDigest } from "../src/geo/library/digests.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { cleanup, config, pdf, PAPER, testVocabulary, work } from "./helpers/geo-authoring.ts";

const projects: string[] = [];
afterEach(async () => {
  for (const id of projects.splice(0)) deleteProject(id);
  await cleanup();
});

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64");

const CSV = "x,y,susceptibility_SI\n200100,450200,0.012\n200150,450200,0.034\n200200,450200,0.051\n";
const LAS = [
  "~Version",
  " VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0",
  " WRAP.   NO  : One line per depth step",
  "~Well",
  " STRT.M  100.0 : start",
  " STOP.M  101.0 : stop",
  " STEP.M  0.5 : step",
  " NULL.   -999.25 : null",
  "~Curve",
  " DEPT.M   : Depth",
  " MSUS.SI  : Magnetic susceptibility",
  "~A",
  "100.0 0.010",
  "100.5 0.020",
  "101.0 -999.25",
  "",
].join("\n");

/** A one-point shapefile set (.shp/.shx/.dbf/.prj) written byte by byte. */
function shapefile(): Record<string, Buffer> {
  const header = (words: number) => {
    const h = Buffer.alloc(100);
    h.writeInt32BE(9994, 0);
    h.writeInt32BE(words, 24);
    h.writeInt32LE(1000, 28);
    h.writeInt32LE(1, 32);
    [200100, 450200, 200100, 450200].forEach((v, i) => h.writeDoubleLE(v, 36 + i * 8));
    return h;
  };
  const rec = Buffer.alloc(28);
  rec.writeInt32BE(1, 0);
  rec.writeInt32BE(10, 4);
  rec.writeInt32LE(1, 8);
  rec.writeDoubleLE(200100, 12);
  rec.writeDoubleLE(450200, 20);
  const shx = Buffer.alloc(8);
  shx.writeInt32BE(50, 0);
  shx.writeInt32BE(10, 4);
  const dbf = Buffer.alloc(32 + 32 + 1 + 11 + 1);
  dbf[0] = 3;
  dbf.writeUInt32LE(1, 4);
  dbf.writeUInt16LE(65, 8);
  dbf.writeUInt16LE(11, 10);
  dbf.write("NAME", 32, "latin1");
  dbf.write("C", 43, "latin1");
  dbf[48] = 10;
  dbf[64] = 0x0d;
  dbf.write(" A         ", 65, "latin1");
  dbf[76] = 0x1a;
  return {
    "drill.shp": Buffer.concat([header(64), rec]),
    "drill.shx": Buffer.concat([header(54), shx]),
    "drill.dbf": dbf,
    "drill.prj": Buffer.from('GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'),
  };
}

async function authoring() {
  const store = new AuthoringStore(await work("authoring-sources-"));
  await store.initialize();
  const project = await store.create({ title: "새 방법" });
  return { store, projectId: project.id };
}

describe("data-file sources", () => {
  it("summarises CSV and LAS through the inspection dispatcher and shows the coauthor the summary", async () => {
    const { store, projectId } = await authoring();
    const csv = await addSource(store, projectId, { name: "susceptibility.csv", mediaType: "text/csv", contentBase64: b64(CSV) });
    expect(csv.source.kind).toBe("data");
    expect(csv.source.status).toBe("extracted");
    const entry = csv.extraction.files![0];
    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.data?.format).toBe("csv");
    expect(entry.data?.columns?.map((c) => c.name)).toEqual(["x", "y", "susceptibility_SI"]);
    const las = await addSource(store, projectId, { name: "DH-01.las", mediaType: "", contentBase64: b64(LAS) });
    expect(las.source.kind).toBe("data");
    expect(las.extraction.files![0].data?.curves?.map((c) => c.mnemonic)).toContain("MSUS");

    let prompt = "";
    const chat: ChatFn = async (messages) => {
      prompt = messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
      return {
        content: JSON.stringify({
          findings: [
            {
              kind: "data",
              statement: "대자율 열이 있습니다.",
              anchors: [{ source: "S1", path: "susceptibility.csv", quote: "Columns: x, y, susceptibility_SI" }],
            },
          ],
          scope: "자료",
          questions: [],
        }),
        finishReason: "stop",
        usage: { input: 1, output: 1 },
      };
    };
    const attempt = await runOperation(store, projectId, "analyze", "op-data-1", { chat, config, vocabulary: testVocabulary() });
    expect(prompt).toContain("Data files read through GAID's geo inspection");
    expect(prompt).toContain("=== S2 data DH-01.las ===");
    expect(prompt).toMatch(/Curves: .*MSUS/);
    // The raw LAS data section never enters the context.
    expect(prompt).not.toContain("100.5 0.020");
    expect(attempt.outcome).toBe("accepted");
    const p = await store.read(projectId);
    expect(p.findings[0].anchors[0]).toMatchObject({ path: "susceptibility.csv", verified: true });
  });

  it("keeps a shapefile set together and marks the companions", async () => {
    const { store, projectId } = await authoring();
    const files = Object.entries(shapefile()).map(([name, data]) => ({ name, contentBase64: b64(data) }));
    const { source, extraction } = await addSource(store, projectId, { name: "drill", mediaType: "", contentBase64: "", files });
    expect(source.kind).toBe("data");
    expect(extraction.files!.map((f) => f.path).sort()).toEqual(["drill.dbf", "drill.prj", "drill.shp", "drill.shx"]);
    const shp = extraction.files!.find((f) => f.path === "drill.shp")!;
    expect(shp.data?.format).toBe("shapefile");
    expect(shp.data?.companions).toEqual(expect.arrayContaining(["drill.dbf", "drill.shx", "drill.prj"]));
    expect(extraction.files!.filter((f) => f.companionOf === "drill.shp")).toHaveLength(3);
    // The set is identified by the sha256 of its sorted checksum list.
    const original = (await store.readFile(projectId, `sources/${source.id}/original`)).toString();
    expect(original.trim().split("\n")).toHaveLength(4);
  });

  it("reads a zip without code as data, and a zip with code as code", async () => {
    const { store, projectId } = await authoring();
    const data = new AdmZip();
    for (const [name, bytes] of Object.entries(shapefile())) data.addFile(`survey/${name}`, bytes);
    data.addFile("survey/README.md", Buffer.from("Drillholes of the survey."));
    const a = await addSource(store, projectId, { name: "survey.zip", mediaType: "application/zip", contentBase64: b64(data.toBuffer()) });
    expect(a.source.kind).toBe("data");
    expect(a.extraction.files!.find((f) => f.path === "drill.shp")?.data?.format).toBe("shapefile");
    const code = new AdmZip();
    code.addFile("repo/invert.py", Buffer.from("import numpy\n"));
    code.addFile("repo/data/obs.csv", Buffer.from(CSV));
    const b = await addSource(store, projectId, { name: "repo.zip", mediaType: "application/zip", contentBase64: b64(code.toBuffer()) });
    expect(b.source.kind).toBe("code");
    // Data files inside code are summarised too.
    expect(b.extraction.files!.find((f) => f.path === "data/obs.csv")?.data?.format).toBe("csv");
  });

  it("refuses sources beyond the project limit and removes a source with its files", async () => {
    const { store, projectId } = await authoring();
    for (let i = 0; i < AUTHORING_SOURCE_LIMITS.sources; i++)
      await addSource(store, projectId, { name: `n${i}.txt`, mediaType: "text/plain", contentBase64: b64(`note ${i} text`) });
    await expect(
      addSource(store, projectId, { name: "more.txt", mediaType: "text/plain", contentBase64: b64("more text") }),
    ).rejects.toMatchObject({ status: 409 });
    const server = Fastify();
    await registerAuthoringRoutes(server, { store });
    const first = (await store.read(projectId)).sources[0];
    const res = await server.inject({ method: "DELETE", url: `/geo/authoring/projects/${projectId}/sources/${first.id}` });
    expect(res.statusCode).toBe(204);
    const p = await store.read(projectId);
    expect(p.sources).toHaveLength(AUTHORING_SOURCE_LIMITS.sources - 1);
    expect(p.extractions[first.id]).toBeUndefined();
    expect(store.exists(projectId, `sources/${first.id}/original`)).toBe(false);
    await server.close();
  });
});

describe("research notes and library items as sources", () => {
  function noteProject() {
    const project = createProject({ name: "노트 시험" });
    projects.push(project.id);
    const paths = resolvePaths(project.id);
    const folder = path.join(paths.sandbox, "연구노트", "2026-10-23-magnetite");
    fs.mkdirSync(path.join(folder, "figures"), { recursive: true });
    fs.writeFileSync(
      path.join(folder, "index.md"),
      "---\ntitle: 자철석 역산 시험\ndate: 2026-10-23\nstatus: pending\n---\n# 자철석 역산 시험\n\n결과: 대자율 0.05 SI 이상 구간.\n\n![단면](figures/section.png)\n![밖](../../secret.png)\n",
    );
    fs.writeFileSync(path.join(folder, "figures", "section.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    fs.writeFileSync(path.join(paths.sandbox, "secret.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    return project.id;
  }

  it("adds a project research note with its figures and nothing outside the note folder", async () => {
    const { store, projectId } = await authoring();
    const gaidProject = noteProject();
    const server = Fastify();
    await registerAuthoringRoutes(server, { store });
    const res = await server.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/sources/notes`,
      payload: { notes: [{ projectId: gaidProject, noteId: "2026-10-23-magnetite" }] },
    });
    expect(res.statusCode).toBe(201);
    const [source] = res.json().sources;
    expect(source).toMatchObject({ kind: "note", title: "자철석 역산 시험", note: { projectId: gaidProject, noteId: "2026-10-23-magnetite" } });
    const p = await store.read(projectId);
    expect(p.extractions[source.id].files!.map((f) => f.path).sort()).toEqual(["figures/section.png", "index.md"]);
    const missing = await server.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/sources/notes`,
      payload: { notes: [{ projectId: gaidProject, noteId: "2026-01-01-none" }] },
    });
    expect(missing.statusCode).toBe(404);
    await server.close();
  });

  it("adds papers (PDF or metadata only) and research notes (project or library copy) from 서재", async () => {
    const { store, projectId } = await authoring();
    const gaidProject = noteProject();
    const library = new LibraryStore(await work("authoring-library-"));
    const stored = await library.storePdf(pdf(PAPER));
    const base = { owner: "me", source: "gaid", metadataOrigin: "manual", metadataConfirmed: true, collectionIds: [], tags: [], read: { coverage: "none" }, addedAt: "", updatedAt: "" };
    const items: Record<string, LibraryItem> = {
      paper: { ...base, id: "li-paper", citationKey: "kim2025", csl: { type: "article-journal", title: "Magnetite inversion", DOI: "10.1234/x" }, attachments: [{ id: "a1", kind: "pdf", stored: { sha256: stored.sha256, size: 1, mediaType: "application/pdf" } }] } as LibraryItem,
      bare: { ...base, id: "li-bare", citationKey: "lee2020", csl: { type: "article-journal", title: "Aeromagnetic survey", abstract: "We flew 200 m line spacing." }, attachments: [] } as LibraryItem,
      local: { ...base, id: "li-note-local", kind: "note", note: { projectId: gaidProject, noteId: "2026-10-23-magnetite", markdown: "# copy" }, csl: { type: "document", title: "자철석 역산 시험" }, attachments: [] } as unknown as LibraryItem,
      remote: { ...base, id: "li-note-remote", kind: "note", note: { projectId: "p-elsewhere", noteId: "2026-10-20-gravity", markdown: "# 중력 해석\n\n다른 PC의 노트입니다." }, csl: { type: "document", title: "중력 해석" }, attachments: [] } as unknown as LibraryItem,
    };
    const deps = { ...libraryDeps(library), get: async (id: string) => { const x = Object.values(items).find((i) => i.id === id); if (!x) throw new Error("no"); return x; } };
    const result = await addLibrarySources(store, projectId, ["li-paper", "li-bare", "li-note-local", "li-note-remote", "li-none"], deps);
    expect(result.added.map((a) => a.kind)).toEqual(["pdf", "text", "note", "note"]);
    expect(result.skipped).toEqual([{ itemId: "li-none", reason: expect.any(String) }]);
    const p = await store.read(projectId);
    const [paper, bare, local, remote] = p.sources;
    expect(paper).toMatchObject({ doi: "10.1234/x", library: { itemId: "li-paper", category: "paper", citationKey: "kim2025" } });
    expect(p.extractions[paper.id].pages).toBe(1);
    expect(bare.documentKind).toMatch(/metadata/);
    expect((await store.readFile(projectId, `sources/${bare.id}/files/lee2020.md`)).toString()).toContain("200 m line spacing");
    expect(local.note).toMatchObject({ projectId: gaidProject });
    expect(local.note?.snapshot).toBeUndefined();
    expect(remote.note).toMatchObject({ snapshot: true, noteId: "2026-10-20-gravity" });
  });

  it("adds a 문헌 정리 as reading material and, when asked, the papers it covers (gaid-library-prep)", async () => {
    const dir = await work("authoring-digest-");
    const library = new LibraryStore(path.join(dir, "library"));
    const project = createProject({ name: "문헌 정리 경로" });
    projects.push(project.id);
    const server = Fastify();
    server.addHook("onRequest", (_req, _reply, done) => withActiveProject(project.id, done));
    const authoring = new AuthoringStore(path.join(dir, "authoring"));
    await registerAuthoringRoutes(server, { store: authoring });
    await registerGeoLibraryRoutes(server, { store: () => library, paths: () => resolvePaths(project.id) });
    const stored = await library.storePdf(pdf(PAPER));
    const paper = (await server.inject({ method: "POST", url: "/geo/library/items", payload: { csl: { type: "article-journal", title: "Magnetite inversion" }, metadataOrigin: "manual", pdfSha256: stored.sha256 } })).json();
    const file = await library.storeFile(Buffer.from("briefing"), 1024);
    const digest = await addExternalDigest(library, { title: "Pocheon briefing", text: "# Briefing\n\n## Claims\n\nPGI narrows the boundary.", external: { service: "gemini-notebook", fileName: "b.md", mediaType: "text/markdown", file }, covers: [paper.id] });
    const res = await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [digest.id], withDigestPapers: true } });
    expect(res.statusCode).toBe(201);
    expect(res.json().added.map((a: { itemId: string }) => a.itemId)).toEqual([digest.id, paper.id]);
    const p = await authoring.read(res.json().authoringId);
    const [d, pdfSource] = p.sources;
    expect(d).toMatchObject({ kind: "text", library: { itemId: digest.id, category: "digest" }, documentKind: expect.stringMatching(/external summary, reference only/) });
    expect((await authoring.readFile(p.id, `sources/${d.id}/files/Pocheon briefing.md`)).toString()).toMatch(/never to this digest[\s\S]*PGI narrows/);
    expect(pdfSource).toMatchObject({ kind: "pdf", library: { itemId: paper.id, category: "paper" } });
    const without = await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [digest.id] } });
    expect(without.json().added.map((a: { itemId: string }) => a.itemId)).toEqual([digest.id]);
  });

  it("starts a new authoring project from several library items and records the uses", async () => {
    const dir = await work("authoring-libroute-");
    const library = new LibraryStore(path.join(dir, "library"));
    const project = createProject({ name: "서재 경로" });
    projects.push(project.id);
    const server = Fastify();
    server.addHook("onRequest", (_req, _reply, done) => withActiveProject(project.id, done));
    await registerAuthoringRoutes(server, { store: new AuthoringStore(path.join(dir, "authoring")) });
    await registerGeoLibraryRoutes(server, { store: () => library, paths: () => resolvePaths(project.id) });
    const stored = await library.storePdf(pdf(PAPER));
    const add = (payload: object) => server.inject({ method: "POST", url: "/geo/library/items", payload });
    const a = (await add({ csl: { type: "article-journal", title: "Magnetite inversion" }, metadataOrigin: "manual", pdfSha256: stored.sha256 })).json();
    const b = (await add({ csl: { type: "article-journal", title: "Aeromagnetic survey" }, metadataOrigin: "manual" })).json();
    const res = await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [a.id, b.id] } });
    expect(res.statusCode).toBe(201);
    expect(res.json().added).toHaveLength(2);
    const authoringId = res.json().authoringId;
    const more = await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [b.id], authoringId } });
    expect(more.statusCode).toBe(200);
    const detail = (await server.inject({ method: "GET", url: `/geo/library/items/${b.id}` })).json();
    expect(detail.uses).toContainEqual(expect.objectContaining({ kind: "workflow", authoringId }));
    expect((await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [] } })).statusCode).toBe(400);
    expect(
      (await server.inject({ method: "POST", url: "/geo/library/authoring", payload: { itemIds: [a.id], authoringId: "missing-id" } })).statusCode,
    ).toBe(404);
    await server.close();
  });
});
