import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { PROVENANCE_SCHEMA_VERSION, type ProvenanceStep } from "../src/provenance/store.ts";
import { buildHandoff, HANDOFF_LIMITS, HANDOFF_SCHEMA, previewHandoff } from "../src/geo/hub-handoff/builder.ts";
import { registerGeoHubHandoffRoutes } from "../src/geo/routes/hub-handoff.ts";
import { readTarGz } from "../src/geo/tar.ts";
import { directHandoffEndpoint, sendHandoff } from "../src/geo/hub-handoff/send.ts";

const sessionId = "12345678-1234-1234-1234-123456789abc";
const digest = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
let paths: ProjectPaths;
let app: FastifyInstance;
let sendOptions: Parameters<typeof registerGeoHubHandoffRoutes>[1];
const localSite = { id: "test-local", url: "http://127.0.0.1:54321/hub/", packages: "api/packages", authoring: "api/gaid/" };
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
  sendOptions = { sites: [localSite], fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({ projectId: "draft-1", url: "/hub/#/author/draft-1" }), { status: 201 })) };
  await registerGeoHubHandoffRoutes(app, sendOptions);
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
  it("includes UTF-8 tar extension headers in the whole-bundle size limit", async () => {
    const names = Array.from({ length: 4 }, (_, i) => `${"자료".repeat(10)}${i}.bin`);
    for (const [i, name] of names.entries()) file(name, Buffer.alloc(HANDOFF_LIMITS.fileBytes - (i === 3 ? 7000 : 0)));
    provenance(names);
    await expect(buildHandoff(paths, { sessionId, files: names }).then(result => zlib.gunzipSync(result.archive).length)).rejects.toMatchObject({ code: "size", status: 413 });
    for (const name of names) file(name, "small result");
    const accepted = await buildHandoff(paths, { sessionId, files: names });
    expect(readTarGz(accepted.archive).map(entry => entry.path)).toEqual(["handoff.json", ...names.map(name => `files/${name}`)]);
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
  it("sends gzip only to configured loopback authoring, with timeout and no redirects", async () => {
    file("analysis.py"); provenance(["analysis.py"]);
    const response = await app.inject({ method: "POST", url: "/geo/hub/handoff/send", payload: { sessionId, files: ["analysis.py"], siteId: localSite.id } });
    expect(response.statusCode).toBe(201); expect(response.headers["x-gaid-handoff-path"]).toBe("direct");
    expect(response.json()).toEqual({ path: "direct", projectId: "draft-1", url: "http://127.0.0.1:54321/hub/#/author/draft-1" });
    const fetcher = vi.mocked(sendOptions!.fetcher!);
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:54321/hub/api/gaid/handoffs", expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal), headers: { "Content-Type": "application/gzip", accept: "application/json" } }));
    expect(readTarGz(Buffer.from(fetcher.mock.calls[0][1]!.body as Uint8Array)).map(e => e.path)).toEqual(["handoff.json", "files/analysis.py"]);
  });
  it("refuses public/non-authoring sites without fetching and returns the download fallback", async () => {
    for (const site of [{ ...localSite, url: "https://public.example/" }, { ...localSite, authoring: undefined }, { ...localSite, url: "ftp://localhost/" }]) {
      expect(directHandoffEndpoint(site)).toBeNull();
      await expect(sendHandoff(Buffer.from("data"), site.id, { sites: [site], fetcher: sendOptions!.fetcher })).rejects.toMatchObject({ code: "input" });
    }
    expect(sendOptions!.fetcher).not.toHaveBeenCalled();
    const fallback = await app.inject({ method: "POST", url: "/geo/hub/handoff/send", payload: { sessionId, files: [], siteId: "unconfigured" } });
    expect(fallback.statusCode).toBe(200); expect(fallback.headers["x-gaid-handoff-path"]).toBe("download-fallback");
    expect(readTarGz(fallback.rawPayload)).toHaveLength(1); expect(sendOptions!.fetcher).not.toHaveBeenCalled();
  });
  it("falls back on network, malformed, oversized or off-site responses without retrying the upload", async () => {
    const fetcher = vi.mocked(sendOptions!.fetcher!);
    const responses = [new Response("not json", { status: 201 }), new Response("x".repeat(17 * 1024), { status: 201 }), new Response(JSON.stringify({ projectId: "p", url: "https://other.example/" }), { status: 201 }), new Response("error", { status: 500 })];
    for (const response of responses) {
      fetcher.mockResolvedValueOnce(response);
      const fallback = await app.inject({ method: "POST", url: "/geo/hub/handoff/send", payload: { sessionId, files: [], siteId: localSite.id } });
      expect(fallback.statusCode).toBe(200); expect(fallback.headers["content-type"]).toBe("application/gzip");
      expect(fallback.headers["x-gaid-handoff-path"]).toBe("download-fallback"); expect(readTarGz(fallback.rawPayload)).toHaveLength(1);
    }
    fetcher.mockRejectedValueOnce(new Error("timeout"));
    expect((await app.inject({ method: "POST", url: "/geo/hub/handoff/send", payload: { sessionId, files: [], siteId: localSite.id } })).headers["x-gaid-handoff-path"]).toBe("download-fallback");
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
});
