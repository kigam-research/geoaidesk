import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const INPUT_NAME = "authoring_preview_paper";
const FILE_NAME = "author-manuscript.pdf";
const MAX_BYTES = 50 * 1024 * 1024;

interface SampleOptions {
  enabled: boolean;
  headersOnly?: boolean;
  assetsRoot?: string;
  inputsFile?: string;
}

/** Read the single named, pinned input. No request-controlled filesystem path or remote fetch. */
async function inputRecord(inputsFile?: string): Promise<{ relativePath: string; sha256: string }> {
  const candidates = inputsFile ? [inputsFile] : [
    path.resolve(process.cwd(), "configs/inputs.toml"),
    path.resolve(process.cwd(), "../configs/inputs.toml"),
  ];
  let contents = "";
  for (const candidate of candidates) {
    try { contents = await readFile(candidate, "utf8"); break; } catch { /* Try repo root from web cwd. */ }
  }
  // The managed input record uses literal strings; this is intentionally not a general TOML parser.
  const record = contents.split(/^\[\[input\]\]\s*$/m)
    .find((section) => new RegExp(`^name\\s*=\\s*"${INPUT_NAME}"\\s*$`, "m").test(section));
  const relativePath = record?.match(/^path\s*=\s*"([^"\r\n]+)"\s*$/m)?.[1];
  const sha256 = record?.match(/"author-manuscript\.pdf"\s*=\s*"([a-f0-9]{64})"/)?.[1];
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..") || !sha256) {
    throw new Error("Preview sample input is not configured");
  }
  return { relativePath, sha256 };
}

export async function previewSampleResponse(options: SampleOptions): Promise<Response> {
  if (!options.enabled) return new Response(null, { status: 404 });
  try {
    const input = await inputRecord(options.inputsFile);
    const root = options.assetsRoot ?? process.env.TASK_ASSETS_DIR ?? path.join(os.homedir(), "assets");
    const bytes = await readFile(path.join(root, input.relativePath, FILE_NAME));
    if (bytes.byteLength > MAX_BYTES || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))
      || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
      return Response.json({ error: "sample-integrity" }, { status: 409 });
    }
    return new Response(options.headersOnly ? null : new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
        "Content-Disposition": 'inline; filename="author-manuscript.pdf"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "sample-unavailable" }, { status: 404 });
  }
}
