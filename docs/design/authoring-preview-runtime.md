# Source-first authoring preview runtime

This is the implementation companion to `authoring-preview-implementation.md`, not the durable authoring backend described in `source-authoring-agents.md`.

## Entry and deployment

`/authoring-preview` is a frontend-only route. It does not mount the project provider or credential gate, so merely opening it cannot select/create a GAID project or start an agent. Existing workspace routes retain both providers.

The real author-manuscript PDF is an external named input `authoring_preview_paper` in `configs/inputs.toml`. A host that has this asset may opt in with `GAID_AUTHORING_PREVIEW_SAMPLE=1`. The fixed `/authoring-preview/sample` GET/HEAD handler reads that record, checks the PDF header, 50 MiB bound and SHA-256, and serves matching bytes without caching. It accepts no path or remote URL. The PDF is not bundled in Git or release assets. Without the opt-in/input, the sample button reports unavailable; local PDF viewing still works. The source is the author's R3 manuscript, not a verified publisher PDF.

No change to the existing `~/deploy/geoaidesk` service is authorized for this writer. Hub rollout should retain all current user data/provider configuration, build the integrated revision, and enable the optional sample only on the institution review host with the registered asset. The prototype route itself needs no backend change.

## Real interactions and boundaries

- Local PDF: extension/MIME/nonempty/50 MiB validation, object URL, PDF.js viewer. Source replacement/unmount revokes the object URL. Raw URL mode never calls annotation APIs, including if the optional UI flag is omitted. Existing sandbox viewing remains unchanged by default.
- URL: records http/https metadata only. No download, parsing or model call is made.
- Prepared analysis: explicit action after the registered sample PDF is ready; not automatically attached to another uploaded paper. Page links point to author manuscript page 9 and page 20; page 20 contains both Figures 6 and 7.
- Method: researcher purpose, attach-code/draft-code/procedure choices, defer, support-file metadata, editable draft. Choosing existing code requires a file. Deferring does not choose an answer. Source/purpose/choice/support changes invalidate dependent draft/trial state. Revisiting an unchanged method preserves draft edits.
- Trial: collects metadata and comparison criteria; displays a request summary only. Procedure-only drafts cannot request execution. No trial job or package is created.
- Files/sharing: illustrative contents and sharing boundaries, no export, installation, registry mutation or publication.
- Save/reset: explicit browser-local storage under `gaid:authoring-preview:v1`, metadata/answers only. Storage failures do not mark saved or erase the current state. Reset removes only that key. Saved sample draft metadata restores even when the external sample PDF is unavailable. Local PDF bytes/object URLs are never persisted; local sources need reselection.

## Integration ownership

Parent owns state/effects/shell/isolation/route/sample/input registry and `authoringPreview` copy. Source child owns source controls and additive PdfViewer seam; method child owns controlled method/trial/dialog views. Typed props and events are in `web/src/geo/contracts/authoring-preview.ts`. All researcher-facing copy is catalogued in Korean and English. No existing skill is imported as a generation input.

## Checks

Focused tests cover source identity and invalidation, deferred/missing-code choices, draft preservation, browser save failure/recovery, stale sample fetch versus newer file selection, PDF byte integrity/opt-in and runtime provider isolation. Child evidence covers PDF/view-only behavior and controlled method/trial interactions. Integration browser checks and the repository `scripts/check` are recorded in the task and canonical report after execution; these checks do not establish scientific validity or model authoring quality.
