"use client";
/**
 * 문헌 정리 mockups page (/dev/library-prep, gaid-library-prep phase 1): one mockup screen at a time, chosen by `?screen=`
 * (library | make | import | start | summary | authoring); `?style=instrument|mapsheet` and `?theme=light|dark` pin the
 * identity and theme for screenshots. Development only (web/src/app/dev/library-prep/page.dev.tsx).
 */
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { setGaidStyle } from "@/geo/appearance/style";

import { AuthoringDigest, DigestImport, DigestLibrary, DigestMake, StartIntroDigest, StartSummaryDigest } from "./screens";

const SCREENS = {
  library: DigestLibrary,
  make: DigestMake,
  import: DigestImport,
  start: StartIntroDigest,
  summary: StartSummaryDigest,
  authoring: AuthoringDigest,
} as const;

type ScreenId = keyof typeof SCREENS;

export function DevLibraryPrepPage() {
  const { setTheme } = useTheme();
  const [screen, setScreen] = useState<ScreenId | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const style = params.get("style");
    if (style === "instrument" || style === "mapsheet") setGaidStyle(style);
    const theme = params.get("theme");
    if (theme === "light" || theme === "dark") setTheme(theme);
    const id = params.get("screen");
    setScreen(id && id in SCREENS ? (id as ScreenId) : "library");
  }, [setTheme]);
  if (!screen) return null;
  const Screen = SCREENS[screen];
  return <Screen />;
}
