/** WP04 numerical LAS window; row IDs are 1-based logical samples, never physical lines. */
import type { GeoDepth, GeoIssue } from "./inspection";
export type DepthFlagKind = "missing" | "depth-gap" | "depth-duplicate" | "depth-reversal" | "range" | "spike" | "enlargement";
export interface DepthCurve {
  column: number; mnemonic: string; originalMnemonic: string; unit: string; description: string;
  nullCount: number; finiteCount: number; min: number | null; max: number | null;
}
export interface DepthSample { row: number; depth: number | null; values: (number | null)[]; breakBefore: boolean }
export interface DepthWindow {
  schemaVersion: "geo-series/v1"; path: string; fingerprint: string;
  well: string; run: string; version: string; nullValue: number | null; wrapped: boolean;
  depth: GeoDepth & { column: number; mnemonic: string; direction: "increasing" | "decreasing" | "mixed" | "unknown" };
  curves: DepthCurve[]; selectedColumns: number[]; issues: GeoIssue[];
  sourceRows: number; matchedRows: number; displayedRows: number; sampled: boolean; truncated: boolean;
  method: string; rows: DepthSample[]; nextRow: number | null;
}
export interface DepthWindowRequest { path: string; columns?: number[]; mode?: "display" | "rows"; startRow?: number; limit?: number; minDepth?: number; maxDepth?: number }
export interface DepthFlag { kind: DepthFlagKind; fromRow: number; toRow: number; column?: number; label?: string }
/** Dedicated suffix `.depth.json`; never inferred from arbitrary JSON. Paths are sandbox-root-relative. */
export interface DepthManifest {
  schemaVersion: "geo-result/v1"; kind: "depth-track"; dataPath: string;
  depth: { column: number; unit: string; basis: GeoDepth["basis"]; datum?: string };
  curves: { column: number; unit: string }[]; flags: DepthFlag[];
  status: "raw" | "derived"; sourceRow?: number; codePath?: string; limitations: string[];
}
export function parseDepthManifest(value: unknown): DepthManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid depth manifest");
  const m = value as DepthManifest;
  const pathOK = (p: unknown) => typeof p === "string" && p.length > 0 && p.length <= 2048 && !p.startsWith("/") && !p.includes("\\") && !p.split("/").includes("..") && !p.includes("\0");
  const columnOK = (v: unknown) => Number.isInteger(v) && Number(v) >= 0 && Number(v) < 128;
  const rowOK = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 1;
  if (m.schemaVersion !== "geo-result/v1" || m.kind !== "depth-track" || !pathOK(m.dataPath) || !m.depth || m.depth.column !== 0 || typeof m.depth.unit !== "string" || !["MD", "TVD", "elevation", "unknown"].includes(m.depth.basis) || (m.depth.datum !== undefined && typeof m.depth.datum !== "string") || !["raw", "derived"].includes(m.status) || !Array.isArray(m.curves) || !m.curves.length || m.curves.length > 8 || m.curves.some(c => !c || !columnOK(c.column) || typeof c.unit !== "string") || !Array.isArray(m.flags) || m.flags.length > 2000 || m.flags.some(f => !f || !["missing", "depth-gap", "depth-duplicate", "depth-reversal", "range", "spike", "enlargement"].includes(f.kind) || !rowOK(f.fromRow) || !rowOK(f.toRow) || f.toRow < f.fromRow || (f.column !== undefined && !columnOK(f.column)) || (f.label !== undefined && typeof f.label !== "string")) || (m.sourceRow !== undefined && !rowOK(m.sourceRow)) || (m.codePath !== undefined && !pathOK(m.codePath)) || !Array.isArray(m.limitations) || m.limitations.some(s => typeof s !== "string")) throw new Error("Invalid depth manifest (LAS index column 0 and explicit metadata required)");
  return m;
}
