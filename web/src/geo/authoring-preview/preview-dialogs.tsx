"use client";

import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { geoText } from "@/geo/i18n";
import type { PreviewMethodProps } from "@/geo/contracts/authoring-preview";

const text = geoText("previewMethod");

export function PreviewDialogs({
  state,
  onEvent,
  onSourcePage,
}: PreviewMethodProps) {
  const id = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const kind = state.dialog;
  const canPreview =
    state.choice !== "procedure" &&
    state.trialData !== null &&
    state.comparisonNote.trim().length > 0;
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(open) => {
        if (!open) onEvent({ type: "dialog", value: null });
      }}
    >
      {kind && (
        <DialogContent
          showCloseButton={false}
          className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{text(`${kind}.dialog.title`)}</DialogTitle>
            <DialogDescription>
              {text(`${kind}.dialog.description`)}
            </DialogDescription>
          </DialogHeader>
          {kind === "files" && (
            <div className="space-y-4 text-sm leading-6">
              <section className="space-y-2 rounded-lg border p-4">
                <h3 className="font-semibold">{text("files.skillFile")}</h3>
                <p>{text("files.illustration")}</p>
                <dl className="space-y-2">
                  <div>
                    <dt className="font-medium">{text("draft.titleLabel")}</dt>
                    <dd className="break-words">{state.draft?.title}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">
                      {text("draft.summaryLabel")}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words">
                      {state.draft?.summary}
                    </dd>
                  </div>
                </dl>
                <p>{text("files.skillInstructions")}</p>
                <p className="text-muted-foreground">
                  {state.choice
                    ? text(`choice.${state.choice}.note`)
                    : text("choice.unanswered")}
                </p>
              </section>
              <section className="space-y-2 rounded-lg border p-4">
                <h3 className="font-semibold">{text("files.workflowFile")}</h3>
                <p>{text("files.workflowRequest")}</p>
                <dl>
                  <dt className="font-medium">{text("purpose.title")}</dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {state.purpose || text("purpose.empty")}
                  </dd>
                </dl>
                <p>{text("files.workflowInputs")}</p>
              </section>
              <Button
                variant="outline"
                onClick={() => {
                  onEvent({ type: "dialog", value: null });
                  onSourcePage(9);
                }}
              >
                {text("source.page9")}
              </Button>
            </div>
          )}
          {kind === "trial" && (
            <div className="space-y-4 text-sm leading-6">
              <div className="space-y-2">
                <label htmlFor={`${id}-trial`} className="font-medium">
                  {text("trial.dataLabel")}
                </label>
                <Input
                  id={`${id}-trial`}
                  type="file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file)
                      onEvent({
                        type: "attach",
                        role: "trial",
                        file: { name: file.name, size: file.size },
                      });
                    event.currentTarget.value = "";
                  }}
                />
                {state.trialData && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all">
                      {text("attachment.metadata", { ...state.trialData })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onEvent({ type: "remove-attachment", role: "trial" })
                      }
                    >
                      {text("trial.removeData")}
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">
                  {text("attachment.metadataOnly")}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor={`${id}-comparison`} className="font-medium">
                  {text("trial.criteriaLabel")}
                </label>
                <Textarea
                  id={`${id}-comparison`}
                  value={state.comparisonNote}
                  placeholder={text("trial.criteriaPlaceholder")}
                  onChange={(event) =>
                    onEvent({ type: "comparison", value: event.target.value })
                  }
                />
              </div>
              {state.choice === "procedure" && (
                <p className="rounded-lg bg-muted p-3">
                  {text("trial.procedure")}
                </p>
              )}
              <Button
                disabled={!canPreview}
                onClick={() => onEvent({ type: "preview-trial-request" })}
              >
                {text("trial.previewRequest")}
              </Button>
              {state.trialRequestPreview && (
                <section
                  aria-labelledby={`${id}-request`}
                  className="space-y-3 rounded-lg border bg-muted/30 p-4"
                >
                  <h3 id={`${id}-request`} className="font-semibold">
                    {text("trial.requestTitle")}
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="font-medium">
                        {text("draft.titleLabel")}
                      </dt>
                      <dd className="break-words">{state.draft?.title}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">{text("trial.dataLabel")}</dt>
                      <dd className="break-all">{state.trialData?.name}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">
                        {text("trial.criteriaLabel")}
                      </dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {state.comparisonNote}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-muted-foreground">
                    {text("trial.requestNote")}
                  </p>
                </section>
              )}
            </div>
          )}
          {kind === "sharing" && (
            <div className="space-y-4 text-sm leading-6">
              <section className="rounded-lg border p-4">
                <h3 className="mb-2 font-semibold">
                  {text("sharing.includedTitle")}
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{text("sharing.method")}</li>
                  <li>{text("sharing.instructions")}</li>
                  <li>{text("sharing.status")}</li>
                </ul>
              </section>
              <section className="rounded-lg bg-muted/50 p-4">
                <h3 className="mb-2 font-semibold">
                  {text("sharing.excludedTitle")}
                </h3>
                <p>{text("sharing.excluded")}</p>
              </section>
              <p className="text-muted-foreground">
                {text("sharing.reviewOnly")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onEvent({ type: "dialog", value: null })}
            >
              {text("dialog.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
