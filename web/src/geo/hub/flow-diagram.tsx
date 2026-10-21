"use client";
/**
 * Method flow drawn from the draft's `procedure` (nodes in edge order). Each step is a
 * small card: number, label, one-line summary; steps where the researcher decides carry
 * a "직접 정함" mark. Steps wrap into rows so the diagram never needs page scrolling.
 */
import { ArrowRightIcon, FileInputIcon, FileOutputIcon, UserRoundCheckIcon } from "lucide-react";

import type { ProcedureEdge, ProcedureNode } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { localText } from "./text";

const text = geoText("hub");

/** Nodes in flow order: follow `next` edges from the first node without an incoming edge. */
export function orderedNodes(nodes: ProcedureNode[], edges: ProcedureEdge[]): ProcedureNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = new Map<string, string>();
  const incoming = new Set<string>();
  for (const e of edges) {
    if (e.relation !== "next" || !byId.has(e.from) || !byId.has(e.to)) continue;
    if (!next.has(e.from)) next.set(e.from, e.to);
    incoming.add(e.to);
  }
  const out: ProcedureNode[] = [];
  const seen = new Set<string>();
  let cur = nodes.find((n) => !incoming.has(n.id))?.id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(byId.get(cur)!);
    cur = next.get(cur);
  }
  for (const n of nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

export function FlowDiagram({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: ProcedureNode[];
  edges: ProcedureEdge[];
  selected?: string | null;
  onSelect?: (id: string) => void;
}) {
  const ordered = orderedNodes(nodes, edges);
  return (
    <ol
      className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-x-6 gap-y-4"
      aria-label={text("draft.flow")}
    >
      {ordered.map((node, index) => {
        const gate = node.type === "human-gate" || node.type === "decision";
        const Icon = node.type === "input" ? FileInputIcon : node.type === "output" ? FileOutputIcon : null;
        return (
          <li key={node.id} className="relative">
            <button
              type="button"
              onClick={() => onSelect?.(node.id)}
              aria-pressed={selected === node.id}
              className={cn(
                "flex h-full w-full flex-col gap-1.5 border-b bg-transparent p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                gate && "border-border bg-gaid-pending-bg",
                selected === node.id && "border-gaid-link bg-accent text-accent-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-accent text-xs font-semibold text-gaid-link">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold leading-tight">{localText(node.label)}</span>
                {Icon && <Icon className="ml-auto size-4 text-muted-foreground" aria-hidden />}
              </span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {localText(node.summary)}
              </span>
              {gate && (
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-gaid-warning">
                  <UserRoundCheckIcon className="size-3.5" aria-hidden />
                  {text("draft.you")}
                </span>
              )}
            </button>
            {index < ordered.length - 1 && (
              <ArrowRightIcon
                className="absolute top-1/2 -right-5 size-4 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
