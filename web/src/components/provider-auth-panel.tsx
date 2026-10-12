"use client";
import { settingsSourceText } from "@/components/settings/primitives";
import { geoText } from "@/geo/i18n";

import { useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomModelsCard } from "@/components/custom-models-card";
import { OAuthLoginDialog } from "@/components/oauth-login-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useProviderAuth,
  type ModelProviderStatus,
} from "@/lib/use-provider-auth";

const settingsText = geoText("settings");

export function ProviderAuthPanel() {
  const auth = useProviderAuth();
  const [selectedId, setSelectedId] = useState<ModelProviderStatus["id"] | null>(
    null,
  );
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const selected = useMemo(
    () => auth.providers.find((provider) => provider.id === selectedId) ?? null,
    [auth.providers, selectedId],
  );

  const disconnect = async (provider: ModelProviderStatus) => {
    const ok = await confirm({
      title: settingsText("provider_auth.confirm.disconnect", { v0: settingsSourceText(provider.accountLabel) }),
      description:
        settingsText("provider_auth.existing_chats_remain_on_disk_but_new_requests_through_this_provider_will_stop_working_unt"),
      confirmLabel: settingsText("provider_auth.disconnect"),
      destructive: true,
    });
    if (!ok) return;
    setDisconnecting(provider.id);
    setActionError(null);
    try {
      await auth.logout(provider.id);
      await auth.refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : settingsText("provider_auth.disconnect_failed"));
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {dialog}
      <div>
        <h3 className="text-sm font-medium">{settingsText("provider_auth.model_providers")}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {settingsText("provider_auth.connect_an_existing_ai_subscription_or_account_by_signing_in_oauth_tokens_stay_in_kady_s_l")}
        </p>
      </div>

      {(auth.error || actionError) ? (
        <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
          <span>{actionError ?? auth.error}</span>
        </div>
      ) : null}

      {auth.loading && auth.providers.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {settingsText("provider_auth.loading_providers")}
        </div>
      ) : (
        <div className="space-y-3">
          {auth.providers.map((provider) => (
            <section key={provider.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium">{provider.name}</h4>
                    <Badge
                      variant={
                        provider.needsReauth
                          ? "destructive"
                          : provider.connected
                            ? "default"
                            : "secondary"
                      }
                    >
                      {provider.needsReauth
                        ? settingsText("provider_auth.reconnect_required")
                        : provider.connected
                          ? settingsText("provider_auth.connected")
                          : provider.credentialType === "api_key"
                            ? settingsText("provider_auth.using_api_key")
                            : settingsText("provider_auth.not_connected")}
                    </Badge>
                    <Badge variant="outline">
                      {provider.billingMode === "metered_oauth"
                        ? settingsText("provider_auth.metered_extra_usage")
                        : provider.billingMode === "payg"
                          ? settingsText("provider_auth.pay_as_you_go")
                          : settingsText("provider_auth.subscription_managed")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {settingsSourceText(provider.accountLabel)}
                    {provider.apiKeyAlternative ? (
                      <span className="font-normal"> {settingsText("provider_auth.or_paste_an_api_key_under_api_keys")}</span>
                    ) : null}
                  </p>
                  <p
                    className={
                      provider.billingMode === "metered_oauth"
                        ? "mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400"
                        : "mt-2 text-xs leading-relaxed text-muted-foreground"
                    }
                  >
                    {settingsSourceText(provider.billingNote)}
                  </p>
                  {provider.connected ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2Icon className="size-3.5" aria-hidden />
                      {settingsText("provider_auth.available_models", { count: provider.modelCount })}</p>
                  ) : null}
                </div>

                {provider.connected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={disconnecting === provider.id}
                    onClick={() => void disconnect(provider)}
                    aria-label={settingsText("provider_auth.disconnect_731", { v0: settingsSourceText(provider.accountLabel) })}
                  >
                    {disconnecting === provider.id ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <LogOutIcon className="size-3.5" aria-hidden />
                    )}
                    {settingsText("provider_auth.disconnect")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setActionError(null);
                      setSelectedId(provider.id);
                    }}
                    aria-label={settingsText("provider_auth.connect_account", { state: provider.needsReauth ? "reconnect" : "connect", name: settingsSourceText(provider.accountLabel) })}
                  >
                    <LogInIcon className="size-3.5" aria-hidden />
                    {provider.needsReauth ? settingsText("provider_auth.reconnect") : settingsText("provider_auth.connect")}
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {settingsText("provider_auth.provider_subscriptions_have_their_own_quotas_and_overage_rules_except_for_anthropic_s_docu")}
      </p>

      <CustomModelsCard />

      <OAuthLoginDialog
        provider={selected}
        open={selectedId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null);
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
