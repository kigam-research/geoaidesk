// The GAID launcher's environment resolution (pure; no services started).
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { isInside, readDistribution, resolveDistributionEnv } from "../start.mjs";

const distribution = readDistribution();
const root = path.resolve("/opt/geoaidesk");
const home = path.resolve("/home/researcher");

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
