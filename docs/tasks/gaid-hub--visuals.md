---
format: 1
status: active
updated: 2026-10-16T06:31:07Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"3a6c6bdd-8e42-4c22-bc50-f3253b4bbc42","pid":2866986,"provider":"codex","session":"01a1432a-e540-7610-91df-bc7f924d9de8","start":"1618610","token":"af79afaa600e2e3514663724af3dca4cfb94e58c4f31a7f39a23719a1acbc8d7"}
branch: task/gaid-hub--visuals
target: task/gaid-hub
parent: gaid-hub
---
# gaid-hub--visuals

## Goal and done criteria
Request from the starter:

# Child brief: `gaid-hub--visuals` — concept images for drafts and web URL sources

Parent: `gaid-hub` (geoaidesk). First `task resume gaid-hub--visuals`, read AGENTS.md and the PARENT task document
`docs/tasks/gaid-hub.md` (Goal, "User feedback 2" — no cropped PDF parts, only relevant images; "User decisions after
mockup round 4"). Codex runs at Normal speed. Work only in your printed worktree.

## Goal
Two server features of the approved GAID hub mockups:
A. Concept images: for a draft, generate one concept illustration per key procedure step (and one cover) with GAID's
   configured image model (Settings → Defaults `imageModel`, the same models/billing as the `generate_image` tool,
   `server/src/agent/image-tool.ts`). The user chose to use an image-generation model (paid per call). Never crop or
   embed PDF page images.
B. Web URL sources: a researcher adds a paper/article URL, a blog or a web search result page; the server (inside the
   institute network) fetches it and stores text the coauthor can read and anchor like other sources.

## Fixed interface (parent-owned)
`web/src/geo/contracts/authoring.ts`: `AuthoringProject.visuals?: Record<nodeId, {file, caption, model, draftRevision}>`
(key "cover" for the cover). Add, additively and tell the parent: `AddUrlSourceBody { url, kind: "paper"|"blog"|"search" }`
and `SourceKind` value `"web"` with `SourceDocument.url?`. Routes (new file `server/src/geo/routes/authoring-extra.ts`,
registered with one line in `server/src/geo/routes.ts`; reuse the authoring store instance — export a getter from
`server/src/geo/authoring/routes.ts` if needed, coordinating with the parent):
- `POST /geo/authoring/projects/:id/drafts/:rev/visuals` `{ opId, steps?: string[] }` → 202, background generation of the
  cover + up to 6 step images (prompt built from the step label/summary and the method title, style: flat scientific
  illustration, white background, slate with one blue #1f5eff accent, no text or at most 2-3 short English labels, no
  logos/faces; describe that the image is a concept illustration, not data). Idempotent per opId; budget/cap checks and
  ledger like the authoring model calls (`server/src/geo/authoring/model.ts`), session id `gaid-hub-visuals`; 400 with a
  Korean message when no image model is configured.
- `GET /geo/authoring/projects/:id/visuals/:key` → the PNG/WebP bytes.
- `POST /geo/authoring/projects/:id/sources/url` `AddUrlSourceBody` → `{ source, extraction }`: http(s) only, no
  credentials in URL, follow ≤5 redirects, 30 s timeout, 30 MiB cap; content-type PDF → existing PDF extraction (page
  text, figures); HTML → readable text (strip scripts/styles/nav; keep headings/paragraphs; record title) stored as one or
  more text pages; record final URL, fetch time, status, content hash. A failure is recorded as a failed source with a
  Korean reason, never a crash. Respect `HTTP(S)_PROXY` (GAID already installs a global dispatcher). Do not fetch
  file://, loopback or link-local addresses unless the URL host is explicitly allowed by `GAID_URL_SOURCE_ALLOW` (tests).

## Tests and checks
`server/test/geo-authoring-extra.test.ts`: URL fetch with a local test HTTP server (allowed via env) for HTML and PDF,
redirect limit, size cap, refused schemes/addresses; visuals with an injected fake image generator (no paid calls):
records, idempotency, no-model error. `cd server && npm run typecheck && npx vitest run test/geo-authoring*.test.ts`.
Prettier style as the authoring code. No real image-model or provider calls in tests or manually.

## Boundaries
- Do not edit `web/src/geo/hub/**`, locales or `web/src/app/**` (parent wires the screens).
- Do not change `agent.ts`/`prompts.ts` behaviour except making `sourceContext` read the new web source pages if needed
  (tell the parent). Do not touch the user's review instance or the parent's dev instance (3330/18330).
- raw.githubusercontent.com is blocked. Record what you built and the evidence in your task document; `task finish`.

## Current state
- Implemented URL source intake and background concept illustrations; ready for parent integration.
- URL intake persists original bytes, final URL, fetch time/status and SHA-256; HTML headings/paragraphs become
  32,000-character text pages and use existing sourceContext/anchor verification without changing agent.ts.
  PDF URLs reuse pdftotext page and figure-caption extraction. No page crops or PDF images enter prompts.
- URL policy: http(s), no credentials, five redirects, shared 30-second fetch/DNS/body deadline, 30 MiB declared
  and streamed byte limits. Loopback/link-local IPv4, IPv6 and mapped addresses are refused at every redirect;
  GAID_URL_SOURCE_ALLOW allows exact test hosts. Global fetch retains the app's configured proxy dispatcher.
  Network/extraction failures persist as failed/partial sources with Korean reasons.
- Visuals use only Settings Defaults imageModel, existing priceability/auth/billing, default project's cap checked
  before every image, ledger session gaid-hub-visuals. Response usage is recorded before image validation,
  including a paid response without an image. No model configured returns Korean 400 before scheduling.
- Durable visualOperations expose running/complete/failed/interrupted status, selected/completed keys and error.
  Concurrent retries of one opId do not make another call; a project allows one active image batch. Restart
  marks running batches interrupted and never silently retries paid work. Partial images remain available.
- New routes share the exact parent-approved getAuthoringStore(app) WeakMap getter and mount after authoring.
- Verified: server npm run typecheck; npx --no-install vitest run test/geo-authoring*.test.ts: 3 files,
  39 tests passed (20 new tests); git diff --check. Local HTTP server/fake image transport only. No paid calls,
  user review/dev instances, UI files, locales, agent.ts or prompts.ts changed. No computed outputs in Git.
- First task finish automatically ran full scripts/check: backend 166 files / 1,844 passed, 11 skipped; frontend
  155 files / 1,056 passed, three failures (stale project heading and load-related CSV/LaTeX timeouts). Parent
  explicitly directed the identical one-line heading expectation fix and a serial finish retry, with no timeout
  test edits. Second full check passed backend 1,844 again and fixed heading/CSV/LaTeX tests; frontend then
  failed file-preview-panel a.txt timeout and subsequent a.tex Editor loading. Installed Vitest supports
  VITEST_MAX_WORKERS (dist/chunks/coverage.Da5gzbsu.js), parent corrected the retry to 1 worker: values above 1 override backend serial execution and can race
  on shared temporary roots;
  no timeout tests/config edits. Focused file-preview-panel rerun: all 5 tests passed in 6.09 s.
  Third full check with one worker passed backend 1,844 and all frontend 1,059; distribution then failed
  because the allowed boundary-owner registry had not yet registered the new gaid-hub owner. Add only
  gaid-hub to that closed registry (geo/tests/distribution.test.mjs); keep all ownership assertions intact.
  Integration/production verification remains subject to full check success.

## Next steps
1. Verify the new boundary-owner registration with node --test geo/tests/distribution.test.mjs, then rerun
   VITEST_MAX_WORKERS=1 task finish docs/tasks/gaid-hub--visuals.md geo/tests/distribution.test.mjs.
2. If the parent target moved after shared integration, follow the task CLI's printed integration step.

## Failed approaches
- Third finish resolved frontend load failures (all 1,059 passed); the distribution boundary test then found
  a missing gaid-hub owner in its closed registry. Register the actual new owner, not a different package
  owner; retain all existing seam/path assertions. Log: check-mtwo6bnb.log.
- Second finish failed on unrelated file-preview-panel async loading/timeouts under the default high worker
  count. Reduce concurrency via VITEST_MAX_WORKERS=1, not source workarounds. Log: check-qgoabi3f.log
  under the same external check-logs directory. Backend 1,844 pass; frontend 1,057 pass, two failures.
- First finish failed on the pre-existing Choose a project expectation (approved UI says My research) and two
  frontend 5-second timeouts under concurrent child full checks. Parent authorized exactly the expectation
  replacement; no timeout edits. Full log: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-pl71ptzi.log.
- Initial task resume found the shared task transaction busy; the retry resumed this printed worktree unchanged.
- Two shell calls used server-prefixed paths or root npx from the wrong cwd. No source file was written by the
  former; root npx refused without installing. Reissued from the correct directories. No recurring tool block.

## Notes and decisions
Parent steering after shared finished: run the full check serially with VITEST_MAX_WORKERS=1 (environment
only). Do not edit tests/config to work around host-load timeouts. Parent may integrate shared while this
finish runs; follow the task CLI if its target moves.

Parent steering (2026-10-16): keys are procedure node id, cover and output:<outputId>. Eligible result-form ports
are map-raster, map-vector and figure; table/report outputs remain UI examples. Cover + at most six step/output
images total. Default selection reserves slots for eligible outputs (first six), then fills remaining slots with
steps. Explicit steps exceeding the combined cap return 400. The returned operation.keys states the selection.

Sequential decisions: additive contract and shared store getter → URL source implementation → image adapter/operation
→ route tests and integration. All implementation was tightly coupled and owned by this writer; no child writers.
Parent informed of contract/store changes via Paseo (notifyOnFinish false); used the exact requested shared getter.

Integration surface:
- web/src/geo/contracts/authoring.ts: additive SourceKind web, SourceDocument.url/fetch, AddUrlSourceBody,
  GenerateVisualsBody, VisualOperation and AuthoringProject.visualOperations. Visual record format unchanged.
- SourceDocument.url is the last successfully fetched URL; fetch.requestedUrl preserves the initial URL,
  credentials stripped even on refusal. fetch.finalUrl/status identify the last HTTP response; contentHash is
  present only when complete bytes were received. A URL PDF has kind pdf with url/fetch metadata.
- POST sources/url returns { source, extraction } (200, including a recorded fetch failure); malformed request
  bodies return 400. HTML pages are synthetic text segments, not physical PDF pages.
- POST drafts/:rev/visuals returns VisualOperation (202); poll GET authoring project.visualOperations[opId].
  GET visuals/:key serves PNG/WebP bytes; browser URL builders must use encodeURIComponent(key) and withApiToken.
- For retry after failure/interruption, use a new opId. The old id is permanently idempotent.
- htmlparser2 9.1.0 is now a direct pinned server dependency (already present transitively, lock adds one entry).
- No frontend catalogue strings were edited; Korean backend error/caption strings follow existing authoring routes.

## Open items
None for this child unit.

## Report
Child evidence is in this task document. Parent incorporates the result into its one canonical GAID hub report.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
