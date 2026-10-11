/**
 * Shared inspection dispatch (`geo-inspection/v1`, web/src/geo/contracts/inspection.ts).
 * One entry point serves `POST /geo/inspect`, the agent's `geo_inspect` tool and
 * the read hints, so the browser and the model never get two interpretations
 * of the same file.
 *
 * Inspectors register per format. gaid-runtime ships the dispatcher and baseline
 * inspectors; gaid-well-tables (WP04) and gaid-maps (WP05) register richer ones
 * with `registerGeoInspector` (a later registration for a format wins).
 */
import type {
  GeoFormat,
  GeoInspection,
} from "../../../web/src/geo/contracts/inspection.ts";
import type { ProjectPaths } from "../projects.ts";

export interface GeoInspectContext {
  projectId: string;
  paths: ProjectPaths;
  /** Sandbox-relative, `/`-separated, already resolved inside the sandbox. */
  relPath: string;
  /** Absolute path of the primary file. */
  absPath: string;
  sizeBytes: number;
  /** Format guessed from name and magic bytes; an inspector may correct it. */
  format: GeoFormat;
  previewRows: number;
}

export interface GeoInspector {
  name: string;
  version: string;
  formats: readonly GeoFormat[];
  inspect(ctx: GeoInspectContext): Promise<GeoInspection>;
}

const inspectors = new Map<GeoFormat, GeoInspector>();

/** Register (or replace) the inspector for its formats. */
export function registerGeoInspector(inspector: GeoInspector): void {
  for (const format of inspector.formats) inspectors.set(format, inspector);
}

export function inspectorFor(format: GeoFormat): GeoInspector | undefined {
  return inspectors.get(format);
}

/** Server-side cap on preview rows, whatever a caller asks for. */
export const MAX_PREVIEW_ROWS = 50;

/**
 * Inspect one sandbox file. Implemented by the `inspect` child unit of
 * gaid-runtime (format sniffing, baseline inspectors, error mapping).
 */
export async function inspectGeoFile(
  _projectId: string,
  _paths: ProjectPaths,
  _relPath: string,
  _options: { previewRows?: number } = {},
): Promise<GeoInspection> {
  throw new Error("inspectGeoFile: not implemented yet");
}
