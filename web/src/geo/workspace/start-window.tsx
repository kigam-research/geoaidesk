"use client";
/**
 * The one Workflow start window (gaid-workflow-start-ui; user decision 2026-10-23 "시안 및 선택 모두 권장대로 진행하자."):
 * 기본 Workflow, hub Workflows and 일반 Workflow (upstream BYOK) all open this sheet. It walks Workflow 소개 → 입력 자료 →
 * 분석 조건 → 요약 with every step named in a left step list (UI guide Q4; 920 px wide, a D2 width exception so long
 * Workflows keep readable step names). Hosts own the state and render the current step as children.
 */
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { t } from "@/geo/i18n";
import { StepList, type StepListGroup } from "@/geo/shell/step-list";

export type StartGroup = "intro" | "input" | "choice" | "summary";
export interface StartStep { group: StartGroup; label: string; done?: boolean }

const GROUPS: StartGroup[] = ["intro", "input", "choice", "summary"];

/** Where the researcher is: "Workflow 소개", "입력 자료 1 / 2", "분석 조건 3 / 8" or "요약". */
export function stepPosition(steps: StartStep[], index: number): string {
  const step = steps[index];
  if (!step) return "";
  if (step.group === "intro") return t("workspace.start.intro");
  if (step.group === "summary") return t("workspace.setup.summaryTab");
  const members = steps.flatMap((s, i) => (s.group === step.group ? [i] : []));
  return t("workspace.start.position", { group: t(`workspace.start.group.${step.group}`), n: members.indexOf(index) + 1, total: members.length });
}

/** Label of the primary action on the introduction: names the next part of the window (UI guide B3). */
export function introNextLabel(steps: StartStep[]): string {
  const next = steps[1]?.group;
  return t(next === "input" ? "workspace.start.toInputs" : next === "choice" ? "workspace.start.toChoices" : "workspace.setup.toSummary");
}

export function StartWindow({ open, onOpenChange, title, meta, purpose, steps, index, onIndex, children, error, reason, leading, actions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Source, revision and record state, one line above the title. */
  meta?: ReactNode;
  /** One line of what the Workflow does, shown above the steps after the introduction. */
  purpose?: string;
  steps: StartStep[];
  index: number;
  onIndex: (index: number) => void;
  children: ReactNode;
  error?: { message: string; detail?: string } | null;
  /** Why the primary action is disabled. */
  reason?: string | null;
  /** Footer content before the reason (e.g. deleting a saved start setting). */
  leading?: ReactNode;
  /** Footer buttons, primary last (UI guide B5). */
  actions: ReactNode;
}) {
  const groups: StepListGroup[] = GROUPS.flatMap((group) => {
    const items = steps.flatMap((step, i) => (step.group === group ? [{ index: i, label: step.label, done: step.done }] : []));
    if (!items.length) return [];
    const titled = group === "input" || group === "choice";
    return [{ title: titled ? t(`workspace.start.group.${group}`) : undefined, count: titled ? items.length : undefined, items }];
  });
  const showPurpose = Boolean(purpose) && steps[index]?.group !== "intro";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Focus the window itself on open: the first tabbable element is a step, whose focus ring read as a selection. */}
    <DialogContent className="flex h-[min(760px,85dvh)] flex-col gap-0 overflow-hidden p-0 focus-visible:outline-none sm:max-w-[920px]"
      onOpenAutoFocus={(event) => { event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus(); }}>
      <div className="space-y-1 border-b px-6 pt-4 pb-3.5">
        {meta && <div className="flex flex-wrap items-center gap-2 pr-10 text-[13px] leading-[18px] text-gaid-ink-2">{meta}</div>}
        <DialogTitle className="pr-10 text-xl leading-snug break-words">{title}</DialogTitle>
        <DialogDescription className={showPurpose ? "line-clamp-2 text-sm leading-[21px] break-words text-gaid-ink-2" : "sr-only"}>{purpose || title}</DialogDescription>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-r bg-gaid-chrome py-3.5 pr-2.5 pl-3.5">
          <StepList groups={groups} current={index} onStep={onIndex} label={t("workspace.setup.steps")}
            itemLabel={(i) => t("workspace.setup.stepLabel", { n: i + 1, name: steps[i].label })} />
        </div>
        <div className="min-h-0 overflow-y-auto px-7 pt-5 pb-6">
          <p className="sr-only" aria-live="polite">{t("workspace.setup.stepLabel", { n: index + 1, name: steps[index]?.label ?? "" })}</p>
          {children}
        </div>
      </div>
      <div className="space-y-2 border-t px-6 py-3">
        {error && <div role="alert" className="space-y-1 text-sm text-destructive"><p>{error.message}</p><TechnicalDetail detail={error.detail} /></div>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{stepPosition(steps, index)}</span>
          {leading}
          <span className="ml-auto max-w-[50%] text-right text-sm text-muted-foreground break-words">{reason}</span>
          {actions}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
