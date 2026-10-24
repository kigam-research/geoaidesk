"use client";
/**
 * GAID Connect (formerly the GAID hub) is a place of the main app page, kept in the URL hash: `#connect` (home),
 * `#connect/<authoringId>` (my Workflow being made), `#connect/e/<entryId>` (a shared Workflow), `#connect/c/<catalogueId>`
 * (a built-in Workflow), `#connect/s/<skillId>`, `#connect/skills`, `#connect/feeds`, `#connect/removed`. Older `#hub…`
 * links keep opening the same views (ADR 2026-10-24 gaid-connect-workspace); new links are written as `#connect…`.
 */
import { useCallback, useEffect, useState } from "react";

export interface HubLocation {
  /** 자료 소식 (gaid-hub-feeds). */
  feeds?: boolean;
  removed?: boolean;
  skills?: boolean;
  skillId?: string | null;
  open: boolean;
  projectId: string | null;
  /** A registered hub entry to show. */
  entryId?: string | null;
  /** A built-in (catalogue) Workflow to show. */
  catalogueId?: string | null;
}

/** Hash prefix of GAID Connect; `#hub` is the older alias. */
export const CONNECT_HASH = "#connect";

export function parseHubHash(raw: string): HubLocation {
  // `#hub…` (older links) reads as `#connect…`.
  const hash = /^#hub(?=$|\/)/.test(raw) ? CONNECT_HASH + raw.slice(4) : raw;
  if (hash === "#connect/removed") return { open: true, projectId: null, removed: true };
  if (hash === "#connect/skills") return { open: true, projectId: null, skills: true };
  if (hash === "#connect/feeds") return { open: true, projectId: null, feeds: true };
  const skill = /^#connect\/s\/([a-z0-9][a-z0-9._-]{0,119})$/.exec(hash);
  if (skill) return { open: true, projectId: null, skillId: skill[1] };
  const e = /^#connect\/e\/([A-Za-z0-9][A-Za-z0-9._-]{2,119})$/.exec(hash);
  if (e) return { open: true, projectId: null, entryId: e[1] };
  const c = /^#connect\/c\/([^/#?]{1,200})$/.exec(hash);
  if (c) {
    try {
      return { open: true, projectId: null, catalogueId: decodeURIComponent(c[1]) };
    } catch {
      return { open: true, projectId: null };
    }
  }
  const m = /^#connect(?:\/([a-z0-9][a-z0-9-]{5,63}))?$/.exec(hash);
  return m ? { open: true, projectId: m[1] ?? null } : { open: false, projectId: null };
}

export function useHubLocation(): [HubLocation, (next: HubLocation) => void] {
  const [location, setLocation] = useState<HubLocation>({ open: false, projectId: null });
  useEffect(() => {
    const read = () => setLocation(parseHubHash(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
    };
  }, []);
  const navigate = useCallback((next: HubLocation) => {
    const hash = next.open
      ? next.removed
        ? "#connect/removed"
        : next.skillId
        ? `#connect/s/${encodeURIComponent(next.skillId)}`
        : next.skills
          ? "#connect/skills"
          : next.feeds
          ? "#connect/feeds"
          : next.entryId
        ? `#connect/e/${next.entryId}`
        : next.catalogueId
          ? `#connect/c/${encodeURIComponent(next.catalogueId)}`
          : next.projectId
          ? `#connect/${next.projectId}`
          : "#connect"
      : "";
    if (window.location.hash !== hash)
      window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    setLocation(next);
  }, []);
  return [location, navigate];
}
