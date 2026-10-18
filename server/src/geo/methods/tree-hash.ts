/**
 * Installed method trees without Python bytecode caches (gaid-hub-followups re-trial: running a method's scripts from
 * its skill folder created `__pycache__/`, and GAID then reported the method as edited and changed since its trial).
 * Same format as skills-sync `hashDirectory`, so a tree without caches has the same hash as the stored base hash.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const isCache = (entry: fs.Dirent) =>
  (entry.isDirectory() && entry.name === "__pycache__") || (entry.isFile() && /\.py[co]$/.test(entry.name));

export function methodTreeHash(root: string): string {
  const hash = crypto.createHash("sha256");
  hash.update("kady-skill-tree-v1\0");
  const walk = (dir: string, relativeDir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (isCache(entry)) continue;
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

/** Removes `__pycache__/` folders and `.pyc` files (regenerated on the next run); links are not followed. */
export function removePythonCaches(root: string): void {
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (isCache(entry)) fs.rmSync(absolute, { recursive: true, force: true });
      else if (entry.isDirectory()) walk(absolute);
    }
  };
  walk(root);
}
