import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { recordResearchNoteSession } from "../src/geo/notes/store.ts";
import { appendStep, identify, PROVENANCE_SCHEMA_VERSION, type ArtifactRef } from "../src/provenance/store.ts";
import { registerGeoConnectionRoutes } from "../src/geo/routes/connections.ts";
import { connectionMap } from "../src/geo/connections/index.ts";
import { CONNECTION_LIMITS, type ConnectionMapResponse } from "../../web/src/geo/contracts/connections.ts";
import type { LibraryItem } from "../../web/src/geo/contracts/library.ts";

let paths: ProjectPaths, store: LibraryStore, item: LibraryItem, tmp: string;
const noteId = "2026-10-22-test";
const figure = "연구노트/" + noteId + "/figures/map.png";
const notePath = "연구노트/" + noteId + "/index.md";
const chatId = "session-recorded-not-a-title";
const write = (ref: string, content = "data") => {
  const p = path.join(paths.sandbox, ref);
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content);
  return p;
};
function ref(p: string, confidence: ArtifactRef["confidence"] = "observed"): ArtifactRef {
  const identity = identify(path.join(paths.sandbox, p))!;
  return { path: p, ...identity, change: "read", confidence };
}
beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "connections-library-"));
  paths = resolvePaths("connections-test");
  fs.rmSync(paths.root, { force: true, recursive: true });
  fs.mkdirSync(paths.sandbox, { recursive: true });
  store = new LibraryStore(tmp);
  item = await store.addGaidItem({ csl: { id: "fixture", type: "article-journal", title: "A recorded method", author: [{ family: "Kim" }], issued: { "date-parts": [[2024]] } }, metadataOrigin: "manual" });
  write("data.csv", "x,y\n1,2"); write("plot.py", "plot()"); write(figure, "png bytes");
  write(notePath, "---\ntitle: 분석 결과\ndate: 2026-10-22\nstatus: pending\n---\n# 분석 결과\n[@" + item.citationKey + "] [@unresolved]\n![그림](figures/map.png)");
  recordResearchNoteSession(paths, noteId, chatId);
  appendStep({ schemaVersion: PROVENANCE_SCHEMA_VERSION, id: "draw", sessionId: chatId, timestamp: Date.now(), toolName: "bash", role: "agent",
    inputs: [ref("data.csv", "inferred"), ref("plot.py")], outputs: [{ ...ref(figure), change: "created" }] }, paths.id);
});
afterEach(() => {
  fs.rmSync(paths.root, { force: true, recursive: true });
  fs.rmSync(tmp, { force: true, recursive: true });
});
const options = () => ({ store, chats: async () => [{ id: chatId, name: "그림 분석", created: new Date("2026-10-22") }], workflowUses: () => [] });

describe("connection neighbourhood", () => {
  it("serves note, figure and paper focus through GET with directed links and no unresolved citation node", async () => {
    const app = Fastify();
    await registerGeoConnectionRoutes(app, { ...options(), paths: () => paths });
    for (const focus of ["note:" + noteId, "figure:" + figure, "paper:" + item.id]) {
      const reply = await app.inject({ url: "/geo/connections?" + new URLSearchParams({ focus, depth: "2" }) });
      expect(reply.statusCode).toBe(200);
      const map = reply.json<ConnectionMapResponse>();
      if (process.env.CONNECTION_EVIDENCE_DIR) {
        fs.mkdirSync(process.env.CONNECTION_EVIDENCE_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.CONNECTION_EVIDENCE_DIR, focus.split(":")[0] + ".json"), JSON.stringify(map, null, 2));
      }
      expect(map.focus).toBe(focus);
      expect(map.nodes.find(n => n.id === focus)?.depth).toBe(0);
      expect(map.nodes.every(n => n.depth <= 2)).toBe(true);
      expect(map.nodes.some(n => n.title.includes(chatId) || n.id === "paper:unresolved")).toBe(false);
      expect(map.edges).toContainEqual({ from: "note:" + noteId, to: "paper:" + item.id, kind: "cites", confidence: "observed" });
      // Exact route output remains available as a deterministic fixture assertion.
      if (focus.startsWith("figure:")) {
        expect(map.edges).toContainEqual({ from: "file:plot.py", to: focus, kind: "drew", confidence: "observed" });
        expect(map.edges).toContainEqual({ from: "file:data.csv", to: focus, kind: "used", confidence: "inferred" });
      }
    }
    await app.close();
  });

  it("draws a copied figure as a copy of its source, not as a new drawing by the chat", async () => {
    const copy = "연구노트/" + noteId + "/figures/copy.png";
    write(copy, "png bytes");
    appendStep({ schemaVersion: PROVENANCE_SCHEMA_VERSION, id: "copy", sessionId: chatId, timestamp: Date.now() + 1000, toolName: "bash", role: "agent",
      inputs: [ref(figure)], outputs: [{ ...ref(copy), change: "created" }] }, paths.id);
    const map = await connectionMap(paths, "figure:" + copy, 2, options());
    expect(map.edges).toContainEqual({ from: "figure:" + figure, to: "figure:" + copy, kind: "copied", confidence: "observed" });
    expect(map.edges.some(e => e.from === "chat:" + chatId && e.to === "figure:" + copy)).toBe(false);
    expect(map.edges).toContainEqual({ from: "file:plot.py", to: "figure:" + figure, kind: "drew", confidence: "observed" });
  });

  it("marks changed inputs and missing figures, including boundary nodes, without rewriting note bytes", async () => {
    const original = fs.readFileSync(path.join(paths.sandbox, notePath), "utf8");
    write("data.csv", "new");
    const figureMap = await connectionMap(paths, "figure:" + figure, 1, options());
    expect(figureMap.nodes.find(n => n.id === "file:data.csv")?.attention).toBe("changed");
    fs.unlinkSync(path.join(paths.sandbox, figure));
    const noteMap = await connectionMap(paths, "note:" + noteId, 1, options());
    expect(noteMap.nodes.find(n => n.id === "figure:" + figure)?.attention).toBe("missing");
    expect(fs.readFileSync(path.join(paths.sandbox, notePath), "utf8")).toBe(original);
  });

  it("loads downstream provenance when centred on a data input", async () => {
    const map = await connectionMap(paths, "file:data.csv", 1, options());
    expect(map.nodes.map(n => n.id)).toContain("figure:" + figure);
  });

  it("links trials and paper-derived Workflows, and uses neutral chat labels when history is gone", async () => {
    const trials = path.join(paths.kadyDir, "geo/method-trials");
    fs.mkdirSync(trials, { recursive: true });
    fs.writeFileSync(path.join(trials, chatId + ".json"), JSON.stringify({ schemaVersion: "gaid-method-trial/v1", methodId: "method-one", sessionId: chatId, startedAt: "2026-10-22T00:00:00Z" }));
    const map = await connectionMap(paths, "note:" + noteId, 2, { ...options(), chats: async () => [], workflowUses: () => [{ kind: "workflow", entryId: "entry-one", title: "논문에서 만든 Workflow" }] });
    expect(map.edges.some(e => e.kind === "started-from" && e.from === "workflow:method-one")).toBe(true);
    expect(map.edges.some(e => e.kind === "made-from" && e.to === "workflow:entry-one")).toBe(true);
    expect(map.nodes.find(n => n.kind === "chat")).toMatchObject({ title: "채팅", detail: "2026-10-22" });
  });

  it("joins actual library Workflow links to the method identity and skips model-declared file links", async () => {
    const authoring = new AuthoringStore(path.join(tmp, "authoring"));
    const dir = path.join(authoring.root, "projects", "draft-one");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify({ schemaVersion: "gaid-authoring-project/v1", id: "draft-one", title: "기록된 Workflow", packages: [{ methodId: "method-one" }] }));
    fs.writeFileSync(path.join(store.root, "links.json"), JSON.stringify({ authoring: { [item.id]: ["draft-one"] } }));
    const map = await connectionMap(paths, "paper:" + item.id, 1, { store, authoring, chats: async () => [] });
    expect(map.edges).toContainEqual({ from: "paper:" + item.id, to: "workflow:method-one", kind: "made-from", confidence: "observed" });
    appendStep({ schemaVersion: PROVENANCE_SCHEMA_VERSION, id: "unverified-draw", sessionId: chatId, timestamp: Date.now() + 1, toolName: "bash", role: "agent",
      inputs: [ref("data.csv", "declared")], outputs: [{ ...ref(figure), change: "modified" }] }, paths.id);
    const figureMap = await connectionMap(paths, "figure:" + figure, 1, options());
    expect(figureMap.nodes.some(n => n.id === "file:data.csv")).toBe(false);
  });
  it("cuts a large paper neighbourhood at 80 nodes and rejects bad depth, hidden and escaping paths", async () => {
    for (let i = 0; i < 90; i++) write("연구노트/extra-" + i + "/index.md", "# Note " + i + "\n[@" + item.citationKey + "]");
    const map = await connectionMap(paths, "paper:" + item.id, 1, options());
    expect(map.nodes).toHaveLength(CONNECTION_LIMITS.nodes);
    expect(map.truncated).toBe(true);
    for (const focus of ["file:../outside", "file:.kady/test", "file:/etc/passwd"]) await expect(connectionMap(paths, focus, 1, options())).rejects.toMatchObject({ statusCode: 400 });
    const app = Fastify(); await registerGeoConnectionRoutes(app, { ...options(), paths: () => paths });
    expect((await app.inject({ url: "/geo/connections?focus=note:any&depth=3" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/geo/connections?focus=note:missing" })).statusCode).toBe(404);
    await app.close();
  });
});
