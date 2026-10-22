/**
 * Installed method trees without regenerable caches (gaid-hub-followups re-trial: running a method's scripts from
 * its skill folder created `__pycache__/`, and GAID then reported the method as edited and changed since its trial).
 * Same format and cache list as skills-sync `hashDirectory`, so both give one tree the same hash.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isRegenerableCache } from "../regenerable-cache.ts";

export function methodTreeHash(root: string): string {
  const hash = crypto.createHash("sha256");
  hash.update("kady-skill-tree-v1\0");
  const walk = (dir: string, relativeDir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (isRegenerableCache(entry.name)) continue;
      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        hash.update(`d\0${relative}\0`);
        walk(absolute, relative);
      } else if (entry.isFile()) {
        hash.update(`f\0${relative}\0`);
        hash.update(fs.readFileSync(absolute));
        hash.update("\0");
      } else if (entry.isSymbolicLink()) {
        hash.update(`l\0${relative}\0${fs.readlinkSync(absolute)}\0`);
      }
    }
  };
  walk(root, "");
  return hash.digest("hex");
}

/** Removes regenerable caches (`__pycache__/`, `.pyc`, test/lint caches); links are not followed. */
export function removeRegenerableCaches(root: string): void {
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (isRegenerableCache(entry.name)) fs.rmSync(absolute, { recursive: true, force: true });
      else if (entry.isDirectory()) walk(absolute);
    }
  };
  walk(root);
}
