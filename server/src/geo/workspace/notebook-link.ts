import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectPaths } from "../../projects.ts";
import { normalizeNotebookUrl, type ProjectNotebookLink } from "../../../../web/src/geo/contracts/notebook-link.ts";
import { geoStateDir } from "../context.ts";

const SCHEMA = "gaid-notebook-link/v1";
export class NotebookLinkError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}

export function notebookLinkFile(paths: ProjectPaths): string {
  return path.join(geoStateDir(paths), "notebook-link.json");
}

export function parseNotebookLinkBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body) || !("url" in body)) {
    throw new NotebookLinkError(400, "Expected { url: string | null }");
  }
  if (body.url === null) return null;
  const url = normalizeNotebookUrl(body.url);
  if (!url) throw new NotebookLinkError(400, "Use an HTTPS notebook page without sign-in information in the URL");
  return url;
}

export function readNotebookLink(paths: ProjectPaths): ProjectNotebookLink {
  let raw: string;
  try { raw = fs.readFileSync(notebookLinkFile(paths), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { url: null, updatedAt: null };
    throw error;
  }
  try {
    const record = JSON.parse(raw);
    if (!record || record.schema !== SCHEMA || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
      (record.url !== null && (typeof record.url !== "string" || normalizeNotebookUrl(record.url) !== record.url))) throw new Error();
    return { url: record.url, updatedAt: record.updatedAt };
  } catch {
    throw new NotebookLinkError(409, "The saved notebook link is malformed; it has not been changed");
  }
}

export function writeNotebookLink(paths: ProjectPaths, url: string | null): ProjectNotebookLink {
  readNotebookLink(paths); // Never replace malformed existing data, including on removal.
  const normalized = parseNotebookLinkBody({ url });
  const record = { schema: SCHEMA, url: normalized, updatedAt: new Date().toISOString() };
  const target = notebookLinkFile(paths);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(record) + "\n", "utf8");
    fs.renameSync(tmp, target);
  } finally { fs.rmSync(tmp, { force: true }); }
  return { url: record.url, updatedAt: record.updatedAt };
}
