// geo/compatibility.json: what a release may claim (skill_hub docs/specs/gaid-product.md section 4).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf-8"));
const compatibility = read("geo/compatibility.json");
const distribution = read("geo/distribution.json");
const OUTCOMES = new Set(["passed", "failed", "partial", "skipped", "not-run"]);
const ENV_STATUS = new Set(["tested", "partial", "failed", "not-run", "untested"]);
const SHA = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function checkRecord(record, where) {
  assert.equal(typeof record.locator, "string", `${where}.locator`);
  assert.match(record.sha256, SHA, `${where}.sha256`);
  assert.match(record.date, DATE, `${where}.date`);
  assert.ok(OUTCOMES.has(record.result), `${where}.result ${record.result}`);
}

test("the compatibility file names this app version", () => {
  assert.equal(compatibility.schema, "gaid-compatibility/v1");
  assert.equal(compatibility.appVersion, distribution.version);
  assert.match(compatibility.updatedAt, DATE);
});

test("an environment status follows its records", () => {
  const ids = new Set();
  for (const env of compatibility.environments) {
    assert.ok(!ids.has(env.id), `duplicate ${env.id}`);
    ids.add(env.id);
    assert.ok(ENV_STATUS.has(env.status), `${env.id}: status ${env.status}`);
    env.records.forEach((record, i) => checkRecord(record, `${env.id}.records[${i}]`));
    if (env.status === "tested") {
      assert.ok(env.records.some((r) => r.kind === "install" && r.result === "passed"), `${env.id}: tested needs a passed install record`);
    }
    if (env.status === "untested" || env.status === "not-run") assert.equal(env.records.length, 0, `${env.id}: records but ${env.status}`);
  }
  for (const id of ["linux-x64", "windows-wsl2", "windows-native", "macos-arm64", "macos-x64"]) assert.ok(ids.has(id), id);
});

test("a model route is advertised only with a passed connection and a passed task for this version", () => {
  for (const route of compatibility.modelRoutes) {
    assert.ok(OUTCOMES.has(route.connection.outcome), `${route.id}: connection outcome`);
    if (route.connection.outcome !== "not-run") {
      assert.match(route.connection.testedAt, DATE, `${route.id}: connection.testedAt`);
      checkRecord(route.connection.record, `${route.id}.connection.record`);
    }
    for (const [i, task] of route.tasks.entries()) {
      assert.equal(typeof task.workflowId, "string", `${route.id}.tasks[${i}].workflowId`);
      assert.ok(OUTCOMES.has(task.outcome), `${route.id}.tasks[${i}].outcome`);
      if (task.outcome !== "not-run") checkRecord(task.record, `${route.id}.tasks[${i}].record`);
    }
    if (route.advertised) {
      assert.equal(route.connection.outcome, "passed", `${route.id}: advertised without a passed connection`);
      assert.ok(route.tasks.some((t) => t.outcome === "passed"), `${route.id}: advertised without a passed task`);
      assert.match(route.documentationCheckedAt ?? "", DATE, `${route.id}: advertised without a documentation check`);
    }
    if (route.accountRoute !== "local" && route.connection.outcome !== "not-run") {
      assert.ok(route.requestedBy, `${route.id}: a paid or subscription run records who requested it`);
    }
  }
});
