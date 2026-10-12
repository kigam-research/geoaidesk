/**
 * Markdown image rule: a local image path in a `.md` file is resolved from
 * that file's own folder (as the file viewer, GitHub and every Markdown
 * renderer do), never from the sandbox root. After an agent writes or edits a
 * Markdown file, the result carries a short notice for image links that do
 * not resolve, with the corrected relative path when the file exists
 * elsewhere in the sandbox. Deterministic and model-independent; registered
 * for the lead (geo/session.ts) and for subagent children (kady-child-runtime).
 */
import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { apiRelative } from "../sandbox-fs.ts";

export const MARKDOWN_IMAGE_RULE = "In Markdown files, write local image paths relative to the Markdown file's own folder (from `results/report.md`, a sandbox-root `figures/a.png` is `../figures/a.png`); never sandbox-root or absolute paths.";
const MARKDOWN_FILE = /\.(md|markdown)$/i;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_REPORTED = 20;

export interface MarkdownImageProblem {
  target: string;
  /** Path relative to the Markdown file's folder that does exist, when one was found. */
  suggestion?: string;
}

/** Local image targets from `![alt](target "title")` and `<img src="target">`. */
export function markdownImageTargets(text: string): string[] {
  const targets: string[] = [];
  // Fenced and inline code are examples, not rendered images.
  const prose = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "").replace(/`[^`\n]*`/g, "");
  for (const m of prose.matchAll(/!\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)/g)) {
    targets.push(m[1].replace(/^<|>$/g, ""));
  }
  for (const m of prose.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)) targets.push(m[1] ?? m[2]);
  return targets.filter(t => !/^([a-z][a-z0-9+.-]*:(?!\\)|#|\/\/)/i.test(t) || /^file:/i.test(t));
}

function decode(target: string): string {
  const bare = target.replace(/^file:\/\//i, "").split(/[?#]/)[0];
  try { return decodeURIComponent(bare); } catch { return bare; }
}

function inside(root: string, abs: string): boolean {
  const rel = apiRelative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function isFile(abs: string): boolean {
  try { return fs.statSync(abs).isFile(); } catch { return false; }
}

/** Image links in `mdAbs` that do not resolve to a file inside `sandboxRoot`. */
export function checkMarkdownImages(sandboxRoot: string, mdAbs: string, text: string): MarkdownImageProblem[] {
  const root = path.resolve(sandboxRoot), dir = path.dirname(path.resolve(mdAbs));
  const problems: MarkdownImageProblem[] = [];
  for (const target of new Set(markdownImageTargets(text))) {
    const local = decode(target);
    if (!local) continue;
    const absolute = path.isAbsolute(local) || /^file:/i.test(target);
    const resolved = path.resolve(dir, local);
    if (!absolute && inside(root, resolved) && isFile(resolved)) continue;
    // Likely intents: a sandbox-root path written as if relative, or an absolute path inside the sandbox.
    const candidates = [path.resolve(root, local.replace(/^\/+/, "")), ...(absolute ? [path.resolve(local)] : [])];
    const found = candidates.find(c => inside(root, c) && isFile(c));
    problems.push({ target, ...(found ? { suggestion: apiRelative(dir, found) } : {}) });
  }
  return problems;
}

export function markdownImageNotice(mdRel: string, problems: MarkdownImageProblem[]): string {
  const lines = problems.slice(0, MAX_REPORTED).map(p => p.suggestion
    ? `- \`${p.target}\` → use \`${p.suggestion}\``
    : `- \`${p.target}\` → no such file in the project; fix the path or create the image`);
  if (problems.length > MAX_REPORTED) lines.push(`- … ${problems.length - MAX_REPORTED} more`);
  return `Markdown image check: ${problems.length} image link(s) in ${mdRel} do not resolve. Image paths are relative to the Markdown file's own folder. Edit the file:\n${lines.join("\n")}`;
}

/** Appends the notice to a successful `write`/`edit` of a Markdown file inside the session cwd. */
export function registerMarkdownImageCheck(pi: ExtensionAPI): void {
  pi.on("tool_result", (event, ctx) => {
    if ((event.toolName !== "write" && event.toolName !== "edit") || event.isError) return;
    const target = (event.input as { path?: unknown }).path;
    if (typeof target !== "string" || !MARKDOWN_FILE.test(target)) return;
    try {
      const root = path.resolve(ctx.cwd), abs = path.resolve(root, target.replace(/^@/, ""));
      if (!inside(root, abs) || fs.statSync(abs).size > MAX_FILE_BYTES) return;
      const problems = checkMarkdownImages(root, abs, fs.readFileSync(abs, "utf8"));
      if (!problems.length) return;
      return { content: [...event.content, { type: "text" as const, text: markdownImageNotice(apiRelative(root, abs), problems) }] };
    } catch {
      return; // A failed check never changes the tool's own result.
    }
  });
}

export const markdownImageExtension: ExtensionFactory = (pi) => registerMarkdownImageCheck(pi);
