"use client";
import { SettingsMessage } from "@/components/settings/primitives";
import { geoText } from "@/geo/i18n";

/**
 * Settings → Project → Prompt templates.
 *
 * Markdown files that expand from `/name args` in the composer. Two scopes,
 * like skills: this project's sandbox or the user-level dir shared by every
 * project (a project template of the same name wins).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SourceBadge, UPSTREAM_APP_SOURCE } from "@/geo/attribution/source-badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateSource,
  listPromptTemplates,
  restoreDefaultPromptTemplates,
  savePromptTemplateSource,
  type PromptScope,
  type PromptTemplateInfo,
} from "@/lib/capabilities";
import { useProjects } from "@/lib/use-projects";
import {
  ScopeSwitcher,
  SettingsError,
  SettingsHeader,
  SettingsNotice,
  SettingsSearch,
  matchesQuery,
} from "@/components/settings/primitives";

const settingsText = geoText("settings");

type Pane = "none" | "create" | "edit";

export function PromptsPanel() {
  const { activeProject, activeProjectId } = useProjects();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [scope, setScope] = useState<PromptScope>("project");
  const [rows, setRows] = useState<PromptTemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<Pane>("none");

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newHint, setNewHint] = useState("");

  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(async (nextScope: PromptScope, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      setRows(await listPromptTemplates(nextScope));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("prompts.failed_to_load_prompt_templates"));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

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
        setError(exc instanceof Error ? exc.message : settingsText("prompts.operation_failed"));
      } finally {
        setBusy(null);
      }
    },
    [load, scope],
  );

  const closePanes = useCallback(() => {
    setPane("none");
    setEditing(null);
    setEditContent("");
  }, []);

  const openEditor = useCallback(
    async (name: string) => {
      setPane("edit");
      setEditing(name);
      setEditLoading(true);
      try {
        setEditContent((await getPromptTemplateSource(name, scope)).content);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("prompts.failed_to_load_template"));
      } finally {
        setEditLoading(false);
      }
    },
    [scope],
  );

  const saveEditor = useCallback(async () => {
    if (!editing) return;
    await run("save", async () => {
      await savePromptTemplateSource(editing, scope, editContent);
      closePanes();
      return settingsText("prompts.saved", { v0: editing });
    });
  }, [closePanes, editContent, editing, run, scope]);

  const doCreate = useCallback(async () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    await run("create", async () => {
      const created = await createPromptTemplate(scope, {
        name,
        description: newDescription.trim() || undefined,
        argumentHint: newHint.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      setNewHint("");
      setPane("edit");
      setEditing(created.name);
      setEditContent(created.content);
      return settingsText("prompts.created_edit_the_body_below", { v0: created.name });
    });
  }, [newDescription, newHint, newName, run, scope]);

  const doRemove = useCallback(
    async (row: PromptTemplateInfo) => {
      const confirmed = await confirm({
        title: settingsText("prompts.confirm.delete", { v0: row.name }),
        description: row.seeded
          ? settingsText("prompts.this_is_one_of_kady_s_shipped_templates_restore_defaults_brings_it_back")
          : settingsText("prompts.the_template_file_is_removed_from_disk"),
        confirmLabel: settingsText("prompts.delete"),
        destructive: true,
      });
      if (!confirmed) return;
      await run(`remove:${row.name}`, async () => {
        await deletePromptTemplate(row.name, scope);
        if (editing === row.name) closePanes();
        return settingsText("prompts.deleted", { v0: row.name });
      });
    },
    [closePanes, confirm, editing, run, scope],
  );

  const doRestore = useCallback(async () => {
    const confirmed = await confirm({
      title: settingsText("prompts.confirm.restore_the_shipped_templates"),
      description:
        settingsText("prompts.kady_s_shipped_templates_are_written_back_to_this_project_edited_copies_with_the_same_name"),
      confirmLabel: settingsText("prompts.restore_defaults"),
      destructive: true,
    });
    if (!confirmed) return;
    await run("restore", async () => {
      const restored = await restoreDefaultPromptTemplates();
      return settingsText("prompts.restored_count", { count: restored });
    });
  }, [confirm, run]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesQuery(query, r.name, r.description)),
    [query, rows],
  );

  const switchScope = useCallback(
    async (next: PromptScope) => {
      if (pane === "edit" && editing) {
        const ok = await confirm({
          title: settingsText("prompts.confirm.discard_unsaved_changes_to", { v0: editing }),
          description: settingsText("prompts.switching_scope_closes_the_editor_without_saving"),
          confirmLabel: settingsText("prompts.discard"),
        });
        if (!ok) return;
      }
      setScope(next);
      closePanes();
    },
    [closePanes, confirm, editing, pane],
  );

  return (
    <div className="flex flex-col gap-3">
      {confirmDialog}
      <SettingsHeader
        title={settingsText("prompts.prompt_templates")}
        description={<SettingsMessage id="prompts.intro" values={{ command: <code>/name args</code>, slash: <code>/</code>, example: <code>/qc user_data/a.csv</code>, first: <code>$1</code>, second: <code>$2</code>, all: <code>$ARGUMENTS</code> }} />}
        appliesTo="immediately"
      />
      <ScopeSwitcher
        value={scope}
        onChange={(next) => void switchScope(next)}
        projectName={activeProject?.name ?? activeProjectId}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SettingsSearch
          value={query}
          onChange={setQuery}
          placeholder={settingsText("prompts.filter_templates")}
          label={settingsText("prompts.filter_templates_416")}
          className="w-56"
        />
        <div className="ml-auto flex items-center gap-1.5">
          {scope === "project" && (
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={busy === "restore"} onClick={() => void doRestore()}>
              {busy === "restore" ? <Loader2Icon className="size-3.5 animate-spin" /> : <RotateCcwIcon className="size-3.5" />}
              {settingsText("prompts.restore_defaults")}
            </Button>
          )}
          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => setPane(pane === "create" ? "none" : "create")}>
            <PlusIcon className="size-3.5" />
            {settingsText("prompts.new_template")}
          </Button>
        </div>
      </div>

      <SettingsError>{error}</SettingsError>
      <SettingsNotice>{notice}</SettingsNotice>

      {pane === "create" && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="text-xs font-medium">{settingsText("prompts.new_template_scope", { scope: scope === "project" ? settingsText("prompts.this_project") : settingsText("prompts.all_projects") })}</div>
          <div className="flex flex-wrap gap-2">
            <Input value={newName} placeholder={settingsText("prompts.name_lowercase_e_g_lit_scan")} className="h-8 w-48 font-mono text-xs" onChange={(e) => setNewName(e.target.value)} aria-label={settingsText("prompts.template_name")} />
            <Input value={newHint} placeholder={settingsText("prompts.argument_hint_e_g_topic_years")} className="h-8 w-56 font-mono text-xs" onChange={(e) => setNewHint(e.target.value)} aria-label={settingsText("prompts.argument_hint")} />
            <Input value={newDescription} placeholder={settingsText("prompts.short_description_shown_in_the_menu")} className="h-8 flex-1 text-xs" onChange={(e) => setNewDescription(e.target.value)} aria-label={settingsText("prompts.template_description")} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" disabled={!newName.trim() || busy === "create"} onClick={() => void doCreate()}>
              {busy === "create" && <Loader2Icon className="size-3.5 animate-spin" />}
              {settingsText("prompts.create_and_edit")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={closePanes}>
              {settingsText("prompts.cancel")}
            </Button>
          </div>
        </div>
      )}

      {pane === "edit" && editing && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="text-xs font-medium">{settingsText("prompts.editing_template", { name: editing })}</div>
          {editLoading ? (
            <p className="text-[11px] text-muted-foreground">{settingsText("prompts.loading")}</p>
          ) : (
            <Textarea
              value={editContent}
              spellCheck={false}
              className="min-h-56 font-mono text-[11px]"
              aria-label={settingsText("prompts.template_source_for", { v0: editing })}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" className="h-8 text-xs" disabled={busy === "save" || editLoading} onClick={() => void saveEditor()}>
              {busy === "save" && <Loader2Icon className="size-3.5 animate-spin" />}
              {settingsText("prompts.save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={closePanes}>
              {settingsText("prompts.cancel")}</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">{settingsText("prompts.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {rows.length === 0
            ? scope === "global"
              ? settingsText("prompts.no_templates_for_all_projects_yet")
              : settingsText("prompts.no_templates_in_this_project")
            : settingsText("prompts.no_templates_match")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                  <span className="font-mono">/{r.name}</span>
                  {r.argumentHint && <span className="font-mono text-[11px] text-muted-foreground">{r.argumentHint}</span>}
                  {r.seeded && (
                    <SourceBadge source={UPSTREAM_APP_SOURCE} />
                  )}
                  {r.shadowed && (
                    <Badge variant="outline" className="h-5 text-[10px]">
                      {scope === "global" ? settingsText("prompts.shadowed_by_a_project_template") : settingsText("prompts.also_defined_for_all_projects")}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{r.description}</div>
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={settingsText("prompts.edit", { v0: r.name })} onClick={() => void openEditor(r.name)}>
                <PencilIcon className="size-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={settingsText("prompts.delete_443", { v0: r.name })} disabled={busy === `remove:${r.name}`} onClick={() => void doRemove(r)}>
                {busy === `remove:${r.name}` ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
