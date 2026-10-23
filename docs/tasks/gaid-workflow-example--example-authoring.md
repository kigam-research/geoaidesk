---
format: 1
status: done
updated: 2026-10-23T07:03:52Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"4c42e845-8f67-4730-bef3-80cdb81d7110","pid":1792787,"provider":"claude","session":"392284d0-7499-4d4c-b0f7-b1c1ce8069a8","start":"62352008","token":"2d56f19424431982ccd2351139ffe3d05c5dae7ca27d3386789c86c852889df2"}
branch: task/gaid-workflow-example--example-authoring
target: task/gaid-workflow-example
parent: gaid-workflow-example
---
# gaid-workflow-example--example-authoring

## Goal and done criteria
Request from the starter:

# Child unit example-authoring (parent gaid-workflow-example, geoaidesk)

## Goal
Hub authoring can attach default example data to a Workflow draft's input roles, and the method package carries it.
Part of the parent goal: "a Workflow can carry default example data per input (bundled small file, or public URL + sha256
for larger data, downloaded on first use with bounds and hash check) ... Hub authoring can attach examples to inputs;
... existing Workflows without examples behave as before." User context (verbatim excerpt): "이용자들은 본인의 데이터를 올리거나
현재 테스트에서 사용되는 공개 데이터를 기반으로 워크플로우를 테스트 할 수 있게 하여야 한다." Accepted rule: small examples
(~10 MB or less) bundled in the package; larger ones as public URL + sha256 (package limit 20 MiB compressed).

## Settled interface (parent commit 51252bc, read these first)
- `web/src/geo/contracts/workflow-examples.ts`: `WorkflowInputExample`, `WorkflowExampleFile`, `EXAMPLE_LIMITS`,
  `exampleProblems(value, roleId)`, `exampleUrlAllowed`. Bundled file path in the package is exactly
  `examples/<roleId>/<name>`; a remote file has `url` (https) + sha256 + size.
- `web/src/geo/contracts/authoring.ts`: `LocalWorkflow.inputRoles[].example?: DraftInputExample`; draft files are
  `DraftExampleFile` = package entry + `from` (`{sourceId, sourcePath}` = a data-source file of sibling unit C stored at
  `sources/<sourceId>/files/<sourcePath>`, listed with sha256 in `project.extractions[sourceId].files[]`; or `{upload: true}`
  = bytes kept in the authoring store at `examples/<sha256>`).
- The parent writer owns the runtime side (method-file validation, `/geo/methods/examples`, start settings, Workflow 지침,
  CLI export, workflow-view). Do not edit those files; ask the parent if the contract needs a change.
- Sibling unit C (gaid-authoring-sources, separate branch) adds SourceKind "data". Do not depend on its code being merged:
  accept `from.sourceId` for any project source whose extraction lists that file with matching sha256.

## Scope (owned files)
`server/src/geo/authoring/**`, `server/src/geo/hub-shared/edit.ts` (only if needed), `web/src/geo/hub/**` except
`input-prep.tsx`, new keys in locale namespace `hub`, and tests next to them. Add any new API shape to
`web/src/geo/contracts/authoring.ts` (additive only).

## What to build
1. Server routes (e.g. `/geo/authoring/projects/:id/...`): attach an example to a draft input role from (a) an uploaded
   file set (bounded: EXAMPLE_LIMITS; store at `examples/<sha256>`), (b) a data-source file of the project, (c) a public URL:
   the server fetches it once with bounds (https only, size cap EXAMPLE_LIMITS.remoteFile, timeout, no credentials) to record
   sha256 and size; bytes are not kept. Also edit title/source/license/synthetic, and remove an example. Each change creates
   a new researcher draft revision (like `editDraft`, baseRevision check). The researcher must give title and source;
   suggest them from the source document when one is chosen.
2. The coauthor model never writes examples: strip any model-supplied `example`, and carry the researcher's examples from
   the previous draft onto a new model draft by input role id (record a note when a role disappears).
3. Package builder (`package.ts`): put bundled bytes at `examples/<roleId>/<name>` (verify sha256/size against the stored
   bytes), drop `from` from the manifest, extend the vendored Workflow schema in GAID (like `skills`/`steps`) so
   `inputRoles[].example` validates, add checks: `exampleProblems`, bundled total ≤ EXAMPLE_LIMITS.bundledTotal, a clear
   Korean `plain` message per new code. Workflows without examples produce byte-identical packages as before.
4. Registering/editing on the shared hub keeps bundled examples (the package carries them; when an edit draft is seeded
   from a package, restore `examples/` bytes into the store so the next package still has them).
5. Draft screen UI (`web/src/geo/hub/`): per Workflow input role, an "예제 자료" area: shows the attached example (title,
   source, licence, 합성 자료 label, size, bundled or downloaded on first use) and actions to add from upload / from a data
   source / from a public URL, edit text, remove. Follow docs/design/ui-guide.md (sections 1, 2, 10 + components you
   touch), geo/copy/gaid-writing.md and terminology.csv; strings in locale catalogues only (ko first, en same meaning).
   Researcher terms: "예제 자료" (example data), "Workflow", "판".
6. Tests: server unit tests for attach/carry-over/package (bundled + URL with a loopback http server), a web test for the
   UI area. Keep compute small.

## Allowed actions and evidence
Work only in your worktree; commit with `task save`; run `cd server && npx tsc --noEmit && npx vitest run <your tests>`,
`cd web && npx tsc --noEmit && npx vitest run <your tests>`, `node geo/copy/validate-copy.mjs web/src/geo/locales`,
`node geo/ui/check-ui.mjs`. Full `scripts/check` is run by the parent after integration. Report in your task document:
routes added, files changed, test results, one Korean screenshot of the draft example area at 1440x900 (light theme is
enough; note it), and any contract change you need. Then `task finish`.
Network: the KIGAM network blocks raw.githubusercontent.com; use `gh api` or codeload.github.com if needed.

## Current state
Done (all items 1-6 of "What to build"); not yet integrated by the parent.

Routes added (`server/src/geo/authoring/routes.ts`, logic in new `server/src/geo/authoring/examples.ts`):
- `POST /geo/authoring/projects/:id/examples` `AttachExampleBody` → `MethodDraft` (201, new researcher revision; 409 stale
  `baseRevision`, 404 unknown role, 413 over EXAMPLE_LIMITS). `from.kind`: `upload` (base64 files, each ≤ 10 MiB, bytes at
  `examples/<sha256>`), `source` (`sourceId` + `paths[]`; any project source whose extraction lists the file; bytes are
  re-hashed against the listed sha256), `url` (https, http only on loopback; fetched once, streamed hash, ≤ 512 MiB,
  10 min timeout, manual redirects (≤ 5, each target re-checked), no credentials; bytes not kept). Title and source are
  required; bundled total of the Workflow ≤ 15 MiB; key/secret-like names refused.
- `POST /geo/authoring/projects/:id/examples/:roleId` `EditExampleBody` → `MethodDraft` (title/source/licence/synthetic).
- `POST /geo/authoring/projects/:id/examples/:roleId/remove` `{ baseRevision }` → `MethodDraft`.
- `editDraft` now shares `researcherRevision()` (same behaviour).

Contract additions (additive, `web/src/geo/contracts/authoring.ts`): `AttachExampleFrom`, `ExampleText`,
`AttachExampleBody`, `EditExampleBody`, `suggestExampleText()` (IO-free title/source suggestion from the chosen source
document or URL; the form fills only empty fields). No change to `workflow-examples.ts`.

Model drafts (`agent.ts`): model inputRoles were already rebuilt from whitelisted fields; `carryExamples()` additionally
drops any model `example` and moves the previous draft's examples by role id, with a note when a role disappeared. The
revise request no longer shows examples to the model.

Package (`package.ts`): bundled bytes at `examples/<roleId>/<name>` (sha256/size verified against stored bytes), manifest
Workflow without `from` (`packagedWorkflow`; the same object when no example, so packages without examples are
byte-identical, tested), vendored schema extended with `inputRoles[].example`, example files excluded from text checks
(portability, personal paths, Python imports). New check codes with Korean `plain`: `example-invalid` (exampleProblems),
`example-total` (bundled > 15 MiB), `example-file` (bytes missing/changed; blocks before the generic file error).

Hub editing (`hub-shared/edit.ts`): a seeded edit/copy draft copies the original's `examples/` folder when the original
draft is on this server; any bundled file still unreadable is restored from the registered package
(`<slug>/examples/<roleId>/<name>`, hash-checked) into `examples/<sha256>` with `from: { upload: true }`.

UI: new `web/src/geo/hub/example-data.tsx` ("예제 자료" section in `DraftStep`, after the flow, before limits; wired in
`hub-screen.tsx` with a project reload), client methods in `hub/api.ts`, strings in `hub.example.*` (ko/en). Per input:
title, 합성 자료 badge, "Workflow에 포함" / "처음 쓸 때 내려받음" badge, 출처, size and file count, 이용 조건; actions 설명
고치기, 다른 자료로 바꾸기, 예제 자료 빼기 (inline confirmation "예제 자료 뺀 판 만들기"), 예제 자료 넣기 (inline form: 내 PC 파일 /
초안 자료에서 / 공개 주소, 제목, 출처, 이용 조건, 합성 자료 checkbox). UI guide rules followed: B1/B3 (one filled submit in
the open form, object+action labels, removal confirmed), F5 (server message next to the form), G1/G2 (≤ 3 badges),
I2 (signal tint only on the selected source segment), V9 (one separator per line), R1 (no hashes/paths shown).

Evidence (2026-10-23, this worktree):
- `cd server && npx tsc --noEmit` clean; `npx vitest run test/geo-authoring-examples.test.ts test/geo-authoring.test.ts
  test/geo-authoring-package.test.ts test/geo-authoring-extra.test.ts test/geo-hub-shared.test.ts` → 5 files, 71 tests passed
  (new file: 7 tests: upload bundle + manifest, byte-identical without examples, data-source attach + changed-bytes
  finding, URL via loopback server with redirect/404/size cap, edit/oversize/unknown role/key name, model carry-over +
  note, hub edit restore from package).
- `cd web && npx tsc --noEmit` clean; `npx vitest run src/geo/hub/` → 7 files, 32 tests passed (new
  `example-data.test.tsx`: add from a draft source with suggestion; show/remove with confirmation).
- `node geo/copy/validate-copy.mjs web/src/geo/locales` 0 errors (no warning on `hub.example.*`);
  `node geo/ui/check-ui.mjs` 0 errors, 0 new debt.
- Screenshot (Korean, light theme, 계측 style only, 1440×900; isolated backend 18100/web 3100 with a seeded store under
  `~/data/geoaidesk/work/gaid-workflow-example--example-authoring/shot/`):
  `reports/2026-10-23-gaid-workflow-example/figures/example-authoring-draft.png` (sha256 8f7b59ec…, three inputs: bundled
  synthetic, URL, none) and `.../example-authoring-form.png` (sha256 45dbc278…, add form, 공개 주소). Dark theme, 도폭
  style and 1280×800 not captured.

## Next steps
<!-- task:closed -->
Closed 2026-10-23T07:03:52Z: integrated into gaid-workflow-example; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- For the parent (runtime side, not edited here): manifests now carry `inputRoles[].example` exactly as
  `WorkflowInputExample` (bundled files with `path`, remote files with `url`), and bundled files are package entries listed
  in `files[]`. `method-file.ts` must accept `example` on input roles for install; the registration test passes today.
- `GET /drafts/:rev/files` returns bundled example bytes as base64 too (up to 15 MiB in that response); accepted.
- URL examples: the server fetches any https host (the contract's `exampleUrlAllowed`), without the private-address
  block used by URL sources, matching what the runtime will download at first use.

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
