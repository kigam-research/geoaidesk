"use client";

/**
 * 논문 넣기: a GAID-managed item from a PDF and reference details the researcher checks (ADR decision 2). Metadata
 * lookup by DOI/PDF (Crossref, OpenAlex, KCI) fills these fields once its routes exist; the researcher always confirms.
 */
import { useEffect, useRef, useState } from "react";
import { FileUpIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/geo/i18n";
import type { CslItem, LibraryItem, UploadedLibraryFile } from "@/geo/contracts/library";
import { addLibraryItem, LibraryApiError, uploadLibraryPdf } from "./api";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);

/** "Kim, Hong A, Lee" -> CSL names (family first, as the label asks). */
export function parseAuthors(text: string): CslItem["author"] {
  return text.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean).map((name) => {
    const [family, ...given] = name.split(/\s+/);
    return given.length ? { family, given: given.join(" ") } : { family };
  });
}

export function AddPaperDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (item: LibraryItem) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; uploaded?: UploadedLibraryFile; busy: boolean; failed?: boolean } | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [doi, setDoi] = useState("");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setFile(null); setTitle(""); setAuthors(""); setYear(""); setJournal(""); setDoi(""); setChecked(false); setError(null);
  }, [open]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile({ name: f.name, busy: true });
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    try {
      setFile({ name: f.name, busy: false, uploaded: await uploadLibraryPdf(f) });
    } catch {
      setFile({ name: f.name, busy: false, failed: true });
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const y = Number(year);
    const csl: CslItem = {
      type: "article-journal",
      title: title.trim(),
      ...(authors.trim() ? { author: parseAuthors(authors) } : {}),
      ...(Number.isInteger(y) && y > 1000 ? { issued: { "date-parts": [[y]] } } : {}),
      ...(journal.trim() ? { "container-title": journal.trim() } : {}),
      ...(doi.trim() ? { DOI: doi.trim() } : {}),
    };
    try {
      const item = await addLibraryItem({ csl, metadataOrigin: "manual", ...(file?.uploaded ? { pdfSha256: file.uploaded.sha256 } : {}) });
      toast.success(L("dialog.added"));
      onAdded(item);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof LibraryApiError && e.status === 409 ? L("dialog.duplicate") : L("dialog.failed"));
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, props: Record<string, unknown> = {}) => (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="text-muted-foreground">{label}</span>
      <Input id={id} value={value} onChange={(e) => set(e.target.value)} {...props} />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("dialog.title")}</DialogTitle>
          <DialogDescription>{L("dialog.body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span className="min-w-0 truncate text-muted-foreground">
              {file?.busy ? L("dialog.pdfUploading")
                : file?.failed ? L("dialog.pdfFailed")
                : file?.uploaded ? L("dialog.pdfChosen", { name: file.name })
                : L("dialog.pdf")}
            </span>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUpIcon data-icon="inline-start" />{L("dialog.pdfPick.button")}</Button>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </div>
          {field("lib-title", L("dialog.titleLabel"), title, setTitle, { required: true })}
          {field("lib-authors", L("dialog.authorsLabel"), authors, setAuthors)}
          <div className="grid grid-cols-[100px_1fr] gap-3">
            {field("lib-year", L("dialog.yearLabel"), year, setYear, { inputMode: "numeric" })}
            {field("lib-journal", L("dialog.journalLabel"), journal, setJournal)}
          </div>
          {field("lib-doi", L("dialog.doiLabel"), doi, setDoi)}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {L("dialog.check")}
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L("dialog.cancel.button")}</Button>
          <Button onClick={() => void save()} disabled={!title.trim() || !checked || saving || file?.busy}>{saving ? L("dialog.saving") : L("dialog.save.button")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
