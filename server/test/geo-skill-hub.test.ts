import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSkillHubPackage, previewSkillHub, readSkillHubSites, resolveSkillHubUrl, stageSkillHubPackage } from "../src/geo/skill-hub.ts";
import type { ProjectPaths } from "../src/projects.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";
import { previewSkillSource, installStagedSkills } from "../src/agent/skills-install.ts";
import { clearStaging, cacheKeyForSource } from "../src/agent/skills-fetch.ts";

const site = { id: "atlas", url: "https://kigam-research.github.io/skill-atlas/", packages: "api/catalog/packages" };
const page = `${site.url}#/skills/kigam/example`;
const skill = Buffer.from("---\nname: example\ndescription: A test skill.\n---\n\n# Example\n");
const archive = () => tarGz([{ path: "example/SKILL.md", data: skill }, { path: "example/scripts/check.sh", data: Buffer.from("echo ok\n"), mode: 0o755 }]);
let agentDir: string;
let sources: string[];
beforeEach(() => { agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-skill-hub-")); sources = []; });
afterEach(() => { for (const source of sources) clearStaging(cacheKeyForSource(source)); fs.rmSync(agentDir, { recursive: true, force: true }); });

it("reads sites from the distribution and maps skill pages with optional tabs", () => {
  expect(readSkillHubSites()).toContainEqual(site);
  expect(resolveSkillHubUrl(`${page}/files`, [site])).toMatchObject({ siteId: "atlas", skillId: "kigam/example", pageUrl: page, packageUrl: `${site.url}api/catalog/packages/kigam/example/example.tar.gz` });
});
it("rejects unconfigured origins/base paths, credential URLs, queries and malformed identifiers", () => {
  for (const url of [page.replace("https:", "http:"), page.replace("kigam-research.github.io", "evil.test"), page.replace("skill-atlas/", "other/"), page.replace("https://", "https://user@"), page.replace("/#", "/?x=1#"), page.replace("example", "../evil"), page.replace("example", "%2e%2e"), site.url, `${page}/files/extra`]) expect(() => resolveSkillHubUrl(url, [site])).toThrow();
});
it("bounds downloaded bytes even without content-length and refuses redirects", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(Buffer.from("1234")));
  await expect(downloadSkillHubPackage("https://example.test/package", fetcher, 3)).rejects.toMatchObject({ code: "size" });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
  await expect(downloadSkillHubPackage("https://example.test/package", vi.fn().mockResolvedValue(new Response("x", { headers: { "content-length": "100" } })), 3)).rejects.toMatchObject({ code: "size" });
  await expect(downloadSkillHubPackage("https://example.test/package", vi.fn().mockRejectedValue(new Error("redirect")))).rejects.toMatchObject({ code: "download" });
});
it("uses stable content-addressed sources, preserves scripts and refuses changed stored sources", () => {
  const bytes = archive();
  const first = stageSkillHubPackage(bytes, { agentDir });
  expect(stageSkillHubPackage(bytes, { agentDir })).toEqual(first);
  expect(first.source).toBe(path.join(agentDir, "skill-hub/packages", first.sha256));
  expect(fs.readFileSync(path.join(first.source, "example/SKILL.md"))).toEqual(skill);
  if (process.platform !== "win32") expect(fs.statSync(path.join(first.source, "example/scripts/check.sh")).mode & 0o111).not.toBe(0);
  fs.writeFileSync(path.join(first.source, "example/SKILL.md"), "modified");
  expect(() => stageSkillHubPackage(bytes, { agentDir })).toThrow(/modified/);
});
it("bounds compressed/expanded bytes and entry counts before staging", () => {
  for (const limits of [{ compressed: 1, expanded: 10000, entries: 10 }, { compressed: 10000, expanded: 100, entries: 10 }, { compressed: 10000, expanded: 10000, entries: 1 }]) expect(() => stageSkillHubPackage(archive(), { agentDir, limits })).toThrow(/limit/);
  expect(fs.readdirSync(agentDir)).toEqual([]);
});
describe("archive validation", () => {
  for (const bad of ["../escape", "/absolute", "example/../../escape", "example\\escape"]) it(`rejects ${bad}`, () => {
    expect(() => stageSkillHubPackage(tarGz([{ path: "example/SKILL.md", data: skill }, { path: bad, data: Buffer.from("x") }]), { agentDir })).toThrow(/unsafe/);
  });
  for (const type of ["1", "2", "3", "6"]) it(`rejects tar entry type ${type}`, () => {
    expect(() => stageSkillHubPackage(tarGz([{ path: "example/SKILL.md", data: skill }, { path: "example/link", type }]), { agentDir })).toThrow(/unsupported/);
  });
  it("rejects multiple roots, missing SKILL.md, duplicate paths and URL/package name mismatch", () => {
    for (const entries of [[{ path: "a/SKILL.md", data: skill }, { path: "b/SKILL.md", data: skill }], [{ path: "example/readme.md", data: skill }], [{ path: "example/SKILL.md", data: skill }, { path: "example/SKILL.md", data: skill }]]) expect(() => stageSkillHubPackage(tarGz(entries), { agentDir })).toThrow();
    expect(() => stageSkillHubPackage(archive(), { agentDir, expectedSlug: "wrong" })).toThrow();
  });
});
it("hands the validated durable directory and scope to the existing preview, with catalogue metadata", async () => {
  const preview = vi.fn<typeof previewSkillSource>().mockResolvedValue({ source: "filled below", stagingKey: "key", stagingToken: "token", skills: [{ name: "example", description: "test", installed: true, files: 2 }], problems: [] });
  const paths = {} as ProjectPaths;
  const result = await previewSkillHub(paths, { url: page, scope: "global" }, { sites: [site], agentDir, fetcher: vi.fn().mockResolvedValue(new Response(archive())), preview, catalogue: { available: true, skills: [{ id: "kigam/example", runtimeName: "example" }] } });
  expect(preview).toHaveBeenCalledWith(paths, { source: expect.stringContaining("/skill-hub/packages/"), scope: "global" });
  expect(result).toMatchObject({ stagingToken: "token", skillHub: { skillId: "kigam/example", pageUrl: page, catalogueNames: ["example"] } });
  await expect(previewSkillHub(paths, { archive: archive(), url: page }, { agentDir, preview })).rejects.toMatchObject({ code: "input" });
});
it("installs the same reviewed bytes through the real CLI gate, including cold staging recovery", async () => {
  const sandbox = path.join(agentDir, "sandbox");
  const paths = { id: "test", sandbox, kadyDir: path.join(sandbox, ".kady"), skillsDir: path.join(sandbox, ".pi/skills") } as ProjectPaths;
  const preview = await previewSkillHub(paths, { archive: archive() }, { agentDir, catalogue: { available: false, skills: [] } });
  sources.push(preview.source);
  expect(preview.skills.map((s) => s.name)).toEqual(["example"]);
  expect(fs.existsSync(path.join(paths.skillsDir, "example"))).toBe(false);
  await expect(installStagedSkills(paths, { source: preview.source, names: ["example"], stagingToken: preview.stagingToken })).rejects.toMatchObject({ status: 400 });
  clearStaging(preview.stagingKey);
  const result = await installStagedSkills(paths, { source: preview.source, names: ["example"], stagingToken: preview.stagingToken, acknowledged: true });
  expect(result.installed).toEqual(["example"]);
  expect(fs.readFileSync(path.join(paths.skillsDir, "example/SKILL.md"))).toEqual(skill);
}, 30_000);
