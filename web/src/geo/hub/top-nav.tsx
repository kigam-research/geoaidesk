"use client";
/** Header switch between the project list and the GAID hub: one app, two places. */
import { ArrowRightIcon, FolderIcon, SparklesIcon } from "lucide-react";

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
    { id: "hub", label: text("nav.hub"), icon: SparklesIcon },
  ];
  return (
    <nav aria-label={text("nav.label")} className={cn("flex items-center gap-1 rounded-lg bg-muted p-1", className)}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? "page" : undefined}
          onClick={() => current !== id && onNavigate(id)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            current === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
    <section className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <SparklesIcon className="size-5" aria-hidden />
      </span>
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
