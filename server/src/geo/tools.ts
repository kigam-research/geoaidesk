/**
 * Agent tools backed by the shared inspection contract (plan §3.8):
 * `geo_inspect` and bounded window/sample reads. Owned by gaid-runtime
 * (child unit `inspect` implements them on top of inspection.ts).
 */
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeGeoTools(_projectId: string, _paths: ProjectPaths): ToolDefinition<any, any>[] {
  return [];
}
