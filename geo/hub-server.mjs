#!/usr/bin/env node
/** Start only the institute hub CLI, never the workspace server or credential loaders. */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loader = join(root, "server", "node_modules", "tsx", "dist", "loader.mjs");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 19)) {
  console.error("GAID hub server requires Node >= 22.19.");
  process.exitCode = 1;
} else if (!existsSync(loader)) {
  console.error("Install the hub dependencies first: npm ci --prefix server");
  process.exitCode = 1;
} else {
  const child = spawn(process.execPath, ["--import", loader, join(root, "server/src/geo/hub-server/cli.ts"), ...process.argv.slice(2)],
    { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { child.kill(signal); });
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1); });
}
