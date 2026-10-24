import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryCollection, LibraryItem } from "../../../../../web/src/geo/contracts/library.ts";
import type { LibrarySyncResult, LibrarySyncStatus } from "../../../../../web/src/geo/contracts/hub-server.ts";
import { AuthoringError } from "../../authoring/store.ts";
import { HubClient, type RequestOptions } from "../../hub-client/client.ts";
import { LIBRARY_FILE_LIMIT, type LibraryChangesResponse, type LibraryObject, type LibraryPushChange, type LibraryPushResponse } from "../../hub-server/protocol.ts";
import { LibraryStore } from "../store.ts";
import { refreshNoteItems } from "../notes.ts";
import { readStoredPdf } from "../reader.ts";

type Data = LibraryItem | LibraryCollection;
interface ObjectState { version: number; hash: string | null }
interface SyncState { serverVersion: number; objects: Record<string, ObjectState>; lastSyncedAt?: string; files?: string[] }
const keyOf = (kind: string, id: string) => `${kind}:${id}`;
// Stable JSON ignores key insertion order, but preserves array ordering and every stored field.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const hash = (data?: Data) => data ? createHash("sha256").update(stable(data)).digest("hex") : null;
const storedFiles = (data: Data | undefined): string[] => data && "attachments" in data ? [...new Set(data.attachments.flatMap((a) => a.stored ? [a.stored.sha256] : []))] : [];
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";
const blankCounts = () => ({ items: 0, folders: 0, files: 0, deleted: 0 });
/** The hub server takes ≤ 500 changes and a 4 MiB body per push; research-note snapshots make items larger. */
const PUSH_BATCH = { changes: 500, bytes: 3 * 1024 * 1024 };
export function pushBatches(changes: LibraryPushChange[]): LibraryPushChange[][] {
  const out: LibraryPushChange[][] = [];
  let batch: LibraryPushChange[] = [], bytes = 0;
  for (const change of changes) {
    const size = Buffer.byteLength(JSON.stringify(change));
    if (batch.length && (batch.length >= PUSH_BATCH.changes || bytes + size > PUSH_BATCH.bytes)) { out.push(batch); batch = []; bytes = 0; }
    batch.push(change); bytes += size;
  }
  if (batch.length) out.push(batch);
  return out;
}

/** One working library, one sync at a time; the hub server remains authoritative for account isolation. */
export class LibrarySync {
  private running = false;
  private lastError?: string;
  constructor(readonly client: HubClient, readonly store: LibraryStore) {}

  private context() {
    const c = this.client.connection.current;
    const identity = this.client.identity;
    if (!identity || !c.serverId || !c.account) return null;
    if (![c.serverId, c.account.id].every((id) => /^[a-zA-Z0-9-]{1,100}$/.test(id))) throw new AuthoringError("허브 서버 식별자를 확인해 주세요.", 502);
    const prefix = `${c.serverId}-${c.account.id}`;
    return { identity, prefix, file: join(this.store.root, "sync", `${prefix}.json`) };
  }
  private async state(file: string): Promise<SyncState> {
    try {
      const state = JSON.parse(await readFile(file, "utf8")) as SyncState;
      if (!Number.isSafeInteger(state.serverVersion) || state.serverVersion < 0 || !state.objects || typeof state.objects !== "object") throw new Error("Invalid sync state");
      return state;
    } catch (e) {
      if (missing(e)) return { serverVersion: 0, objects: {} };
      throw new AuthoringError("서재 동기화 기록을 읽지 못했습니다. 기존 기록을 확인해 주세요.", 409);
    }
  }
  private async save(file: string, state: SyncState) {
    await mkdir(join(this.store.root, "sync"), { recursive: true, mode: 0o700 });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    await rename(tmp, file);
  }
  private async local(): Promise<Map<string, Data>> {
    const [items, folders] = await Promise.all([this.store.all(), this.store.collections()]);
    return new Map<string, Data>([...items.map((i) => [keyOf("item", i.id), structuredClone(i)] as const), ...folders.map((i) => [keyOf("folder", i.id), structuredClone(i)] as const)]);
  }
  private changes(local: Map<string, Data>, state: SyncState): LibraryPushChange[] {
    return [...new Set([...local.keys(), ...Object.keys(state.objects)])].flatMap((key) => {
      const data = local.get(key), old = state.objects[key];
      if (hash(data) === (old?.hash ?? null)) return [];
      const [kind, id] = key.split(":") as ["item" | "folder", string];
      return [{ kind, id, baseVersion: old?.version ?? 0, deleted: !data, ...(data ? { data } : {}) }];
    });
  }
  async status(): Promise<LibrarySyncStatus> {
    const c = this.context();
    if (c) await refreshNoteItems(this.store).catch(() => undefined);
    const empty: LibrarySyncStatus = { available: Boolean(c), running: this.running, pending: { items: 0, folders: 0, files: 0 }, conflicts: 0 };
    if (!c) return empty;
    const state = await this.state(c.file);
    const changes = this.changes(await this.local(), state);
    const files = new Set(changes.flatMap((change) => storedFiles(change.data as Data | undefined)).filter((sha) => !state.files?.includes(sha)));
    let conflicts = 0;
    try { conflicts = (await readdir(join(this.store.root, "sync", "conflicts"))).filter((n) => n.startsWith(`${c.prefix}-`)).length; }
    catch (e) { if (!missing(e)) throw e; }
    return { ...empty, ...(state.lastSyncedAt ? { lastSyncedAt: state.lastSyncedAt } : {}), serverVersion: state.serverVersion,
      pending: { items: changes.filter((c) => c.kind === "item").length, folders: changes.filter((c) => c.kind === "folder").length, files: files.size },
      conflicts, ...(this.lastError ? { lastError: this.lastError } : {}) };
  }
  private reading?: Promise<void>;
  /**
   * PDFs that arrived through sync carry the other PC's read state but no page text here, so the agent's library_read
   * would return empty pages (gaid-library-prep). Extract the missing page caches in the background, one PDF at a time;
   * readStoredPdf returns at once for PDFs already read. Exposed for tests.
   */
  readPulledPdfs(): Promise<void> {
    this.reading ??= (async () => {
      try {
        for (const item of await this.store.all()) {
          for (const a of item.attachments) {
            if (a.kind !== "pdf" || !a.stored) continue;
            try { await readStoredPdf(this.store, a.stored.sha256); } catch { /* left unread; shown by read coverage */ }
          }
        }
      } finally { this.reading = undefined; }
    })();
    return this.reading;
  }

  async sync(): Promise<LibrarySyncResult> {
    if (this.running) throw new AuthoringError("서재를 동기화하고 있습니다. 끝난 뒤 다시 시도해 주세요.", 409);
    const context = this.context();
    if (!context) throw new AuthoringError("허브 서버에 로그인한 뒤 서재를 동기화해 주세요.", 401);
    this.running = true; this.lastError = undefined;
    const pulled = blankCounts(), pushed = blankCounts();
    let conflicts = 0;
    const request = <T>(path: string, options: RequestOptions = {}) => this.client.request<T>(path, { ...options, identity: context.identity });
    const backup = async (kind: string, id: string, data: Data | undefined) => {
      if (!data) return;
      const dir = join(this.store.root, "sync", "conflicts");
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(join(dir, `${context.prefix}-${new Date().toISOString().replace(/:/g, "-")}-${kind}-${id}-${randomUUID().slice(0, 8)}.json`), JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
    };
    try {
      // Research notes follow their files; send what the files say now.
      await refreshNoteItems(this.store).catch(() => undefined);
      const state = await this.state(context.file);
      const download = async (data: Data) => {
        for (const sha of storedFiles(data)) {
          try {
            const bytes = await readFile(this.store.filePath(sha));
            if (createHash("sha256").update(bytes).digest("hex") !== sha) throw new AuthoringError("로컬 서재 PDF의 내용이 저장 기록과 다릅니다.", 409);
            state.files = [...new Set([...(state.files ?? []), sha])];
            continue;
          } catch (e) { if (!missing(e)) throw e; }
          const bytes = await request<Buffer>(`/library/files/${sha}`, { file: true, limit: LIBRARY_FILE_LIMIT });
          if (createHash("sha256").update(bytes).digest("hex") !== sha) throw new AuthoringError("받은 서재 PDF의 내용이 기록과 다릅니다.", 502);
          await this.store.storePdf(bytes); pulled.files++;
          state.files = [...new Set([...(state.files ?? []), sha])];
        }
      };
      const applyPull = async () => {
        const response = await request<LibraryChangesResponse>(`/library/changes?since=${state.serverVersion}`);
        if (!Number.isSafeInteger(response.version) || response.version < state.serverVersion || !Array.isArray(response.changes)) throw new AuthoringError("서재 동기화 응답 형식을 확인해 주세요.", 502);
        for (const remote of response.changes) {
          validate(remote);
          const key = keyOf(remote.kind, remote.id), baseline = state.objects[key];
          if (baseline && baseline.version >= remote.version) continue; // Safe replay after a partly applied pull.
          const remoteData = remote.deleted ? undefined : structuredClone(remote.data as Data);
          if (remoteData) await download(remoteData);
          this.client.assertIdentity(context.identity);
          const local = await this.local(); // Re-read after file downloads, so concurrent local edits count as changes.
          const current = local.get(key);
          const changed = hash(current) !== (baseline?.hash ?? null);
          const differs = hash(current) !== hash(remoteData);
          const collision = changed && differs;
          // Tombstones/folders have no update clock: remote wins unless both sides are live items and local is newer.
          const localWins = collision && remote.kind === "item" && current && remoteData &&
            Date.parse((current as LibraryItem).updatedAt) > Date.parse((remoteData as LibraryItem).updatedAt);
          if (collision) {
            conflicts++;
            await backup(remote.kind, remote.id, localWins ? remoteData : current);
          }
          if (!localWins) {
            if (remote.kind === "item") {
              if (!remoteData) await this.store.drop(remote.id);
              else {
                const item = remoteData as LibraryItem;
                const ref = item.zotero;
                const duplicates = ref ? [...local.values()].filter((v): v is LibraryItem => "csl" in v && v.id !== item.id && Boolean(v.zotero) && v.zotero!.libraryType === ref.libraryType && v.zotero!.libraryId === ref.libraryId && v.zotero!.itemKey === ref.itemKey) : [];
                if (duplicates.length) item.aliases = { ...item.aliases, ids: [...new Set([...(item.aliases?.ids ?? []), ...duplicates.flatMap((d) => [d.id, ...(d.aliases?.ids ?? [])])])],
                  citationKeys: [...new Set([...(item.aliases?.citationKeys ?? []), ...duplicates.flatMap((d) => [d.citationKey, ...(d.aliases?.citationKeys ?? [])].filter((v): v is string => Boolean(v) && v !== item.citationKey))])] };
                await this.store.put(item); // Publish aliases before dropping duplicates, preserving citation resolution.
                for (const d of duplicates) { await backup("item", d.id, d); await this.store.drop(d.id); }
              }
            } else {
              const folders = await this.store.collections();
              await this.store.saveCollections([...folders.filter((f) => f.id !== remote.id), ...(remoteData ? [remoteData as LibraryCollection] : [])]);
            }
            if (remote.deleted) pulled.deleted++;
            else pulled[remote.kind === "item" ? "items" : "folders"]++;
          }
          // The baseline is the server's bytes, not a local winner or aliases introduced during dedupe.
          state.objects[key] = { version: remote.version, hash: remote.deleted ? null : hash(remote.data as Data) };
          await this.save(context.file, state);
        }
        state.serverVersion = response.version;
        await this.save(context.file, state);
      };
      await applyPull();
      // One stale pull/retry, not an unbounded loop if another device keeps changing the same object.
      for (let attempt = 0; attempt < 2; attempt++) {
        const changes = this.changes(await this.local(), state);
        if (!changes.length) break;
        for (const sha of new Set(changes.flatMap((c) => storedFiles(c.data as Data | undefined)))) {
          try { await request(`/library/files/${sha}`, { method: "HEAD" }); }
          catch (e) {
            if (!(e instanceof AuthoringError) || e.status !== 404) throw e;
            let bytes: Buffer;
            try { bytes = await readFile(this.store.filePath(sha)); }
            catch { throw new AuthoringError("동기화할 서재 PDF를 찾지 못했습니다. PDF를 다시 가져온 뒤 시도해 주세요.", 409); }
            if (createHash("sha256").update(bytes).digest("hex") !== sha) throw new AuthoringError("서재 PDF의 내용이 저장 기록과 다릅니다.", 409);
            await request(`/library/files/${sha}`, { method: "PUT", bytes, file: true, limit: LIBRARY_FILE_LIMIT }); pushed.files++;
          }
          state.files = [...new Set([...(state.files ?? []), sha])];
        }
        const response: Pick<LibraryPushResponse, "conflicts"> = { conflicts: [] };
        for (const batch of pushBatches(changes)) {
          const part = await request<LibraryPushResponse>("/library/changes", { method: "POST", body: { changes: batch } });
          for (const applied of part.applied) {
            const change = batch.find((c) => c.kind === applied.kind && c.id === applied.id);
            if (!change) throw new AuthoringError("서재 동기화 응답 형식을 확인해 주세요.", 502);
            state.objects[keyOf(change.kind, change.id)] = { version: applied.version, hash: change.deleted ? null : hash(change.data as Data) };
            if (change.deleted) pushed.deleted++; else pushed[change.kind === "item" ? "items" : "folders"]++;
          }
          response.conflicts.push(...part.conflicts);
          // Do not advance the pull cursor to push.version: unseen concurrent remote changes may precede our push.
          await this.save(context.file, state);
        }
        if (!response.conflicts.length) { await applyPull(); break; }
        if (response.conflicts.some((c) => c.reason === "missing-file")) throw new AuthoringError("허브 서버에서 서재 PDF를 확인하지 못했습니다. 다시 동기화해 주세요.", 409);
        if (attempt === 1) throw new AuthoringError("다른 기기에서 서재가 바뀌었습니다. 다시 동기화해 주세요.", 409);
        await applyPull();
      }
      state.lastSyncedAt = new Date().toISOString();
      await this.save(context.file, state);
      this.running = false;
      this.readPulledPdfs();
      return { status: await this.status(), pulled, pushed, conflicts };
    } catch (e) {
      this.lastError = e instanceof AuthoringError ? e.message : "서재를 동기화하지 못했습니다. 로컬 파일과 서버 연결을 확인해 주세요.";
      if (e instanceof AuthoringError) throw e;
      throw new AuthoringError(this.lastError, 502);
    } finally { this.running = false; }
  }
}

function validate(remote: LibraryObject): void {
  if (!remote || !["item", "folder"].includes(remote.kind) || !Number.isSafeInteger(remote.version) || remote.version < 1 ||
      !(remote.kind === "item" ? /^li-[a-z0-9]{12}$/ : /^(?:lc-[a-z0-9]{12}|zc-[a-zA-Z0-9%_.!~*'()-]{1,1000})$/).test(remote.id))
    throw new AuthoringError("서재 동기화 항목 형식을 확인해 주세요.", 502);
  if (remote.deleted) return;
  const data = remote.data as Data;
  if (!data || data.id !== remote.id || typeof data.owner !== "string" || !["gaid", "zotero"].includes(data.source)) throw new AuthoringError("서재 동기화 항목 형식을 확인해 주세요.", 502);
  if (remote.kind === "item") {
    const item = data as LibraryItem;
    if (!item.csl || typeof item.csl.title !== "string" || !Array.isArray(item.attachments) || !Array.isArray(item.tags) || !Array.isArray(item.collectionIds) || !item.read || typeof item.updatedAt !== "string")
      throw new AuthoringError("서재 논문 형식을 확인해 주세요.", 502);
    for (const sha of storedFiles(item)) if (!/^[a-f0-9]{64}$/.test(sha)) throw new AuthoringError("서재 PDF 식별자를 확인해 주세요.", 502);
  } else if (typeof (data as LibraryCollection).name !== "string") throw new AuthoringError("서재 폴더 형식을 확인해 주세요.", 502);
}
