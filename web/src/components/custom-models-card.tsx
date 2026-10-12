"use client";
import { geoText } from "@/geo/i18n";

/**
 * Settings → Providers → Custom model servers.
 *
 * Edits Pi's models.json through the backend: one card per provider, a table
 * of models with pricing. Hand-written providers (not created here) are shown
 * read-only so a models.json shared with a standalone Pi is never clobbered.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, ServerIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CUSTOM_MODEL_APIS,
  getCustomProviders,
  saveCustomProviders,
  type CustomModelApi,
  type CustomModelDefinition,
  type CustomProvider,
  type CustomProviderListing,
} from "@/lib/custom-models";
import { notifyProviderAuthChanged } from "@/lib/use-provider-auth";
import { SettingsError } from "@/components/settings/primitives";

const settingsText = geoText("settings");

interface ModelRow {
  id: string;
  name: string;
  contextWindow: string;
  maxTokens: string;
  reasoning: boolean;
  image: boolean;
  costInput: string;
  costOutput: string;
}

interface ProviderDraft {
  id: string;
  name: string;
  baseUrl: string;
  api: CustomModelApi;
  apiKey: string;
  /** Mask of the key saved server-side; a blank field keeps it. */
  savedKeyMask?: string;
  models: ModelRow[];
}

const emptyModel = (): ModelRow => ({
  id: "",
  name: "",
  contextWindow: "",
  maxTokens: "",
  reasoning: false,
  image: false,
  costInput: "",
  costOutput: "",
});

const emptyProvider = (): ProviderDraft => ({
  id: "",
  name: "",
  baseUrl: "",
  api: "openai-completions",
  apiKey: "",
  models: [emptyModel()],
});

function draftFrom(p: CustomProviderListing): ProviderDraft {
  return {
    id: p.id,
    name: p.name ?? "",
    baseUrl: p.baseUrl,
    api: p.api,
    apiKey: p.apiKey && p.apiKey !== "none" ? p.apiKey : "",
    ...(p.apiKeySaved ? { savedKeyMask: p.apiKeyMasked || "••••" } : {}),
    models: p.models.map((m) => ({
      id: m.id,
      name: m.name ?? "",
      contextWindow: m.contextWindow ? String(m.contextWindow) : "",
      maxTokens: m.maxTokens ? String(m.maxTokens) : "",
      reasoning: m.reasoning ?? false,
      image: m.input?.includes("image") ?? false,
      costInput: String(m.cost?.input ?? 0),
      costOutput: String(m.cost?.output ?? 0),
    })),
  };
}

/** Pure: turn drafts into the wire shape, or return the first problem. */
export function providersFromDrafts(drafts: ProviderDraft[]): CustomProvider[] | string {
  const out: CustomProvider[] = [];
  for (const d of drafts) {
    const id = d.id.trim().toLowerCase();
    if (!id) return settingsText("custom_models.every_server_needs_an_id");
    if (!d.baseUrl.trim()) return settingsText("custom_models.server_needs_a_base_url", { v0: id });
    const models: CustomModelDefinition[] = [];
    for (const m of d.models) {
      const modelId = m.id.trim();
      if (!modelId) continue;
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const cw = num(m.contextWindow);
      const mt = num(m.maxTokens);
      const ci = Number(m.costInput || 0);
      const co = Number(m.costOutput || 0);
      if ([cw, mt, ci, co].some((n) => n !== undefined && !Number.isFinite(n))) {
        return settingsText("custom_models.model_has_a_non_numeric_field", { v0: modelId });
      }
      const def: CustomModelDefinition = {
        id: modelId,
        ...(m.name.trim() ? { name: m.name.trim() } : {}),
        reasoning: m.reasoning,
        input: m.image ? ["text", "image"] : ["text"],
        ...(cw !== undefined ? { contextWindow: cw } : {}),
        ...(mt !== undefined ? { maxTokens: mt } : {}),
        cost: { input: ci, output: co, cacheRead: 0, cacheWrite: 0 },
      };
      models.push(def);
    }
    if (models.length === 0) return settingsText("custom_models.server_needs_at_least_one_model_id", { v0: id });
    out.push({
      id,
      ...(d.name.trim() ? { name: d.name.trim() } : {}),
      baseUrl: d.baseUrl.trim(),
      api: d.api,
      ...(d.apiKey.trim() ? { apiKey: d.apiKey.trim() } : d.savedKeyMask ? { keepApiKey: true } : {}),
      models,
    });
  }
  return out;
}

export function CustomModelsCard() {
  const [foreign, setForeign] = useState<CustomProviderListing[]>([]);
  const [drafts, setDrafts] = useState<ProviderDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const providers = await getCustomProviders();
      setForeign(providers.filter((p) => !p.managed));
      setDrafts(providers.filter((p) => p.managed).map(draftFrom));
      setDirty(false);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("custom_models.failed_to_load_custom_model_servers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const edit = useCallback((index: number, patch: Partial<ProviderDraft>) => {
    setDrafts((ds) => ds.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setDirty(true);
  }, []);
  const editModel = useCallback((pi: number, mi: number, patch: Partial<ModelRow>) => {
    setDrafts((ds) =>
      ds.map((d, i) =>
        i === pi ? { ...d, models: d.models.map((m, j) => (j === mi ? { ...m, ...patch } : m)) } : d,
      ),
    );
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    const providers = providersFromDrafts(drafts);
    if (typeof providers === "string") {
      setError(providers);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveCustomProviders(providers);
      setDrafts(result.providers.filter((p) => p.managed).map(draftFrom));
      setForeign(result.providers.filter((p) => !p.managed));
      setConfigured(result.configured);
      setDirty(false);
      // The picker's direct-provider section lists custom servers too.
      notifyProviderAuthChanged();
      const unreachable = Object.entries(result.configured).filter(([, ok]) => !ok).map(([id]) => id);
      setNotice(
        unreachable.length
          ? settingsText("custom_models.saved_pi_could_not_resolve_credentials_for_check_the_api_key", { v0: unreachable.join(", ") })
          : settingsText("custom_models.saved_the_servers_are_available_in_the_model_picker_now"),
      );
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("custom_models.save_failed"));
    } finally {
      setSaving(false);
    }
  }, [drafts]);

  const canSave = useMemo(() => dirty && !saving, [dirty, saving]);

  return (
    <section className="min-w-0 max-w-full rounded-lg border p-3" aria-label={settingsText("custom_models.custom_model_servers")} data-testid="custom-models-card">
      <div className="flex items-start gap-2">
        <ServerIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium">{settingsText("custom_models.custom_model_servers")}</div>
          <p className="text-[11px] text-muted-foreground">
            {settingsText("custom_models.any_openai_or_anthropic_compatible_endpoint_a_lab_vllm_box_an_institutional_gateway_with_i")}<code>server-id/model-id</code>{settingsText("custom_models.usage_is_billed_at_the_cost_you_declare_and_counts_toward_the_spend_cap")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => {
            setDrafts((ds) => [...ds, emptyProvider()]);
            setDirty(true);
          }}
        >
          <PlusIcon className="size-3.5" />
          {settingsText("custom_models.add_model_server")}
        </Button>
      </div>

      <SettingsError className="mt-2">{error}</SettingsError>
      {notice && <p className="mt-2 text-xs text-muted-foreground">{notice}</p>}
      {loading && <p className="mt-2 text-xs text-muted-foreground">{settingsText("custom_models.loading")}</p>}

      {foreign.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {settingsText("custom_models.defined_by_hand_in_models_json_read_only_here")}
          {foreign.map((p) => (
            <Badge key={p.id} variant="outline" className="h-5 font-mono text-[10px]">
              {p.id}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {drafts.map((d, pi) => (
          <div key={pi} className="rounded-md border p-3" data-testid={`custom-provider-${pi}`}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-muted-foreground">
                {settingsText("custom_models.server_id_becomes_the_model_prefix")}
                <Input
                  value={d.id}
                  placeholder="hpc-vllm"
                  className="mt-1 h-8 font-mono text-xs"
                  aria-label={settingsText("custom_models.server_id", { v0: pi + 1 })}
                  onChange={(e) => edit(pi, { id: e.target.value })}
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                {settingsText("custom_models.display_name")}
                <Input
                  value={d.name}
                  placeholder="Lab vLLM"
                  className="mt-1 h-8 text-xs"
                  aria-label={settingsText("custom_models.server_name", { v0: pi + 1 })}
                  onChange={(e) => edit(pi, { name: e.target.value })}
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                {settingsText("custom_models.base_url")}
                <Input
                  value={d.baseUrl}
                  placeholder="http://gpu-node:8000/v1"
                  className="mt-1 h-8 font-mono text-xs"
                  aria-label={settingsText("custom_models.server_base_url", { v0: pi + 1 })}
                  onChange={(e) => edit(pi, { baseUrl: e.target.value })}
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                {settingsText("custom_models.api")}
                <select
                  className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
                  aria-label={settingsText("custom_models.server_api", { v0: pi + 1 })}
                  value={d.api}
                  onChange={(e) => edit(pi, { api: e.target.value as CustomModelApi })}
                >
                  {CUSTOM_MODEL_APIS.map((api) => (
                    <option key={api} value={api}>
                      {api}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground sm:col-span-2">
                {settingsText("custom_models.api_key_literal")}<code>$ENV_VAR</code>{settingsText("custom_models.or_empty_for_a_keyless_server")}
                <Input
                  value={d.apiKey}
                  type={d.apiKey && !d.apiKey.startsWith("$") ? "password" : "text"}
                  autoComplete="off"
                  placeholder={d.savedKeyMask ? settingsText("custom_models.saved_key_leave_blank_to_keep_it", { v0: d.savedKeyMask }) : "$LAB_VLLM_KEY"}
                  className="mt-1 h-8 font-mono text-xs"
                  aria-label={settingsText("custom_models.server_api_key", { v0: pi + 1 })}
                  onChange={(e) => edit(pi, { apiKey: e.target.value })}
                />
                {d.savedKeyMask && !d.apiKey && (
                  <button
                    type="button"
                    className="mt-1 underline decoration-dotted"
                    onClick={() => edit(pi, { savedKeyMask: undefined })}
                  >
                    {settingsText("custom_models.remove_saved_key")}
                  </button>
                )}
              </label>
            </div>

            <ul className="mt-3 flex flex-col gap-2" aria-label={settingsText("custom_models.server_models", { v0: pi + 1 })}>
              {d.models.map((m, mi) => (
                <li key={mi} className="rounded-md border border-dashed p-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.model_id")}
                      <Input value={m.id} placeholder="llama-3.3-70b" className="mt-1 h-7 font-mono text-[11px]" aria-label={settingsText("custom_models.server_model_id", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { id: e.target.value })} />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.display_name")}<Input value={m.name} className="mt-1 h-7 text-[11px]" aria-label={settingsText("custom_models.server_model_name", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { name: e.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.context")}
                      <Input value={m.contextWindow} inputMode="numeric" placeholder="128000" className="mt-1 h-7 text-[11px]" aria-label={settingsText("custom_models.server_model_context", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { contextWindow: e.target.value })} />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.max_output")}
                      <Input value={m.maxTokens} inputMode="numeric" placeholder="16384" className="mt-1 h-7 text-[11px]" aria-label={settingsText("custom_models.server_model_max_tokens", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { maxTokens: e.target.value })} />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.m_input")}
                      <Input value={m.costInput} inputMode="decimal" placeholder="0" className="mt-1 h-7 text-[11px]" aria-label={settingsText("custom_models.server_model_input_cost", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { costInput: e.target.value })} />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      {settingsText("custom_models.m_output")}
                      <Input value={m.costOutput} inputMode="decimal" placeholder="0" className="mt-1 h-7 text-[11px]" aria-label={settingsText("custom_models.server_model_output_cost", { v0: pi + 1, v1: mi + 1 })} onChange={(e) => editModel(pi, mi, { costOutput: e.target.value })} />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                    <label className="flex items-center gap-2">
                      <Switch checked={m.reasoning} aria-label={settingsText("custom_models.server_model_reasoning", { v0: pi + 1, v1: mi + 1 })} onCheckedChange={(v) => editModel(pi, mi, { reasoning: v })} />
                      {settingsText("custom_models.reasoning_model")}
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch checked={m.image} aria-label={settingsText("custom_models.server_model_images", { v0: pi + 1, v1: mi + 1 })} onCheckedChange={(v) => editModel(pi, mi, { image: v })} />
                      {settingsText("custom_models.accepts_images")}
                    </label>
                    <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-[11px]" aria-label={settingsText("custom_models.remove_server_model", { v0: pi + 1, v1: mi + 1 })} onClick={() => edit(pi, { models: d.models.filter((_, j) => j !== mi) })}>
                      <Trash2Icon className="size-3.5" />
                      {settingsText("custom_models.remove_model")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => edit(pi, { models: [...d.models, emptyModel()] })}>
                <PlusIcon className="size-3.5" />
                {settingsText("custom_models.add_model")}
              </Button>
              {configured[d.id] === false && (
                <Badge variant="outline" className="h-5 text-[10px] text-amber-600">
                  {settingsText("custom_models.credentials_unresolved")}
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-[11px] text-destructive"
                aria-label={settingsText("custom_models.remove_server", { v0: pi + 1 })}
                onClick={() => {
                  setDrafts((ds) => ds.filter((_, i) => i !== pi));
                  setDirty(true);
                }}
              >
                <Trash2Icon className="size-3.5" />
                {settingsText("custom_models.remove_server_263")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {(drafts.length > 0 || dirty) && (
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!canSave} onClick={() => void save()}>
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {settingsText("custom_models.save_servers")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => void load()}>
            {settingsText("custom_models.discard_changes")}
          </Button>
        </div>
      )}
    </section>
  );
}
