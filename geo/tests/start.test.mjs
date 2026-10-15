// The GAID launcher's environment resolution (pure; no services started).
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { isInside, readDistribution, resolveDistributionEnv } from "../start.mjs";

const distribution = readDistribution();
const root = path.resolve("/opt/geoaidesk");
const home = path.resolve("/home/researcher");

test("the distribution launcher's effective remote-compute feature reaches the UI build", () => {
  const resolve = (manifest, env = {}) => resolveDistributionEnv(manifest, env, { root, home }).set;
  assert.equal(resolve(distribution).GAID_DISTRIBUTION, "1");
  assert.equal(resolve(distribution).NEXT_PUBLIC_GAID_REMOTE_COMPUTE, "false");
  for (const env of [{ GAID_CATALOGUE: "off" }, { KADY_SKILLS_REPO: "other/skills" }]) {
    assert.equal(resolve(distribution, env).NEXT_PUBLIC_GAID_REMOTE_COMPUTE, "true");
  }
  assert.equal(resolve({ ...distribution, features: undefined }).NEXT_PUBLIC_GAID_REMOTE_COMPUTE, "true");
  assert.equal(resolve({ ...distribution, features: { remoteCompute: true } }).NEXT_PUBLIC_GAID_REMOTE_COMPUTE, "true");
});

test("defaults put every user-data path under ~/.geoaidesk", () => {
  const { set, problems, dataHome } = resolveDistributionEnv(distribution, {}, { root, home });
  assert.deepEqual(problems, []);
  assert.equal(dataHome, path.join(home, ".geoaidesk"));
  assert.equal(set.KADY_PROJECTS_ROOT, path.join(dataHome, "projects"));
  assert.equal(set.KADY_PI_AGENT_DIR, path.join(dataHome, "pi-agent"));
  assert.equal(set.KADY_ENV_FILE, path.join(dataHome, "config.env"));
  assert.equal(set.KADY_SKILLS_AUTO_SYNC, "0");
  assert.equal(set.KADY_PRODUCT_NAME, "GeoAIDesk");
  for (const value of Object.values(set)) {
    if (path.isAbsolute(value)) assert.ok(!isInside(root, value), value);
  }
});

test("GAID_HOME and explicit variables win over the defaults", () => {
  const env = { GAID_HOME: "~/research/gaid", KADY_PROJECTS_ROOT: "/data/projects", KADY_SKILLS_AUTO_SYNC: "1" };
  const { set, problems } = resolveDistributionEnv(distribution, env, { root, home });
  assert.deepEqual(problems, []);
  assert.equal(set.GAID_HOME, path.join(home, "research", "gaid"));
  assert.equal(set.KADY_PI_AGENT_DIR, path.join(home, "research", "gaid", "pi-agent"));
  assert.ok(!("KADY_PROJECTS_ROOT" in set));
  assert.ok(!("KADY_SKILLS_AUTO_SYNC" in set));
});

test("user data inside the source checkout is refused", () => {
  const inside = resolveDistributionEnv(distribution, { GAID_HOME: path.join(root, "data") }, { root, home });
  assert.equal(inside.problems.length, 1 + Object.keys(distribution.dataHome.paths).length);
  const relative = resolveDistributionEnv(distribution, { KADY_PROJECTS_ROOT: "projects" }, { root, home });
  assert.deepEqual(relative.problems, [`KADY_PROJECTS_ROOT=${path.join(root, "projects")} is inside the source checkout ${root}`]);
});

test("a non-default backend port reaches the UI build", () => {
  const { set } = resolveDistributionEnv(distribution, { KADY_PORT: "8123" }, { root, home });
  assert.equal(set.NEXT_PUBLIC_ADK_API_URL, "http://localhost:8123");
  const pinned = resolveDistributionEnv(distribution, { KADY_PORT: "8123", NEXT_PUBLIC_ADK_API_URL: "http://x:1" }, { root, home });
  assert.ok(!("NEXT_PUBLIC_ADK_API_URL" in pinned.set));
});

test("isInside compares path segments, not prefixes", () => {
  assert.ok(isInside("/a/b", "/a/b"));
  assert.ok(isInside("/a/b", "/a/b/c"));
  assert.ok(!isInside("/a/b", "/a/bc"));
  assert.ok(!isInside("/a/b", "/a"));
});

// Catalogue download (gaid-runtime#2): planned only when no searched place has the archive.
test("the catalogue is downloaded into the data home only when no searched place has it", async () => {
  const { planCatalogue } = await import("../start.mjs");
  const env = { GAID_HOME: path.join(home, ".geoaidesk") };
  const target = path.join(home, ".geoaidesk", "catalogue", distribution.catalogue.archive);
  const missing = planCatalogue(distribution, env, { root, home, exists: () => false });
  assert.deepEqual(missing, {
    action: "download",
    url: distribution.catalogue.download.url,
    target,
    sha256: distribution.catalogue.sha256,
  });
  assert.match(distribution.catalogue.download.url, /^https:\/\/github\.com\/kigam-research\/geoaidesk\/releases\/download\//);
  assert.ok(distribution.catalogue.download.url.endsWith(`/${distribution.catalogue.archive}`));
  const asset = path.join(home, "assets", "geo-catalogue", distribution.catalogue.version, distribution.catalogue.archive);
  assert.deepEqual(planCatalogue(distribution, env, { root, home, exists: (p) => p === asset }), { action: "present", path: asset });
  assert.equal(planCatalogue(distribution, { ...env, GAID_CATALOGUE: "off" }, { root, home, exists: () => false }).action, "none");
  assert.equal(planCatalogue(distribution, { ...env, KADY_SKILLS_REPO: "o/r" }, { root, home, exists: () => false }).action, "none");
  assert.equal(planCatalogue(distribution, { ...env, GAID_CATALOGUE_DOWNLOAD: "0" }, { root, home, exists: () => false }).action, "none");
  assert.equal(planCatalogue(distribution, { ...env, GAID_CATALOGUE_URL: "file:///m/c.tgz" }, { root, home, exists: () => false }).url, "file:///m/c.tgz");
});

test("a downloaded catalogue is kept only when its sha256 matches the pin", async () => {
  const crypto = await import("node:crypto");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const { pathToFileURL } = await import("node:url");
  const { downloadCatalogue } = await import("../start.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-cat-"));
  try {
    const source = path.join(dir, "source.tar.gz");
    fs.writeFileSync(source, "archive bytes");
    const sha256 = crypto.createHash("sha256").update("archive bytes").digest("hex");
    const target = path.join(dir, "home", "catalogue", "c.tar.gz");
    await downloadCatalogue({ url: pathToFileURL(source).href, target, sha256 });
    assert.equal(fs.readFileSync(target, "utf-8"), "archive bytes");
    fs.rmSync(target);
    await assert.rejects(downloadCatalogue({ url: pathToFileURL(source).href, target, sha256: "0".repeat(64) }), /does not match/);
    const fetchImpl = async () => new Response("archive bytes");
    await downloadCatalogue({ url: "https://example.invalid/c.tar.gz", target, sha256 }, { fetchImpl });
    assert.equal(fs.readFileSync(target, "utf-8"), "archive bytes");
    const notFound = async () => new Response("no", { status: 404 });
    fs.rmSync(target);
    await assert.rejects(downloadCatalogue({ url: "https://example.invalid/c", target, sha256 }, { fetchImpl: notFound }), /HTTP 404/);
    assert.deepEqual(fs.readdirSync(path.dirname(target)), [], "no partial file left behind");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
