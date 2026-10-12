"use client";
import { SettingsMessage } from "@/components/settings/primitives";
import { geoText } from "@/geo/i18n";

/**
 * Settings → Project → Specialists.
 *
 * Lists the agents available to the `subagent` delegation tool (pi-subagents):
 * project agents from sandbox/.pi/agents/*.md (editable) and the package's
 * builtin agents (read-only — "Customize" copies one into the project, where
 * it shadows the builtin by name). Mirrors the MCP servers panel's
 * list + inline-form interaction style.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModelField } from "@/components/settings/model-field";
import {
  SettingsCard,
  SettingsError,
  SettingsHeader,
  SettingsSearch,
  matchesQuery,
} from "@/components/settings/primitives";
import { cn } from "@/lib/utils";
import {
  BotIcon,
  BrainIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { useProjects } from "@/lib/use-projects";
import {
  clearAgentMemory,
  deleteAgent,
  getAgentMemory,
  getAgents,
  getSpecialistDefaultModel,
  getWatchdogSettings,
  restoreDefaultAgents,
  saveAgent,
  saveAgentMemory,
  saveSpecialistDefaultModel,
  saveWatchdogSettings,
  setAgentEnabled,
  THINKING_LEVELS,
  type AgentFile,
  type AgentMemoryFile,
  type WatchdogSettings,
} from "@/lib/agents";

const settingsText = geoText("settings");

interface AgentFormState {
  /** Name being edited, or null when creating a new agent. */
  originalName: string | null;
  name: string;
  description: string;
  model: string;
  thinking: string;
  tools: string;
  systemPromptMode: "append" | "replace";
  inheritProjectContext: boolean;
  inheritSkills: boolean;
  memoryEnabled: boolean;
  memoryScope: "project" | "user";
  extra?: Record<string, unknown>;
  systemPrompt: string;
}

const EMPTY_FORM: AgentFormState = {
  originalName: null,
  name: "",
  description: "",
  model: "",
  thinking: "",
  tools: "",
  systemPromptMode: "append",
  inheritProjectContext: true,
  inheritSkills: true,
  memoryEnabled: false,
  memoryScope: "project",
  systemPrompt: "",
};

function formFromAgent(agent: AgentFile, asCopy: boolean): AgentFormState {
  return {
    originalName: asCopy ? null : agent.name,
    name: agent.name,
    description: agent.description,
    model: agent.model ?? "",
    thinking: agent.thinking ?? "",
    tools: agent.tools ?? "",
    systemPromptMode: agent.systemPromptMode ?? "append",
    inheritProjectContext: agent.inheritProjectContext ?? true,
    inheritSkills: agent.inheritSkills ?? true,
    memoryEnabled: Boolean(agent.memory),
    memoryScope: agent.memory?.scope ?? "project",
    extra: agent.extra,
    systemPrompt: agent.systemPrompt,
  };
}

/**
 * Settings card for pi-subagents' opt-in watchdog: a second model that
 * reviews each turn's edits and steers findings into the chat.
 */
export function WatchdogCard({ projectId }: { projectId: string }) {
  const [settings, setSettings] = useState<WatchdogSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Latest settings for `update`: consecutive edits must not roll back to a
  // snapshot captured before the previous save landed.
  const settingsRef = useRef<WatchdogSettings | null>(null);
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    setSettings(null);
    getWatchdogSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((exc) => {
        if (!cancelled) setError(exc instanceof Error ? exc.message : settingsText("subagents.failed_to_load_watchdog_settings"));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const update = useCallback(async (patch: Partial<Omit<WatchdogSettings, "metered">>) => {
    const previous = settingsRef.current;
    if (!previous) return;
    setSettings({ ...previous, ...patch });
    setSaving(true);
    setError(null);
    try {
      setSettings(await saveWatchdogSettings(patch));
    } catch (exc) {
      setSettings(previous);
      setError(exc instanceof Error ? exc.message : settingsText("subagents.save_failed"));
    } finally {
      setSaving(false);
    }
  }, []);

  // Number fields commit on blur/Enter, never per keystroke (typing "50"
  // would otherwise send 5 — below the minimum — before 50).
  const [cadenceDraft, setCadenceDraft] = useState<string | null>(null);
  const [stalemateDraft, setStalemateDraft] = useState<string | null>(null);
  const commitCadence = () => {
    if (cadenceDraft === null || !settings) return;
    const raw = cadenceDraft.trim();
    setCadenceDraft(null);
    const next = raw === "" ? null : Number(raw);
    if (next !== null && (!Number.isInteger(next) || next < 5 || next > 500)) {
      setError(settingsText("subagents.mid_turn_review_cadence_must_be_a_whole_number_from_5_to_500_or_empty"));
      return;
    }
    if (next !== settings.cadenceEveryNTools) void update({ cadenceEveryNTools: next });
  };
  const commitStalemate = () => {
    if (stalemateDraft === null || !settings) return;
    const next = Number(stalemateDraft.trim());
    setStalemateDraft(null);
    if (!Number.isInteger(next) || next < 1 || next > 20) {
      setError(settingsText("subagents.stalemate_repeats_must_be_a_whole_number_from_1_to_20"));
      return;
    }
    if (next !== settings.stalemateRepeats) void update({ stalemateRepeats: next });
  };

  return (
    <section className="rounded-lg border p-3" aria-label="Watchdog" data-testid="watchdog-card">
      <div className="flex items-center gap-2">
        <ShieldAlertIcon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">Watchdog</div>
          <p className="text-[11px] text-muted-foreground">
            {settingsText("subagents.a_second_model_reviews_what_the_agent_just_did_and_steers_findings_into_the_chat_raw_data")}
          </p>
        </div>
        <Switch
          aria-label={settingsText("subagents.enable_watchdog")}
          checked={settings?.enabled ?? false}
          disabled={!settings || saving}
          onCheckedChange={(enabled) => void update({ enabled })}
        />
      </div>
      <p className="mt-2 rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
        {settingsText("subagents.watchdog_reviews_add_model_usage_kady_records_it_in_the_project_ledger_and_checks_the_spen")}
      </p>
      <SettingsError className="mt-2">{error}</SettingsError>
      {settings?.enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="text-[11px] text-muted-foreground">
            {settingsText("subagents.model")}
            <ModelField
              className="mt-1"
              label={settingsText("subagents.watchdog_model")}
              value={settings.model}
              emptyLabel={settingsText("subagents.inherit_chat_model")}
              disabled={saving}
              onChange={(model) => {
                if (model !== settings.model) void update({ model });
              }}
            />
          </div>
          <label className="text-[11px] text-muted-foreground">
            {settingsText("subagents.thinking")}
            <select
              className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              aria-label={settingsText("subagents.watchdog_thinking_level")}
              value={settings.thinking}
              onChange={(e) => void update({ thinking: e.target.value })}
            >
              <option value="">{settingsText("subagents.inherit_from_chat")}</option>
              {THINKING_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {settingsText("subagents.thinking_label", { level })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            {settingsText("subagents.also_review_mid_turn_every_n_tool_calls_empty_only_at_turn_end")}
            <Input
              type="number"
              min={5}
              max={500}
              className="mt-1 h-8 text-xs"
              aria-label={settingsText("subagents.watchdog_cadence")}
              value={cadenceDraft ?? String(settings.cadenceEveryNTools ?? "")}
              onChange={(e) => setCadenceDraft(e.target.value)}
              onBlur={commitCadence}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCadence();
              }}
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            {settingsText("subagents.report")}
            <select
              className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
              aria-label={settingsText("subagents.watchdog_severity_threshold")}
              value={settings.severityThreshold}
              onChange={(e) => void update({ severityThreshold: e.target.value as WatchdogSettings["severityThreshold"] })}
            >
              <option value="concern">{settingsText("subagents.concerns_and_blockers")}</option>
              <option value="blocker">{settingsText("subagents.blockers_only")}</option>
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground sm:col-span-2">
            {settingsText("subagents.stop_a_turn_after_the_same_warning_repeats_this_many_times_in_a_row_1_20")}
            <Input
              type="number"
              min={1}
              max={20}
              className="mt-1 h-8 w-24 text-xs"
              aria-label={settingsText("subagents.watchdog_stalemate_repeats")}
              value={stalemateDraft ?? String(settings.stalemateRepeats)}
              onChange={(e) => setStalemateDraft(e.target.value)}
              onBlur={commitStalemate}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitStalemate();
              }}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:col-span-2">
            {settingsText("subagents.also_review_background_specialists_own_turns")}
            <Switch
              aria-label={settingsText("subagents.watch_specialists")}
              checked={settings.children}
              disabled={saving}
              onCheckedChange={(children) => void update({ children })}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:col-span-2">
            {settingsText("subagents.read_the_project_s")}<code>.pi/WATCHDOG.md</code> {settingsText("subagents.standing_instructions")}
            <Switch
              aria-label={settingsText("subagents.use_watchdog_md")}
              checked={settings.watchdogMd}
              disabled={saving}
              onCheckedChange={(watchdogMd) => void update({ watchdogMd })}
            />
          </label>
        </div>
      )}
    </section>
  );
}

/** Project `subagents.defaultModel`: the model for specialists that pin none. */
function SpecialistDefaultModelCard({ projectId }: { projectId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setValue(null);
    getSpecialistDefaultModel()
      .then((model) => {
        if (!cancelled) setValue(model ?? "");
      })
      .catch((exc) => {
        if (!cancelled) setError(exc instanceof Error ? exc.message : settingsText("subagents.failed_to_load_the_default_model"));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const change = async (next: string) => {
    if (value === null || next === value) return;
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      setValue((await saveSpecialistDefaultModel(next || null)) ?? "");
    } catch (exc) {
      setValue(previous);
      setError(exc instanceof Error ? exc.message : settingsText("subagents.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard
      title={settingsText("subagents.default_model_for_specialists")}
      description={settingsText("subagents.used_by_every_specialist_that_does_not_pin_its_own_model_inherit_keeps_each_specialist_on")}
    >
      {value === null ? (
        error ? <SettingsError>{error}</SettingsError> : <p className="text-[11px] text-muted-foreground">{settingsText("subagents.loading")}</p>
      ) : (
        <>
          <ModelField
            label={settingsText("subagents.default_specialist_model")}
            value={value}
            emptyLabel={settingsText("subagents.inherit_chat_model")}
            disabled={saving}
            onChange={(next) => void change(next)}
          />
          <SettingsError className="mt-2">{error}</SettingsError>
        </>
      )}
    </SettingsCard>
  );
}

export function SubagentsPanel() {
  const { activeProject, activeProjectId } = useProjects();
  const [agents, setAgents] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<AgentFile | null>(null);
  const [query, setQuery] = useState("");
  const { confirm, dialog } = useConfirm();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setAgents(await getAgents());
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.failed_to_load_specialists"));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setForm(null);
    setViewing(null);
    getAgents()
      .then((a) => {
        if (!cancelled) setAgents(a);
      })
      .catch((exc) => {
        if (!cancelled) {
          setError(exc instanceof Error ? exc.message : settingsText("subagents.failed_to_load_specialists"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const toggleEnabled = useCallback(
    async (name: string, next: boolean) => {
      setAgents((list) => list.map((a) => (a.name === name ? { ...a, enabled: next } : a)));
      try {
        await setAgentEnabled(name, next);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("subagents.toggle_failed"));
        void refresh(); // reconcile on failure
      }
    },
    [refresh],
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    const name = form.name.trim().toLowerCase();
    if (!name) {
      setError(settingsText("subagents.specialist_name_is_required"));
      return;
    }
    if (!form.systemPrompt.trim()) {
      setError(settingsText("subagents.system_prompt_must_not_be_empty"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveAgent(name, {
        description: form.description.trim(),
        model: form.model.trim() || undefined,
        thinking: form.thinking || undefined,
        tools: form.tools.trim() || undefined,
        systemPromptMode: form.systemPromptMode,
        inheritProjectContext: form.inheritProjectContext,
        inheritSkills: form.inheritSkills,
        memory: form.memoryEnabled ? { scope: form.memoryScope, path: name } : undefined,
        extra: form.extra,
        systemPrompt: form.systemPrompt,
      });
      // Renaming creates a new file; remove the old one so it doesn't linger.
      if (form.originalName && form.originalName !== name) {
        await deleteAgent(form.originalName).catch(() => {});
      }
      setForm(null);
      await refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [form, refresh]);

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await confirm({
        title: settingsText("subagents.confirm.delete", { v0: name }),
        description: settingsText("subagents.delete_description", { name }),
        confirmLabel: settingsText("subagents.delete"),
        destructive: true,
      });
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        await deleteAgent(name);
        await refresh();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("subagents.delete_failed"));
      } finally {
        setSaving(false);
      }
    },
    [confirm, refresh],
  );

  const handleRestore = useCallback(async () => {
    const ok = await confirm({
      title: settingsText("subagents.confirm.restore_the_default_specialists"),
      description:
        settingsText("subagents.re_seeds_the_default_scientific_roster_project_specialists_with_the_same_names_are_overwri"),
      confirmLabel: settingsText("subagents.restore_defaults"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await restoreDefaultAgents();
      setForm(null);
      setViewing(null);
      await refresh();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.restore_failed"));
    } finally {
      setSaving(false);
    }
  }, [confirm, refresh]);

  const [memoryOpen, setMemoryOpen] = useState<{ name: string; file: AgentMemoryFile | null; draft: string } | null>(null);
  const openMemory = useCallback(async (agent: AgentFile) => {
    if (memoryOpen?.name === agent.name) {
      setMemoryOpen(null);
      return;
    }
    setMemoryOpen({ name: agent.name, file: null, draft: "" });
    try {
      const file = await getAgentMemory(agent.name);
      setMemoryOpen({ name: agent.name, file, draft: file.content });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.failed_to_load_memory"));
      setMemoryOpen(null);
    }
  }, [memoryOpen]);
  const saveMemory = useCallback(async () => {
    if (!memoryOpen) return;
    setSaving(true);
    setError(null);
    try {
      await saveAgentMemory(memoryOpen.name, memoryOpen.draft);
      setMemoryOpen({ ...memoryOpen, file: memoryOpen.file ? { ...memoryOpen.file, exists: true, content: memoryOpen.draft } : null });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.save_failed_499"));
    } finally {
      setSaving(false);
    }
  }, [memoryOpen]);
  const clearMemory = useCallback(async () => {
    if (!memoryOpen) return;
    const ok = await confirm({
      title: settingsText("subagents.confirm.clear_the_memory_of", { v0: memoryOpen.name }),
      description: settingsText("subagents.deletes_its_memory_md_the_specialist_starts_its_next_run_without_those_notes"),
      confirmLabel: settingsText("subagents.clear_memory"),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await clearAgentMemory(memoryOpen.name);
      setMemoryOpen({ ...memoryOpen, draft: "", file: memoryOpen.file ? { ...memoryOpen.file, exists: false, content: "" } : null });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("subagents.clear_failed"));
    } finally {
      setSaving(false);
    }
  }, [confirm, memoryOpen]);

  const visible = useMemo(
    () => agents.filter((a) => matchesQuery(query, a.name, a.description, a.model)),
    [agents, query],
  );
  const project = visible.filter((a) => a.source === "project");
  const builtins = visible.filter((a) => a.source === "builtin");

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <SettingsHeader
        title={settingsText("subagents.specialists")}
        description={<SettingsMessage id="subagents.intro" values={{ tool: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">subagent</code>, project: <span className="font-medium">{activeProject?.name ?? activeProjectId}</span>, path: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.pi/agents/</code> }} />}
        appliesTo="new-chats"
      />

      <SpecialistDefaultModelCard projectId={activeProjectId} />
      <WatchdogCard projectId={activeProjectId} />

      <SettingsError>{error}</SettingsError>

      {loading ? (
        <p className="text-xs text-muted-foreground">{settingsText("subagents.loading")}</p>
      ) : form ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium">{settingsText("subagents.name")}</label>
              <Input
                value={form.name}
                placeholder={settingsText("subagents.e_g_code_reviewer")}
                className="h-8 text-xs font-mono"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium">
                {settingsText("subagents.model")}{" "}
                <span className="font-normal text-muted-foreground">{settingsText("subagents.optional")}</span>
              </span>
              <ModelField
                label={settingsText("subagents.specialist_model")}
                value={form.model}
                emptyLabel={settingsText("subagents.inherit_default_model")}
                onChange={(model) => setForm({ ...form, model })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">{settingsText("subagents.description")}</label>
            <Input
              value={form.description}
              placeholder={settingsText("subagents.one_line_shown_to_the_main_agent_when_it_picks_a_specialist")}
              className="h-8 text-xs"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">
              {settingsText("subagents.thinking_level")}{" "}
              <span className="font-normal text-muted-foreground">{settingsText("subagents.optional")}</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {["", ...THINKING_LEVELS].map((level) => (
                <Button
                  key={level || "inherit"}
                  variant={form.thinking === level ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setForm({ ...form, thinking: level })}
                >
                  {settingsText("subagents.thinking_label", { level: level || "inherit" })}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">
              {settingsText("subagents.tools")}{" "}
              <span className="font-normal text-muted-foreground">
                {settingsText("subagents.comma_separated_allowlist_empty_all_tools")}
              </span>
            </label>
            <Input
              value={form.tools}
              placeholder="read, grep, find, ls, bash"
              className="h-8 text-xs font-mono"
              onChange={(e) => setForm({ ...form, tools: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={form.inheritProjectContext}
                onCheckedChange={(v) => setForm({ ...form, inheritProjectContext: v })}
              />
              {settingsText("subagents.inherit_project_context_agents_md")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={form.inheritSkills}
                onCheckedChange={(v) => setForm({ ...form, inheritSkills: v })}
              />
              {settingsText("subagents.inherit_skills")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={form.systemPromptMode === "replace"}
                onCheckedChange={(v) =>
                  setForm({ ...form, systemPromptMode: v ? "replace" : "append" })
                }
              />
              {settingsText("subagents.replace_base_system_prompt")}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border p-2.5">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                aria-label={settingsText("subagents.persistent_memory")}
                checked={form.memoryEnabled}
                onCheckedChange={(v) => setForm({ ...form, memoryEnabled: v })}
              />
              {settingsText("subagents.persistent_memory")}</label>
            {form.memoryEnabled && (
              <label className="flex items-center gap-2 text-xs">
                {settingsText("subagents.scope")}
                <select
                  className="h-7 rounded-md border bg-background px-2 text-xs"
                  aria-label={settingsText("subagents.memory_scope")}
                  value={form.memoryScope}
                  onChange={(e) => setForm({ ...form, memoryScope: e.target.value as "project" | "user" })}
                >
                  <option value="project">{settingsText("subagents.this_project")}</option>
                  <option value="user">{settingsText("subagents.all_projects")}</option>
                </select>
              </label>
            )}
            <p className="w-full text-[11px] text-muted-foreground">
              {settingsText("subagents.a_role_specific_memory_md_the_agent_reads_at_the_start_of_every_run_and_may_append_dated_n")}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">{settingsText("subagents.system_prompt")}</label>
            <Textarea
              value={form.systemPrompt}
              placeholder={settingsText("subagents.you_are_a")}
              className="min-h-44 text-xs font-mono leading-relaxed"
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="text-xs"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? settingsText("subagents.saving") : form.originalName ? settingsText("subagents.save_changes") : settingsText("subagents.add_specialist")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => setForm(null)}
            >
              {settingsText("subagents.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SettingsSearch
            value={query}
            onChange={setQuery}
            placeholder={settingsText("subagents.search_specialists")}
            label={settingsText("subagents.search_specialists_540")}
          />
          <div className="flex flex-col gap-1.5">
            {project.map((agent) => (
              <div key={agent.name} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <BotIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium font-mono">{agent.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {agent.description || settingsText("subagents.no_description")}
                  </div>
                </div>
                {agent.model ? (
                  <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-mono">
                    {agent.model}
                  </Badge>
                ) : (
                  <VerifierBadge agent={agent} />
                )}
                {agent.memory && (
                  <Button
                    variant={memoryOpen?.name === agent.name ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                    aria-label={settingsText("subagents.memory_of", { v0: agent.name })}
                    onClick={() => void openMemory(agent)}
                  >
                    <BrainIcon className="size-3.5" />
                    {settingsText("subagents.memory")}
                  </Button>
                )}
                <Switch
                  aria-label={settingsText("subagents.toggle", { v0: agent.name })}
                  checked={agent.enabled !== false}
                  onCheckedChange={(v) => void toggleEnabled(agent.name, v)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  aria-label={settingsText("subagents.edit", { v0: agent.name })}
                  onClick={() => setForm(formFromAgent(agent, false))}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-destructive hover:text-destructive"
                  aria-label={settingsText("subagents.delete_546", { v0: agent.name })}
                  disabled={saving}
                  onClick={() => void handleDelete(agent.name)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ))}
            {project.length === 0 && (
              <div className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                {query.trim()
                  ? settingsText("subagents.no_project_specialist_matches")
                  : settingsText("subagents.no_project_specialists_yet_add_one_or_restore_the_default_scientific_roster_below")}
              </div>
            )}
          </div>

          {memoryOpen && (
            <div className="flex flex-col gap-2 rounded-lg border p-3" data-testid="agent-memory-pane">
              <div className="flex items-center gap-2 text-xs font-medium">
                <BrainIcon className="size-3.5 text-muted-foreground" />
                {settingsText("subagents.memory_of_549")}{memoryOpen.name}
                {memoryOpen.file && (
                  <span className="font-normal text-muted-foreground">
                    {settingsText("subagents.memory_summary", { scope: memoryOpen.file.memory.scope === "user" ? settingsText("subagents.all_projects") : settingsText("subagents.this_project"), lines: memoryOpen.file.limits.lines })}</span>
                )}
              </div>
              {!memoryOpen.file ? (
                <p className="text-[11px] text-muted-foreground">{settingsText("subagents.loading")}</p>
              ) : (
                <>
                  {!memoryOpen.file.exists && !memoryOpen.draft && (
                    <p className="text-[11px] text-muted-foreground">
                      {settingsText("subagents.nothing_written_yet_the_agent_creates_this_file_on_its_first_run_you_can_also_seed_it_here")}
                    </p>
                  )}
                  <Textarea
                    value={memoryOpen.draft}
                    spellCheck={false}
                    className="min-h-40 font-mono text-[11px]"
                    aria-label={settingsText("subagents.memory_md_for", { v0: memoryOpen.name })}
                    onChange={(e) => setMemoryOpen({ ...memoryOpen, draft: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => void saveMemory()}>
                      {settingsText("subagents.save_memory")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" disabled={saving} onClick={() => void clearMemory()}>
                      {settingsText("subagents.clear")}
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setMemoryOpen(null)}>
                      {settingsText("subagents.close")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setForm({ ...EMPTY_FORM })}
            >
              <PlusIcon className="size-3.5" />
              {settingsText("subagents.add_specialist")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              disabled={saving}
              onClick={() => void handleRestore()}
              title={settingsText("subagents.re_seed_the_default_scientific_specialists_overwrites_same_named_project_specialists_custo")}
            >
              <RotateCcwIcon className="size-3.5" />
              {settingsText("subagents.restore_defaults")}
            </Button>
          </div>

          {builtins.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="mt-1 text-xs font-medium text-muted-foreground">
                {settingsText("subagents.built_in_specialists")}{" "}
                <span className="font-normal">
                  {settingsText("subagents.from_pi_subagents_customize_to_override")}
                </span>
              </h4>
              {builtins.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2"
                >
                  <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium font-mono">
                      {agent.name}
                      <VerifierBadge agent={agent} />
                    </div>
                    <div
                      className={cn(
                        "text-[11px] text-muted-foreground",
                        viewing?.name === agent.name ? "" : "truncate",
                      )}
                    >
                      {agent.description || settingsText("subagents.no_description")}
                    </div>
                    {viewing?.name === agent.name && (
                      <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px] leading-relaxed">
                        {agent.systemPrompt}
                      </pre>
                    )}
                  </div>
                  <Switch
                    aria-label={settingsText("subagents.toggle", { v0: agent.name })}
                    checked={agent.enabled !== false}
                    onCheckedChange={(v) => void toggleEnabled(agent.name, v)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() =>
                      setViewing(viewing?.name === agent.name ? null : agent)
                    }
                  >
                    {viewing?.name === agent.name ? settingsText("subagents.hide") : settingsText("subagents.view")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setForm(formFromAgent(agent, true))}
                  >
                    {settingsText("subagents.customize")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Marks a specialist the Settings → Defaults verifier model covers. */
function VerifierBadge({ agent }: { agent: AgentFile }) {
  if (!agent.verifier) return null;
  return (
    <Badge
      variant="outline"
      className="hidden sm:inline-flex text-[10px] font-mono"
      title={
        agent.verifierModel
          ? settingsText("subagents.verifier_runs_on_settings_defaults_verifier_model", { v0: agent.verifierModel })
          : settingsText("subagents.verifier_set_a_verifier_model_in_settings_defaults_to_check_work_with_a_different_model")
      }
    >
      {agent.verifierModel ? settingsText("subagents.verifier", { v0: agent.verifierModel }) : settingsText("subagents.verifier_label")}
    </Badge>
  );
}
