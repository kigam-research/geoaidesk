import { fileURLToPath } from "node:url";
import type { ProjectPaths } from "../../projects.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { runHelperScript } from "../../api/sci-helpers.ts";
import { resolveGeoPath } from "../inspection.ts";
import { TABLE_ROLES, TABLE_SCHEMA, type TableRequest, type TableResult } from "../../../../web/src/geo/contracts/tables.ts";
const script = fileURLToPath(new URL("./table_helper.py", import.meta.url));
export const TABLE_SOURCE_BYTES = 16 * 1024 * 1024;
/** Reject malformed mappings rather than silently checking different columns. */
export function validateTableRequest(value: unknown): asserts value is TableRequest {
  const b = value as TableRequest;
  const source = (s: TableRequest) => s && typeof s.path === "string" && s.path.length <= 4096 && (s.sheet === undefined || (typeof s.sheet === "string" && s.sheet.length <= 128));
  if (!source(b)) throw new SandboxError(400, "Expected a table path and optional sheet");
  if (b.mapping !== undefined) {
    if (!b.mapping || typeof b.mapping !== "object" || Array.isArray(b.mapping)) throw new SandboxError(400, "Invalid role mapping");
    for (const [role, col] of Object.entries(b.mapping)) if (!TABLE_ROLES.includes(role as typeof TABLE_ROLES[number]) || !Number.isInteger(col) || col < 0 || col >= 64) throw new SandboxError(400, "Invalid role or column index");
    if (new Set(Object.values(b.mapping)).size !== Object.values(b.mapping).length) throw new SandboxError(400, "Each column can have only one role");
  }
  if (b.declarations !== undefined) {
    if (!b.declarations || typeof b.declarations !== "object" || Array.isArray(b.declarations)) throw new SandboxError(400, "Invalid declarations");
    for (const [key, v] of Object.entries(b.declarations)) if (!["depth_unit", "unit", "analyte", "crs"].includes(key) || typeof v !== "string" || v.length > 128) throw new SandboxError(400, "Invalid declaration");
  }
  if (b.join && (!source(b.join) || !TABLE_ROLES.includes(b.join.left) || !Number.isInteger(b.join.rightColumn) || b.join.rightColumn < 0 || b.join.rightColumn >= 64)) throw new SandboxError(400, "Invalid join");
  if (b.join !== undefined && !b.join) throw new SandboxError(400, "Invalid join");
}
export async function inspectTable(projectId: string, paths: ProjectPaths, input: unknown): Promise<TableResult> {
  validateTableRequest(input);
  const request = input;
  const resolve = async (rel: string) => {
    const file = await resolveGeoPath(paths, rel);
    if (!/\.(csv|tsv|xlsx)$/i.test(file.rel)) throw new SandboxError(400, "Supported tables: CSV, TSV, XLSX");
    if (file.size > TABLE_SOURCE_BYTES) throw new SandboxError(413, "Table exceeds the 16 MiB source limit; select a smaller file");
    return file;
  };
  const primary = await resolve(request.path);
  const joined = request.join ? await resolve(request.join.path) : undefined;
  const body = { ...request, path: primary.rel, abs: primary.abs, join: request.join && { ...request.join, path: joined!.rel, abs: joined!.abs } };
  const out = await runHelperScript(script, [JSON.stringify(body)], 15_000);
  if (out.status !== 0) throw new SandboxError(out.status === 3 ? 503 : out.status === 5 ? 400 : 422, out.timedOut ? "Table assessment timed out; no checks completed" : "Table could not be assessed: " + out.stderr.slice(0, 500));
  if (Buffer.byteLength(out.stdout) > 1024 * 1024) throw new SandboxError(422, "Table response exceeded its limit; no checks completed");
  let result: TableResult;
  try { result = JSON.parse(out.stdout); } catch { throw new SandboxError(422, "Invalid table assessment response"); }
  if (result.schemaVersion !== TABLE_SCHEMA) throw new SandboxError(422, "Invalid table assessment schema");
  return { ...result, projectId };
}
