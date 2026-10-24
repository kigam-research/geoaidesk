import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import type { ProjectPaths } from "../../projects.ts";
import { commandPreview } from "../../../../web/src/lib/command-blocks.ts";

/** Only the newest files are opened; older exposure/history is intentionally outside this home summary. */
export const HOME_SESSION_LIMIT = 64;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export interface HomeSession { id: string; title: string; updatedAt: string }
const cache = new Map<string, { stamp: string; value: HomeSession | null }>();

/** Missing optional stores are normal; inaccessible or malformed stores must surface as a partial project. */
export function entries(dir: string): fs.Dirent[] {
  try { return fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

/** Pi session metadata semantics without SessionManager.list's unbounded discovery or listSessions' mkdir. */
async function metadata(file: string, stat: fs.Stats): Promise<HomeSession | null> {
  const stamp = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const hit = cache.get(file);
  if (hit?.stamp === stamp) return hit.value;
  let id: string | undefined, name: string | undefined, first = "", activity = 0, created = 0, hasUser = false;
  const input = fs.createReadStream(file, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; } // Pi ignores partial JSONL lines too.
      if (!entry || typeof entry !== "object") continue;
      if (!id) {
        if (entry.type !== "session" || typeof entry.id !== "string" || !ID.test(entry.id)) return null;
        id = entry.id;
        created = Date.parse(entry.timestamp) || 0;
        continue;
      }
      if (entry.type === "session_info") name = typeof entry.name === "string" ? entry.name.trim() : undefined;
      const msg = entry.type === "message" ? entry.message : null;
      if (!msg || (msg.role !== "user" && msg.role !== "assistant")) continue;
      if (msg.role === "user") hasUser = true;
      const at = typeof msg.timestamp === "number" ? msg.timestamp : Date.parse(entry.timestamp);
      if (Number.isFinite(at)) activity = Math.max(activity, at);
      if (!first && msg.role === "user") {
        const content = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content)
          ? msg.content.filter((c: { type?: string; text?: string }) => c?.type === "text" && typeof c.text === "string").map((c: { text: string }) => c.text).join(" ") : "";
        // Use the same compact labels as chat tabs; never expose expanded Workflow/skill instructions or paths.
        first = commandPreview(content).trim();
      }
    }
  } finally { lines.close(); input.destroy(); }
  // A system-only session is not a resumable researcher conversation.
  const value = id && hasUser && (name || first) ? { id, title: (name || first).replace(/\s+/g, " ").slice(0, 180), updatedAt: new Date(activity || created || stat.mtimeMs).toISOString() } : null;
  if (cache.size >= 512) cache.clear();
  cache.set(file, { stamp, value });
  return value;
}

export async function homeSessions(paths: ProjectPaths): Promise<HomeSession[]> {
  const files = entries(paths.sessionsDir).filter(e => e.isFile() && e.name.endsWith(".jsonl")).map(e => {
    const file = path.join(paths.sessionsDir, e.name);
    return { file, stat: fs.statSync(file) };
  }).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || a.file.localeCompare(b.file)).slice(0, HOME_SESSION_LIMIT);
  const out: HomeSession[] = [];
  // Stream one file at a time, retaining metadata only, not transcript bodies.
  for (const { file, stat } of files) {
    const value = await metadata(file, stat);
    if (value) out.push(value);
  }
  return out;
}
