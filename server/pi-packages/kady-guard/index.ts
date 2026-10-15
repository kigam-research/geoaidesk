/**
 * kady-guard — the raw-data guard for CHILD pi processes (background
 * specialists). The lead session runs the same classifier in-process
 * (server/src/agent/data-guard.ts) with a permission card for outside writes and destructive
 * commands; children have no UI, so these operations are blocked with a
 * reason that tells them to report back. Self-gates on PI_SUBAGENT_CHILD so
 * the lead never runs two guards.
 *
 * Policy: `<cwd>/.kady/policy.json` (written by the project settings), read
 * fresh per call; missing → defaults (`user_data/**` protected).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { classifyBashCommand, classifyFilePath, protectedBlockReason } from "./classifier.ts";

const DEFAULT_PROTECTED = ["user_data/**"];

function readPolicy(cwd: string): { protectedPaths: string[] } {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cwd, ".kady", "policy.json"), "utf-8")) as {
      protectedPaths?: unknown;
    };
    if (Array.isArray(raw.protectedPaths)) {
      return { protectedPaths: raw.protectedPaths.filter((p): p is string => typeof p === "string") };
    }
  } catch {
    /* defaults */
  }
  return { protectedPaths: [...DEFAULT_PROTECTED] };
}

export default function (pi: ExtensionAPI): void {
  if (!process.env.PI_SUBAGENT_CHILD) return;
  registerChildGuard(pi);
}
export function registerChildGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", (event, ctx) => {
    const cwd = ctx.cwd;
    const policy = readPolicy(cwd);
    const opts = { protectedGlobs: policy.protectedPaths, sandboxRoot: cwd, homeDir: os.homedir(), tempDirs: [os.tmpdir()] };
    if (event.toolName === "write" || event.toolName === "edit" || event.toolName === "generate_image") {
      const target = (event.input as { path?: unknown }).path;
      if (typeof target !== "string") return undefined;
      const verdict = classifyFilePath(target, opts);
      if (verdict.kind === "protected") {
        return { block: true, reason: protectedBlockReason(verdict.path, verdict.glob, `${event.toolName} ${verdict.path}`) };
      }
      if (verdict.kind === "outside-project") return outsideBlock(verdict.path);
      return undefined;
    }
    if (event.toolName !== "bash") return undefined;
    const command = (event.input as { command?: unknown }).command;
    if (typeof command !== "string" || !command.trim()) return undefined;
    const verdict = classifyBashCommand(command, opts);
    if (verdict.kind === "protected") {
      return { block: true, reason: protectedBlockReason(verdict.path, verdict.glob, verdict.detail) };
    }
    if (verdict.kind === "outside-project") return outsideBlock(verdict.path);
    if (verdict.kind === "destructive") {
      return {
        block: true,
        reason:
          `Blocked: destructive shell commands are not permitted for background specialists (${verdict.detail}). ` +
          "Report the exact command and why it is needed back to the lead agent so the user can decide.",
      };
    }
    return undefined;
  });
}

function outsideBlock(target: string) {
  return { block: true, reason: `Blocked: outside-project writes are not permitted for background specialists (${target}). Report the target and why it is needed back to the lead agent so the user can decide.` };
}
