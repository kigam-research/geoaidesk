import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveCandidates,
  GeoCatalogueError,
  geoCatalogueSkillDirs,
  geoCatalogueStatus,
  loadGeoCatalogue,
  packageDigest,
  resetGeoCatalogueCache,
  stagingDirFor,
} from "../src/geo/catalogue.ts";
import { packageSpec } from "../src/geo/environments.ts";
import { readDistributionCatalogue } from "../src/geo/distribution.ts";
import { readTarGz, safeEntryPath } from "../src/geo/tar.ts";
import { REPO_ROOT } from "../src/config.ts";
import { buildFixtureCatalogue, tarGz, writeFixtureArchive } from "./helpers/geo-catalogue-fixture.ts";

let cacheDir: string;
const noEnv = { HOME: os.homedir(), TASK_ASSETS_DIR: path.join(os.tmpdir(), "gaid-no-assets") } as NodeJS.ProcessEnv;

beforeEach(() => {
  resetGeoCatalogueCache();
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-cache-"));
});
afterEach(() => {
  resetGeoCatalogueCache();
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

function load(fixture: ReturnType<typeof buildFixtureCatalogue>, archive = writeFixtureArchive(fixture)) {
  return loadGeoCatalogue({
    env: { ...noEnv, GAID_CATALOGUE_ARCHIVE: archive },
    cacheDir,
    pin: { version: fixture.version, archive: path.basename(archive), sha256: fixture.sha256 },
  });
}

describe("tar reader", () => {
  it("reads files, directories and GNU long names", () => {
    const long = `runtime/skills/${"x".repeat(120)}/SKILL.md`;
    const entries = readTarGz(
      tarGz([
        { path: "a", type: "5" },
        { path: "a/b.txt", data: Buffer.from("hi") },
        { path: long, data: Buffer.from("long") },
      ]),
    );
    expect(entries.map((e) => [e.path, e.type])).toEqual([
      ["a", "directory"],
      ["a/b.txt", "file"],
      [long, "file"],
    ]);
    expect(entries[2].data.toString()).toBe("long");
  });

  it("refuses links and paths that could escape", () => {
    expect(() => readTarGz(tarGz([{ path: "evil", type: "2" }]))).toThrow(/unsupported type/);
    for (const bad of ["../x", "/etc/passwd", "a/../../b", "C:/x", "a\\b"]) {
      expect(() => safeEntryPath(bad)).toThrow(/unsafe/);
    }
  });
});

describe("loadGeoCatalogue", () => {
  it("stages a pinned archive and verifies every package digest", () => {
    const fixture = buildFixtureCatalogue();
    const catalogue = load(fixture);
    expect(catalogue.label).toBe(`geo-catalogue@9.9.0+${fixture.sha256.slice(0, 12)}`);
    expect(catalogue.root).toBe(stagingDirFor({ version: "9.9.0", archive: "x", sha256: fixture.sha256 }, cacheDir));
    const dirs = geoCatalogueSkillDirs(catalogue);
    expect([...dirs.keys()].sort()).toEqual(["geo-map-and-crs", "well-log-qc-quicklook"]);
    for (const skill of catalogue.manifest.runtimeSkills) {
      expect(packageDigest(dirs.get(skill.runtimeName)!)).toBe(skill.packageDigest);
    }
    expect(catalogue.workflows.map((w) => w.id)).toEqual(["well-log-qc"]);
    expect(catalogue.environments?.environments[0].id).toBe("geo-core");
    if (process.platform !== "win32") {
      const mode = fs.statSync(path.join(dirs.get("well-log-qc-quicklook")!, "scripts", "qc.py")).mode;
      expect(mode & 0o100).toBe(0o100);
    }
  });

  it("refuses an archive that is not the pinned one", () => {
    const fixture = buildFixtureCatalogue();
    const archive = writeFixtureArchive(fixture);
    expect(() =>
      loadGeoCatalogue({
        env: { ...noEnv, GAID_CATALOGUE_ARCHIVE: archive },
        cacheDir,
        pin: { version: fixture.version, archive: path.basename(archive), sha256: "f".repeat(64) },
      }),
    ).toThrow(expect.objectContaining({ code: "archive-digest" }));
  });

  it("refuses a package that does not match its packageDigest", () => {
    const fixture = buildFixtureCatalogue({
      mutate: (entries) =>
        entries.map((e) =>
          e.path.endsWith("geo-map-and-crs/SKILL.md") ? { ...e, data: Buffer.from("tampered\n") } : e,
        ),
    });
    expect(() => load(fixture)).toThrow(expect.objectContaining({ code: "package-digest" }));
    // Nothing half-staged is left behind for the installer to pick up.
    expect(fs.readdirSync(cacheDir)).toEqual([]);
  });

  it("refuses a modified catalogue file and an archive with a link entry", () => {
    const changed = buildFixtureCatalogue({
      mutate: (entries) =>
        entries.map((e) => (e.path === "workflows.json" ? { ...e, data: Buffer.from("[]\n") } : e)),
    });
    expect(() => load(changed)).toThrow(expect.objectContaining({ code: "file-digest" }));
    const linked = buildFixtureCatalogue({
      mutate: (entries) => [...entries, { path: "runtime/skills/geo-map-and-crs/notes", type: "2" }],
    });
    expect(() => load(linked)).toThrow(expect.objectContaining({ code: "archive-invalid" }));
  });

  it("replaces a hand-edited staged copy from the archive", () => {
    const fixture = buildFixtureCatalogue();
    const archive = writeFixtureArchive(fixture);
    const first = load(fixture, archive);
    const skillFile = path.join(first.skillsDir, "geo-map-and-crs", "SKILL.md");
    const original = fs.readFileSync(skillFile, "utf-8");
    fs.writeFileSync(skillFile, "edited in the cache\n");
    resetGeoCatalogueCache();
    const second = load(fixture, archive);
    expect(fs.readFileSync(path.join(second.skillsDir, "geo-map-and-crs", "SKILL.md"), "utf-8")).toBe(original);
  });

  it("reports where it looked when the archive is missing", () => {
    const pin = { version: "9.9.0", archive: "geo-catalogue-9.9.0.tar.gz", sha256: "a".repeat(64) };
    const env = { ...noEnv, GAID_HOME: path.join(os.tmpdir(), "gaid-home-x") };
    let error: unknown;
    try {
      loadGeoCatalogue({ env, cacheDir, pin });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(GeoCatalogueError);
    expect((error as GeoCatalogueError).code).toBe("archive-missing");
    expect((error as GeoCatalogueError).searched).toEqual(archiveCandidates(pin, env));
    expect(archiveCandidates(pin, { ...env, GAID_CATALOGUE_ARCHIVE: "/x/a.tar.gz" })[0]).toBe(path.resolve("/x/a.tar.gz"));
    const status = geoCatalogueStatus({ env: { ...env, GAID_CATALOGUE: "on" }, cacheDir, pin });
    // GAID_CATALOGUE=off in the test run disables geo mode; status follows the switch.
    expect(["error", "off"]).toContain(status.state);
  });
});

describe("pinned catalogue of this distribution", () => {
  const pin = readDistributionCatalogue(REPO_ROOT);
  const asset = pin && path.join(os.homedir(), "assets", "geo-catalogue", pin.version, pin.archive);
  const available = Boolean(asset && fs.existsSync(asset));
  it.skipIf(!available)("stages the real archive with 17 skills (13 geo + 4 literature) and 7 workflows", () => {
    const catalogue = loadGeoCatalogue({ env: { ...noEnv, GAID_CATALOGUE_ARCHIVE: asset! }, cacheDir, pin: pin! });
    expect(catalogue.manifest.runtimeSkills).toHaveLength(17);
    expect(catalogue.manifest.runtimeSkills.map((s) => s.runtimeName)).toEqual(
      expect.arrayContaining(["paper-lookup", "citation-management", "literature-review", "pyzotero"]),
    );
    expect(catalogue.workflows).toHaveLength(7);
    expect(catalogue.environments?.environments.map((e) => e.id)).toEqual(
      expect.arrayContaining(["geo-core", "geo-gis", "geo-literature"]),
    );
    // Every package spec is one the environment service accepts (GET /geo/environments fails otherwise).
    for (const env of catalogue.environments?.environments ?? []) for (const pkg of env.packages) expect(() => packageSpec(pkg)).not.toThrow();
    // Runtime names are SKILL.md names, never rewritten (gaid-interfaces.md §3).
    for (const [name, dir] of geoCatalogueSkillDirs(catalogue)) {
      expect(fs.readFileSync(path.join(dir, "SKILL.md"), "utf-8")).toMatch(new RegExp(`^name: ${name}$`, "m"));
    }
  });
  if (!available) it.skip(`real catalogue asset not present (${asset ?? "no pin"})`, () => {});
});
