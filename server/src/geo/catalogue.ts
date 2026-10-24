/**
 * Staging adapter for the pinned GeoAIDesk catalogue archive
 * (skill_hub docs/specs/gaid-interfaces.md §3; plan §2.3).
 *
 * The distribution pins one archive by version and sha256
 * (`geo/distribution.json` `catalogue`). This module finds that exact file,
 * checks its sha256, unpacks it into the skills cache, and checks every other
 * archive file against `manifest.files` and every runtime package against its
 * `packageDigest`. Nothing here installs into a project: `skills-sync.ts`
 * stays the only writer of live skill directories, and reads the staged
 * `runtime/skills/<runtimeName>/` trees through `fetchCatalogue()`.
 *
 * No network: a missing archive is reported with the places that were
 * searched. A different or modified archive is refused, never "fixed" by
 * taking whatever version is available.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KADY_SKILLS_CACHE_DIR, REPO_ROOT } from "../config.ts";
import { geoCatalogueEnabled, readDistributionCatalogue, type CataloguePin } from "./distribution.ts";
import type {
  GeoCatalogueIndex,
  GeoCatalogueManifest,
  GeoEnvironments,
  GeoWorkflow,
} from "./catalogue-types.ts";
import { readTarGz, type TarEntry } from "./tar.ts";

export type { CataloguePin };

export interface GeoCatalogue {
  version: string;
  sha256: string;
  /** `geo-catalogue@<version>+<sha12>`: recorded per project as the applied catalogue. */
  label: string;
  archivePath: string;
  /** Unpacked archive root (disposable staging, like the upstream skills cache). */
  root: string;
  /** `<root>/runtime/skills`: one `<runtimeName>/SKILL.md` tree per skill. */
  skillsDir: string;
  index: GeoCatalogueIndex;
  manifest: GeoCatalogueManifest;
  workflows: GeoWorkflow[];
  environments: GeoEnvironments | null;
  dataSources: unknown;
}

export type GeoCatalogueErrorCode =
  | "archive-missing"
  | "archive-digest"
  | "archive-invalid"
  | "file-digest"
  | "package-digest";

export class GeoCatalogueError extends Error {
  readonly code: GeoCatalogueErrorCode;
  readonly searched: string[];
  constructor(code: GeoCatalogueErrorCode, message: string, searched: string[] = []) {
    super(message);
    this.name = "GeoCatalogueError";
    this.code = code;
    this.searched = searched;
  }
}

const STAGED_MARKER = ".gaid-staged.json";

const sha256 = (bytes: Buffer | string): string =>
  crypto.createHash("sha256").update(bytes).digest("hex");

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(os.homedir(), value.slice(2));
  return value;
}

/** The pinned archive, or null when the distribution pins none (upstream behaviour). */
export function cataloguePin(repoRoot = REPO_ROOT): CataloguePin | null {
  return readDistributionCatalogue(repoRoot);
}

/**
 * Geo catalogue mode (`geoCatalogueEnabled`): when active, the archive
 * replaces the upstream catalogue sources everywhere (`fetchCatalogue`,
 * first-run seeding, explicit updates).
 */
export function geoCatalogueActive(env: NodeJS.ProcessEnv = process.env, repoRoot = REPO_ROOT): boolean {
  return geoCatalogueEnabled(repoRoot, env);
}

/** Candidate archive locations, most explicit first. */
export function archiveCandidates(
  pin: CataloguePin,
  env: NodeJS.ProcessEnv = process.env,
  repoRoot = REPO_ROOT,
): string[] {
  const candidates: string[] = [];
  const explicit = env.GAID_CATALOGUE_ARCHIVE?.trim();
  if (explicit) candidates.push(path.resolve(expandHome(explicit)));
  const home = env.GAID_HOME?.trim();
  if (home) candidates.push(path.join(path.resolve(expandHome(home)), "catalogue", pin.archive));
  candidates.push(path.join(repoRoot, "geo", "catalogue", pin.archive));
  // The named asset (configs/inputs.toml `geo_catalogue`) for development hosts.
  const assets = env.TASK_ASSETS_DIR?.trim() || path.join(os.homedir(), "assets");
  candidates.push(path.join(path.resolve(expandHome(assets)), "geo-catalogue", pin.version, pin.archive));
  return [...new Set(candidates)];
}

export function locateArchive(pin: CataloguePin, env: NodeJS.ProcessEnv = process.env, repoRoot = REPO_ROOT): string {
  const searched = archiveCandidates(pin, env, repoRoot);
  const found = searched.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
  if (!found) {
    throw new GeoCatalogueError(
      "archive-missing",
      `Catalogue archive ${pin.archive} (version ${pin.version}) was not found. ` +
        `Place it in one of: ${searched.join(", ")} (or set GAID_CATALOGUE_ARCHIVE).`,
      searched,
    );
  }
  return found;
}

/** sha256 of the sorted `path\0sha256\n` listing of a tree (the export's `packageDigest`). */
export function packageDigest(dir: string): string {
  const files: { path: string; sha256: string }[] = [];
  const walk = (current: string, rel: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (entry.isFile()) files.push({ path: relPath, sha256: sha256(fs.readFileSync(abs)) });
      else throw new GeoCatalogueError("package-digest", `Unexpected non-file entry ${abs}`);
    }
  };
  walk(dir, "");
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(files.map((f) => `${f.path}\0${f.sha256}\n`).join(""));
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function readOptionalJson<T>(file: string): T | null {
  return fs.existsSync(file) ? readJson<T>(file) : null;
}

/** Every check against the unpacked tree; throws on the first mismatch. */
function verifyStaged(root: string, pin: CataloguePin): GeoCatalogueManifest {
  const manifestFile = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestFile)) {
    throw new GeoCatalogueError("archive-invalid", "Catalogue archive has no manifest.json");
  }
  const manifest = readJson<GeoCatalogueManifest>(manifestFile);
  if (manifest.schemaVersion !== "geo-catalogue-manifest/v1") {
    throw new GeoCatalogueError("archive-invalid", `Unsupported manifest schema ${String(manifest.schemaVersion)}`);
  }
  if (manifest.catalogueVersion !== pin.version) {
    throw new GeoCatalogueError(
      "archive-invalid",
      `Archive holds catalogue ${manifest.catalogueVersion}, the distribution pins ${pin.version}`,
    );
  }
  for (const [rel, expected] of Object.entries(manifest.files ?? {})) {
    const file = path.join(root, ...rel.split("/"));
    if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== expected) {
      throw new GeoCatalogueError("file-digest", `Catalogue file ${rel} does not match the manifest`);
    }
  }
  for (const skill of manifest.runtimeSkills ?? []) {
    const dir = path.join(root, ...skill.packageRef.split("/"));
    if (!fs.existsSync(path.join(dir, "SKILL.md"))) {
      throw new GeoCatalogueError("package-digest", `Package ${skill.id} is missing from the archive`);
    }
    if (packageDigest(dir) !== skill.packageDigest) {
      throw new GeoCatalogueError("package-digest", `Package ${skill.id} does not match its packageDigest`);
    }
  }
  return manifest;
}

function writeEntries(root: string, entries: TarEntry[]): void {
  for (const entry of entries) {
    const target = path.join(root, ...entry.path.split("/"));
    if (entry.type === "directory") {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Executable bits survive (skill scripts); write bits are the user's umask.
    fs.writeFileSync(target, entry.data, { mode: entry.mode & 0o111 ? 0o755 : 0o644 });
  }
}

export function stagingDirFor(pin: CataloguePin, cacheDir = KADY_SKILLS_CACHE_DIR): string {
  return path.join(cacheDir, `geo-catalogue-${pin.version}-${pin.sha256.slice(0, 12)}`);
}

function stagedMarkerMatches(root: string, pin: CataloguePin): boolean {
  try {
    const marker = readJson<{ sha256?: string }>(path.join(root, STAGED_MARKER));
    return marker.sha256 === pin.sha256;
  } catch {
    return false;
  }
}

/** Unpack + verify into `<cacheDir>/geo-catalogue-<v>-<sha12>`, atomically. */
function stage(pin: CataloguePin, archivePath: string, cacheDir: string): string {
  const archive = fs.readFileSync(archivePath);
  if (sha256(archive) !== pin.sha256) {
    throw new GeoCatalogueError(
      "archive-digest",
      `${archivePath} does not match the pinned sha256 ${pin.sha256} for catalogue ${pin.version}`,
    );
  }
  let entries: TarEntry[];
  try {
    entries = readTarGz(archive);
  } catch (err) {
    throw new GeoCatalogueError("archive-invalid", `${archivePath}: ${(err as Error).message}`);
  }
  const target = stagingDirFor(pin, cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(cacheDir, ".geo-catalogue-"));
  try {
    writeEntries(tmp, entries);
    verifyStaged(tmp, pin);
    fs.writeFileSync(
      path.join(tmp, STAGED_MARKER),
      JSON.stringify({ sha256: pin.sha256, version: pin.version, archive: archivePath }, null, 2) + "\n",
    );
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
  return target;
}

export interface LoadGeoCatalogueOptions {
  env?: NodeJS.ProcessEnv;
  repoRoot?: string;
  cacheDir?: string;
  pin?: CataloguePin;
  /** Read-only summaries may reuse a verified tree, but must not stage or repair it. */
  readOnly?: boolean;
}

let cached: { key: string; catalogue: GeoCatalogue } | null = null;

/**
 * The verified, unpacked catalogue. Cached per process; the staged tree is
 * re-verified on first use in each process so a hand-edited cache is
 * replaced from the archive rather than installed.
 */
export function loadGeoCatalogue(options: LoadGeoCatalogueOptions = {}): GeoCatalogue {
  const env = options.env ?? process.env;
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const cacheDir = options.cacheDir ?? KADY_SKILLS_CACHE_DIR;
  const pin = options.pin ?? cataloguePin(repoRoot);
  if (!pin) throw new GeoCatalogueError("archive-missing", "This distribution pins no catalogue archive");
  const key = `${pin.sha256}\0${cacheDir}`;
  if (cached?.key === key && fs.existsSync(cached.catalogue.root)) return cached.catalogue;

  let root = stagingDirFor(pin, cacheDir);
  let archivePath: string;
  let reused = false;
  if (stagedMarkerMatches(root, pin)) {
    try {
      verifyStaged(root, pin);
      reused = true;
    } catch {
      reused = false;
    }
  }
  if (reused) {
    archivePath =
      readJson<{ archive?: string }>(path.join(root, STAGED_MARKER)).archive ?? stagingDirFor(pin, cacheDir);
  } else {
    if (options.readOnly) throw new GeoCatalogueError("archive-missing", "No verified staged catalogue is available for read-only use");
    archivePath = locateArchive(pin, env, repoRoot);
    root = stage(pin, archivePath, cacheDir);
  }
  const manifest = readJson<GeoCatalogueManifest>(path.join(root, "manifest.json"));
  const workflows = readOptionalJson<GeoWorkflow[]>(path.join(root, "workflows.json")) ?? [];
  const catalogue: GeoCatalogue = {
    version: pin.version,
    sha256: pin.sha256,
    label: `geo-catalogue@${pin.version}+${pin.sha256.slice(0, 12)}`,
    archivePath,
    root,
    skillsDir: path.join(root, "runtime", "skills"),
    index: readJson<GeoCatalogueIndex>(path.join(root, "catalogue", "index.json")),
    manifest,
    workflows: Array.isArray(workflows) ? workflows : [],
    environments: readOptionalJson<GeoEnvironments>(path.join(root, "environments.json")),
    dataSources: readOptionalJson<unknown>(path.join(root, "data-sources.json")),
  };
  cached = { key, catalogue };
  return catalogue;
}

/** Drop the per-process cache (tests). */
export function resetGeoCatalogueCache(): void {
  cached = null;
}

/** `runtimeName → staged package dir` for every runtime skill. */
export function geoCatalogueSkillDirs(catalogue: GeoCatalogue): Map<string, string> {
  const dirs = new Map<string, string>();
  for (const skill of catalogue.manifest.runtimeSkills) {
    dirs.set(skill.runtimeName, path.join(catalogue.root, ...skill.packageRef.split("/")));
  }
  return dirs;
}

/** Atlas id (`publisher/slug`) → runtime name. */
export function runtimeNameFor(catalogue: GeoCatalogue, atlasId: string): string | undefined {
  return catalogue.index.skills.find((skill) => skill.id === atlasId)?.runtimeName;
}

export type GeoCatalogueStatus =
  | { state: "off" }
  | { state: "ready"; version: string; sha256: string; label: string; skills: number; workflows: number }
  | { state: "error"; version: string; code: GeoCatalogueErrorCode | "unknown"; message: string; searched?: string[] };

/** Status for routes and the launcher log; never throws. */
export function geoCatalogueStatus(options: LoadGeoCatalogueOptions = {}): GeoCatalogueStatus {
  let pin: CataloguePin | null;
  try {
    pin = options.pin ?? cataloguePin(options.repoRoot ?? REPO_ROOT);
  } catch (err) {
    return { state: "error", version: "?", code: "unknown", message: (err as Error).message };
  }
  if (!pin || !geoCatalogueActive(options.env ?? process.env, options.repoRoot ?? REPO_ROOT)) return { state: "off" };
  try {
    const catalogue = loadGeoCatalogue({ ...options, pin });
    return {
      state: "ready",
      version: catalogue.version,
      sha256: catalogue.sha256,
      label: catalogue.label,
      skills: catalogue.manifest.runtimeSkills.length,
      workflows: catalogue.workflows.length,
    };
  } catch (err) {
    const code = err instanceof GeoCatalogueError ? err.code : "unknown";
    return {
      state: "error",
      version: pin.version,
      code,
      message: (err as Error).message,
      ...(err instanceof GeoCatalogueError && err.searched.length ? { searched: err.searched } : {}),
    };
  }
}
