// The pinned catalogue archive is reproducible from geo/catalogue-src (docs/adr/2026-10-22-gaid-builds-catalogue.md).
// Needs the base and source assets under ~/assets (TASK_ASSETS_DIR); skipped when they are absent.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const distribution = JSON.parse(fs.readFileSync(path.join(repoRoot, "geo", "distribution.json"), "utf-8"));
const pin = distribution.catalogue;
const releaseFile = path.join(repoRoot, "geo", "catalogue-src", "releases", `${pin.version}.json`);
const assets = process.env.TASK_ASSETS_DIR ?? path.join(os.homedir(), "assets");
const release = fs.existsSync(releaseFile) ? JSON.parse(fs.readFileSync(releaseFile, "utf-8")) : null;
const present =
  release &&
  fs.existsSync(path.join(assets, "geo-catalogue", release.base.version, `geo-catalogue-${release.base.version}.tar.gz`)) &&
  Object.values(release.sources).every((s) => fs.existsSync(path.join(assets, s.assetPath)));

test("the pinned catalogue rebuilds byte for byte from geo/catalogue-src", { skip: present ? false : "base or source asset not present" }, async () => {
  const { buildCatalogue } = await import("../catalogue-build.mjs");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-catalogue-test-"));
  const previous = process.env.GAID_CATALOGUE_SOURCE_COMMIT;
  process.env.GAID_CATALOGUE_SOURCE_COMMIT = pin.sourceCommit;
  try {
    const result = buildCatalogue({ releaseFile, out });
    assert.equal(result.sha256, pin.sha256);
    assert.equal(result.examplesSha256, pin.examples.sha256);
  } finally {
    if (previous === undefined) delete process.env.GAID_CATALOGUE_SOURCE_COMMIT;
    else process.env.GAID_CATALOGUE_SOURCE_COMMIT = previous;
    fs.rmSync(out, { recursive: true, force: true });
  }
});
