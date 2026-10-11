/**
 * geo-result reference cards (skill_hub geo-byok-plan §3.5): a scientific_result
 * card of kind `geo-result` points at a `geo-result/v1` manifest in the sandbox
 * (`*.geomap.json` map-layer, `*.depth.json` depth-track, a validation-curve
 * manifest) and an optional PNG preview. The card never carries the layers,
 * curves or tables themselves; the UI opens the manifest in its viewer.
 */
import fs from "node:fs";

export const GEO_RESULT_KINDS = ["map-layer", "depth-track", "validation-curve"] as const;
export type GeoResultKind = (typeof GEO_RESULT_KINDS)[number];

/** Manifests are small JSON files; anything larger is not a manifest. */
const MAX_MANIFEST_BYTES = 1024 * 1024;

/**
 * Throws unless `file` (an absolute, already sandbox-checked path) is a
 * `geo-result/v1` manifest of `kind`. Kind-specific validation stays with the
 * viewers (WP04 depth, WP05 maps), which report problems when opened.
 */
export function checkGeoResultManifest(file: string, kind: GeoResultKind, label: string): void {
  if (fs.statSync(file).size > MAX_MANIFEST_BYTES) throw new Error(`geo-result manifest is larger than 1 MiB: ${label}`);
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    throw new Error(`geo-result manifest is not JSON: ${label}`);
  }
  const record = manifest as { schemaVersion?: unknown; kind?: unknown } | null;
  if (!record || typeof record !== "object" || record.schemaVersion !== "geo-result/v1") {
    throw new Error(`Not a geo-result/v1 manifest (schemaVersion): ${label}`);
  }
  if (record.kind !== kind) {
    throw new Error(`geo-result manifest kind is ${JSON.stringify(record.kind)}, card says ${kind}: ${label}`);
  }
}
