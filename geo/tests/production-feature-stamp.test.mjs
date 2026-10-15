// Exercise the actual upstream launcher's build decision. The optional real
// smoke runs only in a recorded job snapshot; the regular suite uses fake npm.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readDistribution, resolveDistributionEnv } from "../start.mjs";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = fs.readFileSync(path.join(sourceRoot, "start.mjs"), "utf8");
const begin = source.indexOf("function productionBuildInputs()");
const end = source.indexOf("// ---- Step 5/6:", begin);
assert.ok(begin > 0 && end > begin, "production build function anchors remain present");

function launcher(root, env, real = false) {
  const builds = [];
  const messages = [];
  const context = vm.createContext({
    repoRoot: root, fs, path, crypto, process: { env },
    log: (text) => messages.push(text), sym: { ok: "ok", err: "error" },
    ISSUES_URL: "unused", fail: (message) => { throw new Error(message); },
    run: (command, args, options) => {
      builds.push({ command, args, feature: env.NEXT_PUBLIC_GAID_REMOTE_COMPUTE });
      if (real) {
        const result = spawnSync(command, args, { ...options, env, encoding: "utf8", timeout: 180_000 });
        process.stdout.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        assert.equal(result.error, undefined);
        return result.status;
      }
      fs.mkdirSync(path.join(root, "web/.next"), { recursive: true });
      fs.writeFileSync(path.join(root, "web/.next/BUILD_ID"), `fake-build-${builds.length}`);
      return 0;
    },
  });
  vm.runInContext(source.slice(begin, end), context);
  const ensure = () => vm.runInContext("ensureProductionBuild()", context);
  const stamp = () => JSON.parse(fs.readFileSync(path.join(root, "web/.next/launcher-build-stamp.json"), "utf8")).stamp;
  const id = () => fs.readFileSync(path.join(root, "web/.next/BUILD_ID"), "utf8");
  return { builds, messages, ensure, stamp, id };
}

function verifyFeatureOnlyRebuild(root, env, real = false) {
  const build = launcher(root, env, real);
  build.ensure();
  const before = { stamp: build.stamp(), buildId: build.id() };
  const initialBuilds = build.builds.length;
  build.ensure();
  assert.equal(build.builds.length, initialBuilds, "same inputs reuse the build");
  env.NEXT_PUBLIC_GAID_REMOTE_COMPUTE = env.NEXT_PUBLIC_GAID_REMOTE_COMPUTE === "false" ? "true" : "false";
  build.ensure();
  assert.equal(build.builds.length, initialBuilds + 1, "changing only the public feature value invokes npm run build");
  assert.notEqual(build.stamp(), before.stamp);
  assert.notEqual(build.id(), before.buildId);
  return { before, after: { stamp: build.stamp(), buildId: build.id() }, builds: build.builds };
}

test("production launcher rebuilds when only NEXT_PUBLIC_GAID_REMOTE_COMPUTE changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-feature-build-"));
  try {
    fs.mkdirSync(path.join(root, "web"));
    fs.writeFileSync(path.join(root, "web/page.tsx"), "unchanged UI source");
    const result = verifyFeatureOnlyRebuild(root, { NEXT_PUBLIC_GAID_REMOTE_COMPUTE: "false" });
    assert.deepEqual(result.builds.map((b) => b.feature), ["false", "true"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("real Next production feature-only rebuild in a recorded job snapshot", {
  skip: process.env.GAID_REAL_BUILD_SMOKE !== "1",
  timeout: 400_000,
}, () => {
  assert.equal(sourceRoot, path.resolve(process.env.TASK_SOURCE_DIR ?? ""), "real builds must stay in the job snapshot");
  const resolved = resolveDistributionEnv(readDistribution(), process.env, {
    root: sourceRoot, home: path.join(process.env.TASK_OUTPUT_DIR, "build-home"),
  });
  assert.deepEqual(resolved.problems, []);
  const env = { ...process.env, ...resolved.set };
  assert.equal(env.NEXT_PUBLIC_GAID_REMOTE_COMPUTE, "false");
  console.log("REAL_REMOTE_COMPUTE_REBUILD", JSON.stringify(verifyFeatureOnlyRebuild(sourceRoot, env, true)));
});
