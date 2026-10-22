/**
 * Which hub record store a request uses (ADR docs/adr/2026-10-22-gaid-hub-server.md decision 2). With a logged-in
 * institute hub server account the remote store and that account; otherwise the local file store and the display name
 * from `X-GAID-User`. The hub client (server/src/geo/hub-client/) registers the remote provider at startup, so this module
 * has no dependency on it.
 */
import type { FastifyRequest } from "fastify";
import { HUB_USER_HEADER } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { displayNameActor, type Actor, type HubRecordStore } from "./records.ts";
import { SharedHubStore } from "./store.ts";

export interface ResolvedHub {
  store: HubRecordStore;
  /** Null: nobody named (local store without a display name). */
  actor: Actor | null;
  /** True when the actor is an authenticated hub server account. */
  account: boolean;
}

/** Returns the remote store and account when this GAID is logged in to a hub server, else null. */
export type RemoteHubProvider = () => { store: HubRecordStore; actor: Actor } | null;

let remote: RemoteHubProvider | null = null;
let local: SharedHubStore | null = null;

export function setRemoteHubProvider(provider: RemoteHubProvider | null) {
  remote = provider;
}

export function localHubStore(): SharedHubStore {
  const store = new SharedHubStore();
  if (!local || local.root !== store.root) local = store;
  return local;
}

/** The display name sent by the browser (local store only). */
export function hubUser(req: FastifyRequest): string | null {
  const header = req.headers[HUB_USER_HEADER.toLowerCase()];
  if (typeof header !== "string") return null;
  try {
    const name = decodeURIComponent(header).trim();
    return name && [...name].length <= 40 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
  } catch {
    return null;
  }
}

/**
 * `fixed`: a store given explicitly (tests, the hub server itself) always wins and takes the header actor; otherwise the
 * remote provider when it answers, else the local store.
 */
export function resolveHub(req: FastifyRequest | null, fixed?: HubRecordStore): ResolvedHub {
  if (!fixed) {
    const connected = remote?.();
    if (connected) return { store: connected.store, actor: connected.actor, account: true };
  }
  const name = req ? hubUser(req) : null;
  return { store: fixed ?? localHubStore(), actor: name ? displayNameActor(name) : null, account: false };
}

/** The store alone, for callers without a request (skill preview, CLI export). */
export const activeHubStore = (fixed?: HubRecordStore): HubRecordStore => resolveHub(null, fixed).store;
