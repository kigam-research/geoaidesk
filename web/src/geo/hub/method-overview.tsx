"use client";
/**
 * The method at a glance, built from the draft profile instead of one long paragraph: an input → steps → result band,
 * the summary as a lead sentence and short points, and the limits as a separate card. Used on the shared page, the
 * registration preview and the draft.
 */
import {
  ArrowRightIcon,
  FileInputIcon,
  FileOutputIcon,
  ListOrderedIcon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { DraftProfile } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { localText } from "./text";

const text = geoText("hub");

/** A port label without its parenthesised detail ("격자 표 (TMX/TMY …)" → "격자 표"); the detail stays in the tooltip. */
export function shortLabel(label: string): string {
  const cut = label
    .replace(/\s*[(（][^)）]*[)）]\s*/g, " ")
    .split(/\s+[—–-]\s+|:\s/u)[0]
    .trim();
  return cut || label;
}

/** Sentences of a summary (Korean or English); short fragments stay with the previous sentence. */
export function summarySentences(summary: string): string[] {
  const parts = summary
    .split(/(?<=[.!?。])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (out.length > 0 && p.length < 12) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}

/** Input → steps → result, with counts of the steps and of the places where the researcher decides. */
export function OverviewBand({ profile, doc }: { profile: DraftProfile; doc?: import("@/geo/contracts/workflow-doc").WorkflowDoc | null }) {
  const inputs = (profile.inputs ?? []).map((p) => ({
    label: localText(p.label),
    tag: text(p.required ? "overview.required" : "overview.optional"),
  }));
  const outputs = profile.outputs.map((p) => ({ label: localText(p.label) }));
  const steps = doc ? doc.steps.length : profile.procedure.nodes.length;
  const gates = doc ? doc.steps.filter((step) => step.choiceIds.length > 0).length : profile.procedure.nodes.filter((n) => n.type === "human-gate" || n.type === "decision").length;
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)] md:items-stretch">
      <BandCell icon={<FileInputIcon className="size-4" aria-hidden />} title={text("overview.in")} items={inputs} />
      <BandArrow />
      <div className="flex flex-col justify-center gap-2 border-y border-border bg-transparent py-4">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ListOrderedIcon className="size-4 text-gaid-link" aria-hidden />
          {text("overview.process")}
        </p>
        <p className="text-xl font-semibold">{text("overview.steps", { count: steps })}</p>
        {gates > 0 && (
          <p className="inline-flex items-center gap-2 text-sm text-[var(--gaid-warning)]">
            <UserRoundCheckIcon className="size-4" aria-hidden />
            {text("overview.gates", { count: gates })}
          </p>
        )}
      </div>
      <BandArrow />
      <BandCell icon={<FileOutputIcon className="size-4" aria-hidden />} title={text("overview.out")} items={outputs} />
    </div>
  );
}

function BandArrow() {
  return (
    <span className="hidden items-center justify-center text-muted-foreground md:flex" aria-hidden>
      <ArrowRightIcon className="size-4" />
    </span>
  );
}

function BandCell({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  /** `tag`: a short qualifier after the label (필수/선택 for inputs). */
  items: { label: string; tag?: string }[];
}) {
  const shown = items.slice(0, 4);
  return (
    <div className="flex flex-col gap-2 border-y border-border bg-transparent py-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-gaid-link">{icon}</span>
        {title}
      </p>
      <ul className="flex flex-col gap-1">
        {shown.map((item, i) => (
          <li key={i} title={item.label} className="flex items-start gap-2 text-sm font-medium">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            <span className="line-clamp-1 min-w-0">{shortLabel(item.label)}</span>
            {item.tag && <span className="shrink-0 text-xs font-normal text-muted-foreground">{item.tag}</span>}
          </li>
        ))}
        {items.length > shown.length && (
          <li className="text-xs text-muted-foreground">
            {text("overview.more", { count: items.length - shown.length })}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * The summary as a lead sentence; the other sentences open with "방법 소개 더 보기" (UI guide P3, W5), at a readable
 * measure (T4).
 */
export function SummaryPoints({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  const sentences = summarySentences(summary);
  if (sentences.length === 0) return null;
  const [lead, ...rest] = sentences;
  return (
    <section className="flex max-w-[640px] flex-col gap-2" aria-labelledby="method-about">
      <h3 id="method-about" className="text-base font-semibold">
        {text("overview.about")}
      </h3>
      <p className="text-sm">{lead}</p>
      {rest.length > 0 && open && (
        <ul className="flex flex-col gap-1">
          {rest.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="self-start text-sm text-gaid-link underline-offset-4 hover:underline"
        >
          {open ? text("overview.aboutLess") : text("overview.aboutMore")}
        </button>
      )}
    </section>
  );
}

/** Limits: never shortened (a limit is not cut), each marked "적용하지 않음" or "조건"; the first three shown. */
export function LimitsCard({ profile }: { profile: DraftProfile }) {
  const [open, setOpen] = useState(false);
  const items = profile.limitations
    .map((l) => ({ kind: l.kind, text: localText(l.text), alternative: localText(l.alternative) }))
    .filter((l) => l.text);
  if (items.length === 0) return null;
  const shown = open ? items : items.slice(0, 3);
  return (
    <section
      id="method-limits"
      className="flex scroll-mt-20 flex-col gap-3 border-y border-border bg-transparent py-4"
      aria-label={text("draft.limits")}
    >
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <TriangleAlertIcon className="size-4 text-[var(--gaid-warning)]" aria-hidden />
        {text("overview.limits", { count: items.length })}
      </h3>
      <ul className="flex max-w-[640px] flex-col gap-2">
        {shown.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={cn(
                "shrink-0 rounded border px-1 text-xs font-medium",
                item.kind === "not-for"
                  ? "border-[var(--gaid-danger)]/40 text-[var(--gaid-danger)]"
                  : "border-[var(--gaid-warning)]/40 text-[var(--gaid-warning)]",
              )}
            >
              {item.kind === "not-for" ? text("overview.notFor") : text("overview.condition")}
            </span>
            <span>
              {item.text}
              {item.alternative && (
                <span className="block text-sm text-muted-foreground">
                  {text("overview.instead", { alternative: item.alternative })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="self-start text-sm text-gaid-link underline-offset-4 hover:underline"
        >
          {open ? text("draft.showLess") : text("draft.showAll", { count: items.length })}
        </button>
      )}
    </section>
  );
}
