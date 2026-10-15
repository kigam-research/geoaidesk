// Deterministic checks of the GeoAIDesk distribution files (node:test, no dependencies).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { expectedTag } from "../release-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf-8"));
const distribution = readJson("geo/distribution.json");
const upstream = readJson("geo/upstream.lock.json");
const boundaries = readJson("geo/integration-boundaries.json");

test("distribution manifest names the product, version and release tag", () => {
  assert.equal(distribution.schema, "gaid-distribution/v1");
  assert.equal(distribution.productName, "GeoAIDesk");
  assert.equal(distribution.shortName, "GAID");
  assert.match(distribution.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(expectedTag(distribution), `geo-v${distribution.version}`);
  assert.equal(distribution.issuesUrl, `https://github.com/${distribution.repository}/issues`);
  for (const file of [...distribution.launch.entryPoints, ...distribution.launch.developmentLaunchers]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
  }
});

test("user-data paths are relative names under the data home", () => {
  assert.equal(distribution.dataHome.env, "GAID_HOME");
  for (const [name, rel] of Object.entries(distribution.dataHome.paths)) {
    assert.ok(!path.isAbsolute(rel) && !rel.split(/[\\/]/).includes(".."), `${name}=${rel}`);
  }
  for (const name of ["KADY_PROJECTS_ROOT", "KADY_PI_AGENT_DIR", "KADY_ENV_FILE", "KADY_SKILLS_CACHE_DIR"]) {
    assert.ok(name in distribution.dataHome.paths, `${name} is relocated`);
  }
});

test("unattended catalogue refresh is off and the document extras are excluded", () => {
  assert.equal(distribution.features.remoteCompute, false);
  assert.equal(distribution.environment.KADY_SKILLS_AUTO_SYNC, "0");
  const anthropic = distribution.catalogue.excludedSources.find((s) => s.repo === "anthropics/skills");
  assert.ok(anthropic, "anthropics/skills is excluded");
  assert.deepEqual([...anthropic.skills].sort(), ["docx", "pdf", "pptx", "xlsx"]);
  assert.ok(anthropic.reason.length > 20);
});

test("upstream lock matches the pinned harness and the Git history", () => {
  assert.match(upstream.commit, /^[0-9a-f]{40}$/);
  const pkg = readJson("server/package.json");
  for (const [name, version] of Object.entries(upstream.harness)) {
    assert.equal(pkg.dependencies[name], version, `${name} pin`);
  }
  for (const file of upstream.lockfiles) assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  if (git(["rev-parse", "--git-dir"]).status !== 0) return; // release archive without .git
  if (git(["cat-file", "-e", `${upstream.commit}^{commit}`]).status !== 0) return; // shallow clone
  assert.equal(git(["merge-base", "--is-ancestor", upstream.commit, "HEAD"]).status, 0, "base is in HEAD history");
  assert.equal(
    git(["show", `${upstream.commit}:server/package.json`]).stdout.match(/"version":\s*"([^"]+)"/)?.[1],
    upstream.packageVersion,
  );
});

test("integration boundaries list existing seams with an owner", () => {
  assert.equal(boundaries.schema, "gaid-integration-boundaries/v1");
  const owners = new Set([
    "upstream",
    "gaid-fork-base",
    "gaid-runtime",
    "gaid-well-tables",
    "gaid-maps",
    "gaid-korean-workspace",
    "gaid-release-proof",
    "gaid-map-tiles",
    "gaid-workflow-catalog",
    "gaid-ui-locale",
    "gaid-qwen-followups",
    "gaid-improve",
    "gaid-improve--source-preview",
    "gaid-qwen-authoring-trial",
    "gaid-brand-copy",
  ]);
  for (const seam of boundaries.seams) {
    assert.ok(owners.has(seam.owner), `${seam.path}: owner ${seam.owner}`);
    assert.ok(["edited", "replaced", "added", "unchanged"].includes(seam.status), seam.path);
    for (const file of seam.path.split(/,\s*/)) {
      assert.ok(fs.existsSync(path.join(root, file)), `${file} exists`);
    }
  }
});

test("upstream license and the fork notices are present", () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf-8");
  assert.match(license, /^MIT License/);
  assert.match(license, new RegExp(upstream.license.copyright.replace(/[()]/g, "\\$&")));
  const notice = fs.readFileSync(path.join(root, "NOTICE.md"), "utf-8");
  assert.match(notice, new RegExp(upstream.commit));
  assert.match(notice, /not affiliated with/);
  const thirdParty = fs.readFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf-8");
  for (const skill of ["docx", "pdf", "pptx", "xlsx"]) assert.match(thirdParty, new RegExp(`\`${skill}\``));
});

test("the catalogue download URL names the pinned archive on this repository's catalogue release", async () => {
  const { releaseTarget } = await import("../catalogue-release.mjs");
  const { tag, asset } = releaseTarget();
  assert.equal(asset, distribution.catalogue.archive);
  assert.equal(tag, `geo-catalogue-${distribution.catalogue.version}`);
  assert.ok(!tag.startsWith(distribution.releaseTagPrefix), "a catalogue tag is never read as an app release");
});
