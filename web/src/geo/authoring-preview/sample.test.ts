// @vitest-environment node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { previewSampleResponse } from "./sample";
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
it("is unavailable unless explicitly enabled", async () => {
  expect((await previewSampleResponse({ enabled: false })).status).toBe(404);
});
it("serves only matching pinned PDF bytes and fails visibly if the asset changes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gaid-preview-sample-")); directories.push(dir);
  const bytes = Buffer.from("%PDF-1.7\nfixture");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const inputsFile = path.join(dir, "inputs.toml");
  await writeFile(inputsFile, `[[input]]\nname="authoring_preview_paper"\npath="."\nsha256={"author-manuscript.pdf"="${digest}"}\n`);
  await writeFile(path.join(dir, "author-manuscript.pdf"), bytes);
  const options = { enabled: true, assetsRoot: dir, inputsFile };
  const result = await previewSampleResponse(options);
  expect(result.status).toBe(200); expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes);
  const head = await previewSampleResponse({ ...options, headersOnly: true });
  expect(head.status).toBe(200); expect(await head.text()).toBe("");
  await writeFile(path.join(dir, "author-manuscript.pdf"), "%PDF-1.7\nchanged");
  expect((await previewSampleResponse(options)).status).toBe(409);
  expect((await previewSampleResponse({ ...options, inputsFile: path.join(dir, "missing") })).status).toBe(404);
});
