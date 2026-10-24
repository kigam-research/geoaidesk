"use client";
/**
 * Place switch of the app bar (UI guide v2 N1; ADR 2026-10-24 gaid-connect-workspace): GAID Workspace and GAID Connect,
 * the two places of one app. The researcher's 서재 is not a place: it has its own app-bar entry (`LibraryEntry`).
 */
import { BookOpenIcon, PanelsTopLeftIcon, WaypointsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { geoText } from "@/geo/i18n";
import type { GaidPlace } from "@/geo/places/navigation";
import { cn } from "@/lib/utils";

export type { GaidPlace } from "@/geo/places/navigation";

const text = geoText("places");

export function GaidTopNav({
  current,
  onNavigate,
  className,
}: {
  /** The place shown; null while the full 서재 screen is open. */
  current: GaidPlace | null;
  onNavigate: (place: GaidPlace) => void;
  className?: string;
}) {
  const items: { id: GaidPlace; icon: typeof PanelsTopLeftIcon }[] = [
    { id: "workspace", icon: PanelsTopLeftIcon },
    { id: "connect", icon: WaypointsIcon },
  ];
  return (
    <nav aria-label={text("bar.label")} className={cn("gaid-seg flex items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5", className)}>
      {items.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={text(`bar.${id}Tip`)}
          aria-current={current === id ? "page" : undefined}
          onClick={() => current !== id && onNavigate(id)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            current === id
              ? "bg-gaid-face font-semibold text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)]"
              : "text-gaid-ink-2 hover:text-gaid-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {text(`bar.${id}`)}
        </button>
      ))}
    </nav>
  );
}

/** The app-bar entry to the researcher's 서재 (personal, opened over either place). */
export function LibraryEntry({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      title={text("bar.libraryTip")}
      aria-pressed={open}
      onClick={onOpen}
      className={cn(open && "border-transparent bg-gaid-signal-tint text-gaid-signal-ink hover:bg-gaid-signal-tint")}
    >
      <BookOpenIcon data-icon="inline-start" />
      {text("bar.library")}
    </Button>
  );
}
