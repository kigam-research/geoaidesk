---
format: 1
status: waiting
updated: 2026-10-24T06:59:15Z
writer: {"host":"seongin3","reserved":"ffa3f128b777be79f7322ce01266e6ae766dabade12df1d8e2037ffc2afa638f"}
branch: task/gaid-authoring-tokens
target: main
parent: 
---
# gaid-authoring-tokens

## Goal and done criteria
Request from the starter:

# Goal: gaid-authoring-tokens — measure Workflow-authoring token use against a CLI baseline, reduce it if it is materially higher

## User request (verbatim, 2026-10-24, full message)

> 이전작업중 notebooklm 과 비교하고 개선한 작업이 있을것이다. 해당 내용은 모두 개선되었나? 그리고 워크플로우 생성을 위해 에이전트 토큰이 많이 소요되는것이 맞나? 보통 cli에 논문을 주고 이해하고 작업하는 토큰이랑 비슷한수준이면 많은 소비량이 아닐수 있다. 이점은 점검할 필요가 있다. 그리고 서재에서 워크플로우로 논문이나 자료를 읽히는 과정과 관련하여 더 체계적으로 개선가능하다. 현재 기본 BYOk 워크플로우들에는 논문 검색 부터 이해하고 정리하고 인용정리하는 워크플로우가 다수 있다. 내서재에서 해당 기능들을 사용하여 미리 자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한 자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다. 다음으로 GAID 워크스페이스에서 워크플로우 입력을 받을 때 자료가 없으면 에이전트가 자료를 검색해서 유사한 토이샘플을 구하거나 합성예제 또는 별도지시를 선택하여 워크플로우 시작시 에이전트가 질문할수 있게 해야한다. 마지막으로 검토용앱에는 최종 예시들만 두고 중간 테스트 프로젝트나 논문, 연구노트들은 제거해두자.

User decision on this split (2026-10-24, hub question): start this unit now.
This unit owns only: "워크플로우 생성을 위해 에이전트 토큰이 많이 소요되는것이 맞나? 보통 cli에 논문을 주고 이해하고 작업하는 토큰이랑 비슷한수준이면 많은 소비량이 아닐수 있다. 이점은 점검할 필요가 있다."
Other parts of the message are separate units (gaid-library-prep, gaid-input-fallback) or hub ops (review-app cleanup).

## Verified facts (hub, from ledgers `.kady/runs/gaid-hub-authoring/costs.jsonl`)

- One Workflow draft from one paper (gaid-stages-authoring work dir, GPT-6.1 Sol, 2026-10-23 21:52–22:17): two drafts of 4 and 3 calls;
  per draft ≈ 250K–290K prompt + 66K–86K completion tokens, list ≈ $1.4 (subscription, ledgered $0).
- Across all authoring ledgers found on PC74 (104 calls, incl. copies): ~25.6K cached of ~3.9M prompt tokens — almost no prompt caching;
  median completion ≈ 15K, often ~20K per call (suspect: the whole draft is rewritten every call — unverified).
- The "90만~200만 tokens per question" in reports/2026-10-24-gaid-notebooklm-review is the 서재 question path, not authoring.

## Done criteria

1. Measured comparison on the same paper and the same target (one gaid-workflow/v1 Workflow draft with questions answered the same way):
   GAID authoring vs Claude Code CLI and Codex CLI given the paper and asked to understand it and write the Workflow/skill.
   Report prompt, cached, completion tokens and list price per run, with the per-call breakdown for GAID (which step costs what).
   Same model family where possible; state any difference. Keep runs small (one paper, one run each is acceptable; say so).
2. A plain verdict for the user: is GAID authoring materially more expensive than the CLI baseline, and why.
3. If it is materially higher: implement the reductions that the breakdown supports (e.g. prompt caching / stable prefix, not resending
   the full source every call, returning changes instead of the whole draft), re-measure, and show before/after. If not: no app change.
4. scripts/check passes for any code change; report under reports/ (Korean, result first).

Optional (not required): the 서재 question token path (NotebookLM review proposal 5).

Constraints: do not touch the review app or the hub server. Model logins: use whatever works on PC74 (see PROJECT.md / past sessions);
if a CLI or login is unavailable, report that instead of substituting another measurement.
Outside check: the CLI runs are the baseline (part of the done criteria).

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
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
