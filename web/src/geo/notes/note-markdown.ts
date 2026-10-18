/**
 * Pure helpers that prepare a research note's Markdown for the notebook tab (docs/geo/research-notes.md):
 * drop the frontmatter and the title heading the panel already shows, rebase relative links and images from the
 * note's folder onto the sandbox root (the shared renderer resolves sandbox-root paths and opens linked files in the
 * app), and split out the decisions section so it can be shown as answerable cards.
 */
import { RESEARCH_NOTE_SECTIONS } from "@/geo/contracts/research-notes";

const FRONTMATTER = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const EXTERNAL = /^([a-z][a-z\d+.-]*:|#|\/|\?)/i;

/** Body without the leading YAML frontmatter block. */
export function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER, "");
}

/** Removes the first level-1 heading when it is the first content line (the panel shows the title). */
export function stripTitleHeading(markdown: string): string {
  return markdown.replace(/^\s*#[ \t]+[^\n]*\n?/, "");
}

/** Sandbox-root path for `target` written relative to `noteDir`; null when it is external or leaves the sandbox. */
export function rebasePath(noteDir: string, target: string): string | null {
  if (!target || EXTERNAL.test(target)) return null;
  const [bare, ...rest] = target.split(/(?=[?#])/);
  let decoded: string;
  try { decoded = decodeURIComponent(bare); } catch { return null; }
  const parts = noteDir.split("/").filter(Boolean);
  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { if (!parts.length) return null; parts.pop(); }
    else parts.push(part);
  }
  if (!parts.length) return null;
  return parts.map(encodeURIComponent).join("/") + rest.join("");
}

/** Rewrites Markdown links/images and HTML `src`/`href` outside code so relative targets point from the sandbox root. */
export function rebaseNoteLinks(markdown: string, notePath: string): string {
  const noteDir = notePath.slice(0, notePath.lastIndexOf("/") + 1);
  const rewrite = (segment: string) => segment
    .replace(/(!?\[[^\]\n]*\]\()\s*(<[^>\n]+>|[^)\s]+)((?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\))/g, (whole, open: string, target: string, close: string) => {
      const bare = target.replace(/^<|>$/g, "");
      const rebased = rebasePath(noteDir, bare);
      return rebased ? `${open}${rebased}${close}` : whole;
    })
    .replace(/(<(?:img|a)\b[^>]*?\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi, (whole, open: string, quote: string, target: string) => {
      const rebased = rebasePath(noteDir, target);
      return rebased ? `${open}${quote}${rebased}${quote}` : whole;
    });
  // Keep fenced and inline code untouched.
  return markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((segment, i) => (i % 2 ? segment : rewrite(segment))).join("");
}

const DECISION_HEADINGS = RESEARCH_NOTE_SECTIONS.decisions.map((h) => h.toLowerCase());

/** Level-2 heading text without a leading number (`## 5. 결정할 일` → `결정할 일`). */
function headingText(line: string): string | null {
  const m = /^##[ \t]+(?:\d+[.)][ \t]*)?(.+?)[ \t]*#*[ \t]*$/.exec(line);
  return m ? m[1].trim() : null;
}

/** Splits the note body around its decisions section (heading included) so the panel can render it as cards. */
export function splitDecisions(markdown: string): { before: string; decisions: string | null; after: string } {
  const lines = markdown.split("\n");
  let inFence = false, start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (inFence) continue;
    const text = headingText(lines[i]);
    if (text === null) continue;
    if (start < 0 && DECISION_HEADINGS.includes(text.toLowerCase())) start = i;
    else if (start >= 0) { end = i; break; }
  }
  if (start < 0) return { before: markdown, decisions: null, after: "" };
  return { before: lines.slice(0, start).join("\n"), decisions: lines.slice(start, end).join("\n"), after: lines.slice(end).join("\n") };
}

/** The note body as the panel renders it: no frontmatter, no title heading, links rebased. */
export function noteBody(markdown: string, notePath: string): string {
  return rebaseNoteLinks(stripTitleHeading(stripFrontmatter(markdown)), notePath);
}

/** Inline Markdown (code, emphasis, links) reduced to its text, for one-line labels outside the rendered body. */
export function plainText(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2");
}
