"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/projects";
import type { SkillScope, SkillSourcePreview } from "@/lib/capabilities";
import { t } from "@/geo/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MethodLifecycle, MethodImplementation } from "@/geo/contracts/methods";
import type { Localized } from "@/geo/contracts/workspace";
import { text } from "@/geo/workspace/api";

export interface SkillHubPreview extends SkillSourcePreview {
  skillHub?: { sha256: string; pageUrl?: string; skillId?: string; siteId?: string; catalogueAvailable: boolean; catalogueNames: string[]; draft?: { methodId: string; revision: number; lifecycle: MethodLifecycle; url: string } };
}
export function skillHubSource(preview: SkillHubPreview): string {
  return preview.skillHub?.pageUrl ?? (preview.skillHub ? t("skillHub.source", { digest: preview.skillHub.sha256.slice(0, 12) }) : preview.source);
}
export function SkillHubPreviewNotes({ preview }: { preview: SkillHubPreview }) {
  const hub = preview.skillHub;
  if (!hub) return null;
  return <div className="space-y-2 break-words text-xs" aria-live="polite">
    {hub.draft && <p>{t("skillHub.methodDraft", { id: hub.draft.methodId, revision: hub.draft.revision, lifecycle: t(`methods.lifecycle.${hub.draft.lifecycle}`) })}</p>}
    {hub.catalogueNames.length > 0 && <p className="rounded-md border border-amber-500/50 p-2">{t("skillHub.catalogue", { names: hub.catalogueNames.join(", ") })}</p>}
    {!hub.catalogueAvailable && <p>{t("skillHub.catalogueUnavailable")}</p>}
    <p className="text-muted-foreground">{t("skillHub.snapshot", { digest: hub.sha256 })}</p>
  </div>;
}

/** This component only previews. SkillsPanel owns selection, acknowledgement and installation. */
export function SkillHubInstall({ scope, projectId, disabled, onStart, onPreview, onError, onSettled }: {
  scope: SkillScope; projectId: string; disabled?: boolean; onStart: () => void; onPreview: (preview: SkillHubPreview) => void; onError: (error: string) => void; onSettled?: () => void;
}) {
  const [sites, setSites] = useState<{ id: string; url: string }[]>([]);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    void apiFetch("/geo/skill-hub", {}, projectId).then(async (res) => {
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (alive) setSites(data.sites);
    }).catch(() => { if (alive) onError(t("skillHub.errors.request")); });
    return () => { alive = false; generation.current++; };
    // The parent keys this pane by project and scope, invalidating in-flight results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const preview = async (upload: boolean, descriptorUrl?: string) => {
    const ticket = ++generation.current;
    setLoading(true);
    onStart();
    try {
      if (upload && (!file || !file.name.endsWith(".tar.gz"))) throw new Error(t("skillHub.errors.input"));
      if (upload && file!.size > 20 * 1024 * 1024) throw new Error(t("skillHub.errors.size"));
      const form = new FormData();
      if (upload) form.append("package", file!);
      const res = await apiFetch(`/geo/skill-hub/preview?scope=${scope}`, {
        method: "POST",
        ...(upload ? { body: form } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: descriptorUrl ?? url.trim(), scope }) }),
      }, projectId);
      const data = await res.json();
      if (!res.ok) {
        const code = ["url", "download", "size", "archive", "input"].includes(data.code) ? data.code : "request";
        throw new Error(t(`skillHub.errors.${code}`));
      }
      if (ticket === generation.current) onPreview(data);
    } catch (error) {
      if (ticket === generation.current) onError(error instanceof Error ? error.message : t("skillHub.errors.request"));
    } finally { if (ticket === generation.current) { setLoading(false); onSettled?.(); } }
  };
  return <section className="flex min-w-0 flex-col gap-2 rounded-md border p-3" aria-label={t("skillHub.title")}>
    <h3 className="text-xs font-medium">{t("skillHub.title")}</h3>
    {sites.map((site) => <a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer" className="w-fit text-xs text-primary underline">{t("skillHub.browse")}{sites.length > 1 ? ` (${site.id})` : ""}</a>)}
    <SkillHubMethods projectId={projectId} disabled={loading || disabled} onPreview={(descriptorUrl) => void preview(false, descriptorUrl)} />
    <p className="text-xs text-muted-foreground">{t("skillHub.help")}</p>
    <label className="text-xs" htmlFor="skill-hub-url">{t("skillHub.url")}</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input id="skill-hub-url" value={url} placeholder={t("skillHub.placeholder")} disabled={loading || disabled} onChange={(e) => setUrl(e.target.value)} className="h-8 min-w-0 flex-1 text-xs" />
      <Button type="button" variant="outline" size="sm" disabled={!url.trim() || loading || disabled} onClick={() => void preview(false)}>{t("skillHub.preview")}</Button>
    </div>
    <label className="text-xs" htmlFor="skill-hub-file">{t("skillHub.file")}</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input id="skill-hub-file" type="file" accept=".tar.gz,application/gzip" disabled={loading || disabled} className="min-w-0 flex-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button type="button" variant="outline" size="sm" disabled={!file || loading || disabled} onClick={() => void preview(true)}>{t("skillHub.upload")}</Button>
    </div>
    <p className="text-[11px] text-muted-foreground">{t("skillHub.sizeHelp")}</p>
    {loading && <p role="status" className="text-xs">{t("skillHub.loading")}</p>}
  </section>;
}

interface HubMethod {
  methodId: string; revision: number; version: string; lifecycle: MethodLifecycle;
  implementation: MethodImplementation; title: Localized; createdAt: string; descriptorUrl: string;
}
interface HubMethodsResponse { hubs: { siteId: string; url: string; state: "ok" | "error"; detail?: string; methods: HubMethod[] }[] }

/** Read-only listing. Preview is delegated to SkillHubInstall so the acknowledgement gate is unchanged. */
export function SkillHubMethods({ projectId, disabled, onPreview }: { projectId: string; disabled?: boolean; onPreview: (url: string) => void }) {
  const [data, setData] = useState<HubMethodsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void apiFetch("/geo/skill-hub/methods", {}, projectId).then(async (response) => {
      if (!response.ok) throw new Error(response.statusText || String(response.status));
      const result = await response.json() as HubMethodsResponse;
      if (alive) setData(result);
    }).catch((err) => { if (alive) setError(t("skillHub.methodsError", { detail: (err as Error).message })); });
    return () => { alive = false; };
  }, [projectId]);
  return <section className="space-y-2" aria-label={t("skillHub.methods")}>
    <h4 className="text-xs font-medium">{t("skillHub.methods")}</h4>
    {!data && !error && <p role="status" className="text-xs">{t("skillHub.methodsLoading")}</p>}
    {error && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
    {data?.hubs.length === 0 && <p className="text-xs text-muted-foreground">{t("skillHub.methodsEmpty")}</p>}
    {data?.hubs.map((hub) => <div key={hub.siteId} className="space-y-2 rounded border p-2 text-xs break-words">
      <p className="font-medium">{hub.siteId}</p>
      {hub.state === "error" ? <p role="alert" className="text-destructive">{t("skillHub.methodsError", { detail: hub.detail ?? hub.url })}</p> : hub.methods.length === 0 ? <p>{t("skillHub.methodsEmpty")}</p> : hub.methods.map((method) => <div key={`${method.methodId}:${method.revision}`} className="space-y-1 border-t pt-2">
        <p>{text(method.title)}</p>
        <p>{t("methods.revision", { version: method.version, revision: method.revision })}</p>
        <p>{t(`methods.lifecycle.${method.lifecycle}`)} · {t(`methods.implementation.${method.implementation}`)}</p>
        <p>{t("skillHub.methodCreated", { at: Number.isNaN(Date.parse(method.createdAt)) ? method.createdAt : new Date(method.createdAt).toLocaleString() })}</p>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onPreview(method.descriptorUrl)}>{t("skillHub.methodPreview")}</Button>
      </div>)}
    </div>)}
  </section>;
}
