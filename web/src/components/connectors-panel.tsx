"use client";
import { SettingsMessage } from "@/components/settings/primitives";
import { settingsSourceText } from "@/components/settings/primitives";
import { geoText, geoLocale } from "@/geo/i18n";

/**
 * Settings → Project → Connectors: MCP servers for Pi's built-in MCP support.
 *
 * Two scopes, like Skills: this project (`sandbox/.pi/mcp.json`) and all
 * projects (`~/.kady/pi-agent/mcp.json`). Servers can be toggled off (Pi's
 * `enabled: false`, config kept), given an exposure (how the agent reaches
 * their tools), checked live, and — for OAuth servers — signed in. HTTP
 * servers in the global scope may instead send a signed-in Pi provider's
 * token (`auth.provider`, e.g. Radius), which Pi refuses in project files.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  ScopeSwitcher,
  SettingsError,
  SettingsHeader,
  SettingsSearch,
  matchesQuery,
} from "@/components/settings/primitives";
import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  TerminalIcon,
  Trash2Icon,
} from "lucide-react";
import { useProjects } from "@/lib/use-projects";
import { SettingsLink } from "@/components/settings-link";
import {
  MCP_EXPOSURE_OPTIONS,
  addRadiusConnector,
  authProviderOf,
  cancelMcpLogin,
  exposureOf,
  getMcpAuthProviders,
  getMcpListing,
  getMcpLogin,
  getMcpStatus,
  getRadiusConnector,
  isHttpConfig,
  mcpLogout,
  namespaceClash,
  saveMcpServers,
  setConnectorEnabled,
  setConnectorExposure,
  startMcpLogin,
  testMcpServer,
  usesOAuth,
  type McpAuthProvider,
  type McpExposure,
  type McpLoginFlow,
  type McpScope,
  type McpServerConfig,
  type McpServerStatus,
  type McpServers,
  type RadiusConnectorStatus,
} from "@/lib/mcp";

const settingsText = geoText("settings");

/**
 * How an HTTP server authenticates: Pi's MCP OAuth sign-in (no Authorization
 * header), a bearer token header, or a signed-in Pi provider's token.
 */
export type McpAuthMode = "oauth" | "bearer" | "provider";

const AUTH_MODE_LABELS: Record<McpAuthMode, string> = {
  oauth: settingsText("connectors.sign_in_with_oauth"),
  bearer: settingsText("connectors.bearer_token"),
  provider: settingsText("connectors.use_a_signed_in_provider"),
};

export interface McpFormState {
  /** Key being edited, or null when adding a new server. */
  originalName: string | null;
  /** The entry as loaded; fields the form does not edit are kept from it. */
  base: McpServerConfig | null;
  name: string;
  type: "http" | "stdio";
  url: string;
  bearerToken: string;
  command: string;
  args: string;
  env: string;
  exposure: McpExposure;
  /** What the server offers, in a sentence; empty removes it. */
  description: string;
  authMode: McpAuthMode;
  /** Provider id for `authMode: "provider"`. */
  authProvider: string;
  /** `oauth.clientName` / `oauth.authServerMetadataUrl`; empty removes them. */
  oauthClientName: string;
  oauthMetadataUrl: string;
  /** UI only: the Advanced OAuth section is expanded. */
  advancedOAuth?: boolean;
}

const EMPTY_MCP_FORM: McpFormState = {
  originalName: null,
  base: null,
  name: "",
  type: "http",
  url: "",
  bearerToken: "",
  command: "",
  args: "",
  env: "",
  exposure: "codemode",
  description: "",
  authMode: "oauth",
  authProvider: "",
  oauthClientName: "",
  oauthMetadataUrl: "",
};

/** Fields that belong to one transport; switching transport drops the other's. */
const HTTP_FIELDS = ["url", "headers", "oauth", "auth"];
const STDIO_FIELDS = ["command", "args", "env", "cwd"];
/** Fields of the same transport kept from the stored entry unless the form rewrites them. */
const KEPT_TRANSPORT_FIELDS = new Set(["headers", "oauth", "auth", "cwd"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formFromConfig(name: string, config: McpServerConfig): McpFormState {
  const common = {
    ...EMPTY_MCP_FORM,
    originalName: name,
    base: config,
    name,
    exposure: exposureOf(config),
    description: typeof config.description === "string" ? config.description : "",
  };
  if (isHttpConfig(config)) {
    const auth = Object.entries(config.headers ?? {}).find(([k]) => k.toLowerCase() === "authorization")?.[1];
    const provider = authProviderOf(config);
    const oauth = isRecord(config.oauth) ? config.oauth : {};
    const oauthClientName = typeof oauth.clientName === "string" ? oauth.clientName : "";
    const oauthMetadataUrl = typeof oauth.authServerMetadataUrl === "string" ? oauth.authServerMetadataUrl : "";
    return {
      ...common,
      type: "http",
      url: config.url,
      bearerToken: (auth ?? "").replace(/^Bearer\s+/i, ""),
      authMode: provider ? "provider" : auth !== undefined ? "bearer" : "oauth",
      authProvider: provider ?? "",
      oauthClientName,
      oauthMetadataUrl,
      advancedOAuth: Boolean(oauthClientName || oauthMetadataUrl),
    };
  }
  return {
    ...common,
    type: "stdio",
    command: config.command,
    args: (config.args ?? []).join(" "),
    env: Object.entries(config.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  };
}

export function configFromForm(form: McpFormState): McpServerConfig {
  const base: Record<string, unknown> = { ...(form.base ?? {}) };
  const sameTransport = form.base ? isHttpConfig(form.base) === (form.type === "http") : true;
  for (const key of [...HTTP_FIELDS, ...STDIO_FIELDS, "exposure", "description"]) {
    if (KEPT_TRANSPORT_FIELDS.has(key)) {
      if (!sameTransport) delete base[key];
    } else {
      delete base[key];
    }
  }
  if (!sameTransport) delete base.type;
  const exposure = form.exposure === "codemode" ? {} : { exposure: form.exposure };
  const description = form.description.trim() ? { description: form.description.trim() } : {};
  if (form.type === "http") {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((base.headers as Record<string, string> | undefined) ?? {})) {
      if (k.toLowerCase() !== "authorization") headers[k] = v;
    }
    delete base.headers;
    // `auth` is rewritten from the form: kept only while a provider is chosen.
    delete base.auth;
    let oauth = isRecord(base.oauth) ? { ...base.oauth } : undefined;
    delete base.oauth;
    if (form.authMode === "bearer") {
      if (form.bearerToken.trim()) headers.Authorization = `Bearer ${form.bearerToken.trim()}`;
    } else if (form.authMode === "provider") {
      // The provider token replaces the MCP OAuth sign-in entirely.
      oauth = undefined;
    } else {
      const next: Record<string, unknown> = { ...(oauth ?? {}) };
      for (const [key, value] of [
        ["clientName", form.oauthClientName],
        ["authServerMetadataUrl", form.oauthMetadataUrl],
      ] as const) {
        if (value.trim()) next[key] = value.trim();
        else delete next[key];
      }
      oauth = Object.keys(next).length > 0 ? next : undefined;
    }
    const provider = form.authMode === "provider" ? form.authProvider.trim() : "";
    return {
      ...base,
      url: form.url.trim(),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(oauth ? { oauth } : {}),
      ...(provider ? { auth: { provider } } : {}),
      ...description,
      ...exposure,
    };
  }
  const args = form.args.trim() ? form.args.trim().split(/\s+/) : [];
  const env: Record<string, string> = {};
  for (const line of form.env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return {
    ...base,
    command: form.command.trim(),
    ...(args.length > 0 ? { args } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...description,
    ...exposure,
  };
}

function summarizeConfig(config: McpServerConfig): string {
  if (isHttpConfig(config)) return config.url;
  return [config.command, ...(config.args ?? [])].join(" ");
}

function statusLabel(status: McpServerStatus): { text: string; tone: "ok" | "warn" | "error" | "muted" } {
  switch (status.state) {
    case "connected":
      return {
        text: settingsText("connectors.confirm.connected_tool", { v0: status.tools.length, v1: status.tools.length === 1 ? "" : "s" }),
        tone: "ok",
      };
    case "needs-auth":
      return { text: settingsText("connectors.needs_sign_in"), tone: "warn" };
    case "disabled":
      return { text: settingsText("connectors.disabled"), tone: "muted" };
    case "failed":
      return { text: settingsText("connectors.confirm.failed", { v0: status.error ? `: ${status.error.split("\n")[0]}` : "" }), tone: "error" };
    default:
      return { text: status.state, tone: "muted" };
  }
}

function ExposureSelect({
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  value: McpExposure;
  onChange: (value: McpExposure) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as McpExposure)} disabled={disabled}>
      <SelectTrigger size="sm" className={cn("h-7 text-[11px]", className)} aria-label={label}>
        {/* Explicit children: the items carry a description the trigger must not mirror. */}
        <SelectValue>{settingsSourceText(MCP_EXPOSURE_OPTIONS.find((opt) => opt.value === value)?.label ?? "")}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {MCP_EXPOSURE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              <div className="flex flex-col">
                <span>{settingsSourceText(opt.label)}</span>
                <span className="max-w-64 whitespace-normal text-[10px] text-muted-foreground">
                  {settingsSourceText(opt.description)}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function ConnectorsPanel() {
  const { activeProject, activeProjectId } = useProjects();
  const [scope, setScope] = useState<McpScope>("project");
  const [servers, setServers] = useState<McpServers>({});
  const [shared, setShared] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<McpFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [status, setStatus] = useState<McpServerStatus[] | null>(null);
  const [statusNotes, setStatusNotes] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const { confirm, dialog } = useConfirm();
  const [login, setLogin] = useState<{ name: string; flow: McpLoginFlow } | null>(null);
  const loginPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  // Provider logins an HTTP server can authenticate with, and the Radius
  // suggestion. Both fail quietly: an older backend lacks the endpoints.
  const [authProviders, setAuthProviders] = useState<McpAuthProvider[] | null>(null);
  const [radius, setRadius] = useState<RadiusConnectorStatus | null>(null);
  const [addingRadius, setAddingRadius] = useState(false);
  const [radiusAdded, setRadiusAdded] = useState(false);

  const refreshRadius = useCallback(async () => {
    try {
      setRadius(await getRadiusConnector());
    } catch {
      /* older server: no suggestion */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMcpAuthProviders()
      .then((providers) => {
        if (!cancelled) setAuthProviders(providers);
      })
      .catch(() => {
        if (!cancelled) setAuthProviders([]);
      });
    getRadiusConnector()
      .then((status) => {
        if (!cancelled) setRadius(status);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const load = useCallback(async (which: McpScope) => {
    const listing = await getMcpListing(which);
    setServers(listing.mcpServers);
    setShared(listing.shared);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForm(null);
    setStatus(null);
    getMcpListing(scope)
      .then((listing) => {
        if (!cancelled) {
          setServers(listing.mcpServers);
          setShared(listing.shared);
        }
      })
      .catch((exc) => {
        if (!cancelled) {
          setServers({});
          setError(exc instanceof Error ? exc.message : settingsText("connectors.failed_to_load_mcp_servers"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, scope]);

  useEffect(
    () => () => {
      if (loginPoll.current) clearInterval(loginPoll.current);
    },
    [],
  );

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const report = await getMcpStatus();
      setStatus(report.servers);
      setCheckedAt(new Date());
      setStatusNotes([...report.errors.map((e) => settingsText("connectors.config", { v0: e })), ...(report.note ? [report.note] : [])]);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("connectors.status_check_failed"));
    } finally {
      setChecking(false);
    }
  }, []);

  const persist = useCallback(
    async (next: McpServers) => {
      setSaving(true);
      setError(null);
      try {
        await saveMcpServers(next, scope);
        setServers(next);
        setForm(null);
        setTestResult(null);
        setStatus(null);
        await load(scope).catch(() => undefined);
        // The Radius suggestion reflects the global file.
        if (scope === "global") void refreshRadius();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("connectors.save_failed"));
      } finally {
        setSaving(false);
      }
    },
    [load, refreshRadius, scope],
  );

  const handleSave = useCallback(async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setError(settingsText("connectors.connector_name_is_required"));
      return;
    }
    const next: McpServers = { ...servers };
    if (form.originalName && form.originalName !== name) {
      delete next[form.originalName];
    }
    const clash = namespaceClash(name, Object.keys(next));
    if (clash) {
      setError(settingsText("connectors.would_share_tool_names_with_pi_treats_and_alike", { v0: name, v1: clash }));
      return;
    }
    if (form.type === "http" && form.authMode === "provider" && !form.authProvider.trim()) {
      setError(settingsText("connectors.choose_the_signed_in_provider_this_connector_authenticates_with"));
      return;
    }
    next[name] = configFromForm(form);
    await persist(next);
  }, [form, servers, persist]);

  const addRadius = useCallback(async () => {
    setAddingRadius(true);
    setError(null);
    try {
      await addRadiusConnector();
      setRadius((current) => (current ? { ...current, configured: true } : current));
      setRadiusAdded(true);
      setStatus(null);
      if (scope === "global") await load("global").catch(() => undefined);
      void refreshRadius();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : settingsText("connectors.could_not_add_the_radius_connector"));
    } finally {
      setAddingRadius(false);
    }
  }, [load, refreshRadius, scope]);

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await confirm({
        title: settingsText("connectors.confirm.remove_the_connector", { v0: name }),
        description:
          scope === "project"
            ? settingsText("connectors.its_entry_is_deleted_from_this_project_s_pi_mcp_json_to_keep_the_configuration_switch_it_o")
            : settingsText("connectors.its_entry_is_deleted_from_the_shared_mcp_json_used_by_every_project_to_keep_the_configurat"),
        confirmLabel: settingsText("connectors.remove"),
        destructive: true,
      });
      if (!ok) return;
      const next = { ...servers };
      delete next[name];
      await persist(next);
    },
    [confirm, persist, scope, servers],
  );

  const handleTest = useCallback(async () => {
    if (!form) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await testMcpServer(form.name.trim() || "server", configFromForm(form));
      const tools = result.tools ?? [];
      setTestResult(
        result.ok
          ? {
              ok: true,
              text: settingsText("connectors.confirm.connected_tool_597", { v0: tools.length, v1: tools.length === 1 ? "" : "s", v2: tools.slice(0, 8).join(", "), v3: tools.length > 8 ? ", …" : "" }),
            }
          : { ok: false, text: settingsText("connectors.confirm.connection_failed", { v0: result.detail ?? settingsText("shared.unknown_error") }) },
      );
    } catch (exc) {
      setTestResult({
        ok: false,
        text: settingsText("connectors.confirm.connection_failed", { v0: exc instanceof Error ? exc.message : settingsText("shared.unknown_error") }),
      });
    } finally {
      setTesting(false);
    }
  }, [form]);

  const toggle = useCallback(
    async (name: string, next: boolean) => {
      setError(null);
      try {
        await setConnectorEnabled(name, next, scope);
        setStatus(null);
        await load(scope);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("connectors.toggle_failed"));
      }
    },
    [load, scope],
  );

  const changeExposure = useCallback(
    async (name: string, exposure: McpExposure) => {
      setError(null);
      try {
        await setConnectorExposure(name, exposure, scope);
        setStatus(null);
        await load(scope);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("connectors.could_not_change_exposure"));
      }
    },
    [load, scope],
  );

  const stopLoginPoll = () => {
    if (loginPoll.current) clearInterval(loginPoll.current);
    loginPoll.current = null;
  };

  const signIn = useCallback(
    async (name: string) => {
      setError(null);
      stopLoginPoll();
      try {
        const flow = await startMcpLogin(name);
        setLogin({ name, flow });
        if (flow.status !== "running") {
          if (flow.status === "complete") void checkStatus();
          return;
        }
        loginPoll.current = setInterval(() => {
          void getMcpLogin(name)
            .then((next) => {
              if (!next) {
                stopLoginPoll();
                return;
              }
              setLogin({ name, flow: next });
              if (next.status !== "running") {
                stopLoginPoll();
                if (next.status === "complete") void checkStatus();
              }
            })
            .catch(() => undefined);
        }, 2000);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("connectors.sign_in_failed_to_start"));
      }
    },
    [checkStatus],
  );

  const signOut = useCallback(
    async (name: string) => {
      setError(null);
      try {
        await mcpLogout(name);
        void checkStatus();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : settingsText("connectors.sign_out_failed"));
      }
    },
    [checkStatus],
  );

  const changeScope = useCallback(
    async (value: McpScope) => {
      if (form) {
        const ok = await confirm({
          title: settingsText("connectors.confirm.discard_the_connector_you_are_editing"),
          description: settingsText("connectors.switching_scope_closes_the_form_without_saving"),
          confirmLabel: settingsText("connectors.discard"),
        });
        if (!ok) return;
      }
      setForm(null);
      setTestResult(null);
      setScope(value);
    },
    [confirm, form],
  );

  const providerName = (id: string) => authProviders?.find((p) => p.id === id)?.name ?? id;

  const allNames = useMemo(() => Object.keys(servers).sort(), [servers]);
  const names = allNames.filter((name) => matchesQuery(query, name, summarizeConfig(servers[name])));
  const statusFor = (name: string) => status?.find((s) => s.name === name && s.scope === scope);

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <SettingsHeader
        title={settingsText("connectors.connectors")}
        description={settingsText("connectors.connect_model_context_protocol_servers_to_give_the_agent_extra_tools_through_pi_s_built_in")}
        appliesTo="new-chats"
      />

      <ScopeSwitcher
        value={scope}
        projectName={activeProject?.name ?? activeProjectId}
        onChange={(value) => void changeScope(value)}
      />

      {radius?.signedIn && !radius.configured && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <PlugZapIcon className="size-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{settingsText("connectors.you_re_signed_in_to_radius")}</div>
            <p className="text-[11px] text-muted-foreground">
              {settingsText("connectors.add_its_mcp_server_so_the_agent_can_use_radius_tools_it_is_added_for_all_projects_and_auth")}
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 shrink-0 text-[11px]"
            disabled={addingRadius}
            onClick={() => void addRadius()}
          >
            {addingRadius ? settingsText("connectors.adding") : settingsText("connectors.add_radius_connector")}
          </Button>
        </div>
      )}
      {radiusAdded && scope === "project" && (
        <p className="-mt-2 text-[11px] text-muted-foreground">
          {settingsText("connectors.added_the_radius_connector_for_all_projects")}{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2 hover:no-underline"
            onClick={() => void changeScope("global")}
          >
            {settingsText("connectors.show_it")}
          </button>
        </p>
      )}

      {scope === "global" && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          {settingsText("connectors.stored_in_your_kady_pi_agent_directory_and_used_by_every_project_pi_recommends_this_scope")}
        </p>
      )}

      <SettingsError>{error}</SettingsError>

      {login && (
        <div
          className={cn(
            "flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs",
            login.flow.status === "error" && "border-destructive/50 bg-destructive/10 text-destructive",
          )}
        >
          <div className="font-medium">{settingsText("connectors.sign_in_heading", { name: login.name })}</div>
          {login.flow.status === "running" && (
            <>
              <p className="text-muted-foreground">
                {settingsText("connectors.approve_access_in_the_browser_window_pi_opened_kady_picks_up_the_sign_in_automatically_run")}
              </p>
              {login.flow.authorizationUrl && (
                <a
                  href={login.flow.authorizationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 self-start text-primary underline-offset-2 hover:underline"
                >
                  <ExternalLinkIcon className="size-3" />
                  {settingsText("connectors.open_the_sign_in_page")}
                </a>
              )}
            </>
          )}
          {login.flow.status !== "running" && <p>{login.flow.message}</p>}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 self-end text-[11px]"
            onClick={() => {
              if (login.flow.status === "running") void cancelMcpLogin(login.name);
              stopLoginPoll();
              setLogin(null);
            }}
          >
            {login.flow.status === "running" ? settingsText("connectors.cancel") : settingsText("connectors.dismiss")}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">{settingsText("connectors.loading")}</p>
      ) : (
        <>
          {allNames.length === 0 && !form && (
            <div className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
              {scope === "project"
                ? settingsText("connectors.no_connectors_configured_for_this_project_yet")
                : settingsText("connectors.no_connectors_shared_across_projects_yet")}
            </div>
          )}

          {allNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {allNames.length > 4 ? (
                  <SettingsSearch
                    value={query}
                    onChange={setQuery}
                    placeholder={settingsText("connectors.search_connectors")}
                    label={settingsText("connectors.search_connectors_625")}
                    className="flex-1"
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {checkedAt ? settingsText("connectors.checked", { v0: checkedAt.toLocaleTimeString(geoLocale()) }) : settingsText("connectors.starts_each_server_to_check_it")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                  disabled={checking}
                  onClick={() => void checkStatus()}
                >
                  <RefreshCwIcon className={cn("size-3", checking && "animate-spin")} />
                  {checking ? settingsText("connectors.connecting") : settingsText("connectors.check_status")}
                </Button>
              </div>
              {names.length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground">{settingsText("connectors.no_connector_matches")}</p>
              ) : null}
              {names.map((name) => {
                const config = servers[name];
                const http = isHttpConfig(config);
                const viaProvider = authProviderOf(config);
                const enabled = config.enabled !== false;
                const live = statusFor(name);
                const label = live ? statusLabel(live) : null;
                const note = shared.includes(name)
                  ? scope === "project"
                    ? settingsText("connectors.replaces_the_connector_of_the_same_name_shared_across_projects")
                    : settingsText("connectors.replaced_in_this_project_by_a_project_connector_of_the_same_name")
                  : null;
                return (
                  <div
                    key={name}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border px-3 py-2",
                      !enabled && "border-dashed opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {http ? (
                        <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {summarizeConfig(config)}
                          {viaProvider && <span> {settingsText("connectors.via")}{providerName(viaProvider)}</span>}
                        </div>
                      </div>
                      <ExposureSelect
                        value={exposureOf(config)}
                        onChange={(value) => void changeExposure(name, value)}
                        label={settingsText("connectors.exposure_of", { v0: name })}
                        className="w-32"
                      />
                      <Switch
                        aria-label={settingsText("connectors.toggle", { v0: name })}
                        checked={enabled}
                        onCheckedChange={(next) => void toggle(name, next)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        aria-label={settingsText("connectors.edit", { v0: name })}
                        onClick={() => {
                          setTestResult(null);
                          setForm(formFromConfig(name, config));
                        }}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-destructive hover:text-destructive"
                        aria-label={settingsText("connectors.remove_637", { v0: name })}
                        disabled={saving}
                        onClick={() => void handleDelete(name)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                    {(label || note) && (
                      <div className="flex items-center gap-2 pl-5.5 text-[11px]">
                        {label && (
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              label.tone === "ok" && "text-emerald-600 dark:text-emerald-400",
                              label.tone === "warn" && "text-amber-600 dark:text-amber-400",
                              label.tone === "error" && "text-destructive",
                              label.tone === "muted" && "text-muted-foreground",
                            )}
                            title={live?.error}
                          >
                            {label.text}
                          </span>
                        )}
                        {note && !label && (
                          <span className="min-w-0 flex-1 text-muted-foreground">{note}</span>
                        )}
                        {live?.state === "needs-auth" && viaProvider && (
                          <span className="shrink-0 text-muted-foreground">
                            <SettingsMessage id="connectors.provider_sign_in" values={{ provider: providerName(viaProvider), providers: <SettingsLink tab="providers">{settingsText("connectors.providers")}</SettingsLink> }} />
                          </span>
                        )}
                        {live?.state === "needs-auth" && !viaProvider && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 text-[11px]"
                            onClick={() => void signIn(name)}
                          >
                            <KeyRoundIcon className="size-3" />
                            {settingsText("connectors.sign_in")}
                          </Button>
                        )}
                        {live?.state === "connected" && live.signedIn && usesOAuth(config) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 text-[11px]"
                            onClick={() => void signOut(name)}
                          >
                            <LogOutIcon className="size-3" />
                            {settingsText("connectors.sign_out")}
                          </Button>
                        )}
                      </div>
                    )}
                    {label && note && <div className="pl-5.5 text-[11px] text-muted-foreground">{note}</div>}
                  </div>
                );
              })}
              {statusNotes.map((line) => (
                <p key={line} className="text-[11px] text-amber-600 dark:text-amber-400">
                  {line}
                </p>
              ))}
            </div>
          )}

          {form ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">{settingsText("connectors.name")}</label>
                <Input
                  value={form.name}
                  placeholder={settingsText("connectors.e_g_linear")}
                  className="h-8 text-xs"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" htmlFor="mcp-description">
                  {settingsText("connectors.description")}{" "}
                  <span className="font-normal text-muted-foreground">{settingsText("connectors.optional")}</span>
                </label>
                <Input
                  id="mcp-description"
                  value={form.description}
                  placeholder={settingsText("connectors.e_g_issue_tracker_for_the_lab_s_projects")}
                  className="h-8 text-xs"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  {settingsText("connectors.what_the_server_offers_in_a_sentence_pi_lists_it_in_the_agent_s_prompt_and_uses_it_to_rank")}
                </p>
              </div>

              <div className="flex gap-2">
                {(
                  [
                    { value: "http", label: settingsText("connectors.remote_http"), icon: GlobeIcon },
                    { value: "stdio", label: settingsText("connectors.local_command"), icon: TerminalIcon },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.value}
                    variant={form.type === opt.value ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => setForm({ ...form, type: opt.value })}
                  >
                    <opt.icon className="size-3.5" />
                    {settingsSourceText(opt.label)}
                  </Button>
                ))}
              </div>

              {form.type === "http" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">{settingsText("connectors.server_url")}</label>
                    <Input
                      value={form.url}
                      placeholder="https://mcp.example.com/mcp"
                      className="h-8 text-xs"
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">{settingsText("connectors.authentication")}</label>
                    <Select
                      value={form.authMode}
                      onValueChange={(v) => setForm({ ...form, authMode: v as McpAuthMode })}
                    >
                      <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={settingsText("connectors.authentication")}>
                        <SelectValue>{AUTH_MODE_LABELS[form.authMode]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="oauth" className="text-xs">
                            {AUTH_MODE_LABELS.oauth}
                          </SelectItem>
                          <SelectItem value="bearer" className="text-xs">
                            {AUTH_MODE_LABELS.bearer}
                          </SelectItem>
                          {(scope === "global" || form.authMode === "provider") && (
                            <SelectItem value="provider" className="text-xs">
                              {AUTH_MODE_LABELS.provider}
                            </SelectItem>
                          )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.authMode === "bearer" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" htmlFor="mcp-bearer">
                        {settingsText("connectors.bearer_token")}
                      </label>
                      <Input
                        id="mcp-bearer"
                        type="password"
                        value={form.bearerToken}
                        placeholder={settingsText("connectors.sent_as_authorization_bearer_or")}
                        className="h-8 text-xs"
                        autoComplete="off"
                        onChange={(e) => setForm({ ...form, bearerToken: e.target.value })}
                      />
                    </div>
                  )}

                  {form.authMode === "oauth" && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        {settingsText("connectors.for_servers_that_sign_in_with_oauth_e_g_sentry_linear_save_then_use_sign_in_servers_that_n")}
                      </p>
                      <button
                        type="button"
                        aria-expanded={Boolean(form.advancedOAuth)}
                        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setForm({ ...form, advancedOAuth: !form.advancedOAuth })}
                      >
                        <ChevronRightIcon
                          className={cn("size-3 transition-transform", form.advancedOAuth && "rotate-90")}
                        />
                        {settingsText("connectors.advanced_oauth")}
                      </button>
                      {form.advancedOAuth && (
                        <div className="flex flex-col gap-2.5 border-l pl-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium" htmlFor="mcp-oauth-client-name">
                              {settingsText("connectors.client_name")}
                            </label>
                            <Input
                              id="mcp-oauth-client-name"
                              value={form.oauthClientName}
                              placeholder="pi"
                              className="h-8 text-xs"
                              onChange={(e) => setForm({ ...form, oauthClientName: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {settingsText("connectors.sent_when_pi_registers_itself_for_servers_that_only_accept_known_oauth_clients")}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium" htmlFor="mcp-oauth-metadata">
                              {settingsText("connectors.authorization_server_metadata_url")}
                            </label>
                            <Input
                              id="mcp-oauth-metadata"
                              value={form.oauthMetadataUrl}
                              placeholder="https://auth.example.com/.well-known/oauth-authorization-server"
                              className="h-8 text-xs"
                              onChange={(e) => setForm({ ...form, oauthMetadataUrl: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {settingsText("connectors.for_servers_that_advertise_a_wrong_authorization_server_or_none_must_use_https_http_only_o")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {form.authMode === "provider" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium">{settingsText("connectors.provider")}</label>
                      <Select
                        value={form.authProvider || undefined}
                        onValueChange={(v) => setForm({ ...form, authProvider: v })}
                      >
                        <SelectTrigger size="sm" className="h-8 w-full text-xs" aria-label={settingsText("connectors.provider")}>
                          <SelectValue placeholder={settingsText("connectors.choose_a_signed_in_provider")}>
                            {form.authProvider ? providerName(form.authProvider) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(authProviders ?? []).map((provider) => (
                              <SelectItem key={provider.id} value={provider.id} className="text-xs">
                                {provider.name}
                                {!provider.connected && (
                                  <span className="text-muted-foreground"> {settingsText("connectors.not_signed_in")}</span>
                                )}
                              </SelectItem>
                            ))}
                            {form.authProvider &&
                              !(authProviders ?? []).some((p) => p.id === form.authProvider) && (
                                <SelectItem value={form.authProvider} className="text-xs">
                                  {form.authProvider}
                                </SelectItem>
                              )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground"><SettingsMessage id="connectors.provider_token_help" values={{ providers: <SettingsLink tab="providers">{settingsText("connectors.providers")}</SettingsLink> }} /></p>
                      {scope === "project" && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          {settingsText("connectors.pi_allows_provider_sign_ins_only_for_connectors_shared_across_projects_add_this_connector")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">{settingsText("connectors.command")}</label>
                    <Input
                      value={form.command}
                      placeholder="npx"
                      className="h-8 text-xs"
                      onChange={(e) => setForm({ ...form, command: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">
                      {settingsText("connectors.arguments")}{" "}
                      <span className="font-normal text-muted-foreground">
                        {settingsText("connectors.space_separated")}
                      </span>
                    </label>
                    <Input
                      value={form.args}
                      placeholder="-y @modelcontextprotocol/server-github"
                      className="h-8 text-xs"
                      onChange={(e) => setForm({ ...form, args: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">
                      {settingsText("connectors.environment_variables")}{" "}
                      <span className="font-normal text-muted-foreground">{settingsText("connectors.env_help")}</span>
                    </label>
                    <Textarea
                      value={form.env}
                      placeholder={"GITHUB_TOKEN=${GITHUB_TOKEN}"}
                      className="min-h-16 text-xs font-mono"
                      onChange={(e) => setForm({ ...form, env: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">{settingsText("connectors.how_the_agent_reaches_the_tools")}</label>
                <ExposureSelect
                  value={form.exposure}
                  onChange={(exposure) => setForm({ ...form, exposure })}
                  label={settingsText("connectors.exposure")}
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  {settingsSourceText(MCP_EXPOSURE_OPTIONS.find((o) => o.value === form.exposure)?.description ?? "")}
                </p>
              </div>

              {testResult && (
                <div
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed",
                    testResult.ok
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-destructive/50 bg-destructive/10 text-destructive"
                  )}
                >
                  {testResult.text}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? settingsText("connectors.saving") : form.originalName ? settingsText("connectors.save_changes") : settingsText("connectors.add_connector")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={testing}
                  onClick={() => void handleTest()}
                >
                  {testing ? settingsText("connectors.testing") : settingsText("connectors.test_connection")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => {
                    setForm(null);
                    setTestResult(null);
                  }}
                >
                  {settingsText("connectors.cancel_687")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 self-start text-xs"
              onClick={() => {
                setTestResult(null);
                setForm({ ...EMPTY_MCP_FORM });
              }}
            >
              <PlusIcon className="size-3.5" />
              {settingsText("connectors.add_connector")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
