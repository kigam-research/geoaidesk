import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { checkMarkdownImages, markdownImageTargets, registerMarkdownImageCheck } from "../src/geo/markdown-images.ts";
import { GEO_INSTRUCTIONS } from "../src/geo/instructions.ts";

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-md-")); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function write(rel: string, text = "x") {
  const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, text); return abs;
}
type Handler = (event: Record<string, unknown>, ctx: { cwd: string }) => { content: { type: string; text: string }[] } | undefined;
function install(): Handler {
  let hook: Handler | undefined;
  registerMarkdownImageCheck({ on(name: string, callback: Handler) { if (name === "tool_result") hook = callback; } } as never);
  return hook!;
}

it("extracts local Markdown and HTML image targets, not URLs or code examples", () => {
  const text = [
    '![a](figures/a.png) ![b](<my figs/b.png> "title") <img alt="c" src="../c.png">',
    "![web](https://example.org/x.png) ![d](data:image/png;base64,AA) [link](not-an-image.png)",
    "`![inline](code.png)`", "```md", "![fenced](fenced.png)", "```",
  ].join("\n");
  expect(markdownImageTargets(text)).toEqual(["figures/a.png", "my figs/b.png", "../c.png"]);
});

it("reports the 2026-10-12 case: a sandbox-root path written from results/ gets the ../ correction", () => {
  write("figures/paper_figures/fig1.png");
  write("results/ok.png");
  const md = write("results/summary.md");
  const problems = checkMarkdownImages(root, md, "![1](figures/paper_figures/fig1.png)\n![ok](ok.png)\n![none](missing.png)\n![abs](/figures/paper_figures/fig1.png)");
  expect(problems).toEqual([
    { target: "figures/paper_figures/fig1.png", suggestion: "../figures/paper_figures/fig1.png" },
    { target: "missing.png" },
    { target: "/figures/paper_figures/fig1.png", suggestion: "../figures/paper_figures/fig1.png" },
  ]);
});

it("appends a notice to a successful write/edit of Markdown only", () => {
  write("figures/a.png");
  write("results/r.md", "![a](figures/a.png)");
  write("results/good.md", "![a](../figures/a.png)");
  const hook = install();
  const base = { type: "tool_result", toolCallId: "t", content: [{ type: "text", text: "Wrote file" }], isError: false };
  const result = hook({ ...base, toolName: "write", input: { path: "results/r.md" } }, { cwd: root });
  expect(result!.content[0].text).toBe("Wrote file");
  expect(result!.content[1].text).toContain("`figures/a.png` → use `../figures/a.png`");
  expect(hook({ ...base, toolName: "edit", input: { path: "results/good.md" } }, { cwd: root })).toBeUndefined();
  expect(hook({ ...base, toolName: "write", input: { path: "results/r.md" }, isError: true }, { cwd: root })).toBeUndefined();
  expect(hook({ ...base, toolName: "read", input: { path: "results/r.md" } }, { cwd: root })).toBeUndefined();
  expect(hook({ ...base, toolName: "write", input: { path: "../outside.md" } }, { cwd: root })).toBeUndefined();
});

it("the lead's geo guidance states the rule", () => {
  expect(GEO_INSTRUCTIONS).toContain("relative to the Markdown file's own folder");
});
