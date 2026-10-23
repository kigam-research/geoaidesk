/**
 * Project workspace state (gaid-project-resume; contract
 * web/src/geo/contracts/workspace-state.ts): one file per project,
 * `.kady/geo/workspace-state.json`. The server does not interpret the UI
 * state beyond its shape and size; the browser sanitizes it on load. The last
 * save wins. A malformed file is reported (409), never rewritten.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import {
  WORKSPACE_STATE_MAX_BYTES,
  WORKSPACE_STATE_SCHEMA,
  type GeoWorkspaceStateRecord,
} from "../../../../web/src/geo/contracts/workspace-state.ts";
import { geoStateDir } from "../context.ts";

const CLIENT_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export class WorkspaceStateError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function workspaceStateFile(paths: ProjectPaths): string {
  return path.join(geoStateDir(paths), "workspace-state.json");
}

export function readWorkspaceState(paths: ProjectPaths): GeoWorkspaceStateRecord | null {
  const file = workspaceStateFile(paths);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== WORKSPACE_STATE_SCHEMA ||
    typeof value.revision !== "number" ||
    typeof value.savedAt !== "string" ||
    typeof value.clientId !== "string" ||
    !isRecord(value.state)
  ) {
    throw new WorkspaceStateError(409, `${file} is not a ${WORKSPACE_STATE_SCHEMA} file`);
  }
  return value as unknown as GeoWorkspaceStateRecord;
}

/** Validate a PUT body: `{ state: { tabs: [...] , ... }, clientId }` within the size bound. */
export function parseWorkspaceStateBody(body: unknown): { state: Record<string, unknown>; clientId: string } {
  if (!isRecord(body) || !isRecord(body.state) || !Array.isArray(body.state.tabs)) {
    throw new WorkspaceStateError(400, "Expected { state: { tabs: [...] }, clientId }");
  }
  if (typeof body.clientId !== "string" || !CLIENT_ID_RE.test(body.clientId)) {
    throw new WorkspaceStateError(400, "clientId must be 1-64 letters, digits or dashes");
  }
  if (Buffer.byteLength(JSON.stringify(body.state), "utf-8") > WORKSPACE_STATE_MAX_BYTES) {
    throw new WorkspaceStateError(413, `Workspace state exceeds ${WORKSPACE_STATE_MAX_BYTES} bytes`);
  }
  return { state: body.state, clientId: body.clientId };
}

export function writeWorkspaceState(
  paths: ProjectPaths,
  state: Record<string, unknown>,
  clientId: string,
  now: () => Date = () => new Date(),
): GeoWorkspaceStateRecord {
  const previous = readWorkspaceState(paths);
  const record: GeoWorkspaceStateRecord = {
    schemaVersion: WORKSPACE_STATE_SCHEMA,
    revision: (previous?.revision ?? 0) + 1,
    savedAt: now().toISOString(),
    clientId,
    state,
  };
  const target = workspaceStateFile(paths);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record) + "\n", "utf-8");
  fs.renameSync(tmp, target);
  return record;
}
