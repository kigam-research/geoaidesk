#!/usr/bin/env node
/**
 * Publish and check the pinned geo catalogue archive as a GitHub Release asset
 * of this repository (gaid-runtime#2: the launcher downloads
 * `catalogue.download.url` and keeps it only when the sha256 matches).
 *
 *   node geo/catalogue-release.mjs --dir ~/assets/geo-catalogue/0.2.1           # check files, print the command
 *   node geo/catalogue-release.mjs --dir ~/assets/geo-catalogue/0.2.1 --publish # create the release (gh CLI)
 *   node geo/catalogue-release.mjs --verify-remote                              # download the URL, check sha256
 *
 * The release is a prerelease named after `catalogue.download.release`, so it
 * never becomes the repository's "latest" release and the app's update check
 * (`geo-v*` tags only) ignores it. Publishing is an outward action: run it only
 * when the maintainer approved the publication.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadCatalogue, expandHome } from "./start.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distribution = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo", "distribution.json"), "utf-8"));
const catalogue = distribution.catalogue;

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** The release tag and asset name the pinned URL names; throws when they disagree with the pin. */
export function releaseTarget(cat = catalogue, repository = distribution.repository) {
  const url = cat?.download?.url;
  if (!url) throw new Error("geo/distribution.json catalogue.download.url is not set");
  const prefix = `https://github.com/${repository}/releases/download/`;
  if (!url.startsWith(prefix)) throw new Error(`download.url must start with ${prefix}`);
  const [tag, asset, ...rest] = url.slice(prefix.length).split("/");
  if (rest.length || !tag || !asset) throw new Error(`download.url must be ${prefix}<tag>/<asset>`);
  if (tag !== cat.download.release) throw new Error(`download.url tag ${tag} != download.release ${cat.download.release}`);
  if (asset !== cat.archive) throw new Error(`download.url asset ${asset} != archive ${cat.archive}`);
  return { tag, asset };
}

function notes() {
  return [
    `GeoAIDesk skill catalogue ${catalogue.version}, exported from kigam-research/skill_hub \`${catalogue.sourceCommit}\`.`,
    "",
    "The GeoAIDesk launcher downloads this archive into `<GAID_HOME>/catalogue/` and keeps it only when its sha256",
    `matches \`geo/distribution.json\`: \`${catalogue.sha256}\`.`,
    "",
    "Each skill keeps its own licence and notices (`notices/NOTICE.md` in the archive). This is a data release for the",
    "app, not an app release; app releases are tagged `" + distribution.releaseTagPrefix + "<version>`.",
  ].join("\n");
}

function checkDir(dir) {
  const files = [catalogue.archive, `${catalogue.archive}.sha256`];
  for (const name of files) if (!fs.existsSync(path.join(dir, name))) throw new Error(`${path.join(dir, name)} is missing`);
  const actual = sha256File(path.join(dir, catalogue.archive));
  if (actual !== catalogue.sha256) throw new Error(`${catalogue.archive}: sha256 ${actual} != pinned ${catalogue.sha256}`);
  const sidecar = fs.readFileSync(path.join(dir, `${catalogue.archive}.sha256`), "utf-8").trim().split(/\s+/)[0];
  if (sidecar !== catalogue.sha256) throw new Error(`${catalogue.archive}.sha256 names ${sidecar}`);
  const manifest = path.join(dir, `geo-catalogue-${catalogue.version}.manifest.json`);
  return fs.existsSync(manifest) ? [...files, path.basename(manifest)] : files;
}

async function main() {
  const { tag } = releaseTarget();
  if (process.argv.includes("--verify-remote")) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-catalogue-"));
    try {
      await downloadCatalogue({ url: catalogue.download.url, target: path.join(dir, catalogue.archive), sha256: catalogue.sha256 });
      console.log(`${catalogue.download.url}: sha256 ${catalogue.sha256} ok`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    return;
  }
  const dirArg = arg("--dir");
  if (!dirArg) throw new Error("--dir <asset directory> is required");
  const dir = path.resolve(expandHome(dirArg));
  const files = checkDir(dir).map((name) => path.join(dir, name));
  const notesFile = path.join(os.tmpdir(), `gaid-catalogue-notes-${process.pid}.md`);
  fs.writeFileSync(notesFile, notes());
  const args = [
    "release", "create", tag, ...files,
    "--repo", distribution.repository,
    "--prerelease",
    "--title", `GeoAIDesk catalogue ${catalogue.version}`,
    "--notes-file", notesFile,
    "--target", "main",
  ];
  console.log(`files ok (sha256 ${catalogue.sha256})`);
  if (!process.argv.includes("--publish")) {
    console.log(`would run: gh ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
    console.log(notes());
    return;
  }
  const res = spawnSync("gh", args, { stdio: "inherit" });
  fs.rmSync(notesFile, { force: true });
  if (res.status !== 0) throw new Error(`gh release create failed (${res.status})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
