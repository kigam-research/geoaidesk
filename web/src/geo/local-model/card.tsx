"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsCard, SettingsError } from "@/components/settings/primitives";
import { apiFetch } from "@/lib/projects";
import { PROVIDER_AUTH_CHANGED_EVENT } from "@/lib/use-provider-auth";
import { t } from "./strings";

export interface LocalModelStatus {
  baseUrl: string; reachable: boolean; error: string | null;
  models: Array<{ model: string; configuredContext: number | null; trainedContext: number | null; loadedContext: number | null }>;
  provider: { models: Array<{ id: string; contextWindow?: number; maxTokens?: number }> } | null;
  defaults: { model?: string };
  verification: { state: "verified" | "mismatch" | "unverified" };
  profiles: Array<{ id: string; contextWindow: number; evidence: string }>;
}

async function request(path: string, init?: RequestInit): Promise<LocalModelStatus> {
  const res = await apiFetch(`/geo/local-model/${path}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? t("failed"));
  return data;
}

export function LocalModelCard() {
  const [status, setStatus] = useState<LocalModelStatus | null>(null);
  const [model, setModel] = useState("");
  const [context, setContext] = useState(32_768);
  const [output, setOutput] = useState(4_096);
  const [profile, setProfile] = useState("proposed-32k");
  const [variant, setVariant] = useState(false);
  const [useDefault, setUseDefault] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apply = useCallback((data: LocalModelStatus) => {
    setStatus(data);
    const entry = data.provider?.models[0];
    setModel(entry?.id ?? data.models[0]?.model ?? "");
    if (entry?.contextWindow) setContext(entry.contextWindow);
    setProfile(data.profiles.find(item => item.contextWindow === (entry?.contextWindow ?? 32768))?.id ?? "custom");
    if (entry?.maxTokens) setOutput(entry.maxTokens);
    setUseDefault(Boolean(entry && data.defaults.model === `gaid-local/${entry.id}`));
  }, []);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { apply(await request("status")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("failed")); }
    finally { setBusy(false); }
  }, [apply]);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    if (!model || !Number.isInteger(context) || context < 1000 || context > 100_000_000
      || !Number.isInteger(output) || output < 1 || output > 10_000_000 || output >= context) {
      setError(t("invalid")); return;
    }
    setBusy(true); setError(null);
    try {
      apply(await request("configure", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, contextWindow: context, maxTokens: output, createVariant: variant, setDefault: useDefault }) }));
      setVariant(false); setSaved(true);
      window.dispatchEvent(new Event(PROVIDER_AUTH_CHANGED_EVENT));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("failed"));
      // Save can partially succeed (e.g. runtime reload or default-file conflict).
      try { setStatus(await request("status")); } catch { /* retain the actionable original error */ }
    } finally { setBusy(false); }
  };
  const selected = status?.models.find(item => item.model === model);
  const entry = status?.provider?.models[0];
  const profileLabel = (id: string) => t(id === "recorded-96k" ? "recorded" : id === "proposed-32k" ? "compact32" : "compact64");
  const number = (value: number | null | undefined) => value ?? t("unknown");
  const fieldClass = "rounded-md border bg-background px-2 py-1.5 text-xs";

  return <SettingsCard title={t("title")} description={t("description")}>
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span role="status">{status ? t(status.reachable ? "reachable" : "unreachable") : t("loading")}</span>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void load()}>{t("refresh")}</Button>
      </div>
      {status && <code className="break-all text-muted-foreground">{status.baseUrl}</code>}
      <SettingsError>{error ?? status?.error}</SettingsError>
      <form onSubmit={save} className="flex flex-col gap-3">
        <fieldset disabled={busy} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">{t("model")}
            <select aria-label={t("model")} className={fieldClass} value={model} onChange={event => { setModel(event.target.value); setSaved(false); }}>
              <option value="">{t("choose")}</option>
              {entry && !status?.models.some(item => item.model === entry.id) && <option value={entry.id}>{entry.id}</option>}
              {status?.models.map(item => <option key={item.model} value={item.model}>{item.model}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>{t("configured", { value: number(selected?.configuredContext) })}</span>
            <span>{t("trained", { value: number(selected?.trainedContext) })}</span>
            <span>{t("loaded", { value: number(selected?.loadedContext) })}</span>
          </div>
          <label className="flex flex-col gap-1">{t("profile")}
            <select aria-label={t("profile")} className={fieldClass} value={profile} onChange={event => {
              setProfile(event.target.value); setSaved(false);
              const profile = status?.profiles.find(item => item.id === event.target.value);
              if (profile) setContext(profile.contextWindow);
            }}>
              {status?.profiles.map(item => <option key={item.id} value={item.id}>{profileLabel(item.id)}</option>)}
              <option value="custom">{t("custom")}</option>
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">{t("context")}<Input aria-label={t("context")} type="number" min={1000} max={100_000_000} step={1} value={context} onChange={e => { setContext(Number(e.target.value)); setProfile("custom"); setSaved(false); }} /></label>
            <label className="flex flex-col gap-1">{t("output")}<Input aria-label={t("output")} type="number" min={1} max={Math.min(context - 1, 10_000_000)} step={1} value={output} onChange={e => { setOutput(Number(e.target.value)); setSaved(false); }} /></label>
          </div>
          <p className="text-muted-foreground">{t("evidence")}</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={variant} onChange={e => setVariant(e.target.checked)} />{t("variant")}</label>
          <p className="text-muted-foreground">{t("variantHelp")}</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={useDefault} onChange={e => setUseDefault(e.target.checked)} />{t("default")}</label>
          <p className="text-muted-foreground">{t("defaultHelp")}</p>
          <Button type="submit" disabled={!status?.reachable || !model}>{t(busy ? "saving" : "save")}</Button>
        </fieldset>
      </form>
      {saved && <p role="status">{t("saved")}</p>}
      {entry && <>
        <p>{t("persisted", { model: `gaid-local/${entry.id}`, context: number(entry.contextWindow), output: number(entry.maxTokens) })}</p>
        <p role={status?.verification.state === "mismatch" ? "alert" : "status"}>{t(status?.verification.state ?? "unverified")}</p>
      </>}
      {status && <p>{t("appDefault", { model: status.defaults.model ?? t("unknown") })}</p>}
    </div>
  </SettingsCard>;
}
