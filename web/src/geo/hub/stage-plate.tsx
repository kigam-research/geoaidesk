/**
 * A Workflow's own analysis stages where a hub card or row has no concept picture (gaid-hub-stage-cards). The stages come
 * from the Workflow's WorkflowDoc `steps[]` (`HubWorkflowStages`); nothing is guessed from the title. Stage order is not a
 * position, so this is a plain numbered list, never a graduated scale or scale bar (UI guide v2 I10); the row readout is
 * an I11 readout plate. Role tokens only, no style branches (section 2).
 */
import type { HubWorkflowStages } from "@/geo/contracts/hub-shared";
import { geoText } from "@/geo/i18n";
import { cn } from "@/lib/utils";

import { localText } from "./text";

const text = geoText("hub");

/** First items of a list and the rest as "외 n" (`more` gets the hidden count). */
function shown<T>(items: T[], max: number): { head: T[]; rest: number } {
  return items.length > max ? { head: items.slice(0, max - 1), rest: items.length - max + 1 } : { head: items, rest: 0 };
}

/** One line for screen readers: the stage count and titles (the drawn plate is hidden from them). */
export function stagesLabel(stages: HubWorkflowStages): string {
  return text("home.stages.label", { count: stages.titles.length, list: stages.titles.map(localText).join(", ") });
}

/** Input formats → outputs, each shortened with "외 n". Empty when the Workflow names neither. */
export function stagesFlow(stages: HubWorkflowStages): string {
  const inputs = shown(stages.inputs, 3);
  const outputs = stages.outputs.map(localText).filter(Boolean);
  const from = inputs.head.join(", ") + (inputs.rest ? ` ${text("home.stages.moreItems", { count: inputs.rest })}` : "");
  const to = outputs.length > 1 ? text("home.stages.firstAndMore", { first: outputs[0], count: outputs.length - 1 }) : (outputs[0] ?? "");
  if (from && to) return text("home.stages.flow", { from, to });
  return from || to;
}

/**
 * The stage list in the picture slot of a recommended card. `max` rows at most; a longer list ends in "외 n단계". `large`
 * (the lead card) uses the body size (UI guide T1 caption vs. body).
 */
export function StagePlate({ stages, max, large, className }: { stages: HubWorkflowStages; max: number; large?: boolean; className?: string }) {
  const { head, rest } = shown(stages.titles, max);
  const flow = stagesFlow(stages);
  const row = cn("grid grid-cols-[1.25rem_minmax(0,1fr)] gap-1.5", large ? "text-sm leading-7" : "text-xs leading-5");
  return (
    <span className={cn("flex size-full flex-col justify-center bg-gaid-face-2", large ? "gap-4 px-10 py-6" : "gap-2.5 px-4 py-3", className)} aria-hidden>
      <span className="flex flex-col gap-1">
        {head.map((title, i) => (
          <span key={i} className={cn(row, "items-baseline")}>
            <span className="text-right font-semibold tabular-nums text-gaid-ink-2">{i + 1}</span>
            <span className="truncate text-gaid-ink">{localText(title)}</span>
          </span>
        ))}
        {rest > 0 && (
          <span className={row}>
            <span />
            <span className="text-gaid-ink-2">{text("home.stages.more", { count: rest })}</span>
          </span>
        )}
      </span>
      {flow && <span className={cn("line-clamp-2 text-gaid-ink-2", large ? "text-sm" : "text-xs")} title={flow}>{flow}</span>}
    </span>
  );
}

/**
 * The stage count in the thumbnail slot of a registered Workflow row without a cover (I11 readout). Hidden from screen
 * readers: the row's open button names the count (`stagesLabel`).
 */
export function StageCount({ stages }: { stages: HubWorkflowStages }) {
  return (
    <span
      className="flex size-11 flex-col items-center justify-center rounded-md border border-gaid-edge bg-gaid-face-2 text-gaid-ink"
      aria-hidden
    >
      <span className="text-sm font-semibold leading-4 tabular-nums">{stages.titles.length}</span>
      <span className="text-xs leading-4 text-gaid-ink-2">{text("home.stages.unit")}</span>
    </span>
  );
}
