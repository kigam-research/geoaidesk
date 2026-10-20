import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCliZip, projectCliSource } from "../src/geo/cli-export.ts";
import { registerGeoCliExportRoutes } from "../src/geo/routes/cli-export.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { ProjectPaths } from "../src/projects.ts";
import type { SharedHubStore, StoredEntry } from "../src/geo/hub-shared/store.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";

let root: string, paths: ProjectPaths, catalogue: GeoCatalogue;
const label = { ko: "자료 점검", en: "Inspect data" };
const workflow = { schemaVersion: "geo-workflow/v1", id: "inspect-data", title: label, skillIds: ["kigam/inspect"], environmentProfile: "geo-core", prompt: label };
const skill = "---\nname: inspect\ndescription: Inspect a data file.\n---\n# Skill\n";
const put = (rel: string, data: string) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-cli-"));
  paths = { id: "test", sandbox: path.join(root, "sandbox"), skillsDir: path.join(root, "sandbox/.pi/skills") } as ProjectPaths;
  fs.mkdirSync(paths.skillsDir, { recursive: true });
  put("catalogue/runtime/skills/inspect/SKILL.md", skill);
  put("catalogue/runtime/skills/inspect/scripts/check.sh", "echo inspected\n");
  fs.chmodSync(path.join(root, "catalogue/runtime/skills/inspect/scripts/check.sh"), 0o755);
  put("catalogue/private.txt", "not a skill file");
  catalogue = { root: path.join(root, "catalogue"), workflows: [structuredClone(workflow)], index: { skills: [{ id: "kigam/inspect", runtimeName: "inspect", title: label, packageRef: "runtime/skills/inspect" }] } } as unknown as GeoCatalogue;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("CLI export routes", () => {
  for (const target of ["pi", "claude"] as const) it(`exports pinned catalogue skills and the shared CLI document for ${target}`, async () => {
    const app = Fastify();
    await registerGeoCliExportRoutes(app, { paths: () => paths, catalogue: () => catalogue });
    const response = await app.inject(`/geo/workflows/inspect-data/cli-export?target=${target}&locale=en`);
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/zip");
    expect(response.headers["content-disposition"]).toContain(`inspect-data-${target}.zip`);
    const zip = new AdmZip(response.rawPayload);
    const base = target === "pi" ? ".pi" : ".claude";
    expect(zip.getEntries().map(e => e.entryName).sort()).toEqual([
      `${base}/${target === "pi" ? "prompts" : "commands"}/inspect-data.md`, `${base}/skills/inspect/SKILL.md`, `${base}/skills/inspect/scripts/check.sh`, "README.md",
    ].sort());
    const command = zip.readAsText(`${base}/${target === "pi" ? "prompts" : "commands"}/inspect-data.md`);
    expect(command).toContain("$ARGUMENTS");
    expect(command).toContain("Inspect data");
    expect(command).not.toContain(root);
    expect(zip.getEntry(`${base}/skills/inspect/scripts/check.sh`)!.attr >>> 16 & 0o111).toBe(0o111);
    expect(zip.readAsText("README.md")).toContain("## 한국어");
    expect(zip.readAsText("README.md")).toContain("## English");
    await app.close();
  });
  it("resolves an installed method without including unrelated project files", async () => {
    put("sandbox/.pi/skills/bundled/SKILL.md", skill.replace("name: inspect", "name: bundled"));
    put("sandbox/.pi/skills/bundled/gaid-method.json", JSON.stringify({ schemaVersion: "gaid-method/v1", methodId: "local/bundled", revision: 2, lifecycle: "draft", implementation: "descriptive", title: label, workflows: [{ ...workflow, skillIds: ["local:bundled"] }] }));
    put("sandbox/other.md", "unrelated");
    const app = Fastify();
    await registerGeoCliExportRoutes(app, { paths: () => paths, catalogue: () => catalogue });
    const response = await app.inject("/geo/workflows/inspect-data/cli-export?target=pi&method=bundled");
    expect(response.statusCode).toBe(200);
    expect(new AdmZip(response.rawPayload).readAsText(".pi/skills/bundled/SKILL.md")).toContain("name: bundled");
    expect(new AdmZip(response.rawPayload).getEntries().some(e => e.entryName.includes("other.md"))).toBe(false);
    await app.close();
  });
  it("exports the latest registered immutable hub package without installing it", async () => {
    const archive = tarGz([{ path: "bundled/SKILL.md", data: Buffer.from(skill.replace("name: inspect", "name: bundled")) }]);
    const record = { entry: { latestRevision: 3 }, snapshots: { 3: { draft: { slug: "bundled", workflow: { ...workflow, skillIds: ["local:bundled", "kigam/inspect"] }, profile: {} }, package: { size: archive.length, sha256: createHash("sha256").update(archive).digest("hex") } } } } as unknown as StoredEntry;
    const store = { read: async () => record, bytes: async (_id: string, file: string) => { expect(file).toBe("packages/3.tar.gz"); return archive; } } as SharedHubStore;
    const app = Fastify();
    await registerGeoCliExportRoutes(app, { paths: () => paths, catalogue: () => catalogue, store });
    const response = await app.inject("/geo/hub/entries/entry-abc/cli-export?target=claude");
    expect(response.statusCode).toBe(200);
    const zip = new AdmZip(response.rawPayload);
    expect(zip.readAsText(".claude/skills/bundled/SKILL.md")).toContain("bundled");
    expect(zip.readAsText(".claude/skills/inspect/SKILL.md")).toContain("inspect");
    expect(fs.readdirSync(paths.skillsDir)).toEqual([]);
    await app.close();
  });
  it("notes absent imported skills and copies only the installed project copy when present", () => {
    const imported = { schemaVersion: "gaid-workflow/v1", skills: [{ name: "external", source: "imported", ref: "owner/repo", role: "supporting" }], steps: [{ id: "step", title: label, does: label, checks: [], choiceIds: [], outputs: [], skill: "external" }] };
    Object.assign(catalogue.workflows[0], imported);
    const source = projectCliSource(paths, catalogue, workflow.id);
    expect(source.missing).toEqual(["external"]);
    expect(new AdmZip(buildCliZip(source, "pi", "ko")).readAsText("README.md")).toContain("- external");
    put("sandbox/.pi/skills/external/SKILL.md", skill);
    expect(projectCliSource(paths, catalogue, workflow.id).files.has("external")).toBe(true);
  });
  it("rejects unverified targets and unknown Workflows", async () => {
    const app = Fastify();
    await registerGeoCliExportRoutes(app, { paths: () => paths, catalogue: () => catalogue });
    expect((await app.inject("/geo/workflows/inspect-data/cli-export?target=codex")).statusCode).toBe(400);
    expect((await app.inject("/geo/workflows/missing/cli-export?target=pi")).statusCode).toBe(404);
    expect((await app.inject("/geo/workflows/inspect-data/cli-export?target=pi&locale=fr")).statusCode).toBe(400);
    await app.close();
  });
  it("rejects links inside and above the skill tree, oversized exports and unsafe file names", () => {
    const source = projectCliSource(paths, catalogue, workflow.id);
    for (const limits of [{ compressed: 1, expanded: 1e6, entries: 100 }, { compressed: 1e6, expanded: 1, entries: 100 }, { compressed: 1e6, expanded: 1e6, entries: 1 }])
      expect(() => buildCliZip(source, "pi", "ko", limits)).toThrow(/limit/);
    source.files.get("inspect")!.push({ path: "../escape", data: Buffer.from("x"), mode: 0o644 });
    expect(() => buildCliZip(source, "pi", "ko")).toThrow(/unsafe/);
    fs.symlinkSync(path.join(root, "catalogue/private.txt"), path.join(root, "catalogue/runtime/skills/inspect/link"));
    expect(() => projectCliSource(paths, catalogue, workflow.id)).toThrow(/links/);
    fs.unlinkSync(path.join(root, "catalogue/runtime/skills/inspect/link"));
    fs.renameSync(path.join(root, "catalogue/runtime/skills"), path.join(root, "catalogue/runtime/moved"));
    fs.symlinkSync(path.join(root, "catalogue/runtime/moved"), path.join(root, "catalogue/runtime/skills"));
    expect(() => projectCliSource(paths, catalogue, workflow.id)).toThrow(/links/);
  });
  for (const bad of ["../escape", "/absolute", "bundled/link"]) it(`refuses unsafe registered archive ${bad}`, async () => {
    const archive = tarGz([{ path: "bundled/SKILL.md", data: Buffer.from(skill) }, { path: bad, type: bad.endsWith("link") ? "2" : "0", data: Buffer.from("x") }]);
    const store = { read: async () => ({ entry: { latestRevision: 1 }, snapshots: { 1: { draft: { slug: "bundled", workflow }, package: { size: archive.length, sha256: createHash("sha256").update(archive).digest("hex") } } } }), bytes: async () => archive } as unknown as SharedHubStore;
    const app = Fastify();
    await registerGeoCliExportRoutes(app, { paths: () => paths, catalogue: () => catalogue, store });
    expect((await app.inject("/geo/hub/entries/entry-abc/cli-export?target=pi")).statusCode).toBe(409);
    await app.close();
  });
});
