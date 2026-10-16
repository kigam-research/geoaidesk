"use client";
/**
 * A method registered in the GAID hub, as other researchers see it: a hero with the title, one-line tagline, author,
 * star and "use in my research"; the method at a glance (input → steps → result); the summary as points; the steps;
 * the limits; comments (GitHub-like feedback). The registration preview shows the same page with a sticky bar.
 */
import { DownloadIcon, FolderIcon, MessageSquareIcon, SparklesIcon, StarIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DraftProfile } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { LimitsCard, OverviewBand, SummaryPoints } from "./method-overview";

const text = geoText("hub");

export interface SharedComment {
  id: string;
  author: string;
  at: string;
  body: string;
  /** Revision the comment was written on. */
  revision: number;
}

export interface SharedMethodView {
  id: string;
  title: string;
  /** One-line tagline (the hero's lead); the summary is shown as points below. */
  tagline: string;
  summary: string;
  author: string;
  /** Folder display name, or null before registration. */
  folder: string | null;
  revision: number;
  registeredAt: string;
  kind: "skill" | "workflow";
  tags: string[];
  stars: number;
  starred: boolean;
  trials: number;
  image: string | null;
  comments: SharedComment[];
}

/** Initial-letter avatar for a researcher's display name. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const palette = ["bg-sky-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-teal-600"];
  const hue = [...name].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0) % palette.length;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        palette[hue],
        className,
      )}
    >
      {[...name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function SharedMethod({
  method,
  profile,
  flow,
  onStar,
  onComment,
  onTry,
  preview,
}: {
  /** Preview before registration: how the method will look to other researchers, with the register action. */
  preview?: { onRegister: () => void; onBack: () => void };
  method: SharedMethodView;
  profile: DraftProfile;
  /** The method's step list and detail (same component as the draft view, read-only). */
  flow: ReactNode;
  onStar: () => void;
  onComment: (body: string) => void;
  onTry: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-10", !preview && "pt-6")}>
      {preview && (
        <div className="sticky -top-5 z-10 -mx-6 -mt-5 flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/95 px-6 py-3 text-sm backdrop-blur dark:border-amber-800 dark:bg-amber-950/80">
          <SparklesIcon className="size-4 text-amber-600" aria-hidden />
          <span className="min-w-0 flex-1 font-medium text-amber-900 dark:text-amber-200">
            {text("register.previewBanner")}
          </span>
          <Button variant="outline" size="sm" onClick={preview.onBack}>
            {text("register.backToDraft")}
          </Button>
          <Button size="sm" onClick={preview.onRegister}>
            {text("register.submit")}
          </Button>
        </div>
      )}

      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.09] via-background to-sky-100/60 p-6 md:px-8 md:py-7 dark:to-sky-950/30">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">
                {method.kind === "workflow" ? text("draft.workflow") : text("draft.skill")}
              </span>
              <span className="rounded-full border bg-background/80 px-2.5 py-1 text-muted-foreground">
                {text("draft.revision", { n: method.revision })}
              </span>
              {method.folder && (
                <span className="inline-flex items-center gap-1 rounded-full border bg-background/80 px-2.5 py-1 text-muted-foreground">
                  <FolderIcon className="size-3.5" aria-hidden />
                  {method.folder}
                </span>
              )}
            </div>
            <h2 className="text-3xl leading-tight font-bold tracking-tight text-balance">{method.title}</h2>
            {method.tagline && (
              <p className="max-w-3xl text-lg leading-8 text-foreground/80 text-pretty">{method.tagline}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Avatar name={method.author} />
              <span className="font-medium text-foreground">{method.author}</span>
              <span aria-hidden>·</span>
              <span>{method.registeredAt}</span>
            </div>
            {method.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {method.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-background/80 px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <nav className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm font-medium" aria-label={text("draft.flow")}>
              <a href="#method-flow" className="text-primary underline-offset-4 hover:underline">
                {text("overview.jumpFlow")}
              </a>
              {profile.limitations.length > 0 && (
                <a href="#method-limits" className="text-primary underline-offset-4 hover:underline">
                  {text("overview.jumpLimits")}
                </a>
              )}
              {!preview && (
                <a href="#shared-comments" className="text-primary underline-offset-4 hover:underline">
                  {text("overview.jumpComments", { count: method.comments.length })}
                </a>
              )}
            </nav>
          </div>
          <div className="flex flex-col gap-3">
            {method.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={method.image}
                alt=""
                className="aspect-[16/10] w-full rounded-2xl border bg-background object-cover shadow-sm"
              />
            )}
            <Button size="lg" variant={preview ? "outline" : "default"} onClick={onTry} className="w-full">
              <DownloadIcon data-icon="inline-start" />
              {text("shared.try")}
            </Button>
            <div className="flex items-stretch overflow-hidden rounded-md border bg-background">
              <button
                type="button"
                onClick={onStar}
                disabled={Boolean(preview)}
                aria-pressed={method.starred}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <StarIcon className={cn("size-4", method.starred && "fill-amber-400 text-amber-500")} aria-hidden />
                {method.starred ? text("shared.starred") : text("shared.star")}
              </button>
              <span className="flex items-center border-l px-3 text-sm font-semibold tabular-nums">{method.stars}</span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {preview ? text("shared.afterRegister") : text("shared.trials", { count: method.trials })}
            </p>
          </div>
        </div>
      </header>

      <OverviewBand profile={profile} />
      <SummaryPoints summary={method.summary} />

      <section id="method-flow" className="flex scroll-mt-20 flex-col gap-3" aria-label={text("draft.flow")}>
        <h3 className="text-lg font-semibold">{text("draft.flow")}</h3>
        {flow}
      </section>

      <LimitsCard profile={profile} />

      <section
        className="flex scroll-mt-20 flex-col gap-4"
        id="shared-comments-section"
        aria-labelledby="shared-comments"
      >
        <h3 id="shared-comments" className="flex scroll-mt-20 items-center gap-2 text-lg font-semibold">
          <MessageSquareIcon className="size-5" aria-hidden />
          {text("shared.comments", { count: method.comments.length })}
        </h3>
        <ul className="flex max-w-4xl flex-col gap-3">
          {method.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author} className="mt-1 size-8" />
              <div className="min-w-0 flex-1 overflow-hidden rounded-xl border">
                <p className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-semibold">{c.author}</span>
                  <span className="text-xs text-muted-foreground">{c.at}</span>
                  <span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {text("draft.revision", { n: c.revision })}
                  </span>
                </p>
                <p className="px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        {preview ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {text("shared.afterRegister")}
          </p>
        ) : (
          <div className="flex max-w-4xl flex-col gap-2 rounded-xl border p-3">
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={text("shared.commentPlaceholder")}
            />
            <Button
              className="self-end"
              disabled={!draft.trim()}
              onClick={() => {
                onComment(draft.trim());
                setDraft("");
              }}
            >
              {text("shared.comment")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
