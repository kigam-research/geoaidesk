"use client";

import { useId, useMemo, useRef, useState } from "react";
import { FileIcon, FolderIcon, FolderUpIcon, LoaderIcon, RefreshCwIcon, UploadIcon, XIcon } from "lucide-react";
import { geoText } from "@/geo/i18n";
import { Button } from "@/components/ui/button";

const inputText = geoText("workflows");

export interface WorkflowInputProps {
  availableFiles?: string[];
  availableFolders?: string[];
  filesReady?: boolean;
  onRefreshFiles?: () => Promise<void>;
  onUploadFiles?: (files: FileList | File[], paths?: string[]) => Promise<string[]>;
}

export function WorkflowInputs({
  availableFiles = [], availableFolders = [], filesReady = true, onRefreshFiles, onUploadFiles,
  files, onFilesChange, folders, onFoldersChange, sources, onSourcesChange, uploading, onUploadingChange,
}: WorkflowInputProps & {
  files: string[];
  onFilesChange: (files: string[]) => void;
  folders: string[];
  onFoldersChange: (folders: string[]) => void;
  sources: string;
  onSourcesChange: (sources: string) => void;
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const entries = useMemo(() => [
    ...availableFolders.map((path) => ({ path, folder: true })),
    ...availableFiles.map((path) => ({ path, folder: false })),
  ], [availableFiles, availableFolders]);
  const matches = useMemo(() => entries.filter(({ path }) => path.toLowerCase().includes(query.trim().toLowerCase())), [entries, query]);
  const selected = [
    ...folders.map((path) => ({ path, folder: true })),
    ...files.map((path) => ({ path, folder: false })),
  ];

  function select(path: string, folder: boolean, checked: boolean) {
    const values = folder ? folders : files;
    const onChange = folder ? onFoldersChange : onFilesChange;
    onChange(checked ? [...new Set([...values, path])] : values.filter((value) => value !== path));
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = Array.from(input.files ?? []);
    if (!picked.length || !onUploadFiles) return;
    onUploadingChange(true);
    setError(null);
    try {
      const paths = await onUploadFiles(picked);
      onFilesChange([...new Set([...files, ...paths])]);
      if (paths.length < picked.length) setError(inputText("inputs.partial_upload"));
    } catch (err) {
      setError(err instanceof Error ? err.message : inputText("inputs.upload_failed"));
    } finally {
      input.value = "";
      onUploadingChange(false);
    }
  }

  return <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs font-medium">{inputText("inputs.sandbox")}</legend>
      <p className="text-xs text-muted-foreground">{inputText("inputs.sandbox_help")}</p>
      <div className="flex gap-2">
        <input aria-label={inputText("inputs.search")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={inputText("inputs.search_placeholder")} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs" />
        {onRefreshFiles && <Button type="button" size="xs" variant="outline" disabled={refreshing} aria-label={inputText("inputs.refresh_label")} onClick={async () => {
          setRefreshing(true);
          setError(null);
          try { await onRefreshFiles(); }
          catch { setError(inputText("inputs.refresh_failed")); }
          finally { setRefreshing(false); }
        }}><RefreshCwIcon className={refreshing ? "size-3 animate-spin" : "size-3"} /> {inputText("inputs.refresh")}</Button>}
      </div>
      {!filesReady ? <p className="text-xs text-muted-foreground">{inputText("inputs.not_ready")}</p> : !matches.length ? <p className="text-xs text-muted-foreground">{entries.length ? inputText("inputs.no_matches") : inputText("inputs.empty")}</p> : <div className="max-h-40 overflow-y-auto rounded border bg-background p-2">
        {matches.slice(0, 100).map(({ path, folder }) => <label key={`${folder}:${path}`} className="flex items-start gap-2 py-1 text-xs">
          <input type="checkbox" checked={(folder ? folders : files).includes(path)} disabled={uploading} onChange={(e) => select(path, folder, e.target.checked)} />
          {folder ? <FolderIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" /> : <FileIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="break-all">{path}{folder ? "/" : ""}</span>
        </label>)}
      </div>}
      {matches.length > 100 && <p className="text-xs text-muted-foreground">{inputText("inputs.showing", { count: matches.length })}</p>}
    </fieldset>
    {!!selected.length && <div className="space-y-1">
      <p className="text-xs font-medium">{inputText("inputs.selected")}</p>
      <ul className="max-h-24 overflow-y-auto">
        {selected.map(({ path, folder }) => <li key={`${folder}:${path}`} className="flex items-start justify-between gap-2 text-xs">
          <span className="break-all">{path}{folder ? "/" : ""}</span>
          <button type="button" disabled={uploading} aria-label={inputText("inputs.remove", { path: `${path}${folder ? "/" : ""}` })} onClick={() => select(path, folder, false)} className="shrink-0 p-0.5"><XIcon className="size-3" /></button>
        </li>)}
      </ul>
      <p className="text-[11px] text-muted-foreground">{inputText("inputs.remove_help")}</p>
    </div>}
    <p className="text-xs text-muted-foreground">{inputText("inputs.source_help")}</p>
    {onUploadFiles && <div className="flex flex-wrap gap-2">
      <input ref={fileInput} aria-label={inputText("inputs.upload_files_label")} type="file" multiple className="hidden" onChange={upload} />
      {/* @ts-expect-error -- webkitdirectory is supported in all major browsers */}
      <input ref={folderInput} aria-label={inputText("inputs.upload_folder_label")} type="file" webkitdirectory="" className="hidden" onChange={upload} />
      <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
        {uploading ? <LoaderIcon className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />} {inputText("inputs.upload_files")}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => folderInput.current?.click()}>
        <FolderUpIcon className="size-3.5" /> {inputText("inputs.upload_folder")}
      </Button>
    </div>}
    <details>
      <summary className="cursor-pointer text-xs font-medium">{inputText("inputs.host_source")}</summary>
      <label htmlFor={`${id}-sources`} className="mb-1 mt-2 block text-xs font-medium">{inputText("inputs.locations")}</label>
      <textarea id={`${id}-sources`} value={sources} onChange={(e) => onSourcesChange(e.target.value)} rows={3}
        placeholder={inputText("inputs.location_examples")}
        className="w-full resize-y rounded-md border bg-background px-2 py-1 text-xs" aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{inputText("inputs.access_help")}</p>
    </details>
    {uploading && <p role="status" className="text-xs text-muted-foreground">{inputText("inputs.uploading")}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
