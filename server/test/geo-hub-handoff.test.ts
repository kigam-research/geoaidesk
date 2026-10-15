import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { PROVENANCE_SCHEMA_VERSION, type ProvenanceStep } from "../src/provenance/store.ts";
import { buildHandoff, HANDOFF_LIMITS, HANDOFF_SCHEMA, previewHandoff } from "../src/geo/hub-handoff/builder.ts";
import { registerGeoHubHandoffRoutes } from "../src/geo/routes/hub-handoff.ts";
import { readTarGz } from "../src/geo/tar.ts";

const sessionId = "12345678-1234-1234-1234-123456789abc";
const digest = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
let paths: ProjectPaths;
let app: FastifyInstance;
const file = (name: string, bytes: string | Buffer = "data") => {
  const target = path.join(paths.sandbox, name);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
};
function session(request = "Check the samples", answer = "Analysis finished, not reviewed") {
  fs.mkdirSync(paths.sessionsDir, { recursive: true });
  const message = (role: string, text: string, extra = {}) => ({ type: "message", message: { role, content: [{ type: "text", text }], ...extra } });
  fs.writeFileSync(path.join(paths.sessionsDir, `${sessionId}.jsonl`), [
    message("user", request), message("assistant", "I will inspect the files"),
    { type: "message", message: { role: "toolResult", toolCallId: "read1", content: [{ type: "text", text: "private tool output" }] } },
    message("user", "Now summarize"),
    { type: "message", message: { role: "assistant", provider: "gaid-local", model: "qwen", content: [{ type: "thinking", thinking: "private reasoning" }, { type: "text", text: answer }] } },
  ].map(row => JSON.stringify(row)).join("\n"));
}
function provenance(names: string[], inputs: string[] = []) {
  const ref = (name: string, change: "created" | "read") => ({ path: name, size: 4, mtimeMs: 0, change, confidence: "observed" as const });
  const step: ProvenanceStep = { schemaVersion: PROVENANCE_SCHEMA_VERSION, id: "step-1", sessionId, timestamp: 0, toolName: "bash", role: "agent", outputs: names.map(n => ref(n, "created")), inputs: inputs.map(n => ref(n, "read")) };
  fs.mkdirSync(path.join(paths.provenanceDir, sessionId), { recursive: true });
  fs.writeFileSync(path.join(paths.provenanceDir, sessionId, "steps.jsonl"), JSON.stringify(step) + "\n");
}
beforeEach(async () => {
  paths = resolvePaths("handoff-test");
  fs.rmSync(paths.root, { recursive: true, force: true }); fs.mkdirSync(paths.sandbox, { recursive: true }); session();
  app = Fastify();
  app.addHook("onRequest", (req, _reply, done) => withActiveProject(String(req.headers["x-project-id"] ?? paths.id), done));
  await registerGeoHubHandoffRoutes(app);
});
afterEach(async () => { await app.close(); fs.rmSync(paths.root, { recursive: true, force: true }); });

describe("analysis handoff", () => {
  it("previews first request, final text only, model and provenance-produced/read data", () => {
    for (const name of ["scripts/analysis.R", "results/plot.png", "user_data/raw.csv", "unrelated.txt"]) file(name);
    provenance(["scripts/analysis.R", "results/plot.png"], ["user_data/raw.csv", "unrelated.txt"]);
    const preview = previewHandoff(paths, sessionId);
    expect(preview).toMatchObject({ request: "Check the samples", finalAnswer: "Analysis finished, not reviewed", modelRef: "gaid-local/qwen", projectId: paths.id, sessionId });
    expect(preview.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "scripts/analysis.R", role: "code", size: 4, sha256: digest("data"), provenanceStepIds: ["step-1"] }),
      expect.objectContaining({ path: "results/plot.png", role: "result" }), expect.objectContaining({ path: "user_data/raw.csv", role: "user-data" }),
    ]));
    expect(preview.files).toHaveLength(3);
    expect(JSON.stringify(preview)).not.toMatch(/private tool output|private reasoning|I will inspect/);
  });
  it("downloads only explicitly selected files, rehashes changed bytes and records tar contents", async () => {
    file("analysis.py", "old"); file("user_data/raw.csv", "raw"); provenance(["analysis.py"], ["user_data/raw.csv"]);
    expect(previewHandoff(paths, sessionId).files[0].sha256).toBe(digest("old"));
    file("analysis.py", "new bytes");
    const result = await buildHandoff(paths, { sessionId, files: ["analysis.py"], note: "Prepare a Workflow draft" });
    const entries = readTarGz(result.archive);
    expect(entries.map(e => e.path)).toEqual(["handoff.json", "files/analysis.py"]);
    expect(entries[1].data.toString()).toBe("new bytes");
    const manifest = JSON.parse(entries[0].data.toString());
    expect(manifest).toMatchObject({ schemaVersion: HANDOFF_SCHEMA, request: "Check the samples", finalAnswer: "Analysis finished, not reviewed", note: "Prepare a Workflow draft", projectId: paths.id, sessionId, modelRef: "gaid-local/qwen", files: [{ path: "analysis.py", sha256: digest("new bytes"), size: 9, role: "code", provenanceStepIds: ["step-1"] }], excluded: { unselected: 1 } });
    expect(manifest.gaidVersion).toMatch(/^\d+\./); expect(manifest.createdAt).toMatch(/^\d{4}-/);
    expect(result.filename).toMatch(/^gaid-analysis-12345678-\d{8}\.tar\.gz$/);
    const optedIn = readTarGz((await buildHandoff(paths, { sessionId, files: ["user_data/raw.csv"] })).archive);
    expect(optedIn[1].path).toBe("files/user_data/raw.csv");
    expect(JSON.parse(optedIn[0].data.toString()).files[0].role).toBe("user-data");
  });
  it("supports text-only sessions and visibly bounds text", async () => {
    session("q".repeat(17000), "a".repeat(17000));
    const preview = previewHandoff(paths, sessionId);
    expect(preview.files).toEqual([]); expect(preview.request).toContain("[…truncated]"); expect(preview.finalAnswer).toContain("[…truncated]");
    expect(preview.truncated).toMatchObject({ request: true, finalAnswer: true });
    expect(readTarGz((await buildHandoff(paths, { sessionId, files: [] })).archive)).toHaveLength(1);
  });
  it("excludes unsafe paths, links, missing and oversized files and rejects their selection", async () => {
    const unsafe = ["../outside.txt", "/tmp/outside", ".kady/private.txt", ".pi/skills/a.md", ".venv/a", ".env.local", "nested/.env", "token.pem", "nested/key.KEY", "id_rsa", "nested/id_private", "secure/report.csv", "secrets/value.txt", "a\\b", "a/../b"];
    // Do not create/read actual secrets; the names alone must be excluded.
    file("good.txt"); file("huge.bin", Buffer.alloc(HANDOFF_LIMITS.fileBytes + 1));
    fs.symlinkSync(path.join(paths.sandbox, "good.txt"), path.join(paths.sandbox, "link.txt"));
    fs.symlinkSync(paths.sandbox, path.join(paths.sandbox, "linked"));
    provenance([...unsafe, "good.txt", "missing.txt", "huge.bin", "link.txt", "linked/good.txt"]);
    const preview = previewHandoff(paths, sessionId);
    expect(preview.files.map(f => f.path)).toEqual(["good.txt"]);
    expect(preview.excluded).toMatchObject({ policy: unsafe.length + 2, unavailable: 1, tooLarge: 1 });
    for (const name of [...unsafe, "link.txt", "linked/good.txt", "missing.txt", "huge.bin"]) await expect(buildHandoff(paths, { sessionId, files: [name] })).rejects.toMatchObject({ code: "file" });
  });
  it("does not allow an arbitrary sandbox file or another session's artifacts", async () => {
    file("unrelated.txt"); provenance([]);
    await expect(buildHandoff(paths, { sessionId, files: ["unrelated.txt"] })).rejects.toMatchObject({ code: "file" });
    expect(() => previewHandoff(paths, "missing-session")).toThrow(/No such session/);
    for (const id of ["../bad", "a/b", "a".repeat(201), undefined]) expect(() => previewHandoff(paths, id)).toThrow(/session id/);
  });
  it("bounds file count, selections, note and total bytes including manifest", async () => {
    const names = Array.from({ length: 201 }, (_, i) => `outputs/${String(i).padStart(3, "0")}.txt`);
    for (const name of names) file(name, "x"); provenance(names);
    const preview = previewHandoff(paths, sessionId);
    expect(preview.files).toHaveLength(200); expect(preview.excluded.fileLimit).toBe(1);
    await expect(buildHandoff(paths, { sessionId, files: names })).rejects.toMatchObject({ code: "input" });
    await expect(buildHandoff(paths, { sessionId, files: [names[0], names[0]] })).rejects.toMatchObject({ code: "input" });
    await expect(buildHandoff(paths, { sessionId, files: [], note: "x".repeat(4001) })).rejects.toMatchObject({ code: "input" });
    const large = ["a.bin", "b.bin", "c.bin", "d.bin"];
    for (const name of large) file(name, Buffer.alloc(HANDOFF_LIMITS.fileBytes)); provenance(large);
    await expect(buildHandoff(paths, { sessionId, files: large })).rejects.toMatchObject({ code: "size", status: 413 });
  });
  it("bounds source logs before shared readers load them", () => {
    const history = path.join(paths.sessionsDir, `${sessionId}.jsonl`);
    fs.truncateSync(history, HANDOFF_LIMITS.logBytes + 1);
    expect(() => previewHandoff(paths, sessionId)).toThrow(/read limit/);
    session(); provenance([]);
    fs.truncateSync(path.join(paths.provenanceDir, sessionId, "steps.jsonl"), HANDOFF_LIMITS.logBytes + 1);
    expect(() => previewHandoff(paths, sessionId)).toThrow(/read limit/);
  });
  it("keeps modified/wrote edges and deduplicates step ids", () => {
    file("result.txt"); provenance(["result.txt"]);
    const log = path.join(paths.provenanceDir, sessionId, "steps.jsonl");
    const first = JSON.parse(fs.readFileSync(log, "utf8"));
    fs.appendFileSync(log, ["modified", "wrote"].map((change, i) => JSON.stringify({ ...first, id: `step-${i + 2}`, outputs: [{ ...first.outputs[0], change }] })).join("\n"));
    expect(previewHandoff(paths, sessionId).files[0].provenanceStepIds).toEqual(["step-1", "step-2", "step-3"]);
  });
  it("serves project-scoped no-store preview and gzip download, without touching another project", async () => {
    file("analysis.py"); provenance(["analysis.py"]);
    const preview = await app.inject({ method: "POST", url: "/geo/hub/handoff/preview", payload: { sessionId } });
    expect(preview.statusCode).toBe(200); expect(preview.headers["cache-control"]).toBe("no-store");
    const other = await app.inject({ method: "POST", url: "/geo/hub/handoff/preview", headers: { "x-project-id": "different-project" }, payload: { sessionId } });
    expect(other.statusCode).toBe(404);
    const download = await app.inject({ method: "POST", url: "/geo/hub/handoff", payload: { sessionId, files: ["analysis.py"] } });
    expect(download.statusCode).toBe(200); expect(download.headers["content-type"]).toBe("application/gzip");
    expect(download.headers["content-disposition"]).toMatch(/attachment; filename="gaid-analysis-/);
    expect(zlib.gunzipSync(download.rawPayload).length).toBeLessThanOrEqual(HANDOFF_LIMITS.totalBytes);
    expect(readTarGz(download.rawPayload).map(e => e.path)).toEqual(["handoff.json", "files/analysis.py"]);
    expect((await app.inject({ method: "POST", url: "/geo/hub/handoff", payload: { sessionId, files: ["../bad"] } })).statusCode).toBe(400);
  });
});
