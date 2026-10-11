"use client";
import { geoText } from "@/geo/i18n";
import {
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  MonitorIcon,
  RefreshCcwIcon,
  ZapIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type ModalCatalog,
  type ModalInstance,
  parseModalInstance,
} from "@/lib/modal-jobs";
import { cn } from "@/lib/utils";
import { SettingsLink } from "@/components/settings-link";

const appText = geoText("app");

export type { ModalInstance } from "@/lib/modal-jobs";

export const LOCAL_INSTANCE: ModalInstance = {
  id: "local",
  label: appText("chat.compute.local"),
  gpu: null,
  gpuCount: 1,
  cpu: null,
  memoryMiB: null,
  pricePerHour: 0,
  tier: "local",
  description: appText("chat.compute.run_code_in_the_built_in_sandbox"),
  bestFor: appText("chat.compute.default_sandbox_environment"),
};

const TIER_STYLES: Record<string, { dot: string; badge: string }> = {
  local: { dot: "bg-emerald-400", badge: "text-emerald-600 dark:text-emerald-400" },
  cpu: { dot: "bg-slate-400", badge: "text-slate-500" },
  budget: { dot: "bg-sky-400", badge: "text-sky-600 dark:text-sky-400" },
  mid: { dot: "bg-violet-500", badge: "text-violet-600 dark:text-violet-400" },
  high: { dot: "bg-amber-500", badge: "text-amber-600 dark:text-amber-400" },
  flagship: { dot: "bg-rose-500", badge: "text-rose-600 dark:text-rose-400" },
};

function inferredTier(instance: ModalInstance): string {
  if (instance.id === "local") return "local";
  if (instance.tier) return instance.tier;
  if (!instance.gpu) return "cpu";
  if (instance.pricePerHour < 1) return "budget";
  if (instance.pricePerHour < 2) return "mid";
  if (instance.pricePerHour < 4) return "high";
  return "flagship";
}

function TierDot({ instance }: { instance: ModalInstance }) {
  const tier = inferredTier(instance);
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        TIER_STYLES[tier]?.dot ?? "bg-muted-foreground",
      )}
      aria-hidden
    />
  );
}

function memoryLabel(memoryMiB: number | null): string | null {
  if (!memoryMiB) return null;
  return memoryMiB >= 1024
    ? `${Math.round((memoryMiB / 1024) * 10) / 10} GB RAM`
    : `${memoryMiB} MB RAM`;
}

function resourceLabel(instance: ModalInstance): string {
  if (instance.id === "local") return appText("chat.compute.local");
  if (instance.gpu) {
    return `${instance.gpuCount > 1 ? `${instance.gpuCount}× ` : ""}${instance.gpu}`;
  }
  return instance.cpu ? `${instance.cpu} CPU` : "CPU";
}

function describeInstance(instance: ModalInstance): string {
  if (instance.description) return instance.description;
  const details = [
    instance.cpu ? `${instance.cpu} CPU` : null,
    memoryLabel(instance.memoryMiB),
    instance.defaultImage,
  ].filter(Boolean);
  return details.join(" · ") || appText("chat.compute.remote_modal_sandbox");
}

function priceLabel(instance: ModalInstance): string {
  if (instance.id === "local") return appText("chat.compute.free");
  if (!Number.isFinite(instance.pricePerHour)) return appText("chat.compute.estimate_unavailable");
  return appText("chat.compute.price", { price: instance.pricePerHour.toFixed(2) });
}

function normalizedSelected(selected: ModalInstance | null): ModalInstance | null {
  if (!selected) return null;
  return parseModalInstance(selected) ?? selected;
}

/** The server prices host resources once; only the GPU component scales. */
function withGpuCount(instance: ModalInstance, gpuCount: number): ModalInstance {
  return {
    ...instance,
    gpuCount,
    pricePerHour: instance.pricePerHour + (gpuCount - instance.gpuCount) * (instance.gpuPricePerHour ?? 0),
  };
}

function PickerOption({
  instance,
  selected,
  enabled,
  legacy = false,
  onSelect,
}: {
  instance: ModalInstance;
  selected: boolean;
  enabled: boolean;
  legacy?: boolean;
  onSelect: () => void;
}) {
  const tier = inferredTier(instance);
  const styles = TIER_STYLES[tier] ?? TIER_STYLES.cpu;
  const isLocal = instance.id === "local";
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={!enabled}
      onClick={onSelect}
      title={!enabled ? appText("chat.compute.connect_modal_in_settings_services_to_enable") : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-xs transition-colors",
        enabled ? "hover:bg-muted/60 focus-visible:bg-muted/60" : "cursor-not-allowed opacity-50",
        selected && enabled && "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border",
          selected && enabled
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background",
        )}
        aria-hidden
      >
        {selected && enabled ? <CheckIcon className="size-2" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <TierDot instance={instance} />
          <span className={cn("font-semibold", enabled ? "text-foreground" : "text-muted-foreground")}>
            {instance.label}
          </span>
          <span className="text-muted-foreground">{isLocal ? appText("chat.compute.sandbox") : resourceLabel(instance)}</span>
          {legacy ? (
            <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase text-amber-700 dark:text-amber-400">
              {appText("chat.compute.saved")}</span>
          ) : null}
          <span className={cn("ml-auto shrink-0 text-[10px] font-medium tabular-nums", styles.badge)}>
            {priceLabel(instance)}
          </span>
        </span>
        <span className="mt-0.5 block leading-relaxed text-muted-foreground/80">
          {describeInstance(instance)}
        </span>
        {!isLocal &&
        (instance.fallback ||
          instance.cache ||
          instance.gpuCount > 1 ||
          (instance.maxGpuCount ?? 1) > 1) ? (
          <span className="mt-1 flex flex-wrap gap-1">
            {instance.gpuCount > 1 ? (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                {appText("chat.compute.gpuCount", { count: instance.gpuCount })}
              </span>
            ) : null}
            {(instance.maxGpuCount ?? 1) > instance.gpuCount ? (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                {appText("chat.compute.maxGpus", { count: instance.maxGpuCount ?? 1 })}
              </span>
            ) : null}
            {instance.fallback ? (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                {appText("chat.compute.fallback", { target: instance.fallback })}
              </span>
            ) : null}
            {instance.cache ? (
              <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                {appText("chat.compute.cache", { cache: instance.cache })}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export interface ComputePickerBodyProps {
  selected: ModalInstance | null;
  onChange: (instance: ModalInstance | null) => void;
  catalog: ModalCatalog | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelected?: () => void;
}

export function ComputePickerBody({
  selected,
  onChange,
  catalog,
  loading = false,
  error = null,
  onRefresh,
  onSelected,
}: ComputePickerBodyProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const parsedSelected = normalizedSelected(selected);
  const catalogSelected = parsedSelected
    ? catalog?.instances.find((instance) => instance.id === parsedSelected.id)
    : null;
  const effective =
    catalogSelected && parsedSelected
      ? {
          ...withGpuCount(catalogSelected, parsedSelected.gpuCount),
          fallback: parsedSelected.fallback,
          cache: parsedSelected.cache,
        }
      : catalogSelected ?? parsedSelected ?? LOCAL_INSTANCE;
  const modalConfigured = catalog?.modalConfigured ?? false;
  const legacy =
    parsedSelected &&
    parsedSelected.id !== "local" &&
    catalog &&
    !catalog.instances.some((instance) => instance.id === parsedSelected.id)
      ? parsedSelected
      : null;

  const handleSelect = (instance: ModalInstance) => {
    if (instance.id !== "local" && !modalConfigured) return;
    onChange(instance.id === "local" ? null : instance);
    onSelected?.();
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const options = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? []),
    ];
    if (options.length === 0) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowDown"
            ? Math.min(options.length - 1, current + 1)
            : Math.max(0, current === -1 ? options.length - 1 : current - 1);
    options[nextIndex]?.focus();
  };

  return (
    <>
      {!modalConfigured && !loading ? (
        <div className="flex items-start gap-2.5 border-b bg-amber-500/5 px-3 py-2.5">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{appText("chat.compute.modal_is_not_connected")}</span>{" "}
            {appText("chat.compute.save_a_token_id_and_secret_together")}{" "}
            <SettingsLink tab="services" section="modal">
              {appText("chat.compute.settings_services")}</SettingsLink>
            .
            <a
              href="https://modal.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              {appText("chat.compute.create_a_modal_token")}<ExternalLinkIcon className="size-2.5" />
            </a>
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center gap-2 border-b bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          <span className="min-w-0 flex-1">{appText("chat.compute.could_not_refresh_compute_options")}{error}</span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 font-medium hover:bg-destructive/10"
            >
              <RefreshCcwIcon className="size-3" />
              {appText("chat.compute.retry")}</button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={listRef}
        role="listbox"
        aria-label={appText("chat.compute.compute_target")}
        onKeyDown={handleListKeyDown}
        className="max-h-80 overflow-y-auto py-1"
      >
        <PickerOption
          instance={LOCAL_INSTANCE}
          selected={effective.id === "local"}
          enabled
          onSelect={() => handleSelect(LOCAL_INSTANCE)}
        />
        <div role="presentation" className="my-1 border-t px-3 pb-0.5 pt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {appText("chat.compute.modal_compute")}</span>
        </div>
        {legacy ? (
          <PickerOption
            instance={legacy}
            selected
            enabled={modalConfigured}
            legacy
            onSelect={() => handleSelect(legacy)}
          />
        ) : null}
        {catalog?.instances.map((instance) => (
          <PickerOption
            key={instance.id}
            instance={effective.id === instance.id ? effective : instance}
            selected={effective.id === instance.id}
            enabled={modalConfigured}
            onSelect={() => handleSelect(effective.id === instance.id ? effective : instance)}
          />
        ))}
        {loading && !catalog ? (
          <div className="flex items-center gap-2 px-3 py-5 text-xs text-muted-foreground">
            <LoaderCircleIcon className="size-3.5 animate-spin" />
            {appText("chat.compute.loading_server_compute_catalog")}</div>
        ) : null}
        {!loading && catalog && catalog.instances.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {appText("chat.compute.the_server_did_not_return_any_modal")}</p>
        ) : null}
      </div>
      {effective.id !== "local" && modalConfigured ? (
        <div className="grid grid-cols-3 gap-2 border-t bg-muted/10 px-3 py-2.5">
          <label className="space-y-1 text-[10px] font-medium text-muted-foreground">
            {appText("chat.compute.gpu_count")}<select
              aria-label={appText("chat.compute.gpu_count")}
              value={effective.gpuCount}
              disabled={!effective.gpu}
              onChange={(event) =>
                onChange(withGpuCount(effective, Number(event.target.value)))
              }
              className="h-7 w-full rounded border bg-background px-1.5 text-[11px] text-foreground disabled:opacity-50"
            >
              {Array.from(
                { length: effective.gpu ? effective.maxGpuCount ?? 1 : 1 },
                (_, index) => index + 1,
              ).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-medium text-muted-foreground">
            {appText("chat.compute.fallback")}<select
              aria-label={appText("chat.compute.fallback_compute")}
              value={effective.fallback ?? ""}
              onChange={(event) =>
                onChange({
                  ...effective,
                  fallback: event.target.value || null,
                })
              }
              className="h-7 w-full rounded border bg-background px-1.5 text-[11px] text-foreground"
            >
              <option value="">{appText("chat.compute.none")}</option>
              {catalog?.instances
                .filter(
                  (instance) =>
                    instance.id !== effective.id &&
                    instance.kind === effective.kind &&
                    (instance.maxGpuCount ?? 1) >= effective.gpuCount,
                )
                .map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-medium text-muted-foreground">
            {appText("chat.compute.cache")}<select
              aria-label={appText("chat.compute.modal_cache")}
              value={effective.cache ?? catalog?.defaults.cache ?? "project"}
              onChange={(event) =>
                onChange({
                  ...effective,
                  cache: event.target.value,
                })
              }
              className="h-7 w-full rounded border bg-background px-1.5 text-[11px] text-foreground"
            >
              <option value="project">{appText("chat.compute.project")}</option>
              <option value="none">{appText("chat.compute.none")}</option>
            </select>
          </label>
        </div>
      ) : null}
    </>
  );
}

export interface ComputeSelectorProps {
  selected: ModalInstance | null;
  onChange: (instance: ModalInstance | null) => void;
  catalog: ModalCatalog | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function ComputeSelector({
  selected,
  onChange,
  catalog,
  loading = false,
  error = null,
  onRefresh,
}: ComputeSelectorProps) {
  const [open, setOpen] = useState(false);
  const effective = useMemo(() => {
    const parsed = normalizedSelected(selected);
    const catalogInstance = parsed
      ? catalog?.instances.find((instance) => instance.id === parsed.id)
      : null;
    return catalogInstance && parsed
      ? {
          ...withGpuCount(catalogInstance, parsed.gpuCount),
          fallback: parsed.fallback,
          cache: parsed.cache,
        }
      : catalogInstance ?? parsed ?? LOCAL_INSTANCE;
  }, [catalog, selected]);
  const tier = inferredTier(effective);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={appText("chat.compute.current", { name: resourceLabel(effective) })}
          className={cn(
            "flex min-w-20 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            open || selected
              ? "border-border bg-muted/60"
              : "border-transparent hover:border-border hover:bg-muted/40",
          )}
        >
          {loading && !catalog ? (
            <LoaderCircleIcon className="size-3 shrink-0 animate-spin text-muted-foreground" />
          ) : effective.id === "local" ? (
            <MonitorIcon className="size-3 shrink-0 text-muted-foreground" />
          ) : effective.gpu ? (
            <ZapIcon className="size-3 shrink-0 text-muted-foreground" />
          ) : (
            <CpuIcon className="size-3 shrink-0 text-muted-foreground" />
          )}
          {effective.id !== "local" ? <TierDot instance={effective} /> : null}
          <span className={cn("min-w-0 truncate", effective.id === "local" ? "text-muted-foreground" : "font-medium text-foreground")}>
            {effective.id === "local" ? appText("chat.compute.local") : effective.label}
          </span>
          {effective.id !== "local" ? (
            <>
              <span className="shrink-0 text-muted-foreground">{resourceLabel(effective)}</span>
              <span className={cn("shrink-0 text-[10px]", TIER_STYLES[tier]?.badge)}>
                {priceLabel(effective)}
              </span>
            </>
          ) : null}
          <ChevronDownIcon
            className={cn(
              "ml-0.5 size-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl p-0 shadow-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const selectedOption = document.querySelector<HTMLButtonElement>(
              '[role="listbox"] [role="option"][aria-selected="true"]',
            );
            selectedOption?.focus();
          });
        }}
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {appText("chat.compute.compute")}</span>
          {catalog?.defaults.instanceId ? (
            <span className="text-[10px] text-muted-foreground">
              {appText("chat.compute.server_default")}{catalog.defaults.instanceId}
            </span>
          ) : null}
        </div>
        <ComputePickerBody
          selected={selected}
          onChange={onChange}
          catalog={catalog}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
          onSelected={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
