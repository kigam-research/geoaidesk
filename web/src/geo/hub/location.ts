"use client";
/** The GAID hub is a place of the main app page, kept in the URL hash (`#hub`, `#hub/<authoringId>`). */
import { useCallback, useEffect, useState } from "react";

export interface HubLocation {
  open: boolean;
  projectId: string | null;
}

export function parseHubHash(hash: string): HubLocation {
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
    const hash = next.open ? (next.projectId ? `#hub/${next.projectId}` : "#hub") : "";
    if (window.location.hash !== hash)
      window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    setLocation(next);
  }, []);
  return [location, navigate];
}
