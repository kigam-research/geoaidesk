/**
 * `/geo/library/*`: the researcher's personal library (ADR 2026-10-21-research-hub-library). The project scope comes
 * from the usual request scope (X-Project-Id); the library itself is user-level.
 */
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { activePaths, listProjects, resolvePaths, type ProjectPaths } from "../../projects.ts";
import { folderSubtree, isNoteItem, numericCslDates } from "../../../../web/src/geo/contracts/library.ts";
import type {
  AddLibraryNoteBody,
  AddLibraryNoteResponse,
  CitationResolution,
  ExportFormat,
  FolderCheckResponse,
  FolderIssue,
  CreateLibraryItemBody,
  LibraryItem,
  LibraryListResponse,
  LibraryItemResponse,
  LibraryNoteCandidatesResponse,
  LibraryUse,
  UploadedLibraryFile,
} from "../../../../web/src/geo/contracts/library.ts";
import { LibraryError, libraryStore, normalizeDoi, cslYear, samePaper, summarize, type LibraryStore } from "../library/store.ts";
import { readStoredPdf, storedPdf } from "../library/reader.ts";
import { buildUsesIndex, hasScope, projectItems, projectNoteCitations, readProjectLiterature, scopeFolders, writeProjectLiterature } from "../library/uses.ts";
import { AuthoringStore } from "../authoring/store.ts";
import { zoteroService, type ZoteroService } from "../library/zotero-service.ts";
import { ZoteroError } from "../library/zotero/index.ts";
import { addNoteItem, libraryInstance, noteCandidates, noteIsLocal, noteSummary, refreshNoteItems } from "../library/notes.ts";

/** Error code and HTTP status only (never Zotero bodies or keys), shown behind 기술 정보. */
const zoteroErrorDetail = (error: ZoteroError) => [error.code, error.status ? `HTTP ${error.status}` : ""].filter(Boolean).join(" · ");
import { arxivDoi, identifyPdf, lookupDoi, resolveUrl, searchByTitle, type MetadataRecord } from "../library/metadata/index.ts";
import { exportBibliography, formatReference, parseBibliography, type BibliographyFormat } from "../library/formats/index.ts";
import type { ImportPreview, LookupBody, LookupResponse, MetadataCandidate } from "../../../../web/src/geo/contracts/library.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { addSource } from "../authoring/sources.ts";

export interface LibraryRouteOptions {
  store?: () => LibraryStore;
  paths?: () => ProjectPaths;
  authoring?: () => AuthoringStore;
  zotero?: (store: LibraryStore) => ZoteroService;
}

/** One plain APA-like reference line for a note's reference list (formats unit; not a full CSL style). */
export function referenceLine(item: LibraryItem): string {
  return formatReference(item.csl, "ko");
}

const candidate = (r: MetadataRecord & { score?: number }): MetadataCandidate => ({
  csl: r.csl, metadataOrigin: r.metadataOrigin, signals: r.signals.map((x) => ({ kind: x.kind, relation: x.relation, source: x.source, ...(x.doi ? { doi: x.doi } : {}), ...(x.label ? { label: x.label } : {}), ...(x.updatedAt ? { updatedAt: x.updatedAt } : {}) })),
  ...(r.score !== undefined ? { score: r.score } : {}),
});
const FORMATS: BibliographyFormat[] = ["bibtex", "ris", "csl-json"];
const EXPORTS: ExportFormat[] = [...FORMATS, "text"];

/** Plain reference list sorted by first author and year (`text` export; APA-like, not a full CSL style). */
export function referenceList(items: LibraryItem[], locale: "ko" | "en"): string {
  const sortKey = (i: LibraryItem) => `${(i.csl.author?.[0]?.family ?? i.csl.author?.[0]?.literal ?? i.csl.title).toLowerCase()} ${cslYear(i.csl) ?? 0}`;
  return [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b), locale)).map((i) => formatReference(i.csl, locale)).join("\n") + "\n";
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
      if (error instanceof ZoteroError) {
        const refused = error.state === "key-rejected" || error.state === "key-invalid" || error.state === "no-library-access";
        return reply.code(refused ? 403 : 502).send({ error: "zotero", state: error.state, detail: zoteroErrorDetail(error) });
      }
      if ((error as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ error: "요청이 너무 큽니다." });
      if ((error as { statusCode?: number }).statusCode === 400) return reply.code(400).send({ error: "요청 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onSend", async (_req, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });

    scope.get<{ Querystring: Record<string, string | undefined> }>("/geo/library", async (req): Promise<LibraryListResponse> => {
      const store = storeOf(), q = req.query ?? {};
      zoteroOf(store).refreshIfStale();
      // Research notes follow their files (the master); a failed refresh keeps the last snapshot.
      try { await refreshNoteItems(store); } catch (error) { scope.log.warn({ err: error }, "research-note refresh failed"); }
      const everything = (await store.all()).filter((i) => !i.removedFromSourceAt);
      const collections = await store.collections();
      const instance = libraryInstance(store), projectIds = new Set(listProjects().map((p) => p.id));
      const uses = buildUsesIndex(everything, await workflowUses(store), collections, instance.id);
      const kind = q.kind === "note" || q.kind === "paper" ? q.kind : undefined;
      const notes = everything.filter(isNoteItem);
      const all = everything.filter((i) => !isNoteItem(i));
      const ofKind = kind === "note" ? notes : kind === "paper" ? all : everything;
      const inProject = q.filter === "project" ? new Set(projectItems(readProjectLiterature(pathsOf()), all, collections).map((i) => i.id)) : undefined;
      // A folder shows its subfolders' papers too.
      const inFolder = q.collectionId ? folderSubtree(collections, q.collectionId) : undefined;
      const terms = (q.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
      const unread = (i: LibraryItem) => i.read.coverage === "none" || i.read.coverage === "abstract";
      const rows = ofKind
        .filter((i) => !q.source || i.source === q.source)
        .filter((i) => !q.noteStatus || i.note?.status === q.noteStatus)
        .filter((i) => !inFolder || i.collectionIds.some((c) => inFolder.has(c)))
        .filter((i) => q.filter !== "unread" || unread(i))
        .filter((i) => q.filter !== "cited" || uses.counts(i).notes > 0)
        .filter((i) => q.filter !== "mine" || Boolean(i.ownWork))
        .filter((i) => !inProject || inProject.has(i.id))
        .filter((i) => {
          if (!terms.length) return true;
          const hay = [i.csl.title, i.csl["container-title"], i.csl.abstract, i.citationKey, ...(i.csl.author ?? []).map((a) => `${a.given ?? ""} ${a.family ?? a.literal ?? ""}`), ...i.tags,
            i.note?.projectName, i.note?.markdown]
            .filter((x): x is string => typeof x === "string").join(" ").toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
        .sort((a, b) => (cslYear(b.csl) ?? 0) - (cslYear(a.csl) ?? 0) || b.addedAt.localeCompare(a.addedAt));
      const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500), offset = Math.max(Number(q.offset) || 0, 0);
      const z = await store.zotero();
      return {
        items: rows.slice(offset, offset + limit).map((i) => summarize(i, uses.counts(i), noteSummary(i, noteIsLocal(i, instance.id, projectIds)))),
        total: rows.length,
        counts: {
          all: all.length,
          zotero: all.filter((i) => i.source === "zotero").length,
          gaid: all.filter((i) => i.source === "gaid").length,
          unread: all.filter(unread).length,
          cited: all.filter((i) => uses.counts(i).notes > 0).length,
          mine: all.filter((i) => i.ownWork).length,
          notes: notes.length,
          notesPending: notes.filter((i) => i.note?.status === "pending").length,
          notesConfirmed: notes.filter((i) => i.note?.status === "confirmed").length,
        },
        collections,
        folderCounts: Object.fromEntries(collections.map((c) => {
          const sub = folderSubtree(collections, c.id);
          return [c.id, ofKind.filter((i) => i.collectionIds.some((x) => sub.has(x))).length];
        })),
        zotero: z.libraries,
      };
    });

    scope.get<{ Params: { id: string } }>("/geo/library/items/:id", async (req): Promise<LibraryItemResponse> => {
      const store = storeOf();
      let item = await store.get(req.params.id);
      if (isNoteItem(item)) {
        try { if (await refreshNoteItems(store, [item])) item = await store.get(item.id); } catch (error) { scope.log.warn({ err: error }, "research-note refresh failed"); }
      }
      const instance = libraryInstance(store);
      const uses = buildUsesIndex(await store.all(), await workflowUses(store), await store.collections(), instance.id);
      return { item, uses: uses.usesOf(item), ...(isNoteItem(item) ? { noteLocal: noteIsLocal(item, instance.id, new Set(listProjects().map((p) => p.id))) } : {}) };
    });

    /** "서재에 넣기" for a research note; the project is the body's or the request scope's. */
    scope.post<{ Body: AddLibraryNoteBody }>("/geo/library/notes", { bodyLimit: 16 * 1024 }, async (req, reply): Promise<AddLibraryNoteResponse> => {
      const body = req.body ?? ({} as AddLibraryNoteBody);
      const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : pathsOf().id;
      const result = await addNoteItem(storeOf(), { projectId, noteId: body.noteId, collectionIds: body.collectionIds });
      reply.code(result.created ? 201 : 200);
      return result;
    });
    scope.get("/geo/library/notes/candidates", async (): Promise<LibraryNoteCandidatesResponse> => noteCandidates(storeOf()));

    // PDFs are base64 in JSON like hub authoring sources (64 MiB decoded max).
    scope.post<{ Body: { contentBase64?: unknown } }>("/geo/library/files", { bodyLimit: 90 * 1024 * 1024 }, async (req, reply): Promise<UploadedLibraryFile> => {
      if (typeof req.body?.contentBase64 !== "string") throw new LibraryError("contentBase64 is required");
      const stored = await storeOf().storePdf(Buffer.from(req.body.contentBase64, "base64"));
      reply.code(201);
      return { ...stored, mediaType: "application/pdf" };
    });

    /** Looks up reference details by DOI, URL, title or an uploaded PDF; the researcher confirms one candidate. */
    scope.post<{ Body: LookupBody }>("/geo/library/lookup", { bodyLimit: 16 * 1024 }, async (req): Promise<LookupResponse> => {
      const body = req.body ?? {};
      const notes: LookupResponse["notes"] = [];
      let titleGuess: string | undefined;
      let dois: string[] = [];
      if (typeof body.doi === "string" && body.doi.trim()) dois = [body.doi.trim()];
      else if (typeof body.url === "string" && body.url.trim()) dois = (await resolveUrl(body.url.trim())).doiCandidates;
      else if (typeof body.pdfSha256 === "string") {
        const id = await identifyPdf(storeOf().filePath(body.pdfSha256));
        if (!id.textFound) notes.push("pdf-no-text");
        // An arXiv PDF carries its identifier but no DOI; its DataCite DOI names the exact preprint (gaid-first-use-fixes).
        dois = id.doiCandidates.length ? id.doiCandidates : id.arxivIds.slice(0, 1).map(arxivDoi);
        titleGuess = id.titleGuess;
      }
      const candidates: MetadataCandidate[] = [];
      for (const doi of dois.slice(0, 3)) {
        try { candidates.push(candidate(await lookupDoi(doi))); } catch { notes.push("provider-error"); }
      }
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : !candidates.length ? titleGuess : undefined;
      if (!dois.length && !title) notes.push("no-doi");
      if (!candidates.length && title) {
        const found = await searchByTitle(title, typeof body.author === "string" ? body.author : undefined);
        candidates.push(...found.candidates.slice(0, 5).map(candidate));
        if (found.errors.length) notes.push("provider-error");
      }
      if (!candidates.length && !notes.includes("pdf-no-text")) notes.push("not-found");
      return { candidates, notes: [...new Set(notes)], ...(titleGuess ? { titleGuess } : {}) };
    });

    /** Bibliography file preview (BibTeX, RIS, CSL-JSON); nothing is stored. */
    scope.post<{ Body: { text?: unknown; format?: unknown } }>("/geo/library/import", { bodyLimit: 9 * 1024 * 1024 }, async (req): Promise<ImportPreview> => {
      const format = req.body?.format as BibliographyFormat;
      if (typeof req.body?.text !== "string" || !FORMATS.includes(format)) throw new LibraryError("text and format (bibtex, ris, csl-json) are required");
      const parsed = parseBibliography(req.body.text, format);
      return { items: parsed.items, errors: parsed.errors };
    });
    /** Adds the previewed entries the researcher kept; duplicates (same DOI) are skipped and counted. */
    scope.post<{ Body: { items?: unknown } }>("/geo/library/import/confirm", { bodyLimit: 9 * 1024 * 1024 }, async (req) => {
      if (!Array.isArray(req.body?.items)) throw new LibraryError("items is required");
      const store = storeOf();
      let added = 0, duplicates = 0, failed = 0;
      for (const csl of req.body.items.slice(0, 10_000)) {
        try { await store.addGaidItem({ csl, metadataOrigin: "import" }); added++; }
        catch (e) { if (e instanceof LibraryError && e.status === 409) duplicates++; else failed++; }
      }
      return { added, duplicates, failed };
    });
    /** Bibliography of the whole library, chosen items, or one folder with its subfolders (a manuscript's references). */
    scope.get<{ Querystring: { format?: string; ids?: string; collectionId?: string; lang?: string } }>("/geo/library/export", async (req, reply) => {
      const format = (req.query?.format ?? "bibtex") as ExportFormat;
      if (!EXPORTS.includes(format)) throw new LibraryError("format must be bibtex, ris, csl-json or text");
      const store = storeOf();
      const wanted = new Set((req.query?.ids ?? "").split(",").filter(Boolean));
      let folder: Set<string> | undefined, name = "gaid-library";
      if (req.query?.collectionId) {
        const collections = await store.collections();
        const c = collections.find((x) => x.id === req.query.collectionId);
        if (!c) throw new LibraryError("Folder not found", 404);
        folder = folderSubtree(collections, c.id);
        name = c.name.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 60) || "folder";
      }
      // Research notes are not references: never in a bibliography.
      const items = (await store.all()).filter((i) => !i.removedFromSourceAt && !isNoteItem(i) && (!wanted.size || wanted.has(i.id)) && (!folder || i.collectionIds.some((c) => folder!.has(c))));
      const text = format === "text"
        ? referenceList(items, req.query?.lang === "en" ? "en" : "ko")
        : exportBibliography(items.map((i) => ({ ...numericCslDates(i.csl), ...(i.citationKey ? { "citation-key": i.citationKey } : {}) })), format);
      const ext = format === "csl-json" ? "json" : format === "bibtex" ? "bib" : format === "ris" ? "ris" : "txt";
      reply.header("Content-Type", format === "csl-json" ? "application/json" : "text/plain; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="gaid-library.${ext}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`);
      return text;
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
    scope.patch<{ Params: { id: string }; Body: { name?: unknown; parentId?: unknown } }>("/geo/library/collections/:id", async (req) =>
      storeOf().editGaidCollection(req.params.id, req.body ?? {}));
    scope.delete<{ Params: { id: string } }>("/geo/library/collections/:id", async (req) => storeOf().removeGaidCollection(req.params.id));
    /** Adds or removes papers; a Zotero item added to a folder linked to its library is also added in Zotero. */
    scope.post<{ Params: { id: string }; Body: { itemIds?: unknown; action?: unknown } }>("/geo/library/collections/:id/items", async (req) => {
      const ids = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter((x): x is string => typeof x === "string") : [];
      const action = req.body?.action === "remove" ? "remove" : req.body?.action === "add" ? "add" : undefined;
      if (!ids.length || !action) throw new LibraryError("itemIds and action (add, remove) are required");
      return zoteroOf(storeOf()).setMembership(req.params.id, ids, action);
    });
    scope.post<{ Params: { id: string } }>("/geo/library/collections/:id/send-to-zotero", async (req) => zoteroOf(storeOf()).sendFolderToZotero(req.params.id));

    /** Reference check of a folder (with subfolders): gaps and signals per paper, and note citations outside it. */
    scope.get<{ Params: { id: string } }>("/geo/library/collections/:id/check", async (req): Promise<FolderCheckResponse> => {
      const store = storeOf(), collections = await store.collections();
      if (!collections.some((c) => c.id === req.params.id)) throw new LibraryError("Folder not found", 404);
      const sub = folderSubtree(collections, req.params.id);
      const all = await store.all();
      const items = all.filter((i) => !isNoteItem(i) && i.collectionIds.some((c) => sub.has(c)));
      const issues: FolderIssue[] = [];
      const one = (kind: Extract<FolderIssue, { itemId: string }>["kind"], i: LibraryItem) => issues.push({ kind, itemId: i.id, title: i.csl.title });
      for (const i of items) {
        if (i.removedFromSourceAt) { one("removed-from-zotero", i); continue; }
        if ((i.signals ?? []).some((s) => s.kind === "retraction" && !s.relation.startsWith("update-to"))) one("retracted", i);
        if (!normalizeDoi(i.csl.DOI)) one("no-doi", i);
        if (cslYear(i.csl) === undefined) one("no-year", i);
        if (!(i.csl.author ?? []).length) one("no-authors", i);
        if (!i.metadataConfirmed) one("unconfirmed", i);
        if (i.read.coverage === "none") one("unread", i);
      }
      const live = items.filter((i) => !i.removedFromSourceAt);
      const grouped = new Set<string>();
      for (const a of live) {
        if (grouped.has(a.id)) continue;
        const same = live.filter((b) => b.id !== a.id && !grouped.has(b.id) && samePaper(a.csl, b.csl));
        if (same.length) { [a, ...same].forEach((x) => grouped.add(x.id)); issues.push({ kind: "duplicate", itemIds: [a.id, ...same.map((x) => x.id)], title: a.csl.title }); }
      }
      const inFolder = new Set(live.map((i) => i.id));
      const projects: FolderCheckResponse["projects"] = [];
      for (const project of listProjects()) {
        let paths: ProjectPaths;
        try { paths = resolvePaths(project.id); } catch { continue; }
        const literature = readProjectLiterature(paths);
        if (![...scopeFolders(literature, collections)].some((c) => sub.has(c))) continue;
        projects.push({ id: project.id, name: project.name });
        for (const note of projectNoteCitations(paths)) {
          for (const key of new Set(note.citations.map((c) => c.key))) {
            const item = await store.byCitationKey(key);
            if (item && inFolder.has(item.id)) continue;
            issues.push({ kind: "cited-outside", key, ...(item ? { itemId: item.id, title: item.csl.title } : {}), projectId: project.id, projectName: project.name, noteId: note.noteId, noteTitle: note.title });
          }
        }
      }
      return { folderId: req.params.id, items: live.length, projects, issues };
    });

    scope.get("/geo/library/project", async () => readProjectLiterature(pathsOf()));
    scope.put<{ Body: { collectionIds?: unknown; itemIds?: unknown } }>("/geo/library/project", async (req) => {
      const store = storeOf(), all = await store.all(), collections = await store.collections();
      const known = (id: string) => all.some((i) => i.id === id || i.aliases?.ids?.includes(id));
      const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.filter((id): id is string => typeof id === "string" && known(id)) : [];
      const collectionIds = Array.isArray(req.body?.collectionIds) ? req.body.collectionIds.filter((id): id is string => typeof id === "string" && collections.some((c) => c.id === id)) : [];
      const saved = writeProjectLiterature(pathsOf(), { collectionIds, itemIds });
      // Read the PDFs of attached Zotero items in the background so the agent can cite pages (bounded).
      const pending = projectItems(saved, all, collections).filter((i) => i.source === "zotero" && i.read.coverage === "none" && i.attachments.some((a) => a.kind === "pdf" && a.zoteroAttachmentKey)).slice(0, 20);
      void (async () => { for (const item of pending) { try { await zoteroOf(store).readZoteroPdf(item); } catch { /* shown as not read */ } } })();
      return saved;
    });

    scope.get("/geo/library/zotero", async () => ({ libraries: await zoteroOf(storeOf()).libraries() }));
    scope.post("/geo/library/zotero/local", async () => zoteroOf(storeOf()).connectLocal());
    scope.post<{ Body: { key?: unknown } }>("/geo/library/zotero/web", { bodyLimit: 4096 }, async (req) => {
      if (typeof req.body?.key !== "string") throw new LibraryError("key is required");
      return { libraries: await zoteroOf(storeOf()).connectWeb(req.body.key.trim()) };
    });
    scope.post<{ Body: { connection?: unknown } }>("/geo/library/zotero/disconnect", { bodyLimit: 1024 }, async (req) => {
      const connection = req.body?.connection;
      if (connection !== "local" && connection !== "web") throw new LibraryError("connection must be local or web");
      return { libraries: await zoteroOf(storeOf()).disconnect(connection) };
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

    /** Resolution of note citation keys (note view reference list), marked when outside the project's citation scope. */
    scope.get<{ Querystring: { keys?: string } }>("/geo/library/citations", async (req): Promise<CitationResolution[]> => {
      const store = storeOf();
      const keys = [...new Set((req.query?.keys ?? "").split(",").map((k) => k.trim()).filter(Boolean))].slice(0, 200);
      let scope: Set<string> | undefined;
      try {
        const literature = readProjectLiterature(pathsOf());
        if (hasScope(literature)) scope = new Set(projectItems(literature, await store.all(), await store.collections()).map((i) => i.id));
      } catch { /* no project scope */ }
      return Promise.all(keys.map(async (key) => {
        const item = await store.byCitationKey(key);
        if (!item || item.removedFromSourceAt) return { key };
        return { key, itemId: item.id, title: item.csl.title, reference: referenceLine(item), ...(scope && !scope.has(item.id) ? { outsideScope: true } : {}) };
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
