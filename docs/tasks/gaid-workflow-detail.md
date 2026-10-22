---
format: 1
status: done
updated: 2026-10-22T05:01:48Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"f0f8b936-04ba-445e-8692-977c00c3f2ca","pid":3727117,"provider":"claude","session":"0108f72c-c60f-4f11-aa8e-848e1936429e","start":"53182089","token":"50a39945d0d6bb4b5db11aca3fce31f50cb45aede646d1658cbd771f06add8e2"}
branch: task/gaid-workflow-detail
target: main
parent: 
---
# gaid-workflow-detail

## Goal and done criteria
Request from the starter:

# Request: gaid-workflow-detail

User decision (verbatim, 2026-10-22): "우선 첫표 두항목은 권장안대로 하자." — answers gaid-system-ui#1 with option 가).
Item: the Workflow (method) detail dialog shows the trial record's tool-call counts, hub check IDs and English messages as they are
(UI guide R1, R3, P3). Option 가): turn it into a researcher-facing summary plus a "기록 보기" (view record) that holds the raw trial
record, consistent with how the hub shows the same information (hub Workflow detail, workflow-view.tsx).
Done: implemented per docs/design/ui-guide.md v2 (copy rules in geo/copy/: Korean first, no agent internals in researcher views),
2 styles × 2 themes at 1440×900 and 1280×800, check-ui and scripts/check pass; brief report.
Coordination: gaid-workflow-strip (Workflow suggestion strip above files) and gaid-research-visuals are active; avoid their files.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-detail/; do not modify ~/.geoaidesk. Outside check: no outside check.

## Current state
- Plan: small, tightly coupled UI change done by the writer alone (no child units). Owned files:
  `web/src/geo/methods/methods.tsx`, its test, `web/src/geo/locales/methods/{ko,en}.json`, `geo/ui/ui-baseline.json`
  (resolved debt removed). No overlap with gaid-workflow-strip (task-catalogue / workspace strip) or gaid-research-visuals.
- Implemented: method detail dialog shows a researcher summary; raw records behind `기록 보기` (ids `methods.*.record.*`,
  UI guide R4) and raw errors behind `기술 정보` (shared `web/src/geo/hub/technical.tsx`, R2).
  - Hub check receipt → one line (`허브 검사를 통과했습니다 · <date> · 참고 사항 N개`) + one plain sentence per warning code
    (`methods.checks.plain.<code>`, mirrors the hub PLAIN map in `server/src/geo/authoring/package.ts`; unknown codes → generic
    sentence); checker, check ids/status and raw path/message in the record.
  - Trial card → `<date> 시험 · N판` (+ Workflow title when the method has several), researcher assessment or `연구자 평가 전`,
    method-changed warning, each expected result as `label · 필수/선택 · 생김/다른 폴더에 생김/생기지 않음/대조하지 않음`,
    `결과 파일 N개: first 3 외 M개`; record holds Workflow id, times, tool calls/failures, models, degraded steps, chat id,
    package SHA-256, inputs, all outputs and the file matching.
  - Package issues → plain sentence + 기술 정보; list/trials/assessment errors → plain sentence + 기술 정보.
- Verified: `npx tsc --noEmit` (web) clean; `npx vitest run src/geo/methods src/geo/workflow src/geo/workspace` 66 passed;
  `node geo/ui/check-ui.mjs` 0 errors; copy validator no methods warnings.
- Visual review runtime: `~/data/geoaidesk/work/gaid-workflow-detail/bin/run.sh` (systemd unit gaid-workflow-detail-dev,
  UI 127.0.0.1:3395, API 18395), project proj-035916 copied from ~/.geoaidesk (one trial, hub check with one warning).
- Visual review done: 16 screenshots (2 styles × 2 themes × 1440×900/1280×800, top + trials) plus the opened record, in
  `~/data/geoaidesk/work/gaid-workflow-detail/shots/final/` (SHA256SUMS); 4 small copies in the report's figures/. Dev unit
  stopped. Report written (humanizer applied).
## Next steps
<!-- task:closed -->
Closed 2026-10-22T05:01:48Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-system-ui#1
- "채팅 열기" from a trial card and the hub draft trial step's "실패한 도구 호출" line are left as Optional (report §5).
- Plain warning sentences are a ko/en copy of the hub PLAIN map; unknown codes fall back to a generic sentence.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-22-gaid-workflow-detail/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
