"use client";
/**
 * The GAID hub is a place of the main app page, kept in the URL hash: `#hub` (home), `#hub/<authoringId>` (my method
 * being built), `#hub/e/<entryId>` (a method registered in the shared hub).
 */
import { useCallback, useEffect, useState } from "react";

export interface HubLocation {
  open: boolean;
  projectId: string | null;
  /** A registered hub entry to show. */
  entryId?: string | null;
}

export function parseHubHash(hash: string): HubLocation {
  const e = /^#hub\/e\/([A-Za-z0-9][A-Za-z0-9._-]{2,119})$/.exec(hash);
  if (e) return { open: true, projectId: null, entryId: e[1] };
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
      ? next.entryId
        ? `#hub/e/${next.entryId}`
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
