/** Clickable prototype only. No agent, installation or scientific execution state. */
export type PreviewStep = "sources" | "method" | "trial";
export type ImplementationChoice = "attach-code" | "draft-code" | "procedure";

export interface PreviewSource {
  kind: "sample" | "local-pdf" | "url";
  name: string;
  reference?: string;
}

export interface PreviewAttachment {
  name: string;
  size: number;
}

export interface PreviewMethodDraft {
  title: string;
  summary: string;
}

export interface AuthoringPreviewState {
  version: 1;
  step: PreviewStep;
  source: PreviewSource | null;
  purpose: string;
  exampleAnalysis: boolean;
  choice: ImplementationChoice | null;
  deferred: boolean;
  code: PreviewAttachment | null;
  previousResults: PreviewAttachment | null;
  draft: PreviewMethodDraft | null;
  savedAt: string | null;
  dialog: "files" | "trial" | "sharing" | null;
  trialData: PreviewAttachment | null;
  comparisonNote: string;
  trialRequestPreview: boolean;
}

export type PreviewEvent =
  | { type: "step"; step: PreviewStep }
  | { type: "purpose"; value: string }
  | { type: "choice"; value: ImplementationChoice }
  | { type: "attach"; role: "code" | "results" | "trial"; file: PreviewAttachment }
  | { type: "remove-attachment"; role: "code" | "results" | "trial" }
  | { type: "defer" }
  | { type: "create-draft" }
  | { type: "edit-draft"; field: keyof PreviewMethodDraft; value: string }
  | { type: "dialog"; value: AuthoringPreviewState["dialog"] }
  | { type: "comparison"; value: string }
  | { type: "preview-trial-request" }
  | { type: "save" }
  | { type: "reset" };

export interface PdfPageRequest {
  page: number;
  sequence: number;
}

/** View props shared by the independent method/trial component package. */
export interface PreviewMethodProps {
  state: AuthoringPreviewState;
  onEvent: (event: PreviewEvent) => void;
  onSourcePage: (page: number) => void;
}

/** Source display is real PDF rendering; analysis remains an explicit prepared example. */
export interface PreviewSourcePaneProps {
  source: PreviewSource | null;
  sourceUrl: string | null;
  pageRequest: PdfPageRequest;
  onPdfReady?: (pages: number) => void;
  className?: string;
}

export interface PreviewSourceInputProps {
  source: PreviewSource | null;
  onSample: () => void;
  onPdfFile: (file: File) => void;
  onUrl: (url: string) => void;
  onClear: () => void;
}

export function canCreatePreviewDraft(state: AuthoringPreviewState): boolean {
  return state.source?.kind === "sample" && state.exampleAnalysis && state.choice !== null
    && (state.choice !== "attach-code" || state.code !== null);
}
