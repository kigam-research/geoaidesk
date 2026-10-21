"use client";
/** Header switch between the project list and the GAID hub: one app, two places. */
import { ArrowRightIcon, FolderIcon, LibraryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

export type GaidPlace = "projects" | "hub";

export function GaidTopNav({
  current,
  onNavigate,
  className,
}: {
  current: GaidPlace;
  onNavigate: (place: GaidPlace) => void;
  className?: string;
}) {
  const items: { id: GaidPlace; label: string; icon: typeof FolderIcon }[] = [
    { id: "projects", label: text("nav.projects"), icon: FolderIcon },
    { id: "hub", label: text("nav.hub"), icon: LibraryIcon },
  ];
  return (
    <nav aria-label={text("nav.label")} className={cn("flex h-14 items-stretch gap-2", className)}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? "page" : undefined}
          onClick={() => current !== id && onNavigate(id)}
          className={cn(
            "inline-flex items-center gap-2 border-b-[3px] px-4 text-sm font-medium transition-colors",
            current === id ? "border-gaid-link bg-background text-gaid-link" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  );
}

/** Entry card on the project list: one line on what the hub does and a button into it. */
export function GaidHubEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="flex flex-col gap-3 border-y border-gaid-line-strong py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="font-semibold">{text("entry.title")}</h2>
        <p className="text-sm text-muted-foreground">{text("entry.body")}</p>
      </div>
      <Button variant="outline" onClick={onOpen} className="shrink-0">
        {text("entry.open")}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </section>
  );
}
