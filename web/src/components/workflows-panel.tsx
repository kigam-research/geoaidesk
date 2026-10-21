"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { InfoIcon, PencilIcon, PlayIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ModelSelector,
  type Model,
  DEFAULT_MODEL,
  modelUsesBillableBudget,
} from "@/components/model-selector";
import { useModels } from "@/lib/use-models";
import { geoText, hasGeoText } from "@/geo/i18n";
import workflowsData from "@/data/workflows.json";
import { useAppDefaults } from "@/lib/app-settings";
import { WorkflowInputs, type WorkflowInputProps } from "@/components/workflow-inputs";
import { buildWorkflowPrompt } from "@/lib/workflow-inputs";
import { SourceBadge, UPSTREAM_APP_SOURCE } from "@/geo/attribution/source-badge";

export type Workflow = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  placeholders: { key: string; label: string; required: boolean }[];
  requiresFiles: boolean;
};

const workflowText = geoText("workflows");

/** Missing translations retain the upstream display text after a catalogue sync. */
export function workflowDisplayText(workflow: Workflow, field: "name" | "description" | `inputs.${string}`, fallback: string): string {
  const key = `rows.${workflow.id}.${field}`;
  return hasGeoText(`workflows.${key}`) ? workflowText(key) : fallback;
}

export function workflowMatchesSearch(workflow: Workflow, query: string): boolean {
  const q = query.toLowerCase().trim();
  return [workflow.name, workflow.description, workflow.category,
    workflowDisplayText(workflow, "name", workflow.name),
    workflowDisplayText(workflow, "description", workflow.description),
    workflowText(`categories.${workflow.category}`),
  ].some((text) => text.toLowerCase().includes(q));
}

const ALL_WORKFLOWS = workflowsData as Workflow[];

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: "paper", get label() { return workflowText("categories.paper"); }, color: "text-muted-foreground" },
  { id: "visual", get label() { return workflowText("categories.visual"); }, color: "text-muted-foreground" },
  { id: "data", get label() { return workflowText("categories.data"); }, color: "text-muted-foreground" },
  { id: "literature", get label() { return workflowText("categories.literature"); }, color: "text-muted-foreground" },
  { id: "grants", get label() { return workflowText("categories.grants"); }, color: "text-muted-foreground" },
  { id: "scicomm", get label() { return workflowText("categories.scicomm"); }, color: "text-muted-foreground" },
  { id: "genomics", get label() { return workflowText("categories.genomics"); }, color: "text-muted-foreground" },
  { id: "proteomics", get label() { return workflowText("categories.proteomics"); }, color: "text-muted-foreground" },
  { id: "cellbio", get label() { return workflowText("categories.cellbio"); }, color: "text-muted-foreground" },
  { id: "chemistry", get label() { return workflowText("categories.chemistry"); }, color: "text-muted-foreground" },
  { id: "drugdiscovery", get label() { return workflowText("categories.drugdiscovery"); }, color: "text-muted-foreground" },
  { id: "physics", get label() { return workflowText("categories.physics"); }, color: "text-muted-foreground" },
  { id: "materials", get label() { return workflowText("categories.materials"); }, color: "text-muted-foreground" },
  { id: "clinical", get label() { return workflowText("categories.clinical"); }, color: "text-muted-foreground" },
  { id: "neuro", get label() { return workflowText("categories.neuro"); }, color: "text-muted-foreground" },
  { id: "ecology", get label() { return workflowText("categories.ecology"); }, color: "text-muted-foreground" },
  { id: "finance", get label() { return workflowText("categories.finance"); }, color: "text-muted-foreground" },
  { id: "social", get label() { return workflowText("categories.social"); }, color: "text-muted-foreground" },
  { id: "math", get label() { return workflowText("categories.math"); }, color: "text-muted-foreground" },
  { id: "ml", get label() { return workflowText("categories.ml"); }, color: "text-muted-foreground" },
  { id: "engineering", get label() { return workflowText("categories.engineering"); }, color: "text-muted-foreground" },
  { id: "astro", get label() { return workflowText("categories.astro"); }, color: "text-muted-foreground" },
];

/** Upstream categories, for hosts that let the user file their own rows under one (GAID seam). */
export const WORKFLOW_CATEGORIES: readonly { id: string; label: string }[] = CATEGORIES;

/**
 * GAID seam (gaid-workflow-catalog, geo/integration-boundaries.json): a host
 * can list its own categories and rows with the upstream ones. Its rows are
 * searched, grouped and drawn like upstream rows; selecting one calls the
 * host instead of opening the upstream launch dialog.
 */
export type WorkflowPanelCategory = { id: string; label: string; color: string; bg: string };
export type WorkflowPanelRow = {
  id: string;
  /** An upstream category id or one of the host's categories. */
  category: string;
  name: string;
  description: string;
  icon: LucideIcon;
  badges?: ReactNode;
  /** Extra text matched by the search box. */
  searchText?: string;
  onSelect: () => void;
  /** Optional secondary action shown as an icon button at the row's right edge (e.g. method details). */
  detail?: { label: string; onSelect: () => void };
};
export type WorkflowPanelExtension = {
  /** Categories listed before the upstream ones. */
  leadingCategories?: WorkflowPanelCategory[];
  /** Categories listed after the upstream ones. */
  trailingCategories?: WorkflowPanelCategory[];
  rows?: WorkflowPanelRow[];
  /** Placed beside the search box. */
  headerAction?: ReactNode;
  /** Shown under the category pills. */
  notice?: ReactNode;
  searchPlaceholder?: string;
  /**
   * Fold the built-in workflow list behind one button until the user opens it or searches
   * (GeoAIDesk keeps its own rows first; gaid-qwen-authoring-trial). Extension rows always show.
   */
  collapseUpstream?: { showLabel: (count: number) => string; hideLabel: string };
};

export function WorkflowLaunchDialog({
  workflow,
  open,
  onOpenChange,
  onLaunch,
  onUploadFiles,
  availableFiles,
  availableFolders,
  filesReady,
  onRefreshFiles,
  budgetBlocked = false,
}: {
  workflow: Workflow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunch: (prompt: string, model: Model, inputFiles: string[]) => void;
  budgetBlocked?: boolean;
} & WorkflowInputProps) {
  const [model, setModel] = useState<Model>(DEFAULT_MODEL);
  const { modelAvailability, models: knownModels } = useModels();
  // Start from Settings → Defaults until the user picks a model here.
  const appDefaults = useAppDefaults();
  const modelTouched = useRef(false);
  useEffect(() => {
    if (modelTouched.current || !appDefaults?.model) return;
    const preferred = knownModels.find((candidate) => candidate.id === appDefaults.model);
    if (preferred) setModel(preferred);
  }, [appDefaults, knownModels]);
  const selectedModelAvailability = modelAvailability(model);
  const modelAvailable = selectedModelAvailability === "available";
  const selectedBudgetBlocked =
    budgetBlocked && modelUsesBillableBudget(model);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [inputFolders, setInputFolders] = useState<string[]>([]);
  const [sources, setSources] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);

  const updatePlaceholder = useCallback((key: string, value: string) => {
    setPlaceholderValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const assembledPrompt = useMemo(() => {
    let prompt = workflow.prompt;
    for (const ph of workflow.placeholders) {
      const val = placeholderValues[ph.key]?.trim() || `[${ph.label}]`;
      prompt = prompt.replaceAll(`{${ph.key}}`, val);
    }
    return prompt;
  }, [workflow, placeholderValues]);

  const canLaunch = workflow.placeholders
    .filter((ph) => ph.required)
    .every((ph) => placeholderValues[ph.key]?.trim());

  const finalPrompt = buildWorkflowPrompt(editedPrompt ?? assembledPrompt, inputFiles, sources, inputFolders);

  const handleLaunch = useCallback(() => {
    if (uploading || !canLaunch || selectedBudgetBlocked || !modelAvailable) return;
    onLaunch(finalPrompt, model, inputFiles);
    onOpenChange(false);
    setPlaceholderValues({});
    setInputFiles([]);
    setInputFolders([]);
    setSources("");
    setEditedPrompt(null);
    setIsEditingPrompt(false);
  }, [finalPrompt, model, inputFiles, onLaunch, onOpenChange, uploading, canLaunch, selectedBudgetBlocked, modelAvailable]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {workflowDisplayText(workflow, "name", workflow.name)}
          </DialogTitle>
          <DialogDescription>{workflowDisplayText(workflow, "description", workflow.description)}</DialogDescription>
          <div><SourceBadge source={UPSTREAM_APP_SOURCE} /></div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{workflow.requiresFiles ? workflowText("dialog.data") : workflowText("dialog.data_optional")}</p>
            <WorkflowInputs
              availableFiles={availableFiles}
              availableFolders={availableFolders}
              filesReady={filesReady}
              onRefreshFiles={onRefreshFiles}
              onUploadFiles={onUploadFiles}
              files={inputFiles}
              onFilesChange={setInputFiles}
              folders={inputFolders}
              onFoldersChange={setInputFolders}
              sources={sources}
              onSourcesChange={setSources}
              uploading={uploading}
              onUploadingChange={setUploading}
            />
          </div>

          {workflow.placeholders.length > 0 && (
            <div className="space-y-3">
              {workflow.placeholders.map((ph) => (
                <div key={ph.key}>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    {workflowDisplayText(workflow, `inputs.${ph.key}`, ph.label)}
                    {ph.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  <input
                    type="text"
                    value={placeholderValues[ph.key] ?? ""}
                    onChange={(e) => updatePlaceholder(ph.key, e.target.value)}
                    placeholder={workflowDisplayText(workflow, `inputs.${ph.key}`, ph.label)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                {isEditingPrompt ? workflowText("dialog.edit_prompt") : workflowText("dialog.prompt_preview")}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!isEditingPrompt) {
                    setEditedPrompt(editedPrompt ?? assembledPrompt);
                  }
                  setIsEditingPrompt(!isEditingPrompt);
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilIcon className="size-3" />
                {isEditingPrompt ? workflowText("dialog.done") : workflowText("dialog.edit")}
              </button>
            </div>
            {isEditingPrompt ? (
              <textarea
                value={editedPrompt ?? assembledPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="max-h-48 min-h-[5rem] w-full resize-y rounded-md border bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {finalPrompt}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ModelSelector
              selected={model}
              onChange={(next) => {
                modelTouched.current = true;
                setModel(next);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {workflowText("dialog.cancel")}
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={uploading || !canLaunch || selectedBudgetBlocked || !modelAvailable}
            title={
              !modelAvailable
                ? selectedModelAvailability === "checking"
                  ? workflowText("dialog.provider_loading")
                  : workflowText("dialog.provider_disconnected")
                : selectedBudgetBlocked
                ? workflowText("dialog.budget_blocked")
                : undefined
            }
            className="gap-1.5"
          >
            <PlayIcon className="size-3.5" />
            {workflowText("dialog.run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkflowsPanel({
  onLaunch,
  onUploadFiles,
  availableFiles,
  availableFolders,
  filesReady,
  onRefreshFiles,
  budgetBlocked = false,
  extension,
}: {
  onLaunch: (prompt: string, model: Model, inputFiles: string[]) => void;
  budgetBlocked?: boolean;
  extension?: WorkflowPanelExtension;
} & WorkflowInputProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [search, setSearch] = useState("");
  const [upstreamOpen, setUpstreamOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const upstreamFolded = Boolean(extension?.collapseUpstream) && !upstreamOpen && !search.trim();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ALL_WORKFLOWS;
    return ALL_WORKFLOWS.filter((w) => workflowMatchesSearch(w, q));
  }, [search]);

  const categories = useMemo<{ id: string; label: string; color: string; bg?: string }[]>(
    () => [...(extension?.leadingCategories ?? []), ...CATEGORIES, ...(extension?.trailingCategories ?? [])],
    [extension?.leadingCategories, extension?.trailingCategories]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, (Workflow | WorkflowPanelRow)[]>();
    for (const cat of categories) map.set(cat.id, []);
    const q = search.toLowerCase().trim();
    const label = new Map(categories.map((cat) => [cat.id, cat.label.toLowerCase()]));
    for (const row of extension?.rows ?? []) {
      const text = [row.name, row.description, row.searchText ?? "", label.get(row.category) ?? ""].join("\n").toLowerCase();
      if (!q || text.includes(q)) map.get(row.category)?.push(row);
    }
    if (!upstreamFolded) {
      for (const w of filtered) {
        const list = map.get(w.category);
        if (list) list.push(w);
      }
    }
    return map;
  }, [categories, extension?.rows, filtered, search, upstreamFolded]);

  const visibleCategories = useMemo(
    () => categories.filter((cat) => (grouped.get(cat.id)?.length ?? 0) > 0),
    [categories, grouped]
  );

  const scrollToCategory = useCallback((catId: string) => {
    const container = scrollRef.current;
    if (!container) return;
    const section = container.querySelector(`[data-category="${catId}"]`);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gaid-frame">
      {/* Search + category pills */}
      <div className="shrink-0 border-b px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={extension?.searchPlaceholder ?? workflowText("panel.search")}
              aria-label={extension?.searchPlaceholder ?? workflowText("panel.search")}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
          {extension?.headerAction}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="shrink-0 rounded-sm border border-input bg-background px-2.5 py-1 text-xs font-medium text-gaid-body transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
        {extension?.notice}
      </div>

      {/* Scrollable workflow grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {categories.map((cat) => {
            const workflows = grouped.get(cat.id);
            if (!workflows || workflows.length === 0) return null;
            return (
              <section key={cat.id} data-category={cat.id}>
                <h3 className="mb-2.5 text-sm font-semibold text-foreground">
                  {cat.label}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({workflows.length})
                  </span>
                </h3>
                <div className="divide-y border-y border-border">
                  {workflows.map((w) => {
                    if ("onSelect" in w) {
                      // GAID rows: one line of description (UI guide G1); details open from the row's own action.
                      return (
                        <div key={w.id} className="flex items-start transition-colors hover:bg-accent/50">
                          <button
                            onClick={w.onSelect}
                            className="flex min-w-0 flex-1 items-start gap-3 rounded-none px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">{w.name}</span>
                                {w.badges}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-1" title={w.description}>
                                {w.description}
                              </p>
                            </div>
                          </button>
                          {w.detail && (
                            <button
                              type="button"
                              onClick={w.detail.onSelect}
                              aria-label={w.detail.label}
                              title={w.detail.label}
                              className="m-2 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <InfoIcon className="size-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWorkflow(w)}
                        className="flex items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{workflowDisplayText(w, "name", w.name)}</span>
                            <SourceBadge source={UPSTREAM_APP_SOURCE} asText />
                            {w.requiresFiles && (
                              <span className="inline-flex items-center rounded-sm border border-border bg-gaid-pending-bg px-1.5 py-px text-xs font-medium text-muted-foreground">
                                {workflowText("panel.needs_data")}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {workflowDisplayText(w, "description", w.description)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {extension?.collapseUpstream && !search.trim() && (
            <button
              type="button"
              onClick={() => setUpstreamOpen(!upstreamOpen)}
              aria-expanded={upstreamOpen}
              className="w-full rounded-none border border-dashed px-3.5 py-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
            >
              {upstreamOpen ? extension.collapseUpstream.hideLabel : extension.collapseUpstream.showLabel(ALL_WORKFLOWS.length)}
            </button>
          )}
        </div>
      </div>

      {selectedWorkflow && (
        <WorkflowLaunchDialog
          workflow={selectedWorkflow}
          open={!!selectedWorkflow}
          onOpenChange={(open) => {
            if (!open) setSelectedWorkflow(null);
          }}
          onLaunch={onLaunch}
          onUploadFiles={onUploadFiles}
          availableFiles={availableFiles}
          availableFolders={availableFolders}
          filesReady={filesReady}
          onRefreshFiles={onRefreshFiles}
          budgetBlocked={budgetBlocked}
        />
      )}
    </div>
  );
}
