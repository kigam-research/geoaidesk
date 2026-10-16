"use client";
/**
 * The method at a glance, built from the draft profile instead of one long paragraph: an input → steps → result band,
 * the summary as a lead sentence and short points, and the limits as a separate card. Used on the shared page, the
 * registration preview and the draft.
 */
import {
  ArrowRightIcon,
  CheckIcon,
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
export function OverviewBand({ profile }: { profile: DraftProfile }) {
  const inputs = (profile.inputs ?? []).map((p) => localText(p.label));
  const outputs = profile.outputs.map((p) => localText(p.label));
  const steps = profile.procedure.nodes.length;
  const gates = profile.procedure.nodes.filter((n) => n.type === "human-gate" || n.type === "decision").length;
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)] md:items-stretch">
      <BandCell
        icon={<FileInputIcon className="size-4" aria-hidden />}
        title={text("overview.in")}
        tone="sky"
        items={inputs}
      />
      <BandArrow />
      <div className="flex flex-col justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
          <ListOrderedIcon className="size-4" aria-hidden />
          {text("overview.process")}
        </p>
        <p className="text-2xl font-bold tracking-tight">{text("overview.steps", { count: steps })}</p>
        {gates > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <UserRoundCheckIcon className="size-4" aria-hidden />
            {text("overview.gates", { count: gates })}
          </p>
        )}
      </div>
      <BandArrow />
      <BandCell
        icon={<FileOutputIcon className="size-4" aria-hidden />}
        title={text("overview.out")}
        tone="emerald"
        items={outputs}
      />
    </div>
  );
}

function BandArrow() {
  return (
    <span className="hidden items-center justify-center text-muted-foreground/60 md:flex" aria-hidden>
      <ArrowRightIcon className="size-5" />
    </span>
  );
}

const TONES = {
  sky: "border-sky-200 bg-sky-50/70 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300",
  emerald:
    "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
} as const;

function BandCell({
  icon,
  title,
  tone,
  items,
}: {
  icon: ReactNode;
  title: string;
  tone: keyof typeof TONES;
  items: string[];
}) {
  const shown = items.slice(0, 4);
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border p-4", TONES[tone])}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
        {icon}
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {shown.map((item, i) => (
          <li key={i} title={item} className="flex items-start gap-2 text-sm font-medium text-foreground">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
            <span className="line-clamp-1">{shortLabel(item)}</span>
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

/** The summary as a lead sentence and checked points (instead of one paragraph). */
export function SummaryPoints({ summary }: { summary: string }) {
  const sentences = summarySentences(summary);
  if (sentences.length === 0) return null;
  const [lead, ...rest] = sentences;
  return (
    <section className="flex flex-col gap-3" aria-label={text("overview.about")}>
      <h3 className="text-sm font-semibold text-muted-foreground">{text("overview.about")}</h3>
      <p className="max-w-4xl text-[15px] leading-7 text-foreground">{lead}</p>
      {rest.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {rest.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-sm leading-6">
              <CheckIcon className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Limits: never shortened (a limit is not cut), the first three shown, the rest behind "모두 보기". */
export function LimitsCard({ profile }: { profile: DraftProfile }) {
  const [open, setOpen] = useState(false);
  const items = profile.limitations.map((l) => localText(l.text)).filter(Boolean);
  if (items.length === 0) return null;
  const shown = open ? items : items.slice(0, 3);
  return (
    <section
      className="flex flex-col gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20"
      aria-label={text("draft.limits")}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <TriangleAlertIcon className="size-4" aria-hidden />
        {text("overview.limits", { count: items.length })}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm leading-6">
        {shown.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="self-start text-xs font-medium text-amber-800 underline-offset-4 hover:underline dark:text-amber-300"
        >
          {open ? text("draft.showLess") : text("draft.showAll", { count: items.length })}
        </button>
      )}
    </section>
  );
}
