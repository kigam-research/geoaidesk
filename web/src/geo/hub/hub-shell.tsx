"use client";
/**
 * Frame shared by every GAID hub screen: the GAID app bar (mark, 내 연구 / GAID 허브 switch, settings), then a page
 * area that fills the window so screens scroll inside their own panels, not the page.
 */
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { geoText } from "@/geo/i18n";
import { GaidAppBar } from "@/geo/shell/app-bar";
import { cn } from "@/lib/utils";

import type { GaidPlace } from "./top-nav";

const text = geoText("hub");

export function HubShell({
  onNavigate,
  onOpenSettings,
  actions,
  children,
}: {
  onNavigate: (place: GaidPlace) => void;
  onOpenSettings: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      <GaidAppBar
        place="hub"
        onNavigate={onNavigate}
        onHome={() => onNavigate("projects")}
        trailing={actions}
        onOpenSettings={onOpenSettings}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export type HubStep = "sources" | "questions" | "draft" | "publish" | "trial";

/** Title row of one authoring project: back link, title, and the four steps. */
export function ProjectBar({
  title,
  step,
  reached,
  onStep,
  onBack,
  extra,
}: {
  title: string;
  step: HubStep;
  /** Steps the project has reached (the others are disabled). */
  reached: HubStep[];
  onStep: (step: HubStep) => void;
  onBack: () => void;
  extra?: ReactNode;
}) {
  // The main path ends with registration in the hub; trying in a research project is a separate, optional view.
  const steps: HubStep[] = ["sources", "questions", "draft", "publish"];
  const currentIndex = steps.indexOf(step);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-6 py-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {text("home.back")}
      </button>
      <h1 className="min-w-0 truncate text-base font-semibold">{title}</h1>
      <nav aria-label={text("steps.label")} className="ml-auto flex items-center gap-1">
        {steps.map((s, i) => {
          const enabled = reached.includes(s);
          const done = i < currentIndex && enabled;
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <span className="h-px w-6 bg-border" aria-hidden />}
              <button
                type="button"
                disabled={!enabled}
                aria-current={s === step ? "step" : undefined}
                aria-label={
                  done
                    ? text("steps.doneLabel", { n: i + 1, name: text(`steps.${s}`) })
                    : text("steps.stepLabel", { n: i + 1, name: text(`steps.${s}`) })
                }
                onClick={() => onStep(s)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-40",
                  s === step ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-xs",
                    s === step ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                >
                  {done ? <CheckIcon className="size-3" aria-hidden /> : i + 1}
                </span>
                {text(`steps.${s}`)}
              </button>
            </div>
          );
        })}
      </nav>
      {reached.includes("trial") && (
        <button
          type="button"
          aria-current={step === "trial" ? "page" : undefined}
          onClick={() => onStep("trial")}
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-sm",
            step === "trial" ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text("steps.trialOptional")}
        </button>
      )}
      {extra}
    </div>
  );
}
