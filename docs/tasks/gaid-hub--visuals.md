---
format: 1
status: active
updated: 2026-10-16T05:24:30Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
