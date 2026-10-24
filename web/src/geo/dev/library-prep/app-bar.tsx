"use client";
/**
 * App bar of the place mockups (copied from gaid-ia-connect-workspace bd22855a for gaid-library-prep): the mark, the two places GAID Workspace and
 * GAID Connect as one segmented control (UI guide v2 N1), the page's own controls, then the researcher's personal 서재
 * entry and settings at the trailing end. 서재 is not a third place: it opens over either place and returns to it.
 */
import { BookOpenIcon, ChevronsUpDownIcon, CpuIcon, PanelsTopLeftIcon, SettingsIcon, WaypointsIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("devLibraryPrep");

export type Place = "workspace" | "connect";

export function PlacesAppBar({
  place,
  library = false,
  project,
  trailing,
}: {
  /** The place shown; null while the full 서재 screen is open. */
  place: Place | null;
  library?: boolean;
  project?: string;
  trailing?: ReactNode;
}) {
  const items: { id: Place; icon: typeof BookOpenIcon }[] = [
    { id: "workspace", icon: PanelsTopLeftIcon },
    { id: "connect", icon: WaypointsIcon },
  ];
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-gaid-frame bg-gaid-chrome pl-5 pr-3">
      <button type="button" aria-label={text("bar.home")} className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gaid-compact-color.svg" alt="" width={73} height={24} className="h-6 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gaid-compact-on-dark.svg" alt="" width={73} height={24} className="hidden h-6 w-auto dark:block" />
      </button>
      <span className="h-5 w-px bg-gaid-edge" aria-hidden />
      <nav aria-label={text("bar.label")} className="gaid-seg flex items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5">
        {items.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={text(`bar.${id}Tip`)}
            aria-current={place === id ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              place === id ? "bg-gaid-face font-semibold text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)]" : "text-gaid-ink-2 hover:text-gaid-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {text(`bar.${id}`)}
          </button>
        ))}
      </nav>
      {project && (
        <button
          type="button"
          aria-label={text("bar.project")}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-gaid-ink hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring"
        >
          {project}
          <ChevronsUpDownIcon className="size-3.5 text-gaid-ink-2" aria-hidden />
        </button>
      )}
      <span className="flex-1" />
      {trailing}
      <Button
        variant="outline"
        size="sm"
        title={text("bar.libraryTip")}
        aria-pressed={library}
        className={cn(library && "border-transparent bg-gaid-signal-tint text-gaid-signal-ink hover:bg-gaid-signal-tint")}
      >
        <BookOpenIcon data-icon="inline-start" />
        {text("bar.library")}
      </Button>
      <span className="h-5 w-px bg-gaid-edge" aria-hidden />
      <Button variant="ghost" size="icon-sm" aria-label={text("bar.resources")} title={text("bar.resources")}>
        <CpuIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={text("bar.settings")} title={text("bar.settings")}>
        <SettingsIcon />
      </Button>
    </header>
  );
}
