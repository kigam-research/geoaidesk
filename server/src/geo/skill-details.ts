/** Researcher-facing provenance and a bounded read-only file listing; no storage migration. */
import fs from "node:fs";
import path from "node:path";
import { apiRelative } from "../sandbox-fs.ts";
import { findSkillDir, type SkillRoot } from "../agent/skills.ts";
import { readMethodFile } from "./methods/method-file.ts";
import { originOfSource } from "./methods/package-origin.ts";

export function skillWorkflow(root: SkillRoot, name: string, source?: string) {
  // A standalone gaid-hub-skill is not a Workflow, even if its folder includes old method metadata.
  if (originOfSource(source).origin.kind !== "gaid-hub") return undefined;
  const dir = findSkillDir(root, name);
  const method = dir ? readMethodFile(dir, name).method : null;
  if (!method) return undefined;
  return { title: method.title, revision: originOfSource(source).record?.hubEntry?.revision ?? method.revision };
}

export function skillFileList(root: SkillRoot, name: string) {
  const dir = findSkillDir(root, name);
  const files: string[] = [];
  let truncated = false;
  const walk = (folder: string, depth = 0) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (files.length >= 1000 || depth > 12) { truncated = true; return; }
      if (entry.isSymbolicLink() || [".git", "__pycache__"].includes(entry.name)) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile()) files.push(apiRelative(dir!, full));
    }
  };
  if (dir) walk(dir);
  return { files: files.sort(), truncated };
}
