"use client";

/**
 * Notebook tab (gaid-notebook-review, docs/geo/research-notes.md): research notes first, the agent's work record
 * (the upstream Lab Notebook timeline) one click behind. List → note detail inside the tab, because the preview
 * column is narrow; the note file itself also opens as an ordinary file tab for editing.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftIcon, BookOpenIcon, ChevronRightIcon, FileTextIcon, MessageSquareIcon, NotebookPenIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageResponse } from "@/components/ai-elements/message";
import { apiFetch } from "@/lib/projects";
import { prefillChat, type ChatPrefillResult } from "@/lib/chat-prefill";
import { rawFileUrl } from "@/lib/use-sandbox";
import { cn } from "@/lib/utils";
import { geoLocale, t } from "@/geo/i18n";
import type {
  ResearchNoteDecision, ResearchNoteListResponse, ResearchNoteResponse, ResearchNoteStatus, ResearchNoteSummary,
} from "@/geo/contracts/research-notes";
import { noteBody, plainText, splitDecisions } from "./note-markdown";
import { answeredCount, answersMessage, isAnswered, type DecisionAnswer, type DecisionAnswers } from "./decision-answers";
import { StepScale } from "@/geo/shell/step-scale";
import { NoteReferences } from "@/geo/library/note-references";
import { NoteFigures } from "@/geo/figures";
import { ConnectionMapButton } from "@/geo/connections";

/**
 * Note body headings on the GAID type scale (sections 16 px, subsections 14 px) instead of the chat's larger defaults.
 * The shared renderer promotes the top heading level, so a note's `##` sections arrive as h1.
 */
const NOTE_PROSE = "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold";
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium";
const TONE: Record<ResearchNoteStatus | "decision" | "format", string> = {
  pending: "border-primary/30 bg-primary/10 text-primary",
  confirmed: "border-[var(--gaid-success)]/40 bg-[var(--gaid-success)]/10 text-[var(--gaid-success)]",
  superseded: "border-border bg-muted/50 text-muted-foreground",
  decision: "border-[var(--gaid-warning)]/40 bg-[var(--gaid-warning)]/10 text-[var(--gaid-warning)]",
  format: "border-border bg-muted/50 text-muted-foreground",
};

/** A just-opened chat tab needs a moment to become active and listen; answers are offered to it until it takes them. */
const ANSWER_RETRY_MS = 250;
const ANSWER_TRIES = 20;

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
          <Button variant="ghost" size="sm" onClick={() => setView({ kind: "list" })} title={t("notes.record.hint")}>
            <ArrowLeftIcon aria-hidden />{t("notes.record.back")}
          </Button>
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
                      <span className="block truncate text-sm font-medium">{plainText(decision.question)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{plainText(note.title)}</span>
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
        <span className="block truncate text-sm font-semibold">{plainText(note.title)}</span>
        {note.headline && <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{plainText(note.headline)}</span>}
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
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(geoLocale() === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
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
      const updated = (await res.json()) as ResearchNoteSummary;
      setData((prev) => prev ? { ...prev, note: updated } : prev);
      void onChanged();
    } catch {
      setStatusError(true);
    } finally {
      setSaving(false);
    }
  };

  const chat = note?.sessions.at(-1);
  // Answers go to the chat that wrote the note, where its analysis context is; else to the active chat.
  const sendAnswers = (text: string): Promise<ChatPrefillResult | null> => {
    if (!(chat && onOpenChat && note)) return Promise.resolve(prefillChat(text, { send: true }));
    onOpenChat(chat, note.title);
    return new Promise((resolve) => {
      let tries = 0;
      const offer = () => {
        const result = prefillChat(text, { send: true, sessionId: chat });
        if (result) resolve(result);
        else if (++tries >= ANSWER_TRIES) resolve(null);
        else window.setTimeout(offer, ANSWER_RETRY_MS);
      };
      offer();
    });
  };
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
            <h2 className="mt-1 text-base font-semibold leading-snug">{plainText(note.title)}</h2>
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
              <ConnectionMapButton
                focus={`note:${note.id}`}
                projectId={projectId}
                onOpenNote={onOpenNote}
                onOpenFile={onOpenFile}
                onOpenChat={onOpenChat ? (session) => onOpenChat(session, note.title) : undefined}
              />
              {note.status === "pending" && (
                // With decisions to answer, 답변 보내기 is the view's one primary action (UI guide B1).
                <Button variant={note.decisions.length ? "outline" : "default"} size="sm" disabled={saving} onClick={() => void setStatus("confirmed")}>{t("notes.detail.confirm.button")}</Button>
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
            <MessageResponse className={NOTE_PROSE} onOpenFile={onOpenFile}>{parts.before}</MessageResponse>
            {parts.decisions !== null && (
              <div ref={decisionsRef} className="mt-6 scroll-mt-4">
                {data.note.decisions.length ? (
                  <DecisionCards note={data.note} onSend={sendAnswers} />
                ) : (
                  <MessageResponse className={NOTE_PROSE} onOpenFile={onOpenFile}>{parts.decisions}</MessageResponse>
                )}
              </div>
            )}
            {parts.after.trim() && <div className="mt-6"><MessageResponse className={NOTE_PROSE} onOpenFile={onOpenFile}>{parts.after}</MessageResponse></div>}
            <NoteReferences content={data.content} />
            <div className="mt-8 border-t border-gaid-edge pt-6">
              <NoteFigures
                key={data.note.updatedAt}
                projectId={projectId}
                noteId={id}
                onOpenFile={onOpenFile}
                onOpenChat={onOpenChat}
                renderFigureActions={(figure) => (
                  <ConnectionMapButton
                    focus={`figure:${figure.path}`}
                    projectId={projectId}
                    onOpenNote={onOpenNote}
                    onOpenFile={onOpenFile}
                    onOpenChat={onOpenChat ? (session) => onOpenChat(session, figure.caption ?? data.note.title) : undefined}
                  />
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionCards({ note, onSend }: { note: ResearchNoteSummary; onSend: (text: string) => Promise<ChatPrefillResult | null> }) {
  const [answers, setAnswers] = useState<DecisionAnswers>({});
  const [current, setCurrent] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | ChatPrefillResult | "failed">("idle");
  const decisions = note.decisions;
  const index = Math.min(current, decisions.length - 1);
  const decision = decisions[index];
  const answered = answeredCount(note, answers);
  const message = answersMessage(note, answers);
  const choose = (number: number, answer: DecisionAnswer) => { setAnswers((prev) => ({ ...prev, [number]: answer })); setState("idle"); };
  const send = async () => {
    if (!message) return;
    setState("sending");
    // Answers stay selected when no chat took them, so the researcher can send again.
    const result = await onSend(message);
    if (result) { setAnswers({}); setCurrent(0); setState(result); } else setState("failed");
  };
  // One decision at a time with a step scale and Previous/Next; all answers go together (UI guide v2 RN3, Q1, Q4).
  return (
    <section aria-label={t("notes.decision.title")} className="rounded-lg border border-gaid-control-edge bg-gaid-face">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3">
        <h2 className="text-sm font-semibold">{t("notes.decision.title")}</h2>
        <span className="text-xs font-medium tabular-nums text-gaid-ink-3">
          {t("notes.decision.counter", { current: index + 1, count: decisions.length })}
        </span>
        {decisions.length > 1 && (
          <StepScale
            className="min-w-[14rem] flex-1"
            label={t("notes.decision.steps")}
            numbered={false}
            current={index}
            onStep={setCurrent}
            steps={decisions.map((item) => ({ label: t("notes.decision.step", { number: item.number }), done: isAnswered(answers[item.number]) }))}
          />
        )}
      </div>
      <div className="px-4 pb-4 pt-3">
        <DecisionCard key={decision.number} decision={decision} answer={answers[decision.number]} onChoose={(answer) => choose(decision.number, answer)} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gaid-edge px-4 py-3">
        <p role={state === "failed" ? "alert" : undefined} aria-live="polite"
          className={cn("mr-auto text-xs", state === "failed" ? "text-destructive" : "text-gaid-ink-2")}>
          {state === "failed"
            ? t("notes.decision.sendFailed")
            : state === "sent" || state === "filled"
              ? t(state === "sent" ? "notes.decision.sent" : "notes.decision.filled")
              : answered
                ? t("notes.decision.progress", { answered, count: decisions.length })
                : t("notes.decision.sendBlocked")}
        </p>
        {decisions.length > 1 && (
          <>
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setCurrent(index - 1)}>
              {t("notes.decision.prev.button")}
            </Button>
            <Button variant="outline" size="sm" disabled={index === decisions.length - 1} onClick={() => setCurrent(index + 1)}>
              {t("notes.decision.next.button")}
            </Button>
          </>
        )}
        <Button size="sm" disabled={!message || state === "sending"} onClick={() => void send()} title={t("notes.decision.sendTip")}>
          <SendIcon aria-hidden />{t(state === "sending" ? "notes.decision.sending" : "notes.decision.send.button")}
        </Button>
      </div>
    </section>
  );
}

const OPTION_CARD = "rounded-md border border-gaid-edge bg-gaid-face transition-colors hover:border-gaid-control-edge";
const OPTION_ROW = "flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const OPTION_ON = "border-gaid-signal bg-gaid-signal-tint/40";

function DecisionCard({ decision, answer, onChoose }: {
  decision: ResearchNoteDecision;
  answer: DecisionAnswer | undefined;
  onChoose: (answer: DecisionAnswer) => void;
}) {
  const id = useId();
  const options = [...decision.options].sort((a, b) => Number(b.recommended) - Number(a.recommended));
  const instruction = answer?.kind === "instruction" ? answer.text : "";
  return (
    <div>
      <p id={id} className="text-[15px] font-semibold leading-6">{plainText(decision.question)}</p>
      <div role="radiogroup" aria-labelledby={id} className="mt-3 space-y-1.5">
        {options.map((option) => {
          const selected = answer?.kind === "option" && answer.label === option.label;
          return (
            <div key={option.label} className={cn(OPTION_CARD, selected && OPTION_ON)}>
              <button type="button" role="radio" aria-checked={selected} onClick={() => onChoose({ kind: "option", label: option.label })} className={OPTION_ROW}>
                <RadioDot selected={selected} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{plainText(option.text)}</span>
                    {option.recommended && (
                      <span className="rounded-sm border border-gaid-signal/40 bg-gaid-signal-tint px-1.5 text-xs font-semibold leading-5 text-gaid-signal-ink">
                        {t("notes.decision.recommended")}
                      </span>
                    )}
                  </span>
                  {option.recommended && option.reason && <span className="mt-0.5 block text-xs text-gaid-ink-2">{plainText(option.reason)}</span>}
                </span>
              </button>
            </div>
          );
        })}
        <div className={cn(OPTION_CARD, answer?.kind === "instruction" && OPTION_ON)}>
          <button type="button" role="radio" aria-checked={answer?.kind === "instruction"} onClick={() => onChoose({ kind: "instruction", text: instruction })} className={OPTION_ROW}>
            <RadioDot selected={answer?.kind === "instruction"} />
            <span className="font-medium">{t("notes.decision.instruction.label")}</span>
          </button>
          {answer?.kind === "instruction" && (
            <div className="px-3 pb-3 pl-9">
              <textarea
                autoFocus
                rows={3}
                aria-label={t("notes.decision.instruction.field", { number: decision.number })}
                placeholder={t("notes.decision.instruction.placeholder")}
                value={instruction}
                onChange={(event) => onChoose({ kind: "instruction", text: event.target.value })}
                className="w-full min-w-0 resize-y rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gaid-control-edge bg-gaid-face", selected && "border-gaid-signal")}>
      {selected && <span className="size-2 rounded-full bg-gaid-signal" />}
    </span>
  );
}
