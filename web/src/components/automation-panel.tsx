"use client";
import { geoLocale, geoText } from "@/geo/i18n";
import { workLabel } from "@/geo/work-labels";
import { SubagentFleetPanel } from "./subagent-fleet-panel";

/**
 * Project "Automation" tab: pi-subagents durable schedules (recurring or
 * one-shot specialist runs that fire from Kady's resident session, even with
 * no chat tab open) and missions (durable records of delegated work).
 * Schedules are created conversationally ("run the QC pipeline every 6h");
 * this panel shows and controls them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlagIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  closeMission,
  getMissions,
  getSchedules,
  scheduleAction,
  type MissionView,
  type ScheduleAction,
  type ScheduleView,
} from "@/lib/automation";
import { cn, formatUsd } from "@/lib/utils";
import { SettingsLink } from "@/components/settings-link";

const workText = geoText("work");

function describeTrigger(trigger: ScheduleView["trigger"], paused = false): string {
  if (trigger.kind === "interval") {
    const next = trigger.nextRunAt && !paused ? workText("automation_panel.trigger_next", { time: new Date(trigger.nextRunAt).toLocaleString(geoLocale()) }) : "";
    return workText("automation_panel.trigger_interval", { every: trigger.every, next });
  }
  return workText("automation_panel.trigger_once", { time: new Date(trigger.nextRunAt ?? trigger.at).toLocaleString(geoLocale()) });
}

const POLL_MS = 10_000;

const RUN_STATE_LABEL: Record<ScheduleView["runs"][number]["state"], string> = {
  running: workText("automation_panel.running"),
  skipped: workText("automation_panel.skipped_overlap"),
  missed: workText("automation_panel.missed"),
  completed: workText("automation_panel.completed"),
  failed_launch: workText("automation_panel.failed_to_launch"),
  failed_run: workText("automation_panel.failed"),
};

/** pi-subagents redacts prompt-derived titles; name the run by its specialists instead. */
const REDACTED = "[prompt redacted]";
function missionLabel(m: MissionView): string {
  if (m.title && m.title !== REDACTED) return m.title;
  const agents = [...new Set(m.runs.map((r) => r.agent).filter((a): a is string => Boolean(a)))];
  return agents.length > 0 ? workText("automation_panel.value_run", { v0: agents.join(", ") }) : workText("automation_panel.delegated_run");
}

export function AutomationPanel({ projectId }: { projectId: string }) {
  const [schedules, setSchedules] = useState<ScheduleView[]>([]);
  const [missions, setMissions] = useState<MissionView[]>([]);
  const [heldByBudget, setHeldByBudget] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const { confirm, dialog } = useConfirm();

  const refresh = useCallback(async () => {
    // Schedules and missions come from different stores; one failing must not
    // hide the other.
    const [s, m] = await Promise.allSettled([getSchedules(projectId), getMissions(projectId)]);
    if (s.status === "fulfilled") {
      setSchedules(s.value.schedules);
      setHeldByBudget(s.value.heldByBudget);
    }
    if (m.status === "fulfilled") setMissions(m.value);
    const failures = [s, m].flatMap((r) =>
      r.status === "rejected" ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : [],
    );
    setError(failures.length > 0 ? failures.join(" · ") : null);
    setLoaded(true);
  }, [projectId]);

  useEffect(() => {
    setLoaded(false);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const act = useCallback(
    async (schedule: ScheduleView, action: ScheduleAction) => {
      if (action === "delete") {
        const ok = await confirm({
          title: workText("automation_panel.confirm.delete_schedule", { v0: schedule.name }),
          description: workText("automation_panel.its_definition_and_run_history_are_removed_runs_already_in_progress_finish_normally"),
          confirmLabel: workText("automation_panel.delete"),
          destructive: true,
        });
        if (!ok) return;
      }
      setBusy(`${action}:${schedule.id}`);
      setError(null);
      setNotice(null);
      try {
        const result = await scheduleAction(schedule.id, action, projectId);
        setSchedules(result.schedules);
        // Only a manual fire has news worth reading (started, or skipped as an overlap).
        if (action === "run" && result.message) setNotice(result.message.split("\n")[0]);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : workText("automation_panel.could_not_value_the_schedule", { v0: workLabel("schedule_action", action) }));
      } finally {
        setBusy(null);
      }
    },
    [confirm, projectId],
  );

  const close = useCallback(
    async (mission: MissionView) => {
      const ok = await confirm({
        title: workText("automation_panel.confirm.close_mission", { v0: missionLabel(mission) }),
        description: workText("automation_panel.marks_it_cancelled_linked_runs_are_not_stopped"),
        confirmLabel: workText("automation_panel.close_mission"),
      });
      if (!ok) return;
      setBusy(`close:${mission.id}`);
      try {
        setMissions(await closeMission(mission.id, projectId));
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : workText("automation_panel.could_not_close_the_mission"));
      } finally {
        setBusy(null);
      }
    },
    [confirm, projectId],
  );

  // "Run started" goes stale as soon as the row's own state catches up.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 10_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openMissions = useMemo(() => missions.filter((m) => !["completed", "failed", "cancelled"].includes(m.status)), [missions]);
  const closedMissions = useMemo(() => missions.filter((m) => ["completed", "failed", "cancelled"].includes(m.status)), [missions]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" data-testid="automation-panel">
      <SubagentFleetPanel key={projectId} projectId={projectId} />
      {dialog}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{workText("automation_panel.automation")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {workText("automation_panel.recurring_and_one_shot_specialist_runs_plus_durable_missions_ask_kady_to_create_one_re_run_the_")}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void refresh()} aria-label={workText("automation_panel.refresh_automation")}>
          <RefreshCwIcon className="size-3.5" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
      {heldByBudget.length > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          {workText("automation_panel.held_count", { count: heldByBudget.length })}{" "}
          <SettingsLink tab="project" section="budget">
            {workText("automation_panel.raise_the_limit_in_project_settings")}</SettingsLink>{" "}
          {workText("automation_panel.and_they_resume_on_their_own")}</p>
      )}

      <section aria-label={workText("automation_panel.schedules")} className="flex flex-col gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <AlarmClockIcon className="size-3.5" /> {workText("automation_panel.schedules")}</h4>
        {!loaded ? (
          <p className="text-xs text-muted-foreground">{workText("automation_panel.loading")}</p>
        ) : schedules.length === 0 ? (
          <p className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
            {workText("automation_panel.no_schedules_yet_in_a_chat_every_night_at_2am_have_the_data_validator_re_check_user_data_and_lo")}</p>
        ) : (
          schedules.map((s) => {
            const expanded = open[s.id] ?? false;
            const rowBusy = busy?.endsWith(`:${s.id}`) ?? false;
            return (
              <div key={s.id} className="rounded-lg border" data-schedule={s.id}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setOpen((o) => ({ ...o, [s.id]: !expanded }))}
                    aria-expanded={expanded}
                    aria-label={workText("automation_panel.toggle_name", { expanded: expanded ? "yes" : "no", name: s.name })}
                  >
                    {expanded ? <ChevronDownIcon className="size-3.5 shrink-0" /> : <ChevronRightIcon className="size-3.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        <span>{s.name}</span>
                        {s.heldByBudget ? (
                          <Badge variant="outline" className="h-5 text-[10px] text-amber-600">{workText("automation_panel.held_spend_limit")}</Badge>
                        ) : s.paused ? (
                          <Badge variant="outline" className="h-5 text-[10px]">{workText("automation_panel.paused")}</Badge>
                        ) : s.activeRunId ? (
                          <Badge variant="secondary" className="h-5 text-[10px]">{workText("automation_panel.running_50")}</Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {describeTrigger(s.trigger, s.paused)}
                        {s.lastRun ? workText("automation_panel.last_value", { v0: RUN_STATE_LABEL[s.lastRun.state] }) : ""}
                        {s.spendUsd > 0 ? workText("automation_panel.value_spent", { v0: formatUsd(s.spendUsd) }) : ""}
                      </div>
                    </div>
                  </button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={workText("automation_panel.run_value_now", { v0: s.name })} title={s.heldByBudget ? workText("automation_panel.held_until_the_spend_limit_is_raised") : workText("automation_panel.run_value_now", { v0: s.name })} disabled={rowBusy || s.heldByBudget} onClick={() => void act(s, "run")}>
                    {busy === `run:${s.id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : <ZapIcon className="size-3.5" />}
                  </Button>
                  {s.paused ? (
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={workText("automation_panel.resume_value", { v0: s.name })} disabled={rowBusy || s.heldByBudget} onClick={() => void act(s, "resume")}>
                      <PlayIcon className="size-3.5" />
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={workText("automation_panel.pause_value", { v0: s.name })} disabled={rowBusy} onClick={() => void act(s, "pause")}>
                      <PauseIcon className="size-3.5" />
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" aria-label={workText("automation_panel.delete_value", { v0: s.name })} disabled={rowBusy} onClick={() => void act(s, "delete")}>
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
                {expanded && (
                  <div className="border-t px-3 py-2 text-[11px]">
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">{s.workflowScript}</pre>
                    <div className="mt-2 text-muted-foreground">
                      {workText("automation_panel.model_value", { model: s.model ?? workText("automation_panel.inherited_from_the_project_s_latest_chat_model") })}
                      {s.quiet ? workText("automation_panel.quiet_successful_fires_don_t_wake_kady") : ""}
                      {" · "}{workText("automation_panel.catch_up_value", { policy: workLabel("code", s.catchUp) })}
                      {s.timeoutMs ? workText("automation_panel.timeout_value_min", { v0: Math.round(s.timeoutMs / 60000) }) : ""}
                      {s.baseRef ? workText("automation_panel.base_value", { v0: s.baseRef }) : ""}
                    </div>
                    {s.runs.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5">
                        {s.runs.map((r) => (
                          <li key={r.id} className={cn("flex flex-wrap items-center gap-x-2", r.state.startsWith("failed") && "text-destructive")}>
                            <span className="font-mono text-[10px] text-muted-foreground">{new Date(r.plannedAt).toLocaleString(geoLocale())}</span>
                            <span>{RUN_STATE_LABEL[r.state]}</span>
                            <span className="text-muted-foreground">({workLabel("code", r.dueReason)})</span>
                            {r.error && <span className="w-full break-words">{r.error}</span>}
                            {r.summary && !r.error && (
                              <span className="w-full whitespace-pre-wrap break-words rounded bg-muted/40 px-2 py-1 text-[10px] text-foreground">{r.summary}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <section aria-label={workText("automation_panel.missions")} className="flex flex-col gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FlagIcon className="size-3.5" /> {workText("automation_panel.missions")}</h4>
        {loaded && missions.length === 0 && (
          <p className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
            {workText("automation_panel.no_missions_recorded_multi_step_delegations_kady_runs_create_one_automatically_they_survive_res")}</p>
        )}
        {[...openMissions, ...closedMissions].map((m) => (
          <div key={m.id} className={cn("rounded-lg border px-3 py-2", ["completed", "failed", "cancelled"].includes(m.status) && "opacity-70")} data-mission={m.id}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  <span>{missionLabel(m)}</span>
                  <Badge variant={m.status === "needs_decision" ? "destructive" : "outline"} className="h-5 text-[10px]">{workLabel("status", m.status, m.status.replace("_", " "))}</Badge>
                  {m.goal && <Badge variant="secondary" className="h-5 text-[10px]">{workText("automation_panel.goal_status", { status: workLabel("status", m.goal.status) })}</Badge>}
                </div>
                {m.objective && m.objective !== REDACTED && <div className="truncate text-[11px] text-muted-foreground">{m.objective}</div>}
                <div className="text-[10px] text-muted-foreground">
                  {workText("automation_panel.run_count", { count: m.runs.length })}
                  {m.decisions.some((d) => d.status === "open") ? workText("automation_panel.value_open_decision_s", { v0: m.decisions.filter((d) => d.status === "open").length }) : ""}
                  {m.usage?.tokens ? workText("automation_panel.value_tokens", { v0: m.usage.tokens.toLocaleString(geoLocale()) }) : ""}
                  {m.budget?.tokens ? workText("automation_panel.value_budget", { v0: m.budget.tokens.toLocaleString(geoLocale()) }) : ""}
                  {workText("automation_panel.updated_value", { v0: new Date(m.updatedAt).toLocaleString(geoLocale()) })}
                </div>
              </div>
              {!["completed", "failed", "cancelled"].includes(m.status) && (
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" aria-label={workText("automation_panel.close_mission_value", { v0: missionLabel(m) })} disabled={busy === `close:${m.id}`} onClick={() => void close(m)}>
                  {workText("automation_panel.close")}</Button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
