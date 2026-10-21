/**
 * `/geo/library/*`: the researcher's personal library (ADR 2026-10-21-research-hub-library). The project scope comes
 * from the usual request scope (X-Project-Id); the library itself is user-level.
 */
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import type {
  CitationResolution,
  CreateLibraryItemBody,
  LibraryItem,
  LibraryListResponse,
  LibraryUse,
  UploadedLibraryFile,
} from "../../../../web/src/geo/contracts/library.ts";
import { LibraryError, libraryStore, normalizeDoi, shortAuthors, cslYear, summarize, type LibraryStore } from "../library/store.ts";
import { readStoredPdf, storedPdf } from "../library/reader.ts";
import { buildUsesIndex, projectItems, readProjectLiterature, writeProjectLiterature } from "../library/uses.ts";
import { AuthoringStore } from "../authoring/store.ts";
import { zoteroService, type ZoteroService } from "../library/zotero-service.ts";
import { ZoteroError } from "../library/zotero/index.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { addSource } from "../authoring/sources.ts";

export interface LibraryRouteOptions {
  store?: () => LibraryStore;
  paths?: () => ProjectPaths;
  authoring?: () => AuthoringStore;
  zotero?: (store: LibraryStore) => ZoteroService;
}

/** One plain APA-like reference line (the metadata unit's formatter replaces this when integrated). */
export function referenceLine(item: LibraryItem): string {
  const year = cslYear(item.csl);
  const parts = [shortAuthors(item.csl, "en"), year ? `(${year})` : "(n.d.)", item.csl.title.replace(/\.$/, "") + "."];
  if (typeof item.csl["container-title"] === "string") parts.push(item.csl["container-title"] + ".");
  const doi = normalizeDoi(item.csl.DOI);
  if (doi) parts.push(`https://doi.org/${doi}`);
  return parts.filter(Boolean).join(" ");
}

// Library item -> hub authoring drafts made from it. Kept in the library directory so the authoring contract stays as is.
function linksFile(store: LibraryStore) { return path.join(store.root, "links.json"); }
function readLinks(store: LibraryStore): Record<string, string[]> {
  try { return JSON.parse(fs.readFileSync(linksFile(store), "utf8")).authoring ?? {}; } catch { return {}; }
}
function writeLinks(store: LibraryStore, authoring: Record<string, string[]>) {
  const tmp = `${linksFile(store)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ authoring }, null, 2) + "\n");
  fs.renameSync(tmp, linksFile(store));
}

export async function registerGeoLibraryRoutes(app: FastifyInstance, options: LibraryRouteOptions = {}): Promise<void> {
  const storeOf = options.store ?? libraryStore;
  const pathsOf = options.paths ?? activePaths;
  const zoteroOf = options.zotero ?? zoteroService;
  // The authoring routes' own store instance (one owner per directory); a fresh one only when they are not registered.
  const authoringOf = options.authoring ?? (() => { try { return getAuthoringStore(app); } catch { return new AuthoringStore(); } });

  async function workflowUses(store: LibraryStore): Promise<(item: LibraryItem) => LibraryUse[]> {
    const links = readLinks(store);
    if (!Object.keys(links).length) return () => [];
    const authoring = authoringOf();
    const titles = new Map<string, { title: string; entryId?: string; revision?: number }>();
    for (const id of new Set(Object.values(links).flat())) {
      try {
        const p = await authoring.read(id);
        titles.set(id, { title: p.title, ...(p.hubEntry ? { entryId: p.hubEntry.entryId } : {}) });
      } catch { /* deleted or archived draft */ }
    }
    return (item) => (links[item.id] ?? []).flatMap((id) => {
      const t = titles.get(id);
      return t ? [{ kind: "workflow" as const, authoringId: id, title: t.title, ...(t.entryId ? { entryId: t.entryId } : {}) }] : [];
    });
  }

  app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof LibraryError) return reply.code(error.status).send({ error: error.message });
      // Research-language Zotero states (never response bodies or keys); the screen words them.
      if (error instanceof ZoteroError) return reply.code(error.state === "key-rejected" ? 403 : 502).send({ error: "zotero", state: error.state });
      if ((error as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ error: "요청이 너무 큽니다." });
      if ((error as { statusCode?: number }).statusCode === 400) return reply.code(400).send({ error: "요청 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onSend", async (_req, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });

    scope.get<{ Querystring: Record<string, string | undefined> }>("/geo/library", async (req): Promise<LibraryListResponse> => {
      const store = storeOf(), q = req.query ?? {};
      zoteroOf(store).refreshIfStale();
      const all = (await store.all()).filter((i) => !i.removedFromSourceAt);
      const uses = buildUsesIndex(all, await workflowUses(store));
      const inProject = q.filter === "project" ? new Set(projectItems(readProjectLiterature(pathsOf()), all).map((i) => i.id)) : undefined;
      const terms = (q.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const unread = (i: LibraryItem) => i.read.coverage === "none" || i.read.coverage === "abstract";
      const rows = all
        .filter((i) => !q.source || i.source === q.source)
        .filter((i) => !q.collectionId || i.collectionIds.includes(q.collectionId))
        .filter((i) => q.filter !== "unread" || unread(i))
        .filter((i) => q.filter !== "cited" || uses.counts(i).notes > 0)
        .filter((i) => !inProject || inProject.has(i.id))
        .filter((i) => {
          if (!terms.length) return true;
          const hay = [i.csl.title, i.csl["container-title"], i.csl.abstract, i.citationKey, ...(i.csl.author ?? []).map((a) => `${a.given ?? ""} ${a.family ?? a.literal ?? ""}`), ...i.tags]
            .filter((x): x is string => typeof x === "string").join(" ").toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
        .sort((a, b) => (cslYear(b.csl) ?? 0) - (cslYear(a.csl) ?? 0) || b.addedAt.localeCompare(a.addedAt));
      const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500), offset = Math.max(Number(q.offset) || 0, 0);
      const z = await store.zotero();
      return {
        items: rows.slice(offset, offset + limit).map((i) => summarize(i, uses.counts(i))),
        total: rows.length,
        counts: {
          all: all.length,
          zotero: all.filter((i) => i.source === "zotero").length,
          gaid: all.filter((i) => i.source === "gaid").length,
          unread: all.filter(unread).length,
          cited: all.filter((i) => uses.counts(i).notes > 0).length,
        },
        collections: await store.collections(),
        zotero: z.libraries,
      };
    });

    scope.get<{ Params: { id: string } }>("/geo/library/items/:id", async (req) => {
      const store = storeOf(), item = await store.get(req.params.id);
      const uses = buildUsesIndex(await store.all(), await workflowUses(store));
      return { item, uses: uses.usesOf(item) };
    });

    // PDFs are base64 in JSON like hub authoring sources (64 MiB decoded max).
    scope.post<{ Body: { contentBase64?: unknown } }>("/geo/library/files", { bodyLimit: 90 * 1024 * 1024 }, async (req, reply): Promise<UploadedLibraryFile> => {
      if (typeof req.body?.contentBase64 !== "string") throw new LibraryError("contentBase64 is required");
      const stored = await storeOf().storePdf(Buffer.from(req.body.contentBase64, "base64"));
      reply.code(201);
      return { ...stored, mediaType: "application/pdf" };
    });

    scope.post<{ Body: CreateLibraryItemBody }>("/geo/library/items", async (req, reply) => {
      const store = storeOf();
      let item = await store.addGaidItem(req.body ?? ({} as CreateLibraryItemBody));
      const sha = storedPdf(item);
      if (sha) {
        const read = await readStoredPdf(store, sha);
        item = await store.mutate(item.id, (next) => { next.read = read; const a = next.attachments.find((x) => x.stored?.sha256 === sha); if (a && read.pagesTotal) a.pages = read.pagesTotal; });
      }
      return reply.code(201).send(item);
    });

    scope.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/geo/library/items/:id", async (req) =>
      storeOf().editGaidItem(req.params.id, req.body ?? {}));

    scope.delete<{ Params: { id: string } }>("/geo/library/items/:id", async (req, reply) => {
      await storeOf().removeGaidItem(req.params.id);
      return reply.code(204).send();
    });

    scope.get<{ Params: { id: string } }>("/geo/library/items/:id/pdf", async (req, reply) => {
      const store = storeOf(), sha = storedPdf(await store.get(req.params.id));
      if (!sha) throw new LibraryError("This item has no PDF stored in GAID", 404);
      reply.header("Content-Type", "application/pdf");
      return reply.send(fs.createReadStream(store.filePath(sha)));
    });

    scope.post<{ Body: { name?: unknown; parentId?: unknown } }>("/geo/library/collections", async (req, reply) =>
      reply.code(201).send(await storeOf().addGaidCollection(req.body?.name, req.body?.parentId)));

    scope.get("/geo/library/project", async () => readProjectLiterature(pathsOf()));
    scope.put<{ Body: { collectionIds?: unknown; itemIds?: unknown } }>("/geo/library/project", async (req) => {
      const store = storeOf(), all = await store.all(), collections = await store.collections();
      const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter((id): id is string => typeof id === "string" && all.some((i) => i.id === id)) : [];
      const collectionIds = Array.isArray(req.body?.collectionIds) ? req.body.collectionIds.filter((id): id is string => typeof id === "string" && collections.some((c) => c.id === id)) : [];
      const saved = writeProjectLiterature(pathsOf(), { collectionIds, itemIds });
      // Read the PDFs of attached Zotero items in the background so the agent can cite pages (bounded).
      const pending = projectItems(saved, all).filter((i) => i.source === "zotero" && i.read.coverage === "none" && i.attachments.some((a) => a.kind === "pdf" && a.zoteroAttachmentKey)).slice(0, 20);
      void (async () => { for (const item of pending) { try { await zoteroOf(store).readZoteroPdf(item); } catch { /* shown as not read */ } } })();
      return saved;
    });

    scope.get("/geo/library/zotero", async () => ({ libraries: await zoteroOf(storeOf()).libraries() }));
    scope.post("/geo/library/zotero/local", async () => zoteroOf(storeOf()).connectLocal());
    scope.post<{ Body: { key?: unknown } }>("/geo/library/zotero/web", { bodyLimit: 4096 }, async (req) => {
      if (typeof req.body?.key !== "string") throw new LibraryError("key is required");
      return { libraries: await zoteroOf(storeOf()).connectWeb(req.body.key.trim()) };
    });
    scope.post("/geo/library/zotero/sync", async () => {
      await zoteroOf(storeOf()).syncAll();
      return { libraries: await zoteroOf(storeOf()).libraries() };
    });
    scope.post<{ Params: { id: string } }>("/geo/library/items/:id/read", async (req) => {
      const store = storeOf(), item = await store.get(req.params.id);
      return item.source === "zotero" ? zoteroOf(store).readZoteroPdf(item) : item;
    });
    scope.post<{ Params: { id: string } }>("/geo/library/items/:id/send-to-zotero", async (req) => zoteroOf(storeOf()).sendToZotero(req.params.id));

    /** Resolution of note citation keys (note view reference list). */
    scope.get<{ Querystring: { keys?: string } }>("/geo/library/citations", async (req): Promise<CitationResolution[]> => {
      const store = storeOf();
      const keys = [...new Set((req.query?.keys ?? "").split(",").map((k) => k.trim()).filter(Boolean))].slice(0, 200);
      return Promise.all(keys.map(async (key) => {
        const item = await store.byCitationKey(key);
        return item && !item.removedFromSourceAt ? { key, itemId: item.id, title: item.csl.title, reference: referenceLine(item) } : { key };
      }));
    });

    /** "이 논문으로 Workflow 만들기": a hub authoring draft with the item's PDF and DOI as its first source. */
    scope.post<{ Params: { id: string } }>("/geo/library/items/:id/authoring", async (req, reply) => {
      const store = storeOf(), item = await store.get(req.params.id), sha = storedPdf(item);
      if (!sha) throw new LibraryError("Add the PDF first: GAID needs the paper text to make a Workflow", 409);
      const authoring = authoringOf();
      await authoring.initialize();
      const project = await authoring.create({ title: item.csl.title.slice(0, 120) });
      const doi = normalizeDoi(item.csl.DOI);
      await addSource(authoring, project.id, {
        name: `${item.citationKey ?? item.id}.pdf`,
        mediaType: "application/pdf",
        kind: "pdf",
        documentKind: "paper",
        contentBase64: fs.readFileSync(store.filePath(sha)).toString("base64"),
        ...(doi ? { doi } : {}),
      });
      const links = readLinks(store);
      links[item.id] = [...new Set([...(links[item.id] ?? []), project.id])];
      writeLinks(store, links);
      return reply.code(201).send({ authoringId: project.id });
    });
  });
}
