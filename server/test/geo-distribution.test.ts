import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_EXTRA_SOURCES, MANAGED_ENV_FILE, REPO_ROOT } from "../src/config.ts";
import {
  applyCatalogueExclusions,
  pickLatestRelease,
  readDistributionExclusions,
  readDistributionRelease,
  remoteComputeEnabled,
} from "../src/geo/distribution.ts";

const sources = [
  { repo: "anthropics/skills", branch: "main", skills: ["docx", "pdf", "pptx", "xlsx"] },
  { repo: "other/skills", branch: "main", skills: ["a", "b"] },
];

function tempRepo(manifest: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-dist-"));
  if (manifest !== null) {
    fs.mkdirSync(path.join(dir, "geo"));
    fs.writeFileSync(path.join(dir, "geo", "distribution.json"), manifest);
  }
  return dir;
}

describe("GeoAIDesk distribution policy", () => {
  it("does not fetch the excluded anthropics/skills document skills", () => {
    expect(CATALOGUE_EXTRA_SOURCES.flatMap((s) => s.skills)).not.toEqual(
      expect.arrayContaining(["docx"]),
    );
    expect(CATALOGUE_EXTRA_SOURCES.some((s) => s.repo.toLowerCase() === "anthropics/skills")).toBe(false);
  });

  it("drops listed skills, whole sources, and empty sources", () => {
    expect(
      applyCatalogueExclusions(sources, [{ repo: "Anthropics/Skills", skills: ["docx", "pdf"], reason: "r" }]),
    ).toEqual([
      { repo: "anthropics/skills", branch: "main", skills: ["pptx", "xlsx"] },
      sources[1],
    ]);
    expect(applyCatalogueExclusions(sources, [{ repo: "other/skills", reason: "r" }])).toEqual([sources[0]]);
    expect(
      applyCatalogueExclusions(sources, [{ repo: "anthropics/skills", skills: ["docx", "pdf", "pptx", "xlsx"], reason: "r" }]),
    ).toEqual([sources[1]]);
  });

  it("reads the shipped manifest", () => {
    expect(readDistributionExclusions(REPO_ROOT)).toEqual([
      expect.objectContaining({ repo: "anthropics/skills", skills: ["docx", "pdf", "pptx", "xlsx"] }),
    ]);
    expect(readDistributionRelease(REPO_ROOT)).toEqual(
      expect.objectContaining({ repository: "kigam-research/geoaidesk", releaseTagPrefix: "geo-v" }),
    );
  });

  it("disables remote compute only for the distribution launcher in geo mode", () => {
    expect(remoteComputeEnabled(REPO_ROOT, { GAID_DISTRIBUTION: "1" })).toBe(false);
    expect(remoteComputeEnabled(REPO_ROOT, {})).toBe(true);
    for (const env of [{ GAID_CATALOGUE: "off" }, { KADY_SKILLS_REPO: "other/skills" }]) {
      expect(remoteComputeEnabled(REPO_ROOT, { GAID_DISTRIBUTION: "1", ...env })).toBe(true);
    }
    expect(remoteComputeEnabled(tempRepo(null), { GAID_DISTRIBUTION: "1" })).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "geo/distribution.json"), "utf8"));
    delete manifest.features;
    expect(remoteComputeEnabled(tempRepo(JSON.stringify(manifest)), { GAID_DISTRIBUTION: "1" })).toBe(true);
    manifest.features = { remoteCompute: true };
    expect(remoteComputeEnabled(tempRepo(JSON.stringify(manifest)), { GAID_DISTRIBUTION: "1" })).toBe(true);
    manifest.features.remoteCompute = "false";
    expect(() => remoteComputeEnabled(tempRepo(JSON.stringify(manifest)), { GAID_DISTRIBUTION: "1" })).toThrow(/boolean/);
  });

  it("treats a missing manifest as an upstream checkout and a malformed one as an error", () => {
    expect(readDistributionExclusions(tempRepo(null))).toEqual([]);
    expect(readDistributionRelease(tempRepo(null))).toBeNull();
    expect(() => readDistributionExclusions(tempRepo("{"))).toThrow();
    expect(() =>
      readDistributionExclusions(tempRepo(JSON.stringify({ catalogue: { excludedSources: [{ repo: "x" }] } }))),
    ).toThrow(/repo must be/);
    expect(() =>
      readDistributionExclusions(
        tempRepo(JSON.stringify({ catalogue: { excludedSources: [{ repo: "a/b", skills: ["x"] }] } })),
      ),
    ).toThrow(/reason is required/);
  });

  it("writes Settings keys to the repo-root .env unless KADY_ENV_FILE is set", () => {
    if (process.env.KADY_ENV_FILE?.trim()) return;
    expect(MANAGED_ENV_FILE).toBe(path.join(REPO_ROOT, ".env"));
  });
});

describe("pickLatestRelease", () => {
  const releases = [
    { tag_name: "geo-catalogue-0.2.1", prerelease: true },
    { tag_name: "geo-v0.1.0", prerelease: true },
    { tag_name: "geo-v0.10.0", draft: true },
    { tag_name: "geo-v0.2.0-rc.1", prerelease: true },
    { tag_name: "geo-v0.2.0", prerelease: true },
    { tag_name: "v9.9.9" },
  ];
  it("picks the highest published app tag, prereleases included on the preview channel", () => {
    expect(pickLatestRelease(releases, "geo-v", true)).toBe("0.2.0");
    expect(pickLatestRelease(releases.slice(0, 4), "geo-v", true)).toBe("0.2.0-rc.1");
  });
  it("ignores drafts, other tags and, on the stable channel, prereleases", () => {
    expect(pickLatestRelease(releases, "geo-v", false)).toBeNull();
    expect(pickLatestRelease([...releases, { tag_name: "geo-v0.1.1" }], "geo-v", false)).toBe("0.1.1");
    expect(pickLatestRelease([], "geo-v", true)).toBeNull();
  });
});
