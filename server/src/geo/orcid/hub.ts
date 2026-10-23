/**
 * The researcher's GAID side of the authenticated ORCID link (gaid-orcid phase 2): calls the logged-in hub server's
 * `/hub/v1/orcid*` routes. The hub server routes register the provider (`server/src/geo/routes/hub-server.ts`), so this
 * module never builds its own hub connection.
 */
import type { HubOrcidLink } from "../../../../web/src/geo/contracts/hub-server.ts";
import type { OrcidFinishRequest, OrcidHubStatus, OrcidStartResponse } from "../hub-server/protocol.ts";
import type { HubClient } from "../hub-client/client.ts";

export interface OrcidHubPort {
  status(): Promise<OrcidHubStatus>;
  start(): Promise<OrcidStartResponse>;
  finish(body: OrcidFinishRequest): Promise<{ link: HubOrcidLink }>;
  unlink(): Promise<void>;
}

let provider: (() => OrcidHubPort | null) | null = null;
export function setOrcidHubProvider(next: (() => OrcidHubPort | null) | null) { provider = next; }
/** Null without a hub server login. */
export const orcidHub = (): OrcidHubPort | null => provider?.() ?? null;

/** Port over a logged-in HubClient; null when there is no session. Status calls use a short timeout (library screen). */
export function hubClientOrcid(client: HubClient): OrcidHubPort | null {
  const identity = client.identity;
  if (!identity) return null;
  return {
    status: () => client.request<OrcidHubStatus>("/orcid", { identity, timeoutMs: 5_000 }),
    start: () => client.request<OrcidStartResponse>("/orcid/start", { method: "POST", body: {}, identity }),
    finish: (body) => client.request<{ link: HubOrcidLink }>("/orcid/finish", { method: "POST", body, identity, timeoutMs: 40_000 }),
    unlink: () => client.request<void>("/orcid", { method: "DELETE", identity }),
  };
}
