/**
 * GAID hub packages: generated tree, the six checks, deterministic gaid-method/v1 archives verified by GAID's own
 * method reader, and installation through the existing gate (ported in part from skill_hub
 * web/server/authoring-package.test.ts at 54fe477; the /api/gaid feed and handoff tests are not ported).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { installPackage } from "../src/geo/authoring/install.ts";
import {
  archive,
  buildPackage,
  checkMethod,
  draftFiles,
  LOCAL_HUB_URL,
  type PackageContext,
} from "../src/geo/authoring/package.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import type { AuthoringStore } from "../src/geo/authoring/store.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { readMethodFile, verifyMethodTree } from "../src/geo/methods/method-file.ts";
import { listLocalMethods } from "../src/geo/methods/local-methods.ts";
import { readTarGz } from "../src/geo/tar.ts";
import { summarizeWorkflow } from "../src/geo/workspace/workflows.ts";
import { createProject, resolvePaths } from "../src/projects.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { MethodDraft } from "../../web/src/geo/contracts/authoring.ts";
import {
  analysis,
  cleanup,
  config,
  draftReply,
  fixture,
  reply,
  testVocabulary,
  work,
} from "./helpers/geo-authoring.ts";

afterEach(cleanup);

const deps = (content: unknown) => ({ chat: reply(content), config, vocabulary: testVocabulary() });

async function drafted(content: unknown = draftReply, withCode = false) {
  const f = await fixture();
  if (withCode) {
    const w = await work("authoring-pkg-");
    await mkdir(path.join(w, "repo/scripts"), { recursive: true });
    await writeFile(path.join(w, "repo/scripts/run.py"), "#!/usr/bin/env python3\nimport numpy\nprint('ok')\n");
    await writeFile(
      path.join(w, "repo/LICENSE"),
      'MIT License\n\nPermission is hereby granted, free of charge, to any person\nTHE SOFTWARE IS PROVIDED "AS IS"\n',
    );
    execFileSync("tar", ["-czf", path.join(w, "code.tar.gz"), "-C", w, "repo"]);
    await addSource(f.store, f.projectId, {
      name: "code.tar.gz",
      mediaType: "application/gzip",
      contentBase64: fs.readFileSync(path.join(w, "code.tar.gz")).toString("base64"),
    });
  }
  await runOperation(f.store, f.projectId, "analyze", "op-pkg-analyze", deps(analysis));
  const attempt = await runOperation(f.store, f.projectId, "draft", "op-pkg-draft", deps(content));
  expect(attempt.outcome, JSON.stringify(attempt.validationErrors)).toMatch(/accepted|repaired/);
  const project = await f.store.read(f.projectId);
  const ctx: PackageContext = { store: f.store, vocabulary: testVocabulary(), checker: "gaid-hub@test" };
  return { ...f, project, draft: project.drafts.at(-1)!, ctx };
}

const withCode = {
  ...draftReply,
  codeFiles: [{ source: "S2", sourcePath: "scripts/run.py" }],
  instructions: "# PU nested CV 방법\n\n`python <skill>/scripts/upstream/scripts/run.py`로 실행합니다.",
};

async function pack(store: AuthoringStore, projectId: string, draft: MethodDraft, ctx: PackageContext) {
  return store.mutate(projectId, async (p) => {
    const built = await buildPackage(p, draft, ctx);
    if ("record" in built) p.packages.push(built.record);
    return built;
  });
}

describe("GAID hub packages", () => {
  it("generates the skill tree with server-owned credits and anchored source/decision records", async () => {
    const { project, draft, ctx } = await drafted();
    const files = await draftFiles(project, draft, ctx);
    const skill = files.find((f) => f.path === "SKILL.md")!.content;
    expect(skill).toMatch(/^---\nname: "pu-nested-cv-method"\n/);
    expect(skill).toContain('version: "0.1.0"');
    const profile = parse(files.find((f) => f.path === "atlas.yaml")!.content);
    expect(profile.credits.publisher).toBe("local");
    expect(profile.release.state).toBe("draft");
    expect(files.find((f) => f.path === "references/sources.md")!.content).toContain("> spatial blocks of 50 km");
    expect(files.find((f) => f.path === "references/decisions.md")!.content).toContain(
      "Unresolved (no researcher answer).",
    );
    expect(files.some((f) => f.path.endsWith(".pdf"))).toBe(false);
  });

  it("checks taxonomy, claims, recipe conflicts, environments and the Workflow schema", async () => {
    const { project, draft, ctx } = await drafted();
    expect((await checkMethod(project, draft, ctx)).filter((f) => f.level === "error")).toEqual([]);
    const bad: MethodDraft = structuredClone(draft);
    bad.profile.inputs![0].semanticType = "no-such-type";
    bad.instructions += "\n\n이 방법은 published and validated by KIGAM.";
    bad.recipe = { choices: { "block-size": "km50" }, unresolvedChoices: ["block-size", "ghost"] };
    bad.workflow!.environmentProfile = "conda-anything";
    bad.workflow!.prompt = undefined as never;
    const findings = await checkMethod(project, bad, ctx);
    const codes = findings.map((f) => `${f.check}/${f.code}/${f.level}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        "taxonomy/taxonomy-unknown/error",
        "claims/unverified-claim/warning",
        "workflow/recipe-conflict/error",
        "workflow/recipe-choice/error",
        "workflow/environment/error",
        "workflow/workflow-schema/error",
      ]),
    );
  });

  it("blocks packages with missing files, repository or personal paths and undeclared imports", async () => {
    const { project, draft, ctx } = await drafted(withCode, true);
    expect(
      (await checkMethod(project, draft, ctx)).filter((f) => f.level === "error"),
      "clean draft",
    ).toEqual([]);
    const bad: MethodDraft = structuredClone(draft);
    bad.instructions +=
      "\n\n`python <skill>/scripts/missing.py`\n\nskills/other-skill/run.py\n\n/home/someone/data.csv";
    bad.profile.dependencies = [];
    const codes = (await checkMethod(project, bad, ctx)).filter((f) => f.level === "error").map((f) => f.code);
    expect(codes).toEqual(
      expect.arrayContaining(["package-file", "repo-relative-path", "personal-path", "undeclared-dependency"]),
    );
  });

  it("builds a schema-valid, deterministic single-root package that GAID's reader verifies", async () => {
    const { store, projectId, project, draft, ctx } = await drafted(withCode, true);
    const first = await buildPackage(project, draft, ctx);
    const second = await buildPackage(project, draft, ctx);
    if (!("record" in first) || !("record" in second)) throw new Error(JSON.stringify(first));
    expect(first.record.sha256).toBe(second.record.sha256);
    const bytes = await store.readFile(projectId, first.record.archive);
    const entries = readTarGz(bytes);
    expect(new Set(entries.map((e) => e.path.split("/")[0]))).toEqual(new Set(["pu-nested-cv-method"]));
    expect(entries.find((e) => e.path.endsWith("scripts/upstream/scripts/run.py"))?.mode).toBe(0o755);
    expect(entries.find((e) => e.path.endsWith("SKILL.md"))?.mode).toBe(0o644);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "authoring-unpack-"));
    try {
      for (const e of entries) {
        const target = path.join(dir, e.path);
        if (e.type === "directory") fs.mkdirSync(target, { recursive: true });
        else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, e.data);
        }
      }
      const skillDir = path.join(dir, "pu-nested-cv-method");
      const file = readMethodFile(skillDir, "pu-nested-cv-method");
      expect(file.issues).toEqual([]);
      expect(file.method).toMatchObject({
        revision: 1,
        lifecycle: "draft",
        implementation: "implemented",
        codeOrigin: "supplied",
      });
      expect(verifyMethodTree(skillDir, file.method!)).toEqual([]);
      const manifest = JSON.parse(fs.readFileSync(path.join(skillDir, "gaid-method.json"), "utf8"));
      expect(manifest.provenance.hub.url).toBe(LOCAL_HUB_URL);
      expect(manifest.recipes[0]).toMatchObject({
        workflowId: "pu-nested-cv-method",
        unresolvedChoices: ["block-size", "label-def"],
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // TaskSetup shows the options' display labels from the package.
    const withLabels = {
      ...(first.record.manifest as { workflows: Record<string, unknown>[] }).workflows[0],
      requiredScientificChoices: [
        { id: "block-size", label: { ko: "block 크기" }, options: ["km25", "km50"], optionLabels: { km50: { ko: "50 km" } } },
      ],
    };
    const summary = summarizeWorkflow(withLabels as never, {} as never);
    expect(summary.requiredScientificChoices[0].optionLabels).toEqual({ km50: { ko: "50 km" } });
    // Long names go through a PAX path record and still read back.
    const long = archive("x", [{ path: `${"d".repeat(120)}/f.txt`, content: "a", encoding: "utf8" }]);
    expect(readTarGz(long).map((e) => e.path)).toContain(`x/${"d".repeat(120)}/f.txt`);
  });

  it("omits workflows, recipes and code origin for a descriptive skill", async () => {
    const descriptive = { ...draftReply, kind: "foundation", workflow: null, recipe: null };
    const { project, draft, ctx } = await drafted(descriptive);
    const built = await buildPackage(project, draft, ctx);
    if (!("record" in built)) throw new Error(JSON.stringify(built.findings));
    const manifest = built.record.manifest as {
      workflows: unknown[];
      recipes: unknown[];
      implementation: string;
      codeOrigin?: string;
    };
    expect(manifest.workflows).toEqual([]);
    expect(manifest.recipes).toEqual([]);
    expect(manifest.implementation).toBe("descriptive");
    expect(manifest.codeOrigin).toBeUndefined();
  });

  it("installs through the gate as a GAID-hub draft and never replaces a foreign skill", async () => {
    const { store, projectId, draft, ctx } = await drafted();
    const built = await pack(store, projectId, draft, ctx);
    if (!("record" in built)) throw new Error(JSON.stringify(built.findings));
    const target = createProject({ name: "hub install test" });
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "authoring-agent-"));
    try {
      const project = await store.read(projectId);
      await expect(
        installPackage(
          store,
          project,
          built.record,
          { projectId: target.id, acknowledged: false as never },
          { agentDir },
        ),
      ).rejects.toMatchObject({ status: 400 });
      const result = await installPackage(
        store,
        project,
        built.record,
        { projectId: target.id, acknowledged: true },
        { agentDir },
      );
      expect(result).toMatchObject({ workflowId: "pu-nested-cv-method", recipeId: "pu-nested-cv-method-default" });
      expect(result.install.methodKey).toBe("project:pu-nested-cv-method");
      expect((await store.read(projectId)).installs).toHaveLength(1);
      const paths = resolvePaths(target.id);
      const catalogue = { index: { skills: [] }, environments: { environments: [] } } as unknown as GeoCatalogue;
      const methods = await listLocalMethods(
        paths,
        catalogue,
        { readiness: vi.fn() },
        {
          roots: [projectSkillRoot(paths)],
          store: path.join(agentDir, "skill-hub/packages"),
        },
      );
      expect(methods[0]).toMatchObject({
        runtimeName: "pu-nested-cv-method",
        lifecycle: "draft",
        origin: { kind: "gaid-hub" },
      });
      // Installing the same revision again replaces the GAID-hub copy.
      await installPackage(
        store,
        await store.read(projectId),
        built.record,
        { projectId: target.id, acknowledged: true },
        { agentDir },
      );
      // Bytecode caches left by a trial run are not edits: the reinstall still replaces the copy.
      const cache = path.join(projectSkillRoot(paths).skillsDir, "pu-nested-cv-method", "__pycache__");
      fs.mkdirSync(cache, { recursive: true });
      fs.writeFileSync(path.join(cache, "run.cpython-312.pyc"), "c");
      await installPackage(
        store,
        await store.read(projectId),
        built.record,
        { projectId: target.id, acknowledged: true },
        { agentDir },
      );
      // A researcher's edits to the installed copy are not overwritten by a reinstall.
      const installed = path.join(projectSkillRoot(paths).skillsDir, "pu-nested-cv-method", "SKILL.md");
      fs.appendFileSync(installed, "\n연구자가 고친 줄\n");
      await expect(
        installPackage(store, await store.read(projectId), built.record, { projectId: target.id, acknowledged: true }, { agentDir }),
      ).rejects.toMatchObject({ status: 409 });
      expect(fs.readFileSync(installed, "utf8")).toContain("연구자가 고친 줄");
      // A user skill of the same name is never overwritten.
      const other = createProject({ name: "foreign skill" });
      const otherPaths = resolvePaths(other.id);
      const foreign = path.join(projectSkillRoot(otherPaths).skillsDir, "pu-nested-cv-method");
      fs.mkdirSync(foreign, { recursive: true });
      fs.writeFileSync(path.join(foreign, "SKILL.md"), "---\nname: pu-nested-cv-method\ndescription: mine\n---\n");
      await expect(
        installPackage(
          store,
          await store.read(projectId),
          built.record,
          { projectId: other.id, acknowledged: true },
          { agentDir },
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(fs.readFileSync(path.join(foreign, "SKILL.md"), "utf8")).toContain("description: mine");
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
