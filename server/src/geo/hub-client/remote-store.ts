import { createHash } from "node:crypto";
import type { HubRecordStore, Actor } from "../hub-shared/records.ts";
import type { StoredEntry } from "../hub-shared/store.ts";
import type { HubComment, HubFolder } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { AuthoringInstall } from "../../../../web/src/geo/contracts/authoring.ts";
import { AuthoringError } from "../authoring/store.ts";
import { HubClient, type RequestOptions } from "./client.ts";

const entryPath = (id: string) => `/entries/${encodeURIComponent(id)}`;
const filePath = (id: string, file: string) => {
  if (!file || file.split("/").some((p) => !p || p === "." || p === ".." || p.includes("\\"))) throw new AuthoringError("허브 파일 경로를 확인해 주세요.");
  return `${entryPath(id)}/files/${file.split("/").map(encodeURIComponent).join("/")}`;
};
export class RemoteHubStore implements HubRecordStore {
  readonly kind = "remote" as const;
  constructor(readonly client: HubClient, private identity?: string, private queues = new Map<string, Promise<unknown>>()) {}
  forIdentity(identity: string): RemoteHubStore { return new RemoteHubStore(this.client, identity, this.queues); }
  private request<T>(path: string, options: RequestOptions = {}): Promise<T> { return this.client.request<T>(path, { ...options, ...(this.identity ? { identity: this.identity } : {}) }); }
  async initialize(): Promise<void> { /* Network access is lazy. */ }
  serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(key) ?? Promise.resolve()).then(action);
    const settled = next.catch(() => undefined);
    this.queues.set(key, settled);
    void settled.then(() => { if (this.queues.get(key) === settled) this.queues.delete(key); });
    return next;
  }
  async folders(): Promise<HubFolder[]> { return (await this.request<{ folders: HubFolder[] }>("/folders")).folders; }
  addFolder(name: string, _actor: Actor): Promise<HubFolder> { return this.request("/folders", { method: "POST", body: { name } }); }
  read(id: string): Promise<StoredEntry> { return this.request(entryPath(id)); }
  async find(id: string): Promise<StoredEntry | null> {
    try { return await this.read(id); } catch (e) { if (e instanceof AuthoringError && e.status === 404) return null; throw e; }
  }
  async list(): Promise<StoredEntry[]> { return (await this.request<{ entries: StoredEntry[] }>("/entries")).entries; }
  async write(record: StoredEntry, _actor: Actor): Promise<void> { await this.request(entryPath(record.entry.id), { method: "PUT", body: record }); }
  async recordInstall(id: string, install: AuthoringInstall, _actor: Actor): Promise<void> { await this.request(`${entryPath(id)}/installs`, { method: "POST", body: { install } }); }
  bytes(id: string, file: string): Promise<Buffer> { return this.request(filePath(id, file), { file: true }); }
  async immutableBytes(id: string, file: string, bytes: Buffer, _actor: Actor): Promise<void> {
    await this.request(filePath(id, file), { method: "PUT", bytes, file: true, headers: { "X-Content-SHA256": createHash("sha256").update(bytes).digest("hex") } });
  }
  async comments(id: string): Promise<HubComment[]> { return (await this.request<{ comments: HubComment[] }>(`${entryPath(id)}/comments`)).comments; }
  addComment(id: string, _actor: Actor, body: string): Promise<HubComment> { return this.request(`${entryPath(id)}/comments`, { method: "POST", body: { body } }); }
  async stars(id: string): Promise<Record<string, true>> { return (await this.request<{ stars: Record<string, true> }>(`${entryPath(id)}/stars`)).stars; }
  star(id: string, _actor: Actor, on: boolean): Promise<{ stars: number; starredByMe: boolean }> { return this.request(`${entryPath(id)}/star`, { method: "POST", body: { on } }); }
}
