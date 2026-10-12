"use client";
import { SettingsMessage } from "@/components/settings/primitives";
import { geoText } from "@/geo/i18n";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SettingsLink } from "@/components/settings-link";
import { apiFetch } from "@/lib/projects";
import {
  connectPaperclipConnector,
  getPaperclipConnector,
  type PaperclipConnectorStatus,
} from "@/lib/mcp";
import { notifyModalCredentialsChanged } from "@/lib/modal-jobs";
import { useProjects } from "@/lib/use-projects";
import { cn } from "@/lib/utils";
import { GetKeyLink, KeyRow, useCredentialStatus, type CredentialStatus, type KeyDef } from "./key-row";
import { SettingsCard, SettingsError, SettingsHeader } from "./primitives";

const settingsText = geoText("settings");

const SEARCH_KEY_DEFS: KeyDef[] = [
  {
    id: "exa",
    bodyField: "exaApiKey",
    label: settingsText("services.exa_api_key"),
    placeholder: "exa-…",
    keysUrl: "https://dashboard.exa.ai/api-keys",
    hint: settingsText("services.direct_exa_web_code_search_without_it_web_search_still_works_via_a_free_exa_fallback"),
  },
  {
    id: "perplexity",
    bodyField: "perplexityApiKey",
    label: settingsText("services.perplexity_api_key"),
    placeholder: "pplx-…",
    keysUrl: "https://www.perplexity.ai/settings/api",
    hint: settingsText("services.synthesized_web_answers_with_citations_as_an_alternative_search_provider"),
  },
  {
    id: "gemini",
    bodyField: "geminiApiKey",
    label: settingsText("services.gemini_api_key"),
    placeholder: "AIza…",
    keysUrl: "https://aistudio.google.com/apikey",
    hint: settingsText("services.search_fallback_plus_youtube_and_video_understanding_for_fetched_links_it_is_the_same_gemi"),
    notifyProviders: true,
  },
];

const PAPERCLIP_KEY_DEF: KeyDef = {
  id: "paperclip",
  bodyField: "paperclipApiKey",
  label: settingsText("services.paperclip_api_key"),
  placeholder: "gxl_…",
  keysUrl: "https://paperclip.gxl.ai/keys",
  hint: settingsText("services.checked_with_paperclip_before_it_is_saved_the_connector_reads_the_key_from_env_by_name_so"),
  savedNote: settingsText("services.saved_new_chat_tabs_can_search_paperclip_no_restart_needed"),
};

/**
 * Paperclip literature search: saving the key adds a global MCP connector
 * that sends it (server agent/paperclip.ts); this card also reports and
 * repairs that connector, e.g. for a key set in .env by hand.
 */
function PaperclipCard({
  status,
  onStatus,
}: {
  status: CredentialStatus | null;
  onStatus: (status: CredentialStatus) => void;
}) {
  const [connector, setConnector] = useState<PaperclipConnectorStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConnector(await getPaperclipConnector());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : settingsText("services.could_not_load_the_paperclip_connector"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connectPaperclipConnector();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : settingsText("services.could_not_turn_on_the_paperclip_connector"));
    } finally {
      setBusy(false);
    }
  };

  const keySet = connector?.keySet ?? Boolean(status?.paperclip?.set);
  const ready = Boolean(connector?.name && connector.usesKey && connector.enabled);
  const signsInWithoutKey = Boolean(connector?.name && connector.enabled && !connector.usesKey);
  const name = <code className="font-mono">{connector?.name}</code>;

  return (
    <SettingsCard
      id="paperclip"
      title={settingsText("services.paperclip_literature_search")}
      description={settingsText("services.lets_the_agent_search_and_read_papers_preprints_clinical_trials_fda_documents_and_patents")}
    >
      <KeyRow
        def={PAPERCLIP_KEY_DEF}
        current={status?.paperclip}
        onStatus={(next) => {
          onStatus(next);
          void load();
        }}
      />
      <SettingsError className="mt-3">{error ?? connector?.error ?? null}</SettingsError>
      {connector && !connector.error && (keySet || signsInWithoutKey) ? (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px]",
            ready || (!keySet && signsInWithoutKey)
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
          )}
        >
          {ready || (!keySet && signsInWithoutKey) ? (
            <CheckCircle2Icon className="size-3.5 shrink-0" />
          ) : (
            <AlertCircleIcon className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            {ready ? (
              <SettingsMessage id="services.connector_ready" values={{ name }} />
            ) : !keySet ? (
              <SettingsMessage id="services.connector_without_key" values={{ name }} />
            ) : !connector.name ? (
              settingsText("services.your_key_is_saved_but_there_is_no_paperclip_connector")
            ) : !connector.usesKey ? (
              <SettingsMessage id="services.connector_other_auth" values={{ name }} />
            ) : (
              <SettingsMessage id="services.connector_disabled" values={{ name }} />
            )}
          </span>
          {keySet && !ready ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[11px]"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? settingsText("services.turning_on") : connector.usesKey || !connector.name ? settingsText("services.turn_on") : settingsText("services.use_this_key")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {connector && !keySet && !signsInWithoutKey ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground"><SettingsMessage id="services.paperclip_sign_in" values={{ url: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{connector.url}</code>, connectors: <SettingsLink tab="connectors">{settingsText("services.connectors")}</SettingsLink> }} /></p>
      ) : null}
    </SettingsCard>
  );
}

type ModalConnectionState = "idle" | "testing" | "connected" | "error";

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorDetail(value: unknown): string | null {
  const record = recordValue(value);
  if (!record) return typeof value === "string" ? value : null;
  for (const candidate of [record.detail, record.error, record.message, record.reason]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
    const nested = recordValue(candidate);
    if (nested) {
      const message = nested.message ?? nested.detail;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return null;
}

function credentialStatusFromResponse(value: unknown): CredentialStatus | null {
  const record = recordValue(value);
  if (!record) return null;
  const credentials = recordValue(record.credentials) ?? record;
  return recordValue(credentials.modalTokenId) || recordValue(credentials.modalTokenSecret)
    ? (credentials as CredentialStatus)
    : null;
}

function modalConnectionFromResponse(value: unknown): {
  status: string | null;
  detail: string | null;
} {
  const record = recordValue(value);
  if (!record) return { status: null, detail: null };
  const connection =
    recordValue(record.modal) ?? recordValue(record.modalConnection) ?? recordValue(record.validation);
  const status =
    (typeof connection?.status === "string" ? connection.status : null) ??
    (typeof record.modalStatus === "string" ? record.modalStatus : null) ??
    (record.modalConfigured === true ? "connected" : null);
  return {
    status,
    detail: errorDetail(connection) ?? errorDetail(record),
  };
}

function ModalCredentialPair({
  status,
  onStatus,
}: {
  status: CredentialStatus | null;
  onStatus: (status: CredentialStatus) => void;
}) {
  const tokenIdStatus = status?.modalTokenId;
  const tokenSecretStatus = status?.modalTokenSecret;
  const existingConnected = Boolean(tokenIdStatus?.set && tokenSecretStatus?.set);
  const existingPartial = Boolean(tokenIdStatus?.set) !== Boolean(tokenSecretStatus?.set);
  const [tokenId, setTokenId] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");
  const [connectionState, setConnectionState] = useState<ModalConnectionState>(
    existingConnected ? "connected" : existingPartial ? "error" : "idle",
  );
  const [error, setError] = useState<string | null>(
    existingPartial ? settingsText("services.both_modal_token_fields_must_be_set_together") : null,
  );
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (tokenIdStatus?.set && tokenSecretStatus?.set) {
      setConnectionState("connected");
      setError(null);
    } else if (Boolean(tokenIdStatus?.set) !== Boolean(tokenSecretStatus?.set)) {
      setConnectionState("error");
      setError(settingsText("services.both_modal_token_fields_must_be_set_together"));
    }
  }, [tokenIdStatus?.set, tokenSecretStatus?.set]);

  const savePair = useCallback(
    async (clear = false) => {
      if (!clear && (!tokenId.trim() || !tokenSecret.trim())) {
        setConnectionState("error");
        setError(settingsText("services.enter_both_the_modal_token_id_and_token_secret"));
        return;
      }
      setConnectionState("testing");
      setError(null);
      try {
        const response = await apiFetch("/credentials", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modalTokenId: clear ? null : tokenId.trim(),
            modalTokenSecret: clear ? null : tokenSecret.trim(),
          }),
        });
        const body = await response.json().catch(() => null);
        const connection = modalConnectionFromResponse(body);
        if (
          !response.ok ||
          connection.status === "error" ||
          connection.status === "invalid" ||
          connection.status === "disconnected"
        ) {
          throw new Error(
            connection.detail ??
              errorDetail(body) ??
              (response.ok ? settingsText("services.modal_rejected_this_token_pair") : settingsText("services.modal_connection_failed", { v0: response.status })),
          );
        }
        const nextStatus = credentialStatusFromResponse(body);
        if (nextStatus) onStatus(nextStatus);
        setTokenId("");
        setTokenSecret("");
        setConnectionState(clear ? "idle" : "connected");
        notifyModalCredentialsChanged();
      } catch (cause) {
        setConnectionState("error");
        setError(cause instanceof Error ? cause.message : settingsText("services.modal_connection_failed_104"));
      }
    },
    [onStatus, tokenId, tokenSecret],
  );

  const clearPair = async () => {
    const ok = await confirm({
      title: settingsText("services.confirm.disconnect_modal"),
      description:
        settingsText("services.new_remote_jobs_will_be_refused_until_you_connect_a_token_pair_again_jobs_already_running"),
      confirmLabel: settingsText("services.disconnect"),
      destructive: true,
    });
    if (ok) await savePair(true);
  };

  return (
    <SettingsCard
      id="modal"
      title={settingsText("services.modal_compute")}
      description={settingsText("services.save_and_validate_the_token_id_and_secret_as_one_pair_the_pair_enables_durable_cpu_and_gpu")}
    >
      {dialog}
      <div
        role={connectionState === "error" ? "alert" : "status"}
        className={cn(
          "mb-3 flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px]",
          connectionState === "testing" && "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
          connectionState === "connected" &&
            "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
          connectionState === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
          connectionState === "idle" && "bg-muted/20 text-muted-foreground",
        )}
      >
        {connectionState === "testing" ? (
          <LoaderCircleIcon className="size-3.5 animate-spin" />
        ) : connectionState === "connected" ? (
          <CheckCircle2Icon className="size-3.5" />
        ) : connectionState === "error" ? (
          <AlertCircleIcon className="size-3.5" />
        ) : (
          <span className="size-2 rounded-full bg-muted-foreground/40" />
        )}
        <span className="min-w-0 flex-1">
          {connectionState === "testing"
            ? settingsText("services.testing_modal_connection")
            : connectionState === "connected"
              ? settingsText("services.connected_modal_compute_is_ready")
              : connectionState === "error"
                ? (error ?? settingsText("services.modal_connection_failed_112"))
                : settingsText("services.not_connected")}
        </span>
        {(tokenIdStatus?.set || tokenSecretStatus?.set) && connectionState !== "testing" ? (
          <span className="hidden shrink-0 font-mono text-[10px] sm:inline">
            {tokenIdStatus?.masked ?? settingsText("services.id_missing")} · {tokenSecretStatus?.masked ?? settingsText("services.secret_missing")}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-[11px] font-medium">
          <span>{settingsText("services.token_id")}</span>
          <Input
            type="password"
            value={tokenId}
            autoComplete="off"
            placeholder={tokenIdStatus?.set ? settingsText("services.replace_ak") : "ak-…"}
            className="h-8 font-mono text-xs"
            onChange={(event) => {
              setTokenId(event.target.value);
              if (connectionState === "error") {
                setConnectionState(existingConnected ? "connected" : "idle");
                setError(null);
              }
            }}
          />
        </label>
        <label className="space-y-1.5 text-[11px] font-medium">
          <span>{settingsText("services.token_secret")}</span>
          <Input
            type="password"
            value={tokenSecret}
            autoComplete="off"
            placeholder={tokenSecretStatus?.set ? settingsText("services.replace_as") : "as-…"}
            className="h-8 font-mono text-xs"
            onChange={(event) => {
              setTokenSecret(event.target.value);
              if (connectionState === "error") {
                setConnectionState(existingConnected ? "connected" : "idle");
                setError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && tokenId.trim() && tokenSecret.trim()) {
                void savePair();
              }
            }}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <GetKeyLink
          href="https://modal.com/settings/tokens"
          service="Modal token pair"
          label={settingsText("services.get_a_token")}
          className="mr-auto"
        />
        {tokenIdStatus?.set || tokenSecretStatus?.set ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={connectionState === "testing"}
            onClick={() => void clearPair()}
            className="text-xs text-destructive hover:text-destructive"
          >
            {settingsText("services.clear_pair")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={connectionState === "testing" || !tokenId.trim() || !tokenSecret.trim()}
          onClick={() => void savePair()}
          className="text-xs"
        >
          {connectionState === "testing" ? settingsText("services.testing") : settingsText("services.save_test")}
        </Button>
      </div>
    </SettingsCard>
  );
}

interface ModalCacheInfo {
  cache: { volumeName: string; updatedAt?: string } | null;
}

/** The project's optional Modal Volume cache (cache-only; the local sandbox stays canonical). */
function ModalCacheCard({ connected }: { connected: boolean }) {
  const { activeProject, activeProjectId } = useProjects();
  const [info, setInfo] = useState<ModalCacheInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/modal/cache");
      if (!res.ok) throw new Error(settingsText("services.failed_to_load_the_cache", { v0: res.status }));
      setInfo((await res.json()) as ModalCacheInfo);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : settingsText("services.failed_to_load_the_cache_126"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, activeProjectId]);

  const clear = async () => {
    const ok = await confirm({
      title: settingsText("services.confirm.clear_the_remote_cache"),
      description:
        settingsText("services.deletes_this_project_s_modal_volume_files_in_the_project_sandbox_are_not_touched_the_next"),
      confirmLabel: settingsText("services.clear_cache"),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await apiFetch("/modal/cache", { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { detail?: string } | null;
      if (!res.ok) throw new Error(body?.detail || settingsText("services.clear_failed", { v0: res.status }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : settingsText("services.clear_failed_131"));
    } finally {
      setBusy(false);
    }
  };

  const projectName = activeProject?.name ?? activeProjectId;
  return (
    <SettingsCard
      id="modal-cache"
      title={settingsText("services.remote_cache")}
      description={settingsText("services.optional_modal_volume_that_speeds_up_repeat_jobs_for_the_current_project_it_is_a_cache_onl", { v0: projectName })}
    >
      {dialog}
      <SettingsError className="mb-2">{error}</SettingsError>
      <div className="flex items-center gap-3 text-xs">
        <span className="min-w-0 flex-1 text-muted-foreground">
          {info === null
            ? settingsText("services.loading")
            : info.cache
              ? <>{settingsText("services.volume")}<code className="font-mono">{info.cache.volumeName}</code></>
              : settingsText("services.no_cache_yet_it_is_created_by_the_first_job_that_asks_for_one")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={!info?.cache || busy || !connected}
          title={connected ? undefined : settingsText("services.connect_modal_first")}
          onClick={() => void clear()}
        >
          {busy ? settingsText("services.clearing") : settingsText("services.clear_cache")}
        </Button>
      </div>
    </SettingsCard>
  );
}

export function ServicesPanel() {
  const { status, setStatus, loading, error } = useCredentialStatus();
  const modalConnected = Boolean(status?.modalTokenId?.set && status?.modalTokenSecret?.set);

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeader
        title={settingsText("services.services")}
        description={<SettingsMessage id="services.intro" values={{ file: <code className="rounded bg-muted px-1 py-0.5">.env</code> }} />}
        appliesTo="immediately"
      />

      <SettingsError>{error}</SettingsError>

      {loading ? (
        <p className="text-xs text-muted-foreground">{settingsText("services.loading")}</p>
      ) : (
        <>
          <SettingsCard
            id="web-search"
            title={settingsText("services.web_search")}
            description={settingsText("services.all_optional_web_search_page_fetching_and_github_reading_work_without_any_of_them")}
          >
            <div className="flex flex-col gap-5">
              {SEARCH_KEY_DEFS.map((def) => (
                <KeyRow key={def.id} def={def} current={status?.[def.id]} onStatus={setStatus} />
              ))}
            </div>
          </SettingsCard>
          <PaperclipCard status={status} onStatus={setStatus} />
          <ModalCredentialPair status={status} onStatus={setStatus} />
          <ModalCacheCard connected={modalConnected} />
        </>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground"><SettingsMessage id="services.restart_help" values={{ file: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">.env</code>, github: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">GITHUB_TOKEN</code>, proxy: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">HTTPS_PROXY</code> }} /></p>
    </div>
  );
}
