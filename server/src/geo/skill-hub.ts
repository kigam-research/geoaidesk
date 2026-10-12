/** skill_hub packages are durable local sources for the existing preview/install gate. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { KADY_PI_AGENT_DIR, REPO_ROOT } from "../config.ts";
import { previewSkillSource } from "../agent/skills-install.ts";
import type { ProjectPaths } from "../projects.ts";
import { loadGeoCatalogue, packageDigest } from "./catalogue.ts";
import { readTar } from "./tar.ts";

export const SKILL_HUB_LIMITS = { compressed: 20 * 1024 * 1024, expanded: 64 * 1024 * 1024, entries: 10_000 };
export interface SkillHubSite { id: string; url: string; packages: string }
export class SkillHubError extends Error {
  constructor(public code: "url" | "download" | "size" | "archive" | "input", message: string) { super(message); }
}
const fail = (code: SkillHubError["code"], message: string): never => { throw new SkillHubError(code, message); };

export function readSkillHubSites(repoRoot = REPO_ROOT): SkillHubSite[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo/distribution.json"), "utf8"));
  const sites: unknown = manifest.skillHub?.sites ?? [];
  if (!Array.isArray(sites)) throw new Error("skillHub.sites must be an array");
  return sites.map((site) => {
    if (!site || typeof site.id !== "string" || typeof site.url !== "string" || typeof site.packages !== "string") throw new Error("Invalid skillHub site");
    const url = new URL(site.url);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) throw new Error("skillHub site must be an HTTPS base URL ending in /");
    if (!/^[a-zA-Z0-9_-]+$/.test(site.id) || !/^[a-zA-Z0-9_/-]+$/.test(site.packages) || site.packages.startsWith("/") || site.packages.split("/").some((p: string) => !p)) throw new Error("Invalid skillHub site id/packages path");
    return { id: site.id, url: url.href, packages: site.packages };
  });
}

export function resolveSkillHubUrl(value: string, sites = readSkillHubSites()) {
  let url: URL;
  try { url = new URL(value); } catch { return fail("url", "Enter a configured skill_hub skill page URL"); }
  const site = sites.find((s) => { const base = new URL(s.url); return url.origin === base.origin && url.pathname === base.pathname; });
  const match = /^#\/skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9-]+)?$/.exec(url.hash);
  if (!site || !match || url.username || url.password || url.search || match[1].length > 64 || match[2].length > 64) return fail("url", "Only skill pages on configured skill_hub sites are accepted");
  const [, publisher, slug] = match;
  return { siteId: site.id, skillId: `${publisher}/${slug}`, slug, pageUrl: `${site.url}#/skills/${publisher}/${slug}`, packageUrl: new URL(`${site.packages}/${publisher}/${slug}/${slug}.tar.gz`, site.url).href };
}

export async function downloadSkillHubPackage(url: string, fetcher: typeof fetch = fetch, limit = SKILL_HUB_LIMITS.compressed): Promise<Buffer> {
  try {
    const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok || !response.body) return fail("download", `Package download failed (${response.status})`);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      if (Number(response.headers.get("content-length")) > limit) return fail("size", "Package exceeds the compressed size limit");
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) return fail("size", "Package exceeds the compressed size limit");
        chunks.push(Buffer.from(part.value));
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof SkillHubError) throw error;
    return fail("download", "Could not download the skill_hub package");
  }
}

export function stageSkillHubPackage(archive: Buffer, options: { agentDir?: string; expectedSlug?: string; limits?: typeof SKILL_HUB_LIMITS } = {}) {
  const limits = options.limits ?? SKILL_HUB_LIMITS;
  if (archive.length > limits.compressed) return fail("size", "Package exceeds the compressed size limit");
  let tar: Buffer;
  try { tar = zlib.gunzipSync(archive, { maxOutputLength: limits.expanded }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") return fail("size", "Package exceeds the expanded size limit");
    return fail("archive", "Package is not a readable gzip archive");
  }
  let entries;
  try { entries = readTar(tar); } catch (error) { return fail("archive", error instanceof Error ? error.message : "Invalid tar archive"); }
  if (entries.length > limits.entries) return fail("size", "Package exceeds the entry limit");
  const roots = new Set(entries.map((e) => e.path.split("/")[0]));
  const slug = [...roots][0];
  if (roots.size !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? "") || (options.expectedSlug && slug !== options.expectedSlug) || !entries.some((e) => e.path === `${slug}/SKILL.md` && e.type === "file")) return fail("archive", "Package must contain one skill folder with SKILL.md");
  if (new Set(entries.map((e) => e.path)).size !== entries.length) return fail("archive", "Package has duplicate paths");
  const sha256 = crypto.createHash("sha256").update(archive).digest("hex");
  const store = path.join(options.agentDir ?? KADY_PI_AGENT_DIR, "skill-hub", "packages");
  fs.mkdirSync(store, { recursive: true });
  const source = path.join(store, sha256);
  const temp = fs.mkdtempSync(path.join(store, ".extract-"));
  try {
    for (const entry of entries) {
      const destination = path.join(temp, entry.path);
      if (entry.type === "directory") fs.mkdirSync(destination, { recursive: true });
      else {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, entry.data, { flag: "wx", mode: entry.mode & 0o111 ? 0o755 : 0o644 });
      }
    }
    // Never overwrite a source already used by an acknowledged preview.
    if (fs.existsSync(source)) {
      if (packageDigest(source) !== packageDigest(temp)) return fail("archive", "Stored package was modified; restore the original package source");
    } else fs.renameSync(temp, source);
  } catch (error) {
    if (error instanceof SkillHubError) throw error;
    return fail("archive", "Could not stage the package tree");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  return { source, sha256 };
}

export function skillHubCatalogue() {
  try { return { available: true, skills: loadGeoCatalogue().index.skills.map(({ id, runtimeName }) => ({ id, runtimeName })) }; }
  catch { return { available: false, skills: [] as { id: string; runtimeName: string }[] }; }
}

export async function previewSkillHub(paths: ProjectPaths, input: { url?: string; archive?: Buffer; scope?: string }, deps: {
  sites?: SkillHubSite[]; agentDir?: string; fetcher?: typeof fetch; preview?: typeof previewSkillSource;
  catalogue?: ReturnType<typeof skillHubCatalogue>;
} = {}) {
  if ((input.url !== undefined) === (input.archive !== undefined) || (input.scope !== undefined && input.scope !== "project" && input.scope !== "global")) return fail("input", "Provide one URL or one package and a valid scope");
  const resolved = input.url !== undefined ? resolveSkillHubUrl(input.url, deps.sites) : undefined;
  const archive = input.archive ?? await downloadSkillHubPackage(resolved!.packageUrl, deps.fetcher);
  const staged = stageSkillHubPackage(archive, { agentDir: deps.agentDir, expectedSlug: resolved?.slug });
  const preview = await (deps.preview ?? previewSkillSource)(paths, { source: staged.source, scope: input.scope });
  const catalogue = deps.catalogue ?? skillHubCatalogue();
  return { ...preview, skillHub: {
    sha256: staged.sha256, siteId: resolved?.siteId, skillId: resolved?.skillId, pageUrl: resolved?.pageUrl,
    catalogueAvailable: catalogue.available,
    catalogueNames: preview.skills.filter((s) => catalogue.skills.some((c) => c.runtimeName === s.name)).map((s) => s.name),
  } };
}
