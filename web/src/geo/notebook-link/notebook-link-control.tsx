"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeNotebookUrl } from "@/geo/contracts/notebook-link";
import { t } from "@/geo/i18n";

export interface NotebookLinkControlProps {
  url: string | null;
  onSave: (url: string | null) => Promise<void>;
  context: "folder" | "project";
}

/** Stores an address only. The saved page is opened directly by the browser, never loaded by GAID. */
export function NotebookLinkControl({ url, onSave, context }: NotebookLinkControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const id = useId();
  const safeUrl = normalizeNotebookUrl(url);
  const changeOpen = (next: boolean) => {
    if (next) { setDraft(safeUrl ?? ""); setError(null); }
    setOpen(next);
  };
  const save = async (remove = false) => {
    if (saving.current) return;
    const next = remove ? null : normalizeNotebookUrl(draft);
    if (!remove && !next) {
      setError(t("notebookLink.invalid"));
      inputRef.current?.focus();
      return;
    }
    saving.current = true;
    setBusy(true); setError(null);
    try { await onSave(next); setOpen(false); }
    catch { setError(t("notebookLink.saveFailed")); inputRef.current?.focus(); }
    finally { saving.current = false; setBusy(false); }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" title={new URL(safeUrl).host} className="inline-flex min-h-7 items-center text-sm text-primary hover:underline">{t("notebookLink.open.action")}</a>}
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild><Button variant="ghost" size="sm">{t(safeUrl ? "notebookLink.edit.action" : "notebookLink.add.action")}</Button></PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <h3 className="text-base font-semibold">{t(`notebookLink.${context}.title`)}</h3>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium">{t("notebookLink.url.label")}</label>
              <Input ref={inputRef} id={id} type="text" inputMode="url" autoComplete="off" value={draft} onChange={(event) => { setDraft(event.target.value); setError(null); }} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} />
              <p id={`${id}-hint`} className="text-sm text-muted-foreground">{t("notebookLink.openOnly")}</p>
              {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {safeUrl && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save(true)}>{t("notebookLink.remove.action")}</Button>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("notebookLink.cancel.action")}</Button>
              <Button type="submit" size="sm" disabled={busy}>{t(busy ? "notebookLink.saving" : "notebookLink.save.action")}</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
