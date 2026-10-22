import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePaths } from "../src/projects.ts";
import { registerGeoFigureRoutes } from "../src/geo/routes/figures.ts";
import { appendStep, identify, type ProvenanceStep, type ArtifactRef } from "../src/provenance/store.ts";
import { FIGURE_CHECK_SCHEMA, JOURNAL_FIGURES_SCHEMA, type JournalProfile, type FigureListResponse } from "../../web/src/geo/contracts/figures.ts";
import { figureRecord, journalProfiles } from "../src/geo/figures/store.ts";
import * as helper from "../src/api/sci-helpers.ts";

const project = resolvePaths("figure-record-test"), root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-figures-"));
const skillDir = path.join(root, "skill"), note = "2026-10-22-analysis", base = `연구노트/${note}`;
const app = Fastify();
await registerGeoFigureRoutes(app, { paths: () => project, skillDir });
const profile: JournalProfile = {
  id: "test", name: "Test Journal", publisher: "Test", covers: [], widths: [{ id: "single", label: "1단", mm: 90 }],
  minFontPt: 7, maxHeightMm: null, dpi: { photo: 300, combination: 500, lineArt: 1000 },
  formats: { vector: ["pdf"], raster: ["png"] }, colour: { mode: "RGB", cvdRequired: null, colourMapAdvice: null }, panelsInOneFile: null,
  aiPolicy: { "data-figure": "allowed", "code-diagram": "disclose", "ai-picture": "disclose", "ai-graphical-abstract": "forbidden", "image-edit": "forbidden" },
  aiDisclosure: ["caption"], sources: [{ url: "https://example.org/rules", title: "Rules", checkedAt: "2026-10-22" }], rulesCheckedAt: "2026-10-22", notes: [],
};
function write(relative: string, text: string) {
  const file = path.join(project.sandbox, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file;
}
function ref(relative: string, change: ArtifactRef["change"] = "created"): ArtifactRef {
  const identity = identify(path.join(project.sandbox, relative))!;
  return { path: relative, size: identity.size, mtimeMs: identity.mtimeMs, ...(identity.sha256 ? { sha256: identity.sha256 } : {}), confidence: "observed", change };
}
function step(id: string, timestamp: number, toolName: string, inputs: string[], outputs: string[], extra: Partial<ProvenanceStep> = {}) {
  appendStep({ schemaVersion: 1, id, sessionId: "chat-a", timestamp, toolName, role: "agent", inputs: inputs.map(p => ref(p, "read")), outputs: outputs.map(p => ref(p)), ...extra }, project.id);
}
beforeEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(project.root, { recursive: true, force: true }); fs.rmSync(skillDir, { recursive: true, force: true });
  fs.mkdirSync(project.sandbox, { recursive: true }); fs.mkdirSync(path.join(skillDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(skillDir, "assets/journals.json"), JSON.stringify({ schema: JOURNAL_FIGURES_SCHEMA, profiles: [profile] }));
  write("draw.py", "draw(data)"); write("data.csv", "x,y\n1,2"); write("out.png", "plot"); write(`${base}/figures/plot.png`, "plot");
  write(`${base}/figures/ai.png`, "AI bytes"); write(`${base}/figures/unknown.png`, "no record");
  write(`${base}/index.md`, `---\ntitle: Analysis\ndate: 2026-10-22\nstatus: pending\n---\n# Analysis\n![plot](figures/plot.png)\n\n그림 1. 자료 그림\n![ai](figures/ai.png)\n그림 2. 개념 그림\n![unknown](figures/unknown.png)\n\n\`![example](figures/ignored.png)\`\n`);
  step("draw", 1000, "bash", ["draw.py", "data.csv"], ["out.png"], { args: { command: "python draw.py data.csv" } });
  step("copy", 2000, "bash", ["out.png"], [`${base}/figures/plot.png`], { args: { command: `cp out.png '${base}/figures/plot.png'` } });
  step("ai", 3000, "generate_image", [], [`${base}/figures/ai.png`], { model: "image-provider/image-model" });
});
afterAll(async () => { await app.close(); fs.rmSync(project.root, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); });
const getList = async () => (await app.inject({ url: `/geo/figures?note=${note}` })).json<FigureListResponse>();

describe("research-note figure records", () => {
  it("GET shows script-drawn copy, AI picture and an unrecorded figure without inventing origins", async () => {
    const response = await app.inject({ url: `/geo/figures?note=${note}` });
    expect(response.statusCode).toBe(200);
    const data = response.json<FigureListResponse>();
    expect(data.figures).toHaveLength(3);
    const [plot, ai, unknown] = data.figures;
    expect(plot).toMatchObject({ caption: "그림 1. 자료 그림", kind: "data-figure", staleness: "current", inputsChanged: false, origin: { copiedFrom: "out.png", copyMatch: "edge", sessionId: "chat-a", script: "draw.py" } });
    expect(plot.origin?.inputs).toEqual(expect.arrayContaining([expect.objectContaining({ path: "data.csv", role: "data", changedSinceUse: false }), expect.objectContaining({ path: "draw.py", role: "script" })]));
    expect(ai).toMatchObject({ kind: "ai-picture", origin: { record: { model: "image-provider/image-model" } } });
    expect(ai.disclosure).toContain("generate_image");
    expect(unknown).toMatchObject({ kind: "unknown", staleness: "unknown", origin: null, disclosure: null });
    write("hash-copy.png", "plot");
    expect(figureRecord(project, "hash-copy.png", null, null, skillDir)).toMatchObject({ kind: "data-figure", origin: { copyMatch: "hash", copiedFrom: "out.png", script: "draw.py" } });
    console.info("GET /geo/figures synthetic evidence", JSON.stringify(data.figures.map(f => ({ path: f.path, kind: f.kind, script: f.origin?.script ?? null, copyMatch: f.origin?.copyMatch ?? null }))));
  });
  it("keeps the version used by a copy, detects changed data and figure bytes, and infers hash copies", async () => {
    write("data.csv", "changed data");
    step("redraw", 4000, "bash", ["draw.py", "data.csv"], ["out.png"]);
    const list = await getList();
    expect(list.figures[0].inputsChanged).toBe(true);
    write(`${base}/figures/hash.png`, "plot");
    const hash = figureRecord(project, `${base}/figures/hash.png`, null, null, skillDir);
    expect(hash.origin?.copyMatch).toBe("hash");
    write(`${base}/figures/plot.png`, "edited plot");
    expect((await getList()).figures[0].staleness).toBe("stale");
  });
  it("handles diagram and AI-edit kinds, inferred edges and degraded records", () => {
    write("diagram.svg", "<svg/>"); step("svg", 4000, "write", [], ["diagram.svg"]);
    expect(figureRecord(project, "diagram.svg", null, null, skillDir).kind).toBe("code-diagram");
    write("edited.png", "edited"); step("edit-ai", 5000, "generate_image", ["out.png"], ["edited.png"], { degraded: "scan-failed" });
    expect(figureRecord(project, "edited.png", null, null, skillDir)).toMatchObject({ kind: "image-edit", origin: { incomplete: true } });
  });
  it("persists hash-scoped kind overrides, exposes journal policy and clears overrides", async () => {
    const ai = (await getList()).figures[1];
    const target = await app.inject({ method: "PUT", url: "/geo/figures/target", payload: { journalId: "test", width: "single" } });
    expect(target.statusCode).toBe(200);
    const changed = await app.inject({ method: "PUT", url: "/geo/figures/kind", payload: { path: ai.path, sha256: ai.sha256, kind: "ai-graphical-abstract" } });
    expect(changed.json().figure).toMatchObject({ kind: "ai-graphical-abstract", kindSource: "researcher", policy: { policy: "forbidden" } });
    expect(changed.json().figure.disclosure).toContain("purpose: 그림 2. 개념 그림");
    expect((await app.inject({ method: "PUT", url: "/geo/figures/kind", payload: { path: ai.path, sha256: ai.sha256, kind: null } })).json().figure.kind).toBe("ai-picture");
    write(ai.path, "new picture");
    expect((await app.inject({ method: "PUT", url: "/geo/figures/kind", payload: { path: ai.path, sha256: ai.sha256, kind: "unknown" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "PUT", url: "/geo/figures/target", payload: { journalId: null, width: null } })).json().target).toBeNull();
  });
  it("refuses escaped, hidden and symlinked paths and invalid target/kind bodies", async () => {
    fs.symlinkSync(root, path.join(project.sandbox, "outside"));
    write(".private/secret.png", "hidden"); fs.symlinkSync(path.join(project.sandbox, ".private/secret.png"), path.join(project.sandbox, "alias.png"));
    for (const p of ["../bad.png", ".private/secret.png", "outside/bad.png", "alias.png"]) expect((await app.inject({ url: `/geo/figures/record?path=${encodeURIComponent(p)}` })).statusCode).toBe(403);
    expect((await app.inject({ url: "/geo/figures/record" })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/geo/figures/target", payload: { journalId: "absent", width: "single" } })).statusCode).toBe(400);
    const ai = (await getList()).figures[1];
    expect((await app.inject({ method: "PUT", url: "/geo/figures/kind", payload: { path: ai.path, sha256: ai.sha256, kind: "bad" } })).statusCode).toBe(400);
  });
  it("keeps missing local images, skips external/escaped images and bounds project figures at 200", async () => {
    write(`${base}/index.md`, "![missing](figures/missing.png)\n![bad](../../../bad.png)\n![web](https://example.org/a.png)\n" + Array.from({ length: 205 }, (_, i) => `![f](figures/${i}.png)`).join("\n"));
    const data = (await app.inject({ url: "/geo/figures" })).json<FigureListResponse>();
    expect(data.figures).toHaveLength(200); expect(data.truncated).toBe(true);
    expect(data.figures[0]).toMatchObject({ exists: false, kind: "unknown" });
    expect(data.figures.some(f => f.path === "bad.png")).toBe(false);
  });
  it("does not rewrite malformed state and returns an empty journal list when the skill is absent", async () => {
    write(".kady/geo/figures.json", "broken");
    expect((await app.inject({ url: `/geo/figures?note=${note}` })).statusCode).toBe(409);
    expect(fs.readFileSync(path.join(project.sandbox, ".kady/geo/figures.json"), "utf8")).toBe("broken");
    expect(journalProfiles(path.join(root, "absent"))).toEqual([]);
  });
});

describe("figure checker boundary", () => {
  it("serves only fixed CVD preview names, never arbitrary hidden files", async () => {
    const sha = "a".repeat(64);
    write(`.kady/geo/figure-checks/${sha}-cvd-deuteranopia.png`, "PNG bytes");
    const response = await app.inject({ url: `/geo/figures/check-preview?sha256=${sha}&variant=deuteranopia` });
    expect(response.statusCode).toBe(200); expect(response.headers["content-type"]).toBe("image/png"); expect(response.body).toBe("PNG bytes");
    expect((await app.inject({ url: `/geo/figures/check-preview?sha256=${sha}&variant=tritanopia` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/geo/figures/check-preview?sha256=../../x&variant=deuteranopia` })).statusCode).toBe(400);
    expect((await app.inject({ url: `/geo/figures/check-preview?sha256=${sha}&variant=../../x` })).statusCode).toBe(400);
  });
  it("returns a clear 503 when the script is absent", async () => {
    const response = await app.inject({ method: "POST", url: "/geo/figures/check", payload: { path: "out.png" } });
    expect(response.statusCode).toBe(503); expect(response.json().code).toBe("figure-check-unavailable");
  });
  it("runs the shared checker contract, preserves exact-byte check identity and maps helper failures", async () => {
    fs.mkdirSync(path.join(skillDir, "scripts")); fs.writeFileSync(path.join(skillDir, "scripts/check_figure.py"), "fixture");
    const run = vi.spyOn(helper, "runHelperScript").mockImplementation(async (_script, args) => {
      const sha = identify(path.join(project.sandbox, "out.png"))!.sha256;
      fs.writeFileSync(args[args.indexOf("--out") + 1], JSON.stringify({ schema: FIGURE_CHECK_SCHEMA, sha256: sha, path: path.join(project.sandbox, "out.png"), kind: "data-figure", checkedAt: "2026-10-22", rulesCheckedAt: "2026-10-22", target: { journalId: "test", width: "single", widthMm: 90 }, items: [{ id: "dpi", status: "fail", measured: "30 dpi", required: "300 dpi" }], cvdPreviews: [] }));
      return { status: 0, stdout: "", stderr: "", timedOut: false };
    });
    const response = await app.inject({ method: "POST", url: "/geo/figures/check", payload: { path: "out.png", journalId: "test", width: "single" } });
    expect(response.statusCode).toBe(200); expect(response.json().figure.check.path).toBe("out.png");
    expect(run.mock.calls[0][1]).toEqual(expect.arrayContaining(["--kind", "data-figure", "--journal", "test", "--width", "single"]));
    write("out.png", "new bytes"); expect(figureRecord(project, "out.png", null, null, skillDir).check).toBeNull();
    for (const [status, expected] of [[3, 503], [4, 404], [5, 422], [1, 500]]) {
      run.mockResolvedValueOnce({ status, stdout: "", stderr: "helper failed", timedOut: false });
      expect((await app.inject({ method: "POST", url: "/geo/figures/check", payload: { path: "out.png" } })).statusCode).toBe(expected);
    }
    run.mockResolvedValueOnce({ status: 1, stdout: "", stderr: "timeout", timedOut: true });
    expect((await app.inject({ method: "POST", url: "/geo/figures/check", payload: { path: "out.png" } })).statusCode).toBe(504);
  });
});
