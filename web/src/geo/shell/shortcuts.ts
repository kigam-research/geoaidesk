"use client";
/**
 * Workspace keyboard shortcuts (UI guide v2 N2, N6, L2): ⌘K / Ctrl K search, ⌘\ / Ctrl \ sidebar. One place decides
 * the platform modifier, so menus, tooltips and the handlers agree.
 */
import { useEffect, useRef } from "react";

export type ShortcutId = "search" | "sidebar";

const KEYS: Record<ShortcutId, string> = { search: "k", sidebar: "\\" };

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform);
}

/** The shortcut as shown in tooltips and menus: `⌘K` on macOS, `Ctrl K` elsewhere. */
export function shortcutLabel(id: ShortcutId): string {
  const key = KEYS[id].toUpperCase();
  return isMacPlatform() ? `⌘${key}` : `Ctrl ${key}`;
}

/** True for the platform modifier + the shortcut's key, without Shift or Alt (those stay with the browser). */
export function matchesShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  if (event.shiftKey || event.altKey || event.isComposing) return false;
  const modifier = isMacPlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return modifier && event.key.toLowerCase() === KEYS[id];
}

/** Calls the handler for the shortcut while `enabled`; the handler returns false to leave the key to the browser. */
export function useShortcut(id: ShortcutId, handler: () => boolean | void, enabled = true): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !matchesShortcut(event, id)) return;
      if (latest.current() === false) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, enabled]);
}

/** Attribute marking the search field of the current place; ⌘K focuses the first visible one. */
export const SEARCH_TARGET = "data-gaid-search";

export function focusSearchTarget(root: ParentNode = document): boolean {
  const fields = Array.from(root.querySelectorAll<HTMLInputElement>(`[${SEARCH_TARGET}]`));
  const field = fields.find((item) => item.getClientRects().length > 0 && !item.disabled);
  if (!field) return false;
  field.focus();
  field.select();
  return true;
}
