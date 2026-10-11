import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { DEFAULT_PROJECT_ID, PROJECTS_ROOT } from "../src/config.ts";
import { ensureProjectExists, type ProjectPaths } from "../src/projects.ts";
import { hashDirectory, recordSkillOrigin } from "../src/agent/skills-sync.ts";
import { createSession, disposeProjectSessions, getSession } from "../src/agent/session-registry.ts";
import {
  runtimeSupportSkillNames,
  applyExposure,
  exposedSkillNames,
  exposureModeIssue,
  promptBudget,
  readProjectContext,
  readSessionExposure,
  resolveSessionExposure,
  writeProjectContext,
} from "../src/geo/context.ts";
import { registerGeoCatalogueRoutes } from "../src/geo/routes/catalogue.ts";

const PROJECT = DEFAULT_PROJECT_ID;

function writeSkill(paths: ProjectPaths, name: string, description: string): string {
  const dir = path.join(paths.skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  return dir;
}

let paths: ProjectPaths;
beforeEach(() => {
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  paths = ensureProjectExists(PROJECT);
});
afterEach(async () => {
  await disposeProjectSessions(PROJECT);
});
afterAll(() => fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true }));

describe("exposure records", () => {
  it("validates modes", () => {
    expect(exposureModeIssue("all")).toBeNull();
    expect(exposureModeIssue("catalogue")).toBeNull();
    expect(exposureModeIssue("workflow:well-log-qc")).toBeNull();
    expect(exposureModeIssue("workflow:../x")).toMatch(/invalid workflow id/);
    expect(exposureModeIssue("everything")).toMatch(/must be/);
  });

  it("records a new chat once and leaves chats with history unchanged", () => {
    writeSkill(paths, "alpha", "Alpha skill.");
    recordSkillOrigin(paths, "alpha", { origin: "local" });
    writeProjectContext(paths, { newChatExposure: "catalogue" });
    expect(resolveSessionExposure(paths, "legacy-chat", { isNew: false })).toBeNull();
    const fresh = resolveSessionExposure(paths, "new-chat", { isNew: true });
    expect(fresh).toMatchObject({ mode: "catalogue", skills: ["alpha", ...runtimeSupportSkillNames()].sort() });
    // A later project default does not rewrite an existing chat's set.
    writeProjectContext(paths, { newChatExposure: "all" });
    expect(resolveSessionExposure(paths, "new-chat", { isNew: false })).toMatchObject({ mode: "catalogue" });
    expect(readProjectContext(paths).newChatExposure).toBe("all");
  });

  it("maps a workflow's Atlas ids to runtime names", () => {
    const catalogue = {
      index: { skills: [{ id: "kigam/well-log-qc-quicklook", runtimeName: "well-log-qc-quicklook" }] },
      workflows: [{ id: "well-log-qc", skillIds: ["kigam/well-log-qc-quicklook", "kigam/not-shipped"] }],
      manifest: { runtimeSkills: [] },
    } as unknown as Parameters<typeof exposedSkillNames>[2];
    const support = runtimeSupportSkillNames();
    expect(support).toContain("pi-subagents");
    expect(exposedSkillNames(paths, "workflow:well-log-qc", catalogue)).toEqual(
      [...support, "well-log-qc-quicklook"].sort(),
    );
    expect(exposedSkillNames(paths, "workflow:unknown", catalogue)).toEqual(support);
    expect(exposedSkillNames(paths, "all", catalogue)).toBeUndefined();
  });

  it("hides non-exposed skills from the model without touching them", () => {
    const skills = [
      { name: "a", disableModelInvocation: false },
      { name: "b", disableModelInvocation: false },
      { name: "c", disableModelInvocation: true },
    ];
    const out = applyExposure(skills, {
      schemaVersion: "gaid-exposure/v1",
      mode: "catalogue",
      skills: ["a", "c"],
      recordedAt: "",
    });
    expect(out.map((s) => [s.name, s.disableModelInvocation])).toEqual([
      ["a", false],
      ["b", true],
      ["c", true],
    ]);
    expect(skills[1].disableModelInvocation).toBe(false);
    expect(applyExposure(skills, null)).toBe(skills);
  });
});

describe("exposure in a live Pi session", () => {
  it("offers only the exposed skills, keeps files intact, and survives reopening", async () => {
    const alpha = writeSkill(paths, "alpha-geo", "ALPHA_MARKER exposed skill.");
    const beta = writeSkill(paths, "beta-bio", "BETA_MARKER hidden skill.");
    recordSkillOrigin(paths, "alpha-geo", { origin: "local" });
    const before = [hashDirectory(alpha), hashDirectory(beta)];
    writeProjectContext(paths, { newChatExposure: "catalogue" });

    const session = await createSession(PROJECT, paths);
    expect(session.systemPrompt).toContain("ALPHA_MARKER");
    expect(session.systemPrompt).not.toContain("BETA_MARKER");
    expect(readSessionExposure(paths, session.sessionId)).toMatchObject({
      mode: "catalogue",
      skills: ["alpha-geo", ...runtimeSupportSkillNames()].sort(),
    });
    expect([hashDirectory(alpha), hashDirectory(beta)]).toEqual(before);

    session.sessionManager.appendMessage({ role: "user", content: "keep this chat on disk", timestamp: Date.now() });
    const budget = promptBudget(session, { mode: "catalogue", exposed: 1, installed: 2 });
    expect(budget.initialPrompt.estimatedTokens).toBeGreaterThan(1000);
    expect(budget.initialPrompt.tools).toBeGreaterThan(5);
    expect(budget.model?.contextWindow).toBeGreaterThan(0);
    expect(budget.remainingTokens).toBe(
      budget.model!.contextWindow - budget.initialPrompt.estimatedTokens - budget.model!.maxOutputTokens,
    );

    // Reopened after the project default changed: the recorded set still applies.
    writeProjectContext(paths, { newChatExposure: "all" });
    const id = session.sessionId;
    await disposeProjectSessions(PROJECT);
    const reopened = await getSession(PROJECT, paths, id);
    expect(reopened?.systemPrompt).toContain("ALPHA_MARKER");
    expect(reopened?.systemPrompt).not.toContain("BETA_MARKER");
  }, 60_000);

  it("leaves a chat created before exposure existed unchanged", async () => {
    writeSkill(paths, "alpha-geo", "ALPHA_MARKER exposed skill.");
    writeSkill(paths, "beta-bio", "BETA_MARKER hidden skill.");
    writeProjectContext(paths, { newChatExposure: "catalogue" });
    fs.mkdirSync(paths.sessionsDir, { recursive: true });
    const manager = SessionManager.create(paths.sandbox, paths.sessionsDir);
    manager.appendMessage({ role: "user", content: "An older conversation", timestamp: Date.now() });
    const legacy = await getSession(PROJECT, paths, manager.getSessionId());
    expect(legacy?.systemPrompt).toContain("ALPHA_MARKER");
    expect(legacy?.systemPrompt).toContain("BETA_MARKER");
    expect(readSessionExposure(paths, manager.getSessionId())).toBeNull();
  }, 60_000);

  it("serves the budget and settings over HTTP", async () => {
    writeSkill(paths, "alpha-geo", "ALPHA_MARKER exposed skill.");
    const app = Fastify();
    await registerGeoCatalogueRoutes(app);
    const bad = await app.inject({ method: "PUT", url: "/geo/context/settings", payload: { newChatExposure: "x" } });
    expect(bad.statusCode).toBe(400);
    const put = await app.inject({ method: "PUT", url: "/geo/context/settings", payload: { newChatExposure: "catalogue" } });
    expect(put.json()).toMatchObject({ newChatExposure: "catalogue" });
    const session = await createSession(PROJECT, paths);
    const res = await app.inject({ method: "GET", url: `/geo/context?sessionId=${session.sessionId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.exposure.mode).toBe("catalogue");
    expect(body.budget.schemaVersion).toBe("gaid-prompt-budget/v1");
    // alpha-geo plus the runtime support skills seeded with the first session.
    expect(body.budget.skills).toMatchObject({ mode: "catalogue", installed: 1 + runtimeSupportSkillNames().length });
    expect((await app.inject({ method: "GET", url: "/geo/context" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/geo/context?sessionId=nope" })).statusCode).toBe(404);
    // Preview of a chat not created yet: measured, then disposed without a trace.
    const exposureDir = path.join(paths.kadyDir, "geo", "exposure");
    const recordsBefore = fs.readdirSync(exposureDir).sort();
    const sessionsBefore = fs.existsSync(paths.sessionsDir) ? fs.readdirSync(paths.sessionsDir).sort() : [];
    const preview = await app.inject({ method: "GET", url: "/geo/context/preview" });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().exposure).toMatchObject({ mode: "catalogue", preview: true });
    expect(preview.json().budget.initialPrompt.estimatedTokens).toBeGreaterThan(1000);
    expect(fs.readdirSync(exposureDir).sort()).toEqual(recordsBefore);
    expect(fs.existsSync(paths.sessionsDir) ? fs.readdirSync(paths.sessionsDir).sort() : []).toEqual(sessionsBefore);
    const catalogue = await app.inject({ method: "GET", url: "/geo/catalogue" });
    expect(catalogue.json().status.state).toBe("off");
    await app.close();
  }, 60_000);
});
