#!/usr/bin/env node
// `npm ci` in each given directory only when its package-lock.json (or the Node ABI) changed since the last
// install there. The stamp is the one `start.mjs --production` writes (node_modules/.launcher-ci-stamp, same
// hash), so scripts/check, the production smoke and the GAID launcher reuse one another's installs.
// Installs prefer the npm cache (--prefer-offline); only packages missing from it are downloaded.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: node scripts/npm-ci-locked.mjs <dir>...");
  process.exit(2);
}
for (const dir of dirs) {
  const stampFile = path.join(dir, "node_modules", ".launcher-ci-stamp");
  // Keep in step with installLockedPackages() in start.mjs.
  const stamp = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(dir, "package-lock.json")))
    .update(`\0${process.platform}-${process.arch}-${process.versions.modules}`)
    .digest("hex");
  let previous = null;
  try {
    previous = fs.readFileSync(stampFile, "utf-8").trim();
  } catch {
    /* never installed with a stamp */
  }
  if (previous === stamp) {
    console.log(`${dir}: node_modules matches package-lock.json (npm ci skipped)`);
    continue;
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["ci", "--no-audit", "--no-fund", "--prefer-offline"], {
    cwd: dir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  fs.writeFileSync(stampFile, stamp + "\n");
}
