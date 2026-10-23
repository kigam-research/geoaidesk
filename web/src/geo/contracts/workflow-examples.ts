/**
 * Default example data of a Workflow input (gaid-workflow-example). A gaid-workflow/v1 Workflow may give an input role
 * an `example`: a small file set bundled in the Workflow's package (`examples/<roleId>/<name>`), or files at a public URL
 * with their sha256 and size, downloaded on first use. When the researcher gives no file for that input, the start
 * settings select the example, the server writes it into the project (`POST /geo/methods/examples`) and the Workflow 지침
 * states that example data was used. Workflows without examples behave as before.
 *
 * IO-free and shared by server and web. Server side: server/src/geo/methods/examples.ts (materialise, download),
 * server/src/geo/methods/method-file.ts (validation), server/src/geo/authoring/ (attach in hub authoring).
 */
import type { Localized } from "./workspace";

/** Limits: bundled files stay well inside the 20 MiB package limit; larger data goes by URL. */
export const EXAMPLE_LIMITS = {
  /** One bundled file. */
  bundledFile: 10 * 1024 * 1024,
  /** All bundled example files of one Workflow together. */
  bundledTotal: 15 * 1024 * 1024,
  /** One downloaded file. */
  remoteFile: 512 * 1024 * 1024,
  /** Files per example (a shapefile set, a README). */
  files: 20,
} as const;

export interface WorkflowExampleFile {
  /** File name written into the project: no folders, no leading dot. */
  name: string;
  sha256: string;
  /** Bytes. */
  size: number;
  /** Bundled: path inside the Workflow's package, `examples/<roleId>/<name>`. */
  path?: string;
  /** Remote: public https URL (http only on loopback, for tests), checked against `sha256` and `size` after download. */
  url?: string;
}

export interface WorkflowInputExample {
  /** What the example is (one line), e.g. "공개 항공자력 격자 (… 지역, 250 m)". */
  title: Localized;
  /** Where it comes from: provider, citation or how it was made. */
  source: Localized;
  /** Licence or terms of use as stated by the provider. */
  license?: string;
  /** Made with a simulation, not measured. Always shown next to the example. */
  synthetic?: boolean;
  /** The first file is the one bound to the input; the rest are companions (.shx/.dbf/.prj, a README) in the same folder. */
  files: WorkflowExampleFile[];
}

/** An input role's example as `GET /geo/methods` reports it for the active project. */
export interface WorkflowInputExampleState {
  title: Localized;
  source: Localized;
  license?: string;
  synthetic: boolean;
  /** Bytes of all files; `download` of those still to fetch from their URL. */
  size: number;
  download: number;
  /** Project path the input is bound to when the example is used (the first file). */
  path: string;
  /**
   * `present`: already in the project with matching hashes. `bundled`: in the installed package, copied on start.
   * `remote`: downloaded on start. `broken`: a bundled file is missing or differs from its declaration (`detail`).
   */
  state: "present" | "bundled" | "remote" | "broken";
  detail?: string;
}

// --- POST /geo/methods/examples ------------------------------------------------------------------------------------

/** Write the examples of these input roles into the project (copy or download, verify hashes); idempotent. */
export interface PrepareExamplesRequest {
  /** Installed method runtime name (the skill folder). */
  method: string;
  workflowId: string;
  roleIds: string[];
}

export interface PrepareExamplesResponse {
  /** Input role id → project path of the example's first file. */
  inputs: Record<string, string>;
  /** Project paths written by this call (empty when every example was already present). */
  written: string[];
}

// --- helpers -------------------------------------------------------------------------------------------------------

const SHA256 = /^[a-f0-9]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._()+-]{0,127}$/;
const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

function localized(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { ko, en } = value as { ko?: unknown; en?: unknown };
  return typeof ko === "string" && ko.trim().length > 0 && ko.length <= 500 && (en === undefined || (typeof en === "string" && en.length <= 500));
}

/** https, or http to a loopback host (tests). */
export function exampleUrlAllowed(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || value.length > 2048) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

/** Problems of one declared example (English, technical); empty when valid. */
export function exampleProblems(value: unknown, roleId: string): string[] {
  const problems: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["example must be an object"];
  const raw = value as Record<string, unknown>;
  if (!localized(raw.title)) problems.push("example.title must be {ko, en?} text");
  if (!localized(raw.source)) problems.push("example.source must be {ko, en?} text");
  if (raw.license !== undefined && (typeof raw.license !== "string" || raw.license.length > 500)) problems.push("example.license must be text");
  if (raw.synthetic !== undefined && typeof raw.synthetic !== "boolean") problems.push("example.synthetic must be true or false");
  const files = raw.files;
  if (!Array.isArray(files) || files.length === 0 || files.length > EXAMPLE_LIMITS.files) {
    problems.push(`example.files must list 1-${EXAMPLE_LIMITS.files} files`);
    return problems;
  }
  if (!LOCAL_ID.test(roleId)) problems.push("input role id is not a local id");
  const names = new Set<string>();
  files.forEach((row, n) => {
    const at = `example.files[${n}]`;
    const file = row as Record<string, unknown> | null;
    if (!file || typeof file !== "object") return problems.push(`${at} must be an object`);
    if (typeof file.name !== "string" || !NAME.test(file.name) || file.name.endsWith(".")) problems.push(`${at}.name must be a plain file name`);
    else if (names.has(file.name.toLowerCase())) problems.push(`${at}.name repeats another file`);
    else names.add(file.name.toLowerCase());
    if (typeof file.sha256 !== "string" || !SHA256.test(file.sha256)) problems.push(`${at}.sha256 must be 64 hex characters`);
    if (!Number.isSafeInteger(file.size) || (file.size as number) < 0) problems.push(`${at}.size must be a byte count`);
    const bundled = file.path !== undefined;
    const remote = file.url !== undefined;
    if (bundled === remote) return problems.push(`${at} needs exactly one of path (bundled) or url (remote)`);
    if (bundled) {
      if (file.path !== `examples/${roleId}/${String(file.name)}`) problems.push(`${at}.path must be examples/${roleId}/<name>`);
      if ((file.size as number) > EXAMPLE_LIMITS.bundledFile) problems.push(`${at} is larger than ${EXAMPLE_LIMITS.bundledFile} bytes; use a URL`);
    } else {
      if (typeof file.url !== "string" || !exampleUrlAllowed(file.url)) problems.push(`${at}.url must be a public https URL`);
      if ((file.size as number) > EXAMPLE_LIMITS.remoteFile) problems.push(`${at} is larger than ${EXAMPLE_LIMITS.remoteFile} bytes`);
    }
  });
  return problems;
}

/** FNV-1a (32-bit) over the files' hashes: a short, stable folder key for one example's content. */
function contentKey(example: WorkflowInputExample): string {
  let hash = 0x811c9dc5;
  for (const char of example.files.map((file) => `${file.name}\0${file.sha256}\n`).join("")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Project folder of an example: `user_data/examples/<method>/<roleId>-<key>/`. Content-addressed, so a later revision
 * with other data gets its own folder and never overwrites the earlier one; `user_data/` keeps the raw-data guard.
 */
export function exampleFolder(method: string, roleId: string, example: WorkflowInputExample): string {
  return `user_data/examples/${method}/${roleId}-${contentKey(example)}`;
}

export function examplePath(method: string, roleId: string, example: WorkflowInputExample): string {
  return `${exampleFolder(method, roleId, example)}/${example.files[0].name}`;
}

/** Whether a project path is inside some example folder (used to tell an example apart from the researcher's own file). */
export function isExamplePath(path: string): boolean {
  return path.startsWith("user_data/examples/");
}

/** Bytes as a short size (KB/MB/GB, base 1024) for screens and the 지침. */
export function sizeText(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
