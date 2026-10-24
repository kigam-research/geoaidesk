"use client";
/**
 * The full 서재 screen is kept in the URL hash (`#library`, or `#library/<itemId>` to open on one item), over whichever
 * place the researcher was in; closing it returns to that place's hash (ADR 2026-10-24 gaid-connect-workspace).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { OPEN_LIBRARY_EVENT, type GaidPlace, type OpenLibraryDetail } from "./navigation";

export interface LibraryLocation {
  open: boolean;
  itemId: string | null;
}

export function parseLibraryHash(hash: string): LibraryLocation {
  const m = /^#library(?:\/([^/#?]{1,200}))?$/.exec(hash);
  if (!m) return { open: false, itemId: null };
  try {
    return { open: true, itemId: m[1] ? decodeURIComponent(m[1]) : null };
  } catch {
    return { open: true, itemId: null };
  }
}

/** Where the 서재 screen returns to, and the place it names on its back action. */
export interface LibraryReturn {
  hash: string;
  place: GaidPlace;
}

const placeOf = (hash: string): GaidPlace => (/^#(?:connect|hub)(?=$|\/)/.test(hash) ? "connect" : "workspace");

/**
 * The 서재 location plus `close()`, which goes back to the hash it was opened from (or the Workspace when it was opened
 * by a direct link). Also answers `openLibrary()` requests from anywhere in the app.
 */
export function useLibraryLocation(): [LibraryLocation, LibraryReturn, () => void] {
  const [location, setLocation] = useState<LibraryLocation>({ open: false, itemId: null });
  const back = useRef<string>("");
  const [returnTo, setReturnTo] = useState<LibraryReturn>({ hash: "", place: "workspace" });

  useEffect(() => {
    const read = () => setLocation(parseLibraryHash(window.location.hash));
    read();
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenLibraryDetail>).detail ?? {};
      const current = window.location.hash;
      if (!current.startsWith("#library")) {
        back.current = current;
        setReturnTo({ hash: current, place: placeOf(current) });
      }
      const hash = detail.itemId ? `#library/${encodeURIComponent(detail.itemId)}` : "#library";
      if (current !== hash) window.history.pushState(null, "", hash);
      setLocation(parseLibraryHash(hash));
    };
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    window.addEventListener(OPEN_LIBRARY_EVENT, onOpen);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
      window.removeEventListener(OPEN_LIBRARY_EVENT, onOpen);
    };
  }, []);

  const close = useCallback(() => {
    const hash = back.current;
    window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    // Other hash readers (Connect) follow the new address.
    window.dispatchEvent(new PopStateEvent("popstate"));
    setLocation({ open: false, itemId: null });
  }, []);

  return [location, returnTo, close];
}
