"use client";
/**
 * Method flow, vertical: the steps as stacked boxes on the left; the chosen step's explanation, its concept picture
 * and the shape of its inputs and outputs on the right.
 */
import { ChevronRightIcon, CircleIcon, FileInputIcon, FileOutputIcon, UserRoundCheckIcon } from "lucide-react";
import { useState } from "react";

import type { DraftProfile, ProcedureNode } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { orderedNodes } from "./flow-diagram";
import { InputExample, ResultExample } from "./io-examples";
import { shortLabel } from "./method-overview";
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
      {node && (
        <StepDetail
          node={node}
          index={nodes.indexOf(node)}
          total={nodes.length}
          profile={profile}
          visual={visuals[node.id]}
          outputImages={outputImages}
        />
      )}
    </div>
  );
}

function StepBox({
  node,
  index,
  active,
  onSelect,
}: {
  node: ProcedureNode;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const gate = node.type === "human-gate" || node.type === "decision";
  const Icon = node.type === "input" ? FileInputIcon : node.type === "output" ? FileOutputIcon : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "step" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/60",
        gate && !active && "border-[var(--gaid-warning)]/40",
        active && "border-primary bg-primary text-primary-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          active ? "bg-primary-foreground text-primary" : "bg-primary/10 text-primary",
        )}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 font-medium leading-snug">{localText(node.label)}</span>
      {gate && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
            active ? "text-primary-foreground" : "text-[var(--gaid-warning)]",
          )}
        >
          <UserRoundCheckIcon className="size-3.5" aria-hidden />
          {text("draft.you")}
        </span>
      )}
      {Icon && (
        <Icon
          className={cn("size-4 shrink-0", active ? "text-primary-foreground/80" : "text-muted-foreground")}
          aria-hidden
        />
      )}
      <ChevronRightIcon
        className={cn("size-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")}
        aria-hidden
      />
    </button>
  );
}

function StepDetail({
  node,
  index,
  total,
  profile,
  visual,
  outputImages,
}: {
  node: ProcedureNode;
  index: number;
  total: number;
  profile: DraftProfile;
  visual?: StepVisual;
  outputImages: Record<string, StepVisual>;
}) {
  const gate = node.type === "human-gate" || node.type === "decision";
  const inputs = (profile.inputs ?? []).filter((p) => node.type === "input" || node.inputs?.includes(p.id));
  const outputs = profile.outputs.filter((p) => node.type === "output" || node.outputs?.includes(p.id));
  const decisions = (profile.userDecisions ?? []).filter((d) => d.at === node.id);
  return (
    <section
      className="flex min-w-0 flex-col gap-4 self-start rounded-lg border bg-card p-4 md:sticky md:top-16"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-primary">
          {text("flow.stepOf", { n: index + 1, total })}
        </p>
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {localText(node.label)}
          {gate && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--gaid-warning)]">
              <UserRoundCheckIcon className="size-4" aria-hidden />
              {text("draft.you")}
            </span>
          )}
        </h3>
        <p className="max-w-[640px] text-sm">{localText(node.summary)}</p>
        {decisions.map((d) => (
          <p
            key={d.id}
            className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-[var(--gaid-warning)]"
          >
            <UserRoundCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {text("flow.decide", { question: localText(d.question) })}
          </p>
        ))}
        {node.checks && node.checks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground">{text("draft.checks")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {node.checks.map((c, i) => (
                <li key={i} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                  <CircleIcon className="size-3 text-primary" aria-hidden />
                  {localText(c)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {visual && (
        <figure className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visual.src} alt="" className="max-h-56 w-full rounded-lg border object-contain" />
          <figcaption className="text-xs text-muted-foreground">
            {visual.caption} · {visual.kind === "paper" ? text("io.paperFigure") : text("io.generated")}
          </figcaption>
        </figure>
      )}
      {(inputs.length > 0 || outputs.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {inputs.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <PortHeading kind="in" label={localText(p.label)} />
              <InputExample port={p} />
            </div>
          ))}
          {outputs.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <PortHeading kind="out" label={localText(p.label)} />
              <ResultExample port={p} image={outputImages[p.id]?.src} imageKind={outputImages[p.id]?.kind} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** "입력"/"결과" chip, the short port name, and its full description underneath when it differs. */
function PortHeading({ kind, label }: { kind: "in" | "out"; label: string }) {
  const short = shortLabel(label);
  return (
    <div className="flex flex-col gap-0.5">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-semibold",
            kind === "in" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
          )}
        >
          {kind === "in" ? text("draft.inputs") : text("draft.outputs")}
        </span>
        {short}
      </h4>
      {short !== label && <p className="text-xs leading-5 text-muted-foreground">{label}</p>}
    </div>
  );
}
