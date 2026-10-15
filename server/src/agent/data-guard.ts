/**
 * Raw-data guard for the lead session: a Pi `tool_call` hook that
 *
 *   - blocks `write`/`edit`/`bash`/`generate_image` mutations of protected paths (default
 *     `user_data/**`) with a reason the model can act on, and
 *   - asks the user (permission card in the chat) before outside-project writes and destructive shell
 *     commands, when the project policy says so.
 *
 * Background specialists get the same protected-path block from the vendored
 * `kady-guard` package (no UI there, so outside writes and destructive commands are blocked).
 * Policy is read fresh on every call so project-settings edits apply
 * immediately to live sessions.
 */
import os from "node:os";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import {
  classifyBashCommand,
  classifyFilePath,
  protectedBlockReason,
} from "./bash-classifier.ts";
import { readGuardPolicy } from "./guard-policy.ts";
import { requestPermission } from "./permissions.ts";

export function makeDataGuardExtension(
  projectId: string,
  getSessionId: () => string,
  sandboxRoot: string,
  options: { readPolicy?: typeof readGuardPolicy; request?: typeof requestPermission } = {},
): ExtensionFactory {
  const readPolicy = options.readPolicy ?? readGuardPolicy;
  const request = options.request ?? requestPermission;
  return (pi) => {
    pi.on("tool_call", async (event) => {
      const policy = readPolicy(sandboxRoot);
      const opts = { protectedGlobs: policy.protectedPaths, sandboxRoot, homeDir: os.homedir(), tempDirs: [os.tmpdir()] };
      let permission: { kind: "outside-project" | "destructive"; path?: string; command: string; detail: string } | undefined;

      // generate_image writes its `path` (default under figures/generated/).
      if (event.toolName === "write" || event.toolName === "edit" || event.toolName === "generate_image") {
        const target = (event.input as { path?: unknown }).path;
        if (typeof target !== "string") return undefined;
        const verdict = classifyFilePath(target, opts);
        if (verdict.kind === "protected") {
          return { block: true, reason: protectedBlockReason(verdict.path, verdict.glob, `${event.toolName} ${verdict.path}`) };
        }
        if (verdict.kind !== "outside-project") return undefined;
        permission = { kind: verdict.kind, path: verdict.path, command: `${event.toolName} ${target}`, detail: `${event.toolName} ${verdict.path}` };
      }

      if (!permission && event.toolName !== "bash") return undefined;
      if (event.toolName === "bash") {
        const command = (event.input as { command?: unknown }).command;
        if (typeof command !== "string" || !command.trim()) return undefined;
        const verdict = classifyBashCommand(command, opts);
        if (verdict.kind === "protected") {
          return { block: true, reason: protectedBlockReason(verdict.path, verdict.glob, verdict.detail) };
        }
        if (verdict.kind === "outside-project" || verdict.kind === "destructive") {
          permission = { kind: verdict.kind, path: verdict.kind === "outside-project" ? verdict.path : undefined, command, detail: verdict.detail };
        }
      }
      if (permission && policy.destructiveConfirm) {
        const { kind, path, command, detail } = permission;
        const outcome = await request(projectId, getSessionId(), {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          kind,
          path,
          command,
          reason: kind === "outside-project" ? `Outside-project write: ${detail}` : `Destructive shell command: ${detail}`,
        });
        if (outcome === "allowed") return undefined;
        const reason =
          outcome === "denied"
            ? `The user declined this command (${detail}). Do not retry it; ask the user how to proceed.`
            : outcome === "timeout"
              ? `No answer within the permission window for: ${detail}. The user did NOT approve it. Do not retry it; state that approval is still needed.`
              : outcome === "no_ui"
                ? `Mutation not permitted without an interactive confirmation (${detail}). Ask the user in chat first.`
                : `Run stopped before the user could approve: ${detail}.`;
        return { block: true, reason, terminate: outcome === "cancelled" };
      }
      return undefined;
    });
  };
}
