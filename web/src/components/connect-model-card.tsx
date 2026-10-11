"use client";
import { geoText } from "@/geo/i18n";
import { HardDriveIcon, KeyRoundIcon, LogInIcon, PlugZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSettings } from "@/lib/settings-nav";

const appText = geoText("app");

/**
 * First-run guidance for a chat with nowhere to send it: shown in the empty
 * conversation when no model source (OpenRouter, a subscription, a direct
 * key, a local server) is usable. Each action lands on the matching part of
 * Settings → Providers.
 */
export function ConnectModelCard() {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center"
      data-testid="connect-model-card"
    >
      <PlugZapIcon className="size-6 text-muted-foreground" aria-hidden />
      <div>
        <h3 className="text-sm font-medium">{appText("chat.connect.connect_a_model_to_get_started")}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {appText("chat.connect.kady_brings_your_own_model_access_sign")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" className="text-xs" onClick={() => openSettings({ tab: "providers", section: "subscriptions" })}>
          <LogInIcon className="size-3.5" />
          {appText("chat.connect.sign_in_with_a_subscription")}</Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => openSettings({ tab: "providers", section: "api-keys" })}
        >
          <KeyRoundIcon className="size-3.5" />
          {appText("chat.connect.add_an_api_key")}</Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => openSettings({ tab: "providers", section: "local-servers" })}
        >
          <HardDriveIcon className="size-3.5" />
          {appText("chat.connect.use_a_local_model")}</Button>
      </div>
    </div>
  );
}
