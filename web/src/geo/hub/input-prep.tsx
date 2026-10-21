"use client";
/**
 * After a draft is installed into a project: the inputs its Workflow needs, the matching files already in that
 * project, and an upload per input. The start settings open only when every required input has a file, so the
 * researcher never lands in a setup form with nothing to choose (gaid-hub, user feedback 2026-10-16).
 */
import { CheckIcon, CircleDashedIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LocalMethodsResponse, LocalMethodWorkflow } from "@/geo/contracts/methods";
import { geoText } from "@/geo/i18n";
import { accepts, text as local } from "@/geo/workspace/api";
import { PrepareEnvironment } from "@/geo/workspace/readiness";
import { apiFetch } from "@/lib/projects";
import { flattenFiles, type TreeNode } from "@/lib/use-sandbox";

import { TechnicalDetail } from "./technical";
const text = geoText("hub");

async function projectFiles(projectId: string): Promise<string[]> {
  const res = await apiFetch("/sandbox/tree", {}, projectId);
  return res.ok ? flattenFiles((await res.json()) as TreeNode) : [];
}

async function methodWorkflow(projectId: string, methodKey: string): Promise<LocalMethodWorkflow | null> {
  const res = await apiFetch("/geo/methods", {}, projectId);
  if (!res.ok) return null;
  const method = ((await res.json()) as LocalMethodsResponse).methods.find((m) => m.key === methodKey);
  return method?.workflows[0] ?? null;
}

/** The setup can start: required inputs present and the Workflow environment ready. */
export function setupReady(workflow: LocalMethodWorkflow, files: string[]): boolean {
  return inputsReady(workflow, files) && workflow.readiness.state === "ready";
}

/** Required input roles that have at least one matching file. */
export function inputsReady(workflow: LocalMethodWorkflow, files: string[]): boolean {
  return workflow.inputRoles.filter((r) => r.required).every((r) => files.some((f) => accepts(f, r.extensions)));
}

export function InputPrep({
  projectId,
  projectName,
  methodKey,
  onOpenSetup,
  secondary = false,
}: {
  /** Shown beside another view's primary action (draft rail): the open button is not a filled primary (UI guide B1). */
  secondary?: boolean;
  projectId: string;
  projectName: string;
  methodKey: string;
  onOpenSetup: () => void;
}) {
  const [workflow, setWorkflow] = useState<LocalMethodWorkflow | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const pickers = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const [w, f] = await Promise.all([methodWorkflow(projectId, methodKey), projectFiles(projectId)]);
    setWorkflow(w);
    setFiles(f);
    setLoading(false);
  }, [projectId, methodKey]);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (roleId: string, list: FileList | null) => {
    if (!list?.length) return;
    setUploading(roleId);
    setError(null);
    setErrorDetail(null);
    try {
      const body = new FormData();
      for (const file of Array.from(list)) {
        body.append("files", file);
        body.append("paths", "");
      }
      const res = await apiFetch("/sandbox/upload", { method: "POST", body }, projectId);
      if (!res.ok)
        throw new Error(
          ((await res.json().catch(() => null)) as { detail?: string } | null)?.detail ?? `HTTP ${res.status}`,
        );
      await load();
    } catch (e) {
      setError(text("prep.uploadFailed"));
      setErrorDetail((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  if (loading)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        {text("prep.loading")}
      </p>
    );
  if (!workflow)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{text("prep.noWorkflow")}</p>
        <Button variant={secondary ? "outline" : "default"} onClick={onOpenSetup}>
          {text("prep.openProject")}
        </Button>
      </div>
    );
  const ready = setupReady(workflow, files);
  const envReady = workflow.readiness.state === "ready";
  const extra = workflow.extraPackages ?? [];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium">{text("prep.title", { project: projectName })}</p>
      <ul className="flex flex-col gap-2">
        {workflow.inputRoles.map((role) => {
          const matches = files.filter((f) => accepts(f, role.extensions));
          return (
            <li key={role.id} className="flex min-w-0 flex-col gap-1.5 rounded-none border p-2.5 text-sm">
              <span className="flex items-center gap-2">
                {matches.length ? (
                  <CheckIcon className="size-4 text-gaid-link" aria-hidden />
                ) : (
                  <CircleDashedIcon className="size-4 text-muted-foreground" aria-hidden />
                )}
                <span className="font-medium">{local(role.label)}</span>
                <span className="text-xs text-muted-foreground">
                  {role.required ? text("prep.required") : text("prep.optional")} · {role.extensions.join(", ")}
                </span>
              </span>
              {matches.length > 0 && (
                <span className="truncate pl-6 text-xs text-muted-foreground" title={matches.join("\n")}>
                  {matches
                    .slice(0, 3)
                    .map((m) => m.split("/").at(-1))
                    .join(", ")}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-6 self-start"
                disabled={Boolean(uploading)}
                onClick={() => pickers.current[role.id]?.click()}
              >
                {uploading === role.id ? (
                  <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <UploadIcon data-icon="inline-start" />
                )}
                {text("prep.upload")}
              </Button>
              <input
                ref={(el) => {
                  pickers.current[role.id] = el;
                }}
                type="file"
                hidden
                multiple
                accept={role.extensions.map((e) => `.${e}`).join(",")}
                onChange={(e) => {
                  void upload(role.id, e.target.files);
                  e.target.value = "";
                }}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1.5 rounded-none border p-2.5 text-sm">
        <span className="flex items-center gap-2">
          {envReady ? (
            <CheckIcon className="size-4 text-gaid-link" aria-hidden />
          ) : (
            <CircleDashedIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
          <span className="font-medium">{text("prep.environment")}</span>
          <span className="text-xs text-muted-foreground">
            {local(workflow.readiness.environment.title) || workflow.readiness.environment.id}
          </span>
        </span>
        <div className="pl-6">
          <PrepareEnvironment value={workflow.readiness} projectId={projectId} onPrepared={load} />
        </div>
        {extra.length > 0 && (
          <p className="pl-6 text-xs text-muted-foreground">
            {text("prep.extraPackages", {
              packages: extra.map((p) => (p.required ? p.name : text("prep.optionalPackage", { name: p.name }))).join(", "),
            })}
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <TechnicalDetail detail={errorDetail} />
      <Button variant={secondary ? "outline" : "default"} onClick={onOpenSetup} disabled={!ready}>
        {text("prep.openSetup")}
      </Button>
      {!ready && <p className="text-xs text-muted-foreground">{text("prep.needInputs")}</p>}
    </div>
  );
}
