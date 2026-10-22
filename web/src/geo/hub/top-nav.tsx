"use client";
/** Header switch between the project list and the GAID hub: one app, two places. */
import { ArrowRightIcon, FolderIcon, WorkflowIcon } from "lucide-react";

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
    { id: "hub", label: text("nav.hub"), icon: WorkflowIcon },
  ];
  return (
    <nav aria-label={text("nav.label")} className={cn("gaid-seg flex items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5", className)}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
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
          {label}
        </button>
      ))}
    </nav>
  );
}

/** Entry row on the project list: one line on what the hub does and a button into it (no card, no AI symbol). */
export function GaidHubEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gaid-edge bg-gaid-face px-4 py-3 sm:flex-row sm:items-center">
      <WorkflowIcon className="size-5 shrink-0 text-gaid-signal-ink" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="text-sm font-semibold">{text("entry.title")}</h2>
        <p className="text-sm text-gaid-ink-2">{text("entry.body")}</p>
      </div>
      <Button variant="outline" onClick={onOpen} className="shrink-0">
        {text("entry.open")}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </section>
  );
}
