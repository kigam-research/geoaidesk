/**
 * Raw-data guard: the lead tool_call hook, the pending-permission flow and its
 * HTTP surface, and the guard-policy store.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { registerChildGuard } from "../pi-packages/kady-guard/index.ts";

vi.mock("../src/agent/session-registry.ts", () => ({
  getModelRuntime: vi.fn(() => ({ checkAuth: vi.fn(async () => ({ type: "api_key", source: "test" })) })),
  getModelRegistry: vi.fn(() => ({ find: () => null })),
  createSession: vi.fn(),
  getSession: vi.fn(async () => null),
  listSessions: vi.fn(async () => []),
  disposeSession: vi.fn(),
  pinSession: vi.fn(),
  unpinSession: vi.fn(),
  setSessionObserver: vi.fn(),
  abortProjectSessions: vi.fn(async () => {}),
  disposeProjectSessions: vi.fn(),
}));

import { buildApp } from "../src/index.ts";
import { PROJECTS_ROOT } from "../src/config.ts";
import { createProject, resolvePaths } from "../src/projects.ts";
import { runBroker } from "../src/agent/run-broker.ts";
import { makeDataGuardExtension } from "../src/agent/data-guard.ts";
import { readGuardPolicy, writeGuardPolicy, guardPolicyPath } from "../src/agent/guard-policy.ts";
import {
  cancelPermissionsForSession,
  pendingPermissionFor,
  requestPermission,
  resolvePermission,
} from "../src/agent/permissions.ts";

const app = await buildApp();
let projectId: string;
const baseline = { messages: [], contextUsage: null };

beforeEach(() => {
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  runBroker.clear();
  projectId = createProject({ name: "Guarded" }).id;
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  await app.close();
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
});

type ToolCallHandler = (event: unknown, ctx?: unknown) => Promise<{ block?: boolean; reason?: string; terminate?: boolean } | undefined>;
function install(options: Parameters<typeof makeDataGuardExtension>[3] = {}) {
  const handlers = new Map<string, ToolCallHandler>();
  makeDataGuardExtension(projectId, () => "s1", resolvePaths(projectId).sandbox, options)({
    on: (name: string, handler: ToolCallHandler) => handlers.set(name, handler),
  } as never);
  return handlers.get("tool_call")!;
}
const call = (toolName: string, input: Record<string, unknown>) => ({ type: "tool_call", toolCallId: "tc1", toolName, input });

describe("data guard tool_call hook", () => {
  it("blocks write/edit/bash mutations under protected paths with an actionable reason", async () => {
    const hook = install();
    const sandbox = resolvePaths(projectId).sandbox;
    for (const event of [
      call("write", { path: "user_data/a.csv", content: "x" }),
      call("edit", { path: `${sandbox}/user_data/a.csv`, edits: [] }),
      call("bash", { command: "rm -rf user_data" }),
      call("bash", { command: "cd user_data && sed -i 's/a/b/' a.csv" }),
    ]) {
      const result = await hook(event);
      expect(result?.block).toBe(true);
      expect(result?.reason).toMatch(/protected raw data/);
      expect(result?.reason).toMatch(/derived\//);
    }
    expect(await hook(call("write", { path: "derived/a.csv", content: "x" }))).toBeUndefined();
    expect(await hook(call("bash", { command: "head user_data/a.csv" }))).toBeUndefined();
    expect(await hook(call("read", { path: "user_data/a.csv" }))).toBeUndefined();
  });

  it("confirms outside writes for every file tool and bash, without gating reads or allowed destinations", async () => {
    const request = vi.fn(async () => "allowed" as const);
    const hook = install({ request });
    const target = "/opt/gaid/outside/file";
    for (const toolName of ["write", "edit", "generate_image", "bash"]) {
      const input = toolName === "bash" ? { command: `mkdir -p "${target}"` } : { path: target };
      expect(await hook(call(toolName, input))).toBeUndefined();
      expect(request).toHaveBeenLastCalledWith(projectId, "s1", expect.objectContaining({ kind: "outside-project", path: target, toolName, reason: expect.stringMatching(/^Outside-project write:/) }));
    }
    expect(request).toHaveBeenCalledTimes(4);
    request.mockClear();
    for (const destination of ["derived/file", path.join(os.tmpdir(), "gaid-guard-file"), "/tmp/gaid-guard-file", "/dev/null"]) {
      for (const toolName of ["write", "edit", "generate_image"]) expect(await hook(call(toolName, { path: destination }))).toBeUndefined();
      expect(await hook(call("bash", { command: `echo x > "${destination}"` }))).toBeUndefined();
    }
    expect(await hook(call("read", { path: target }))).toBeUndefined();
    expect(await hook(call("bash", { command: `cat "${target}"` }))).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect((await hook(call("generate_image", { path: "user_data/image.png" })))?.block).toBe(true);
  });

  it("blocks outside writes on deny, timeout, no UI or cancellation, and re-reads the policy", async () => {
    const request = vi.fn();
    const hook = install({ request });
    for (const toolName of ["write", "bash"]) {
      for (const outcome of ["denied", "timeout", "no_ui", "cancelled"] as const) {
        request.mockResolvedValueOnce(outcome);
        const target = path.relative(resolvePaths(projectId).sandbox, "/opt/gaid/outside");
        const input = toolName === "bash" ? { command: `touch ${target}` } : { path: target };
        expect(await hook(call(toolName, input))).toMatchObject({ block: true, terminate: outcome === "cancelled" });
      }
    }
    request.mockClear();
    writeGuardPolicy(resolvePaths(projectId).sandbox, { protectedPaths: ["user_data/**"], destructiveConfirm: false });
    expect(await hook(call("write", { path: "/opt/gaid/outside" }))).toBeUndefined();
    expect(await hook(call("bash", { command: "touch /opt/gaid/outside" }))).toBeUndefined();
    expect((await hook(call("write", { path: "user_data/file" })))?.block).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("honours the project policy: custom globs and confirm off", async () => {
    writeGuardPolicy(resolvePaths(projectId).sandbox, { protectedPaths: ["raw/**"], destructiveConfirm: false });
    const request = vi.fn(async () => "allowed" as const);
    const hook = install({ request });
    expect((await hook(call("bash", { command: "rm raw/x" })))?.block).toBe(true);
    expect(await hook(call("bash", { command: "rm -rf user_data" }))).toBeUndefined();
    // Destructive elsewhere with confirm off: allowed without asking.
    expect(await hook(call("bash", { command: "rm -rf results" }))).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("asks the user for destructive commands and maps every outcome", async () => {
    const outcomes = ["allowed", "denied", "timeout", "no_ui", "cancelled"] as const;
    const request = vi.fn();
    for (const outcome of outcomes) request.mockResolvedValueOnce(outcome);
    const hook = install({ request: request as never });
    const results = [];
    for (const _ of outcomes) results.push(await hook(call("bash", { command: "rm -rf results && echo ok" })));
    expect(results[0]).toBeUndefined();
    expect(results[1]).toMatchObject({ block: true, terminate: false });
    expect(results[1]!.reason).toMatch(/declined/);
    expect(results[2]!.reason).toMatch(/did NOT approve/);
    expect(results[3]!.reason).toMatch(/interactive confirmation/);
    expect(results[4]).toMatchObject({ block: true, terminate: true });
    expect(request).toHaveBeenCalledWith(projectId, "s1", {
      toolCallId: "tc1",
      toolName: "bash",
      kind: "destructive",
      path: undefined,
      command: "rm -rf results && echo ok",
      reason: expect.stringMatching(/Destructive shell command/),
    });
  });
});

describe("permissions", () => {

  it("publishes a request on the live handle and resolves through the route", async () => {
    const handle = runBroker.start(projectId, "s1", { runId: "r1", prompt: "x", images: [], baseline });
    const promise = requestPermission(projectId, "s1", { toolCallId: "tc", toolName: "bash", command: "write ../outside", reason: "why", kind: "outside-project", path: "../outside" });
    const pending = pendingPermissionFor(projectId, "s1");
    expect(pending).toMatchObject({ payload: { command: "write ../outside", reason: "why", kind: "outside-project", path: "../outside" } });
    const frames = handle.state().run!.frames;
    expect(frames[frames.length - 1]).toMatchObject({ type: "permission_request", requestId: pending!.requestId, command: "write ../outside", kind: "outside-project", path: "../outside" });

    const restored = await app.inject({ method: "GET", url: "/sessions/s1/permissions", headers: { "x-project-id": projectId } });
    expect(restored.json()).toMatchObject({ pending: { requestId: pending!.requestId, payload: { kind: "outside-project", path: "../outside" } } });

    const res = await app.inject({
      method: "POST",
      url: `/sessions/s1/permissions/${pending!.requestId}`,
      headers: { "x-project-id": projectId, "content-type": "application/json" },
      payload: { allow: true },
    });
    expect(res.statusCode).toBe(200);
    expect(await promise).toBe("allowed");
    expect(handle.state().run!.frames.at(-1)).toMatchObject({ type: "permission_resolved", outcome: "allowed", allowed: true });
    expect(pendingPermissionFor(projectId, "s1")).toBeNull();

    // Answered already → 404; bad body → 400.
    const again = await app.inject({ method: "POST", url: `/sessions/s1/permissions/${pending!.requestId}`, headers: { "x-project-id": projectId, "content-type": "application/json" }, payload: { allow: false } });
    expect(again.statusCode).toBe(404);
    const bad = await app.inject({ method: "POST", url: `/sessions/s1/permissions/x`, headers: { "x-project-id": projectId, "content-type": "application/json" }, payload: { allow: "yes" } });
    expect(bad.statusCode).toBe(400);
    handle.complete();
  });

  it("denies, cancels on abort/run completion, times out, and reports no_ui without a handle", async () => {
    expect(await requestPermission(projectId, "s0", { toolCallId: "t", toolName: "bash", command: "rm -rf x", reason: "r" })).toBe("no_ui");

    const handle = runBroker.start(projectId, "s1", { runId: "r1", prompt: "x", images: [], baseline });
    const denied = requestPermission(projectId, "s1", { toolCallId: "t", toolName: "bash", command: "rm -rf x", reason: "r" });
    expect(resolvePermission(projectId, "s1", pendingPermissionFor(projectId, "s1")!.requestId, false)).toBe(true);
    expect(await denied).toBe("denied");
    expect(resolvePermission("other", "s1", "nope", true)).toBe(false);

    const cancelled = requestPermission(projectId, "s1", { toolCallId: "t", toolName: "bash", command: "rm -rf y", reason: "r" });
    expect(cancelPermissionsForSession(projectId, "s1")).toBe(1);
    expect(await cancelled).toBe("cancelled");

    const viaGet = await app.inject({ method: "GET", url: "/sessions/s1/permissions", headers: { "x-project-id": projectId } });
    expect(viaGet.json()).toEqual({ pending: null });

    vi.useFakeTimers();
    const timedOut = requestPermission(projectId, "s1", { toolCallId: "t", toolName: "bash", command: "rm -rf z", reason: "r" }, { timeoutMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_100);
    expect(await timedOut).toBe("timeout");
    vi.useRealTimers();

    const byCompletion = requestPermission(projectId, "s1", { toolCallId: "t", toolName: "bash", command: "rm -rf w", reason: "r" });
    handle.complete();
    expect(await byCompletion).toBe("cancelled");
  });
});

describe("guard policy", () => {
  it("defaults to user_data/** with confirm on, and round-trips through the routes", async () => {
    const sandbox = resolvePaths(projectId).sandbox;
    expect(readGuardPolicy(sandbox)).toEqual({ version: 1, protectedPaths: ["user_data/**"], destructiveConfirm: true });
    let res = await app.inject({ method: "GET", url: `/projects/${projectId}/guard-policy`, headers: { "x-project-id": projectId } });
    expect(res.json()).toMatchObject({ protectedPaths: ["user_data/**"], destructiveConfirm: true });

    res = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/guard-policy`,
      headers: { "x-project-id": projectId, "content-type": "application/json" },
      payload: { protectedPaths: ["user_data/**", "raw/*.csv", " reference "], destructiveConfirm: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ version: 1, protectedPaths: ["user_data/**", "raw/*.csv", "reference"], destructiveConfirm: false });
    expect(JSON.parse(fs.readFileSync(guardPolicyPath(sandbox), "utf-8"))).toMatchObject({ destructiveConfirm: false });

    for (const payload of [{ protectedPaths: "user_data" }, { protectedPaths: ["/abs"] }, { protectedPaths: ["../up"] }, { destructiveConfirm: "no" }]) {
      const bad = await app.inject({ method: "PUT", url: `/projects/${projectId}/guard-policy`, headers: { "x-project-id": projectId, "content-type": "application/json" }, payload });
      expect(bad.statusCode).toBe(400);
    }
    // Malformed file → defaults, not a crash.
    fs.writeFileSync(guardPolicyPath(sandbox), "{nope");
    expect(readGuardPolicy(sandbox).protectedPaths).toEqual(["user_data/**"]);
  });

  it("abort dismisses pending permission cards", async () => {
    const handle = runBroker.start(projectId, "s1", { runId: "r1", prompt: "x", images: [], baseline });
    const promise = requestPermission(projectId, "s1", { toolCallId: "t", toolName: "bash", command: "rm -rf x", reason: "r" });
    const res = await app.inject({ method: "POST", url: "/sessions/s1/abort", headers: { "x-project-id": projectId } });
    expect(res.statusCode).toBe(200);
    expect(await promise).toBe("cancelled");
    handle.complete();
  });
});

describe("kady-guard package seeding", () => {
  it("is referenced from sandbox settings.json for child sessions", async () => {
    const { seedGuardPackage, kadyGuardPackageDir } = await import("../src/agent/guard-bridge.ts");
    const paths = resolvePaths(projectId);
    expect(seedGuardPackage(paths)).toBe(true);
    expect(seedGuardPackage(paths)).toBe(false);
    const settings = JSON.parse(fs.readFileSync(path.join(paths.sandbox, ".pi", "settings.json"), "utf-8"));
    expect(settings.packages).toContain(kadyGuardPackageDir());
    expect(fs.existsSync(path.join(kadyGuardPackageDir(), "index.ts"))).toBe(true);
  });
});

describe("background specialist outside-write guard", () => {
  it("blocks file and recognized shell writes even when lead confirmations are disabled", async () => {
    const handlers = new Map<string, ToolCallHandler>();
    registerChildGuard({ on: (name: string, handler: ToolCallHandler) => handlers.set(name, handler) } as never);
    const hook = handlers.get("tool_call")!;
    const cwd = resolvePaths(projectId).sandbox;
    writeGuardPolicy(cwd, { protectedPaths: ["user_data/**"], destructiveConfirm: false });
    for (const event of [call("write", { path: "/opt/gaid/outside" }), call("edit", { path: "/opt/gaid/outside" }), call("generate_image", { path: "/opt/gaid/outside.png" }), call("bash", { command: "mkdir -p ~/assets/geo-catalogue/0.2.2" })]) {
      expect(await hook(event, { cwd })).toMatchObject({ block: true, reason: expect.stringMatching(/outside-project writes.*Report the target/) });
    }
    for (const event of [call("write", { path: "derived/file" }), call("write", { path: path.join(os.tmpdir(), "guard-file") }), call("bash", { command: "echo x > /dev/null" }), call("bash", { command: "cat /opt/gaid/file" }), call("read", { path: "../outside" })]) {
      expect(await hook(event, { cwd })).toBeUndefined();
    }
    expect(await hook(call("bash", { command: "touch /opt/file; rm user_data/file" }), { cwd })).toMatchObject({ block: true, reason: expect.stringMatching(/protected raw data/) });
  });
});
