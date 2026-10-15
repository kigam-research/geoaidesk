"use client";
import { geoText } from "@/geo/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/projects";
import { DownloadIcon, SaveIcon, FileTextIcon, ArrowLeftIcon, RefreshCwIcon, PanelTopIcon, ChevronDownIcon, CheckIcon, Table2Icon, PresentationIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { OfficeToolbar, OfficeZoom, type OfficeCommandState, type OfficeCommand } from "./office-toolbar";
import { Button } from "@/components/ui/button";

const filesText = geoText("files");

export function OfficeWorkspace({ path, projectId }: { path: string; projectId: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = useRef(false); dark.current = resolvedTheme === "dark";
  const [advanced, setAdvanced] = useState(false);
  const [commandState, setCommandState] = useState<OfficeCommandState>({});
  const [cell, setCell] = useState("A1"), [formula, setFormula] = useState("");
  const formulaDraft = useRef<string | null>(null);
  const kind = path.split(".").pop()!.toLowerCase();
  const FileIcon = kind === "xlsx" ? Table2Icon : kind === "pptx" ? PresentationIcon : FileTextIcon;
  const frame = useRef<HTMLIFrameElement>(null);
  const source = useRef<{ bytes: ArrayBuffer; kind: string; readOnly: boolean } | null>(null);
  const revision = useRef("");
  const ready = useRef(false), documentOpen = useRef(false), saving = useRef(false), changeVersion = useRef(0);
  const exportJob = useRef<{ id: string; download: boolean; version: number; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [phase, setPhase] = useState(filesText("office_workspace.preparing_office"));
  const [opened, setOpened] = useState(false), [readOnly, setReadOnly] = useState(false);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [frameGeneration, setFrameGeneration] = useState(0);
  const latest = useRef({ dirty, readOnly }); latest.current = { dirty, readOnly };
  const title = path.split("/").pop() ?? path;
  const send = useCallback((data: Record<string, unknown>, transfer: Transferable[] = []) => frame.current?.contentWindow?.postMessage({ source: "kady-office-host", ...data }, window.location.origin, transfer), []);
  const loadIntoEngine = useCallback(() => {
    if (!ready.current || !source.current) return;
    const document = source.current; source.current = null;
    setPhase(filesText("office_workspace.opening_document")); send({ cmd: "load", ...document, dark: dark.current }, [document.bytes]);
  }, [send]);

  const commitFormula = useCallback(() => {
    if (formulaDraft.current === null || latest.current.readOnly) return;
    send({ cmd: "command", command: ".uno:EnterString", args: { StringName: formulaDraft.current } });
    formulaDraft.current = null;
  }, [send]);

  const requestExport = useCallback((download = false) => {
    if (!documentOpen.current || saving.current || (!download && latest.current.readOnly)) return;
    commitFormula();
    saving.current = true; setBusy(true); setError(""); setPhase(download ? filesText("office_workspace.preparing_download") : filesText("office_workspace.saving_to_project"));
    const id = crypto.randomUUID();
    const timeout = setTimeout(() => { exportJob.current = null; saving.current = false; setBusy(false); setError(filesText("office_workspace.office_is_taking_too_long_to_export_your_document_is_still_open_try_saving_again")); }, 120_000);
    exportJob.current = { id, download, version: changeVersion.current, timeout };
    send({ cmd: "export", id });
  }, [send, commitFormula]);

  useEffect(() => {
    const controller = new AbortController();
    const getDocument = async () => {
      try {
        const res = await apiFetch(`/sandbox/office/content?path=${encodeURIComponent(path)}`, { signal: controller.signal }, projectId);
        if (!res.ok) { const detail = await res.json().catch(() => ({})); throw new Error(detail.detail || filesText("office_workspace.load_failed", { status: res.status })); }
        const hash = res.headers.get("X-Content-SHA256");
        if (!hash) throw new Error(filesText("office_workspace.the_backend_did_not_provide_a_document_revision_restart_kady_and_retry"));
        const bytes = await res.arrayBuffer(); if (controller.signal.aborted) return;
        revision.current = hash;
        const protectedFile = res.headers.get("X-Office-Read-Only") === "true";
        latest.current.readOnly = protectedFile; setReadOnly(protectedFile); source.current = { bytes, kind: path.split(".").pop()!.toLowerCase(), readOnly: protectedFile };
        loadIntoEngine();
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : filesText("office_workspace.could_not_open_document")); }
    };
    void getDocument();
    return () => controller.abort();
  }, [path, projectId, frameGeneration, loadIntoEngine]);

  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin || event.data?.source !== "kady-office") return;
      const message = event.data;
      if (message.cmd === "ready") { ready.current = true; loadIntoEngine(); }
      else if (message.cmd === "opened") { setAdvanced(false); documentOpen.current = true; setOpened(true); setPhase(filesText("office_workspace.ready")); }
      else if (message.cmd === "command-state") setCommandState(previous => ({ ...previous, [message.command]: { enabled: !!message.enabled, value: message.value } }));
      else if (message.cmd === "selection") { setCell(String(message.cell)); setFormula(String(message.formula)); formulaDraft.current = null; }
      else if (message.cmd === "progress") { if (!ready.current) setPhase(filesText("office_workspace.loading_office_engine_first_open_downloads_about_50_mb_later_opens_use_the_local_cache")); }
      else if (message.cmd === "modified" && !latest.current.readOnly) { changeVersion.current++; setDirty(true); setPhase(filesText("office_workspace.unsaved_changes")); }
      else if (message.cmd === "save-request") requestExport();
      else if (message.cmd === "download-request") requestExport(true);
      else if (message.cmd === "export-started") { const job = exportJob.current; if (job && job.id === message.id) job.version = changeVersion.current; }
      else if (message.cmd === "error") {
        setError(officeRuntimeError(String(message.message))); setBusy(false); saving.current = false;
        if (exportJob.current) clearTimeout(exportJob.current.timeout); exportJob.current = null;
      } else if (message.cmd === "exported" && exportJob.current?.id === message.id && message.bytes instanceof ArrayBuffer) {
        const job = exportJob.current; if (!job) return; clearTimeout(job.timeout); exportJob.current = null;
        try {
          if (job.download) {
            const url = URL.createObjectURL(new Blob([message.bytes]));
            const a = document.createElement("a"); a.href = url; a.download = title; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            setPhase(filesText("office_workspace.edited_copy_downloaded"));
          } else {
            const res = await apiFetch(`/sandbox/office/content?path=${encodeURIComponent(path)}`, {
              method: "PUT", headers: { "Content-Type": "application/octet-stream", "If-Match": revision.current }, body: message.bytes,
            }, projectId);
            const result = await res.json();
            if (!res.ok) throw new Error(result.detail || filesText("office_workspace.save_failed_your_edits_are_still_open"));
            revision.current = result.revision;
            const newerEdits = changeVersion.current !== job.version;
            setDirty(newerEdits); setPhase(newerEdits ? filesText("office_workspace.newer_changes_are_not_saved_yet") : filesText("office_workspace.saved_to_project"));
            // Other Kady tabs refresh the preview after an editor save.
            try { localStorage.setItem("kady:office-saved", JSON.stringify({ projectId, path, time: Date.now() })); } catch { /* Preview refresh is best-effort when browser storage is blocked. */ }
          }
        } catch (e) { setError(e instanceof Error ? e.message : filesText("office_workspace.save_failed_download_an_edited_copy_to_keep_your_work")); setDirty(true); }
        finally { saving.current = false; setBusy(false); }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [loadIntoEngine, path, projectId, requestExport, title]);

  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (latest.current.dirty || saving.current) { e.preventDefault(); e.returnValue = ""; } };
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); requestExport(); } };
    window.addEventListener("beforeunload", leave); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", leave); window.removeEventListener("keydown", key); if (exportJob.current) clearTimeout(exportJob.current.timeout); };
  }, [requestExport]);

  const command: OfficeCommand = (command, args) => {
    if (!documentOpen.current) return;
    // Formatting buttons keep focus on the current editor, so the formula
    // input may not blur. Commit it before UNO refreshes the selected cell.
    commitFormula();
    send({ cmd: "command", command, args });
  };
  useEffect(() => { if (ready.current) send({ cmd: "theme", dark: resolvedTheme === "dark" }); }, [resolvedTheme, send]);
  function toggleAdvanced() {
    setAdvanced(value => { send({ cmd: "chrome", advanced: !value }); return !value; });
  }
  function reload() {
    if (dirty && !window.confirm(filesText("office_workspace.confirm.reload"))) return;
    ready.current = false; documentOpen.current = false; source.current = null; changeVersion.current = 0; setCommandState({}); setOpened(false); setDirty(false); setError(""); setPhase(filesText("office_workspace.reloading_office")); setFrameGeneration(n => n + 1);
  }
  return <main className="flex h-dvh flex-col overflow-hidden bg-background font-sans">
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-5">
      <a href="/" className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={filesText("office_workspace.back_to_kady")}><ArrowLeftIcon className="size-4" /></a>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50"><FileIcon className="size-4 text-foreground" /></div>
      <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-medium" title={path}>{title}</h1><div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span>{filesText("office_workspace.product")}</span><span aria-hidden="true">/</span><span>{kind === "xlsx" ? filesText("office_workspace.spreadsheet") : kind === "pptx" ? filesText("office_workspace.presentation") : filesText("office_workspace.document")}</span>{readOnly && <span>{filesText("office_workspace.read_only")}</span>}</div></div>
      <Button size="icon-sm" variant="ghost" aria-label={resolvedTheme === "dark" ? filesText("office_workspace.use_light_theme") : filesText("office_workspace.use_dark_theme")} title={filesText("office_workspace.toggle_theme")} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
        {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
      </Button>
      <Button size="sm" variant="ghost" disabled={!opened} aria-label={filesText("office_workspace.all_tools")} title={filesText("office_workspace.all_tools")} aria-pressed={advanced} onClick={toggleAdvanced} className="text-xs text-muted-foreground"><PanelTopIcon className="size-3.5" /><span className="hidden md:inline">{filesText("office_workspace.all_tools")}</span><ChevronDownIcon className="hidden size-3 md:block" /></Button>
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
      <Button size="sm" variant="outline" disabled={!opened || busy} className="text-xs" onClick={() => requestExport(true)}><DownloadIcon className="size-3.5" /><span className="hidden sm:inline">{filesText("office_workspace.download_copy")}</span></Button>
      <Button size="sm" disabled={!opened || busy || readOnly} className="min-w-20 text-xs" onClick={() => requestExport()}><SaveIcon className="size-3.5" /> {busy ? filesText("office_workspace.working") : filesText("office_workspace.save")}</Button>
    </header>
    {!advanced && <OfficeToolbar kind={kind} enabled={opened && !readOnly && !busy} state={commandState} onCommand={command} />}
    {!advanced && kind === "xlsx" && <div className="flex h-10 shrink-0 items-center gap-3 border-b bg-muted/20 px-5">
      <span className="w-16 shrink-0 border-r pr-3 text-xs font-medium tabular-nums text-muted-foreground" aria-label={filesText("office_workspace.selected_cell")}>{cell}</span><span className="text-sm italic text-muted-foreground" aria-hidden="true">ƒx</span>
      <input aria-label={filesText("office_workspace.cell_value_or_formula")} value={formula} disabled={!opened || busy || readOnly || commandState[".uno:EnterString"]?.enabled === false}
        className="h-8 min-w-0 flex-1 bg-transparent font-mono text-xs outline-none disabled:opacity-50" placeholder={filesText("office_workspace.enter_a_value_or_formula")}
        onChange={e => { setFormula(e.target.value); formulaDraft.current = e.target.value; changeVersion.current++; setDirty(true); setPhase(filesText("office_workspace.unsaved_changes")); }}
        onBlur={commitFormula} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitFormula(); } }} />
    </div>}
    {error && <div role="alert" className="border-b bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}{opened && filesText("office_workspace.your_current_work_is_still_in_the_editor_use_download_copy_to_preserve_it")}</div>}
    <div className="relative min-h-0 flex-1 bg-muted/40">
      {!opened && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border bg-muted/40"><FileIcon className="size-6 text-muted-foreground" /></div>
        <div><h2 className="text-base font-medium">{error ? filesText("office_workspace.unable_to_open_office") : filesText("office_workspace.opening_your_workspace")}</h2><p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">{error || phase}</p></div>
        {!error && <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />}
        {error && <Button variant="outline" size="sm" onClick={reload}>{filesText("office_workspace.retry")}</Button>}
      </div>}
      <iframe key={frameGeneration} ref={frame} title={filesText("office_workspace.office_editing_workspace")} src="/office/runtime.html" className="h-full w-full border-0" />
    </div>
    <footer className="flex h-9 shrink-0 items-center gap-3 border-t bg-background px-5 text-[11px] text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5" role="status">{dirty ? <span className="size-1.5 shrink-0 rounded-full bg-foreground/60" /> : opened ? <CheckIcon className="size-3" /> : null}<span className="truncate">{phase}</span></span>
      <span className="flex-1" /><span className="hidden sm:inline">{readOnly ? filesText("office_workspace.read_only_variant") : filesText("office_workspace.local_editing")}</span><span className="h-3.5 w-px bg-border" />
      <OfficeZoom enabled={opened} onCommand={command} />
      <Button size="icon-xs" variant="ghost" disabled={busy} onClick={reload} title={filesText("office_workspace.reload_project_file")} aria-label={filesText("office_workspace.reload_project_file")}><RefreshCwIcon className="size-3" /></Button>
    </footer>
  </main>;
}

export function OfficeOpenHint() {
  return <p className="p-8">{filesText("office_workspace.open_hint")}</p>;
}

function officeRuntimeError(message: string): string {
  for (const key of ["engine_start","browser","editor_load","initialize","encrypted"]) {
    if (message === filesText(`office_runtime.${key}`, {}, "en")) return filesText(`office_runtime.${key}`);
  }
  const prefix = filesText("office_runtime.operation_failed", { detail: "" }, "en");
  if (message.startsWith(prefix)) return filesText("office_runtime.operation_failed", { detail: officeRuntimeError(message.slice(prefix.length)) });
  return message;
}
