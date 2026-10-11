/**
 * Builds small geo catalogue archives (`geo-catalogue-manifest/v1` layout) for
 * tests, so catalogue staging can be exercised without the real asset.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const sha256 = (bytes: Buffer | string) => crypto.createHash("sha256").update(bytes).digest("hex");

export interface FixtureSkill {
  id: string;
  name: string;
  files: Record<string, string>;
  /** Executable files (mode 0755). */
  executables?: string[];
}

export interface FixtureEntry {
  path: string;
  data?: Buffer;
  mode?: number;
  /** Tar typeflag; "0" file (default), "5" directory, "2" symlink. */
  type?: string;
}

function header(name: string, size: number, mode: number, type: string): Buffer {
  const block = Buffer.alloc(512, 0);
  block.write(name, 0, 100, "utf-8");
  block.write(mode.toString(8).padStart(7, "0") + "\0", 100, 8, "ascii");
  block.write("0000000\0", 108, 8, "ascii");
  block.write("0000000\0", 116, 8, "ascii");
  block.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "ascii");
  block.write("00000000000\0", 136, 12, "ascii");
  block.write("        ", 148, 8, "ascii");
  block.write(type, 156, 1, "ascii");
  block.write("ustar\0", 257, 6, "ascii");
  block.write("00", 263, 2, "ascii");
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return block;
}

/** gzip'd ustar archive of `entries` (names up to 100 bytes; GNU `L` for longer). */
export function tarGz(entries: FixtureEntry[]): Buffer {
  const parts: Buffer[] = [];
  for (const entry of entries) {
    const data = entry.data ?? Buffer.alloc(0);
    const type = entry.type ?? "0";
    if (Buffer.byteLength(entry.path) > 99) {
      const long = Buffer.from(entry.path + "\0");
      parts.push(header("././@LongLink", long.length, 0o644, "L"), long, Buffer.alloc((512 - (long.length % 512)) % 512));
    }
    parts.push(header(entry.path.slice(0, 99), type === "0" ? data.length : 0, entry.mode ?? 0o644, type));
    if (type === "0") parts.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(parts));
}

export interface FixtureCatalogue {
  archive: Buffer;
  sha256: string;
  version: string;
  entries: FixtureEntry[];
}

function treeDigest(files: Record<string, string>): string {
  const listing = Object.entries(files)
    .map(([p, text]) => ({ path: p, sha256: sha256(text) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => `${f.path}\0${f.sha256}\n`)
    .join("");
  return sha256(listing);
}

export function defaultSkills(): FixtureSkill[] {
  return [
    {
      id: "kigam/well-log-qc-quicklook",
      name: "well-log-qc-quicklook",
      files: {
        "SKILL.md": "---\nname: well-log-qc-quicklook\ndescription: Quick QC of LAS well logs.\n---\n\n# Well-log QC\n",
        "scripts/qc.py": "print('qc')\n",
      },
      executables: ["scripts/qc.py"],
    },
    {
      id: "kigam/geo-map-and-crs",
      name: "geo-map-and-crs",
      files: {
        "SKILL.md": "---\nname: geo-map-and-crs\ndescription: Maps, CRS inventory and area tables.\n---\n\n# Map and CRS\n",
      },
    },
  ];
}

/** A complete, valid catalogue archive. `mutate` may edit entries after digests are computed. */
export function buildFixtureCatalogue(
  options: {
    version?: string;
    skills?: FixtureSkill[];
    workflows?: { id: string; title: { ko: string; en?: string }; skillIds: string[]; environmentProfile: string }[];
    mutate?: (entries: FixtureEntry[]) => FixtureEntry[];
  } = {},
): FixtureCatalogue {
  const version = options.version ?? "9.9.0";
  const skills = options.skills ?? defaultSkills();
  const generatedFrom = { repository: "kigam-research/skill_hub", sourceCommit: "0".repeat(40), dirty: false };
  const index = {
    schemaVersion: "geo-catalogue/v1",
    catalogueVersion: version,
    generatedFrom,
    skills: skills.map((skill) => ({
      id: skill.id,
      runtimeName: skill.name,
      origin: "owned",
      title: { ko: skill.name },
      packageRef: `runtime/skills/${skill.name}`,
      packageDigest: treeDigest(skill.files),
    })),
  };
  const workflows = options.workflows ?? [
    {
      id: "well-log-qc",
      title: { ko: "검층 QC", en: "Well-log QC" },
      skillIds: ["kigam/well-log-qc-quicklook"],
      environmentProfile: "geo-core",
    },
  ];
  const environments = {
    schemaVersion: "geo-environments/v1",
    python: ">=3.12",
    environments: [
      { id: "geo-core", title: { ko: "기본" }, targets: ["helper", "project"], packages: [{ name: "numpy", imports: ["numpy"] }] },
    ],
  };
  const other: Record<string, string> = {
    "catalogue/index.json": JSON.stringify(index, null, 2) + "\n",
    "workflows.json": JSON.stringify(workflows, null, 2) + "\n",
    "environments.json": JSON.stringify(environments, null, 2) + "\n",
    "notices/NOTICE.md": "# Notices\n",
  };
  const manifest = {
    schemaVersion: "geo-catalogue-manifest/v1",
    catalogueVersion: version,
    generatedFrom,
    contracts: { index: "geo-catalogue/v1", recipe: "geo-start/v1" },
    runtimeSkills: index.skills.map(({ id, runtimeName, packageRef, packageDigest }) => ({
      id,
      runtimeName,
      packageRef,
      packageDigest,
    })),
    included: { "workflows.json": true, "environments.json": true },
    files: Object.fromEntries(Object.entries(other).map(([p, text]) => [p, sha256(text)])),
  };
  let entries: FixtureEntry[] = [
    { path: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n") },
    ...Object.entries(other).map(([p, text]) => ({ path: p, data: Buffer.from(text) })),
  ];
  for (const skill of skills) {
    for (const [rel, text] of Object.entries(skill.files)) {
      entries.push({
        path: `runtime/skills/${skill.name}/${rel}`,
        data: Buffer.from(text),
        mode: skill.executables?.includes(rel) ? 0o755 : 0o644,
      });
    }
  }
  if (options.mutate) entries = options.mutate(entries);
  const archive = tarGz(entries);
  return { archive, sha256: sha256(archive), version, entries };
}

/** Write an archive into a fresh temp dir; returns its path. */
export function writeFixtureArchive(fixture: FixtureCatalogue, dir?: string): string {
  const target = dir ?? fs.mkdtempSync(path.join(os.tmpdir(), "gaid-catalogue-"));
  const file = path.join(target, `geo-catalogue-${fixture.version}.tar.gz`);
  fs.writeFileSync(file, fixture.archive);
  return file;
}
