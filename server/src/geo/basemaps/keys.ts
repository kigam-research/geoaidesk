import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const aliases = {
  ngii: ["GAID_NGII_API_KEY", "NGII_API_KEY", "NGII_KEY"],
  referer: ["GAID_NGII_REFERER", "NGII_REFERER", "활용URL"],
  kigam: ["GAID_KIGAM_API_KEY", "KIGAM_API_KEY", "KIGAM_KEY"],
} as const;
export interface MapKeys { ngii?: string; referer?: string; kigam?: string }
type Env = Record<string, string | undefined>;
const allowed = new Set<string>(Object.values(aliases).flat());

/** Parse only the supported names; never execute a shell or import other credentials. */
export function parseMapKeys(text: string): Env {
  const values: Env = {};
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim().replace(/^export\s+/, "");
    if (!raw || raw.startsWith("#")) continue;
    const at = raw.indexOf("=");
    if (at < 1) continue;
    const name = raw.slice(0, at).trim();
    if (!allowed.has(name)) continue;
    let value = raw.slice(at + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
    values[name] = value;
  }
  return values;
}

/** File cache refreshes on mtime/ctime/size changes. Values never enter logs or status JSON. */
export function createKeyResolver(env: Env = process.env, home = os.homedir()): () => Promise<MapKeys> {
  let cached: { stamp: string; values: Env } | undefined;
  const expand = (p: string) => p.startsWith("~/") ? path.join(home, p.slice(2)) : p;
  return async () => {
    const candidates = [env.GAID_MAP_KEYS_FILE, env.GAID_HOME ? path.join(env.GAID_HOME, "map-keys.env") : undefined,
      path.join(home, ".config", "map_env", "map-keys.env")].filter((p): p is string => !!p?.trim());
    let file: Env = {};
    for (const raw of candidates) {
      const p = expand(raw);
      try {
        const s = await stat(p);
        if (!s.isFile()) continue;
        // The first existing file wins, even when empty or unreadable.
        const stamp = `${p}:${s.mtimeMs}:${s.ctimeMs}:${s.size}`;
        if (s.size <= 64 * 1024) {
          if (cached?.stamp === stamp) file = cached.values;
          else {
            file = parseMapKeys(await readFile(p, "utf8"));
            cached = { stamp, values: file };
          }
        }
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") break;
      }
    }
    const result: MapKeys = {};
    for (const key of Object.keys(aliases) as (keyof MapKeys)[]) {
      // Any explicit process alias beats every file alias.
      result[key] = aliases[key].map(n => env[n]?.trim()).find(Boolean) ?? aliases[key].map(n => file[n]?.trim()).find(Boolean);
    }
    if (result.referer) {
      try {
        const url = new URL(result.referer);
        if (!["http:", "https:"].includes(url.protocol) || /[\r\n]/.test(result.referer)) result.referer = undefined;
      } catch { result.referer = undefined; }
    }
    return result;
  };
}
