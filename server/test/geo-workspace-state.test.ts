/**
 * gaid-project-resume: a project's workspace state lives on the GAID server,
 * scoped by X-Project-Id through the real app hooks; the last save wins.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
import { workspaceStateFile } from "../src/geo/workspace/workspace-state.ts";
import type {
  GeoWorkspaceStateResponse,
  GeoWorkspaceStateSaved,
} from "../../web/src/geo/contracts/workspace-state.ts";

const app = await buildApp();
const h = (pid: string) => ({ "x-project-id": pid, "content-type": "application/json" });

const state = (title: string, openPaths: string[] = []) => ({
  tabs: [{ id: "tab-1", title, sessionId: "s-1" }],
  activeTabId: "tab-1",
  view: "chat",
  sandbox: { openPaths, activePath: openPaths[0] ?? null },
});

let a: string;
let b: string;

beforeEach(() => {
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  a = createProject({ name: "Alpha" }).id;
  b = createProject({ name: "Beta" }).id;
});

afterAll(async () => {
  await app.close();
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
});

async function get(pid: string): Promise<GeoWorkspaceStateResponse> {
  const res = await app.inject({ method: "GET", url: "/geo/workspace-state", headers: h(pid) });
  expect(res.statusCode).toBe(200);
  return res.json() as GeoWorkspaceStateResponse;
}

async function put(pid: string, body: unknown) {
  return app.inject({ method: "PUT", url: "/geo/workspace-state", headers: h(pid), payload: JSON.stringify(body) });
}

describe("GET/PUT /geo/workspace-state", () => {
  it("has no record before the first save", async () => {
    expect(await get(a)).toEqual({ projectId: a, record: null });
  });

  it("keeps each project's state apart and reopens it from another browser", async () => {
    const saved = await put(a, { clientId: "pc-1", state: state("Alpha chat", ["map.tif"]) });
    expect(saved.statusCode).toBe(200);
    expect((saved.json() as GeoWorkspaceStateSaved)).toMatchObject({ projectId: a, revision: 1 });
    expect((await put(b, { clientId: "pc-1", state: state("Beta chat") })).statusCode).toBe(200);

    // Another PC reads the same project: it gets the saved tabs and open files.
    const alpha = await get(a);
    expect(alpha.projectId).toBe(a);
    expect(alpha.record?.state).toEqual(state("Alpha chat", ["map.tif"]));
    expect(alpha.record?.clientId).toBe("pc-1");
    expect((await get(b)).record?.state).toEqual(state("Beta chat"));
    expect(fs.existsSync(workspaceStateFile(resolvePaths(a)))).toBe(true);
  });

  it("lets the last save win and counts revisions", async () => {
    await put(a, { clientId: "pc-1", state: state("first") });
    const second = await put(a, { clientId: "pc-2", state: state("second") });
    expect((second.json() as GeoWorkspaceStateSaved).revision).toBe(2);
    const record = (await get(a)).record;
    expect(record?.state).toEqual(state("second"));
    expect(record?.clientId).toBe("pc-2");
    expect(record?.revision).toBe(2);
  });

  it("refuses malformed bodies", async () => {
    expect((await put(a, { clientId: "pc-1", state: { tabs: "x" } })).statusCode).toBe(400);
    expect((await put(a, { clientId: "bad id!", state: state("x") })).statusCode).toBe(400);
    expect((await put(a, { state: state("x") })).statusCode).toBe(400);
    expect((await get(a)).record).toBeNull();
  });

  it("refuses a write to an unknown project and names the fallback project on a read", async () => {
    expect((await put("no-such-project", { clientId: "pc-1", state: state("x") })).statusCode).toBe(404);
    const res = await app.inject({ method: "GET", url: "/geo/workspace-state", headers: h("no-such-project") });
    expect(res.statusCode).toBe(200);
    // The project hook fell back to the default project; the reply says so.
    expect((res.json() as GeoWorkspaceStateResponse).projectId).not.toBe("no-such-project");
  });

  it("reports a malformed file without rewriting it", async () => {
    const file = workspaceStateFile(resolvePaths(a));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{not json");
    const res = await app.inject({ method: "GET", url: "/geo/workspace-state", headers: h(a) });
    expect(res.statusCode).toBe(409);
    expect((await put(a, { clientId: "pc-1", state: state("x") })).statusCode).toBe(409);
    expect(fs.readFileSync(file, "utf-8")).toBe("{not json");
  });
});
