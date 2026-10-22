/**
 * Anonymous reader of public ORCID records (Public API v3.0, `https://pub.orcid.org/v3.0`). Read-only: no token, no
 * writes, no polling (gaid-orcid phase 1; ORCID Public API terms of service).
 *
 * Anonymous limits (ORCID FAQ "What are the API usage quotas and limits?"): 12 requests/s, burst 40, 25,000 reads a
 * day per IP. One client serializes its requests and keeps them at most 10 a second; a 503/429 is retried once after
 * `Retry-After` (bounded).
 */
import { setTimeout as delay } from "node:timers/promises";
import { boundedText } from "../library/metadata/http.ts";
import { ORCID_ID_PATTERN, ORCID_LIMITS } from "../../../../web/src/geo/contracts/orcid.ts";

export const ORCID_PUBLIC_API = "https://pub.orcid.org/v3.0";

/** `not-found`: no public record (404/410). `unavailable`: ORCID did not answer usably (network, 5xx, bad body). */
export class OrcidError extends Error {
  kind: "not-found" | "unavailable";
  status?: number;
  constructor(kind: OrcidError["kind"], message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface OrcidClientOptions {
  fetch?: typeof fetch;
  /** Public API base; `GAID_ORCID_API_URL` (e.g. `https://pub.sandbox.orcid.org/v3.0` for tests), else production. */
  baseUrl?: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Minimum spacing between requests (default 100 ms, under ORCID's 12/s). */
  spacingMs?: number;
}

export interface OrcidClient {
  person(id: string): Promise<unknown>;
  works(id: string): Promise<unknown>;
  /** Full work records for put-codes, read in bulk chunks of `ORCID_LIMITS.bulk`; returns the `work` objects found. */
  workDetails(id: string, putCodes: number[]): Promise<unknown[]>;
}

export function createOrcidClient(options: OrcidClientOptions = {}): OrcidClient {
  const fetcher = options.fetch ?? globalThis.fetch;
  const base = (options.baseUrl ?? process.env.GAID_ORCID_API_URL ?? ORCID_PUBLIC_API).replace(/\/+$/, "");
  const timeout = options.timeoutMs ?? 20_000;
  const sleep = options.sleep ?? ((ms: number) => delay(ms).then(() => undefined));
  const spacing = options.spacingMs ?? 100;
  let queue: Promise<unknown> = Promise.resolve();
  let last = 0;

  function get(id: string, path: string): Promise<unknown> {
    if (!ORCID_ID_PATTERN.test(id)) return Promise.reject(new OrcidError("not-found", "Invalid ORCID iD"));
    const url = `${base}/${id}/${path}`;
    const call = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = last + spacing - Date.now();
        if (wait > 0) await sleep(wait);
        last = Date.now();
        let response: Response;
        try {
          response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(timeout), headers: { Accept: "application/json", "User-Agent": "GAID-orcid/1" } });
        } catch (error) {
          throw new OrcidError("unavailable", `ORCID request failed: ${(error as Error).name}`);
        }
        if ((response.status === 503 || response.status === 429) && attempt === 0) {
          await response.body?.cancel();
          const after = Number(response.headers.get("retry-after"));
          await sleep(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1000, 10_000));
          continue;
        }
        if (response.status === 404 || response.status === 410) {
          await response.body?.cancel();
          throw new OrcidError("not-found", "No public ORCID record", response.status);
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new OrcidError("unavailable", `ORCID HTTP ${response.status}`, response.status);
        }
        try {
          return JSON.parse(await boundedText(response)) as unknown;
        } catch {
          throw new OrcidError("unavailable", "ORCID returned an unreadable body");
        }
      }
    });
    queue = call.catch(() => {});
    return call;
  }

  return {
    person: (id) => get(id, "person"),
    works: (id) => get(id, "works"),
    async workDetails(id, putCodes) {
      const out: unknown[] = [];
      const codes = [...new Set(putCodes.filter((c) => Number.isSafeInteger(c) && c > 0))];
      for (let i = 0; i < codes.length; i += ORCID_LIMITS.bulk) {
        const body = await get(id, `works/${codes.slice(i, i + ORCID_LIMITS.bulk).join(",")}`) as { bulk?: unknown };
        for (const entry of Array.isArray(body?.bulk) ? body.bulk : []) {
          const work = (entry as { work?: unknown })?.work;
          if (work && typeof work === "object") out.push(work);
        }
      }
      return out;
    },
  };
}
