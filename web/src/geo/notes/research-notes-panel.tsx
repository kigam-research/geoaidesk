"use client";

/**
 * Notebook tab (gaid-notebook-review, docs/geo/research-notes.md): research notes first, the agent's work record
 * (the upstream Lab Notebook timeline) one click behind. List → note detail inside the tab, because the preview
 * column is narrow; the note file itself also opens as an ordinary file tab for editing.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftIcon, BookOpenIcon, ChevronRightIcon, FileTextIcon, MessageSquareIcon, NotebookPenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { apiFetch } from "@/lib/projects";
import { prefillChat } from "@/lib/chat-prefill";
import { rawFileUrl } from "@/lib/use-sandbox";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type {
  ResearchNoteDecision, ResearchNoteListResponse, ResearchNoteResponse, ResearchNoteStatus, ResearchNoteSummary,
} from "@/geo/contracts/research-notes";
import { noteBody, splitDecisions } from "./note-markdown";

const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium";
const TONE: Record<ResearchNoteStatus | "decision" | "format", string> = {
  pending: "border-primary/30 bg-primary/10 text-primary",
  confirmed: "border-[var(--gaid-success)]/40 bg-[var(--gaid-success)]/10 text-[var(--gaid-success)]",
  superseded: "border-border bg-muted/50 text-muted-foreground",
  decision: "border-[var(--gaid-warning)]/40 bg-[var(--gaid-warning)]/10 text-[var(--gaid-warning)]",
  format: "border-border bg-muted/50 text-muted-foreground",
};

type View = { kind: "list" } | { kind: "note"; id: string; focusDecisions?: boolean } | { kind: "record" };

export interface ResearchNotesPanelProps {
  projectId: string;
  /** True while the active chat is running; the list is reread when a run ends. */
  streaming: boolean;
  /** Changes when the chat deep-links into a work-record entry: the panel then shows the work record. */
  recordFocusToken?: number | null;
  onOpenFile: (path: string) => void;
  /** Opens (or focuses) the chat with this session id. */
  onOpenChat?: (sessionId: string, title: string) => void;
  /** The work record view (upstream Lab Notebook timeline). */
  workRecord: ReactNode;
}

export function ResearchNotesPanel({ projectId, streaming, recordFocusToken, onOpenFile, onOpenChat, workRecord }: ResearchNotesPanelProps) {
  const [view, setView] = useState<View>({ kind: "list" });
  const notes = useResearchNotes(projectId, streaming);
  useEffect(() => { if (recordFocusToken) setView({ kind: "record" }); }, [recordFocusToken]);

  if (view.kind === "record") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: "list" })}>
            <ArrowLeftIcon aria-hidden />{t("notes.record.back")}
          </Button>
          <span className="truncate text-sm text-muted-foreground" title={t("notes.record.hint")}>{t("notes.record.title")}</span>
        </div>
        <div className="min-h-0 flex-1">{workRecord}</div>
      </div>
    );
  }
  if (view.kind === "note") {
    return (
      <NoteDetail
        key={view.id}
        projectId={projectId}
        id={view.id}
        focusDecisions={view.focusDecisions}
        summary={notes.list?.find((n) => n.id === view.id) ?? null}
        onBack={() => { setView({ kind: "list" }); void notes.reload(); }}
        onOpenNote={(id) => setView({ kind: "note", id })}
        onOpenFile={onOpenFile}
        onOpenChat={onOpenChat}
        onChanged={notes.reload}
      />
    );
  }
  return (
    <NoteList
      state={notes}
      onOpen={(id, focusDecisions) => setView({ kind: "note", id, focusDecisions })}
      onRecord={() => setView({ kind: "record" })}
    />
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface NotesState {
  list: ResearchNoteSummary[] | null;
  error: string | null;
  reload: () => Promise<void>;
}

function useResearchNotes(projectId: string, streaming: boolean): NotesState {
  const [list, setList] = useState<ResearchNoteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await apiFetch("/geo/notes", {}, projectId);
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
      const data = (await res.json()) as ResearchNoteListResponse;
      if (mine !== seq.current) return;
      setList(data.notes); setError(null);
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);
  useEffect(() => { void reload(); }, [reload]);
  // A run that ends may have written or updated a note.
  const wasStreaming = useRef(streaming);
  useEffect(() => {
    if (wasStreaming.current && !streaming) void reload();
    wasStreaming.current = streaming;
  }, [streaming, reload]);
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);
  return { list, error, reload };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function NoteList({ state, onOpen, onRecord }: {
  state: NotesState;
  onOpen: (id: string, focusDecisions?: boolean) => void;
  onRecord: () => void;
}) {
  const { list, error } = state;
  const live = useMemo(() => (list ?? []).filter((n) => n.status !== "superseded"), [list]);
  const decisions = useMemo(() => live.flatMap((note) => note.decisions.map((decision) => ({ note, decision }))), [live]);
  const groups = useMemo(() => ({
    pending: live.filter((n) => n.status === "pending"),
    confirmed: live.filter((n) => n.status === "confirmed"),
    superseded: (list ?? []).filter((n) => n.status === "superseded"),
  }), [list, live]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BookOpenIcon className="size-4 text-primary" aria-hidden />{t("notes.panel.title")}
          </h2>
          {list && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {decisions.length
                ? t("notes.panel.summary", { count: live.length, decisions: decisions.length })
                : t("notes.panel.summaryNoDecisions", { count: live.length })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRecord}>{t("notes.record.button")}</Button>
          <Button size="sm" onClick={() => prefillChat(t("notes.organize.prompt"))} title={t("notes.organize.tip")}>
            <NotebookPenIcon aria-hidden />{t("notes.organize.button")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error && !list ? (
          <LoadError message={error} onRetry={() => void state.reload()} />
        ) : !list ? (
          <p className="text-sm text-muted-foreground">{t("notes.panel.loading")}</p>
        ) : !list.length ? (
          <div className="mx-auto mt-10 max-w-sm text-center">
            <p className="text-base font-semibold">{t("notes.empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("notes.empty.body")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {decisions.length > 0 && (
              <Group label={t("notes.group.decisions", { count: decisions.length })}>
                {decisions.map(({ note, decision }) => (
                  <button
                    key={`${note.id}#${decision.number}`}
                    type="button"
                    onClick={() => onOpen(note.id, true)}
                    className="flex w-full items-center gap-3 rounded-md border border-[var(--gaid-warning)]/40 bg-background px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{decision.question}</span>
                      <span className="block truncate text-xs text-muted-foreground">{note.title}</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </Group>
            )}
            {groups.pending.length > 0 && (
              <Group label={t("notes.group.pending", { count: groups.pending.length })}>
                {groups.pending.map((note) => <NoteRow key={note.id} note={note} onOpen={onOpen} />)}
              </Group>
            )}
            {groups.confirmed.length > 0 && (
              <Group label={t("notes.group.confirmed", { count: groups.confirmed.length })}>
                {groups.confirmed.map((note) => <NoteRow key={note.id} note={note} onOpen={onOpen} />)}
              </Group>
            )}
            {groups.superseded.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                  {t("notes.group.superseded", { count: groups.superseded.length })}
                </summary>
                <div className="mt-2 space-y-2">
                  {groups.superseded.map((note) => <NoteRow key={note.id} note={note} onOpen={onOpen} />)}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{label}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function NoteRow({ note, onOpen }: { note: ResearchNoteSummary; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      className="flex w-full items-start gap-3 rounded-md border bg-background px-3 py-2.5 text-left hover:bg-muted/40"
    >
      {note.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- sandbox file through the authenticated raw route
        <img src={rawFileUrl(note.cover)} alt="" className="size-14 shrink-0 rounded border object-cover" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded border bg-muted/40">
          <FileTextIcon className="size-5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{note.title}</span>
        {note.headline && <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{note.headline}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatDate(note.date)}</span>
          <StatusBadge status={note.status} />
          {note.decisions.length > 0 && (
            <span className={cn(PILL, TONE.decision)} title={t("notes.badge.decisionsTip")}>
              {t("notes.badge.decisions", { count: note.decisions.length })}
            </span>
          )}
          {note.problems.length > 0 && (
            <span className={cn(PILL, TONE.format)} title={t("notes.badge.formatTip")}>{t("notes.badge.format")}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: ResearchNoteStatus }) {
  return <span className={cn(PILL, TONE[status])} title={t(`notes.status.${status}Tip`)}>{t(`notes.status.${status}`)}</span>;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p>{t("notes.error.load")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>{t("notes.error.retry")}</Button>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("notes.error.technical")}</summary>
        <pre className="mt-1 whitespace-pre-wrap break-all">{message}</pre>
      </details>
    </div>
  );
}

function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function NoteDetail({ projectId, id, focusDecisions, summary, onBack, onOpenNote, onOpenFile, onOpenChat, onChanged }: {
  projectId: string;
  id: string;
  focusDecisions?: boolean;
  summary: ResearchNoteSummary | null;
  onBack: () => void;
  onOpenNote: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenChat?: (sessionId: string, title: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<ResearchNoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [saving, setSaving] = useState(false);
  const decisionsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/geo/notes/${encodeURIComponent(id)}`, {}, projectId);
      if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
      setData((await res.json()) as ResearchNoteResponse); setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id, projectId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (data && focusDecisions) decisionsRef.current?.scrollIntoView({ block: "start" });
  }, [data, focusDecisions]);

  const note = data?.note ?? summary;
  const parts = useMemo(() => data ? splitDecisions(noteBody(data.content, data.note.path)) : null, [data]);

  const setStatus = async (status: ResearchNoteStatus) => {
    setSaving(true); setStatusError(false);
    try {
      const res = await apiFetch(`/geo/notes/${encodeURIComponent(id)}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }, projectId);
      if (!res.ok) throw new Error(String(res.status));
      const updated = (await res.json()) as { note: ResearchNoteSummary };
      setData((prev) => prev ? { ...prev, note: updated.note } : prev);
      void onChanged();
    } catch {
      setStatusError(true);
    } finally {
      setSaving(false);
    }
  };

  const chat = note?.sessions.at(-1);
  const meta = note ? [
    formatDate(note.date),
    note.method ? t("notes.detail.method", { name: note.method.name ?? t("notes.detail.methodUnnamed") }) : null,
    note.method?.assessment ? t(`notes.detail.assessment.${note.method.assessment}`) : null,
  ].filter(Boolean).join(" · ") : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b px-4 py-3">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeftIcon aria-hidden />{t("notes.detail.back")}
        </Button>
        {note && (
          <>
            <h2 className="mt-1 text-base font-semibold leading-snug">{note.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{meta}</span>
              <StatusBadge status={note.status} />
              {note.problems.length > 0 && (
                <span className={cn(PILL, TONE.format)} title={t("notes.badge.formatTip")}>{t("notes.badge.format")}</span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenFile(note.path)}>
                <FileTextIcon aria-hidden />{t("notes.detail.openFile.button")}
              </Button>
              {chat && onOpenChat && (
                <Button variant="outline" size="sm" onClick={() => onOpenChat(chat, note.title)}>
                  <MessageSquareIcon aria-hidden />{t("notes.detail.openChat.button")}
                </Button>
              )}
              {note.status === "pending" && (
                <Button size="sm" disabled={saving} onClick={() => void setStatus("confirmed")}>{t("notes.detail.confirm.button")}</Button>
              )}
              {note.status === "confirmed" && (
                <Button variant="outline" size="sm" disabled={saving} onClick={() => void setStatus("pending")}>{t("notes.detail.unconfirm.button")}</Button>
              )}
            </div>
            {statusError && <p role="alert" className="mt-1 text-xs text-destructive">{t("notes.error.status")}</p>}
            {note.supersededBy && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {t("notes.detail.supersededBy")}
                <Button variant="link" size="xs" className="h-auto p-0" onClick={() => onOpenNote(note.supersededBy!)}>
                  {t("notes.detail.openSuperseding.button")}
                </Button>
              </p>
            )}
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
        {error && !data ? (
          <LoadError message={error} onRetry={() => void load()} />
        ) : !data || !parts ? (
          <p className="text-muted-foreground">{t("notes.panel.loading")}</p>
        ) : (
          <div className="mx-auto max-w-[960px]">
            <MessageResponse onOpenFile={onOpenFile}>{parts.before}</MessageResponse>
            {parts.decisions !== null && (
              <div ref={decisionsRef} className="mt-6 scroll-mt-4">
                {data.note.decisions.length ? (
                  <DecisionCards note={data.note} />
                ) : (
                  <MessageResponse onOpenFile={onOpenFile}>{parts.decisions}</MessageResponse>
                )}
              </div>
            )}
            {parts.after.trim() && <div className="mt-6"><MessageResponse onOpenFile={onOpenFile}>{parts.after}</MessageResponse></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionCards({ note }: { note: ResearchNoteSummary }) {
  return (
    <section aria-label={t("notes.decision.title")}>
      <h2 className="mb-3 text-base font-semibold">{t("notes.decision.title")}</h2>
      <div className="space-y-3">
        {note.decisions.map((decision) => <DecisionCard key={decision.number} note={note} decision={decision} />)}
      </div>
    </section>
  );
}

function DecisionCard({ note, decision }: { note: ResearchNoteSummary; decision: ResearchNoteDecision }) {
  const options = [...decision.options].sort((a, b) => Number(b.recommended) - Number(a.recommended));
  return (
    <div className="rounded-md border border-[var(--gaid-warning)]/40 p-3">
      <p className="text-sm font-semibold">{decision.number}. {decision.question}</p>
      <div className="mt-2 space-y-1.5">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            title={t("notes.decision.answerTip")}
            onClick={() => prefillChat(t("notes.decision.prompt", {
              title: note.title, number: decision.number, label: option.label, text: option.text, path: note.path,
            }))}
            className="flex w-full items-start gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted/40"
          >
            <span className="font-medium">{option.label})</span>
            <span className="min-w-0 flex-1">
              <span className="block">{option.text}</span>
              {option.recommended && option.reason && <span className="mt-0.5 block text-xs text-muted-foreground">{option.reason}</span>}
            </span>
            {option.recommended && <span className={cn(PILL, TONE.pending, "shrink-0")}>{t("notes.decision.recommended")}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
