"use client";
/**
 * Vertical step list for long one-question-at-a-time flows (UI guide v2 Q4, gaid-workflow-start-ui): every step is named in
 * full, grouped under short titles, done steps are checked and the current one is marked. 계측 draws a vertical graduated
 * scale with the index pointer; 도폭 a vertical scale bar with the current item framed in ink. Styles live in globals.css.
 */
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StepListGroup {
  /** Group title (omitted for single steps such as the introduction and the summary). */
  title?: string;
  /** Shown after the title (number of steps). */
  count?: number;
  /** `hint`: one short line under the label (what a stage holds). */
  items: { index: number; label: string; hint?: string; done?: boolean }[];
}

export function StepList({ groups, current, onStep, label, itemLabel, className }: {
  groups: StepListGroup[];
  current: number;
  onStep?: (index: number) => void;
  label: string;
  /** Accessible name of a step, e.g. "3단계: 블록 크기 산정 방식". */
  itemLabel?: (index: number) => string;
  className?: string;
}) {
  return <div role="tablist" aria-orientation="vertical" aria-label={label} className={cn("gaid-steplist flex flex-col gap-2.5", className)}>
    {groups.map((group, g) => <div key={g} role="presentation" className="flex flex-col">
      {group.title && <p className="gaid-steplist-title flex items-baseline gap-1.5 pb-0.5 pl-[18px] text-xs font-semibold text-gaid-ink-3" aria-hidden>
        {group.title}{group.count !== undefined && <span className="font-medium tabular-nums">{group.count}</span>}
      </p>}
      {group.items.map((item) => {
        const state = item.index === current ? "current" : item.done ? "done" : item.index > current ? "later" : "todo";
        return <button key={item.index} type="button" role="tab" aria-selected={item.index === current} aria-label={itemLabel?.(item.index)}
          data-state={state} disabled={!onStep} onClick={() => onStep?.(item.index)}
          className="gaid-steplist-item relative grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2 rounded-md py-1 pr-2 pl-1 text-left text-[13.5px] leading-[19px] text-gaid-ink-2 hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default">
          <span className="gaid-steplist-mark self-stretch" aria-hidden />
          <span className="min-w-0">
            <span className="line-clamp-2 break-words">
              {state === "done" && <CheckIcon className="mr-1 inline size-3.5 -translate-y-px text-gaid-success" aria-hidden />}
              {item.label}
            </span>
            {item.hint && <span className="block text-xs leading-4 font-normal text-gaid-ink-3 tabular-nums">{item.hint}</span>}
          </span>
        </button>;
      })}
    </div>)}
  </div>;
}
