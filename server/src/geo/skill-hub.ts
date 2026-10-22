/** skill_hub packages are durable local sources for the existing preview/install gate. */
import { previewPinnedHubSkills } from "./methods/hub-pin-install.ts";
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
import { readMethodFile, verifyMethodTree } from "./methods/method-file.ts";
import { packageStore, writePackageOrigin } from "./methods/package-origin.ts";
import { activeHubStore } from "./hub-shared/active.ts";
import type { HubRecordStore } from "./hub-shared/records.ts";

export const SKILL_HUB_LIMITS = { compressed: 20 * 1024 * 1024, expanded: 64 * 1024 * 1024, entries: 10_000 };
/** `authoring`: path under the site of hub draft descriptors (`gaid-hub-package/v1`), when the hub serves drafts. */
export interface SkillHubSite { id: string; url: string; packages: string; authoring?: string }
export class SkillHubError extends Error {
  constructor(public code: "url" | "download" | "size" | "archive" | "input", message: string) { super(message); }
}
const fail = (code: SkillHubError["code"], message: string): never => { throw new SkillHubError(code, message); };
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Sites from geo/distribution.json plus `GAID_SKILL_HUB_SITES` (a JSON array of the same shape), so a hub on this
 * machine (e.g. a trial hub on loopback) can be added without changing the distribution. Later ids replace earlier ones.
 */
export function readSkillHubSites(repoRoot = REPO_ROOT, env: NodeJS.ProcessEnv = process.env): SkillHubSite[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo/distribution.json"), "utf8"));
  const shipped: unknown = manifest.skillHub?.sites ?? [];
  if (!Array.isArray(shipped)) throw new Error("skillHub.sites must be an array");
  let extra: unknown = [];
  if (env.GAID_SKILL_HUB_SITES?.trim()) {
    try { extra = JSON.parse(env.GAID_SKILL_HUB_SITES); } catch { throw new Error("GAID_SKILL_HUB_SITES must be a JSON array"); }
    if (!Array.isArray(extra)) throw new Error("GAID_SKILL_HUB_SITES must be a JSON array");
  }
  const byId = new Map<string, SkillHubSite>();
  for (const site of [...shipped, ...(extra as unknown[])].map(validSite)) byId.set(site.id, site);
  return [...byId.values()];
}

function validSite(site: { id?: unknown; url?: unknown; packages?: unknown; authoring?: unknown } | null): SkillHubSite {
  if (!site || typeof site.id !== "string" || typeof site.url !== "string" || typeof site.packages !== "string") throw new Error("Invalid skillHub site");
  const url = new URL(site.url);
  // http only for a hub on this machine (a local hub service during development or a trial).
  const secure = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname));
  if (!secure || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/")) throw new Error("skillHub site must be an HTTPS (or loopback HTTP) base URL ending in /");
  const relPath = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_/-]+$/.test(value) && !value.startsWith("/") && !value.split("/").some((p: string) => !p);
  if (!/^[a-zA-Z0-9_-]+$/.test(site.id) || !relPath(site.packages) || (site.authoring !== undefined && !relPath(String(site.authoring).replace(/\/$/, "")))) throw new Error("Invalid skillHub site id/packages/authoring path");
  return { id: site.id, url: url.href, packages: site.packages, ...(typeof site.authoring === "string" && site.authoring ? { authoring: site.authoring } : {}) };
}

export interface HubDescriptor {
  methodId: string;
  revision: number;
  version: string;
  lifecycle: MethodLifecycle;
  implementation: "descriptive" | "implemented";
  title: { ko: string; en?: string };
  sha256: string;
  size: number;
  packageDigest: string;
  packageUrl: string;
  manifestUrl: string;
  pageUrl: string;
  createdAt: string;
}

/** `authoring` with exactly one trailing slash, as a URL under the site. */
function authoringBase(site: SkillHubSite): URL | null {
  return site.authoring ? new URL(`${site.authoring.replace(/\/+$/, "")}/`, site.url) : null;
}

/**
 * A hub draft descriptor URL: `<site><authoring>/...` on a configured site that
 * serves drafts. A query (an opaque capability token) is allowed here only and
 * never stored or shown.
 */
export function resolveDescriptorUrl(value: string, sites = readSkillHubSites()) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  // Descriptors live at <authoring>packages/<owner>/<slug>/<revision>.
  const site = sites.find((s) => { const base = authoringBase(s); return base && url.origin === base.origin && /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/[1-9]\d*$/.test(url.pathname.slice(`${base.pathname}packages/`.length)) && url.pathname.startsWith(`${base.pathname}packages/`); });
  if (!site || url.username || url.password || url.hash || url.pathname.includes("..") || url.href.length > 2048) return null;
  return { siteId: site.id, site, descriptorUrl: url.href, displayUrl: `${url.origin}${url.pathname}` };
}

export function parseHubDescriptor(value: unknown, site: SkillHubSite): HubDescriptor {
  const raw = value as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== GAID_HUB_PACKAGE_SCHEMA) return fail("download", `Hub descriptor is not ${GAID_HUB_PACKAGE_SCHEMA}`);
  const text = (key: string, re: RegExp) => (typeof raw[key] === "string" && re.test(raw[key] as string) ? raw[key] as string : fail("download", `Hub descriptor has an invalid ${key}`));
  const methodId = text("methodId", /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/);
  const version = text("version", /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/);
  const lifecycle = text("lifecycle", /^(draft|submitted|published)$/) as MethodLifecycle;
  const implementation = text("implementation", /^(descriptive|implemented)$/) as HubDescriptor["implementation"];
  const sha256 = text("sha256", /^[a-f0-9]{64}$/);
  const packageDigest = text("packageDigest", /^[a-f0-9]{64}$/);
  const createdAt = text("createdAt", /^.{1,64}$/);
  if (typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 1) return fail("download", "Hub descriptor has an invalid revision");
  if (typeof raw.size !== "number" || !Number.isInteger(raw.size) || raw.size <= 0 || raw.size > SKILL_HUB_LIMITS.compressed) return fail("size", "Hub descriptor size is missing or over the limit");
  const title = raw.title as { ko?: unknown; en?: unknown } | null;
  if (!title || typeof title.ko !== "string" || !title.ko) return fail("download", "Hub descriptor has an invalid title");
  // Package, manifest and page come from the same hub; a descriptor cannot send GAID elsewhere.
  const sameHub = (key: string) => {
    let url: URL;
    try { url = new URL(String(raw[key]), site.url); } catch { return fail("download", `Hub descriptor has an invalid ${key}`); }
    if (url.origin !== new URL(site.url).origin || url.username || url.password) return fail("download", `Hub ${key} is not on the configured hub`);
    return url.href;
  };
  return {
    methodId, revision: raw.revision, version, lifecycle, implementation,
    title: typeof title.en === "string" && title.en ? { ko: title.ko, en: title.en } : { ko: title.ko },
    sha256, size: raw.size, packageDigest, packageUrl: sameHub("packageUrl"), manifestUrl: sameHub("manifestUrl"), pageUrl: sameHub("pageUrl"), createdAt,
  };
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

export async function previewSkillHub(paths: ProjectPaths, input: { url?: string; archive?: Buffer; hubEntry?: { id: string; revision: number }; scope?: string }, deps: {
  sites?: SkillHubSite[]; agentDir?: string; fetcher?: typeof fetch; preview?: typeof previewSkillSource;
  sharedStore?: HubRecordStore;
  catalogue?: ReturnType<typeof skillHubCatalogue>;
} = {}) {
  if ([input.url, input.archive, input.hubEntry].filter((v) => v !== undefined).length !== 1 || (input.scope !== undefined && input.scope !== "project" && input.scope !== "global")) return fail("input", "Provide one URL, package or hub entry and a valid scope");
  const ref = input.hubEntry;
  if (ref && (typeof ref.id !== "string" || !Number.isSafeInteger(ref.revision) || ref.revision < 1)) return fail("input", "Provide a hub entry and a positive revision");
  const store = ref ? activeHubStore(deps.sharedStore) : null;
  const record = ref ? await store!.read(ref.id) : null;
  const snapshot = ref && record ? record.snapshots[String(ref.revision)] : undefined;
  if (ref && !snapshot) return fail("input", "Hub entry revision was not found; search the hub again");
  const descriptorRef = input.url !== undefined ? resolveDescriptorUrl(input.url, deps.sites) : null;
  const descriptor = descriptorRef ? await fetchHubDescriptor(descriptorRef.descriptorUrl, descriptorRef.site, deps.fetcher) : null;
  const resolved = input.url !== undefined && !descriptorRef ? resolveSkillHubUrl(input.url, deps.sites) : undefined;
  const archive = ref ? await store!.bytes(ref.id, `packages/${ref.revision}.tar.gz`) : input.archive ?? await downloadSkillHubPackage(descriptor?.packageUrl ?? resolved!.packageUrl, deps.fetcher);
  if (snapshot && (archive.length !== snapshot.package.size || crypto.createHash("sha256").update(archive).digest("hex") !== snapshot.package.sha256)) return fail("archive", "Package bytes do not match the registered hub revision");
  if (descriptor) {
    const digest = crypto.createHash("sha256").update(archive).digest("hex");
    if (digest !== descriptor.sha256 || archive.length !== descriptor.size) return fail("archive", "Package bytes do not match the hub descriptor");
  }
  const staged = stageSkillHubPackage(archive, { agentDir: deps.agentDir, expectedSlug: resolved?.slug });
  const contents: { name: string; files: string[]; hasCode: boolean; prompts: unknown[] }[] = [];
  // A method package's tree must match its own file listing; a hub descriptor must name the same method revision.
  for (const entry of fs.readdirSync(staged.source)) {
    const file = readMethodFile(path.join(staged.source, entry), entry);
    if ((descriptor || snapshot) && !file.method) return fail("archive", "Hub package has no valid gaid-method.json");
    if (!file.method) continue;
    contents.push({ name: entry, files: ["gaid-method.json", ...(file.method.files ?? []).map((f) => f.path)], hasCode: file.method.implementation === "implemented", prompts: file.method.workflows.map((w) => w.prompt) });
    if (verifyMethodTree(path.join(staged.source, entry), file.method).length) return fail("archive", "Package files do not match gaid-method.json");
    if (descriptor && (file.method.methodId !== descriptor.methodId || file.method.revision !== descriptor.revision || file.method.packageDigest !== descriptor.packageDigest)) {
      return fail("archive", "Package method id/revision/digest do not match the hub descriptor");
    }
    if (snapshot && (file.method.methodId !== snapshot.package.methodId || file.method.revision !== snapshot.package.revision || file.method.packageDigest !== snapshot.package.packageDigest)) return fail("archive", "Package method does not match the registered hub revision");
  }
  writePackageOrigin(packageStore(deps.agentDir), {
    sha256: staged.sha256,
    kind: ref ? "gaid-hub" : input.archive ? "upload" : "skill-hub",
    ...(ref ? { hubEntry: ref } : {}),
    ...(snapshot ? { hub: { methodId: snapshot.package.methodId, revision: snapshot.package.revision, lifecycle: "draft" as const } } : {}),
    ...(descriptorRef ? { siteId: descriptorRef.siteId, descriptorUrl: descriptorRef.displayUrl } : {}),
    ...(resolved ? { siteId: resolved.siteId, pageUrl: resolved.pageUrl } : {}),
    // A configured Pages site lists published skills only; a descriptor states its own lifecycle.
    ...(descriptor ? { hub: { methodId: descriptor.methodId, revision: descriptor.revision, lifecycle: descriptor.lifecycle, pageUrl: descriptor.pageUrl } } : resolved ? { hub: { lifecycle: "published" as const } } : {}),
    fetchedAt: new Date().toISOString(),
  });
  const preview = await (deps.preview ?? previewSkillSource)(paths, { source: staged.source, scope: input.scope });
  const catalogue = deps.catalogue ?? skillHubCatalogue();
  const methodFiles = fs.readdirSync(staged.source).map((entry) => readMethodFile(path.join(staged.source, entry), entry).method);
  const hubSkills = (await Promise.all(methodFiles.map((file) => previewPinnedHubSkills(paths, file, { agentDir: deps.agentDir })))).flat();
  return { ...preview, contents, ...(hubSkills.length ? { hubSkills } : {}), skillHub: {
    sha256: staged.sha256, siteId: resolved?.siteId ?? descriptorRef?.siteId, skillId: resolved?.skillId, pageUrl: resolved?.pageUrl,
    ...(ref ? { hubEntry: { ...ref, title: record!.entry.title } } : {}),
    ...(descriptor ? { draft: { methodId: descriptor.methodId, revision: descriptor.revision, lifecycle: descriptor.lifecycle, url: descriptorRef!.displayUrl } } : {}),
    catalogueAvailable: catalogue.available,
    catalogueNames: preview.skills.filter((s) => catalogue.skills.some((c) => c.runtimeName === s.name)).map((s) => s.name),
  } };
}

export interface HubMethodListing {
  siteId: string;
  url: string;
  state: "ok" | "error";
  detail?: string;
  methods: (HubDescriptor & { descriptorUrl: string })[];
}

/**
 * Latest revision of every method on each configured hub that serves drafts
 * (`GET <authoring>methods`, `gaid-hub-methods/v1`). Read-only: nothing is
 * downloaded or installed; the UI hands a descriptor URL to the preview gate.
 */
export async function listHubMethods(sites = readSkillHubSites(), fetcher: typeof fetch = fetch): Promise<HubMethodListing[]> {
  return Promise.all(sites.filter((site) => site.authoring).map(async (site): Promise<HubMethodListing> => {
    const base = authoringBase(site)!;
    const out: HubMethodListing = { siteId: site.id, url: site.url, state: "ok", methods: [] };
    try {
      const response = await fetcher(new URL("methods", base).href, { redirect: "error", signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Hub answered ${response.status}`);
      const body = await response.text();
      if (body.length > 1024 * 1024) throw new Error("Hub method list is too large");
      const value = JSON.parse(body) as { schemaVersion?: unknown; methods?: unknown };
      if (value?.schemaVersion !== "gaid-hub-methods/v1" || !Array.isArray(value.methods)) throw new Error("Hub method list is not gaid-hub-methods/v1");
      for (const row of value.methods.slice(0, 200)) {
        try {
          const descriptor = parseHubDescriptor(row, site);
          out.methods.push({ ...descriptor, descriptorUrl: new URL(`packages/${descriptor.methodId}/${descriptor.revision}`, base).href });
        } catch {
          // An invalid row is left out; the others stay listed.
        }
      }
    } catch (error) {
      out.state = "error";
      out.detail = error instanceof Error ? error.message : "Could not reach the hub";
    }
    return out;
  }));
}
