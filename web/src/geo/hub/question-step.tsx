"use client";
/**
 * One question at a time. Tabs above move between questions (and a last "답 확인" tab);
 * each question offers its options with the recommended one marked, a free-text "기타"
 * field and "나중에 정하기". Nothing is sent until the researcher applies all answers.
 * Recorded answers stay editable (gaid-hub-editing): a changed one is sent with the next
 * round and the draft is revised to it.
 */
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleDashedIcon, ClockIcon, QuoteIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerItem, Question } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

const text = geoText("hub");

export type DraftAnswer = Omit<AnswerItem, "questionId" | "questionRevision">;

export function isAnswered(a: DraftAnswer | undefined): boolean {
  if (!a) return false;
  if (a.defer) return true;
  return Boolean(a.optionId) || Boolean(a.response?.trim());
}

/** Same answer (option, words, or deferral), ignoring surrounding spaces. */
export function sameAnswer(a: DraftAnswer | undefined, b: DraftAnswer | undefined): boolean {
  if (!a || !b) return a === b;
  if (Boolean(a.defer) || Boolean(b.defer)) return Boolean(a.defer) === Boolean(b.defer);
  return (a.optionId ?? "") === (b.optionId ?? "") && (a.response ?? "").trim() === (b.response ?? "").trim();
}

export function answerLabel(q: Question, a: DraftAnswer | undefined): string {
  if (!a || !isAnswered(a)) return text("questions.unanswered");
  if (a.defer) return text("questions.deferred");
  const option = q.options.find((o) => o.id === a.optionId);
  return option?.label ?? a.response?.trim() ?? "";
}

/** A figure of the source that a question refers to (page image and caption). */
export interface QuestionFigure {
  src: string;
  label: string;
  caption: string;
  /** Source page, when the figure is the paper's own figure. */
  page?: number;
  /** One line on what the figure shows for this question (optional). */
  note?: string;
}

function FigurePanel({ figures }: { figures: QuestionFigure[] }) {
  const [index, setIndex] = useState(0);
  const figure = figures[Math.min(index, figures.length - 1)];
  return (
    <figure className="flex min-h-0 flex-col gap-2 rounded-none border bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={figure.src} alt={figure.label} className="max-h-[46vh] w-full rounded-md border object-contain" />
      <figcaption className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {figure.label}
          {figure.page ? ` · ${text("questions.page", { page: figure.page })}` : ""}
        </span>
        <span className="line-clamp-3 text-muted-foreground">{figure.caption}</span>
        {figure.note && <span className="text-gaid-body">{figure.note}</span>}
      </figcaption>
      {figures.length > 1 && (
        <div className="flex gap-1.5">
          {figures.map((f, i) => (
            <button
              key={`${f.page}-${f.label}`}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                i === index ? "border-primary text-gaid-link" : "text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

export function QuestionStep({
  questions,
  answers,
  onAnswer,
  onApply,
  applying,
  onOpenPage,
  recorded = {},
  figures,
  needsDraft = false,
}: {
  /** No draft exists yet: with every answer recorded (or no questions), offer to create it. */
  needsDraft?: boolean;
  /** Figures of the sources related to a question (shown beside it). */
  figures?: (question: Question) => QuestionFigure[];
  questions: Question[];
  answers: Record<string, DraftAnswer>;
  /** Answers the server already recorded; a question is sent again only when its answer differs from this. */
  recorded?: Record<string, DraftAnswer>;
  onAnswer: (questionId: string, answer: DraftAnswer) => void;
  onApply: () => void;
  applying?: boolean;
  onOpenPage?: (sourceId: string, page: number) => void;
}) {
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((q) => !isAnswered(answers[q.id]));
    return first < 0 ? questions.length : first;
  });
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  const isChanged = (q: Question) => q.id in recorded && !sameAnswer(answers[q.id], recorded[q.id]);
  const changed = questions.filter(isChanged);
  const pending = questions.filter((q) => !(q.id in recorded) || isChanged(q));
  const reviewing = index >= questions.length;
  const go = (i: number) => setIndex(Math.max(0, Math.min(questions.length, i)));

  return (
    <div className={cn("mx-auto flex h-full min-h-0 w-full flex-col gap-4", figures ? "max-w-6xl" : "max-w-2xl")}>
      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label={text("questions.title")} className="flex flex-wrap items-center gap-1.5">
          {questions.map((q, i) => {
            const done = isAnswered(answers[q.id]);
            return (
              <button
                key={q.id}
                role="tab"
                type="button"
                aria-selected={i === index}
                aria-label={text("questions.tab", { n: i + 1 })}
                onClick={() => go(i)}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-none border-b-2 border-transparent px-3 text-sm font-medium transition-colors",
                  i === index
                    ? "border-gaid-link text-gaid-link"
                    : done
                      ? "border-transparent text-gaid-body"
                      : "text-muted-foreground hover:border-foreground/30",
                )}
              >
                {done && i !== index ? <CheckIcon className="size-3.5" aria-hidden /> : null}
                {i + 1}
                {isChanged(q) && <span className="sr-only">{text("questions.changedMark")}</span>}
                {isChanged(q) && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
              </button>
            );
          })}
          <button
            role="tab"
            type="button"
            aria-selected={reviewing}
            onClick={() => go(questions.length)}
            className={cn(
              "inline-flex h-9 items-center rounded-none border-b-2 border-transparent px-3 text-sm font-medium transition-colors",
              reviewing
                ? "border-gaid-link text-gaid-link"
                : "text-muted-foreground hover:border-foreground/30",
            )}
          >
            {text("questions.review")}
          </button>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {text("questions.progress", { answered, total: questions.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {reviewing ? (
          <ReviewPanel
            questions={questions}
            answers={answers}
            changed={new Set(changed.map((q) => q.id))}
            revising={!needsDraft}
            onEdit={go}
          />
        ) : figures && figures(questions[index]).length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <FigurePanel key={`figure-${questions[index].id}`} figures={figures(questions[index])} />
            <QuestionCard
              key={questions[index].id}
              number={index + 1}
              question={questions[index]}
              recorded={questions[index].id in recorded}
              changed={isChanged(questions[index])}
              answer={answers[questions[index].id]}
              onChange={(a) => onAnswer(questions[index].id, a)}
              onOpenPage={onOpenPage}
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl">
            <QuestionCard
              key={questions[index].id}
              number={index + 1}
              question={questions[index]}
              recorded={questions[index].id in recorded}
              changed={isChanged(questions[index])}
              answer={answers[questions[index].id]}
              onChange={(a) => onAnswer(questions[index].id, a)}
              onOpenPage={onOpenPage}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeftIcon data-icon="inline-start" />
          {text("questions.prev")}
        </Button>
        {reviewing && pending.length === 0 && needsDraft ? (
          <Button onClick={onApply} disabled={applying}>
            {text("questions.makeDraft")}
          </Button>
        ) : reviewing && pending.length === 0 ? (
          <span className="text-sm text-muted-foreground">{text("questions.allApplied")}</span>
        ) : reviewing && pending.length === changed.length && !needsDraft ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {text("questions.changedCount", { count: changed.length })}
            </span>
            <Button onClick={onApply} disabled={applying}>
              {text("questions.applyChanged")}
            </Button>
          </div>
        ) : reviewing ? (
          <div className="flex items-center gap-3">
            {answered < questions.length && (
              <span className="text-sm text-muted-foreground">
                {text("questions.needAll", { count: questions.length - answered })}
              </span>
            )}
            <Button onClick={onApply} disabled={answered < questions.length || applying}>
              {text("questions.apply")}
            </Button>
          </div>
        ) : (
          <Button onClick={() => go(index + 1)}>
            {index === questions.length - 1 ? text("questions.review") : text("questions.next")}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  number,
  question,
  answer,
  onChange: change,
  onOpenPage,
  recorded,
  changed,
}: {
  number: number;
  /** The server has an answer for this question (it stays editable). */
  recorded: boolean;
  /** The shown answer differs from the recorded one. */
  changed: boolean;
  question: Question;
  answer: DraftAnswer | undefined;
  onChange: (a: DraftAnswer) => void;
  onOpenPage?: (sourceId: string, page: number) => void;
}) {
  const otherId = useId();
  const onChange = change;
  const choice = question.answerType !== "text";
  // Always offer "기타" (also for a stored choice-only question).
  const free = true;
  const evidence = question.evidence.filter((e) => e.verified && e.page);
  return (
    <section className="flex flex-col gap-4 py-1" aria-labelledby={`${otherId}-q`}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gaid-link">{text("questions.tab", { n: number })}</span>
        <h2 id={`${otherId}-q`} className="text-xl font-semibold leading-snug">
          {question.text}
        </h2>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-none bg-background px-3 py-2 text-sm">
          <dt className="font-medium text-muted-foreground">{text("questions.intent")}</dt>
          <dd>{question.reason}</dd>
          <dt className="font-medium text-muted-foreground">{text("questions.link")}</dt>
          <dd>{question.affects}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {evidence.length > 0 && (
            <Popover>
              <PopoverTrigger className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <QuoteIcon className="size-3.5" aria-hidden />
                {text("questions.evidence")}
              </PopoverTrigger>
              <PopoverContent className="w-96 text-sm leading-relaxed">
                <ul className="flex flex-col gap-3">
                  {evidence.map((e, i) => (
                    <li key={i} className="flex flex-col gap-1">
                      <q className="text-foreground">{e.quote}</q>
                      <button
                        type="button"
                        className="self-start text-gaid-link underline-offset-4 hover:underline"
                        onClick={() => onOpenPage?.(e.sourceId, e.page!)}
                      >
                        {text("questions.page", { page: e.page ?? "" })}
                      </button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {choice && (
        <div role="radiogroup" aria-labelledby={`${otherId}-q`} className="flex flex-col gap-2">
          {[...question.options]
            // The recommended option comes first (UI guide Q2); answers are stored by option id, so order is display only.
            .sort(
              (a, b) => Number(b.id === question.recommendedOptionId) - Number(a.id === question.recommendedOptionId),
            )
            .map((option) => {
              const selected = !answer?.defer && answer?.optionId === option.id;
              const recommended = question.recommendedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ optionId: option.id })}
                  className={cn(
                    "flex items-start gap-3 rounded-sm border px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                    selected && "border-gaid-link bg-accent text-accent-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {selected && <CheckIcon className="size-3.5" aria-hidden />}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {option.label}
                      {recommended && <Badge variant="secondary">{text("questions.recommended")}</Badge>}
                    </span>
                    {option.hint && <span className="text-sm text-muted-foreground">{option.hint}</span>}
                    {recommended && question.recommendedWhy && (
                      <span className="text-sm text-gaid-body">{question.recommendedWhy}</span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {free && (
        <div className="flex flex-col gap-2">
          <label htmlFor={otherId} className="text-sm font-medium">
            {choice && question.options.length ? text("questions.other") : text("questions.answer")}
          </label>
          <Textarea
            id={otherId}
            rows={2}
            placeholder={
              choice && question.options.length
                ? text("questions.otherPlaceholder")
                : text("questions.answerPlaceholder")
            }
            value={answer?.defer ? "" : (answer?.response ?? "")}
            onChange={(event) => onChange({ response: event.target.value })}
          />
        </div>
      )}

      <button
          type="button"
          onClick={() => onChange({ defer: true })}
          aria-pressed={Boolean(answer?.defer)}
          className={cn(
            "inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:underline",
            answer?.defer && "font-medium text-foreground",
          )}
        >
          <ClockIcon className="size-3.5" aria-hidden />
          {text("questions.defer")}
        </button>
      {recorded && (
        <p className={cn("text-sm", changed ? "font-medium text-gaid-link" : "text-muted-foreground")}>
          {changed ? text("questions.changedNote") : text("questions.recordedEditable")}
        </p>
      )}
    </section>
  );
}

function ReviewPanel({
  questions,
  answers,
  changed,
  revising,
  onEdit,
}: {
  questions: Question[];
  answers: Record<string, DraftAnswer>;
  changed: ReadonlySet<string>;
  /** A draft exists: applying answers revises it. */
  revising: boolean;
  onEdit: (index: number) => void;
}) {
  return (
    <section className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{text("questions.reviewTitle")}</h2>
        <p className="text-sm text-muted-foreground">{revising ? text("questions.reviewBodyRevise") : text("questions.reviewBody")}</p>
      </div>
      <ol className="flex flex-col divide-y rounded-none border">
        {questions.map((q, i) => {
          const done = isAnswered(answers[q.id]);
          return (
            <li key={q.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-muted text-xs font-semibold">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{q.text}</span>
                <span className={cn("text-sm font-medium", !done && "text-destructive")}>
                  {!done && <CircleDashedIcon className="mr-1 inline size-3.5" aria-hidden />}
                  {answerLabel(q, answers[q.id])}
                  {changed.has(q.id) && (
                    <Badge variant="outline" className="ml-2 align-middle">
                      {text("questions.changedBadge")}
                    </Badge>
                  )}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(i)}
                aria-label={text("questions.edit", { n: i + 1 })}
              >
                <ChevronRightIcon />
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
