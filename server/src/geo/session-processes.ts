/** Lead-shell lifecycle. Linux descendants inherit an opaque session marker,
 * including double-forked/setsid jobs whose parent bash has already exited.
 * No global process.env mutation: parallel chats never inherit another owner.
 * Windows and hosts without /proc retain Pi's normal foreground abort. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createBashToolDefinition, type ToolDefinition, type BashToolOptions } from "@earendil-works/pi-coding-agent";

const MARKER = "GAID_SESSION_PROCESS_OWNER";
function owner(projectId: string, sessionId: string): string {
  return createHash("sha256").update(JSON.stringify([projectId, sessionId])).digest("hex");
}

// Tool schemas vary across the SDK customTools list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sessionBashTool(projectId: string, sessionId: string, cwd: string, options: Pick<BashToolOptions, "shellPath" | "commandPrefix"> = {}): ToolDefinition<any, any> {
  return createBashToolDefinition(cwd, {
    ...options,
    spawnHook: (context) => ({ ...context, env: { ...context.env, [MARKER]: owner(projectId, sessionId) } }),
  });
}

async function ownedPids(marker: string): Promise<number[]> {
  const entries = await fs.readdir("/proc").catch(() => []);
  const result: number[] = [];
  await Promise.all(entries.filter((entry) => /^\d+$/.test(entry)).map(async (entry) => {
    const pid = Number(entry);
    if (pid === process.pid) return;
    // Do not log or return environment contents (they may contain credentials).
    const env = await fs.readFile(`/proc/${entry}/environ`).catch(() => null);
    if (env?.includes(Buffer.from(`${MARKER}=${marker}\0`))) result.push(pid);
  }));
  return result;
}

async function signalOwned(marker: string, signal: NodeJS.Signals): Promise<number> {
  const pids = await ownedPids(marker);
  for (const pid of pids) {
    // Recheck immediately before signalling: do not kill a reused unrelated PID.
    const env = await fs.readFile(`/proc/${pid}/environ`).catch(() => null);
    if (!env?.includes(Buffer.from(`${MARKER}=${marker}\0`))) continue;
    try { process.kill(pid, signal); } catch { /* exited or no longer accessible */ }
  }
  return pids.length;
}

export async function stopSessionProcesses(projectId: string, sessionId: string): Promise<void> {
  if (process.platform !== "linux" || !sessionId) return;
  const marker = owner(projectId, sessionId);
  if (await signalOwned(marker, "SIGTERM")) {
    await delay(350);
    // Scan again, not just the first PID set: a terminating process may fork.
    await signalOwned(marker, "SIGKILL");
    // Signal delivery is asynchronous; give the kernel a bounded opportunity
    // to reap/stop jobs before reporting abort complete.
    for (let attempt = 0; attempt < 10 && (await ownedPids(marker)).length; attempt++) await delay(25);
  }
}
