"use client";
/**
 * Place mockups page (/dev/places, gaid-ia-connect-workspace): one mockup screen at a time, chosen by `?screen=`
 * (workspace | connect | library | project | authoring); `?style=instrument|mapsheet` and `?theme=light|dark` pin the
 * identity and theme for screenshots. Development only (web/src/app/dev/places/page.dev.tsx).
 */
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { setGaidStyle } from "@/geo/appearance/style";

import { AuthoringLibraryPanel, ConnectHome, LibraryFull, ProjectLibraryPanel, WorkspaceHome } from "./screens";

const SCREENS = {
  workspace: WorkspaceHome,
  connect: ConnectHome,
  library: LibraryFull,
  project: ProjectLibraryPanel,
  authoring: AuthoringLibraryPanel,
} as const;

type ScreenId = keyof typeof SCREENS;

export function DevPlacesPage() {
  const { setTheme } = useTheme();
  const [screen, setScreen] = useState<ScreenId | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const style = params.get("style");
    if (style === "instrument" || style === "mapsheet") setGaidStyle(style);
    const theme = params.get("theme");
    if (theme === "light" || theme === "dark") setTheme(theme);
    const id = params.get("screen");
    setScreen(id && id in SCREENS ? (id as ScreenId) : "workspace");
  }, [setTheme]);
  if (!screen) return null;
  const Screen = SCREENS[screen];
  return <Screen />;
}
