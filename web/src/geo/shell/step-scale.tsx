"use client";
/**
 * Step indicator for one-question-at-a-time flows (UI guide v2 Q4): every step is named, the current one is marked,
 * earlier steps can be revisited. 계측 draws a graduated scale with a pointer over the current step; 도폭 draws a
 * cartographic scale bar (done steps solid, the current one in the signal colour). Styles live in globals.css.
 */
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ScaleStep {
  label: string;
  done?: boolean;
  disabled?: boolean;
}

export function StepScale({
  steps,
  current,
  onStep,
  label,
  className,
  tabs = false,
  itemLabel,
  numbered = true,
}: {
  steps: ScaleStep[];
  current: number;
  onStep?: (index: number) => void;
  label: string;
  className?: string;
  /** Render as a tab list (each step is a tab of the same dialog), not as navigation. */
  tabs?: boolean;
  /** Accessible name of a step, e.g. "2단계: 면적 계산 방식". */
  itemLabel?: (index: number) => string;
  /** Show the step number before the label (off when the label already carries it). */
  numbered?: boolean;
}) {
  const Root = tabs ? "div" : "nav";
  return (
    <Root aria-label={label} role={tabs ? "tablist" : undefined} className={cn("gaid-steps", className)}>
      <ol className="flex items-end" role={tabs ? "presentation" : undefined}>
        {steps.map((step, index) => {
          const state = index === current ? "current" : step.done ? "done" : "todo";
          return (
            <li key={index} className="gaid-step min-w-0 flex-1" data-state={state} role={tabs ? "presentation" : undefined}>
              <button
                type="button"
                disabled={step.disabled || !onStep}
                role={tabs ? "tab" : undefined}
                aria-selected={tabs ? index === current : undefined}
                aria-current={!tabs && index === current ? "step" : undefined}
                aria-label={itemLabel?.(index)}
                title={step.label}
                onClick={() => onStep?.(index)}
                className="block w-full min-w-0 rounded-sm pr-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
              >
                <span className="gaid-step-track" aria-hidden>
                  <span className="gaid-step-ticks" />
                </span>
                <span className="gaid-step-label">
                  {state === "done" ? <CheckIcon className="size-3.5 text-gaid-success" aria-hidden /> : numbered ? <span className="tabular-nums font-semibold">{index + 1}</span> : null}
                  <span className="truncate">{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Root>
  );
}
