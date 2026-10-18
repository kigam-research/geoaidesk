import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashDirectory } from "../src/agent/skills-sync.ts";
import { methodTreeHash, removePythonCaches } from "../src/geo/methods/tree-hash.ts";

let dir: string;
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("method tree hash", () => {
  it("equals the skill-sync hash without caches and ignores Python bytecode caches", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-tree-"));
    fs.mkdirSync(path.join(dir, "scripts/analysis"), { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), "# m\n");
    fs.writeFileSync(path.join(dir, "scripts/analysis/v.py"), "print(1)\n");
    const base = hashDirectory(dir);
    expect(methodTreeHash(dir)).toBe(base);
    fs.mkdirSync(path.join(dir, "scripts/analysis/__pycache__"));
    fs.writeFileSync(path.join(dir, "scripts/analysis/__pycache__/v.cpython-312.pyc"), "x");
    fs.writeFileSync(path.join(dir, "scripts/stray.pyc"), "x");
    expect(hashDirectory(dir)).not.toBe(base);
    expect(methodTreeHash(dir)).toBe(base);
    fs.appendFileSync(path.join(dir, "SKILL.md"), "edit\n");
    expect(methodTreeHash(dir)).not.toBe(base);
  });

  it("removes caches so the installed copy matches its base hash again", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-tree-"));
    fs.mkdirSync(path.join(dir, "a/__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(dir, "a/x.py"), "1\n");
    fs.writeFileSync(path.join(dir, "a/__pycache__/x.pyc"), "c");
    removePythonCaches(dir);
    expect(fs.existsSync(path.join(dir, "a/__pycache__"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "a/x.py"))).toBe(true);
  });
});
