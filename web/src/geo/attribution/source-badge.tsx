"use client";

import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";

/** Where a skill, Workflow or template was taken from (gaid-brand-copy). */
export interface SourceAttribution {
  /** Display name of the source project, e.g. "K-Dense". */
  name: string;
  /** `owner/repo`. */
  repository: string;
  url: string;
}

/** The upstream app's built-in Workflow list and seeded prompt templates (geo/upstream.lock.json). */
export const UPSTREAM_APP_SOURCE: SourceAttribution = {
  name: "K-Dense",
  repository: "K-Dense-AI/k-dense-byok",
  url: "https://github.com/K-Dense-AI/k-dense-byok",
};

const PILL = "inline-flex h-5 items-center gap-0.5 rounded-full border border-border bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground";

/**
 * "출처: K-Dense". A link to the source unless `asText` (inside another
 * interactive element such as a row button, where a nested link is invalid).
 */
export function SourceBadge({ source, asText = false, className }: { source: SourceAttribution; asText?: boolean; className?: string }) {
  const label = t("app.attribution.source", { name: source.name });
  const title = t("app.attribution.sourceTitle", { repository: source.repository });
  if (asText) return <span className={cn(PILL, className)} title={title}>{label}</span>;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cn(PILL, "hover:bg-muted hover:text-foreground", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
      <ExternalLinkIcon className="size-2.5" aria-hidden="true" />
    </a>
  );
}
