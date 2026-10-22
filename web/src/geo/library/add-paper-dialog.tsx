"use client";

/**
 * 논문 넣기 (ADR decision 2): one paper from a PDF, DOI or URL with looked-up reference details the researcher picks
 * and checks; or a bibliography file (BibTeX, RIS, CSL-JSON) previewed before anything is stored.
 */
import { useEffect, useRef, useState } from "react";
import { FileUpIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { CslItem, ImportPreview, LibraryItem, LookupResponse, MetadataCandidate, UpdateSignal } from "@/geo/contracts/library";
import { addLibraryItem, confirmImport, LibraryApiError, lookupReference, previewImport, uploadLibraryPdf } from "./api";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);

/** "Kim, Hong A, Lee" -> CSL names (family first, as the label asks). */
export function parseAuthors(text: string): CslItem["author"] {
  return text.split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean).map((name) => {
    const [family, ...given] = name.split(/\s+/);
    return given.length ? { family, given: given.join(" ") } : { family };
  });
}

const retracted = (signals: UpdateSignal[]) => signals.some((s) => s.kind === "retraction" && !s.relation.startsWith("update-to"));
const corrected = (signals: UpdateSignal[]) => signals.some((s) => s.kind === "correction");
/** Service names as written by the services themselves (shown in both locales). */
const ORIGIN_NAME: Record<string, string> = { crossref: "Crossref", openalex: "OpenAlex", kci: "KCI", zotero: "Zotero" };
const formatOf = (name: string) => (/\.ris$/i.test(name) ? "ris" : /\.json$/i.test(name) ? "csl-json" : "bibtex");

export function AddPaperDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (item?: LibraryItem) => void }) {
  const [tab, setTab] = useState<"paper" | "file">("paper");
  const fileRef = useRef<HTMLInputElement>(null);
  const bibRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; sha256?: string; busy: boolean; failed?: boolean } | null>(null);
  const [lookupText, setLookupText] = useState("");
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [chosen, setChosen] = useState<MetadataCandidate | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [doi, setDoi] = useState("");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  useEffect(() => {
    if (open) return;
    setTab("paper"); setFile(null); setLookupText(""); setLookup(null); setChosen(null);
    setTitle(""); setAuthors(""); setYear(""); setJournal(""); setDoi(""); setChecked(false); setError(null); setPreview(null);
  }, [open]);

  const runLookup = async (body: Parameters<typeof lookupReference>[0]) => {
    setLookingUp(true);
    try {
      const found = await lookupReference(body);
      setLookup(found);
      if (found.titleGuess && !title) setTitle(found.titleGuess);
    } catch {
      setLookup({ candidates: [], notes: ["provider-error"] });
    } finally {
      setLookingUp(false);
    }
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile({ name: f.name, busy: true });
    try {
      const uploaded = await uploadLibraryPdf(f);
      setFile({ name: f.name, busy: false, sha256: uploaded.sha256 });
      await runLookup({ pdfSha256: uploaded.sha256 });
    } catch {
      setFile({ name: f.name, busy: false, failed: true });
    }
  };

  const use = (c: MetadataCandidate) => {
    setChosen(c);
    setTitle(c.csl.title);
    setAuthors((c.csl.author ?? []).map((a) => [a.family ?? a.literal, a.given].filter(Boolean).join(" ")).join(", "));
    const y = c.csl.issued?.["date-parts"]?.[0]?.[0];
    setYear(y ? String(y) : "");
    setJournal(typeof c.csl["container-title"] === "string" ? c.csl["container-title"] : "");
    setDoi(typeof c.csl.DOI === "string" ? c.csl.DOI : "");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const y = Number(year);
    const typed: CslItem = {
      ...(chosen?.csl ?? { type: "article-journal" }),
      title: title.trim(),
      ...(authors.trim() ? { author: parseAuthors(authors) } : {}),
      ...(Number.isInteger(y) && y > 1000 ? { issued: { "date-parts": [[y]] } } : {}),
      ...(journal.trim() ? { "container-title": journal.trim() } : {}),
      ...(doi.trim() ? { DOI: doi.trim() } : {}),
    };
    try {
      const item = await addLibraryItem({ csl: typed, metadataOrigin: chosen?.metadataOrigin ?? "manual", ...(file?.sha256 ? { pdfSha256: file.sha256 } : {}), ...(chosen?.signals.length ? { signals: chosen.signals } : {}) });
      toast.success(L("dialog.added"));
      onAdded(item);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof LibraryApiError && e.status === 409 ? L("dialog.duplicate") : L("dialog.failed"));
    } finally {
      setSaving(false);
    }
  };

  const readBib = async (f: File | undefined) => {
    if (!f) return;
    try { setPreview(await previewImport(await f.text(), formatOf(f.name))); }
    catch { setPreview(null); setError(L("dialog.importFailed")); }
  };
  const saveImport = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const r = await confirmImport(preview.items);
      toast.success(L("dialog.importDone", { added: r.added, duplicates: r.duplicates }));
      onAdded();
      onOpenChange(false);
    } catch {
      setError(L("dialog.importFailed"));
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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{L("dialog.title")}</DialogTitle>
          <DialogDescription>{L("dialog.body")}</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="flex gap-1 border-b">
          {(["paper", "file"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", tab === id ? "border-primary font-medium" : "border-transparent text-muted-foreground")}>{L(`dialog.tabs.${id}`)}</button>
          ))}
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {tab === "paper" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {file?.busy ? L("dialog.pdfUploading") : file?.failed ? L("dialog.pdfFailed") : file?.sha256 ? L("dialog.pdfChosen", { name: file.name }) : L("dialog.pdf")}
              </span>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUpIcon data-icon="inline-start" />{L("dialog.pdfPick.button")}</Button>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">{field("lib-lookup", L("dialog.lookupLabel"), lookupText, setLookupText)}</div>
              <Button variant="outline" disabled={!lookupText.trim() || lookingUp} onClick={() => void runLookup(/^https?:/i.test(lookupText.trim()) ? { url: lookupText.trim() } : { doi: lookupText.trim() })}>
                <SearchIcon data-icon="inline-start" />{L("dialog.find.button")}
              </Button>
            </div>
            {lookingUp && <p className="text-sm text-muted-foreground">{L("dialog.lookupBusy")}</p>}
            {lookup && (
              <div className="flex flex-col gap-2">
                {lookup.notes.map((n) => <p key={n} className="text-sm text-muted-foreground">{L(`dialog.notes.${n}`)}</p>)}
                {lookup.candidates.length > 0 && <p className="text-xs text-muted-foreground">{L("dialog.candidates")}</p>}
                {lookup.candidates.map((c, i) => (
                  <div key={i} className={cn("flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm", chosen === c && "border-primary/50 bg-primary/5")}>
                    <div className="min-w-0">
                      <div className="font-medium">{c.csl.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {[(c.csl.author ?? []).slice(0, 3).map((a) => a.family ?? a.literal).join(", "), c.csl.issued?.["date-parts"]?.[0]?.[0], c.csl["container-title"] as string | undefined, L("dialog.origin", { origin: ORIGIN_NAME[c.metadataOrigin] ?? c.metadataOrigin })].filter(Boolean).join(" · ")}
                      </div>
                      {retracted(c.signals) && <p className="mt-1 text-xs text-destructive">{L("dialog.retracted")}</p>}
                      {!retracted(c.signals) && corrected(c.signals) && <p className="mt-1 text-xs text-gaid-warning">{L("dialog.corrected")}</p>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => use(c)}>{L("dialog.pick.action")}</Button>
                  </div>
                ))}
              </div>
            )}
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
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">{preview ? L("dialog.importPreview", { n: preview.items.length }) : L("dialog.importLabel")}</span>
              <Button variant="outline" size="sm" onClick={() => bibRef.current?.click()}><FileUpIcon data-icon="inline-start" />{L("dialog.importPick.button")}</Button>
              <input ref={bibRef} type="file" accept=".bib,.ris,.json,text/plain,application/json" className="hidden" onChange={(e) => void readBib(e.target.files?.[0])} />
            </div>
            {preview && preview.errors.length > 0 && <p className="text-sm text-gaid-warning">{L("dialog.importErrors", { n: preview.errors.length })}</p>}
            {preview && preview.items.slice(0, 5).map((c, i) => <p key={i} className="truncate text-sm">{c.title}</p>)}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L("dialog.cancel.button")}</Button>
          {tab === "paper" ? (
            <Button onClick={() => void save()} disabled={!title.trim() || !checked || saving || file?.busy}>{saving ? L("dialog.saving") : L("dialog.save.button")}</Button>
          ) : (
            <Button onClick={() => void saveImport()} disabled={!preview?.items.length || saving}>{L("dialog.importSave.button", { n: preview?.items.length ?? 0 })}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
