"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/geo/i18n";
import { DIGEST_IMPORT_BYTES, DIGEST_IMPORT_TYPES, type DigestImportPreview, type LibraryItem } from "@/geo/contracts/library";
import { normalizeNotebookUrl } from "@/geo/contracts/notebook-link";
import { importDigest, LibraryApiError, previewDigestImport } from "./api";

const text = (key: string, values?: Record<string, unknown>) => t(`digestImport.${key}`, values as never);

type ImportError = { key: string; technical?: string };
export function DigestImportSheet({ open, onOpenChange, collectionId, collectionName, notebookUrl, onImported }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId?: string;
  collectionName?: string;
  notebookUrl?: string;
  onImported: (item: LibraryItem) => void;
}) {
  const id = useId(), fileInput = useRef<HTMLInputElement>(null), errorElement = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<DigestImportPreview | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState(notebookUrl ?? "");
  const [urlTouched, setUrlTouched] = useState(false);
  const [covers, setCovers] = useState<string[]>([]);
  const [reading, setReading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  useEffect(() => { if (!urlTouched) setUrl(notebookUrl ?? ""); }, [notebookUrl, urlTouched]);
  useEffect(() => { if (open && error) errorElement.current?.focus(); }, [error, open]);
  useEffect(() => () => { request.current++; }, []);
  // Preserve the draft on dismiss (D7); completed imports clear it. A new file supersedes an older read.
  const pick = async (file?: File) => {
    if (!file || saving) return;
    const seq = ++request.current;
    setFileName(file.name); setPreview(null); setCovers([]); setError(null); setReading(false);
    if (!DIGEST_IMPORT_TYPES.some((ext) => file.name.toLowerCase().endsWith(ext))) { setError({ key: "errors.type" }); return; }
    if (file.size > DIGEST_IMPORT_BYTES) { setError({ key: "errors.size" }); return; }
    setReading(true);
    try {
      const found = await previewDigestImport(file);
      if (seq !== request.current) return;
      setPreview(found); setTitle(found.title); setCovers(found.matches.map((m) => m.itemId));
    } catch (e) {
      if (seq !== request.current) return;
      setError({ key: e instanceof LibraryApiError && e.status === 413 ? "errors.size" : "errors.read", ...(e instanceof LibraryApiError ? { technical: `HTTP ${e.status}\n${e.message}` } : {}) });
    } finally { if (seq === request.current) setReading(false); }
  };
  const save = async () => {
    if (!preview || reading || saving) return;
    setError(null);
    if (url.trim() && !normalizeNotebookUrl(url)) { setError({ key: "errors.url" }); return; }
    setSaving(true);
    let item: LibraryItem;
    try {
      ({ item } = await importDigest({ token: preview.token, title: title.trim(), covers, ...(url.trim() ? { notebookUrl: url.trim() } : {}), ...(collectionId ? { collectionId } : {}) }));
    } catch (e) {
      setError({ key: e instanceof LibraryApiError && e.status === 410 ? "errors.expired" : "errors.save", ...(e instanceof LibraryApiError ? { technical: `HTTP ${e.status}\n${e.message}` } : {}) });
      setSaving(false); return;
    }
    setSaving(false); setPreview(null); setFileName(""); setTitle(""); setCovers([]);
    onImported(item); onOpenChange(false);
  };
  const reason = reading ? "reading" : !preview ? "needFile" : !title.trim() ? "needTitle" : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-6 sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{text("title")}</DialogTitle>
          <DialogDescription>{text("context")}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-1" aria-busy={reading || saving}>
          <section>
            <h3 className="mb-1 text-sm font-medium">{text("fileLabel")}</h3>
            <p id={`${id}-hint`} className="mb-2 text-sm text-muted-foreground">{text("fileHint")}</p>
            <div className="flex items-center gap-3 rounded-md border border-input px-3 py-2.5"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}>
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={fileName}>{fileName || text("drop")}</span>
              <Button variant="outline" size="sm" className="min-w-24" disabled={saving} onClick={() => fileInput.current?.click()}>{reading ? text("reading") : fileName ? text("replace.button") : text("pick.button")}</Button>
              <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label={text("fileLabel")} aria-describedby={`${id}-hint`} accept={DIGEST_IMPORT_TYPES.join(",")} disabled={saving}
                onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <p className="mt-2 rounded-md bg-gaid-face-2 px-3 py-2.5 text-sm text-muted-foreground">{text("limit")}</p>
          </section>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-title`}>
              <span className="font-medium">{text("nameLabel")}</span>
              <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} disabled={saving} />
            </label>
            <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-url`}>
              <span className="font-medium">{text("urlLabel")}</span>
              <Input id={`${id}-url`} value={url} type="url" maxLength={2048} disabled={saving} onChange={(e) => { setUrlTouched(true); setUrl(e.target.value); }} />
            </label>
          </div>
          {preview && <section>
            <h3 className="text-sm font-medium">{text("covers.heading")}</h3>
            <p className="mb-2 mt-1 text-sm text-muted-foreground">{text("coversHint")}</p>
            {!preview.matches.length && <p className="text-sm text-muted-foreground">{text("noMatches")}</p>}
            <ul className="divide-y divide-border border-t border-border">
              {preview.matches.map((m) => <li key={m.itemId}>
                <label className="flex cursor-pointer items-start gap-3 px-2 py-2.5 hover:bg-accent">
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" checked={covers.includes(m.itemId)} disabled={saving}
                    onChange={(e) => setCovers((old) => e.target.checked ? [...old, m.itemId] : old.filter((i) => i !== m.itemId))} />
                  <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-sm font-medium" title={m.title}>{m.title}</span>
                    <span className="text-sm text-muted-foreground">{[m.authors, m.year, text(m.by === "doi" ? "byDoi" : "byTitle")].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              </li>)}
              {preview.unmatched.map((m, i) => <li key={i} className="px-2 py-2.5">
                <p className="truncate text-sm" title={m.title}>{m.title}</p><p className="text-sm text-muted-foreground">{text("unmatched")}</p>
              </li>)}
            </ul>
            <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">{text("excerpt")}</summary><p className="mt-2 whitespace-pre-wrap break-words">{preview.excerpt}</p></details>
          </section>}
          {error && <div ref={errorElement} role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
            <p>{text(error.key)}</p>
            {error.technical && <details className="mt-2"><summary className="cursor-pointer">{text("error.technical")}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-sm">{error.technical}</pre><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(error.technical!)}>{text("copy.button")}</Button></details>}
          </div>}
        </div>
        <div className="border-t pt-4">
          <DialogFooter className="items-center">
            <p className="mr-auto min-w-0 truncate text-sm text-muted-foreground">{collectionName ? text("folder", { name: collectionName }) : text("rootFolder")}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{text("cancel.button")}</Button>
            <Button className="h-10 min-w-28" disabled={Boolean(reason) || saving} onClick={() => void save()}>{saving ? text("saving") : text("save.button")}</Button>
          </DialogFooter>
          {reason && <p role="status" className="mt-2 text-right text-sm text-muted-foreground">{text(reason)}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
