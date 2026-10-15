import {
  canCreatePreviewDraft,
  type AuthoringPreviewState,
  type PreviewEvent,
  type PreviewMethodDraft,
  type PreviewSource,
} from "../contracts/authoring-preview";

export const PREVIEW_STORAGE_KEY = "gaid:authoring-preview:v1";
export const SAMPLE_REFERENCE = "yilgarn-author-r3-20261015";

export function initialPreviewState(purpose = ""): AuthoringPreviewState {
  return {
    version: 1, step: "sources", source: null, purpose, exampleAnalysis: false,
    choice: null, deferred: false, code: null, previousResults: null, draft: null,
    savedAt: null, dialog: null, trialData: null, comparisonNote: "",
    trialRequestPreview: false,
  };
}

function invalidateDraft(state: AuthoringPreviewState): AuthoringPreviewState {
  return { ...state, draft: null, savedAt: null, dialog: null, trialRequestPreview: false,
    trialData: null, comparisonNote: "", step: state.exampleAnalysis ? "method" : "sources" };
}

/** A new source never inherits the previous document's findings or decisions. */
export function replacePreviewSource(state: AuthoringPreviewState, source: PreviewSource | null): AuthoringPreviewState {
  return { ...initialPreviewState(state.purpose), source };
}

export function revealPreparedAnalysis(state: AuthoringPreviewState): AuthoringPreviewState {
  if (state.source?.kind !== "sample" || state.source.reference !== SAMPLE_REFERENCE) return state;
  return { ...state, exampleAnalysis: true, step: "method", savedAt: null };
}

export function previewTransition(
  state: AuthoringPreviewState,
  event: PreviewEvent,
  draftDefaults: PreviewMethodDraft,
): AuthoringPreviewState {
  switch (event.type) {
    case "step":
      if (event.step === "method" && !state.exampleAnalysis) return state;
      if (event.step === "trial" && !state.draft) return state;
      return { ...state, step: event.step, dialog: null };
    case "purpose":
      return event.value === state.purpose ? state : { ...invalidateDraft(state), purpose: event.value };
    case "choice":
      if (!state.exampleAnalysis) return state;
      return event.value === state.choice ? { ...state, deferred: false }
        : { ...invalidateDraft(state), choice: event.value, deferred: false };
    case "attach": {
      if (!event.file.name.trim() || !Number.isFinite(event.file.size) || event.file.size < 0) return state;
      if (event.role === "trial") return state.draft
        ? { ...state, trialData: event.file, trialRequestPreview: false, savedAt: null } : state;
      return { ...invalidateDraft(state), [event.role === "code" ? "code" : "previousResults"]: event.file };
    }
    case "remove-attachment":
      if (event.role === "trial") return { ...state, trialData: null, trialRequestPreview: false, savedAt: null };
      return { ...invalidateDraft(state), [event.role === "code" ? "code" : "previousResults"]: null };
    case "defer":
      return { ...invalidateDraft(state), choice: null, deferred: true };
    case "create-draft":
      return canCreatePreviewDraft(state) && !state.deferred
        ? { ...state, draft: state.draft ?? { ...draftDefaults }, step: "trial", savedAt: null, dialog: null } : state;
    case "edit-draft":
      return state.draft ? { ...state, draft: { ...state.draft, [event.field]: event.value }, savedAt: null,
        trialRequestPreview: false } : state;
    case "dialog":
      if (event.value && !state.draft) return state;
      return { ...state, dialog: event.value };
    case "comparison":
      return { ...state, comparisonNote: event.value, trialRequestPreview: false, savedAt: null };
    case "preview-trial-request":
      return state.draft && state.choice !== "procedure" && state.trialData && state.comparisonNote.trim()
        ? { ...state, trialRequestPreview: true } : state;
    case "reset": return initialPreviewState();
    // Saving is a browser effect. Its timestamp is set only after storage succeeds.
    case "save": return state;
  }
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const validString = (x: unknown, max = 12000): x is string => typeof x === "string" && x.length <= max;
const attachment = (x: unknown): x is AuthoringPreviewState["code"] => x === null || (isObject(x)
  && validString(x.name, 512) && !!x.name.trim() && typeof x.size === "number" && Number.isFinite(x.size) && x.size >= 0);

/** Recover metadata/choices, never runtime blob URLs or unobserved analysis for another source. */
export function restorePreviewState(raw: string): AuthoringPreviewState | null {
  try {
    const x: unknown = JSON.parse(raw);
    if (!isObject(x) || x.version !== 1 || !validString(x.purpose) || !validString(x.comparisonNote)
      || !["sources", "method", "trial"].includes(String(x.step))
      || ![null, "attach-code", "draft-code", "procedure"].includes(x.choice as null | string)
      || !attachment(x.code) || !attachment(x.previousResults) || !attachment(x.trialData)
      || typeof x.exampleAnalysis !== "boolean" || typeof x.deferred !== "boolean"
      || !(x.savedAt === null || (validString(x.savedAt, 64) && Number.isFinite(Date.parse(x.savedAt))))
      || !(x.draft === null || (isObject(x.draft) && validString(x.draft.title, 1000) && validString(x.draft.summary)))) return null;
    let source: PreviewSource | null = null;
    if (x.source !== null) {
      if (!isObject(x.source) || !validString(x.source.name, 512)
        || !["sample", "local-pdf", "url"].includes(String(x.source.kind))
        || !(x.source.reference === undefined || validString(x.source.reference, 4096))) return null;
      source = { kind: x.source.kind as PreviewSource["kind"], name: x.source.name,
        ...(x.source.reference ? { reference: x.source.reference as string } : {}) };
      if (source.kind === "sample" && source.reference !== SAMPLE_REFERENCE) return null;
      if (source.kind === "url" && (!source.reference || !["http:", "https:"].includes(new URL(source.reference).protocol))) return null;
    }
    const state: AuthoringPreviewState = {
      ...initialPreviewState(x.purpose), source, step: x.step as AuthoringPreviewState["step"],
      choice: x.choice as AuthoringPreviewState["choice"], exampleAnalysis: x.exampleAnalysis,
      deferred: x.deferred, code: x.code, previousResults: x.previousResults, trialData: x.trialData,
      comparisonNote: x.comparisonNote, draft: x.draft as AuthoringPreviewState["draft"],
      savedAt: x.savedAt as string | null,
    };
    if (source?.kind !== "sample") {
      // A local file must be reselected; an arbitrary URL has no prepared findings.
      return { ...initialPreviewState(state.purpose), source, savedAt: state.savedAt };
    }
    if (!state.exampleAnalysis || state.deferred || !canCreatePreviewDraft(state)) {
      state.draft = null;
      if (state.step === "trial") state.step = state.exampleAnalysis ? "method" : "sources";
    }
    if (!state.exampleAnalysis) state.step = "sources";
    return state;
  } catch { return null; }
}

export function savePreviewState(
  storage: Pick<Storage, "setItem">,
  state: AuthoringPreviewState,
  now = new Date().toISOString(),
): AuthoringPreviewState {
  const saved = { ...state, savedAt: now, dialog: null, trialRequestPreview: false };
  storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(saved));
  return { ...state, savedAt: now };
}
