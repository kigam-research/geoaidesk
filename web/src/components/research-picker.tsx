"use client";
import { geoLocale, geoText } from "@/geo/i18n";
import { workLabel } from "@/geo/work-labels";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenIcon,
  CheckIcon,
  LoaderIcon,
  MessagesSquareIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/projects";
import type { MemoryKind, MemorySearchResponse } from "@/lib/notebook-memory";
import type { NotebookEntry } from "@/lib/notebook";
import { commandPreview } from "@/lib/command-blocks";
import {
  researchRefKey,
  type ResearchRef,
} from "@/lib/composer-context";

const workText = geoText("work");

type Mode = "records" | "chats";

const FILTERS: { id: MemoryKind | "all"; label: string }[] = [
  { id: "all", label: workText("research_picker.all") },
  { id: "hypothesis", label: workText("research_picker.hypotheses") },
  { id: "observation", label: workText("research_picker.observations") },
  { id: "decision", label: workText("research_picker.decisions") },
  { id: "method", label: workText("research_picker.methods") },
  { id: "plan", label: workText("research_picker.plans") },
  { id: "user-note", label: workText("research_picker.notes") },
];

const RECENT_LIMIT = 12;

interface Row {
  ref: ResearchRef;
  excerpt?: string;
  meta: string;
  muted?: boolean;
}

interface SessionListItem {
  id: string;
  name: string | null;
  modified: string | number;
  messageCount: number;
  firstMessage?: string | null;
}

function relativeTime(value: string | number): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return workText("research_picker.just_now");
  if (mins < 60) return workText("research_picker.valuem_ago", { v0: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return workText("research_picker.valueh_ago", { v0: hours });
  const days = Math.round(hours / 24);
  return days < 30 ? workText("research_picker.valued_ago", { v0: days }) : new Date(then).toLocaleDateString(geoLocale());
}

function chatTitle(s: SessionListItem): string {
  const raw = (s.name ?? commandPreview(s.firstMessage ?? "")).replace(/\s+/g, " ").trim();
  return raw || workText("research_picker.untitled_chat");
}

/** Latest project notebook entries that nothing later amends. */
function recentRows(entries: NotebookEntry[]): Row[] {
  const superseded = new Set(
    entries.filter((e) => e.supersedes).map((e) => `${e.sessionId}:${e.supersedes}`),
  );
  return entries
    .filter((e) => e.sessionId && !e.provisional && !superseded.has(`${e.sessionId}:${e.id}`))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, RECENT_LIMIT)
    .map((e) => ({
      ref: {
        kind: "record",
        type: e.type,
        title: e.title,
        source: { kind: "notebook", sessionId: e.sessionId as string, entryId: e.id },
      },
      excerpt: e.body?.replace(/\s+/g, " ").slice(0, 160),
      meta: [e.role ? workLabel("role", e.role) : e.role, relativeTime(e.timestamp)].filter(Boolean).join(" · "),
    }));
}

function hitRows(result: MemorySearchResponse): Row[] {
  return result.hits.map((hit) => ({
    ref: {
      kind: "record",
      type: hit.type,
      title: hit.title,
      source: hit.source,
      digest: hit.digest,
    },
    // A title-only match repeats the row title as "title: …"; skip it.
    excerpt: hit.excerpt.startsWith("title: ") ? undefined : hit.excerpt.replace(/\s+/g, " "),
    meta: [
      workLabel("role", hit.author),
      relativeTime(hit.timestamp),
      hit.recordStatus !== "active" ? workLabel("status", hit.recordStatus) : "",
      hit.outcome ? workText("research_picker.outcome_value", { v0: workLabel("outcome", hit.outcome) }) : "",
    ].filter(Boolean).join(" · "),
    muted: hit.recordStatus === "superseded",
  }));
}

/**
 * Research context for the next message: project notebook records, frozen
 * plans and notes (via the same research-memory search the agent's
 * notebook_search tool uses), plus earlier chats in this project. Picked
 * items become references Kady reads with its own tools; nothing is pasted
 * into the prompt.
 */
export function ResearchPickerBody({
  projectId,
  currentSessionId,
  selected,
  onChange,
  autoFocus = false,
}: {
  projectId: string;
  currentSessionId: string | null;
  selected: ResearchRef[];
  onChange: (refs: ResearchRef[]) => void;
  autoFocus?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("records");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryKind | "all">("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedKeys = useMemo(() => new Set(selected.map(researchRefKey)), [selected]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [autoFocus, mode]);

  // Records: recent entries when idle, research-memory search otherwise.
  useEffect(() => {
    if (mode !== "records") return;
    const controller = new AbortController();
    const q = query.trim();
    const t = setTimeout(async () => {
      setError(null);
      try {
        if (!q && filter === "all") {
          const res = await apiFetch(
            `/projects/${encodeURIComponent(projectId)}/notebook`,
            { signal: controller.signal, cache: "no-store" },
            projectId,
          );
          if (!res.ok) throw new Error(workText("research_picker.notebook_unavailable_value", { v0: res.status }));
          const data = (await res.json()) as { entries?: NotebookEntry[] };
          setRows(recentRows(data.entries ?? []));
        } else {
          const res = await apiFetch(
            `/projects/${encodeURIComponent(projectId)}/notebook/memory/search`,
            {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: q,
                limit: 12,
                ...(filter !== "all" ? { type: filter } : {}),
              }),
            },
            projectId,
          );
          const data = (await res.json().catch(() => null)) as
            | (MemorySearchResponse & { detail?: string })
            | null;
          if (!res.ok || !data) throw new Error(data?.detail || workText("research_picker.search_failed_value", { v0: res.status }));
          setRows(hitRows(data));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setRows([]);
        setError(err instanceof Error ? err.message : workText("research_picker.search_failed"));
      }
    }, q ? 250 : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [mode, query, filter, projectId]);

  useEffect(() => {
    if (mode !== "chats" || sessions !== null) return;
    let cancelled = false;
    apiFetch("/sessions", {}, projectId)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: SessionListItem[]) => {
        if (!cancelled) setSessions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, projectId, sessions]);

  const chatRows = useMemo<Row[] | null>(() => {
    if (!sessions) return null;
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => s.messageCount > 0 && s.id !== currentSessionId)
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .map((s) => ({ s, title: chatTitle(s) }))
      .filter(({ title }) => !q || title.toLowerCase().includes(q))
      .map(({ s, title }) => ({
        ref: { kind: "chat" as const, sessionId: s.id, title },
        meta: [relativeTime(s.modified), workText("research_picker.value_messages", { v0: s.messageCount })].join(" · "),
      }));
  }, [sessions, query, currentSessionId]);

  const toggle = (ref: ResearchRef) => {
    const key = researchRefKey(ref);
    onChange(
      selectedKeys.has(key)
        ? selected.filter((r) => researchRefKey(r) !== key)
        : [...selected, ref],
    );
  };

  const visible = mode === "records" ? rows : chatRows;
  const loading = visible === null;
  const idleRecords = mode === "records" && !query.trim() && filter === "all";

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            mode === "records"
              ? workText("research_picker.search_notebook_entries_plans_and_notes")
              : workText("research_picker.filter_earlier_chats")
          }
          aria-label={mode === "records" ? workText("research_picker.search_research_records") : workText("research_picker.filter_earlier_chats_598")}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <div className="flex shrink-0 rounded-md border p-0.5" role="radiogroup" aria-label={workText("research_picker.research_source")}>
          {(
            [
              { id: "records", label: workText("research_picker.records"), icon: BookOpenIcon },
              { id: "chats", label: workText("research_picker.chats"), icon: MessagesSquareIcon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => {
                if (id === mode) return;
                setMode(id);
                setQuery("");
              }}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                mode === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "records" && (
        <div className="flex flex-wrap gap-1 border-b px-3 py-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                filter === f.id
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-72 overflow-y-auto py-1">
        {idleRecords && rows && rows.length > 0 && (
          <div className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {workText("research_picker.recent_notebook_entries")}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <LoaderIcon className="size-3.5 animate-spin" /> {workText("research_picker.loading")}</div>
        ) : error ? (
          <div role="alert" className="px-3 py-6 text-center text-xs text-destructive">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-muted-foreground">
            {mode === "chats"
              ? query.trim()
                ? workText("research_picker.no_matching_chats")
                : workText("research_picker.no_other_chats_in_this_project_yet")
              : idleRecords
                ? workText("research_picker.no_notebook_entries_yet_kady_records_hypotheses_methods_and_findings_here_as_it_works")
                : workText("research_picker.no_matching_records")}
          </div>
        ) : (
          visible.map((row) => {
            const key = researchRefKey(row.ref);
            const isSelected = selectedKeys.has(key);
            return (
              <div
                key={key}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggle(row.ref)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggle(row.ref);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                  isSelected && "bg-muted/40",
                  row.muted && "opacity-70",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {isSelected && <CheckIcon className="size-2.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {row.ref.kind === "record" && (
                      <span className="shrink-0 rounded bg-sky-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                        {workText(`record_kind.${row.ref.type}`)}
                      </span>
                    )}
                    <span className="truncate font-medium text-foreground">{row.ref.title}</span>
                  </div>
                  {row.excerpt && (
                    <p className="mt-0.5 line-clamp-2 leading-relaxed text-muted-foreground/80">
                      {row.excerpt}
                    </p>
                  )}
                  {row.meta && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{row.meta}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          {mode === "records"
            ? workText("research_picker.kady_reads_picked_records_with_notebook_search_before_relying_on_them")
            : workText("research_picker.kady_reads_a_compact_snapshot_of_each_picked_chat_taken_when_you_send")}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="whitespace-nowrap text-[10px] text-muted-foreground transition-colors hover:text-destructive"
          >
            {workText("research_picker.clear_count", { count: selected.length })}
          </button>
        )}
      </div>
    </>
  );
}
