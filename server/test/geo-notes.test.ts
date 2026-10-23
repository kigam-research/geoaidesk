import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { geoStateDir } from "../src/geo/context.ts";
import { parseResearchNote } from "../src/geo/notes/parser.ts";
import { makeResearchNoteExtension } from "../src/geo/notes/extension.ts";
import { getResearchNote, listResearchNotes, recordResearchNoteSession, RESEARCH_NOTE_LIMITS, rewriteResearchNoteStatus, setResearchNoteStatus } from "../src/geo/notes/store.ts";
import { registerGeoNoteRoutes } from "../src/geo/routes/notes.ts";
import { geoSessionParts } from "../src/geo/session.ts";
import { GEO_INSTRUCTIONS, RESEARCH_NOTE_RULE } from "../src/geo/instructions.ts";
import { previewHandoff } from "../src/geo/hub-handoff/builder.ts";
import { ProvenanceRecorder } from "../src/provenance/recorder.ts";

const first = "2026-10-17-분석", second = "2026-10-18-결과";
const notePath = (id = first) => `연구노트/${id}/index.md`;
const source = (front = "", decisions = "없음", english = false) => [
  "---", "title: 분석 결과", "date: 2026-10-17", "status: pending", "headline: 두 표가 일치합니다.", "cover:", "supersedes:", front, "---", "# 분석 결과", "",
  ...(english ? ["AT A GLANCE", "results", "What was done", "Limits", "Decisions", "Evidence"] : ["한눈에", "결과", "한 일", "한계", "결정할 일", "근거"]).flatMap((heading, i) => [`## ${i + 1}. ${heading}`, i === 4 ? decisions : "없음", ""]),
].join("\n");
let paths: ProjectPaths;
const others: ProjectPaths[] = [];
function write(name: string, content: string | Buffer = "x") {
  const file = path.join(paths.sandbox, name);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file;
}
beforeEach(() => {
  paths = resolvePaths("research-notes-test");
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.mkdirSync(paths.sandbox, { recursive: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const p of [paths, ...others.splice(0)]) fs.rmSync(p.root, { recursive: true, force: true });
});

describe("pure research-note parser", () => {
  it("reads the frontmatter subset, bilingual headings, numbered decisions and recommendations", () => {
    const text = source("", "1. 다시 분석할지\n   - 가) 자료로 재실행 (권장: 원자료가 필요합니다)\n   - 나) 마무리");
    expect(parseResearchNote(text, first)).toMatchObject({ title: "분석 결과", date: "2026-10-17", status: "pending", headline: "두 표가 일치합니다.", problems: [], decisions: [{ number: 1, question: "다시 분석할지", options: [
      { label: "가", text: "자료로 재실행", recommended: true, reason: "원자료가 필요합니다" },
      { label: "나", text: "마무리", recommended: false, reason: null },
    ] }] });
    expect(parseResearchNote(source("", "2) Continue?\n- a) Rerun (Recommended: collect samples)\n- b) Stop", true), first)).toMatchObject({ problems: [], decisions: [{ number: 2, question: "Continue?", options: [{ label: "a", recommended: true, reason: "collect samples" }, { label: "b", recommended: false }] }] });
    // Recommendation written on its own line after the options (seen from the institute Qwen, 2026-10-18).
    expect(parseResearchNote(source("", "1. 클래스 취급\n- 가) 유지\n- 나) 이름 변경\n- (권장: 나 — 오독을 막는다)"), first)).toMatchObject({ problems: [], decisions: [{ options: [
      { label: "가", recommended: false }, { label: "나", recommended: true, reason: "오독을 막는다" },
    ] }] });
    expect(parseResearchNote(source("", "1. q\n- 가) a\n- 나) b\n권장: 가) 이유"), first).decisions[0].options[0]).toMatchObject({ recommended: true, reason: "이유" });
    expect(parseResearchNote(source("", "1) q\n- a) x\n- b) y\n- (Recommended: because z)", true), first).problems).toContainEqual({ code: "decision-format", target: "decisions" });
    for (const value of [`[${first}, 'old-note']`, `${first}, old-note`]) {
      expect(parseResearchNote(source().replace("supersedes:", `supersedes: ${value}`), second).supersedes).toEqual([first, "old-note"]);
    }
  });

  // gaid-first-use-fixes: every note an agent wrote with `cover: null` showed "형식 확인 필요".
  it("reads YAML empty values as absent, and a quoted \"null\" as text", () => {
    for (const empty of ["null", "~", "Null", "NULL"]) {
      const text = source().replace("cover:", `cover: ${empty}`).replace("supersedes:", `supersedes: ${empty}`);
      expect(parseResearchNote(text, first)).toMatchObject({ cover: null, supersedes: [], problems: [] });
    }
    expect(parseResearchNote(source().replace("cover:", 'cover: "null"'), first).cover).toBe("null");
    write(notePath(), source().replace("cover:", "cover: null").replace("supersedes:", "supersedes: null"));
    expect(getResearchNote(paths, first).note).toMatchObject({ cover: null, supersedes: [], problems: [] });
  });

  it("falls back to the first H1 and id date while reporting missing or invalid format", () => {
    const parsed = parseResearchNote("# My finding\n## Results\nFine", first);
    expect(parsed).toMatchObject({ title: "My finding", date: "2026-10-17", status: "pending" });
    expect(parsed.problems).toEqual(expect.arrayContaining([{ code: "frontmatter" }, { code: "title", target: "title" }, { code: "status", target: "status" }, { code: "section-missing", target: "decisions" }]));
    expect(parseResearchNote(source().replace("status: pending", "status: approved"), first).problems).toContainEqual({ code: "status", target: "status" });
    expect(parseResearchNote(source("broken yaml"), first).problems).toContainEqual({ code: "frontmatter" });
    expect(parseResearchNote(source("title: duplicate"), first).problems).toContainEqual({ code: "frontmatter" });
  });

  it.each([
    "- 가) Orphan", "A question without a number", "1. No options", "1. Question\n- broken option", "1. Q\n- 가) A (권장: )",
    "1. Q\n- a) A (recommended: first)\n- b) B (recommended: second)", "1. Q\n- 가) A\n1. Duplicate\n- 나) B",
  ])("flags malformed decisions: %s", decisions => {
    expect(parseResearchNote(source("", decisions), first).problems).toContainEqual({ code: "decision-format", target: "decisions" });
  });

  it("does not parse fenced heading/decision examples as real sections", () => {
    const text = "# Example\n```md\n## Results\n## Decisions\n1. Q\n- a) A\n```";
    expect(parseResearchNote(text, first)).toMatchObject({ decisions: [], problems: expect.arrayContaining([{ code: "section-missing", target: "results" }]) });
  });
});

describe("file-master storage", () => {
  it("lists direct note folders newest first, resolves cover and images, and computes supersession without rewriting", () => {
    const original = source(); write(notePath(), original);
    write(notePath(second), source().replace("date: 2026-10-17", "date: 2026-10-18").replace("cover:", "cover: figures/map.png").replace("supersedes:", `supersedes: [${first}]`));
    write(`연구노트/${second}/figures/map.png`);
    write("연구노트/.hidden/index.md", source()); write("연구노트/missing/child/index.md", source());
    const list = listResearchNotes(paths);
    expect(list.dir).toBe("연구노트"); expect(list.notes.map(n => n.id)).toEqual([second, first]);
    expect(list.notes[0]).toMatchObject({ cover: `연구노트/${second}/figures/map.png`, problems: [], path: notePath(second) });
    expect(list.notes[1]).toMatchObject({ status: "superseded", supersededBy: second });
    expect(getResearchNote(paths, first)).toMatchObject({ content: original, note: { status: "superseded", supersededBy: second } });
    expect(fs.readFileSync(path.join(paths.sandbox, notePath()), "utf8")).toBe(original);
  });

  it("rejects unknown, traversal, outside-sandbox symlinks and missing covers", () => {
    write(notePath(), source().replace("cover:", "cover: figures/missing.png") + "\n![bad](missing.png)");
    expect(getResearchNote(paths, first).note).toMatchObject({ cover: null, problems: expect.arrayContaining([{ code: "image-missing", target: "figures/missing.png" }, { code: "image-missing", target: "missing.png" }]) });
    for (const id of ["unknown", ".hidden", "../outside", "a/b", "a\\b"]) expect(() => getResearchNote(paths, id)).toThrow(expect.objectContaining({ statusCode: 404 }));
    const outside = path.join(paths.root, "outside.md"); fs.writeFileSync(outside, source());
    const linked = write(notePath("linked")); fs.unlinkSync(linked); fs.symlinkSync(outside, linked);
    expect(() => getResearchNote(paths, "linked")).toThrow(expect.objectContaining({ statusCode: 404 }));
    const cover = `연구노트/${first}/outside.png`; fs.symlinkSync(outside, path.join(paths.sandbox, cover));
    write(notePath(), source().replace("cover:", "cover: outside.png"));
    expect(getResearchNote(paths, first).note.cover).toBeNull();
    expect(() => setResearchNoteStatus(paths, "linked", "confirmed")).toThrow();
    expect(fs.readFileSync(outside, "utf8")).toBe(source());
  });

  it("bounds list size and rejects oversized file reads/status edits with 413", () => {
    const huge = Buffer.alloc(RESEARCH_NOTE_LIMITS.fileBytes + 1, "x"); write(notePath("huge"), huge);
    expect(listResearchNotes(paths).notes).toEqual([]);
    expect(() => getResearchNote(paths, "huge")).toThrow(expect.objectContaining({ statusCode: 413 }));
    expect(() => setResearchNoteStatus(paths, "huge", "confirmed")).toThrow(expect.objectContaining({ statusCode: 413 }));
    for (let i = 0; i < 502; i++) write(notePath(`2026-10-18-n${String(i).padStart(3, "0")}`), source());
    expect(listResearchNotes(paths).notes).toHaveLength(500);
  });

  it("resolves NFD folder, image and tool paths while returning NFC ids and paths", () => {
    const nfdPath = notePath().normalize("NFD");
    write(nfdPath, source().replace("cover:", "cover: figures/그림.png"));
    write(`연구노트/${first}/figures/그림.png`.normalize("NFD"));
    expect(listResearchNotes(paths).notes[0]).toMatchObject({ id: first, path: notePath(), cover: `연구노트/${first}/figures/그림.png` });
    expect(getResearchNote(paths, first.normalize("NFD")).note.id).toBe(first);
    expect(setResearchNoteStatus(paths, first, "confirmed").status).toBe("confirmed");
    expect(fs.readFileSync(path.join(paths.sandbox, nfdPath), "utf8")).toContain("status: confirmed");
  });

  it("changes only the status line, preserving BOM, CRLF, body bytes and frontmatter neighbours", () => {
    const original = Buffer.concat([Buffer.from("\uFEFF" + source().replaceAll("\n", "\r\n")), Buffer.from([0xff, 0x00])]);
    const file = write(notePath(), original);
    setResearchNoteStatus(paths, first, "confirmed");
    expect(fs.readFileSync(file)).toEqual(Buffer.from(original.toString("latin1").replace("status: pending", "status: confirmed"), "latin1"));
    expect(() => setResearchNoteStatus(paths, first, "approved")).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(rewriteResearchNoteStatus(Buffer.from("---\ntitle: A\n---\n# A"), "pending").toString()).toBe("---\ntitle: A\nstatus: pending\n---\n# A");
    expect(rewriteResearchNoteStatus(Buffer.from("# Raw\r\nbody"), "pending").toString()).toBe("---\r\nstatus: pending\r\n---\r\n# Raw\r\nbody");
  });

  it("records unique sessions oldest first and leaves malformed mapping untouched on reads and failed writes", () => {
    write(notePath(), source());
    recordResearchNoteSession(paths, first, "chat-1"); recordResearchNoteSession(paths, first, "chat-2"); recordResearchNoteSession(paths, first, "chat-1");
    expect(getResearchNote(paths, first).note.sessions).toEqual(["chat-1", "chat-2"]);
    const map = path.join(geoStateDir(paths), "notes.json"); fs.writeFileSync(map, "broken");
    expect(listResearchNotes(paths).notes[0].sessions).toEqual([]);
    expect(fs.readFileSync(map, "utf8")).toBe("broken");
    expect(() => recordResearchNoteSession(paths, first, "chat-3")).toThrow();
    expect(fs.readFileSync(map, "utf8")).toBe("broken");
  });

  it("keeps original bytes on an atomic replacement failure or status update over the size limit", () => {
    const original = source(), file = write(notePath(), original);
    const rename = vi.spyOn(fs, "renameSync").mockImplementationOnce(() => { throw new Error("rename failed"); });
    expect(() => setResearchNoteStatus(paths, first, "confirmed")).toThrow("rename failed");
    expect(fs.readFileSync(file, "utf8")).toBe(original);
    expect(fs.readdirSync(path.dirname(file))).toEqual(["index.md"]);
    rename.mockRestore();
    const limit = Buffer.alloc(RESEARCH_NOTE_LIMITS.fileBytes, "x"); Buffer.from(original).copy(limit); write(notePath(), limit);
    expect(() => setResearchNoteStatus(paths, first, "confirmed")).toThrow(expect.objectContaining({ statusCode: 413 }));
    expect(fs.readFileSync(file).equals(limit)).toBe(true);
  });

  it("uses the latest associated session with a method trial and its explicit assessment, even after uninstall", () => {
    write(notePath(), source());
    for (const session of ["chat-old", "chat-trial", "chat-plain"]) recordResearchNoteSession(paths, first, session);
    const trial = (sessionId: string, methodId: string, outcome?: string) => write(`.kady/geo/method-trials/${sessionId}.json`, JSON.stringify({ schemaVersion: "gaid-method-trial/v1", sessionId, methodId, workflowId: "analyse", runtimeName: "missing-method", revision: 1, startedAt: "2026-10-18T00:00:00Z", packageSha256: null, ...(outcome ? { assessment: { outcome } } : {}) }));
    trial("chat-old", "older"); trial("chat-trial", "test/my-method", "needs-revision");
    expect(getResearchNote(paths, first).note.method).toEqual({ name: null, methodId: "test/my-method", workflowId: "analyse", assessment: "needs-revision" });
    write(".pi/skills/my-method/SKILL.md", "---\nname: my-method\ndescription: method\n---\nMethod");
    write(".pi/skills/my-method/gaid-method.json", JSON.stringify({ schemaVersion: "gaid-method/v1", methodId: "test/my-method", revision: 1, title: { ko: "시료 분석" }, implementation: "descriptive", lifecycle: "draft", workflows: [] }));
    expect(getResearchNote(paths, first).note.method?.name).toBe("시료 분석");
  });
});

type Handler = (event: Record<string, unknown>, ctx: { cwd: string }) => { content: { type: string; text: string }[] } | undefined;
function install(factory = makeResearchNoteExtension(paths, "chat-hook")): Handler {
  let callback: Handler | undefined;
  factory({ on(name: string, handler: Handler) { if (name === "tool_result") callback = handler; } } as never);
  return callback!;
}
const toolEvent = (target: string, toolName = "write", isError = false) => ({ toolName, input: { path: target }, isError, content: [{ type: "text", text: "Original result" }] });

describe("lead note extension and prompt", () => {
  it("records successful writes/edits, appends actionable format notices, and skips image-only problems", () => {
    write(notePath("bad-name"), "# Finding");
    const hook = install();
    const notice = hook(toolEvent("@./" + notePath("bad-name")), { cwd: paths.sandbox });
    expect(notice?.content[0].text).toBe("Original result");
    expect(notice?.content[1].text).toContain("frontmatter"); expect(notice?.content[1].text).toContain("YYYY-MM-DD-<topic>");
    expect(getResearchNote(paths, "bad-name").note.sessions).toEqual(["chat-hook"]);
    write(notePath().normalize("NFD"), source() + "\n![missing](missing.png)");
    expect(hook(toolEvent("@./" + notePath().normalize("NFD"), "edit"), { cwd: paths.sandbox })).toBeUndefined();
    expect(getResearchNote(paths, first).note.sessions).toEqual(["chat-hook"]);
    expect(hook(toolEvent(path.join(paths.sandbox, notePath()), "edit"), { cwd: paths.sandbox })).toBeUndefined();
  });

  it("leaves failed tools, unrelated paths and check failures unchanged", () => {
    write(notePath(), "# Incomplete"); const hook = install();
    for (const event of [toolEvent(notePath(), "write", true), toolEvent(notePath(), "read"), toolEvent("../outside.md"), toolEvent("연구노트/unknown/index.md"), toolEvent("other.md"), { ...toolEvent(notePath()), input: null }]) expect(hook(event, { cwd: paths.sandbox })).toBeUndefined();
    expect(getResearchNote(paths, first).note.sessions).toEqual([]);
    write(".kady/geo/notes.json", "malformed");
    expect(hook(toolEvent(notePath()), { cwd: paths.sandbox })).toBeUndefined();
    expect(fs.readFileSync(path.join(geoStateDir(paths), "notes.json"), "utf8")).toBe("malformed");
  });

  it("registers the lead hook through geoSessionParts and carries the exact concise prompt rule", () => {
    write(notePath(), source());
    const parts = geoSessionParts({ paths, projectId: paths.id, sessionId: "parts-chat", isNew: false });
    for (const factory of parts.extensionFactories) install(factory)?.(toolEvent(notePath()), { cwd: paths.sandbox });
    expect(getResearchNote(paths, first).note.sessions).toEqual(["parts-chat"]);
    expect(GEO_INSTRUCTIONS).toContain(`- ${RESEARCH_NOTE_RULE}`);
    expect(RESEARCH_NOTE_RULE).toContain("Keep logging notebook entries.");
  });
});

it("serves project-scoped list/read/status routes, validates status and returns 404/413", async () => {
  write(notePath(), source()); write(notePath("huge"), Buffer.alloc(RESEARCH_NOTE_LIMITS.fileBytes + 1));
  const other = resolvePaths("research-notes-other"); others.push(other); fs.mkdirSync(other.sandbox, { recursive: true });
  const app = Fastify();
  app.addHook("onRequest", (request, _reply, done) => withActiveProject(String(request.headers["x-project-id"] ?? paths.id), done));
  await registerGeoNoteRoutes(app);
  const url = `/geo/notes/${encodeURIComponent(first)}`;
  try {
    expect((await app.inject({ url: "/geo/notes" })).json().notes).toHaveLength(1);
    expect((await app.inject({ url })).json()).toMatchObject({ content: source(), note: { id: first } });
    expect((await app.inject({ url: "/geo/notes", headers: { "x-project-id": other.id } })).json().notes).toEqual([]);
    expect((await app.inject({ url, headers: { "x-project-id": other.id } })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `${url}/status`, payload: { status: "confirmed" } })).json()).toMatchObject({ id: first, status: "confirmed" });
    expect((await app.inject({ method: "POST", url: `${url}/status`, payload: { status: "pending" } })).json().status).toBe("pending");
    for (const payload of [{ status: "invalid" }, {}, { status: 1 }, []]) expect((await app.inject({ method: "POST", url: `${url}/status`, payload })).statusCode).toBe(400);
    expect((await app.inject({ url: "/geo/notes/unknown" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/geo/notes/unknown/status", payload: { status: "confirmed" } })).statusCode).toBe(404);
    expect((await app.inject({ url: "/geo/notes/huge" })).statusCode).toBe(413);
  } finally { await app.close(); }
});

it("includes a lead-written research note and figures in the provenance-backed hub preview", async () => {
  const sessionId = "note-handoff";
  write(`.pi/sessions/${sessionId}.jsonl`, JSON.stringify({ type: "message", message: { role: "user", content: [{ type: "text", text: "Analyse the samples" }] } }) + "\n");
  const recorder = new ProvenanceRecorder({ projectId: paths.id, sessionId, sandboxRoot: paths.sandbox, getModel: () => undefined, captureEnvironment: false });
  const files = [notePath(), `연구노트/${first}/figures/map.png`];
  for (const [i, file] of files.entries()) {
    recorder.observe({ type: "tool_execution_start", toolCallId: `write-${i}`, toolName: "write", args: { path: file } } as never);
    write(file, file.endsWith(".md") ? source() : "figure");
    recorder.observe({ type: "tool_execution_end", toolCallId: `write-${i}`, toolName: "write", result: { content: [] }, isError: false } as never);
  }
  await recorder.flush();
  expect(previewHandoff(paths, sessionId).files.map(file => file.path)).toEqual(expect.arrayContaining(files));
});
