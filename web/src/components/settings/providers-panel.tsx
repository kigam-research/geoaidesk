"use client";
import { settingsSourceText } from "@/components/settings/primitives";
import { geoText } from "@/geo/i18n";
/**
 * Settings → Models → Providers: every way to reach a model in one place.
 * One row per provider (sign-in and API key merged — see lib/provider-rows),
 * then local servers (Ollama / OpenAI-compatible base URLs) and custom
 * model servers (Pi's models.json).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CustomModelsCard } from "@/components/custom-models-card";
import { LocalModelCard } from "@/geo/local-model/card";
import { OAuthLoginDialog } from "@/components/oauth-login-dialog";
import { apiFetch } from "@/lib/projects";
import {
  mergeProviderRows,
  type DirectProviderField,
  type DirectProviderStatus,
  type ProviderRow,
} from "@/lib/provider-rows";
import { useModels } from "@/lib/use-models";
import {
  PROVIDER_AUTH_CHANGED_EVENT,
  useProviderAuth,
  type ModelProviderStatus,
} from "@/lib/use-provider-auth";
import { cn } from "@/lib/utils";
import { KeyRow, useCredentialStatus, type CredentialStatus, type KeyDef } from "./key-row";
import {
  SettingsCard,
  SettingsError,
  SettingsHeader,
  SettingsSearch,
  matchesQuery,
} from "./primitives";

const settingsText = geoText("settings");

const appText = geoText("app");

const OPENROUTER_KEY: KeyDef = {
  id: "openrouter",
  bodyField: "openrouterApiKey",
  label: appText("settings.providers.openrouter_api_key"),
  placeholder: "sk-or-v1-…",
  keysUrl: "https://openrouter.ai/keys",
  hint: appText("settings.providers.one_pay_as_you_go_account_for"),
  notifyProviders: true,
};

function fieldKeyDef(provider: DirectProviderStatus, field: DirectProviderField): KeyDef {
  return {
    id: field.credentialId,
    bodyField: field.bodyField,
    label: settingsSourceText(field.label),
    placeholder: field.placeholder ?? (field.secret ? "…" : ""),
    keysUrl: field.isKey ? provider.keysUrl : undefined,
    hint: field.hint ? appText("settings.providers.fieldHint", { hint: settingsSourceText(field.hint), variable: field.envVar }) : appText("settings.providers.fieldStored", { variable: field.envVar }),
    secret: field.secret,
    notifyProviders: true,
  };
}

type MethodFilter = "all" | "sign-in" | "api-key";

/** `section` values the first-run card and model picker deep-link to. */
const SECTION_FILTER: Record<string, MethodFilter> = {
  subscriptions: "sign-in",
  "api-keys": "api-key",
};

function billingBadge(provider: ModelProviderStatus): string {
  return provider.billingMode === "metered_oauth"
    ? appText("settings.providers.metered_extra_usage")
    : provider.billingMode === "payg"
      ? appText("settings.providers.pay_as_you_go")
      : appText("settings.providers.subscription");
}

function StatusBadge({ row }: { row: ProviderRow }) {
  if (row.status === "none") {
    return (
      <span className="rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{appText("settings.providers.not_connected")}</span>
    );
  }
  if (row.status === "reauth") {
    return <Badge variant="destructive">{appText("settings.providers.reconnect_required")}</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2Icon className="size-3" aria-hidden />
      {appText(`settings.providers.status.${row.status}`, { source: row.source ?? "empty" })}
    </span>
  );
}

function ProviderRowCard({
  row,
  open,
  onToggle,
  credentials,
  onCredentials,
  onSignIn,
  onDisconnect,
  disconnecting,
}: {
  row: ProviderRow;
  open: boolean;
  onToggle: () => void;
  credentials: CredentialStatus | null;
  onCredentials: (status: CredentialStatus) => void;
  onSignIn: (provider: ModelProviderStatus) => void;
  onDisconnect: (provider: ModelProviderStatus) => void;
  disconnecting: boolean;
}) {
  const methods = [row.oauth ? appText("settings.providers.sign_in") : null, row.direct || row.openrouterKey ? appText("settings.providers.api_key") : null]
    .filter(Boolean)
    .join(" · ");
  const keyDefs: KeyDef[] = row.openrouterKey
    ? [OPENROUTER_KEY]
    : (row.direct?.fields ?? []).map((field) => fieldKeyDef(row.direct!, field));

  return (
    <div className="rounded-lg border" data-testid={`provider-row-${row.id}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        <ChevronRightIcon
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden
        />
        <span className="font-medium">{row.name}</span>
        <StatusBadge row={row} />
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {row.connected
            ? row.modelCount > 0
              ? appText("settings.providers.modelCount", { count: row.modelCount })
              : row.openrouterKey
                ? appText("settings.providers.full_catalogue")
                : ""
            : methods}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t px-3 py-3">
          {row.oauth ? (
            <div className="flex items-start gap-3" data-testid={`provider-signin-${row.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{settingsSourceText(row.oauth.accountLabel)}</span>
                  <Badge variant="outline">{billingBadge(row.oauth)}</Badge>
                </div>
                <p
                  className={cn(
                    "mt-1 text-[11px] leading-relaxed",
                    row.oauth.billingMode === "metered_oauth"
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground",
                  )}
                >
                  {settingsSourceText(row.oauth.billingNote)}
                </p>
              </div>
              {row.oauth.connected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={disconnecting}
                  onClick={() => onDisconnect(row.oauth!)}
                  aria-label={appText("settings.providers.disconnectAccount", { name: settingsSourceText(row.oauth.accountLabel) })}
                >
                  {disconnecting ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <LogOutIcon className="size-3.5" aria-hidden />
                  )}
                  {appText("settings.providers.disconnect")}</Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onSignIn(row.oauth!)}
                  aria-label={appText("settings.providers.connectAccount", { name: settingsSourceText(row.oauth.accountLabel), state: row.oauth.needsReauth ? "reconnect" : "connect" })}
                >
                  <LogInIcon className="size-3.5" aria-hidden />
                  {row.oauth.needsReauth ? appText("settings.providers.reconnect") : appText("settings.providers.sign_in")}
                </Button>
              )}
            </div>
          ) : null}

          {row.oauth && keyDefs.length > 0 ? (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {appText("settings.providers.or_use_an_api_key")}<span className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          {row.direct?.hint ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{settingsSourceText(row.direct.hint)}</p>
          ) : null}
          {keyDefs.map((def) => (
            <KeyRow key={def.id} def={def} current={credentials?.[def.id]} onStatus={onCredentials} />
          ))}
          {row.direct?.billingNote ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">{settingsSourceText(row.direct.billingNote)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LocalServerCard({
  id,
  title,
  envVar,
  bodyField,
  defaultUrl,
  hint,
  credentials,
  onCredentials,
  available,
  modelCount,
}: {
  id: string;
  title: string;
  envVar: string;
  bodyField: string;
  defaultUrl: string;
  hint: string;
  credentials: CredentialStatus | null;
  onCredentials: (status: CredentialStatus) => void;
  available: boolean;
  modelCount: number;
}) {
  const url = credentials?.[bodyField]?.set ? credentials[bodyField]?.masked : null;
  return (
    <div className="rounded-lg border p-3" data-testid={`local-server-${id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">{title}</span>
        {available ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-3" aria-hidden />
            {appText("settings.providers.serverRunning", { count: modelCount })}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
            {appText("settings.providers.not_reachable")}</span>
        )}
        <code className="ml-auto truncate font-mono text-[10px] text-muted-foreground">{url ?? defaultUrl}</code>
      </div>
      <KeyRow
        def={{
          id: bodyField,
          bodyField,
          label: appText("settings.providers.base_url"),
          placeholder: defaultUrl,
          hint: appText("settings.providers.serverHint", { hint, url: defaultUrl, variable: envVar }),
          secret: false,
          notifyProviders: true,
        }}
        current={credentials?.[bodyField]}
        onStatus={onCredentials}
      />
    </div>
  );
}

export function ProvidersPanel({ section }: { section?: string }) {
  const auth = useProviderAuth();
  const credentials = useCredentialStatus();
  const models = useModels();
  const [direct, setDirect] = useState<DirectProviderStatus[] | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MethodFilter>(() => SECTION_FILTER[section ?? ""] ?? "all");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [signInId, setSignInId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    const next = SECTION_FILTER[section ?? ""];
    if (next) setFilter(next);
  }, [section]);

  const loadDirect = useCallback(async () => {
    try {
      const res = await apiFetch("/providers");
      if (!res.ok) throw new Error(appText("settings.providers.loadFailed", { status: res.status }));
      const data = (await res.json()) as { providers?: DirectProviderStatus[] };
      setDirect(Array.isArray(data.providers) ? data.providers : []);
      setDirectError(null);
    } catch (exc) {
      setDirectError(exc instanceof Error ? exc.message : appText("settings.providers.failed_to_load_providers"));
    }
  }, []);

  const { refresh: refreshAuth } = auth;
  useEffect(() => {
    void loadDirect();
    const onChanged = () => {
      void loadDirect();
      void refreshAuth();
    };
    window.addEventListener(PROVIDER_AUTH_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROVIDER_AUTH_CHANGED_EVENT, onChanged);
  }, [loadDirect, refreshAuth]);

  const rows = useMemo(
    () => mergeProviderRows(auth.providers, direct ?? [], credentials.status),
    [auth.providers, direct, credentials.status],
  );
  const connected = rows.filter((row) => row.connected || row.status === "reauth");
  const available = rows.filter((row) => !row.connected && row.status !== "reauth");
  const q = query.trim();
  const filtered = available.filter((row) => {
    if (filter === "sign-in" && !row.oauth) return false;
    if (filter === "api-key" && !row.direct && !row.openrouterKey) return false;
    if (q) {
      return matchesQuery(
        q,
        row.name,
        row.id,
        row.oauth?.accountLabel,
        ...(row.direct?.fields.map((field) => field.envVar) ?? []),
      );
    }
    return showAll || filter !== "all" || row.popular;
  });
  const hiddenCount = available.length - filtered.length;
  const signInProvider = auth.providers.find((provider) => provider.id === signInId) ?? null;
  const loading = (auth.loading && auth.providers.length === 0) || direct === null || credentials.loading;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const disconnect = async (provider: ModelProviderStatus) => {
    const ok = await confirm({
      title: appText("settings.providers.confirm.disconnect", { name: settingsSourceText(provider.accountLabel) }),
      description:
        appText("settings.providers.existing_chats_remain_on_disk_but_new"),
      confirmLabel: appText("settings.providers.disconnect"),
      destructive: true,
    });
    if (!ok) return;
    setDisconnecting(provider.id);
    setActionError(null);
    try {
      await auth.logout(provider.id);
      await auth.refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : appText("settings.providers.disconnect_failed"));
    } finally {
      setDisconnecting(null);
    }
  };

  const rowProps = (row: ProviderRow) => ({
    row,
    open: expanded.has(row.id),
    onToggle: () => toggle(row.id),
    credentials: credentials.status,
    onCredentials: credentials.setStatus,
    onSignIn: (provider: ModelProviderStatus) => {
      setActionError(null);
      setSignInId(provider.id);
    },
    onDisconnect: (provider: ModelProviderStatus) => void disconnect(provider),
    disconnecting: disconnecting === row.id,
  });

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <SettingsHeader
        title={appText("settings.providers.model_providers")}
        description={
          <>
            {appText("settings.providers.intro")}
          </>
        }
        appliesTo="immediately"
      />

      <SettingsError>{actionError ?? auth.error ?? directError ?? credentials.error}</SettingsError>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {appText("settings.providers.loading_providers")}</div>
      ) : (
        <>
          <SettingsCard id="connected" title={appText("settings.providers.connectedCount", { count: connected.length })}>
            {connected.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {/* Local and custom servers are listed in their own cards below, not in this count. */}
                {models.hasAnyModelAccess
                  ? appText("settings.providers.models_come_from_a_server_below")
                  : appText("settings.providers.no_model_provider_is_connected_yet_pick")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {connected.map((row) => (
                  <ProviderRowCard key={row.id} {...rowProps(row)} />
                ))}
              </div>
            )}
          </SettingsCard>

          <SettingsCard
            id="add-provider"
            title={appText("settings.providers.add_a_provider")}
            description={appText("settings.providers.subscriptions_chatgpt_claude_pro_max_copilot_sign")}
          >
            {/* Deep-link anchors: the first-run card's "subscription" / "API key" actions. */}
            <span id="subscriptions" className="block scroll-mt-4" aria-hidden />
            <span id="api-keys" className="block scroll-mt-4" aria-hidden />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SettingsSearch
                value={query}
                onChange={setQuery}
                placeholder={appText("settings.providers.search_providers_name_or_env_var")}
                label={appText("settings.providers.search_model_providers")}
                className="min-w-48 flex-1"
              />
              <div className="flex items-center gap-1 rounded-lg border p-1 text-xs" role="group" aria-label={appText("settings.providers.connection_method")}>
                {(
                  [
                    ["all", appText("settings.providers.all")],
                    ["sign-in", appText("settings.providers.sign_in")],
                    ["api-key", appText("settings.providers.api_key")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "rounded-md px-2 py-1",
                      filter === value ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {q ? appText("settings.providers.no_provider_matches") : appText("settings.providers.every_provider_of_this_kind_is_already")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((row) => (
                  <ProviderRowCard key={row.id} {...rowProps(row)} />
                ))}
              </div>
            )}
            {!q && filter === "all" && (hiddenCount > 0 || showAll) ? (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? appText("settings.providers.show_popular_only") : appText("settings.providers.showAll", { count: available.length })}
                </Button>
              </div>
            ) : null}
          </SettingsCard>

          <SettingsCard
            id="local-servers"
            title={appText("settings.providers.local_model_servers")}
            description={appText("settings.providers.free_private_models_running_on_this_machine")}
          >
            <div className="flex flex-col gap-3">
              <LocalModelCard />
              <LocalServerCard
                id="ollama"
                title="Ollama"
                envVar="OLLAMA_BASE_URL"
                bodyField="ollamaBaseUrl"
                defaultUrl="http://localhost:11434"
                hint={settingsText("providers.run_ollama_serve_and_pull_a_model")}
                credentials={credentials.status}
                onCredentials={credentials.setStatus}
                available={models.ollamaAvailable}
                modelCount={models.ollamaModels.length}
              />
              <LocalServerCard
                id="openai-compatible"
                title={appText("settings.providers.openai_compatible_server")}
                envVar="OPENAI_COMPATIBLE_BASE_URL"
                bodyField="openaiCompatibleBaseUrl"
                defaultUrl="http://localhost:1234"
                hint={appText("settings.providers.compatibleHint")}
                credentials={credentials.status}
                onCredentials={credentials.setStatus}
                available={models.openaiCompatibleAvailable}
                modelCount={models.openaiCompatibleModels.length}
              />
            </div>
          </SettingsCard>

          <div id="custom-servers" className="scroll-mt-4">
            <CustomModelsCard />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {appText("settings.providers.billingNote")}
          </p>
        </>
      )}

      <OAuthLoginDialog
        provider={signInProvider}
        open={signInId !== null}
        onOpenChange={(next) => {
          if (!next) setSignInId(null);
        }}
        start={auth.start}
        poll={auth.poll}
        respond={auth.respond}
        cancel={auth.cancel}
        onConnected={() => void auth.refresh()}
      />
    </div>
  );
}
