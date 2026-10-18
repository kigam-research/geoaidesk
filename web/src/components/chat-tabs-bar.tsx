"use client";
import { geoLocale, geoText } from "@/geo/i18n";
import {
  DownloadIcon,
  FileTextIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MessageSquareTextIcon,
  PencilIcon,
  PlusIcon,
  TerminalIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { apiFetch } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { commandPreview } from "@/lib/command-blocks";

const appText = geoText("app");

export interface ChatTabDescriptor {
  id: string;
  title: string;
  isStreaming: boolean;
  userMessageCount: number;
}

export interface ChatTabsBarProps {
  projectId: string;
  tabs: ChatTabDescriptor[];
  activeTabId: string;
  view: "chat" | "workflows";
  maxTabs: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onSelectWorkflows: () => void;
  /** Reopen a stored session (from the History menu) into a tab. */
  onOpenSession: (sessionId: string, title: string) => void;
  /** Session id of the active tab, for reproducibility export. */
  activeSessionId?: string | null;
  /** Whether the active tab has any messages worth exporting. */
  canExport?: boolean;
}

interface SessionListItem {
  id: string;
  name: string | null;
  created: string | number;
  modified: string | number;
  messageCount: number;
  firstMessage?: string | null;
}

function sessionTitle(s: SessionListItem): string {
  const raw = (s.name ?? commandPreview(s.firstMessage ?? "")).replace(/\s+/g, " ").trim();
  if (!raw) return appText("chat.tabs.untitled_chat");
  return raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
}

function relativeTime(value: string | number): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return appText("chat.tabs.just_now");
  if (mins < 60) return appText("chat.tabs.minutes", { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return appText("chat.tabs.hours", { count: hours });
  const days = Math.round(hours / 24);
  return days < 7 ? appText("chat.tabs.days", { count: days }) : new Date(then).toLocaleDateString(geoLocale());
}

/** Clock menu listing the project's stored sessions; picking one reopens it
 *  (or focuses the tab that already has it). */
function HistoryMenu({
  projectId,
  onOpenSession,
}: {
  projectId: string;
  onOpenSession: (sessionId: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch("/sessions", {}, projectId)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: SessionListItem[]) => {
        if (cancelled) return;
        const sorted = [...list]
          .filter((s) => s.messageCount > 0)
          .sort(
            (a, b) =>
              new Date(b.modified).getTime() - new Date(a.modified).getTime(),
          );
        setSessions(sorted);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <InfoTooltip
        content={
          <>
            <b>{appText("chat.tabs.chat_history")}</b>
            <br />
            {appText("chat.tabs.reopen_a_previous_chat_from_this_project")}</>
        }
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={appText("chat.tabs.chat_history")}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <HistoryIcon className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
      </InfoTooltip>
      <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{appText("chat.tabs.previous_chats")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sessions === null ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">{appText("chat.tabs.loading")}</div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {appText("chat.tabs.no_previous_chats_in_this_project_yet")}</div>
        ) : (
          sessions.map((s) => {
            const title = sessionTitle(s);
            return (
              <DropdownMenuItem
                key={s.id}
                onClick={() => onOpenSession(s.id, title)}
              >
                <MessageSquareTextIcon className="size-4 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{title}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {appText("chat.tabs.historySummary", { time: relativeTime(s.modified), count: s.messageCount })}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fetch an export and trigger a browser download (X-Project-Id via apiFetch). */
async function downloadExport(
  projectId: string,
  sessionId: string,
  format: "sh" | "md",
) {
  try {
    const res = await apiFetch(
      `/sessions/${encodeURIComponent(sessionId)}/export?format=${format}&lang=${geoLocale()}`,
      {},
      projectId,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // best-effort download; nothing actionable to surface
  }
}

function ExportMenu({ projectId, sessionId }: { projectId: string; sessionId: string }) {
  return (
    <DropdownMenu>
      <InfoTooltip
        content={
          <>
            <b>{appText("chat.tabs.export_session")}</b>
            <br />
            {appText("chat.tabs.download_a_reproducible_record_of_this_chat")}</>
        }
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={appText("chat.tabs.export_session")}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <DownloadIcon className="size-3.5" />
            {appText("chat.tabs.export")}</button>
        </DropdownMenuTrigger>
      </InfoTooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{appText("chat.tabs.reproducibility_export")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => downloadExport(projectId, sessionId, "sh")}>
          <TerminalIcon className="size-4" />
          <div className="flex flex-col">
            <span>{appText("chat.tabs.shell_script_sh")}</span>
            <span className="text-[11px] text-muted-foreground">
              {appText("chat.tabs.every_command_in_order")}</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadExport(projectId, sessionId, "md")}>
          <FileTextIcon className="size-4" />
          <div className="flex flex-col">
            <span>{appText("chat.tabs.lab_notebook_md")}</span>
            <span className="text-[11px] text-muted-foreground">
              {appText("chat.tabs.prompts_commands_outputs")}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatTabsBar({
  projectId,
  tabs,
  activeTabId,
  view,
  maxTabs,
  onSelect,
  onClose,
  onNew,
  onRename,
  onSelectWorkflows,
  onOpenSession,
  activeSessionId,
  canExport = false,
}: ChatTabsBarProps) {
  const atLimit = tabs.length >= maxTabs;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (tab: ChatTabDescriptor) => {
    setEditingId(tab.id);
    setDraftTitle(tab.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const next = draftTitle.trim();
    if (next) onRename(editingId, next);
    setEditingId(null);
    setDraftTitle("");
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
      {/* Tabs + plus live in a scrollable region. Without this isolation the
          Workflows pill (after `ml-auto`) gets pushed to the far right of
          the scroll container — off-screen — once the tab strip overflows. */}
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = view === "chat" && tab.id === activeTabId;
          const canClose = tabs.length > 1;
          const isEditing = editingId === tab.id;
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1.5 rounded-md pl-2.5 pr-1 py-1 text-xs font-medium transition-colors max-w-[180px]",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <button
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => startRename(tab)}
                className="flex min-w-0 items-center gap-1.5"
                type="button"
                title={appText("chat.tabs.renameHint", { name: tab.title })}
              >
                <MessageSquareTextIcon className="size-3.5 shrink-0" />
                {tab.isStreaming && (
                  <LoaderCircleIcon className="size-3 shrink-0 animate-spin text-primary" />
                )}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setDraftTitle("");
                      }
                      e.stopPropagation();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="w-24 bg-transparent text-xs font-medium outline-none border-b border-primary/40 focus:border-primary"
                    maxLength={40}
                  />
                ) : (
                  <span className="truncate">{tab.title}</span>
                )}
                {tab.userMessageCount > 0 && !isEditing && (
                  <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums">
                    {tab.userMessageCount}
                  </span>
                )}
              </button>
              {!isEditing && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(tab);
                    }}
                    type="button"
                    aria-label={appText("chat.tabs.rename", { name: tab.title })}
                    className={cn(
                      "rounded p-0.5 text-muted-foreground/40 transition-all hover:bg-muted-foreground/10 hover:text-foreground",
                      isActive
                        ? "opacity-60 hover:opacity-100"
                        : "opacity-0 group-hover:opacity-60",
                    )}
                    title={appText("chat.tabs.rename_tab")}
                  >
                    <PencilIcon className="size-3" />
                  </button>
                  {canClose && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(tab.id);
                      }}
                      type="button"
                      aria-label={appText("chat.tabs.close", { name: tab.title })}
                      className={cn(
                        "rounded p-0.5 text-muted-foreground/40 transition-all hover:bg-destructive/10 hover:text-destructive",
                        isActive
                          ? "opacity-60 hover:opacity-100"
                          : "opacity-0 group-hover:opacity-60",
                      )}
                      title={
                        tab.isStreaming
                          ? appText("chat.tabs.close_tab_this_will_cancel_the_running")
                          : appText("chat.tabs.close_tab")
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        <InfoTooltip
          content={
            atLimit ? (
              <>
                <b>{appText("chat.tabs.tab_limit_reached")}</b>
                <br />
                {appText("chat.tabs.maxTabs", { count: maxTabs })}
              </>
            ) : (
              <>
                <b>{appText("chat.tabs.new_chat_tab")}</b>
                <br />
                {appText("chat.tabs.open_another_chat_in_the_same_project")}</>
            )
          }
        >
          <button
            onClick={onNew}
            type="button"
            disabled={atLimit}
            aria-label={appText("chat.tabs.new_chat_tab")}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </InfoTooltip>
        <HistoryMenu projectId={projectId} onOpenSession={onOpenSession} />
      </div>

      <div className="shrink-0 flex items-center gap-1 pl-2 border-l">
        {view === "chat" && canExport && activeSessionId && (
          <ExportMenu projectId={projectId} sessionId={activeSessionId} />
        )}
        <InfoTooltip
          content={
            <>
              <b>{appText("chat.tabs.workflows")}</b>
              <br />
              {appText("chat.tabs.pre_built_scientific_pipelines_e_g_rna")}</>
          }
        >
          <button
            onClick={onSelectWorkflows}
            type="button"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              view === "workflows"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <WorkflowIcon className="size-3.5" />
            {appText("chat.tabs.workflows")}</button>
        </InfoTooltip>
      </div>
    </div>
  );
}
