"use client";
/**
 * A method another researcher registered in the GAID hub: what it does, its steps, who made it, stars and comments
 * (GitHub-like feedback). Mockup stage: data comes from the caller.
 */
import { DownloadIcon, MessageSquareIcon, StarIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

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
  summary: string;
  author: string;
  folder: string;
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

export function SharedMethod({
  method,
  flow,
  onStar,
  onComment,
  onTry,
  preview,
}: {
  /** Preview before registration: how the method will look to other researchers, with the register action. */
  preview?: { onRegister: () => void; onBack: () => void };
  method: SharedMethodView;
  /** The method's step list and detail (same component as the draft view, read-only). */
  flow: ReactNode;
  onStar: () => void;
  onComment: (body: string) => void;
  onTry: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
      {preview && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          <span className="min-w-0 flex-1">{text("register.previewBanner")}</span>
          <Button variant="outline" onClick={preview.onBack}>
            {text("register.backToDraft")}
          </Button>
          <Button onClick={preview.onRegister}>{text("register.submit")}</Button>
        </div>
      )}
      <header className="flex flex-col gap-4 md:flex-row md:items-start">
        {method.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={method.image} alt="" className="aspect-[3/2] w-full rounded-xl border object-cover md:w-64" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{method.title}</h2>
            <Badge variant="secondary">{method.kind === "workflow" ? "Workflow" : text("draft.skill")}</Badge>
            <span className="text-xs text-muted-foreground">{text("draft.revision", { n: method.revision })}</span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{method.summary}</p>
          <p className="text-sm">
            {text("shared.by", { author: method.author, folder: method.folder, when: method.registeredAt })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {method.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:items-end">
          <div className="flex items-center gap-2">
            <Button variant={method.starred ? "default" : "outline"} onClick={onStar} aria-pressed={method.starred}>
              <StarIcon data-icon="inline-start" className={cn(method.starred && "fill-current")} />
              {method.starred ? text("shared.starred") : text("shared.star")}
              <span className="ml-1 rounded bg-background/20 px-1.5 text-xs">{method.stars}</span>
            </Button>
            <Button variant={preview ? "outline" : "default"} onClick={onTry}>
              <DownloadIcon data-icon="inline-start" />
              {text("shared.try")}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">{text("shared.trials", { count: method.trials })}</span>
          {method.comments.length > 0 && (
            <a href="#shared-comments" className="text-sm text-primary underline-offset-4 hover:underline">
              {text("shared.toComments", { count: method.comments.length })}
            </a>
          )}
        </div>
      </header>

      <section aria-label={text("draft.flow")}>{flow}</section>

      <section className="flex flex-col gap-3" aria-labelledby="shared-comments">
        <h3 id="shared-comments" className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquareIcon className="size-5" aria-hidden />
          {text("shared.comments", { count: method.comments.length })}
        </h3>
        <ul className="flex flex-col gap-3">
          {method.comments.map((c) => (
            <li key={c.id} className="rounded-xl border p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{c.author}</span>
                <span className="text-xs text-muted-foreground">
                  {c.at} · {text("draft.revision", { n: c.revision })}
                </span>
              </p>
              <p className="mt-1 text-sm leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 rounded-xl border p-3">
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
      </section>
    </div>
  );
}
