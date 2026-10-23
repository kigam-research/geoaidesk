"use client";
/**
 * The GAID hub is a place of the main app page, kept in the URL hash: `#hub` (home), `#hub/<authoringId>` (my method
 * being built), `#hub/e/<entryId>` (a method registered in the shared hub), `#hub/c/<catalogueId>` (a built-in Workflow).
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

export function parseHubHash(hash: string): HubLocation {
  if (hash === "#hub/removed") return { open: true, projectId: null, removed: true };
  if (hash === "#hub/skills") return { open: true, projectId: null, skills: true };
  if (hash === "#hub/feeds") return { open: true, projectId: null, feeds: true };
  const skill = /^#hub\/s\/([a-z0-9][a-z0-9._-]{0,119})$/.exec(hash);
  if (skill) return { open: true, projectId: null, skillId: skill[1] };
  const e = /^#hub\/e\/([A-Za-z0-9][A-Za-z0-9._-]{2,119})$/.exec(hash);
  if (e) return { open: true, projectId: null, entryId: e[1] };
  const c = /^#hub\/c\/([^/#?]{1,200})$/.exec(hash);
  if (c) {
    try {
      return { open: true, projectId: null, catalogueId: decodeURIComponent(c[1]) };
    } catch {
      return { open: true, projectId: null };
    }
  }
  const m = /^#hub(?:\/([a-z0-9][a-z0-9-]{5,63}))?$/.exec(hash);
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
        ? "#hub/removed"
        : next.skillId
        ? `#hub/s/${encodeURIComponent(next.skillId)}`
        : next.skills
          ? "#hub/skills"
          : next.feeds
          ? "#hub/feeds"
          : next.entryId
        ? `#hub/e/${next.entryId}`
        : next.catalogueId
          ? `#hub/c/${encodeURIComponent(next.catalogueId)}`
          : next.projectId
          ? `#hub/${next.projectId}`
          : "#hub"
      : "";
    if (window.location.hash !== hash)
      window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    setLocation(next);
  }, []);
  return [location, navigate];
}
