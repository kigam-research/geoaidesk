import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listBackgroundWorkProviders } from "pi-subagents/background-work";
import { ensureProjectExists } from "../src/projects.ts";
import { createSession, disposeProjectSessions } from "../src/agent/session-registry.ts";
import { promptBudget } from "../src/geo/context.ts";
import { buildApp } from "../src/index.ts";
import { modalJobManager } from "../src/modal/manager.ts";
import { notebookRobustness } from "../src/agent/notebook-robustness.ts";
import { setModalCredentialValidatorForTests } from "../src/api/credentials.ts";
import { registerChildModal } from "../pi-packages/kady-modal/index.ts";
import { registerChildNotebook } from "../pi-packages/kady-notebook/index.ts";
import { kadyModalPackageDir, seedModalPackage } from "../src/agent/modal-bridge.ts";
import { buildCompactionPreamble } from "../src/agent/compaction-bridge.ts";

const projectId = "geo-remote-compute";
const off = () => { vi.stubEnv("GAID_DISTRIBUTION", "1"); vi.stubEnv("GAID_CATALOGUE", "on"); };
afterEach(async () => {
  await disposeProjectSessions(projectId);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setModalCredentialValidatorForTests(null);
});

describe("GAID remote compute off", () => {
  it("removes the seven lead tools and child/runtime bridges even for an existing project", async () => {
    vi.stubEnv("GAID_CATALOGUE", "off");
    const paths = ensureProjectExists(projectId);
    const before = await createSession(projectId, paths);
    const baseline = promptBudget(before, { mode: "all", exposed: 0, installed: 0 }).initialPrompt;
    const modalNames = before.getActiveToolNames().filter((name) => name.startsWith("modal_"));
    expect(modalNames).toHaveLength(7);
    expect(listBackgroundWorkProviders().some((p) => p.name.startsWith(`kady-modal:${projectId}:`))).toBe(true);
    await disposeProjectSessions(projectId);

    const settingsFile = path.join(paths.sandbox, ".pi/settings.json");
    expect(JSON.parse(fs.readFileSync(settingsFile, "utf8")).packages).toContain(kadyModalPackageDir());
    const oldData = path.join(paths.kadyDir, "modal", "retained.txt");
    fs.mkdirSync(path.dirname(oldData), { recursive: true });
    fs.writeFileSync(oldData, "retained job data");
    off();
    expect(seedModalPackage(paths)).toBe(false);
    const after = await createSession(projectId, paths);
    const gated = promptBudget(after, { mode: "all", exposed: 0, installed: 0 }).initialPrompt;
    expect(after.getActiveToolNames().some((name) => name.startsWith("modal_"))).toBe(false);
    expect(gated.tools).toBe(baseline.tools - 7);
    expect(gated.estimatedTokens).toBeLessThan(baseline.estimatedTokens);
    expect(after.systemPrompt).not.toContain("Stress-test finding");
    expect(JSON.stringify(after.getAllTools().map((t) => t.parameters))).not.toContain("Modal catalogue");
    expect(listBackgroundWorkProviders().some((p) => p.name.startsWith(`kady-modal:${projectId}:`))).toBe(false);
    expect(fs.readFileSync(oldData, "utf8")).toBe("retained job data");
    expect(buildCompactionPreamble(projectId, after.sessionId).text).not.toContain("Modal");
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = await buildApp();
    try {
      const listing = vi.spyOn(modalJobManager, "list");
      const fleet = await app.inject({ url: `/sessions/${after.sessionId}/subagents`, headers: { "x-project-id": projectId } });
      expect(fleet.statusCode).toBe(200);
      expect(fleet.json().compute).toEqual([]);
      expect(listing).not.toHaveBeenCalled();
    } finally { await app.close(); }
    const evidence = { before: baseline, after: gated };
    console.log("REMOTE_COMPUTE_PROMPT_BUDGET", JSON.stringify(evidence));
    if (process.env.TASK_OUTPUT_DIR) {
      fs.writeFileSync(path.join(process.env.TASK_OUTPUT_DIR, "remote-compute-prompt-budget.json"), JSON.stringify(evidence, null, 2) + "\n");
    }

    // An already-seeded ambient package or the foreground required runtime
    // reaches this same entry point; neither may register a Modal tool.
    const registerTool = vi.fn();
    registerChildModal({ registerTool } as never);
    expect(registerTool).not.toHaveBeenCalled();
    registerChildNotebook({ registerTool } as never);
    const notebook = registerTool.mock.calls[0][0];
    expect(notebook.parameters.properties).not.toHaveProperty("robustness");
    expect(notebook.promptGuidelines.join("\n")).not.toContain("Stress-test finding");
  }, 60_000);

  it("does not recover jobs, register remote APIs, or validate a token pair outbound", async () => {
    off();
    vi.stubEnv("LOG_LEVEL", "silent");
    const recover = vi.spyOn(modalJobManager, "recoverAllProjects").mockResolvedValue();
    const robustness = vi.spyOn(notebookRobustness, "recoverAll").mockResolvedValue();
    const validate = vi.fn();
    setModalCredentialValidatorForTests(validate);
    const app = await buildApp();
    try {
      expect(recover).not.toHaveBeenCalled();
      expect(robustness).not.toHaveBeenCalled();
      expect((await app.inject("/config")).json()).toMatchObject({ remote_compute_enabled: false, modal_configured: false });
      for (const url of ["/modal/instances", "/modal/jobs", "/modal/cache", "/sessions/old/notebook/hypothesis/robustness"]) {
        expect((await app.inject(url)).statusCode).toBe(404);
      }
      expect((await app.inject({ method: "PUT", url: "/credentials", payload: { modalTokenId: "token-id-valid-length", modalTokenSecret: "token-secret-valid-length" } })).statusCode).toBe(404);
      expect(validate).not.toHaveBeenCalled();
    } finally { await app.close(); }
  }, 60_000);
});
