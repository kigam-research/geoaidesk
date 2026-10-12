"use client";
import { geoText, geoLocale } from "@/geo/i18n";

import { useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { notebookEntryKey, notebookTargetKey, type NotebookEntry } from "@/lib/notebook";
import type { ThreadInfo } from "@/lib/notebook-threads";

const nbText = geoText("notebook");

/** Evidence counts describe authored links, not independent experiments or truth. */
export function NotebookEvidenceSummary({ entry, thread, entries, onJump, onOpenFile }: {
  entry: NotebookEntry;
  thread?: ThreadInfo;
  entries?: ReadonlyMap<string, NotebookEntry>;
  onJump?: (key: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(50);
  const active = thread?.activeEvidence ?? [];
  const unique = (relation: string) => new Set(active.filter((x) => x.relation === relation).map((x) => x.id)).size;
  const relationsBySource = new Map<string, Set<string>>();
  for (const link of active) {
    const relations = relationsBySource.get(link.id) ?? new Set<string>();
    relations.add(link.relation);
    relationsBySource.set(link.id, relations);
  }
  const sourceIds = [...relationsBySource.keys()];
  const health = entry.artifactHealth ?? [];
  const hasChecks = health.length > 0 || Boolean(entry.artifacts?.length);
  const isClaim = entry.type === "hypothesis";
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
      {entry.provisional && <span>{nbText("evidence.provisional")}</span>}
      {thread?.reviewRequired && (
        <p className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
          <span><strong>{nbText("evidence.needs_review")}</strong> {nbText("evidence.review_description")}</span>
        </p>
      )}
      {isClaim && (
        <p>{active.some((x) => x.relation !== "context")
          ? nbText("evidence.counts", { supporting: unique("supports"), challenging: unique("challenges"), inconclusive: unique("inconclusive") })
          : nbText("evidence.awaiting")}</p>
      )}
      {Boolean(thread?.pendingEvidence) && <p>{nbText("evidence.pending", { count: thread!.pendingEvidence! })}</p>}
      {sourceIds.length > 0 && (
        <details className="rounded border px-2 py-1">
          <summary className="cursor-pointer">{nbText("evidence.inspect", { count: sourceIds.length })}</summary>
          <p className="my-1 text-[10px]">{nbText("evidence.interpretations")}</p>
          <ul className="flex flex-col gap-1">
            {sourceIds.slice(0, visibleCount).map((id) => {
              const source = entries?.get(id);
              const relations = [...relationsBySource.get(id)!].map((relation) => nbText(`relation.${relation}`)).join(", ");
              const warnings = source?.artifactHealth?.filter((h) => h.status !== "unchanged") ?? [];
              return <li key={id}>
                <button type="button" className="text-left underline decoration-dotted underline-offset-2" onClick={() => onJump?.(id)}>{relations}: {source?.title ?? id}</button>
                {warnings.length > 0 && <span className="ml-1">{nbText("evidence.artifact_warnings", { statuses: warnings.map((x) => nbText(`health.${x.status}`)).join(", ") })}</span>}
              </li>;
            })}
          </ul>
          {sourceIds.length > visibleCount && <button type="button" className="mt-2 underline" onClick={() => setVisibleCount((n) => n + 50)}>{nbText("evidence.show_more", { shown: visibleCount, total: sourceIds.length })}</button>}
        </details>
      )}
      {(entry.evidence ?? []).map((link, index) => {
        const target = notebookTargetKey(entry, link.entryId, link.sessionId);
        const found = entries?.get(target);
        return <div key={`${target}:${link.relation}:${index}`}>
          <button type="button" className="text-left underline decoration-dotted underline-offset-2" disabled={!found || target === notebookEntryKey(entry)} onClick={() => onJump?.(target)}>
            ↳ {nbText(`relation.${link.relation}`)}: {found?.title ?? link.entryId}{!found ? nbText("evidence.not_in_view") : ""}
          </button>
          {link.rationale && <p className="pl-3">{link.rationale}</p>}
        </div>;
      })}
      {Boolean(thread?.unresolvedLinks) && <p>{nbText("evidence.unresolved")}</p>}
      {entry.outcome && <p>{nbText("evidence.outcome")} <strong>{nbText(`outcome.${entry.outcome}`)}</strong>{entry.outcome === "technical-failure" ? nbText("evidence.technical_failure") : entry.outcome === "null" ? nbText("evidence.null") : ""}</p>}
      {(entry.execution || entry.type === "method") && <div>
        <p>{nbText("evidence.execution")} <strong>{nbText(`execution.${entry.execution?.status ?? "unverified"}`)}</strong> {nbText("evidence.reported_only")}</p>
        {entry.execution?.evidence && <p className="whitespace-pre-wrap">{nbText("evidence.reported", { evidence: entry.execution.evidence })}</p>}
      </div>}
      {entry.scope && <p><strong>{nbText("evidence.applies")}</strong> {entry.scope}</p>}
      {entry.revisitWhen && <p><strong>{nbText("evidence.revisit")}</strong> {entry.revisitWhen} <span>{nbText("evidence.condition")}</span></p>}
      {Boolean(entry.limitations?.length) && <div><strong>{nbText("evidence.limitations")}</strong><ul className="list-disc pl-4">{entry.limitations!.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      {hasChecks && (
        <details className="rounded border px-2 py-1">
          <summary className="cursor-pointer">{health.length ? nbText("evidence.checks", { unchanged: health.filter((h) => h.status === "unchanged").length, total: health.length }) : nbText("evidence.checks_unverified")}</summary>
          <p className="my-1 text-[10px]">{nbText("evidence.direct_files")}</p>
          {health.length === 0 && <p>{nbText("evidence.no_verification")}</p>}
          <ul className="flex flex-col gap-1">
            {health.map((h) => <li key={h.path}>
              <button type="button" className="text-left underline decoration-dotted underline-offset-2" onClick={() => onOpenFile(h.path)}>{h.path}</button>
              {" — "}<strong>{nbText(`health.${h.status}`)}</strong>
              <p>{h.reason}</p>
              <time className="text-[10px]" dateTime={new Date(h.checkedAt).toISOString()}>{nbText("evidence.checked", { when: new Date(h.checkedAt).toLocaleString(geoLocale()) })}</time>
            </li>)}
          </ul>
          {Boolean(entry.artifactHealthTruncated) && <p>{nbText("evidence.truncated", { count: entry.artifactHealthTruncated! })}</p>}
        </details>
      )}
      {isClaim && Boolean(thread?.unverifiedArtifacts) && <p>{nbText("evidence.unverified", { count: thread!.unverifiedArtifacts! })}</p>}
    </div>
  );
}
