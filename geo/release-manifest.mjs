#!/usr/bin/env node
/**
 * Build the GeoAIDesk release assets after the checks and the UI build ran:
 * a source archive of the exact commit, a release manifest naming that commit
 * (generated, never tracked, so it can hold the real app commit), and
 * SHA256SUMS.
 *
 *   node geo/release-manifest.mjs --tag geo-v0.1.0 --out <dir> [--allow-dirty]
 *   node geo/release-manifest.mjs --verify-tag geo-v0.1.0
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf-8"));

export function expectedTag(distribution) {
  return `${distribution.releaseTagPrefix}${distribution.version}`;
}

function git(args) {
  const res = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr.trim()}`);
  return res.stdout.trim();
}

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const distribution = readJson("geo/distribution.json");
  const tag = arg("--verify-tag") ?? arg("--tag");
  if (!tag) throw new Error("--tag <tag> is required");
  if (tag !== expectedTag(distribution)) {
    throw new Error(`tag ${tag} does not match geo/distribution.json (${expectedTag(distribution)})`);
  }
  if (process.argv.includes("--verify-tag")) {
    console.log(`tag ${tag} matches geo/distribution.json`);
    return;
  }
  const out = path.resolve(arg("--out") ?? "dist");
  if (git(["status", "--porcelain", "--untracked-files=no"]) && !process.argv.includes("--allow-dirty")) {
    throw new Error("tracked files have uncommitted changes; release from a clean checkout");
  }
  const upstream = readJson("geo/upstream.lock.json");
  const appCommit = git(["rev-parse", "HEAD"]);
  const base = `${distribution.appId}-${distribution.version}`;
  fs.mkdirSync(out, { recursive: true });
  const archive = path.join(out, `${base}-source.tar.gz`);
  git(["archive", "--format=tar.gz", `--prefix=${base}/`, "-o", archive, appCommit]);
  const manifest = {
    schema: "gaid-release-manifest/v1",
    productName: distribution.productName,
    version: distribution.version,
    tag,
    channel: distribution.channel,
    repository: distribution.repository,
    appCommit,
    generatedAt: new Date().toISOString(),
    upstream: {
      repository: upstream.repository,
      commit: upstream.commit,
      packageVersion: upstream.packageVersion,
    },
    serverPackageVersion: readJson("server/package.json").version,
    harness: upstream.harness,
    catalogue: {
      status: distribution.catalogue.status,
      version: distribution.catalogue.version,
      sha256: distribution.catalogue.sha256,
      download: distribution.catalogue.download?.url ?? null,
      excludedSources: distribution.catalogue.excludedSources.map(({ repo, skills }) => ({ repo, skills })),
    },
    assets: [{ name: path.basename(archive), sha256: sha256File(archive), bytes: fs.statSync(archive).size }],
  };
  const manifestFile = path.join(out, `${base}-manifest.json`);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  const sums = [archive, manifestFile].map((f) => `${sha256File(f)}  ${path.basename(f)}`).join("\n") + "\n";
  fs.writeFileSync(path.join(out, "SHA256SUMS"), sums);
  console.log(`release assets for ${tag} (${appCommit}) in ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`release-manifest: ${error.message}`);
    process.exit(1);
  }
}
