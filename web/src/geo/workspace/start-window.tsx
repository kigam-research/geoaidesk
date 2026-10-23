"use client";
/**
 * The one Workflow start window (gaid-workflow-start-ui; user decision 2026-10-23 "시안 및 선택 모두 권장대로 진행하자."):
 * 기본 Workflow, hub Workflows and 일반 Workflow (upstream BYOK) all open this sheet. It walks Workflow 소개 → one page per
 * analysis-flow stage (gaid-workflow-stages: every input and condition of the stage on one page; older Workflows "입력
 * 자료" and "분석 조건") → 요약, every entry named in a left step list (UI guide Q4; at most 7 entries; 920 px wide, a D2
 * width exception so stage names stay readable). Hosts own the state and render the current page as children.
 */
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { t } from "@/geo/i18n";
import { StepList, type StepListGroup } from "@/geo/shell/step-list";

export type StartGroup = "intro" | "stage" | "summary";
export interface StartStep {
  group: StartGroup;
  label: string;
  /** What the stage holds ("자료 2개 · 조건 3개"), one line under the label. */
  hint?: string;
  done?: boolean;
}

const GROUPS: StartGroup[] = ["intro", "stage", "summary"];

/** Where the researcher is: "Workflow 소개", "분석 단계 2 / 4" (flow) or "시작 설정 1 / 2" (grouped), or "요약". */
export function stepPosition(steps: StartStep[], index: number, flow: boolean): string {
  const step = steps[index];
  if (!step) return "";
  if (step.group === "intro") return t("workspace.start.intro");
  if (step.group === "summary") return t("workspace.setup.summaryTab");
  const members = steps.flatMap((s, i) => (s.group === "stage" ? [i] : []));
  return t("workspace.start.position", { group: t(flow ? "workspace.start.group.stage" : "workspace.start.group.settings"), n: members.indexOf(index) + 1, total: members.length });
}

/** Label of the primary action on the introduction: names what the first page asks for (UI guide B3). */
export function introNextLabel(first: "input" | "choice" | null): string {
  return t(first === "input" ? "workspace.start.toInputs" : first === "choice" ? "workspace.start.toChoices" : "workspace.setup.toSummary");
}

export function StartWindow({ open, onOpenChange, title, meta, purpose, steps, flow = false, index, onIndex, children, error, reason, leading, actions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Source, revision and record state, one line above the title. */
  meta?: ReactNode;
  /** What the Workflow does, one truncated line above the steps after the introduction (W6). */
  purpose?: string;
  steps: StartStep[];
  /** The stage pages follow the Workflow's analysis flow (titled "분석 단계" in the step list). */
  flow?: boolean;
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
    const items = steps.flatMap((step, i) => (step.group === group ? [{ index: i, label: step.label, hint: step.hint, done: step.done }] : []));
    if (!items.length) return [];
    const titled = group === "stage" && flow;
    return [{ title: titled ? t("workspace.start.group.stage") : undefined, count: titled ? items.length : undefined, items }];
  });
  const showPurpose = Boolean(purpose) && steps[index]?.group !== "intro";
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Focus the window itself on open: the first tabbable element is a step, whose focus ring read as a selection. */}
    <DialogContent className="flex h-[min(760px,85dvh)] flex-col gap-0 overflow-hidden p-0 focus-visible:outline-none sm:max-w-[920px]"
      onOpenAutoFocus={(event) => { event.preventDefault(); (event.currentTarget as HTMLElement | null)?.focus(); }}>
      <div className="space-y-1 border-b px-6 pt-4 pb-3.5">
        {meta && <div className="flex flex-wrap items-center gap-2 pr-10 text-[13px] leading-[18px] text-gaid-ink-2">{meta}</div>}
        <DialogTitle className="pr-10 text-xl leading-snug break-words">{title}</DialogTitle>
        {/* One line of context under the title (W6); the full purpose is on Workflow 소개 and in the tooltip. */}
        <DialogDescription className={showPurpose ? "truncate text-sm leading-[21px] text-gaid-ink-2" : "sr-only"} title={showPurpose ? purpose : undefined}>{purpose || title}</DialogDescription>
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
          <span className="text-sm text-muted-foreground tabular-nums">{stepPosition(steps, index, flow)}</span>
          {leading}
          <span className="ml-auto max-w-[50%] text-right text-sm text-muted-foreground break-words">{reason}</span>
          {actions}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
