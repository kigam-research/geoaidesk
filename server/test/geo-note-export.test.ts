import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import AdmZip from "adm-zip";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { geoStateDir } from "../src/geo/context.ts";
import { recordResearchNoteSession } from "../src/geo/notes/store.ts";
import { buildNoteBundle, buildPublicExport, previewNoteBundle, previewPublicExport } from "../src/geo/notes/export.ts";
import { registerGeoNoteRoutes } from "../src/geo/routes/notes.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { environmentId } from "../src/provenance/environment.ts";
import { packageStore, writePackageOrigin } from "../src/geo/methods/package-origin.ts";

const id = "2026-10-24-분석";
const sid = "sess-1";
const sha = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");
let paths: ProjectPaths, dir: string, library: LibraryStore;
const options = () => ({ library: () => library });

function write(name: string, content: string | Buffer = "x") {
  const file = path.join(paths.sandbox, name);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file;
}
const note = (body = "근거는 [@kim2024, p. 3]와 [@missing2020]입니다.") => [
  "---", "title: 분석 결과", "date: 2026-10-24", "status: pending", "headline: 두 표가 일치합니다.", "---", "# 분석 결과", "",
  "## 한눈에", "![그림](figures/지도.png)", "## 결과", body, "## 한 일", "없음", "## 한계", "없음", "## 결정할 일", "없음", "## 근거", "없음", "",
].join("\n");

function step(stepId: string, inputs: object[], outputs: object[], environment?: string, timestamp = 1_790_000_000_000) {
  return JSON.stringify({ schemaVersion: 1, id: stepId, sessionId: sid, timestamp, toolName: "bash", role: "agent", inputs, outputs, ...(environment ? { environmentId: environment } : {}) });
}
const ref = (p: string, data: string, change: string) => ({ path: p, sha256: sha(data), size: Buffer.byteLength(data), mtimeMs: 1, change, confidence: "observed" });

async function setup() {
  write(`연구노트/${id}/index.md`, note());
  write(`연구노트/${id}/figures/지도.png`, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  write("user_data/wells.csv", "a,b\n1,2\n");
  write("results/table.csv", "x\n1\n");
  write("user_data/old.csv", "changed now\n");
  recordResearchNoteSession(paths, id, sid);
  const body = { schemaVersion: 1 as const, os: { platform: "linux", release: "6", arch: "x64" }, lockfiles: [] };
  const envId = environmentId(body);
  fs.mkdirSync(paths.environmentsDir, { recursive: true });
  fs.writeFileSync(path.join(paths.environmentsDir, `${envId}.json`), JSON.stringify({ ...body, id: envId, capturedAt: 1 }));
  const rows = [
    step("s1", [ref("user_data/wells.csv", "a,b\n1,2\n", "read"), ref("user_data/old.csv", "original\n", "read")], [ref("results/table.csv", "x\n1\n", "created")], envId),
    step("s2", [], [ref(`연구노트/${id}/figures/지도.png`, "png", "created"), ref(".kady/x.json", "{}", "created")], envId),
  ];
  fs.mkdirSync(path.join(paths.provenanceDir, sid), { recursive: true });
  fs.writeFileSync(path.join(paths.provenanceDir, sid, "steps.jsonl"), rows.join("\n") + "\n");
  const pdf = await library.storePdf(Buffer.from("%PDF-1.4 test"));
  const item = await library.addGaidItem({ csl: { type: "article-journal", title: "Gravity survey", author: [{ family: "Kim", given: "A" }], issued: { "date-parts": [[2024]] }, license: "CC BY 4.0" }, metadataOrigin: "manual", pdfSha256: pdf.sha256 });
  await library.mutate(item.id, (i) => { i.citationKey = "kim2024"; });
  return { envId, item };
}

beforeEach(() => {
  paths = resolvePaths("note-export-test");
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.mkdirSync(paths.sandbox, { recursive: true });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "note-export-"));
  library = new LibraryStore(path.join(dir, "library"));
});
afterEach(() => {
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("research-note result bundle", () => {
  it("previews the note folder, data fingerprints, environment, references and gaps, then builds the same files", async () => {
    const { envId } = await setup();
    const preview = await previewNoteBundle(paths, id, "ko", options());
    expect(preview.files.map((f) => f.name)).toEqual(expect.arrayContaining([
      "note/index.md", "note/figures/지도.png", "data-fingerprints.json", `environment/${envId}.json`, "references.md", "references.json", "README.md", "manifest.json", "SHA256SUMS",
    ]));
    // The note's own figure and dot-directory files are not listed as data.
    expect(preview.data.map((d) => [d.path, d.use, d.now])).toEqual([
      ["results/table.csv", "written", "same"], ["user_data/old.csv", "read", "changed"], ["user_data/wells.csv", "read", "same"],
    ]);
    expect(preview.environments).toBe(1);
    expect(preview.references).toEqual([{ key: "kim2024", reference: expect.stringContaining("Gravity survey") }, { key: "missing2020", reference: null }]);
    expect(preview.gaps).toEqual(expect.arrayContaining(["no-workflow", "unresolved-citations"]));
    expect(preview.gaps).not.toContain("no-environment");

    const built = await buildNoteBundle(paths, id, { digest: preview.digest, locale: "ko" }, options());
    expect(built.sha256).toBe(sha(built.zip));
    const zip = new AdmZip(built.zip);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(preview.files.map((f) => f.name).sort());
    for (const file of preview.files) expect(sha(zip.getEntry(file.name)!.getData())).toBe(file.sha256);
    expect(zip.getEntry("note/index.md")!.getData().toString()).toBe(note());
    const sums = zip.getEntry("SHA256SUMS")!.getData().toString();
    expect(sums).toContain(`${sha(note())}  note/index.md`);
    const readme = zip.getEntry("README.md")!.getData().toString();
    expect(readme).toContain("결과를 다시 실행했다는 증명이 아닙니다");
    expect(readme).not.toMatch(/sess-1|\.kady/);
    // Data files themselves are never included.
    expect(names.some((n) => n.includes("wells.csv"))).toBe(false);
  });

  it("refuses a stale preview and a missing digest", async () => {
    await setup();
    const preview = await previewNoteBundle(paths, id, "ko", options());
    write(`연구노트/${id}/figures/new.png`, "new");
    await expect(buildNoteBundle(paths, id, { digest: preview.digest }, options())).rejects.toMatchObject({ statusCode: 409 });
    await expect(buildNoteBundle(paths, id, {}, options())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("names the gaps of a note no chat wrote and skips links in the note folder", async () => {
    write(`연구노트/${id}/index.md`, note("결과만 있습니다."));
    fs.symlinkSync("/etc/hostname", path.join(paths.sandbox, `연구노트/${id}/link.txt`));
    const preview = await previewNoteBundle(paths, id, "en", options());
    expect(preview.gaps).toEqual(expect.arrayContaining(["no-chat", "no-workflow", "missing-figure"]));
    expect(preview.files.map((f) => f.name)).not.toContain("note/link.txt");
    expect(preview.data).toEqual([]);
  });

  it("reports the Workflow version recorded when the chat started", async () => {
    await setup();
    fs.mkdirSync(path.join(geoStateDir(paths), "method-trials"), { recursive: true });
    fs.writeFileSync(path.join(geoStateDir(paths), "method-trials", `${sid}.json`), JSON.stringify({
      schemaVersion: "gaid-method-trial/v1", sessionId: sid, methodKey: "project:demo", runtimeName: "demo", workflowId: "wf", methodId: "m-demo", revision: 1, packageSha256: null, treeHash: "t", startedAt: "2026-10-24T00:00:00Z",
    }));
    const preview = await previewNoteBundle(paths, id, "ko", options());
    expect(preview.workflow).toMatchObject({ methodId: "m-demo", workflowId: "wf", version: null, instructions: false });
    expect(preview.gaps).toContain("workflow-removed");
    expect(preview.files.map((f) => f.name)).toContain("workflow/workflow.json");
  });
});

describe("Workflow in the result bundle", () => {
  it("includes the version recorded at chat start and the rendered 지침 of an installed method", async () => {
    await setup();
    const label = { ko: "중력 이상 분석", en: "Gravity anomaly analysis" };
    const workflow = { schemaVersion: "geo-workflow/v1", id: "gravity", title: label, skillIds: ["local:bundled"], environmentProfile: "geo-core", prompt: label };
    write(".pi/skills/bundled/SKILL.md", "---\nname: bundled\ndescription: Gravity.\n---\n# Skill\n");
    write(".pi/skills/bundled/gaid-method.json", JSON.stringify({ schemaVersion: "gaid-method/v1", methodId: "local/bundled", revision: 2, lifecycle: "draft", implementation: "descriptive", title: label, workflows: [workflow] }));
    const packageSha = "a".repeat(64);
    writePackageOrigin(packageStore(), { sha256: packageSha, kind: "gaid-hub", hubEntry: { id: "entry-1", revision: 2, version: "0.1.1" }, fetchedAt: "2026-10-24T00:00:00Z" });
    fs.mkdirSync(path.join(geoStateDir(paths), "method-trials"), { recursive: true });
    fs.writeFileSync(path.join(geoStateDir(paths), "method-trials", `${sid}.json`), JSON.stringify({
      schemaVersion: "gaid-method-trial/v1", sessionId: sid, methodKey: "project:bundled", runtimeName: "bundled", workflowId: "gravity", methodId: "local/bundled", revision: 2, packageSha256: packageSha, treeHash: "t", startedAt: "2026-10-24T00:00:00Z",
    }));
    const preview = await previewNoteBundle(paths, id, "ko", options());
    expect(preview.workflow).toEqual({ title: "중력 이상 분석", methodId: "local/bundled", workflowId: "gravity", version: "0.1.1", instructions: true });
    expect(preview.gaps).not.toContain("no-workflow");
    const zip = new AdmZip((await buildNoteBundle(paths, id, { digest: preview.digest, locale: "ko" }, options())).zip);
    expect(zip.getEntry("workflow/instructions.md")!.getData().toString()).toContain("중력 이상 분석");
    expect(JSON.parse(zip.getEntry("workflow/workflow.json")!.getData().toString())).toMatchObject({ versionAtStart: "0.1.1", installedNow: true });
    const pub = await previewPublicExport(paths, id, "ko", options());
    expect(pub.candidates.map((c) => c.id)).toEqual(["note", "workflow", expect.stringMatching(/^paper:/)]);
  });
});

describe("public material export", () => {
  it("offers the note and cited PDFs, and packs only confirmed files", async () => {
    const { item } = await setup();
    const preview = await previewPublicExport(paths, id, "ko", options());
    expect(preview.candidates.map((c) => [c.id, c.kind, c.licence])).toEqual([["note", "note", null], [`paper:${item.id}`, "paper", "CC BY 4.0"]]);
    expect(preview.skipped).toEqual([{ key: "missing2020", title: null, reason: "not-in-library" }]);

    await expect(buildPublicExport(paths, id, { digest: preview.digest, files: [{ id: "note", mayLeave: false }] }, options())).rejects.toMatchObject({ statusCode: 400 });
    await expect(buildPublicExport(paths, id, { digest: preview.digest, files: [{ id: "paper:nope", mayLeave: true }] }, options())).rejects.toMatchObject({ statusCode: 400 });
    await expect(buildPublicExport(paths, id, { digest: "0".repeat(64), files: [{ id: "note", mayLeave: true }] }, options())).rejects.toMatchObject({ statusCode: 409 });

    const out = await buildPublicExport(paths, id, { digest: preview.digest, files: [{ id: "note", mayLeave: true }] }, options());
    const zip = new AdmZip(out.zip);
    expect(zip.getEntries().map((e) => e.entryName)).toEqual([`${id}.md`]);
    const text = zip.getEntry(`${id}.md`)!.getData().toString();
    expect(text).toContain("## 참고문헌");
    expect(text).toContain("Gravity survey");
    const log = fs.readFileSync(path.join(geoStateDir(paths), "public-exports.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(log).toEqual([expect.objectContaining({ note: id, zipSha256: out.sha256, confirmedMayLeave: true, files: [expect.objectContaining({ id: "note" })] })]);
  });

  it("serves previews and ZIP downloads over the routes", async () => {
    const { item } = await setup();
    const app = Fastify();
    await registerGeoNoteRoutes(app, { paths: () => paths, ...options() });
    const bundle = await app.inject({ method: "GET", url: `/geo/notes/${encodeURIComponent(id)}/bundle?locale=ko` });
    expect(bundle.statusCode).toBe(200);
    const dl = await app.inject({ method: "POST", url: `/geo/notes/${encodeURIComponent(id)}/bundle`, payload: { digest: bundle.json().digest, locale: "ko" } });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toBe("application/zip");
    expect(dl.headers["x-content-sha256"]).toBe(sha(dl.rawPayload));
    const pub = await app.inject({ method: "GET", url: `/geo/notes/${encodeURIComponent(id)}/public-export` });
    const pdl = await app.inject({ method: "POST", url: `/geo/notes/${encodeURIComponent(id)}/public-export`, payload: { digest: pub.json().digest, files: [{ id: `paper:${item.id}`, mayLeave: true }] } });
    expect(pdl.statusCode).toBe(200);
    expect(new AdmZip(pdl.rawPayload).getEntry("kim2024.pdf")!.getData().toString()).toBe("%PDF-1.4 test");
    const missing = await app.inject({ method: "GET", url: "/geo/notes/2026-01-01-none/bundle" });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
