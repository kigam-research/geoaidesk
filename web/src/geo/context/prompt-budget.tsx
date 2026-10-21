"use client";

/**
 * Start-prompt budget chip next to the context gauge (plan §3.8): how much of
 * the selected model's context the instructions and tool descriptions take
 * before any conversation, which skills this chat offers the model, and the
 * skill selection for new chats. Before the first message the numbers come
 * from a preview of a new chat (`/geo/context/preview`).
 */
import { FileTextIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatCompactTokens } from "@/lib/utils";
import { geoLocale } from "@/geo/i18n";
import {
  getCatalogueSummary,
  getNewChatExposure,
  getPreviewContext,
  getSessionContext,
  putNewChatExposure,
  type CatalogueWorkflow,
  type ExposureMode,
  type SessionContext,
} from "./api";
import { t } from "./strings";

function modeLabel(mode: ExposureMode, workflows: CatalogueWorkflow[]): string {
  if (mode === "all") return t("modeAll");
  if (mode === "catalogue") return t("modeCatalogue");
  const id = mode.slice("workflow:".length);
  const workflow = workflows.find((w) => w.id === id);
  const title = workflow ? (geoLocale() === "en" ? workflow.title.en ?? workflow.title.ko : workflow.title.ko) : id;
  return t("modeWorkflow", { title });
}

export function GeoPromptBudget({
  projectId,
  sessionId,
  modelRef,
  refreshKey,
  pendingExposure,
}: {
  projectId: string;
  sessionId: string | null;
  /** Exposure the chat's session will be created with (a started task), previewed before the first send. */
  pendingExposure?: string;
  /** The picker's model ref; the budget is computed against its context window. */
  modelRef?: string;
  /** Changes when a run settles, so the measured usage is refreshed. */
  refreshKey?: unknown;
}) {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<CatalogueWorkflow[]>([]);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [newChat, setNewChat] = useState<ExposureMode | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = sessionId
        ? await getSessionContext(projectId, sessionId, modelRef)
        : await getPreviewContext(projectId, modelRef, pendingExposure);
      setContext(next);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId, sessionId, modelRef, pendingExposure]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const loadSettings = useCallback(async () => {
    try {
      const [summary, mode] = await Promise.all([getCatalogueSummary(projectId), getNewChatExposure(projectId)]);
      setWorkflows(summary.workflows);
      setCatalogueReady(summary.status.state === "ready");
      setNewChat(mode);
    } catch {
      // The chip still works without the settings part.
    }
  }, [projectId]);

  if (error && !context) {
    return (
      <span className="px-1 text-[11px] text-muted-foreground" title={t("loadError", { message: error })}>
        {t("chipUnknown")}
      </span>
    );
  }
  if (!context) return null;

  const { budget, exposure } = context;
  const fraction = budget.remainingFraction;
  const low = fraction !== null && fraction < 0.5;
  const exhausted = budget.remainingTokens !== null && budget.remainingTokens <= 0;
  const mode = exposure?.mode ?? budget.skills.mode;

  const onChangeNewChat = async (value: ExposureMode) => {
    try {
      setNewChat(await putNewChatExposure(projectId, value));
      setSaved(true);
      if (!sessionId) void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Popover onOpenChange={(open) => open && void loadSettings()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("title")}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-mono text-[11px] tabular-nums text-muted-foreground hover:bg-muted",
            low && "bg-gaid-warning-bg text-gaid-warning",
            exhausted && "bg-destructive/10 text-destructive",
          )}
        >
          <FileTextIcon className="size-3.5 shrink-0" aria-hidden />
          <span>{t("chip", { tokens: formatCompactTokens(budget.initialPrompt.estimatedTokens) })}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 text-xs">
        <div>
          <p className="font-medium">{t("title")}</p>
          <p className="mt-1 text-muted-foreground">{t("intro")}</p>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
          <dt className="text-muted-foreground">{t("model")}</dt>
          <dd className="max-w-40 truncate text-right" title={budget.model?.ref}>
            {budget.model?.ref ?? t("noModel")}
          </dd>
          {budget.model && (
            <>
              <dt className="text-muted-foreground">{t("contextWindow")}</dt>
              <dd className="text-right">{formatCompactTokens(budget.model.contextWindow)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("initialPrompt")}</dt>
          <dd className="text-right">≈{formatCompactTokens(budget.initialPrompt.estimatedTokens)}</dd>
          {budget.model && (
            <>
              <dt className="text-muted-foreground">{t("outputReserve")}</dt>
              <dd className="text-right">{formatCompactTokens(budget.model.maxOutputTokens)}</dd>
            </>
          )}
          {budget.remainingTokens !== null && (
            <>
              <dt className="text-muted-foreground">{t("remaining")}</dt>
              <dd className={cn("text-right", low && "text-gaid-warning", exhausted && "text-destructive")}>
                {formatCompactTokens(Math.max(0, budget.remainingTokens))}
                {fraction !== null && ` (${Math.max(0, Math.round(fraction * 100))}%)`}
              </dd>
            </>
          )}
        </dl>
        {low && <p className="text-gaid-warning">{t("remainingWarn")}</p>}
        <p className="text-muted-foreground">
          {t("tools", { count: budget.initialPrompt.tools })} ·{" "}
          {t("skills", { exposed: budget.skills.exposed, installed: budget.skills.installed })}
        </p>
        <p>{t("mode", { mode: modeLabel(mode, workflows) })}</p>
        {newChat !== null && (
          <label className="block space-y-1">
            <span className="font-medium">{t("newChat")}</span>
            <select
              className="w-full rounded-md border bg-background px-2 py-1"
              value={newChat}
              onChange={(event) => void onChangeNewChat(event.target.value as ExposureMode)}
            >
              {catalogueReady && <option value="catalogue">{t("modeCatalogue")}</option>}
              {workflows.map((workflow) => (
                <option key={workflow.id} value={`workflow:${workflow.id}`}>
                  {modeLabel(`workflow:${workflow.id}`, workflows)}
                </option>
              ))}
              <option value="all">{t("modeAll")}</option>
            </select>
            <span className="block text-muted-foreground">
              {t("newChatNote")}
              {saved && ` ${t("saved")}.`}
            </span>
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
}
