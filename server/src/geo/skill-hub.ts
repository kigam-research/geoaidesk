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
import { GAID_HUB_PACKAGE_SCHEMA, type MethodLifecycle } from "../../../web/src/geo/contracts/methods.ts";
import { readMethodFile } from "./methods/method-file.ts";
import { packageStore, writePackageOrigin } from "./methods/package-origin.ts";

export const SKILL_HUB_LIMITS = { compressed: 20 * 1024 * 1024, expanded: 64 * 1024 * 1024, entries: 10_000 };
/** `authoring`: path under the site of hub draft descriptors (`gaid-hub-package/v1`), when the hub serves drafts. */
export interface SkillHubSite { id: string; url: string; packages: string; authoring?: string }
export class SkillHubError extends Error {
  constructor(public code: "url" | "download" | "size" | "archive" | "input", message: string) { super(message); }
}
const fail = (code: SkillHubError["code"], message: string): never => { throw new SkillHubError(code, message); };
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function readSkillHubSites(repoRoot = REPO_ROOT): SkillHubSite[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo/distribution.json"), "utf8"));
  const sites: unknown = manifest.skillHub?.sites ?? [];
  if (!Array.isArray(sites)) throw new Error("skillHub.sites must be an array");
  return sites.map((site) => {
    if (!site || typeof site.id !== "string" || typeof site.url !== "string" || typeof site.packages !== "string") throw new Error("Invalid skillHub site");
    const url = new URL(site.url);
    // http only for a hub on this machine (a local hub service during development or a trial).
    const secure = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
    if (!secure || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) throw new Error("skillHub site must be an HTTPS (or loopback HTTP) base URL ending in /");
    const relPath = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_/-]+$/.test(value) && !value.startsWith("/") && !value.split("/").some((p: string) => !p);
    if (!/^[a-zA-Z0-9_-]+$/.test(site.id) || !relPath(site.packages) || (site.authoring !== undefined && !relPath(site.authoring))) throw new Error("Invalid skillHub site id/packages/authoring path");
    return { id: site.id, url: url.href, packages: site.packages, ...(site.authoring ? { authoring: site.authoring } : {}) };
  });
}

export interface HubDescriptor {
  methodId: string;
  revision: string;
  lifecycle: MethodLifecycle;
  sha256: string;
  size: number;
  packageUrl: string;
}

/**
 * A hub draft descriptor URL: `<site><authoring>/...` on a configured site that
 * serves drafts. A query (an opaque capability token) is allowed here only and
 * never stored or shown.
 */
export function resolveDescriptorUrl(value: string, sites = readSkillHubSites()) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const site = sites.find((s) => s.authoring && url.origin === new URL(s.url).origin && url.pathname.startsWith(new URL(`${s.authoring}/`, s.url).pathname));
  if (!site || url.username || url.password || url.hash || url.pathname.includes("..") || url.href.length > 2048) return null;
  return { siteId: site.id, site, descriptorUrl: url.href, displayUrl: `${url.origin}${url.pathname}` };
}

export function parseHubDescriptor(value: unknown, site: SkillHubSite): HubDescriptor {
  const raw = value as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== GAID_HUB_PACKAGE_SCHEMA) return fail("download", `Hub descriptor is not ${GAID_HUB_PACKAGE_SCHEMA}`);
  const text = (key: string, re: RegExp) => (typeof raw[key] === "string" && re.test(raw[key] as string) ? raw[key] as string : fail("download", `Hub descriptor has an invalid ${key}`));
  const methodId = text("methodId", /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/);
  const revision = text("revision", /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/);
  const lifecycle = text("lifecycle", /^(draft|submitted|published)$/) as MethodLifecycle;
  const sha256 = text("sha256", /^[a-f0-9]{64}$/);
  if (typeof raw.size !== "number" || !Number.isInteger(raw.size) || raw.size <= 0 || raw.size > SKILL_HUB_LIMITS.compressed) return fail("size", "Hub descriptor size is missing or over the limit");
  let packageUrl: URL;
  try { packageUrl = new URL(String(raw.packageUrl), site.url); } catch { return fail("download", "Hub descriptor has an invalid packageUrl"); }
  // The package comes from the same hub; a descriptor cannot send GAID elsewhere.
  if (packageUrl.origin !== new URL(site.url).origin || packageUrl.username || packageUrl.password) return fail("download", "Hub package URL is not on the configured hub");
  return { methodId, revision, lifecycle, sha256, size: raw.size, packageUrl: packageUrl.href };
}

export async function fetchHubDescriptor(url: string, site: SkillHubSite, fetcher: typeof fetch = fetch): Promise<HubDescriptor> {
  let response: Response;
  try { response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } }); }
  catch { return fail("download", "Could not reach the hub"); }
  if (!response.ok) return fail("download", `Hub descriptor request failed (${response.status})`);
  const body = await response.text();
  if (body.length > 64 * 1024) return fail("download", "Hub descriptor is too large");
  let value: unknown;
  try { value = JSON.parse(body); } catch { return fail("download", "Hub descriptor is not JSON"); }
  return parseHubDescriptor(value, site);
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
  const descriptorRef = input.url !== undefined ? resolveDescriptorUrl(input.url, deps.sites) : null;
  const descriptor = descriptorRef ? await fetchHubDescriptor(descriptorRef.descriptorUrl, descriptorRef.site, deps.fetcher) : null;
  const resolved = input.url !== undefined && !descriptorRef ? resolveSkillHubUrl(input.url, deps.sites) : undefined;
  const archive = input.archive ?? await downloadSkillHubPackage(descriptor?.packageUrl ?? resolved!.packageUrl, deps.fetcher);
  if (descriptor) {
    const digest = crypto.createHash("sha256").update(archive).digest("hex");
    if (digest !== descriptor.sha256 || archive.length !== descriptor.size) return fail("archive", "Package bytes do not match the hub descriptor");
  }
  const staged = stageSkillHubPackage(archive, { agentDir: deps.agentDir, expectedSlug: resolved?.slug });
  if (descriptor) {
    // The package's own gaid-method.json must name the revision the hub described.
    for (const entry of fs.readdirSync(staged.source)) {
      const method = readMethodFile(path.join(staged.source, entry), entry).method;
      if (method && (method.methodId !== descriptor.methodId || method.revision !== descriptor.revision)) return fail("archive", "Package method id/revision do not match the hub descriptor");
    }
  }
  writePackageOrigin(packageStore(deps.agentDir), {
    sha256: staged.sha256,
    kind: input.archive ? "upload" : "skill-hub",
    ...(descriptorRef ? { siteId: descriptorRef.siteId, descriptorUrl: descriptorRef.displayUrl } : {}),
    ...(resolved ? { siteId: resolved.siteId, pageUrl: resolved.pageUrl } : {}),
    // A configured Pages site lists published skills only; a descriptor states its own lifecycle.
    ...(descriptor ? { hub: { methodId: descriptor.methodId, revision: descriptor.revision, lifecycle: descriptor.lifecycle } } : resolved ? { hub: { lifecycle: "published" as const } } : {}),
    fetchedAt: new Date().toISOString(),
  });
  const preview = await (deps.preview ?? previewSkillSource)(paths, { source: staged.source, scope: input.scope });
  const catalogue = deps.catalogue ?? skillHubCatalogue();
  return { ...preview, skillHub: {
    sha256: staged.sha256, siteId: resolved?.siteId ?? descriptorRef?.siteId, skillId: resolved?.skillId, pageUrl: resolved?.pageUrl,
    ...(descriptor ? { draft: { methodId: descriptor.methodId, revision: descriptor.revision, lifecycle: descriptor.lifecycle, url: descriptorRef!.displayUrl } } : {}),
    catalogueAvailable: catalogue.available,
    catalogueNames: preview.skills.filter((s) => catalogue.skills.some((c) => c.runtimeName === s.name)).map((s) => s.name),
  } };
}
