"use client";
import { geoText } from "@/geo/i18n";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ComputeSelector } from "@/components/compute-selector";
import { DEFAULT_MODEL } from "@/components/model-selector";
import { SettingsLink } from "@/components/settings-link";
import {
  DEFAULT_THINKING_LEVEL,
  ThinkingSelector,
  type ThinkingLevel,
} from "@/components/thinking-selector";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeDefaultFromInstance,
  computeInstanceFromDefault,
  getAppDefaults,
  getImageModels,
  getVerifierAgents,
  putAppDefaults,
  type AppDefaults,
  type ImageModelListing,
} from "@/lib/app-settings";
import type { ModalInstance } from "@/lib/modal-jobs";
import { useModalCatalog } from "@/lib/use-modal-jobs";
import { useModels } from "@/lib/use-models";
import { ModelField } from "./model-field";
import { SettingsCard, SettingsError, SettingsHeader, SettingsNotice } from "./primitives";

const appText = geoText("app");

interface Draft {
  model: string;
  thinkingLevel: ThinkingLevel;
  compute: ModalInstance | null;
  /** "" = not set (built-in order). */
  imageModel: string;
  /** "" = not set (verifiers use their usual model). */
  verifierModel: string;
}

/** Select value for "not set"; Radix forbids an empty-string item value. */
const BUILT_IN_IMAGE_MODEL = "__built-in__";

function draftFrom(defaults: AppDefaults, instances: readonly ModalInstance[] | undefined): Draft {
  return {
    model: defaults.model ?? "",
    thinkingLevel: defaults.thinkingLevel ?? DEFAULT_THINKING_LEVEL,
    compute: computeInstanceFromDefault(defaults.compute, instances),
    imageModel: defaults.imageModel ?? "",
    verifierModel: defaults.verifierModel ?? "",
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.model === b.model &&
    a.thinkingLevel === b.thinkingLevel &&
    a.imageModel === b.imageModel &&
    a.verifierModel === b.verifierModel &&
    JSON.stringify(computeDefaultFromInstance(a.compute)) ===
      JSON.stringify(computeDefaultFromInstance(b.compute))
  );
}

export function DefaultsPanel() {
  const { models } = useModels();
  const modal = useModalCatalog();
  const [saved, setSaved] = useState<AppDefaults | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageModels, setImageModels] = useState<ImageModelListing | null>(null);
  const [imageModelsError, setImageModelsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getImageModels()
      .then((listing) => {
        if (!cancelled) setImageModels(listing);
      })
      .catch((cause) => {
        if (!cancelled) setImageModelsError(cause instanceof Error ? cause.message : appText("settings.defaults.failed_to_load_image_models"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAppDefaults(true)
      .then((value) => {
        if (cancelled) return;
        setSaved(value);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : appText("settings.defaults.failed_to_load_defaults"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rebuild once the Modal catalogue lands so a saved target shows its label.
  const instances = modal.catalog?.instances;
  const baseline = useMemo(() => (saved ? draftFrom(saved, instances) : null), [saved, instances]);
  useEffect(() => {
    if (baseline) setDraft((current) => current ?? baseline);
  }, [baseline]);

  const dirty = Boolean(draft && baseline && !sameDraft(draft, baseline));
  const thinkingModel = models.find((model) => model.id === (draft?.model || DEFAULT_MODEL.id));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await putAppDefaults({
        model: draft.model || null,
        thinkingLevel: draft.thinkingLevel === DEFAULT_THINKING_LEVEL ? null : draft.thinkingLevel,
        compute: computeDefaultFromInstance(draft.compute),
        imageModel: draft.imageModel || null,
        verifierModel: draft.verifierModel || null,
      });
      setSaved(next);
      setDraft(draftFrom(next, instances));
      setNotice(appText("settings.defaults.saved_a_project_s_next_first_chat"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : appText("settings.defaults.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeader
        title={appText("settings.defaults.defaults_for_new_chats")}
        description={
          <>
            {appText("settings.defaults.intro")}
            <SettingsLink tab="specialists">{appText("settings.defaults.specialists")}</SettingsLink>.
          </>
        }
      />

      <SettingsError>{error}</SettingsError>
      <SettingsNotice>{notice}</SettingsNotice>

      {!draft ? (
        <p className="text-xs text-muted-foreground" role="status">
          {appText("settings.defaults.loading")}</p>
      ) : (
        <SettingsCard title={appText("settings.defaults.new_chat")}>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="default-model" className="text-xs font-medium">
                {appText("settings.defaults.model")}</label>
              <ModelField
                id="default-model"
                label={appText("settings.defaults.default_model")}
                value={draft.model}
                emptyLabel={appText("settings.defaults.modelFallback", { model: DEFAULT_MODEL.label })}
                onChange={(model) => setDraft({ ...draft, model })}
              />
              <p className="text-[11px] text-muted-foreground">
                {appText("settings.defaults.pick_a_model_you_have_access_to")}</p>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium">{appText("settings.defaults.thinking_level")}</span>
              <div className="flex">
                <ThinkingSelector
                  selected={draft.thinkingLevel}
                  thinkingSentAs={thinkingModel?.thinkingSentAs}
                  onChange={(thinkingLevel) => setDraft({ ...draft, thinkingLevel })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium">{appText("settings.defaults.compute")}</span>
              <div className="flex">
                <ComputeSelector
                  selected={draft.compute}
                  onChange={(compute) => setDraft({ ...draft, compute })}
                  catalog={modal.catalog}
                  loading={modal.loading}
                  error={modal.error}
                  onRefresh={modal.refresh}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {appText("settings.defaults.remoteHelp")} <SettingsLink tab="services" section="modal">{appText("settings.defaults.services")}</SettingsLink>
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      {draft && (
        <SettingsCard title={appText("settings.defaults.image_generation")}>
          <ImageModelField
            value={draft.imageModel}
            listing={imageModels}
            error={imageModelsError}
            onChange={(imageModel) => setDraft({ ...draft, imageModel })}
          />
        </SettingsCard>
      )}

      {draft && (
        <SettingsCard title={appText("settings.defaults.verification")}>
          <VerifierModelField
            value={draft.verifierModel}
            onChange={(verifierModel) => setDraft({ ...draft, verifierModel })}
          />
        </SettingsCard>
      )}

      {draft && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={!dirty || saving}
            onClick={() => baseline && setDraft(baseline)}
          >
            {appText("settings.defaults.discard")}</Button>
          <Button type="button" size="sm" className="text-xs" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? appText("settings.defaults.saving") : appText("settings.defaults.save_defaults")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The model verifier specialists run on, so checks come from a different model. */
function VerifierModelField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { modelAvailability } = useModels();
  const agents = getVerifierAgents();
  const disconnected = Boolean(value) && modelAvailability({ id: value }) === "unavailable";
  return (
    <div className="grid gap-1.5">
      <label htmlFor="default-verifier-model" className="text-xs font-medium">
        {appText("settings.defaults.verifier_model")}</label>
      <ModelField
        id="default-verifier-model"
        label={appText("settings.defaults.verifier_model")}
        value={value}
        emptyLabel={appText("settings.defaults.not_set_verifiers_run_on_the_same")}
        onChange={onChange}
      />
      {disconnected ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {appText("settings.defaults.verifierDisconnected")} <SettingsLink tab="providers">{appText("settings.defaults.providers")}</SettingsLink>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {appText("settings.defaults.specialists_that_check_work_run_on_this")}</p>
      )}
      {agents.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {appText("settings.defaults.applies_to")}<span className="font-mono">{agents.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

const price = (perMillion: number) => `$${Number.isInteger(perMillion) ? perMillion : perMillion.toFixed(2)}`;

/** Image model for `generate_image`: only models Kady can meter are listed. */
function ImageModelField({
  value,
  listing,
  error,
  onChange,
}: {
  value: string;
  listing: ImageModelListing | null;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const models = listing?.models ?? [];
  const byRef = new Map(models.map((model) => [model.ref, model] as const));
  const builtIn = listing?.builtIn.map((ref) => byRef.get(ref)?.name ?? ref) ?? [];
  const selected = value ? byRef.get(value) : undefined;
  const connected = models.filter((model) => model.available);
  const disconnected = models.filter((model) => !model.available);
  const row = (model: (typeof models)[number]) => (
    <SelectItem key={model.ref} value={model.ref} className="text-xs" disabled={!model.available}>
      <div className="flex flex-col">
        <span>{model.name}</span>
        <span className="text-[10px] text-muted-foreground">
          {appText("settings.defaults.imagePrice", { input: price(model.cost.input), output: price(model.cost.output), editing: model.imageInput ? "yes" : "no" })}
        </span>
      </div>
    </SelectItem>
  );
  return (
    <div className="grid gap-1.5">
      <label htmlFor="default-image-model" className="text-xs font-medium">
        {appText("settings.defaults.image_model")}</label>
      <Select
        value={value || BUILT_IN_IMAGE_MODEL}
        onValueChange={(next) => onChange(next === BUILT_IN_IMAGE_MODEL ? "" : next)}
        disabled={!listing}
      >
        <SelectTrigger id="default-image-model" size="sm" className="h-8 w-full text-xs" aria-label={appText("settings.defaults.default_image_model")}>
          {/* Explicit children: the items carry a price line the trigger must not mirror. */}
          <SelectValue>
            {value ? (selected?.name ?? value) : appText("settings.defaults.imageFallback", { model: builtIn[0] ?? appText("settings.defaults.built_in_order") })}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={BUILT_IN_IMAGE_MODEL} className="text-xs">
              {appText("settings.defaults.imageFallbackOrder", { models: builtIn.length ? builtIn.join(", ") : "none" })}
            </SelectItem>
          </SelectGroup>
          {connected.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">{appText("settings.defaults.connected")}</SelectLabel>
              {connected.map(row)}
            </SelectGroup>
          )}
          {disconnected.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">{appText("settings.defaults.not_connected")}</SelectLabel>
              {disconnected.map(row)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : value && selected && !selected.available ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {appText("settings.defaults.imageDisconnected")} <SettingsLink tab="providers">{appText("settings.defaults.providers")}</SettingsLink>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {appText("settings.defaults.used_when_kady_generates_figures_and_schematics")}</p>
      )}
    </div>
  );
}
