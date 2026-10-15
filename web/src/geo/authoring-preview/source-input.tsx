"use client";

import { useId, useRef, useState } from "react";
import { FileText, Link2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PreviewSourceInputProps } from "@/geo/contracts/authoring-preview";
import { geoText } from "@/geo/i18n";

const text = geoText("previewSource");
export const MAX_PREVIEW_PDF_BYTES = 50 * 1024 * 1024;

export function PreviewSourceInput({ source, onSample, onPdfFile, onUrl, onClear }: PreviewSourceInputProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"url" | "file" | null>(null);

  function selectFile(file?: File) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || (file.type !== "application/pdf" && file.type !== "")) {
      setError(text("input.pdfTypeError"));
      setErrorField("file");
      return;
    }
    if (file.size === 0 || file.size > MAX_PREVIEW_PDF_BYTES) {
      setError(text("input.pdfSizeError"));
      setErrorField("file");
      return;
    }
    setError(null);
    setErrorField(null);
    onPdfFile(file);
  }

  return (
    <section aria-label={text("input.label")} className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <form className="flex min-w-0 flex-1 basis-80 gap-2" noValidate onSubmit={(event) => {
          event.preventDefault();
          try {
            const parsed = new URL(url.trim());
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
            setError(null);
            setErrorField(null);
            onUrl(parsed.href);
            setUrl("");
          } catch {
            setError(text("input.urlError"));
            setErrorField("url");
          }
        }}>
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${id}-url`} className="sr-only">{text("input.urlLabel")}</label>
            <Link2 aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-500" />
            <Input id={`${id}-url`} type="url" value={url} placeholder={text("input.urlPlaceholder")}
              className="bg-white pl-9" aria-invalid={errorField === "url"}
              aria-describedby={`${id}-hint${errorField === "url" ? ` ${id}-error` : ""}`}
              onChange={(event) => { setUrl(event.target.value); if (errorField === "url") { setError(null); setErrorField(null); } }} />
          </div>
          <Button type="submit" className="bg-[#1f5eff] text-white hover:bg-[#174bd1]">{text("input.addUrl")}</Button>
        </form>
        <input ref={fileInput} id={`${id}-file`} type="file" accept=".pdf,application/pdf" className="sr-only"
          tabIndex={-1} aria-label={text("input.fileLabel")}
          onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
        <Button type="button" variant="outline" className="bg-white" onClick={() => fileInput.current?.click()}
          aria-describedby={`${id}-hint${errorField === "file" ? ` ${id}-error` : ""}`}>
          <Upload aria-hidden="true" />{text("input.selectPdf")}
        </Button>
        <Button type="button" variant="outline" className="bg-white text-[#1f5eff]" onClick={() => {
          setError(null); setErrorField(null); onSample();
        }}><FileText aria-hidden="true" />{text("input.sample")}</Button>
      </div>
      <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">{text("input.hint")}</p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
      {source && (
        <div className="inline-flex max-w-full items-center gap-2 rounded-t-lg border border-b-0 border-blue-200 bg-blue-50 px-3 py-2 text-sm text-slate-900">
          {source.kind === "url" ? <Link2 aria-hidden="true" className="size-4 shrink-0 text-[#1f5eff]" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-[#1f5eff]" />}
          <span className="truncate" title={source.reference ?? source.name}>{source.name}</span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={text("input.clear", { name: source.name })}
            onClick={() => { setError(null); setErrorField(null); onClear(); }}><X aria-hidden="true" /></Button>
        </div>
      )}
    </section>
  );
}
