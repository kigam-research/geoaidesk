#!/usr/bin/env node
/**
 * Build a geo catalogue release in this repository (ADR docs/adr/2026-10-22-gaid-builds-catalogue.md).
 *
 *   node geo/catalogue-build.mjs --release geo/catalogue-src/releases/0.3.0.json --out <dir>
 *   node geo/catalogue-build.mjs --release ... --out <dir> --lock    # (re)write geo/catalogue-src/sources.lock.json
 *
 * The previous release archive is the verified base; the release file adds imported skills from a pinned source asset
 * (files checked against sources.lock.json) with GAID-owned profiles, and optional environments. The output keeps the
 * geo-catalogue/v1 index and geo-catalogue-manifest/v1 contracts that server/src/geo/catalogue.ts verifies.
 * Needs GNU tar (deterministic archives). Never writes inside the checkout except the lock file with --lock.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireServer = createRequire(path.join(repoRoot, "server", "package.json"));
const YAML = requireServer("yaml");
const { Ajv2020 } = requireServer("ajv/dist/2020.js");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const expandHome = (p) => (p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p);
const assetsRoot = () => expandHome(process.env.TASK_ASSETS_DIR ?? "~/assets");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function git(args) {
  const r = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(dir, relPath));
    else if (entry.isFile()) out.push(relPath);
    else throw new Error(`Unexpected non-file entry ${path.join(dir, relPath)}`);
  }
  return out.sort();
}

/** sha256 of the sorted `path\0sha256\n` listing (same as catalogue.ts packageDigest). */
function treeDigest(files) {
  return sha256([...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path}\0${f.sha256}\n`).join(""));
}

function put(root, rel, bytes) {
  const target = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}

function untar(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const r = spawnSync("tar", ["-xzf", archive, "-C", dest], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`tar could not unpack ${archive}`);
}

/** Deterministic archive, same flags as the skill_hub export it replaces. */
function tarGz(dir, names, dest) {
  const r = spawnSync(
    "tar",
    ["--sort=name", "--format=gnu", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "--mode=a+rX,u+w,go-w", "-C", dir, "-cf", "-", "--", ...[...names].sort()],
    { maxBuffer: 1 << 30 },
  );
  if (r.status !== 0) throw new Error(`tar failed: ${dest}`);
  const bytes = zlib.gzipSync(r.stdout, { level: 9 });
  fs.writeFileSync(dest, bytes);
  return sha256(bytes);
}

function frontmatterName(markdown) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1];
  const name = fm ? YAML.parse(fm)?.name : undefined;
  return typeof name === "string" ? name : undefined;
}

/** Top-level modules imported by Python files, minus the standard library and local modules. */
function pythonImports(files, stdlib) {
  const local = new Set(files.filter((f) => f.path.endsWith(".py")).map((f) => path.basename(f.path, ".py")));
  const found = new Set();
  for (const f of files) {
    if (!f.path.endsWith(".py")) continue;
    for (const m of f.bytes.toString("utf-8").matchAll(/^\s*(?:from\s+([A-Za-z_][\w]*)[\w.]*\s+import|import\s+([A-Za-z_][\w]*))/gm)) {
      const name = m[1] ?? m[2];
      if (name && !stdlib.has(name) && !local.has(name) && name !== "__future__") found.add(name);
    }
  }
  return [...found].sort();
}

function pythonStdlib() {
  for (const cmd of [["uv", ["run", "--no-project", "python", "-I", "-c", "import sys;print('\\n'.join(sorted(sys.stdlib_module_names)))"]], ["python3", ["-I", "-c", "import sys;print('\\n'.join(sorted(sys.stdlib_module_names)))"]]]) {
    const r = spawnSync(cmd[0], cmd[1], { encoding: "utf-8" });
    if (r.status === 0 && r.stdout.trim()) return new Set(r.stdout.split("\n").map((s) => s.trim()).filter(Boolean));
  }
  throw new Error("Python 3.10+ is needed to list standard-library modules");
}

/** The checks of server/src/geo/catalogue.ts verifyStaged against an unpacked tree. */
function verifyTree(root, version) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf-8"));
  if (manifest.schemaVersion !== "geo-catalogue-manifest/v1") throw new Error(`Unsupported manifest ${manifest.schemaVersion}`);
  if (manifest.catalogueVersion !== version) throw new Error(`Archive holds ${manifest.catalogueVersion}, expected ${version}`);
  for (const [rel, expected] of Object.entries(manifest.files)) {
    const file = path.join(root, ...rel.split("/"));
    if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== expected) throw new Error(`Catalogue file ${rel} does not match the manifest`);
  }
  for (const skill of manifest.runtimeSkills) {
    const dir = path.join(root, ...skill.packageRef.split("/"));
    const files = walk(dir).map((p) => ({ path: p, sha256: sha256(fs.readFileSync(path.join(dir, p))) }));
    if (treeDigest(files) !== skill.packageDigest) throw new Error(`Package ${skill.id} does not match its packageDigest`);
  }
  return manifest;
}

function profileIndexEntry(profile, pkg, extra) {
  const ko = (v) => (typeof v === "string" ? { ko: v } : v);
  const outputKinds = [...new Set((profile.outputs ?? []).map((o) => o.kind))].sort();
  return {
    id: profile.id,
    runtimeName: pkg.runtimeName,
    origin: profile.source.kind,
    kind: profile.kind,
    releaseState: profile.release.state,
    title: ko(profile.title),
    taskLine: ko(profile.tagline),
    disciplines: profile.taxonomy.disciplines ?? [],
    tasks: profile.taxonomy.tasks ?? [],
    dataTypes: profile.taxonomy.dataTypes ?? [],
    inputFormats: profile.taxonomy.formats ?? [],
    outputKinds,
    limitations: (profile.limitations ?? []).map((l) => ko(l.text)),
    packageRef: `runtime/skills/${pkg.runtimeName}`,
    packageDigest: pkg.digest,
    fileCount: pkg.files.length,
    sourceRevision: { kind: profile.source.kind, repository: profile.source.repository, commit: profile.source.commit, path: profile.source.path, upstreamVersion: profile.source.upstreamVersion },
    profileEdition: profile.release.atlasVersion,
    packIds: [],
    workflowIds: [],
    environmentIds: extra.environmentIds ?? [],
    compatibilityRefs: [],
    evidence: [],
    credits: { publisher: profile.credits.publisher, authors: profile.credits.authors.map((a) => a.name), ...(profile.credits.citation ? { citation: profile.credits.citation } : {}) },
    licenses: profile.licenses.map((l) => ({ component: l.component, declared: l.declared, ...(l.spdx ? { spdx: l.spdx } : {}), ...(l.noticeFile ? { noticeFile: l.noticeFile, noticeIn: "package" } : {}) })),
    dependencies: profile.dependencies ?? [],
    pythonImports: pkg.pythonImports,
    network: profile.network ?? "none",
    credentials: extra.credentials ?? [],
    exampleIds: [],
  };
}

function noticeSection(entry) {
  const src = entry.sourceRevision;
  const lines = [
    `## ${entry.id} (${entry.packageRef})`,
    "",
    `Source: ${src.repository}@${src.commit} ${src.path} (version ${src.upstreamVersion})`,
    `Credits: ${entry.credits.publisher} — ${entry.credits.authors.join(", ")}`,
    ...entry.licenses.map((l) => `- ${l.component}: ${l.declared}${l.spdx ? ` (${l.spdx})` : ""}${l.noticeFile ? ` — ${entry.packageRef}/${l.noticeFile}` : ""}`),
    "",
  ];
  return lines.join("\n");
}

export function buildCatalogue({ releaseFile, out, writeLock = false, sourceRootOverride, baseDirOverride }) {
  const release = JSON.parse(fs.readFileSync(releaseFile, "utf-8"));
  if (release.schemaVersion !== "gaid-catalogue-build/v1") throw new Error(`Unsupported release file ${release.schemaVersion}`);
  const srcDir = path.dirname(path.dirname(releaseFile));
  const lockFile = path.join(srcDir, "sources.lock.json");
  const lock = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, "utf-8")) : { schemaVersion: "gaid-catalogue-sources-lock/v1", sources: {} };
  const atlasSchema = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo", "hub", "schemas", "atlas-profile.schema.json"), "utf-8"));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(atlasSchema);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-catalogue-build-"));
  try {
    // --- base release: verified archive and examples
    const base = release.base;
    const baseDir = baseDirOverride ?? path.join(assetsRoot(), "geo-catalogue", base.version);
    const baseArchive = path.join(baseDir, `geo-catalogue-${base.version}.tar.gz`);
    const baseExamples = path.join(baseDir, `geo-examples-${base.version}.tar.gz`);
    if (sha256(fs.readFileSync(baseArchive)) !== base.sha256) throw new Error(`${baseArchive}: sha256 differs from the release file`);
    if (sha256(fs.readFileSync(baseExamples)) !== base.examplesSha256) throw new Error(`${baseExamples}: sha256 differs from the release file`);
    const cat = path.join(work, "catalogue");
    untar(baseArchive, cat);
    const baseManifest = verifyTree(cat, base.version);
    fs.rmSync(path.join(cat, "manifest.json"));

    const index = JSON.parse(fs.readFileSync(path.join(cat, "catalogue", "index.json"), "utf-8"));
    const stdlib = pythonStdlib();
    const added = [];
    // --- added imported skills
    for (const add of release.add ?? []) {
      const source = release.sources[add.source];
      if (!source) throw new Error(`${add.id}: unknown source ${add.source}`);
      const sourceRoot = sourceRootOverride ?? path.join(assetsRoot(), source.assetPath);
      const profile = YAML.parse(fs.readFileSync(path.join(srcDir, add.profile), "utf-8"));
      if (!validate(profile)) throw new Error(`${add.profile}: ${validate.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`);
      if (profile.id !== add.id || profile.source.kind !== "import" || profile.source.repository !== source.repository || profile.source.commit !== source.commit || profile.source.path !== add.path) {
        throw new Error(`${add.profile}: id/source does not match the release file`);
      }
      if (index.skills.some((s) => s.id === add.id)) throw new Error(`${add.id} is already in the base catalogue`);
      const skillDir = path.join(sourceRoot, ...add.path.split("/"));
      const files = walk(skillDir).map((p) => ({ path: p, bytes: fs.readFileSync(path.join(skillDir, p)), from: `${add.path}/${p}` }));
      for (const notice of source.notices ?? []) {
        if (files.some((f) => f.path === notice)) throw new Error(`${add.id}: ${notice} would replace a package file`);
        files.push({ path: notice, bytes: fs.readFileSync(path.join(sourceRoot, notice)), from: `@repository/${notice}` });
      }
      const hashes = Object.fromEntries(files.map((f) => [f.from, sha256(f.bytes)]));
      if (writeLock) lock.sources[add.id] = { repository: source.repository, commit: source.commit, path: add.path, files: hashes };
      else {
        const locked = lock.sources[add.id];
        if (!locked) throw new Error(`${add.id} is not in ${lockFile}; run with --lock after reviewing the source`);
        const a = JSON.stringify(Object.entries(locked.files).sort()), b = JSON.stringify(Object.entries(hashes).sort());
        if (locked.commit !== source.commit || a !== b) throw new Error(`${add.id}: source files differ from ${lockFile}`);
      }
      const runtimeName = frontmatterName(files.find((f) => f.path === "SKILL.md")?.bytes.toString("utf-8") ?? "");
      if (!runtimeName || runtimeName !== path.basename(add.path)) throw new Error(`${add.id}: SKILL.md name ${runtimeName} != folder ${path.basename(add.path)}`);
      if (index.skills.some((s) => s.runtimeName === runtimeName)) throw new Error(`${add.id}: runtime name ${runtimeName} already used`);
      const imports = pythonImports(files, stdlib);
      const declared = [...(add.pythonImports ?? [])].sort();
      if (JSON.stringify(imports) !== JSON.stringify(declared)) throw new Error(`${add.id}: scripts import ${imports.join(", ") || "nothing"}, release file declares ${declared.join(", ") || "nothing"}`);
      const pkgFiles = files.map((f) => ({ path: f.path, sha256: sha256(f.bytes) }));
      for (const f of files) put(cat, `runtime/skills/${runtimeName}/${f.path}`, f.bytes);
      const entry = profileIndexEntry(profile, { runtimeName, files: pkgFiles, digest: treeDigest(pkgFiles), pythonImports: imports }, add);
      index.skills.push(entry);
      put(cat, `catalogue/details/${add.id}.json`, json({ schemaVersion: "atlas-catalog/v1", profile }));
      added.push(entry);
    }

    // --- environments
    if (release.environments?.add?.length) {
      const envFile = path.join(cat, "environments.json");
      const envs = JSON.parse(fs.readFileSync(envFile, "utf-8"));
      for (const env of release.environments.add) {
        if (envs.environments.some((e) => e.id === env.id)) throw new Error(`Environment ${env.id} exists in the base`);
        if (env.extends && !envs.environments.some((e) => e.id === env.extends)) throw new Error(`Environment ${env.id} extends unknown ${env.extends}`);
        envs.environments.push(env);
      }
      fs.writeFileSync(envFile, json(envs));
    }
    for (const entry of added) for (const id of entry.environmentIds) {
      const envs = JSON.parse(fs.readFileSync(path.join(cat, "environments.json"), "utf-8")).environments;
      if (!envs.some((e) => e.id === id)) throw new Error(`${entry.id}: unknown environment ${id}`);
    }

    // --- index, notices
    const sourceCommit = process.env.GAID_CATALOGUE_SOURCE_COMMIT ?? git(["rev-parse", "HEAD"]);
    if (!sourceCommit) throw new Error("No Git checkout: set GAID_CATALOGUE_SOURCE_COMMIT");
    const dirty = !process.env.GAID_CATALOGUE_SOURCE_COMMIT && !!git(["status", "--porcelain", "--", "geo/catalogue-src", "geo/catalogue-build.mjs"]);
    const generatedFrom = { repository: "kigam-research/geoaidesk", sourceCommit, dirty };
    index.catalogueVersion = release.catalogueVersion;
    index.generatedFrom = generatedFrom;
    fs.writeFileSync(path.join(cat, "catalogue", "index.json"), json(index));
    const noticeFile = path.join(cat, "notices", "NOTICE.md");
    const notice = fs.readFileSync(noticeFile, "utf-8").replace(/^# GeoAIDesk catalogue \S+:/m, `# GeoAIDesk catalogue ${release.catalogueVersion}:`);
    fs.writeFileSync(noticeFile, notice.trimEnd() + "\n\n" + added.map(noticeSection).join("\n"));

    // --- examples: unchanged cases, new version label
    const ex = path.join(work, "examples");
    untar(baseExamples, ex);
    const exIndexFile = path.join(ex, "examples", "index.json");
    const exIndex = JSON.parse(fs.readFileSync(exIndexFile, "utf-8"));
    exIndex.catalogueVersion = release.catalogueVersion;
    fs.writeFileSync(exIndexFile, json(exIndex));
    fs.mkdirSync(out, { recursive: true });
    const examplesName = `geo-examples-${release.catalogueVersion}.tar.gz`;
    const examplesSha256 = tarGz(ex, ["examples"], path.join(out, examplesName));
    fs.writeFileSync(path.join(out, `${examplesName}.sha256`), `${examplesSha256}  ${examplesName}\n`);

    // --- manifest and archive
    const filesDigest = Object.fromEntries(walk(cat).map((rel) => [rel, sha256(fs.readFileSync(path.join(cat, rel)))]));
    const manifest = {
      schemaVersion: "geo-catalogue-manifest/v1",
      catalogueVersion: release.catalogueVersion,
      generatedFrom,
      contracts: baseManifest.contracts,
      runtimeSkills: index.skills.map((s) => ({ id: s.id, runtimeName: s.runtimeName, packageRef: s.packageRef, packageDigest: s.packageDigest })),
      included: baseManifest.included,
      examples: { archive: examplesName, sha256: examplesSha256, caseCount: exIndex.cases.length },
      files: filesDigest,
    };
    fs.writeFileSync(path.join(cat, "manifest.json"), json(manifest));
    verifyTree(cat, release.catalogueVersion);
    const archiveName = `geo-catalogue-${release.catalogueVersion}.tar.gz`;
    const archiveSha256 = tarGz(cat, fs.readdirSync(cat), path.join(out, archiveName));
    fs.writeFileSync(path.join(out, `${archiveName}.sha256`), `${archiveSha256}  ${archiveName}\n`);
    const manifestCopy = `geo-catalogue-${release.catalogueVersion}.manifest.json`;
    fs.writeFileSync(path.join(out, manifestCopy), json(manifest));

    // --- the archive as the app reads it
    const check = path.join(work, "check");
    untar(path.join(out, archiveName), check);
    verifyTree(check, release.catalogueVersion);

    if (writeLock) fs.writeFileSync(lockFile, json(lock));
    return { archive: path.join(out, archiveName), sha256: archiveSha256, examplesSha256, manifest, added: added.map((a) => a.id) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const releaseFile = arg("--release");
  const out = arg("--out");
  if (!releaseFile || !out) {
    console.error("usage: node geo/catalogue-build.mjs --release <file> --out <dir> [--lock]");
    process.exit(2);
  }
  const outDir = path.resolve(expandHome(out));
  if (outDir === repoRoot || outDir.startsWith(repoRoot + path.sep)) {
    console.error("--out must be outside the checkout");
    process.exit(2);
  }
  const result = buildCatalogue({ releaseFile: path.resolve(releaseFile), out: outDir, writeLock: process.argv.includes("--lock") });
  console.log(`${path.basename(result.archive)} sha256 ${result.sha256}`);
  console.log(`examples sha256 ${result.examplesSha256}`);
  console.log(`added: ${result.added.join(", ")}`);
  console.log(`runtime skills: ${result.manifest.runtimeSkills.length}`);
}
