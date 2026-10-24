---
format: 1
status: active
updated: 2026-10-24T07:08:23Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8326432c-0a38-43d0-92f0-76db7e868732","pid":1778976,"provider":"claude","session":"21c916ad-8c56-4943-818b-6f9dae6aa973","start":"71313221","token":"dd814f54f4df4db1c88c4132afa7ed1942ef6ba2f237a42360f61d5b48b0e522"}
branch: task/gaid-input-fallback
target: main
parent: 
---
# gaid-input-fallback

## Goal and done criteria
Request from the starter:

# Goal: gaid-input-fallback — when a Workflow input has no data, let the researcher choose agent search for a similar toy sample, a synthetic example or a separate instruction, and have the agent ask at Workflow start

## User request (verbatim, 2026-10-24, full message)

> 이전작업중 notebooklm 과 비교하고 개선한 작업이 있을것이다. 해당 내용은 모두 개선되었나? 그리고 워크플로우 생성을 위해 에이전트 토큰이 많이 소요되는것이 맞나? 보통 cli에 논문을 주고 이해하고 작업하는 토큰이랑 비슷한수준이면 많은 소비량이 아닐수 있다. 이점은 점검할 필요가 있다. 그리고 서재에서 워크플로우로 논문이나 자료를 읽히는 과정과 관련하여 더 체계적으로 개선가능하다. 현재 기본 BYOk 워크플로우들에는 논문 검색 부터 이해하고 정리하고 인용정리하는 워크플로우가 다수 있다. 내서재에서 해당 기능들을 사용하여 미리 자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한 자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다. 다음으로 GAID 워크스페이스에서 워크플로우 입력을 받을 때 자료가 없으면 에이전트가 자료를 검색해서 유사한 토이샘플을 구하거나 합성예제 또는 별도지시를 선택하여 워크플로우 시작시 에이전트가 질문할수 있게 해야한다. 마지막으로 검토용앱에는 최종 예시들만 두고 중간 테스트 프로젝트나 논문, 연구노트들은 제거해두자.

User decision on this split (2026-10-24, hub question): start this unit now.
This unit owns only: "GAID 워크스페이스에서 워크플로우 입력을 받을 때 자료가 없으면 에이전트가 자료를 검색해서 유사한 토이샘플을 구하거나 합성예제 또는 별도지시를 선택하여 워크플로우 시작시 에이전트가 질문할수 있게 해야한다."

## Context (verified in AGENTS.md)

- The start window (`web/src/geo/workspace/start-window.tsx`, stages per "Workflow stages", example data per "Workflow example data")
  already offers per input: the researcher's own files, an upload, and the Workflow's bundled/remote example when it has one.
- The start message is the Workflow 지침 (`renderWorkflowDocument`, `<workflow>` block, `settings.examples`, `data="example"`).
- The lead agent has the `interview` tool for clarifying questions and web tools (pi-web-access).

## Done criteria

1. For an input with no own data (and no or unwanted example), the start settings offer three choices: (가) the AI agent searches public
   sources for a similar toy sample, (나) a synthetic example, (다) a separate instruction (free text). Choosing one is shown in the summary
   and recorded in the 지침 (the `<workflow>` block marks which inputs use which choice; older Workflows and starts without the choice are
   unchanged).
2. At Workflow start the agent asks before acting on these inputs (interview): for 가) it proposes found candidates with source/licence/size
   and asks which to use (no silent download of large or restricted data); for 나) it confirms what the synthetic data must represent and
   says results are from synthetic data; for 다) it follows the instruction and asks only if ambiguous. Downloaded/generated files go into
   the project as recorded data (provenance) and are labelled as toy/synthetic in the research note.
3. Copy follows geo/copy rules (Korean first, ko/en catalogue); UI follows docs/design/ui-guide.md with the report listing rule ids and
   Korean screenshots per the guide; scripts/check passes (UI quality kit blocking).
4. One real-app check with one installed Workflow: start with an input left empty, choose each option once, show the agent's question.
5. Report under reports/ (Korean, result first).

Coordinate: gaid-ia-connect-workspace (and children) is reshaping the Workspace home and 서재 panels; avoid its files, and rebase on its
integration if it lands first. Do not touch the review app or the hub server. Outside check: none.

## Current state
Plan (2026-10-24, writer): small, tightly coupled change; done by this writer, no child units.
- Contract: `WorkflowDocSettings.fallbacks` (`InputFallback {kind: search|synthetic|instruction, note?}`) in
  `web/src/geo/contracts/workflow-doc.ts`; rendered as a "자료가 없는 입력" section with per-kind agent rules (interview first,
  candidates with source/licence/size, no download without choice, >100 MB/unclear licence refused, files in
  `toy_data/<role>/` or `synthetic_data/<role>/` with SOURCE.md/README.md, toy/synthetic labelled in answer, files and note).
  Block attribute `fallback="<role>=<kind>;…"` (optional; older blocks parse unchanged). Agent-written files are recorded by
  the existing provenance recorder (write/bash scan); `user_data/` is guard-protected, hence the new top-level folders.
- UI: `InputAnswer` mode `fallback` in `setup-steps.tsx` (three option cards under "내 자료가 없을 때", open when no fitting
  file and no example, folded otherwise); summary rows + summary notice in `task-setup.tsx`; card badge in `workflow-card.tsx`.
- Files owned: workflow-doc.ts, render.ts, setup-steps.tsx, task-setup.tsx, workflow-card.tsx, locales workspace/workflowDoc,
  tests. Avoids gaid-ia-connect-workspace files (its copy-rename child edits other keys of the same locale files).
## Next steps
1. Implement contract + renderer + UI, tests, scripts/check, real-app check, report.
## Failed approaches
## Notes and decisions
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
