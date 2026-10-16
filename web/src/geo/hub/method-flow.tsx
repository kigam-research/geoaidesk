"use client";
/**
 * Method flow, vertical: the steps as stacked boxes on the left; the chosen step's explanation, its concept picture
 * and the shape of its inputs and outputs on the right.
 */
import { ChevronRightIcon, FileInputIcon, FileOutputIcon, UserRoundCheckIcon } from "lucide-react";
import { useState } from "react";

import type { DraftProfile, ProcedureNode } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { orderedNodes } from "./flow-diagram";
import { InputExample, ResultExample } from "./io-examples";
import { localText } from "./text";

const text = geoText("hub");

/** A picture for a step: a page of the source paper or a generated concept image. */
export interface StepVisual {
  src: string;
  kind: "paper" | "generated";
  caption: string;
}

export function MethodFlow({
  profile,
  visuals = {},
  outputImages = {},
}: {
  profile: DraftProfile;
  visuals?: Record<string, StepVisual>;
  outputImages?: Record<string, StepVisual>;
}) {
  const nodes = orderedNodes(profile.procedure.nodes, profile.procedure.edges);
  const [selected, setSelected] = useState<string>(nodes[0]?.id ?? "");
  const node = nodes.find((n) => n.id === selected) ?? nodes[0];
  return (
    <div className="grid min-h-0 gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
      <ol className="flex flex-col gap-2" aria-label={text("draft.flow")}>
        {nodes.map((n, i) => (
          <li key={n.id} className="flex flex-col items-stretch">
            <StepBox node={n} index={i} active={n.id === node?.id} onSelect={() => setSelected(n.id)} />
            {i < nodes.length - 1 && <span className="mx-auto h-2 w-px bg-border" aria-hidden />}
          </li>
        ))}
      </ol>
      {node && <StepDetail node={node} profile={profile} visual={visuals[node.id]} outputImages={outputImages} />}
    </div>
  );
}

function StepBox({ node, index, active, onSelect }: { node: ProcedureNode; index: number; active: boolean; onSelect: () => void }) {
  const gate = node.type === "human-gate" || node.type === "decision";
  const Icon = node.type === "input" ? FileInputIcon : node.type === "output" ? FileOutputIcon : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/60",
        gate && "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30",
        active && "border-primary ring-2 ring-primary/20",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 font-medium leading-snug">{localText(node.label)}</span>
      {gate && <UserRoundCheckIcon className="size-4 shrink-0 text-amber-600" aria-label={text("draft.you")} />}
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <ChevronRightIcon className={cn("size-4 shrink-0 text-muted-foreground", active && "text-primary")} aria-hidden />
    </button>
  );
}

function StepDetail({
  node,
  profile,
  visual,
  outputImages,
}: {
  node: ProcedureNode;
  profile: DraftProfile;
  visual?: StepVisual;
  outputImages: Record<string, StepVisual>;
}) {
  const gate = node.type === "human-gate" || node.type === "decision";
  const inputs = (profile.inputs ?? []).filter((p) => node.type === "input" || node.inputs?.includes(p.id));
  const outputs = profile.outputs.filter((p) => node.type === "output" || node.outputs?.includes(p.id));
  const decisions = (profile.userDecisions ?? []).filter((d) => d.at === node.id);
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4" aria-live="polite">
      <div className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          {localText(node.label)}
          {gate && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              <UserRoundCheckIcon className="size-4" aria-hidden />
              {text("draft.you")}
            </span>
          )}
        </h3>
        <p className="text-sm leading-relaxed">{localText(node.summary)}</p>
        {decisions.map((d) => (
          <p key={d.id} className="text-sm text-amber-800 dark:text-amber-300">
            {text("flow.decide", { question: localText(d.question) })}
          </p>
        ))}
        {node.checks && node.checks.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {text("draft.checks")}: {node.checks.map(localText).join(" · ")}
          </p>
        )}
      </div>
      {visual && (
        <figure className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visual.src} alt="" className="max-h-72 w-full rounded-lg border object-contain" />
          <figcaption className="text-xs text-muted-foreground">
            {visual.caption} · {visual.kind === "paper" ? text("io.paperFigure") : text("io.generated")}
          </figcaption>
        </figure>
      )}
      {(inputs.length > 0 || outputs.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {inputs.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <h4 className="text-sm font-semibold">
                {text("draft.inputs")}: {localText(p.label)}
              </h4>
              <InputExample port={p} />
            </div>
          ))}
          {outputs.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <h4 className="text-sm font-semibold">
                {text("draft.outputs")}: {localText(p.label)}
              </h4>
              <ResultExample port={p} image={outputImages[p.id]?.src} imageKind={outputImages[p.id]?.kind} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
