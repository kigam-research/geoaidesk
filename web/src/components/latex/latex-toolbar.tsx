"use client";
import { geoText } from "@/geo/i18n";

import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CrosshairIcon,
  ItalicIcon,
  ListTreeIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  PlayIcon,
  PlusIcon,
  SpellCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const filesText = geoText("files");

export type Engine = "pdflatex" | "xelatex" | "lualatex";
export type LatexViewMode = "source" | "split" | "pdf";

export const ENGINES: { id: Engine; label: string }[] = [
  { id: "pdflatex", label: "pdfLaTeX" },
  { id: "xelatex", label: "XeLaTeX" },
  { id: "lualatex", label: "LuaLaTeX" },
];

export type SnippetAction =
  | { kind: "wrap"; before: string; after: string }
  | { kind: "block"; text: string };

const BLOCK_SNIPPETS: { label: string; text: string }[] = [
  {
    label: filesText("latex_toolbar.figure"),
    text: "\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}\n",
  },
  {
    label: filesText("latex_toolbar.table"),
    text: "\\begin{table}[htbp]\n  \\centering\n  \\caption{}\n  \\label{tab:}\n  \\begin{tabular}{lcc}\n    \\toprule\n     &  &  \\\\\n    \\midrule\n     &  &  \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}\n",
  },
  { label: filesText("latex_toolbar.equation"), text: "\\begin{equation}\n  \n  \\label{eq:}\n\\end{equation}\n" },
  { label: filesText("latex_toolbar.itemize"), text: "\\begin{itemize}\n  \\item \n\\end{itemize}\n" },
  { label: filesText("latex_toolbar.enumerate"), text: "\\begin{enumerate}\n  \\item \n\\end{enumerate}\n" },
];

export interface LatexToolbarProps {
  compiling: boolean;
  saving: boolean;
  saved: boolean;
  isDirty: boolean;
  engine: Engine;
  onEngineChange: (e: Engine) => void;
  onCompile: () => void;
  onSave: () => void;
  onDiscard: () => void;
  errorCount: number;
  warningCount: number;
  hasPdf: boolean;
  previewStale: boolean;
  compileFailed: boolean;
  editingLocked: boolean;
  viewMode: LatexViewMode;
  onViewModeChange: (mode: LatexViewMode) => void;
  onAiEdit: () => void;
  hasLog: boolean;
  logOpen: boolean;
  onToggleLog: () => void;
  autoCompile: boolean;
  onToggleAutoCompile: () => void;
  wordCount: number;
  modKey: string;
  onSnippet: (action: SnippetAction) => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  spellcheck: boolean;
  onToggleSpellcheck: () => void;
  syncAvailable: boolean;
  onJumpToPdf: () => void;
  onAskKady: () => void;
}

export function LatexToolbar(p: LatexToolbarProps) {
  const [insertOpen, setInsertOpen] = useState(false);
  const insertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!insertOpen) return;
    const close = (e: MouseEvent) => {
      if (!insertRef.current?.contains(e.target as Node)) setInsertOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [insertOpen]);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
      <button
        onClick={p.onCompile}
        disabled={p.compiling || p.editingLocked}
        title={filesText("latex_toolbar.compile_shortcut", { key: p.modKey })}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          p.compiling
            ? "bg-muted text-muted-foreground"
            : "bg-emerald-600 text-white hover:bg-emerald-700",
        )}
      >
        {p.compiling ? (
          <LoaderCircleIcon className="size-3.5 animate-spin" />
        ) : (
          <PlayIcon className="size-3.5" />
        )}
        {p.compiling ? filesText("latex_toolbar.compiling") : filesText("latex_toolbar.compile")}
      </button>

      <select
        aria-label={filesText("latex_toolbar.latex_engine")}
        value={p.engine}
        disabled={p.compiling}
        onChange={(e) => p.onEngineChange(e.target.value as Engine)}
        className="rounded-md border bg-background px-2 py-1 text-xs text-foreground outline-none"
      >
        {ENGINES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>

      <label
        className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground"
        title={filesText("latex_toolbar.compile_automatically_after_each_save")}
      >
        <input
          type="checkbox"
          checked={p.autoCompile}
          onChange={p.onToggleAutoCompile}
          className="size-3"
        />
         {filesText("latex_toolbar.compile_on_save")} </label>

      <div className="h-4 w-px bg-border" />

      {/* Quick inserts */}
      <button
        onClick={() => p.onSnippet({ kind: "wrap", before: "\\textbf{", after: "}" })}
        disabled={p.editingLocked}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={filesText("latex_toolbar.bold")}
      >
        <BoldIcon className="size-3.5" />
      </button>
      <button
        onClick={() => p.onSnippet({ kind: "wrap", before: "\\emph{", after: "}" })}
        disabled={p.editingLocked}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title={filesText("latex_toolbar.emphasis")}
      >
        <ItalicIcon className="size-3.5" />
      </button>
      <button
        onClick={() => p.onSnippet({ kind: "wrap", before: "$", after: "$" })}
        disabled={p.editingLocked}
        className="rounded p-1 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        title={filesText("latex_toolbar.inline_math")}
      >
        $
      </button>
      <div ref={insertRef} className="relative">
        <button
          onClick={() => setInsertOpen((v) => !v)}
          disabled={p.editingLocked}
          className="flex items-center gap-0.5 rounded p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title={filesText("latex_toolbar.insert_block")}
        >
          <PlusIcon className="size-3.5" />
          <ChevronDownIcon className="size-3" />
        </button>
        {insertOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border bg-background shadow-lg">
            {BLOCK_SNIPPETS.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  p.onSnippet({ kind: "block", text: s.text });
                  setInsertOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={p.onToggleOutline}
        className={cn(
          "rounded p-1 transition-colors hover:bg-muted",
          p.outlineOpen ? "text-foreground" : "text-muted-foreground",
        )}
        title={filesText("latex_toolbar.toggle_outline")}
      >
        <ListTreeIcon className="size-3.5" />
      </button>

      <button
        onClick={p.onToggleSpellcheck}
        className={cn(
          "rounded p-1 transition-colors hover:bg-muted",
          p.spellcheck ? "text-foreground" : "text-muted-foreground",
        )}
        title={filesText("latex_toolbar.toggle_spell_check")}
      >
        <SpellCheckIcon className="size-3.5" />
      </button>

      <button
        onClick={p.onJumpToPdf}
        disabled={!p.syncAvailable}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        title={p.syncAvailable ? filesText("latex_toolbar.jump_to_pdf_synctex") : filesText("latex_toolbar.synctex_unavailable_compile_first")}
      >
        <CrosshairIcon className="size-3.5" />
      </button>

      <button
        onClick={p.onAiEdit}
        disabled={p.editingLocked || p.compiling || p.saving}
        title={filesText("latex_toolbar.ai_shortcut", { key: p.modKey })}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 hover:bg-violet-500/10 disabled:opacity-40 dark:text-violet-400"
      >
        <SparklesIcon className="size-3.5" />  {filesText("latex_toolbar.edit_with_ai")} </button>

      <button
        onClick={p.onAskKady}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
        title={filesText("latex_toolbar.ask_kady_about_this_document_in_chat")}
      >
        <MessageCircleIcon className="size-3.5" />  {filesText("latex_toolbar.ask_kady")} </button>

      {/* Status */}
      {(p.errorCount > 0 || p.warningCount > 0) && !p.compiling && (
        <button
          onClick={p.onToggleLog}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
            p.errorCount > 0
              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40",
          )}
        >
          <AlertTriangleIcon className="size-3.5" />
          {p.errorCount > 0
            ? filesText("latex_toolbar.error_count", { count: p.errorCount })
            : filesText("latex_toolbar.warning_count", { count: p.warningCount })}
        </button>
      )}
      {p.hasPdf && !p.compiling && (
        <span className={cn("flex items-center gap-1 text-xs", p.previewStale || p.compileFailed ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
          {p.previewStale || p.compileFailed ? <AlertTriangleIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
          {p.compileFailed ? filesText("latex_toolbar.last_successful_pdf") : p.previewStale ? filesText("latex_toolbar.pdf_out_of_date") : filesText("latex_toolbar.pdf_ready")}
        </span>
      )}

      <div className="flex-1" />
      <div role="group" aria-label={filesText("latex_toolbar.latex_view")} className="flex overflow-hidden rounded-md border text-[11px]">
        {(["source", "split", "pdf"] as const).map((mode) => (
          <button key={mode} aria-pressed={p.viewMode === mode} onClick={() => p.onViewModeChange(mode)} className={cn("px-2 py-1", p.viewMode === mode ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50")}>
            {mode === "pdf" ? "PDF" : mode === "source" ? filesText("latex_toolbar.source") : filesText("latex_toolbar.split")}
          </button>
        ))}
      </div>

      <span className="text-[10px] tabular-nums text-muted-foreground/70">{filesText("latex_toolbar.word_count", { count: p.wordCount })}</span>

      {p.hasLog && (
        <button
          onClick={p.onToggleLog}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          {p.logOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronUpIcon className="size-3.5" />}
           {filesText("latex_toolbar.log")} </button>
      )}

      <div className="h-4 w-px bg-border" />

      <div
        className={cn(
          "size-2 rounded-full transition-colors",
          p.isDirty ? "bg-amber-500" : "bg-muted-foreground/30",
        )}
      />
      <span className="font-mono text-[10px] text-muted-foreground/60">{filesText("latex_toolbar.shortcuts", { key: p.modKey })}</span>

      <button
        onClick={p.onSave}
        disabled={!p.isDirty || p.saving || p.compiling || p.editingLocked}
        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {p.saved ? <CheckIcon className="size-3" /> : null}
        {p.saving ? filesText("latex_toolbar.saving") : p.saved ? filesText("latex_toolbar.saved") : filesText("latex_toolbar.save")}
      </button>

      <button
        onClick={p.onDiscard}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
         {filesText("latex_toolbar.close")} </button>
    </div>
  );
}
