---
format: 1
status: waiting
updated: 2026-10-23T06:06:13Z
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
