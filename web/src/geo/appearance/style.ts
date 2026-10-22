// GAID screen style (UI guide v2, section 2): 계측 (instrument) is the default identity; a researcher may choose
// 도폭 (mapsheet) in Settings → 화면 표시. Independent of the light/dark theme (next-themes). Stored per browser and
// applied as <html data-style="mapsheet">; the default style sets no attribute.
"use client";
import { useSyncExternalStore } from "react";
import { GAID_STYLE_KEY } from "./style-init";

export type GaidStyle = "instrument" | "mapsheet";

const CHANGE_EVENT = "gaid:style-change";

export function readGaidStyle(): GaidStyle {
  if (typeof window === "undefined") return "instrument";
  try {
    return window.localStorage.getItem(GAID_STYLE_KEY) === "mapsheet" ? "mapsheet" : "instrument";
  } catch {
    return "instrument";
  }
}

function applyGaidStyle(style: GaidStyle) {
  const root = document.documentElement;
  if (style === "mapsheet") root.dataset.style = "mapsheet";
  else delete root.dataset.style;
}

export function setGaidStyle(style: GaidStyle) {
  try {
    if (style === "mapsheet") window.localStorage.setItem(GAID_STYLE_KEY, style);
    else window.localStorage.removeItem(GAID_STYLE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the style still applies to this page.
  }
  applyGaidStyle(style);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== GAID_STYLE_KEY) return;
    applyGaidStyle(readGaidStyle());
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useGaidStyle(): GaidStyle {
  return useSyncExternalStore(subscribe, readGaidStyle, () => "instrument");
}
