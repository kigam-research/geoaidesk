import { readSkillHubSites, type SkillHubSite } from "../skill-hub.ts";
import { HandoffError } from "./builder.ts";

export function directHandoffEndpoint(site: SkillHubSite): URL | null {
  const base = new URL(site.url);
  if (!["http:", "https:"].includes(base.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || !site.authoring || base.username || base.password) return null;
  const prefix = site.authoring.replace(/\/+$/, "");
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(prefix)) return null;
  return new URL(`${prefix}/handoffs`, base);
}

/** Explicit user action only. Never follow redirects or return an off-site draft URL. */
export async function sendHandoff(archive: Buffer, siteId: unknown, options: { sites?: SkillHubSite[]; fetcher?: typeof fetch } = {}) {
  const site = (options.sites ?? readSkillHubSites()).find(s => s.id === siteId);
  const endpoint = site ? directHandoffEndpoint(site) : null;
  if (!site || !endpoint) throw new HandoffError("input", "Direct handoff requires a configured loopback authoring site");
  const response = await (options.fetcher ?? fetch)(endpoint.href, { method: "POST", headers: { "Content-Type": "application/gzip", accept: "application/json" }, body: new Uint8Array(archive), redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (response.status !== 201 || !response.body) throw new Error("Hub did not confirm the draft");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 16 * 1024) throw new Error("Hub reply exceeds the read limit");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { projectId?: unknown; url?: unknown };
  if (typeof body.projectId !== "string" || !body.projectId || body.projectId.length > 200 || typeof body.url !== "string" || body.url.length > 2048) throw new Error("Hub reply is missing the draft URL");
  const url = new URL(body.url, site.url), base = new URL(site.url);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.username || url.password) throw new Error("Hub returned an off-site draft URL");
  return { path: "direct" as const, projectId: body.projectId, url: url.href };
}
