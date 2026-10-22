"use client";
import { SettingsMessage } from "@/components/settings/primitives";
import { geoText, geoLocale } from "@/geo/i18n";

/**
 * Settings → Skills.
 *
 * Three kinds of skill live side by side and the row badges say which is which:
 * the K-Dense catalogue (synced daily, non-destructively), skills the user
 * installed from any source the `skills` CLI understands, and skills written
 * here. Only catalogue skills auto-update; the others are checked on request.
 *
 * Scope switches between this project's sandbox and the user-level dir shared by
 * every project.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjects } from "@/lib/use-projects";
import {
  checkSkillUpdate,
  createSkill,
  EMPTY_SKILL_SYNC_STATUS,
  getAllSkills,
  getSkillSource,
  installSkills,
  previewSkillSource,
  removeSkill,
  saveSkillSource,
  setSkillEnabled,
  setSkillModelInvocation,
  syncSkills,
  updateSkillFromUpstream,
  type PreviewedSkill,
  type SkillInfo,
  type SkillOrigin,
  type SkillProblem,
  type SkillScope,
  type SkillSyncStatus,
} from "@/lib/capabilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ScopeSwitcher,
  SettingsError,
  SettingsHeader,
  SettingsNotice,
  SettingsSearch,
  matchesQuery,
} from "@/components/settings/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Loader2Icon,
  PencilIcon,
  BookOpenIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  DownloadIcon,
  SlashIcon,
} from "lucide-react";

import { SkillHubInstall, SkillHubPreviewNotes, skillHubSource, type SkillHubPreview } from "@/geo/skill-hub/skill-hub";
import { SourceBadge } from "@/geo/attribution/source-badge";
import { t } from "@/geo/i18n";
import { text as localizedText } from "@/geo/workspace/api";
import { SkillInstructions } from "@/geo/skills/skill-instructions";

import { SkillShelf } from "@/geo/hub-skills/shelf";
import { HubSkillInstall } from "@/geo/hub-skills/install";
import { InstalledSkillState } from "@/geo/hub-skills/settings";

const settingsText = geoText("settings");

interface Row extends SkillInfo {
  enabled: boolean;
}

const ORIGIN_LABEL: Record<SkillOrigin, string> = {
  catalogue: settingsText("skills.origin_catalogue"),
  registry: settingsText("skills.installed"),
  local: settingsText("skills.local"),
};

type Pane = "none" | "install" | "create" | "edit";

import { onSkillImport, takeSkillImport } from "@/geo/skills/import-request";

export function SkillsPanel() {
  const hubLookup = useRef(0);
  const [hubSource, setHubSource] = useState(false);
  const [hubInstall, setHubInstall] = useState<{ skillId: string; revision: number } | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubBusy, setHubBusy] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const { activeProject, activeProjectId } = useProjects();
  const [importSource] = useState(() => takeSkillImport(activeProjectId));
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [scope, setScope] = useState<SkillScope>("project");
  const [rows, setRows] = useState<Row[]>([]);
  const [problems, setProblems] = useState<SkillProblem[]>([]);
  const [shadowed, setShadowed] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<SkillSyncStatus>(
    EMPTY_SKILL_SYNC_STATUS,
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<Pane>(importSource ? "install" : "none");

  // Install pane
  const [source, setSource] = useState(importSource ?? "");
  const [ref, setRef] = useState("");
  const [preview, setPreview] = useState<SkillHubPreview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => onSkillImport(() => {
    const source = takeSkillImport(activeProjectId);
    if (!source) return;
    setPane("install"); setSource(source); setRef(""); setScope("project");
    setPreview(null); setAcknowledged(false); setPicked(new Set());
  }), [activeProjectId]);

  // Create pane
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit pane
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(
    async (nextScope: SkillScope, showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const listing = await getAllSkills(nextScope);
        const merged: Row[] = [
          ...listing.enabled.map((s) => ({ ...s, enabled: true })),
          ...listing.disabled.map((s) => ({ ...s, enabled: false })),
        ].sort((a, b) => a.name.localeCompare(b.name));
        setRows(merged);
        setShadowed(listing.shadowed);
        setSyncStatus(listing.sync ?? EMPTY_SKILL_SYNC_STATUS);
        // Skills that failed to parse are absent from both lists above; without
        // this the only symptom is a skill missing from the catalogue.
        setProblems(listing.problems.filter((p) => !p.loaded));
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("skills.failed_to_load_skills"));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(scope);
  }, [load, scope, activeProjectId]);

  const run = useCallback(
    async (key: string, work: () => Promise<string | void>) => {
      setBusy(key);
      setError(null);
      setNotice(null);
      try {
        const message = await work();
        if (message) setNotice(message);
        await load(scope, false);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("skills.operation_failed"));
      } finally {
        setBusy(null);
      }
    },
    [load, scope],
  );

  const toggle = useCallback(
    async (name: string, next: boolean) => {
      setRows((rs) => rs.map((r) => (r.name === name ? { ...r, enabled: next } : r)));
      try {
        await setSkillEnabled(name, next, scope);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("skills.toggle_failed"));
        void load(scope, false); // reconcile on failure
      }
    },
    [load, scope],
  );

  const refresh = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncSkills();
      await load(scope, false);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("skills.skill_synchronization_failed"));
    } finally {
      setSyncing(false);
    }
  }, [load, scope]);

  const closePanes = useCallback(() => {
    setPane("none");
    setPreviewing(false);
    setPreview(null);
    setPicked(new Set());
    setAcknowledged(false);
    setEditing(null);
    setEditContent("");
    // Clear the source too. A leftover value in a reopened form invites typing
    // into the middle of the previous one and fetching a mangled hybrid.
    setSource("");
    setRef("");
  }, []);

  // A preview is scoped to its project. Never carry a hub preview into another project.
  useEffect(() => {
    setReading(null);
    setPreview(null);
    setPicked(new Set());
    setAcknowledged(false);
    setPreviewing(false);
  }, [activeProjectId]);

  const doPreview = useCallback(async () => {
    setPreviewing(true);
    setAcknowledged(false);
    setPicked(new Set());
    setError(null);
    setPreview(null);
    try {
      const result = await previewSkillSource({
        source: source.trim(),
        ref: ref.trim() || undefined,
        scope,
      });
      setPreview(result);
      // Preselect what isn't already here; re-installing an existing skill
      // should be a deliberate choice, not the default.
      setPicked(new Set(result.skills.filter((s) => !s.installed).map((s) => s.name)));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("skills.could_not_read_that_source"));
    } finally {
      setPreviewing(false);
    }
  }, [ref, scope, source]);

  const doInstall = useCallback(async () => {
    if (!preview) return;
    const names = [...picked];
    const replacing = preview.skills.some((s) => s.installed && picked.has(s.name));
    await run("install", async () => {
      const result = await installSkills({
        source: preview.source,
        ref: preview.ref,
        names,
        scope,
        stagingToken: preview.stagingToken,
        replace: replacing,
        acknowledged: true,
      });
      closePanes();
      return settingsText("skills.installed_result", { count: result.installed.length, hasConflicts: result.conflicts.length > 0 ? "yes" : "no", conflicts: result.conflicts.join(", ") });
    });
  }, [closePanes, picked, preview, run, scope]);

  const doCreate = useCallback(async () => {
    const name = newName.trim().toLowerCase();
    await run("create", async () => {
      await createSkill({ name, description: newDescription.trim() || undefined, scope });
      setNewName("");
      setNewDescription("");
      closePanes();
      // Drop straight into the editor: a template on its own does nothing.
      setEditing(name);
      setPane("edit");
      setEditLoading(true);
      try {
        setEditContent(await getSkillSource(name, scope));
      } finally {
        setEditLoading(false);
      }
      return settingsText("skills.created", { v0: name });
    });
  }, [closePanes, newDescription, newName, run, scope]);

  const openEditor = useCallback(
    async (name: string) => {
      setPane("edit");
      setEditing(name);
      setEditLoading(true);
      setError(null);
      try {
        setEditContent(await getSkillSource(name, scope));
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("skills.could_not_read_that_skill"));
      } finally {
        setEditLoading(false);
      }
    },
    [scope],
  );

  const saveEditor = useCallback(async () => {
    if (!editing) return;
    await run("save", async () => {
      await saveSkillSource(editing, editContent, scope);
      const name = editing;
      closePanes();
      return settingsText("skills.saved", { v0: name });
    });
  }, [closePanes, editContent, editing, run, scope]);

  const doRemove = useCallback(
    async (row: Row) => {
      const origin = row.origin ?? "catalogue";
      const consequence =
        origin === "catalogue"
          ? settingsText("skills.will_be_archived_and_kept_out_of_future_catalogue_syncs", { v0: row.name })
          : settingsText("skills.will_be_deleted", { v0: row.name });
      const ok = await confirm({
        title: origin === "catalogue" ? settingsText("skills.confirm.archive_skill") : settingsText("skills.confirm.delete_skill"),
        description: consequence,
        confirmLabel: origin === "catalogue" ? settingsText("skills.archive") : settingsText("skills.delete"),
        destructive: true,
      });
      if (!ok) return;
      await run(`remove:${row.name}`, async () => {
        const result = await removeSkill(row.name, scope);
        return result.disposition === "archived"
          ? settingsText("skills.archived_kept_in_pi_skills_archived", { v0: result.name })
          : settingsText("skills.deleted", { v0: result.name });
      });
    },
    [confirm, run, scope],
  );

  const doCheckUpdate = useCallback(
    async (name: string) => {
      await run(`check:${name}`, async () => {
        const result = await checkSkillUpdate(name, scope);
        return result.updateAvailable
          ? settingsText("skills.has_an_update_available", { v0: name })
          : settingsText("skills.is_up_to_date", { v0: name });
      });
    },
    [run, scope],
  );

  const replaceWithUpstream = useCallback(
    async (row: Row) => {
      const origin = row.origin ?? "catalogue";
      const where = origin === "catalogue" ? settingsText("skills.the_current_upstream_version") : row.source;
      const ok = await confirm({
        title: settingsText("skills.confirm.replace", { v0: row.name }),
        description: settingsText("skills.this_replaces_the_local_skill_with_local_edits_to_this_skill_will_be_lost", { v0: where ?? "" }),
        confirmLabel: settingsText("skills.replace"),
        destructive: true,
      });
      if (!ok) return;
      await run(`update:${row.name}`, async () => {
        await updateSkillFromUpstream(row.name, scope);
        return settingsText("skills.updated", { v0: row.name });
      });
    },
    [confirm, run, scope],
  );

  const filtered = useMemo(
    () => rows.filter((r) => matchesQuery(query, r.name, r.description)),
    [query, rows],
  );

  const switchScope = useCallback(
    async (next: SkillScope) => {
      if (pane === "edit" && editing) {
        const ok = await confirm({
          title: settingsText("skills.confirm.discard_unsaved_changes_to", { v0: editing }),
          description: settingsText("skills.switching_scope_closes_the_editor_without_saving"),
          confirmLabel: settingsText("skills.discard"),
        });
        if (!ok) return;
      }
      closePanes();
      setScope(next);
    },
    [closePanes, confirm, editing, pane],
  );

  const shadowedSet = useMemo(() => new Set(shadowed), [shadowed]);

  if (hubSource || hubInstall) return <section className="space-y-4">
    <Button variant="outline" onClick={() => { ++hubLookup.current; setHubSource(false); setHubInstall(null); setHubError(null); setHubBusy(false); }}>{t("hubSkills.settingsBack")}</Button>
    {hubError && <p role="alert">{t("hubSkills.error")}</p>}
    {hubInstall ? <HubSkillInstall key={activeProjectId} skillId={hubInstall.skillId} revision={hubInstall.revision} projectId={activeProjectId} onInstalled={() => { void load(scope); }} /> : <SkillShelf onOpen={(id) => {
      if (hubBusy) return; const request = ++hubLookup.current; setHubBusy(true); setHubError(null);
      void import("@/geo/hub-skills/api").then(({ hubSkills }) => hubSkills.detail(id)).then((detail) => { if (request === hubLookup.current) setHubInstall({ skillId: id, revision: detail.revision }); }).catch(() => { if (request === hubLookup.current) setHubError(t("hubSkills.error")); }).finally(() => { if (request === hubLookup.current) setHubBusy(false); });
    }} />}
  </section>;

  if (reading) return <SkillInstructions key={`${activeProjectId}:${scope}:${reading}`} name={reading} scope={scope} projectId={activeProjectId} onBack={() => setReading(null)} />;

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <SettingsHeader
        title={settingsText("skills.skills")}
        description={settingsText("skills.skills_the_agent_can_activate_the_k_dense_catalogue_syncs_daily_without_overwriting_local")}
        appliesTo="new-chats"
        actions={
          <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              closePanes();
              setPane(pane === "install" ? "none" : "install");
            }}
          >
            <PlusIcon className="size-3.5" />
            {settingsText("skills.add")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              closePanes();
              setPane(pane === "create" ? "none" : "create");
            }}
          >
            {settingsText("skills.new_skill")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={syncing || scope === "global"}
            title={
              scope === "global"
                ? settingsText("skills.the_catalogue_is_per_project_switch_to_this_project_to_sync_it")
                : undefined
            }
            onClick={() => void refresh()}
          >
            {syncing ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            {settingsText("skills.sync_catalogue")}
          </Button>
          </>
        }
      />

      <ScopeSwitcher
        value={scope}
        onChange={(next) => void switchScope(next)}
        projectName={activeProject?.name ?? activeProjectId}
      />

      {scope === "global" && (
        <p className="text-[11px] text-muted-foreground">
          {settingsText("skills.stored_in_your_kady_pi_agent_directory_available_to_every_project_and_to_subagents_a_proje")}
        </p>
      )}

      <SettingsError>{error}</SettingsError>
      <SettingsNotice>{notice}</SettingsNotice>

      {/* Install from a source */}
      {pane === "install" && (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="text-xs font-medium">{settingsText("skills.add_skills_from_a_source")}</div>
          <div className="flex items-center gap-3"><Button variant="outline" disabled={scope !== "project"} onClick={() => { setHubSource(true); setHubInstall(null); }}>{t("hubSkills.settingsSource")}</Button><span className="text-sm">{t("hubSkills.githubSource")}</span></div>
          {scope !== "project" && <p className="text-sm text-gaid-ink-2">{t("hubSkills.projectOnly")}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={source}
              placeholder={settingsText("skills.owner_repo_a_git_url_or_a_local_path")}
              className="h-8 flex-1 text-xs"
              onChange={(e) => setSource(e.target.value)}
            />
            <Input
              value={ref}
              placeholder={settingsText("skills.branch_tag_optional")}
              className="h-8 text-xs sm:w-44"
              onChange={(e) => setRef(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!source.trim() || previewing}
              onClick={() => void doPreview()}
            >
              {previewing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="size-3.5" />
              )}
              {settingsText("skills.look_up")}
            </Button>
          </div>

          {previewing && (
            <p className="text-[11px] text-muted-foreground">
              {settingsText("skills.downloading_the_source_to_see_what_it_contains")}
            </p>
          )}

          <SkillHubInstall key={`${activeProjectId}:${scope}`} scope={scope} projectId={activeProjectId} disabled={previewing || busy === "install"} onSettled={() => setPreviewing(false)}
            onStart={() => { setPreviewing(true); setPreview(null); setPicked(new Set()); setAcknowledged(false); setError(null); }}
            onPreview={(result) => { setPreview(result); setPicked(new Set(result.skills.filter((s) => !s.installed).map((s) => s.name))); }}
            onError={setError} />
          {preview && (
            <>
              <SkillHubPreviewNotes preview={preview} />
              <div className="break-all text-[11px] text-muted-foreground">
                {settingsText("skills.preview_count", { count: preview.skills.length })}{" "}
                <span className="font-medium">{skillHubSource(preview)}</span>
                {preview.ref ? ` (${preview.ref})` : ""}
              </div>
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {preview.skills.map((s: PreviewedSkill) => (
                  <label
                    key={s.name}
                    className="flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={picked.has(s.name)}
                      aria-label={settingsText("skills.select", { v0: s.name })}
                      onChange={(e) => {
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.name);
                          else next.delete(s.name);
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        {s.name}
                        {s.installed && (
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {settingsText("skills.already_installed_will_be_replaced")}
                          </Badge>
                        )}
                        {s.conflictsWith === "project" && (
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {settingsText("skills.a_project_skill_of_this_name_takes_precedence")}
                          </Badge>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              {preview.problems.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-[11px]">
                  {settingsText("skills.preview_problems", { count: preview.problems.length })}</div>
              )}

              <label className="flex items-start gap-2 text-[11px]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  aria-label={settingsText("skills.trust_this_source")}
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>
                  {preview.skillHub ? t("skillHub.trust", { source: skillHubSource(preview) }) : <SettingsMessage id="skills.trust_source" values={{ source: <span className="font-medium">{preview.source}</span> }} />}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={picked.size === 0 || !acknowledged || busy === "install"}
                  onClick={() => void doInstall()}
                >
                  {busy === "install" && (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  )}
                  {settingsText("skills.install_count", { count: picked.size })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={closePanes}
                >
                  {settingsText("skills.cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Author a new skill */}
      {pane === "create" && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="text-xs font-medium">{settingsText("skills.new_skill_330")}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newName}
              placeholder={settingsText("skills.skill_name_lowercase_hyphens")}
              className="h-8 text-xs sm:w-56"
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              value={newDescription}
              placeholder={settingsText("skills.what_it_does_and_when_to_use_it")}
              className="h-8 flex-1 text-xs"
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {settingsText("skills.the_description_is_what_the_model_matches_against_when_deciding_whether_to_activate_a_skil")}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={!newName.trim() || busy === "create"}
              onClick={() => void doCreate()}
            >
              {busy === "create" && <Loader2Icon className="size-3.5 animate-spin" />}
              {settingsText("skills.create_and_edit")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={closePanes}
            >
              {settingsText("skills.cancel")}</Button>
          </div>
        </div>
      )}

      {/* Edit SKILL.md */}
      {pane === "edit" && editing && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="text-xs font-medium">{settingsText("skills.editing")}{editing}/SKILL.md</div>
          {editLoading ? (
            <p className="text-[11px] text-muted-foreground">{settingsText("skills.loading")}</p>
          ) : (
            <Textarea
              value={editContent}
              spellCheck={false}
              className="min-h-64 font-mono text-[11px]"
              aria-label={settingsText("skills.skill_md_for", { v0: editing })}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={busy === "save" || editLoading}
              onClick={() => void saveEditor()}
            >
              {busy === "save" && <Loader2Icon className="size-3.5 animate-spin" />}
              {settingsText("skills.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={closePanes}
            >
              {settingsText("skills.cancel")}</Button>
          </div>
        </div>
      )}

      {scope === "project" &&
        (syncStatus.lastCheckedAt || syncStatus.updatesAvailable.length > 0) && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {syncStatus.lastCheckedAt && (
                <span className="text-muted-foreground">
                  {settingsText("skills.last_synced")}{new Date(syncStatus.lastCheckedAt).toLocaleString(geoLocale())}
                </span>
              )}
              {syncStatus.updatesAvailable.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-600">
                  {settingsText("skills.review_count", { count: syncStatus.updatesAvailable.length })}</Badge>
              )}
            </div>
            {syncStatus.lastResult &&
              (syncStatus.lastResult.added > 0 ||
                syncStatus.lastResult.updated > 0 ||
                syncStatus.lastResult.archived > 0) && (
                <p className="mt-1 text-muted-foreground">
                  {settingsText("skills.refresh_summary", { added: syncStatus.lastResult.added, updated: syncStatus.lastResult.updated, archived: syncStatus.lastResult.archived })}</p>
              )}
          </div>
        )}

      {problems.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs">
          <div className="font-medium">
            {problems.length === 1
              ? settingsText("skills.1_installed_skill_could_not_be_loaded")
              : settingsText("skills.installed_skills_could_not_be_loaded", { v0: problems.length })}
          </div>
          <p className="mt-1 text-muted-foreground">
            {settingsText("skills.these_are_on_disk_but_their_skill_md_failed_to_parse_so_they_are_hidden_from_the_list_belo")}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {problems.map((p) => (
              <li key={`${p.state}/${p.name}`}>
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground"> — {p.message.split("\n")[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SettingsSearch value={query} onChange={setQuery} placeholder={settingsText("skills.search_skills")} label={settingsText("skills.search_skills_355")} />

      {loading ? (
        <p className="text-xs text-muted-foreground">{settingsText("skills.loading")}</p>
      ) : filtered.length === 0 ? (
        rows.length === 0 && scope === "project" ? (
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1">
              {settingsText("skills.no_skills_installed_for_this_project_yet_the_k_dense_catalogue_is_usually_seeded_on_first")}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={syncing} onClick={() => void refresh()}>
              {syncing ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
              {settingsText("skills.sync_now")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {rows.length === 0
              ? settingsText("skills.no_skills_installed_for_all_projects_yet_use_add_or_new_skill_above")
              : settingsText("skills.no_skills_match")}
          </p>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((r) => {
            const origin = r.origin ?? "catalogue";
            const updateAvailable = !r.hubSkill && syncStatus.updatesAvailable.includes(r.name);
            const orphaned = syncStatus.orphaned.includes(r.name);
            const customized = syncStatus.customized.includes(r.name);
            const rowBusy = busy?.endsWith(`:${r.name}`) ?? false;
            return (
              <div
                key={r.name}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                    <span>{r.name}</span>
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      {/* Catalogue skills from a named source other than the configured catalogue name it. */}
                      {r.hubSkill ? t("hubSkills.revision", { revision: r.hubSkill.revision }) : r.builtin
                        ? settingsText("skills.origin_builtin")
                        : origin === "catalogue" && r.source
                          ? r.source
                          : ORIGIN_LABEL[origin]}
                    </Badge>
                    {r.upstream && <SourceBadge source={r.upstream} />}
                    {updateAvailable ? (
                      <Badge variant="outline" className="h-5 text-[10px] text-amber-600">
                        {settingsText("skills.update_available")}
                      </Badge>
                    ) : orphaned ? (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {settingsText("skills.removed_upstream")}
                      </Badge>
                    ) : origin === "catalogue" && customized ? (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {settingsText("skills.customized")}
                      </Badge>
                    ) : null}
                    {shadowedSet.has(r.name) && (
                      <Badge variant="outline" className="h-5 text-[10px]">
                        {scope === "global"
                          ? settingsText("skills.shadowed_by_a_project_skill")
                          : settingsText("skills.also_installed_for_all_projects")}
                      </Badge>
                    )}
                    {r.disableModelInvocation && (
                      <Badge variant="outline" className="h-5 text-[10px]" title={settingsText("skills.hidden_from_the_model_s_skills_index_runs_only_via_skill_name")}>
                        {settingsText("skills.user_invoked_only")}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {r.description}
                  </div>
                  {r.hubSkill ? <InstalledSkillState skill={r.hubSkill} onUpdate={scope === "project" ? () => { setHubSource(false); setHubInstall({ skillId: r.hubSkill!.id, revision: r.hubSkill!.latestRevision! }); } : undefined} /> : r.workflow ? (
                    <div className="truncate text-xs text-muted-foreground" title={t("skillHub.workflowSkill", { title: localizedText(r.workflow.title), revision: r.workflow.revision })}>{t("skillHub.workflowSkill", { title: localizedText(r.workflow.title), revision: r.workflow.revision })}</div>
                  ) : r.source && origin === "registry" && (
                    <div className="truncate text-[10px] text-muted-foreground/80">
                      {r.source}
                      {r.ref ? `#${r.ref}` : ""}
                    </div>
                  )}
                </div>

                <Button type="button" size="sm" variant="ghost" onClick={() => setReading(r.name)} aria-label={t("skillHub.readSkill", { name: r.name })} title={t("skillHub.readSkill", { name: r.name })}>
                  <BookOpenIcon className="size-4" />
                  {t("skillHub.read")}
                </Button>

                {updateAvailable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    aria-label={settingsText("skills.use_upstream_version_of", { v0: r.name })}
                    disabled={rowBusy}
                    onClick={() => void replaceWithUpstream(r)}
                  >
                    {busy === `update:${r.name}` && (
                      <Loader2Icon className="size-3 animate-spin" />
                    )}
                    {settingsText("skills.use_upstream")}
                  </Button>
                )}
                {origin === "registry" && !r.hubSkill && !updateAvailable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    aria-label={settingsText("skills.check_for_updates", { v0: r.name })}
                    disabled={rowBusy}
                    onClick={() => void doCheckUpdate(r.name)}
                  >
                    {busy === `check:${r.name}` ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-3" />
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={settingsText("skills.edit", { v0: r.name })}
                  onClick={() => void openEditor(r.name)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={settingsText("skills.remove", { v0: r.name })}
                  disabled={rowBusy}
                  onClick={() => void doRemove(r)}
                >
                  {busy === `remove:${r.name}` ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={r.disableModelInvocation ? "secondary" : "ghost"}
                  className="h-7 w-7 p-0"
                  aria-label={
                    r.disableModelInvocation
                      ? settingsText("skills.let_the_model_invoke", { v0: r.name })
                      : settingsText("skills.make_user_invoked_only", { v0: r.name })
                  }
                  title={
                    r.disableModelInvocation
                      ? settingsText("skills.user_invoked_only_skill_name_click_to_let_the_model_activate_it")
                      : settingsText("skills.click_to_hide_from_the_model_run_it_yourself_with_skill_name")
                  }
                  disabled={rowBusy}
                  onClick={() =>
                    void run(`invoke:${r.name}`, async () => {
                      const next = await setSkillModelInvocation(r.name, Boolean(r.disableModelInvocation), scope);
                      return next.disableModelInvocation
                        ? settingsText("skills.now_runs_only_when_you_type_skill", { v0: r.name, v1: r.name })
                        : settingsText("skills.can_be_activated_by_the_model_again", { v0: r.name });
                    })
                  }
                >
                  <SlashIcon className="size-3.5" />
                </Button>
                <Switch
                  aria-label={settingsText("skills.toggle", { v0: r.name })}
                  checked={r.enabled}
                  onCheckedChange={(v) => void toggle(r.name, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
