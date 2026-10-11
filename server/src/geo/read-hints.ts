/**
 * Read hints (plan §3.8 "Large-file reading"): a `tool_call` hook that turns
 * an unsuitable direct read of a large or binary geo data file into a bounded
 * summary plus the next inspection action. Owned by gaid-runtime (child unit
 * `inspect` implements it on top of inspection.ts).
 */
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";

/** Null until implemented; session.ts drops null factories. */
export function makeGeoReadHintExtension(_projectId: string, _paths: ProjectPaths): ExtensionFactory | null {
  return null;
}
