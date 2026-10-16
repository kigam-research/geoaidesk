/** Shared, single-server hub records. Package and visual bytes are copied before publishing entry.json. */
import { randomUUID } from "node:crypto";
import { appendFile, link, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { KADY_PI_AGENT_DIR } from "../../config.ts";
import type {
  AuthoringInstall,
  MethodDraft,
  MethodPackageRecord,
} from "../../../../web/src/geo/contracts/authoring.ts";
import type { HubComment, HubEntry, HubFolder } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { AuthoringError, newId, now } from "../authoring/store.ts";

export const sharedDir = () =>
  resolve(process.env.GAID_HUB_SHARED_DIR || join(KADY_PI_AGENT_DIR, "skill-hub", "shared"));
const ID = /^[a-z0-9][a-z0-9-]{5,79}$/;
export const DEFAULT_FOLDER = "general";

export interface StoredVisual {
  file: string;
  caption: string;
  mediaType: string;
}
export interface RegisteredSnapshot {
  draft: MethodDraft;
  package: MethodPackageRecord;
  visuals: Record<string, StoredVisual>;
}
export interface StoredEntry {
  schemaVersion: "gaid-hub-entry/v1";
  authoringProjectId: string;
  entry: Omit<HubEntry, "stars" | "starredByMe" | "comments" | "trials">;
  snapshots: Record<string, RegisteredSnapshot>;
  installs: AuthoringInstall[];
}

const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";

export class SharedHubStore {
  readonly root: string;
  private queues = new Map<string, Promise<unknown>>();
  constructor(root = sharedDir()) {
    this.root = resolve(root);
  }
  /** One process owns this directory, like AuthoringStore; a failed mutation never poisons the queue. */
  serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(action);
    const settled = next.catch(() => {});
    this.queues.set(key, settled);
    void settled.then(() => {
      if (this.queues.get(key) === settled) this.queues.delete(key);
    });
    return next;
  }
  async initialize() {
    await mkdir(join(this.root, "entries"), { recursive: true });
    await this.serial("folders", async () => {
      try {
        await this.folders();
      } catch (e) {
        if (!missing(e)) throw e;
        await this.atomic(join(this.root, "folders.json"), [
          { id: DEFAULT_FOLDER, name: "일반", createdBy: "GAID", createdAt: now() },
        ]);
      }
    });
  }
  async folders(): Promise<HubFolder[]> {
    return this.json<HubFolder[]>(join(this.root, "folders.json"));
  }
  async addFolder(name: string, user: string): Promise<HubFolder> {
    return this.serial("folders", async () => {
      const folders = await this.folders();
      if (folders.some((f) => f.name === name)) throw new AuthoringError("같은 이름의 폴더가 있습니다.", 409);
      const folder = { id: newId("folder"), name, createdBy: user, createdAt: now() };
      folders.push(folder);
      await this.atomic(join(this.root, "folders.json"), folders);
      return folder;
    });
  }
  entryDir(id: string): string {
    if (!ID.test(id)) throw new AuthoringError("등록 방법 식별자가 올바르지 않습니다.", 404);
    return join(this.root, "entries", id);
  }
  within(id: string, file: string): string {
    const base = this.entryDir(id);
    const target = resolve(base, file);
    if (!target.startsWith(base + sep)) throw new AuthoringError("등록 폴더 밖의 경로입니다.");
    return target;
  }
  async read(id: string): Promise<StoredEntry> {
    try {
      const record = await this.json<StoredEntry>(join(this.entryDir(id), "entry.json"));
      if (record.schemaVersion !== "gaid-hub-entry/v1")
        throw new AuthoringError("등록 기록 형식을 확인해 주세요.", 409);
      return record;
    } catch (e) {
      if (missing(e)) throw new AuthoringError("등록한 방법을 찾을 수 없습니다.", 404);
      throw e;
    }
  }
  async find(id: string): Promise<StoredEntry | null> {
    try {
      return await this.read(id);
    } catch (e) {
      if (e instanceof AuthoringError && e.status === 404) return null;
      throw e;
    }
  }
  async list(): Promise<StoredEntry[]> {
    const out: StoredEntry[] = [];
    for (const d of await readdir(join(this.root, "entries"), { withFileTypes: true })) {
      if (!d.isDirectory() || !ID.test(d.name)) continue;
      const record = await this.find(d.name);
      if (record) out.push(record);
    }
    return out.sort(
      (a, b) => b.entry.updatedAt.localeCompare(a.entry.updatedAt) || a.entry.id.localeCompare(b.entry.id),
    );
  }
  async write(record: StoredEntry) {
    await this.atomic(join(this.entryDir(record.entry.id), "entry.json"), record);
  }
  async bytes(id: string, file: string): Promise<Buffer> {
    try {
      return await readFile(this.within(id, file));
    } catch (e) {
      if (missing(e)) throw new AuthoringError("등록 파일을 찾을 수 없습니다.", 404);
      throw e;
    }
  }
  async immutableBytes(id: string, file: string, bytes: Buffer) {
    const target = this.within(id, file);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, bytes);
    // Publish atomically without overwriting a revision. An identical retry after a crash is safe.
    try {
      await link(tmp, target);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (!(await readFile(target)).equals(bytes))
        throw new AuthoringError("등록 파일이 이미 다른 내용으로 저장되어 있습니다.", 409);
    } finally {
      await unlink(tmp);
    }
  }
  async comments(id: string): Promise<HubComment[]> {
    try {
      const raw = await readFile(this.within(id, "comments.jsonl"), "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as HubComment);
    } catch (e) {
      if (missing(e)) return [];
      if (e instanceof SyntaxError)
        throw new AuthoringError("댓글 기록을 읽지 못했습니다. 서버 기록을 확인해 주세요.", 409);
      throw e;
    }
  }
  async addComment(id: string, user: string, body: string): Promise<HubComment> {
    return this.serial(id, async () => {
      const record = await this.read(id);
      await this.comments(id); // Never append to a malformed/truncated log.
      const comment = {
        id: newId("comment"),
        entryId: id,
        author: user,
        body,
        revision: record.entry.latestRevision,
        at: now(),
      };
      await appendFile(this.within(id, "comments.jsonl"), JSON.stringify(comment) + "\n");
      return comment;
    });
  }
  async stars(id: string): Promise<Record<string, true>> {
    try {
      return await this.json<Record<string, true>>(this.within(id, "stars.json"));
    } catch (e) {
      if (missing(e)) return {};
      throw e;
    }
  }
  async star(id: string, user: string, on: boolean) {
    return this.serial(id, async () => {
      await this.read(id);
      const stars = Object.assign(Object.create(null) as Record<string, true>, await this.stars(id));
      if (on) stars[user] = true;
      else delete stars[user];
      await this.atomic(this.within(id, "stars.json"), stars);
      return { stars: Object.keys(stars).length, starredByMe: Object.hasOwn(stars, user) };
    });
  }
  private async json<T>(file: string): Promise<T> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch (e) {
      if (e instanceof SyntaxError)
        throw new AuthoringError("허브 기록을 읽지 못했습니다. 서버 기록을 확인해 주세요.", 409);
      throw e;
    }
  }
  private async atomic(file: string, data: unknown) {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
    await rename(tmp, file);
  }
}
