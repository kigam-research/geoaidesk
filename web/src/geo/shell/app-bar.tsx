"use client";
/**
 * GAID app bar (UI guide v2 L2, I1, S5): the mark once at the leading end, the 내 연구 / GAID 허브 switch, the page's own
 * controls, settings last. No theme switch (the theme follows the system; Settings → 화면 표시 overrides it) and no
 * visible version (shown in the mark's tooltip).
 */
import { SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { geoText } from "@/geo/i18n";
import { GaidTopNav, type GaidPlace } from "@/geo/hub/top-nav";
import { APP_VERSION, isVersioned } from "@/lib/version";

const appText = geoText("app");

export function GaidAppBar({
  place,
  onNavigate,
  onHome,
  leading,
  trailing,
  onOpenSettings,
}: {
  place: GaidPlace;
  onNavigate?: (place: GaidPlace) => void;
  /** The mark opens the project list. */
  onHome?: () => void;
  /** Controls after the place switch (for example the project switcher). */
  leading?: ReactNode;
  /** Controls before the settings button. */
  trailing?: ReactNode;
  onOpenSettings: () => void;
}) {
  const label = appText("header.back_to_projects");
  // The version and the upstream attribution line stay reachable on the mark (UI guide v2 I1; gaid-brand-copy).
  const name = isVersioned ? appText("header.version", { version: APP_VERSION }) : appText("header.productName");
  const title = `${name}\n${appText("header.attribution")}`;
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-gaid-frame bg-gaid-chrome pl-5 pr-3">
      <button
        type="button"
        onClick={onHome}
        aria-label={label}
        title={title}
        className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* GAID compact lockup (geo/brand, unchanged); the button's aria-label names it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gaid-compact-color.svg" alt="" width={73} height={24} className="h-6 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gaid-compact-on-dark.svg" alt="" width={73} height={24} className="hidden h-6 w-auto dark:block" />
      </button>
      {onNavigate && (
        <>
          <span className="h-5 w-px bg-gaid-edge" aria-hidden />
          <GaidTopNav current={place} onNavigate={onNavigate} />
        </>
      )}
      {leading}
      <span className="flex-1" />
      {trailing}
      <Button variant="ghost" size="icon-sm" aria-label={appText("header.open_settings")} title={appText("header.settings")} onClick={onOpenSettings}>
        <SettingsIcon />
      </Button>
    </header>
  );
}
