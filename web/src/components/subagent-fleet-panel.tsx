"use client";
import { geoLocale, geoText } from "@/geo/i18n";
import { workLabel } from "@/geo/work-labels";
const workText = geoText("work");
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { commandPreview } from "@/lib/command-blocks";
import { fleetSessions, getFleet, controlSpecialist, type FleetSnapshot, type FleetAction, type FleetNode } from "@/lib/subagent-fleet";
const active = (state: string) => ["running", "queued", "pending"].includes(state);
type Target = { runId: string; index?: number; label: string };
const flatten = (rows: FleetNode[]): FleetNode[] => rows.flatMap((row) => [row, ...flatten(row.children ?? [])]);

export function SubagentFleetPanel({ projectId }: { projectId: string }) {
  const [sessions, setSessions] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionId, setSessionId] = useState("");
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Target | null>(null);
  const [transcript, setTranscript] = useState("");
  const [transcriptRefresh, setTranscriptRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [stopping, setStopping] = useState<Target | null>(null);
  const generation = useRef(0);
  useEffect(() => { setSessions([]); setSessionId(""); }, [projectId]);
  useEffect(() => {
    let cancelled = false;
    const load = () => fleetSessions(projectId).then(({ sessions }) => {
      if (!cancelled) { setSessions(sessions); setSessionId((id) => sessions.some((s) => s.id === id) ? id : sessions[0]?.id || ""); }
    }).catch((e) => { if (!cancelled) setError(e.message); });
    void load();
    // A chat started after this panel mounted (or the first schedule's host)
    // would otherwise stay invisible until "Refresh chats".
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [projectId, sessionRefresh]);
  useEffect(() => {
    const current = ++generation.current;
    setSnapshot(null); setSelected(null); setTranscript(""); setMessage(""); setStopping(null); setError(""); setNotice(""); setBusy(false);
    if (!sessionId) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const data = await getFleet(projectId, sessionId); if (!cancelled) { setSnapshot(data); setError(""); } }
      catch (e) { if (!cancelled) setError((e as Error).message); }
      if (!cancelled) timer = setTimeout(refresh, 3000);
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); if (generation.current === current) generation.current++; };
  }, [projectId, sessionId]);
  useEffect(() => {
    if (!selected || !sessionId) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    setTranscript(workText("subagent_fleet_panel.loading_transcript"));
    async function refresh() {
      try {
        const data = await controlSpecialist(projectId, sessionId, "transcript", selected!.runId, undefined, selected!.index);
        if (!cancelled) setTranscript(data.text || workText("subagent_fleet_panel.no_transcript_available_yet"));
      } catch (e) { if (!cancelled) setTranscript(workText("subagent_fleet_panel.transcript_unavailable_value", { v0: (e as Error).message })); }
      if (!cancelled) timer = setTimeout(refresh, 3000);
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, sessionId, selected, transcriptRefresh]);
  const action = useCallback(async (verb: FleetAction, target: Target) => {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const result = await controlSpecialist(projectId, sessionId, verb, target.runId, message, target.index);
      if (generation.current !== current) return;
      setNotice(result.text || workText("subagent_fleet_panel.request_acknowledged")); setMessage(""); setStopping(null); setTranscriptRefresh((n) => n + 1);
      const next = await getFleet(projectId, sessionId);
      if (generation.current === current) setSnapshot(next);
    } catch (e) { if (generation.current === current) setError((e as Error).message); }
    finally { if (generation.current === current) setBusy(false); }
  }, [projectId, sessionId, message]);
  const runs = snapshot?.asyncSnapshot?.runs ?? [];
  const selectedNode = selected && flatten(runs).find((node) => selected.index === undefined
    ? node.id === selected.runId
    : node.control?.runId === selected.runId && node.control.index === selected.index);
  const isActive = Boolean(selectedNode && active(selectedNode.state));
  const inspect = (target: Target) => { setSelected(target); setMessage(""); setStopping(null); setNotice(""); };
  const childRows = (children: FleetNode[]) => children.map((child) => <div key={child.id} className="space-y-1 pl-3">
    <div className="flex items-center justify-between gap-2 text-xs">
      <span>{child.label} · {workLabel("status", child.state)}{child.activity?.currentTool ? ` · ${child.activity.currentTool}` : ""}</span>
      {child.control && <Button size="sm" variant="ghost" disabled={busy} onClick={() => inspect({ ...child.control!, label: child.label })}>{workText("subagent_fleet_panel.inspect")}{child.label}</Button>}
    </div>
    {childRows(child.children ?? [])}
  </div>);
  return <section className="space-y-3 rounded-xl border p-4" aria-label={workText("subagent_fleet_panel.specialist_fleet")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-medium">{workText("subagent_fleet_panel.specialist_fleet")}</h3><p className="text-xs text-muted-foreground">{workText("subagent_fleet_panel.watch_delegated_work_inspect_results_and_guide_a_specialist")}</p></div>
      <div className="flex gap-2">
        <select aria-label={workText("subagent_fleet_panel.fleet_chat")} value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="max-w-64 rounded border bg-background px-2 py-1 text-xs">
          {!sessions.length && <option value="">{workText("subagent_fleet_panel.no_chats_yet")}</option>}
          {sessions.map((s) => <option key={s.id} value={s.id}>{commandPreview(s.name)}</option>)}
        </select>
        <Button size="sm" variant="ghost" onClick={() => setSessionRefresh((n) => n + 1)}>{workText("subagent_fleet_panel.refresh_chats")}</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {notice && <p role="status" className="whitespace-pre-wrap text-xs">{notice}</p>}
    {snapshot?.fleet && <p className="text-xs text-muted-foreground">{workText("subagent_fleet_panel.active_count", { count: snapshot.fleet.totalActive })}</p>}
    {snapshot?.fleet?.entries.map((entry) => <div key={entry.key} className="text-xs"><span className="font-medium">{entry.agent}</span> · {entry.model || workText("subagent_fleet_panel.inherited_model")} · {entry.tokens.total.toLocaleString(geoLocale())} {workText("subagent_fleet_panel.tokens")}{entry.goal && <p className="text-muted-foreground">{entry.goal}</p>}</div>)}
    {!runs.length && <p className="text-xs text-muted-foreground">{snapshot ? workText("subagent_fleet_panel.no_specialist_runs_in_this_chat") : sessionId ? workText("subagent_fleet_panel.loading_specialists") : workText("subagent_fleet_panel.start_a_chat_to_view_its_specialists")}</p>}
    {runs.map((run) => <div key={run.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{run.label}</span><span className="text-xs">{workLabel("status", run.state)}</span></div>
      {run.startedAt && <p className="text-xs text-muted-foreground">{workText("subagent_fleet_panel.elapsed", { seconds: Math.max(0, Math.round(((run.endedAt || Date.now()) - run.startedAt) / 1000)) })}{run.activity?.currentTool ? ` · ${run.activity.currentTool}` : ""}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inspect({ runId: run.id, label: run.label })}>{workText("subagent_fleet_panel.transcript_controls")}</Button>
        {active(run.state) && <Button size="sm" variant="outline" disabled={busy} onClick={() => setStopping({ runId: run.id, label: run.label })}>{workText("subagent_fleet_panel.stop_run")}</Button>}
      </div>
      {childRows(run.children ?? [])}
    </div>)}
    {(snapshot?.asyncSnapshot?.omitted?.runs || snapshot?.asyncSnapshot?.omitted?.children || snapshot?.fleet?.omitted) ? <p className="text-xs text-muted-foreground">{workText("subagent_fleet_panel.some_entries_are_omitted_from_this_bounded_view_ask_kady_for_a_specific_run_s_status")}</p> : null}
    {snapshot?.compute?.map((job) => <p key={job.id} className="text-xs">{workText("subagent_fleet_panel.compute")}{job.label} · {workLabel("status", job.state)}</p>)}
    {selected && <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between"><h4 className="text-sm font-medium">{selected.label}</h4><Button size="sm" variant="ghost" onClick={() => setTranscriptRefresh((n) => n + 1)}>{workText("subagent_fleet_panel.refresh_transcript")}</Button></div>
      <pre aria-label={workText("subagent_fleet_panel.specialist_transcript")} className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 text-xs">{transcript}</pre>
      <label className="block text-xs" htmlFor="specialist-message">{workText("subagent_fleet_panel.instructions_for_this_specialist")}</label>
      <textarea id="specialist-message" value={message} maxLength={16000} onChange={(e) => setMessage(e.target.value)} className="min-h-20 w-full rounded border bg-background p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        {isActive ? <><Button size="sm" disabled={busy || !message.trim()} onClick={() => void action("steer", selected)}>{workText("subagent_fleet_panel.send_guidance")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setStopping(selected)}>{workText("subagent_fleet_panel.stop_specialist")}</Button></>
          : <Button size="sm" variant="outline" disabled={busy || !selectedNode || !message.trim()} onClick={() => void action("resume", selected)}>{workText("subagent_fleet_panel.resume_with_instructions")}</Button>}
      </div>
    </div>}
    {stopping && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">{workText("subagent_fleet_panel.confirm.stop", { name: stopping.label, children: stopping.index === undefined ? "yes" : "no" })}<Button size="sm" variant="destructive" disabled={busy} onClick={() => void action("stop", stopping)}>{workText("subagent_fleet_panel.confirm_stop")}</Button><Button size="sm" variant="ghost" onClick={() => setStopping(null)}>{workText("subagent_fleet_panel.keep_running")}</Button></div>}
  </section>;
}
