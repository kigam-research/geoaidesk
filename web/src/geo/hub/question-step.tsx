"use client";
/**
 * One question at a time. Tabs above move between questions (and a last "답 확인" tab);
 * each question offers its options with the recommended one marked, a free-text "기타"
 * field and "나중에 정하기". Nothing is sent until the researcher applies all answers.
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

export function answerLabel(q: Question, a: DraftAnswer | undefined): string {
  if (!a || !isAnswered(a)) return text("questions.unanswered");
  if (a.defer) return text("questions.deferred");
  const option = q.options.find((o) => o.id === a.optionId);
  return option?.label ?? a.response?.trim() ?? "";
}

export function QuestionStep({
  questions,
  answers,
  onAnswer,
  onApply,
  applying,
  onOpenPage,
}: {
  questions: Question[];
  answers: Record<string, DraftAnswer>;
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
  const reviewing = index >= questions.length;
  const go = (i: number) => setIndex(Math.max(0, Math.min(questions.length, i)));

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col gap-4">
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
                  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors",
                  i === index
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "text-muted-foreground hover:border-foreground/30",
                )}
              >
                {done && i !== index ? <CheckIcon className="size-3.5" aria-hidden /> : null}
                {i + 1}
              </button>
            );
          })}
          <button
            role="tab"
            type="button"
            aria-selected={reviewing}
            onClick={() => go(questions.length)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
              reviewing ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-foreground/30",
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
          <ReviewPanel questions={questions} answers={answers} onEdit={go} />
        ) : (
          <QuestionCard
            key={questions[index].id}
            number={index + 1}
            question={questions[index]}
            answer={answers[questions[index].id]}
            onChange={(a) => onAnswer(questions[index].id, a)}
            onOpenPage={onOpenPage}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeftIcon data-icon="inline-start" />
          {text("questions.prev")}
        </Button>
        {reviewing ? (
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
  onChange,
  onOpenPage,
}: {
  number: number;
  question: Question;
  answer: DraftAnswer | undefined;
  onChange: (a: DraftAnswer) => void;
  onOpenPage?: (sourceId: string, page: number) => void;
}) {
  const otherId = useId();
  const choice = question.answerType !== "text";
  // Always offer "기타" (also for a stored choice-only question).
  const free = true;
  const evidence = question.evidence.filter((e) => e.verified && e.page);
  return (
    <section className="flex flex-col gap-5 py-2" aria-labelledby={`${otherId}-q`}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-primary">{text("questions.tab", { n: number })}</span>
        <h2 id={`${otherId}-q`} className="text-xl font-semibold leading-snug">
          {question.text}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Popover>
            <PopoverTrigger className="underline-offset-4 hover:underline">{text("questions.why")}</PopoverTrigger>
            <PopoverContent className="w-80 text-sm leading-relaxed">
              <p>{question.reason}</p>
              <p className="mt-2 text-muted-foreground">{question.affects}</p>
            </PopoverContent>
          </Popover>
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
                        className="self-start text-primary underline-offset-4 hover:underline"
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
          {question.options.map((option) => {
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
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/60",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary",
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
                    {recommended && <Badge>{text("questions.recommended")}</Badge>}
                  </span>
                  {option.hint && <span className="text-sm text-muted-foreground">{option.hint}</span>}
                  {recommended && question.recommendedWhy && (
                    <span className="text-sm text-primary/90">{question.recommendedWhy}</span>
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
            {text("questions.other")}
          </label>
          <Textarea
            id={otherId}
            rows={2}
            placeholder={text("questions.otherPlaceholder")}
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
    </section>
  );
}

function ReviewPanel({
  questions,
  answers,
  onEdit,
}: {
  questions: Question[];
  answers: Record<string, DraftAnswer>;
  onEdit: (index: number) => void;
}) {
  return (
    <section className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{text("questions.reviewTitle")}</h2>
        <p className="text-sm text-muted-foreground">{text("questions.reviewBody")}</p>
      </div>
      <ol className="flex flex-col divide-y rounded-xl border">
        {questions.map((q, i) => {
          const done = isAnswered(answers[q.id]);
          return (
            <li key={q.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{q.text}</span>
                <span className={cn("text-sm font-medium", !done && "text-destructive")}>
                  {!done && <CircleDashedIcon className="mr-1 inline size-3.5" aria-hidden />}
                  {answerLabel(q, answers[q.id])}
                </span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => onEdit(i)} aria-label={text("questions.edit", { n: i + 1 })}>
                <ChevronRightIcon />
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
