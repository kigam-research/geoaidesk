// geo/win-fs-shim.mjs: the JavaScript replacements match Node's rmSync/cpSync on the cases GAID uses.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cpSyncJs, installWinFsShim, rmSyncJs } from "../win-fs-shim.mjs";
import { windowsNodeOptions } from "../start.mjs";

function tree(root) {
  fs.mkdirSync(path.join(root, "sub", "deep"), { recursive: true });
  fs.writeFileSync(path.join(root, "a.txt"), "a");
  fs.writeFileSync(path.join(root, "sub", "deep", "b.txt"), "b");
}
const list = (root) =>
  fs.readdirSync(root, { recursive: true }).map((p) => p.split(path.sep).join("/")).sort();

test("rmSyncJs removes trees and follows force/recursive", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-shim-한글 "));
  try {
    const target = path.join(dir, "t");
    tree(target);
    assert.throws(() => rmSyncJs(target), { code: "ERR_FS_EISDIR" });
    rmSyncJs(path.join(target, "a.txt"));
    rmSyncJs(target, { recursive: true });
    assert.equal(fs.existsSync(target), false);
    assert.throws(() => rmSyncJs(target, { recursive: true }), { code: "ENOENT" });
    rmSyncJs(target, { recursive: true, force: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cpSyncJs copies trees like cpSync, with filter, force and errorOnExist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-shim-한글 "));
  try {
    const src = path.join(dir, "src");
    tree(src);
    cpSyncJs(src, path.join(dir, "js"), { recursive: true });
    fs.cpSync(src, path.join(dir, "node"), { recursive: true });
    assert.deepEqual(list(path.join(dir, "js")), list(path.join(dir, "node")));
    assert.throws(() => cpSyncJs(src, path.join(dir, "x")), { code: "ERR_FS_EISDIR" });
    cpSyncJs(src, path.join(dir, "f"), { recursive: true, filter: (s) => !s.endsWith("b.txt") });
    assert.deepEqual(list(path.join(dir, "f")), ["a.txt", "sub", "sub/deep"]);
    fs.writeFileSync(path.join(dir, "js", "a.txt"), "changed");
    cpSyncJs(src, path.join(dir, "js"), { recursive: true, force: false });
    assert.equal(fs.readFileSync(path.join(dir, "js", "a.txt"), "utf-8"), "changed");
    assert.throws(() => cpSyncJs(src, path.join(dir, "js"), { recursive: true, force: false, errorOnExist: true }), { code: "ERR_FS_CP_EEXIST" });
    cpSyncJs(src, path.join(dir, "js"), { recursive: true });
    assert.equal(fs.readFileSync(path.join(dir, "js", "a.txt"), "utf-8"), "a");
    assert.throws(() => cpSyncJs(src, path.join(src, "sub", "inner"), { recursive: true }), { code: "ERR_FS_CP_EINVAL" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the shim installs only on Windows and the launcher adds it to NODE_OPTIONS once", () => {
  assert.equal(installWinFsShim({ platform: "linux" }), false);
  assert.equal(windowsNodeOptions("", "file:///C:/g/geo/win-fs-shim.mjs"), "--import=file:///C:/g/geo/win-fs-shim.mjs");
  const once = windowsNodeOptions("--max-old-space-size=4096", "file:///C:/g/geo/win-fs-shim.mjs");
  assert.equal(once, "--max-old-space-size=4096 --import=file:///C:/g/geo/win-fs-shim.mjs");
  assert.equal(windowsNodeOptions(once, "file:///C:/g/geo/win-fs-shim.mjs"), once);
});
