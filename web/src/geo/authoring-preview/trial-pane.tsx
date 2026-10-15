"use client";

import { useId } from "react";
import {
  BookOpen,
  FileText,
  FlaskConical,
  FolderOpen,
  Save,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { geoText } from "@/geo/i18n";
import type { PreviewMethodProps } from "@/geo/contracts/authoring-preview";

const text = geoText("previewMethod");

export function PreviewTrialPane({
  state,
  onEvent,
  onSourcePage,
}: PreviewMethodProps) {
  const id = useId();
  if (!state.draft)
    return (
      <p className="p-6 text-sm text-muted-foreground">{text("draft.empty")}</p>
    );
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <Card className="min-w-0 shadow-none">
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{text("status.private")}</Badge>
            <Badge variant="outline">{text("status.untested")}</Badge>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-title`} className="text-sm font-medium">
              {text("draft.titleLabel")}
            </label>
            <Input
              id={`${id}-title`}
              value={state.draft.title}
              onChange={(event) =>
                onEvent({
                  type: "edit-draft",
                  field: "title",
                  value: event.target.value,
                })
              }
              className="h-auto py-3 text-lg font-semibold md:text-xl"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-summary`} className="text-sm font-medium">
              {text("draft.summaryLabel")}
            </label>
            <Textarea
              id={`${id}-summary`}
              value={state.draft.summary}
              onChange={(event) =>
                onEvent({
                  type: "edit-draft",
                  field: "summary",
                  value: event.target.value,
                })
              }
              className="min-h-24 text-base leading-7"
            />
          </div>
          <section className="space-y-2 border-t pt-5">
            <h2 className="font-semibold">{text("draft.scopeTitle")}</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {state.purpose || text("purpose.empty")}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {state.choice
                ? text(`choice.${state.choice}.title`)
                : text("choice.unanswered")}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEvent({ type: "step", step: "method" })}
            >
              {text("draft.editChoice")}
            </Button>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">{text("plan.title")}</h2>
            <ol className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {[1, 2, 3, 4].map((number) => (
                <li key={number} className="rounded-lg border bg-muted/30 p-3">
                  <span
                    aria-hidden="true"
                    className="mb-2 inline-flex size-6 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700"
                  >
                    {number}
                  </span>
                  <h3 className="text-sm font-medium">
                    {text(`plan.${number}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {text(`plan.${number}.body`)}
                  </p>
                </li>
              ))}
            </ol>
            {state.choice === "procedure" && (
              <p className="text-sm text-muted-foreground">
                {text("choice.procedure.note")}
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">{text("contents.title")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <FileText
                  aria-hidden="true"
                  className="mb-2 size-5 text-blue-600"
                />
                <h3 className="font-medium">{text("contents.skill.title")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {text("contents.skill.body")}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <FolderOpen
                  aria-hidden="true"
                  className="mb-2 size-5 text-blue-600"
                />
                <h3 className="font-medium">
                  {text("contents.workflow.title")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {text("contents.workflow.body")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => onEvent({ type: "dialog", value: "files" })}
            >
              {text("contents.openFiles")}
            </Button>
          </section>
          <section className="space-y-2 rounded-lg bg-muted/50 p-4">
            <h2 className="font-semibold">{text("outputs.title")}</h2>
            <p className="text-sm leading-6">{text("outputs.body")}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {text("outputs.note")}
            </p>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onSourcePage(9)}>
              <BookOpen aria-hidden="true" />
              {text("source.page9")}
            </Button>
            <Button onClick={() => onEvent({ type: "save" })}>
              <Save aria-hidden="true" />
              {text("draft.save")}
            </Button>
          </div>
          {state.savedAt && (
            <p role="status" className="text-sm text-muted-foreground">
              {text("draft.saved", { time: state.savedAt })}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="h-fit shadow-none">
        <CardContent className="space-y-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FlaskConical aria-hidden="true" className="size-5 text-blue-600" />
            {text("trial.title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {text("trial.description")}
          </p>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg bg-muted/50 p-5 text-center">
            <FlaskConical
              aria-hidden="true"
              className="size-10 text-slate-400"
            />
            <p className="font-medium">{text("trial.notRun")}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => onEvent({ type: "dialog", value: "trial" })}
          >
            {text("trial.open")}
          </Button>
          <div className="border-t pt-5">
            <Button
              variant="outline"
              className="h-auto w-full whitespace-normal py-3"
              onClick={() => onEvent({ type: "dialog", value: "sharing" })}
            >
              <Share2 aria-hidden="true" />
              {text("sharing.open")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
