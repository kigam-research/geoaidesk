import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KADY_PI_AGENT_DIR } from "../../config.ts";
import type { HubAccount } from "../../../../web/src/geo/contracts/hub-server.ts";
import { AuthoringError } from "../authoring/store.ts";

export interface HubConnection {
  url: string | null;
  token?: string;
  account?: HubAccount;
  serverId?: string;
  savedAt: string;
}

export function hubUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new AuthoringError("허브 서버 주소를 입력해 주세요.");
  if (!/^https?:\/\/[^/?#@\s]+\/?$/.test(value.trim())) throw new AuthoringError("허브 서버 주소는 경로와 사용자 정보 없이 입력해 주세요.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new AuthoringError("허브 서버 주소 형식을 확인해 주세요."); }
  if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash || /[?#]/.test(value))
    throw new AuthoringError("허브 서버 주소는 경로 없이 http://호스트:포트 또는 https://호스트:포트로 입력해 주세요.");
  return url.origin;
}

/** Only this backend reads the persisted bearer token. No browser contract includes HubConnection. */
export class ConnectionStore {
  readonly root: string;
  private value: HubConnection = { url: null, savedAt: "" };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(agentDir = KADY_PI_AGENT_DIR, private envUrl = () => process.env.GAID_HUB_SERVER_URL) {
    this.root = join(agentDir, "hub-server");
  }
  get fromEnv(): boolean { return Boolean(this.envUrl()?.trim()); }
  get current(): Readonly<HubConnection> {
    const url = this.fromEnv ? hubUrl(this.envUrl()) : this.value.url;
    return url === this.value.url ? this.value : { url, savedAt: this.value.savedAt };
  }
  async load(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
    try {
      const raw = JSON.parse(await readFile(join(this.root, "connection.json"), "utf8")) as HubConnection;
      if (!raw || typeof raw !== "object") throw new Error("Invalid connection");
      raw.url = hubUrl(raw.url);
      this.value = raw;
      await chmod(join(this.root, "connection.json"), 0o600);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new AuthoringError("허브 연결 설정을 읽지 못했습니다.", 409);
    }
    // A deployment override must not reuse a token issued by the old address.
    if (this.fromEnv && this.current.url !== this.value.url) await this.save({ url: this.current.url });
  }
  async save(value: Omit<HubConnection, "savedAt">): Promise<void> {
    const next: HubConnection = { ...value, savedAt: new Date().toISOString() };
    const previous = this.value;
    // Invalidate in-flight requests immediately, including while the atomic disk write is queued.
    this.value = next;
    const write = this.queue.then(async () => {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      const file = join(this.root, "connection.json");
      const tmp = `${file}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
      await rename(tmp, file);
    });
    this.queue = write.catch(() => undefined);
    try { await write; } catch (e) { if (this.value === next) this.value = previous; throw e; }
  }
  async configure(url: unknown): Promise<void> {
    if (this.fromEnv) throw new AuthoringError("환경 설정에서 지정한 허브 서버 주소는 여기서 바꿀 수 없습니다.", 409);
    await this.save({ url: hubUrl(url) });
  }
  async clearSession(): Promise<void> {
    const { url, serverId } = this.current;
    await this.save({ url, ...(serverId ? { serverId } : {}) });
  }
}
