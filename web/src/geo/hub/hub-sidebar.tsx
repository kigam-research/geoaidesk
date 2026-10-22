"use client";
/**
 * Sidebar of every GAID hub screen (UI guide v2 L1, L2, L3, N2): the hub's places (추천, 등록된 Workflow, topic folders,
 * 내 Workflow) stay beside the home lists, a registered or built-in Workflow, and a Workflow being made. On a detail
 * screen the list it was opened from stays marked. Hidden, it becomes a 48 px rail with the same places as icons.
 */
import { BookOpenIcon, FolderIcon, NewspaperIcon, FolderPlusIcon, ListIcon, PanelLeftIcon, PencilIcon, StarIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { geoText, t } from "@/geo/i18n";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import { shortcutLabel } from "@/geo/shell/shortcuts";
import { cn } from "@/lib/utils";

const text = geoText("hub");

/** The list the hub shows (or, on a detail screen, the list the researcher came from). */
export type HubView = { kind: "home" } | { kind: "registry"; folder: string } | { kind: "mine" } | { kind: "skills" } | { kind: "feeds" };

export interface HubSidebarFolder {
  id: string;
  name: string;
  count: number;
}

export function sameView(a: HubView, b: HubView): boolean {
  return a.kind === b.kind && (a.kind !== "registry" || a.folder === (b as { folder: string }).folder);
}

const COLLAPSED_KEY = "gaid:hub-sidebar";
/** Compact desktop class (UI guide v2 L1): below 1280 px the sidebar starts as the rail. */
const COMPACT = "(max-width: 1279px)";

function compactWindow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(COMPACT).matches;
}

function savedChoice(): "rail" | "open" | null {
  try {
    const v = localStorage.getItem(COLLAPSED_KEY);
    return v === "rail" || v === "open" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Whether the hub sidebar is hidden (rail). The researcher's choice is kept per browser; without one, the window class
 * decides (rail below 1280 px) and follows window resizing.
 */
export function useHubSidebarCollapsed(): [boolean, () => void] {
  // The hub mounts only in the browser (it opens from the URL hash), so storage and media queries are readable here.
  const [choice, setChoice] = useState(savedChoice);
  const [compact, setCompact] = useState(compactWindow);
  useEffect(() => {
    if (choice !== null || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(COMPACT);
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);
  const collapsed = choice === null ? compact : choice === "rail";
  const toggle = useCallback(() => {
    const next = collapsed ? "open" : "rail";
    setChoice(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next);
    } catch {
      /* the choice then lasts for this page only */
    }
  }, [collapsed]);
  return [collapsed, toggle];
}

/** App-bar button that hides or shows the hub sidebar (N2; ⌘\ / Ctrl \ does the same, N6). */
export function HubSidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = text(collapsed ? "sidebar.show" : "sidebar.hide");
  return (
    <InfoTooltip
      content={
        <>
          <b>{label}</b>
          <kbd className="ml-2 font-sans text-xs opacity-80">{shortcutLabel("sidebar")}</kbd>
        </>
      }
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={!collapsed}
        className={cn(!collapsed && "bg-gaid-hover text-gaid-ink")}
      >
        <PanelLeftIcon />
      </Button>
    </InfoTooltip>
  );
}

export function HubSidebar({
  view,
  folders,
  registryTotal,
  mineCount,
  collapsed = false,
  onView,
  onNewFolder,
}: {
  /** Marked place; null marks none. */
  view: HubView | null;
  /** Topic folders of the shared registry with their entry counts. */
  folders: HubSidebarFolder[];
  registryTotal: number;
  mineCount: number;
  collapsed?: boolean;
  onView: (view: HubView) => void;
  onNewFolder?: () => void;
}) {
  const is = (v: HubView) => view !== null && sameView(view, v);
  if (collapsed)
    return (
      <nav
        aria-label={text("home.nav")}
        className="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome py-3"
      >
        <RailItem icon={StarIcon} label={text("home.recommended")} selected={is({ kind: "home" })} onClick={() => onView({ kind: "home" })} />
        <RailItem
          icon={ListIcon}
          label={text("home.browse.title")}
          selected={view?.kind === "registry"}
          onClick={() => onView({ kind: "registry", folder: "all" })}
        />
        <RailItem icon={PencilIcon} label={text("home.mineTitle")} selected={is({ kind: "mine" })} onClick={() => onView({ kind: "mine" })} />
        <RailItem icon={BookOpenIcon} label={t("hubSkills.nav")} selected={is({ kind: "skills" })} onClick={() => onView({ kind: "skills" })} />
        <RailItem icon={NewspaperIcon} label={t("hubFeeds.nav")} selected={is({ kind: "feeds" })} onClick={() => onView({ kind: "feeds" })} />
      </nav>
    );
  return (
    <nav
      aria-label={text("home.nav")}
      className="flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3"
    >
      <SidebarGroup>
        <SidebarItem icon={StarIcon} label={text("home.recommended")} selected={is({ kind: "home" })} onClick={() => onView({ kind: "home" })} />
        <SidebarItem
          icon={ListIcon}
          label={text("home.browse.title")}
          count={registryTotal}
          selected={is({ kind: "registry", folder: "all" })}
          onClick={() => onView({ kind: "registry", folder: "all" })}
        />
      </SidebarGroup>
      <SidebarGroup
        title={text("home.foldersTitle")}
        action={
          onNewFolder && (
            <Button variant="ghost" size="icon-xs" aria-label={text("home.newFolder")} title={text("home.newFolder")} onClick={onNewFolder}>
              <FolderPlusIcon />
            </Button>
          )
        }
      >
        {folders.map((f) => (
          <SidebarItem
            key={f.id}
            icon={FolderIcon}
            label={f.name}
            title={f.name}
            count={f.count}
            selected={is({ kind: "registry", folder: f.id })}
            onClick={() => onView({ kind: "registry", folder: f.id })}
          />
        ))}
      </SidebarGroup>
      <SidebarGroup title={text("home.mineTitle")}>
        <SidebarItem icon={PencilIcon} label={text("home.mineItem")} count={mineCount} selected={is({ kind: "mine" })} onClick={() => onView({ kind: "mine" })} />
      </SidebarGroup>
      <SidebarGroup title={t("hubSkills.nav")}><SidebarItem icon={BookOpenIcon} label={t("hubSkills.all")} selected={is({ kind: "skills" })} onClick={() => onView({ kind: "skills" })} /></SidebarGroup>
      <SidebarGroup>
        <SidebarItem icon={NewspaperIcon} label={t("hubFeeds.nav")} selected={is({ kind: "feeds" })} onClick={() => onView({ kind: "feeds" })} />
      </SidebarGroup>
    </nav>
  );
}

function RailItem({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: typeof StarIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        selected ? "gaid-index bg-gaid-signal-tint text-gaid-signal-ink before:!left-[-6px]" : "text-gaid-ink-2 hover:bg-sidebar-accent hover:text-gaid-ink",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
