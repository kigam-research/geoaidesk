import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
test("LAS numerical values, supported formats, gaps and display reduction", { timeout: 120_000 }, () => {
  const r = spawnSync("uv", ["run", "--frozen", "--project", path.join(root, "server/src/helpers"), "python", path.join(root, "geo/tests/las_helper_test.py")], { cwd: root, encoding: "utf8", timeout: 115_000 });
  assert.equal(r.status, 0, r.stderr || r.stdout || r.error?.message);
});
