# Approved clickable authoring prototype

User approved the connected three-image flow on 2026-10-15: “진행하자.” This authorizes the clickable prototype proposed in the preceding message, not the full institutional authoring backend or paid model evaluation.

## Scope and honest state

- Add an isolated Next route `/authoring-preview` using current GAID/shadcn/React/PDF.js. Preserve approved white/slate/blue and document-to-method-to-trial topology; semantic responsive controls replace generated text/paper pixels.
- Real interactions: load the supplied sample manuscript or a local PDF; page navigation/zoom; source-linked sample page jumps; contextual choice/defer; supporting-file selection; editable method text; browser-local save/reset; trial-preparation/request preview; sharing/file-content preview dialogs.
- Analysis is a clearly labeled, prepared example ONLY for the selected sample manuscript. Selecting a different local PDF or URL clears sample findings, decisions and drafts. No generic upload silently receives PU findings. URL acquisition and model analysis remain unconnected.
- No provider calls, skill installation, server project writes, scientific computation or publication. Draft/trial/export screens explicitly describe preview state, never completed analysis or verified results.
- Root ProjectProvider and ApiTokenGate are skipped only for the preview route via a narrow client runtime boundary. Other routes retain existing behavior.
- Reuse existing PdfViewer with an additive raw source URL and page-request seam; hide annotation API access for preview. Default workspace behavior remains unchanged. A fixed sample endpoint serves one registered external PDF when enabled; no arbitrary path/URL parameter and no source PDF in Git.
- Browser-local saved preview retains metadata and decisions. A local PDF object URL is never persisted as a valid source across reload; require file reselection and do not restore stale sample findings. This is not the proposed server-durable authoring database.

## Shared interface and ownership

Shared types: `web/src/geo/contracts/authoring-preview.ts` (parent only). Runtime source URLs are separate from persisted state. Child components receive controlled props and emit `PreviewEvent`; parent owns transitions, persistence, fixture gating and dialogs' state.

| Package | Owned files | Deliverables |
|---|---|---|
| Parent integration | shared contract; `web/src/geo/authoring-preview/{app,state,fixtures,runtime-boundary}.*`; Next route/sample adapters; asset input config; locale index; `authoringPreview` locales; docs/report/registry/boundaries | shell, source/state ownership, fixture-only flow, local save/reset, dedicated serving/checks, integration |
| Source child | `web/src/geo/authoring-preview/source-pane.tsx`, `source-input.tsx`, related tests; `web/src/components/pdf-viewer/pdf-viewer.tsx` additive seams; `previewSource` locales | real PDF URL/File viewing, navigation, source actions, no sandbox/project requests in preview |
| Method child | `web/src/geo/authoring-preview/method-pane.tsx`, `trial-pane.tsx`, `preview-dialogs.tsx`, related tests; `previewMethod` locales | source-linked findings, consequential question branches/defer, editable draft, file/trial/sharing dialogs |

Exports: `PreviewSourcePane`, `PreviewSourceInput`, `PreviewMethodPane`, `PreviewTrialPane`, `PreviewDialogs`. Source components use their typed props; method/trial/dialog components use `PreviewMethodProps`. Parent registers locale namespaces after integration. Children do not edit shared types, locale index, root layout, report or integration boundaries.

Integration order: freeze shared contract → child source/method views in isolated task worktrees while parent builds state/shell/route → `task complete` each child → integrate locale registrations and app → focused tests + browser interaction/visual checks → declared `scripts/check` → report and finish. No production-review instance changes; rollout is hub-owned.

## Design authority

Approved images: `reports/2026-10-15-gaid-researcher-ecosystem/figures/source-first-{01-intake,02-coauthor,03-draft-trial}.png`.

Keep document and method juxtaposition, restrained navigation, large readable Korean text and a clear next action. Source PDF is a live document renderer, not a generated plate. Use current glossary (`workflow`, `spatial block`) and prototype-accurate labels in both Korean/English catalogs. Images' scientific wording corrections are part of the authority; do not reintroduce guaranteed independence or training-success claims.

## Checks

- State tests: arbitrary PDF/URL cannot unlock sample findings; missing-code branch cannot create draft; defer does not answer; source/choice change invalidates affected draft; trial preview never marks executed; saved metadata restores without persisting blob URLs.
- Source checks: real sample PDF renders and page requests navigate; view-only raw URL produces no annotation/sandbox calls; legacy source behavior stays intact.
- Browser: initial/sample/method/trial states, code/procedure branches, source replacement, save/reload/reset, dialogs and keyboard interactions, desktop and narrow viewport. No real model/backend mutation traffic.
- Required repository `scripts/check` after integration. No scientific performance/reproduction claim from these checks.
