"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, FileText, FlaskConical, Layers3, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geoText } from "@/geo/i18n";
import type { AuthoringPreviewState, PreviewEvent, PreviewSource, PreviewStep } from "@/geo/contracts/authoring-preview";
import { PreviewSourceInput, MAX_PREVIEW_PDF_BYTES } from "./source-input";
import { PreviewSourcePane } from "./source-pane";
import { PreviewMethodPane } from "./method-pane";
import { PreviewTrialPane } from "./trial-pane";
import { PreviewDialogs } from "./preview-dialogs";
import { initialPreviewState, PREVIEW_STORAGE_KEY, previewTransition, replacePreviewSource, restorePreviewState, revealPreparedAnalysis, SAMPLE_REFERENCE, savePreviewState } from "./state";
import "./preview.css";

const text = geoText("authoringPreview");
const sampleEndpoint = "/authoring-preview/sample";
const stages: PreviewStep[] = ["sources", "method", "trial"];

export function AuthoringPreview() {
  const [state, setState] = useState(() => initialPreviewState(text("purpose.default")));
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [pageRequest, setPageRequest] = useState({ page: 1, sequence: 0 });
  const [pdfReady, setPdfReady] = useState(false);
  const [documentKey, setDocumentKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const sourceAttempt = useRef(0);
  const blob = useRef<string | null>(null);
  const currentState = useRef(state);
  currentState.current = state;

  const releaseBlob = useCallback(() => {
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = null;
  }, []);
  const changeSource = useCallback((source: PreviewSource | null, url: string | null) => {
    sourceAttempt.current += 1;
    releaseBlob();
    setSourceUrl(url);
    setPdfReady(false);
    setDocumentKey((key) => key + 1);
    setLoading(false);
    setPageRequest((p) => ({ page: 1, sequence: p.sequence + 1 }));
    setState((s) => replacePreviewSource(s, source));
    setNotice("");
  }, [releaseBlob]);

  const loadSample = useCallback(async (restored?: AuthoringPreviewState) => {
    const attempt = ++sourceAttempt.current;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(sampleEndpoint, { method: "HEAD", cache: "no-store" });
      if (attempt !== sourceAttempt.current) return;
      if (!response.ok) throw new Error("sample unavailable");
      releaseBlob();
      setSourceUrl(sampleEndpoint);
      setPdfReady(false);
      setDocumentKey((key) => key + 1);
      setPageRequest((p) => ({ page: restored?.exampleAnalysis ? 9 : 1, sequence: p.sequence + 1 }));
      // Restored metadata is already editable while the PDF loads; do not overwrite those edits.
      if (!restored) setState((s) => replacePreviewSource(s, {
        kind: "sample", name: text("sample.name"), reference: SAMPLE_REFERENCE,
      }));
      if (restored) setNotice(text("saved.restored"));
    } catch {
      if (attempt === sourceAttempt.current) setNotice(text("sample.unavailable"));
    } finally {
      if (attempt === sourceAttempt.current) setLoading(false);
    }
  }, [releaseBlob]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (raw) {
        const restored = restorePreviewState(raw);
        if (!restored) setNotice(text("saved.invalid"));
        else if (restored.source?.kind === "sample") { setState(restored); void loadSample(restored); }
        else { setState(restored); setNotice(text("saved.restored")); }
      }
    } catch { setNotice(text("saved.unavailable")); }
    return () => { sourceAttempt.current += 1; releaseBlob(); };
  }, [loadSample, releaseBlob]);

  function onPdfFile(file: File) {
    if (!/\.pdf$/i.test(file.name) || !["", "application/pdf"].includes(file.type)
      || !file.size || file.size > MAX_PREVIEW_PDF_BYTES) {
      setNotice(text("source.invalidPdf")); return;
    }
    const url = URL.createObjectURL(file);
    changeSource({ kind: "local-pdf", name: file.name }, url);
    blob.current = url;
  }
  function onUrl(value: string) {
    try {
      const url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      changeSource({ kind: "url", name: url.hostname, reference: url.href }, null);
    } catch { setNotice(text("source.invalidUrl")); }
  }
  function onEvent(event: PreviewEvent) {
    setNotice("");
    if (event.type === "save") {
      try { setState(savePreviewState(localStorage, currentState.current)); setNotice(text("saved.success")); }
      catch { setNotice(text("saved.unavailable")); }
    } else if (event.type === "reset") {
      try { localStorage.removeItem(PREVIEW_STORAGE_KEY); }
      catch { setNotice(text("saved.unavailable")); return; }
      changeSource(null, null);
      setState(initialPreviewState(text("purpose.default")));
    } else {
      setState((s) => previewTransition(s, event, { title: text("draft.title"), summary: text("draft.summary") }));
    }
  }
  const onPdfReady = useCallback(() => setPdfReady(true), []);
  function onSourcePage(page: number) {
    setState((s) => ({ ...s, step: s.exampleAnalysis ? "method" : "sources", dialog: null }));
    setPageRequest((p) => ({ page, sequence: p.sequence + 1 }));
  }
  const paneProps = { state, onEvent, onSourcePage };
  const sourcePane = <PreviewSourcePane key={documentKey} source={state.source} sourceUrl={sourceUrl} pageRequest={pageRequest}
    onPdfReady={onPdfReady} className="preview-pdf" />;

  return (
    <div className="gaid-authoring-preview light min-h-dvh bg-[#f8fafc] text-slate-900">
      <aside className="preview-sidebar">
        <div className="flex items-center gap-3 px-5 py-7"><Layers3 aria-hidden="true" className="size-8 text-[#1f5eff]" />
          <span className="text-2xl font-bold tracking-tight">{text("brand")}</span></div>
        <div className="px-5 text-xs font-medium tracking-wide text-slate-500">{text("nav.workspace")}</div>
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-3 font-semibold text-blue-700">
          <BookOpen aria-hidden="true" className="size-5" />{text("nav.method")}</div>
        <div className="mt-auto border-t px-5 py-5 text-sm leading-6 text-slate-500">{text("nav.scope")}</div>
      </aside>
      <main className="preview-main">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3 text-sm">
          <span className="text-slate-500">{text("breadcrumb")}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEvent({ type: "reset" })}><RotateCcw aria-hidden="true" />{text("reset")}</Button>
            <Button size="sm" variant="outline" onClick={() => onEvent({ type: "save" })}><Save aria-hidden="true" />{text("save")}</Button>
          </div>
        </div>
        <div className="preview-content">
          <header className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{text("title")}</h1>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{text("status")}</span></div>
            <p className="max-w-3xl text-base leading-7 text-slate-600">{text("description")}</p>
          </header>
          <nav aria-label={text("steps.label")} className="mb-6 flex flex-wrap gap-2">
            {stages.map((step, index) => <Button key={step} variant="ghost" aria-current={state.step === step ? "step" : undefined}
              disabled={(step === "method" && !state.exampleAnalysis) || (step === "trial" && !state.draft)}
              onClick={() => onEvent({ type: "step", step })} className={`h-11 rounded-lg px-4 text-base ${state.step === step ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}>
              <span className={`flex size-6 items-center justify-center rounded-full text-xs ${state.step === step ? "bg-[#1f5eff] text-white" : "bg-slate-200"}`}>{index + 1}</span>{text(`steps.${step}`)}
            </Button>)}
          </nav>
          {(notice || loading) && <p role="status" className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-slate-700">{loading ? text("sample.loading") : notice}</p>}
          {state.step !== "trial" && <div className="mb-3"><PreviewSourceInput source={state.source} onSample={() => void loadSample()}
            onPdfFile={onPdfFile} onUrl={onUrl} onClear={() => changeSource(null, null)} /></div>}
          {state.step === "sources" && <div className="preview-columns">{sourcePane}
            <section className="h-fit rounded-xl border border-slate-200 bg-white p-6 lg:p-7">
              <FileText aria-hidden="true" className="mb-5 size-8 text-blue-600" />
              <h2 className="text-xl font-semibold">{text("intake.title")}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{text(state.source?.kind === "sample" ? "intake.sample" : "intake.body")}</p>
              <ol className="my-7 space-y-4 text-base">{[1, 2, 3].map((n) => <li key={n} className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-blue-600" />{text(`intake.${n}`)}</li>)}</ol>
              <Button className="h-auto min-h-11 w-full whitespace-normal py-3" disabled={loading || !pdfReady || state.source?.kind !== "sample"}
                onClick={() => { setState((s) => revealPreparedAnalysis(s)); setPageRequest((p) => ({ page: 9, sequence: p.sequence + 1 })); }}>
                {text("intake.openExample")}<ArrowRight aria-hidden="true" /></Button>
              <p className="mt-3 text-sm leading-6 text-slate-500">{text("intake.limit")}</p>
            </section></div>}
          {state.step === "method" && <div className="preview-columns">{sourcePane}<PreviewMethodPane {...paneProps} /></div>}
          {state.step === "trial" && <PreviewTrialPane {...paneProps} />}
          <footer className="mt-8 flex items-start gap-2 border-t pt-4 text-sm leading-6 text-slate-500"><FlaskConical aria-hidden="true" className="mt-1 size-4 shrink-0" />{text("footer")}</footer>
          <PreviewDialogs {...paneProps} />
        </div>
      </main>
    </div>
  );
}
