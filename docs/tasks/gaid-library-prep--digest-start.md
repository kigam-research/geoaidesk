---
format: 1
status: active
updated: 2026-10-24T13:17:12Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"b38c7b0e-5839-4ccb-b913-3c52ce2378aa","pid":621868,"provider":"codex","session":"01a16dff-2bab-7821-86c4-9f2515e1131d","start":"73474056","token":"2c5f071640de697d06a68e008336f902e2b38b2cba5df24bcb51f606c2c2325e"}
branch: task/gaid-library-prep--digest-start
target: task/gaid-library-prep
parent: gaid-library-prep
---
# gaid-library-prep--digest-start

## Goal and done criteria
Request from the starter:

# Goal: gaid-library-prep--digest-start — a Workflow start reads a 문헌 정리 first; the AI agent reads digests with a library tool

Parent unit gaid-library-prep (geoaidesk). User request (verbatim, 2026-10-24, part owned by the parent): "내서재에서 해당 기능들을 사용하여 미리 자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한 자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다."
User decision 2026-10-24 on the design report (verbatim): "모두 권장으로 하자." — the Workflow start window offers "먼저 읽을 정리"; a GAID-made digest covering every source paper is recommended and pre-selected; an 외부 정리 (Gemini import) can be chosen but is marked "참고로만 읽음" and never pre-selected; "정리 없이 시작" keeps today's behaviour. Citations always point to the original papers' pages, never to the digest.

Read first in your worktree: AGENTS.md; reports/2026-10-24-gaid-library-prep/index.md (3.2, 3.4 and figures 5–6 = figures/04-start-intro.png, 05-start-summary.png, the approved mockups); docs/tasks/gaid-library-prep.md "Phase 2 plan"; settled interfaces: web/src/geo/contracts/library.ts (LibraryDigestRef, DigestCandidate, digestKey, isDigestItem), server/src/geo/library/digests.ts, route GET /geo/library/digests/for-start, web client getDigestCandidates in web/src/geo/library/api.ts. Mockup source: web/src/geo/dev/library-prep/screens.tsx (StartIntroDigest, StartSummaryDigest; INSTRUCTIONS_SAMPLE in fixtures.ts is only a sketch of the start-message section).

Build:
1. Agent tool `library_digest` in `server/src/geo/library/tools.ts` (registered with the other library tools): parameters { key: "digest:<itemId>" or the item id; section?: a level-2 heading; offset?: character offset }. Returns at most 24 KiB: a header (title, 출처 GAID에서 만듦 or 외부 정리 (Gemini Notebook, reference only), 검토 전/확인함, covered papers as citation keys with titles, sources not in 서재, a note when papers were added to its folder since) and the text window (whole text, one section, or from offset; say where the next window starts). Only digests that cover at least one paper in the project's citation scope are readable (others → a clear refusal naming why). Tool guidance: read the digest before the analysis; verify every claim used in results with library_read on the original paper and cite [@key, p. N]; never cite the digest; treat 외부 정리 as reference only. Extend the existing note citation hook (makeNoteCitationExtension) to flag a `[@digest:…]` citation in a research note with a fix message.
2. Start window: new `web/src/geo/workspace/digest-choice.tsx` (hook `useDigestCandidates(projectId, method|null)` + `DigestChoice` radio rows built from the existing OptionCard in setup-steps.tsx: recommended GAID digest pre-selected only when `recommended`; others not pre-selected; 외부 정리 badge + "참고로만 읽음"; status chip 검토 전/확인함; "정리 없이 시작" option; nothing rendered when there are no candidates). Mount it as an IntroFacts row "먼저 읽을 정리" in GeoIntro (start-intro.tsx, below 근거 논문) and show the chosen digest on the summary step (one row with the one-line note and a 수정 link back to Workflow 소개) — minimal hunks in start-intro.tsx and task-setup.tsx/setup-steps.tsx. The choice is part of the start settings state (kept while the window is open); it is not written to saved start settings (.geo-start.json) — say so in your task document. Also offer it in the 일반 Workflow start (upstream-start.tsx) only if it fits with a small hunk; otherwise record why not.
3. Start message: add the section to the rendered 지침 in `web/src/geo/contracts/workflow-doc.ts` (IO-free; wording in locale namespace `workflowDoc`): after 근거 논문, "## 먼저 읽을 문헌 정리" with a `<library-digest key="digest:<id>" status="…" origin="gaid|external" covers="key1 key2 …">title</library-digest>` line and the rule sentence (read it first with library_digest; verify with library_read and cite the original paper pages; do not cite the digest; an external summary is reference only). Thread the choice through `workflowStartMessage` (web/src/geo/workflow/render.ts) and task-setup.tsx. Older start messages without the section stay as they are.
4. Strings for the start window in namespace `digestStart` (already registered, empty); model-facing wording in `workflowDoc`. Korean first; copy rules in AGENTS.md.
5. Tests: server test for library_digest (scope, section/offset windows, 24 KiB cap, external header, refusal) and the citation flag; web tests for DigestChoice (pre-selection rules, none option), the summary row, and workflow-doc rendering of the section (chat/preview/cli modes unaffected otherwise).

Owned files: tools.ts hunks, digest-choice.tsx (new), minimal hunks in start-intro.tsx, task-setup.tsx, setup-steps.tsx, upstream-start.tsx (optional), web/src/geo/workflow/render.ts, web/src/geo/contracts/workflow-doc.ts, locale namespaces digestStart and workflowDoc, their tests. Do not edit 서재 screens, library-picker.tsx or digests.ts (parent-owned); if you need a server change there, ask the parent via your task document's Notes and keep going with a stub.
Rules: follow AGENTS.md (UI guide v2 sections 1, 2, 10 and Q1–Q7, G2, F6, R1 before UI work; copy rules). Network: the KIGAM network blocks raw.githubusercontent.com; use NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt for npm. Server tests: unset VITEST_MAX_WORKERS or use 1. Python only via uv. Do not touch the review app (ports 3000/18000) or any hub server.
Evidence: cd server && npm run typecheck && npx vitest run <your tests> test/geo-library-digests.test.ts; cd web && npx tsc --noEmit && npx vitest run <your tests> src/geo/contracts src/geo/workspace; node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs. Korean screenshots of Workflow 소개 with the digest row and the summary step at 1440×900 (instrument/light and mapsheet/dark) into ~/data/geoaidesk/work/gaid-library-prep--digest-start/ (dev harness with intercepted API replies or the running app; do not commit harness pages). Record changes, rule ids, string ids (ko/en) and check results in your task document, then task finish. The parent runs full scripts/check after integration.

## Current state
Resumed in the printed worktree. Read the approved design, UI guide, copy rules and settled interfaces. Implementation
is complete. Focused server tests: 27 passed (5 files). Focused web tests: 98 passed (12 files). Server and web
typechecks passed. Copy validator: 0 errors, 101 pre-existing warnings; UI check: 0 errors. Codegraph has no index for
this exact worktree, so native source reads are used. A screenshot job using the actual TaskSetup components is next.
## Next steps
1. Run the prepared screenshot job (isolated snapshot, temporary uncommitted harness, port 3267), inspect images.
2. Re-run checks after final small fixes, review the diff, record evidence and finish for parent integration.
## Failed approaches
- First screenshot job failed only in the external harness: instrument style deliberately has no data-style attribute;
  the screenshot wait expected data-style=instrument. Corrected the condition to treat a missing attribute as instrument.
- The immediate second job launch was rejected before starting because task job had added its first receipt to the task
  document (and a new malformed-response test was unsaved). Save first; this launch produced no receipt/job to resume.
## Notes and decisions
- Sequential decisions: tool scope/window contract first, shared start-message settings next, then UI wiring and tests.
  Owned files are the starter's exact file list. This child has no independent substantial work package to delegate.
- The digest choice is in-memory state only; it is not persisted into `.geo-start.json` saved start settings.
- Requested the parent add optional `DigestCandidate.papers` (citation keys/titles of covered papers) for the approved
  `covers` start-message attribute. Parent supplied it at 49c8d53b; merged origin/task/gaid-library-prep.
- General Workflow support fits a small hunk: pass projectId from task-catalogue, use the same hook and renderer. Older
  GAID workflows without a WorkflowDoc also append the reading section to their existing draft.
- UI rules followed: P2/P3/P5/P9, Q1-Q7, G2, F6, R1, I2/I6, A1. No free-text Other is needed for a closed list of existing
  digests; “정리 없이 시작” is the alternative. More than two digest candidates sit behind a disclosure.
- New locale ids (absent before; ko/en): digestStart.label/recommended/external/gaid/status.pending/status.confirmed/
  coverage/referenceOnly/newPapers/none/noneHint/summaryState/citationNote/externalNote/failed/retry/more;
  workflowDoc.section.digest/digest.rule/digest.externalRule. Existing string meanings are unchanged.
- Dependencies were absent in this new worktree; installed with npm ci --prefer-offline in server and web. First tsc
  attempts failed before installation, then both passed. A targeted lint run exposed an existing missing allUntested
  dependency in touched task-catalogue.tsx; added the dependency, with no change to the computed value.
- One web regression test initially failed because its broad mock returned a non-digest response for the new API; the
  hook now treats a malformed response as a failed refresh instead of crashing the start window. All 98 tests then passed.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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
- /home/seongin3/data/geoaidesk/runs/gaid-library-prep--digest-start-20261024T131352.567639Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-library-prep--digest-start-20261024T131652.142131Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
