/**
 * Where a staged skill_hub package came from, kept next to the package tree
 * (`<agentDir>/skill-hub/packages/<sha256>.origin.json`). The install gate
 * records the staged folder as the skill's source, so an installed method can
 * be traced back to these bytes. A hub-recorded lifecycle is kept only when
 * the bytes were fetched through a configured hub descriptor; an upload of the
 * same bytes later does not erase it, because the bytes are identical.
 */
import fs from "node:fs";
import path from "node:path";
import { KADY_PI_AGENT_DIR } from "../../config.ts";
import type { MethodLifecycle, MethodOrigin } from "../../../../web/src/geo/contracts/methods.ts";

export interface PackageOriginRecord {
  schemaVersion: "gaid-package-origin/v1";
  sha256: string;
  /** `gaid-hub`: built by the GAID hub authoring service in this app (gaid-hub). */
  kind: "skill-hub" | "upload" | "gaid-hub";
  siteId?: string;
  pageUrl?: string;
  descriptorUrl?: string;
  /** From the hub descriptor, never from the package's own files. */
  hub?: { methodId?: string; revision?: number; lifecycle?: MethodLifecycle; pageUrl?: string };
  fetchedAt: string;
}

const SHA = /^[a-f0-9]{64}$/;

export function packageStore(agentDir = KADY_PI_AGENT_DIR): string {
  return path.join(agentDir, "skill-hub", "packages");
}

function originFile(store: string, sha256: string): string {
  if (!SHA.test(sha256)) throw new Error("Invalid package digest");
  return path.join(store, `${sha256}.origin.json`);
}

export function readPackageOrigin(store: string, sha256: string): PackageOriginRecord | null {
  try {
    const value = JSON.parse(fs.readFileSync(originFile(store, sha256), "utf-8")) as PackageOriginRecord;
    return value?.schemaVersion === "gaid-package-origin/v1" && value.sha256 === sha256 ? value : null;
  } catch {
    return null;
  }
}

/** A hub fetch replaces the record; an upload never downgrades an existing hub record. */
export function writePackageOrigin(store: string, record: Omit<PackageOriginRecord, "schemaVersion">): void {
  const existing = readPackageOrigin(store, record.sha256);
  if ((existing?.kind === "skill-hub" || existing?.kind === "gaid-hub") && record.kind === "upload") return;
  const target = originFile(store, record.sha256);
  fs.mkdirSync(store, { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ schemaVersion: "gaid-package-origin/v1", ...record }, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, target);
}

/**
 * Origin of an installed skill from its recorded install source: a staged
 * package path `<store>/<sha256>` resolves to its origin record.
 */
export function originOfSource(source: string | undefined, store = packageStore()): { origin: MethodOrigin; record: PackageOriginRecord | null } {
  if (!source) return { origin: { kind: "other" }, record: null };
  const resolved = path.resolve(source);
  const sha = path.basename(resolved);
  if (path.dirname(resolved) !== path.resolve(store) || !SHA.test(sha)) return { origin: { kind: "other" }, record: null };
  const record = readPackageOrigin(store, sha);
  if (!record) return { origin: { kind: "upload", packageSha256: sha }, record: null };
  return {
    record,
    origin: {
      kind: record.kind,
      packageSha256: sha,
      ...(record.siteId ? { siteId: record.siteId } : {}),
      ...(record.pageUrl ?? record.hub?.pageUrl ? { pageUrl: record.pageUrl ?? record.hub?.pageUrl } : {}),
      ...(record.descriptorUrl ? { descriptorUrl: record.descriptorUrl } : {}),
      fetchedAt: record.fetchedAt,
    },
  };
}
