"use client";

import { useId } from "react";
import { BookOpen, Bookmark, Code2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { geoText } from "@/geo/i18n";
import {
  canCreatePreviewDraft,
  type ImplementationChoice,
  type PreviewMethodProps,
} from "@/geo/contracts/authoring-preview";

const text = geoText("previewMethod");
const choices: ImplementationChoice[] = [
  "attach-code",
  "draft-code",
  "procedure",
];

export function PreviewMethodPane({
  state,
  onEvent,
  onSourcePage,
}: PreviewMethodProps) {
  const id = useId();
  if (state.source?.kind !== "sample" || !state.exampleAnalysis) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm leading-7 text-muted-foreground">
            {text("method.sampleOnly")}
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{text("method.title")}</h2>
          <Badge variant="secondary">{text("status.prepared")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-base leading-7">
        <section
          className="rounded-lg border p-4"
          aria-labelledby={`${id}-finding`}
        >
          <h3 id={`${id}-finding`} className="font-semibold">
            {text("finding.title")}
          </h3>
          <p className="mt-2 text-muted-foreground">{text("finding.body")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onSourcePage(9)}>
              <BookOpen aria-hidden="true" />
              {text("source.page9")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onSourcePage(20)}>
              {text("source.figure6")}
            </Button>
          </div>
        </section>
        <details className="rounded-lg border p-3 text-sm leading-6">
          <summary className="cursor-pointer font-medium">
            {text("setting.details")}
            <span className="mt-1 block font-normal text-muted-foreground">{text("setting.summary")}</span>
          </summary>
        <div className="mt-3 grid gap-3 text-sm leading-6 sm:grid-cols-2">
          <section className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/30">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300">
              {text("setting.original.title")}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {text("setting.original.body")}
            </p>
          </section>
          <section className="rounded-lg bg-muted/50 p-4">
            <h3 className="font-semibold">{text("setting.new.title")}</h3>
            <p className="mt-2 text-muted-foreground">
              {text("setting.new.body")}
            </p>
          </section>
        </div>
        <section className="rounded-lg border p-3 text-sm leading-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Bookmark className="size-4" aria-hidden="true" />
            {text("purpose.title")}
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words">
            {state.purpose || text("purpose.empty")}
          </p>
        </section>
        </details>
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 font-semibold">{text("choice.title")}</legend>
          <p className="text-muted-foreground">{text("choice.description")}</p>
          {choices.map((choice) => (
            <label
              key={choice}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 dark:has-[:checked]:bg-blue-950/20"
            >
              <input
                className="mt-1 size-4 shrink-0 accent-blue-600"
                type="radio"
                name={`${id}-implementation`}
                value={choice}
                checked={state.choice === choice}
                onChange={() => onEvent({ type: "choice", value: choice })}
              />
              <span>
                <span className="block font-medium">
                  {text(`choice.${choice}.title`)}
                </span>
                <span className="block text-sm leading-6 text-muted-foreground">
                  {text(`choice.${choice}.body`)}
                </span>
              </span>
            </label>
          ))}
          {state.choice === "attach-code" && (
            <div className="space-y-2 border-t pt-3">
              <label
                htmlFor={`${id}-code`}
                className="flex items-center gap-2 font-medium"
              >
                <Code2 className="size-4" aria-hidden="true" />
                {text("attachment.code")}
              </label>
              <Input
                id={`${id}-code`}
                type="file"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file)
                    onEvent({
                      type: "attach",
                      role: "code",
                      file: { name: file.name, size: file.size },
                    });
                  event.currentTarget.value = "";
                }}
              />
              {state.code ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all">
                    {text("attachment.metadata", { ...state.code })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onEvent({ type: "remove-attachment", role: "code" })
                    }
                  >
                    {text("attachment.removeCode")}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {text("attachment.required")}
                </p>
              )}
            </div>
          )}
          {state.choice && (
            <p className="text-muted-foreground">
              {text(`choice.${state.choice}.note`)}
            </p>
          )}
          <details className="space-y-2 border-t pt-3 text-sm leading-6">
            <summary className="cursor-pointer font-medium">{text("attachment.results")}</summary>
            <label htmlFor={`${id}-results`} className="font-medium">
              {text("attachment.results")}
            </label>
            <Input
              id={`${id}-results`}
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file)
                  onEvent({
                    type: "attach",
                    role: "results",
                    file: { name: file.name, size: file.size },
                  });
                event.currentTarget.value = "";
              }}
            />
            {state.previousResults && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all">
                  {text("attachment.metadata", { ...state.previousResults })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onEvent({ type: "remove-attachment", role: "results" })
                  }
                >
                  {text("attachment.removeResults")}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {text("attachment.metadataOnly")}
            </p>
          </details>
        </fieldset>
        {state.deferred && (
          <p role="status" className="rounded-lg bg-muted p-3">
            {text("choice.deferred")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canCreatePreviewDraft(state)}
            onClick={() => onEvent({ type: "create-draft" })}
          >
            {text("method.createDraft")}
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={() => onEvent({ type: "defer" })}>
            {text("choice.defer")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
