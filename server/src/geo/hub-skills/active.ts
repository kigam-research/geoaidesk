/**
 * Which skill shelf a request uses, mirroring `hub-shared/active.ts`: with a logged-in institute hub server account the
 * remote shelf (`hub-client/remote-skills.ts`) and that account; otherwise the local file shelf and the display name from
 * `X-GAID-User`. The hub client registers the remote provider at startup, so this module has no dependency on it.
 */
import type { FastifyRequest } from "fastify";
import { hubUser, localHubStore } from "../hub-shared/active.ts";
import { displayNameActor, type Actor } from "../hub-shared/records.ts";
import type { HubSkillRecordStore, StoredHubSkill } from "./records.ts";
import { HubSkillStore } from "./store.ts";

export interface ResolvedHubSkills {
  store: HubSkillRecordStore;
  /** Null: nobody named (local shelf without a display name). */
  actor: Actor | null;
  /** True when the actor is an authenticated hub server account. */
  account: boolean;
}

export type RemoteHubSkillProvider = () => { store: HubSkillRecordStore; actor: Actor } | null;

let remote: RemoteHubSkillProvider | null = null;
let local: HubSkillStore | null = null;

export function setRemoteHubSkillProvider(provider: RemoteHubSkillProvider | null) {
  remote = provider;
}

export function localHubSkillStore(): HubSkillStore {
  const shared = localHubStore();
  if (!local || local.root !== shared.root) local = new HubSkillStore(shared.root, shared);
  return local;
}

/** `fixed`: a store given explicitly (tests) always wins and takes the header actor. */
export function resolveHubSkills(req: FastifyRequest | null, fixed?: HubSkillRecordStore): ResolvedHubSkills {
  if (!fixed) {
    const connected = remote?.();
    if (connected) return { store: connected.store, actor: connected.actor, account: true };
  }
  const name = req ? hubUser(req) : null;
  return { store: fixed ?? localHubSkillStore(), actor: name ? displayNameActor(name) : null, account: false };
}

/** The shelf alone, for callers without a request (Workflow pins, CLI export, authoring suggestions). */
export const activeHubSkillStore = (fixed?: HubSkillRecordStore): HubSkillRecordStore => resolveHubSkills(null, fixed).store;

/**
 * Last records seen from a hub server, for the synchronous Settings → Skills annotation (`installed.ts`). Filled by the
 * remote shelf on every read/list; cleared when the connection changes. Null when no hub server shelf is active.
 */
const seen = new Map<string, StoredHubSkill>();
export function rememberRemoteSkills(records: StoredHubSkill[]) {
  for (const r of records) seen.set(r.id, r);
}
export function forgetRemoteSkills() {
  seen.clear();
}
export function remoteSkillRecord(id: string): StoredHubSkill | null | undefined {
  if (!remote?.()) return undefined;
  return seen.get(id) ?? null;
}
