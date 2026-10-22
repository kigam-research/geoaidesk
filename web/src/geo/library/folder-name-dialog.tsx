"use client";

/** Name of a new folder or a renamed one (required input, so a small dialog: UI guide D1). */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/geo/i18n";

const L = (key: string, values?: Record<string, unknown>) => t(`library.folders.${key}`, values as never);

export interface FolderNameDialogProps {
  /** `create` (top level or inside `parentName`) or `rename`. */
  mode: "create" | "rename" | null;
  parentName?: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function FolderNameDialog({ mode, parentName, initialName, onClose, onSubmit }: FolderNameDialogProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (mode) { setName(initialName ?? ""); setFailed(false); } }, [mode, initialName]);
  const valid = name.trim().length > 0 && [...name.trim()].length <= 80;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setFailed(false);
    try { await onSubmit(name.trim()); onClose(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === "rename" ? L("rename.title") : parentName ? L("new.subTitle", { parent: parentName }) : L("new.title")}</DialogTitle>
          <DialogDescription>{L("new.hint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="gaid-folder-name">{L("new.label")}</label>
          <Input id="gaid-folder-name" autoFocus value={name} maxLength={80} placeholder={L("new.placeholder")} onChange={(e) => setName(e.target.value)} />
          {failed && <p className="text-sm text-destructive" role="alert">{L("new.failed")}</p>}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("library.dialog.cancel.button")}</Button>
            <Button type="submit" disabled={!valid || busy}>{mode === "rename" ? L("rename.button") : L("new.save.button")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
