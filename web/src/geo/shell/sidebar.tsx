"use client";
/**
 * Sidebar parts for the functional layer (UI guide v2 L3, N2, G6): groups with a short title, items with an icon, an
 * optional count and the identity's selection cue (계측: index mark; 도폭: ink frame; both with tint and weight).
 */
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SidebarGroup({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {(title || action) && (
        <div className="flex h-7 items-center justify-between pl-2.5 pr-1">
          {title && <span className="text-xs font-semibold text-gaid-ink-2">{title}</span>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function SidebarItem({
  icon: Icon,
  label,
  count,
  selected,
  onClick,
  title,
  children,
  preview,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  count?: number | string;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  children?: ReactNode;
  /** Pins hover/focus for the development parts page (data-preview, globals.css). */
  preview?: "hover" | "focus";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      title={title}
      data-preview={preview}
      className={cn(
        "relative flex min-h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        selected ? "gaid-index bg-gaid-signal-tint font-semibold text-gaid-ink" : "text-gaid-ink hover:bg-sidebar-accent",
      )}
    >
      {Icon && <Icon className={cn("size-4 shrink-0", selected ? "text-gaid-signal-ink" : "text-gaid-ink-2")} aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {children}
      {count !== undefined && <span className="text-xs font-medium tabular-nums text-gaid-ink-3">{count}</span>}
    </button>
  );
}
