---
format: 1
status: active
updated: 2026-10-20T09:11:50Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"6f3513ee-8a5d-41ea-ab37-591555203b6d","pid":2413519,"provider":"claude","session":"e110d0e5-34df-4728-8c24-0178bd483529","start":"37297710","token":"11392b68f53c59c140adfdb8a7d3415bc02ca1339dcf6012b83deab1af8c4edc"}
branch: task/gaid-note-decisions
target: main
parent: 
---
# gaid-note-decisions

## Goal and done criteria
Request from the starter:

# Request: gaid-note-decisions

User message (verbatim, 2026-10-20, to the geoaidesk hub):
"GAID 시스템 노트에서 결정한 일이 여러가지 일 경우 답변 하나를 클릭할 때마다 채팅창으로 메시지를 입력하게 하지 않고 전체 답변이 클릭되고 사용자가 답변 보내기라는 별도의 버튼을 클릭하면 한번에 전송될 수 있게 수정되어야 한다. 그리고 답변에서도 별도 지시 옵션이 추가되어 있어야 한다. 그리고 레시피 가져오기에서 GAID 허브가 연동되어 이용자들이 GAID 허브에서 레시피를 가져올 수 있게 연동되어야 한다. skill 추가 시에도 skill_hub는 legacy이며 GAID 허브에서 스킬을 찾을 수 있게 연동되어야 한다. 한편, GAID 허브에서는 등록된 방법을 수정할 수 있는 기능이 없으며, 사용자들이 작성한 방법을 클릭해서 들어갔을 때 이미 선택된 질문들도 수정이 되지 않는다. 또한 각 방법 초안에서 개념 그림도 어떻게 생성되는지 안내도 없으며, 기능도 보이지 않는다. 사용자가 해당 개념이 마음에 들지 않으면 수정하지도 못하는 것으로 보인다. 관련 현황을 확인 후 GAID 허브를 개선하여야 한다."
After the hub proposed two units (gaid-note-decisions, gaid-hub-editing): "진행하자."

Review app (user's view): PC74 ~/deploy/geoaidesk, unit gaid-review, data ~/.geoaidesk (ports 3000/18000). On 2026-10-20 the
task test data was imported there (hub registered methods 5, projects named "검토용 - ..."), so the user's observations refer to it.
Do not modify ~/.geoaidesk; use your own GAID_HOME under ~/data/geoaidesk/work/<slug>/ (copy from it if useful).
Sibling unit started together: gaid-note-decisions (owns web/src/geo/notes/ and server/src/geo/notes/) and gaid-hub-editing
(owns web/src/geo/hub/, server/src/geo/authoring/, server/src/geo/hub-shared/, recipe import in web/src/geo/workspace/, Settings
skills/skill_hub entry). Coordinate through the hub if you need the other's files.

Scope confirmed with the user (research-note decisions, web/src/geo/notes/ note detail and list):
- When a note has several decisions, clicking an option no longer sends/prefills a chat message per click. The researcher
  selects answers for all decisions, then one "답변 보내기" button sends them together to the note's chat.
- Each decision also offers a "별도 지시" option (free text) that is sent with the answers.
- Follow docs/design/ui-guide.md and the copy rules; Korean screenshots 1440x900 and 1280x800. Brief report.
Outside check: no outside check (UI work).

## Current state
- Implemented (single writer, no children: small, tightly coupled change). Note detail: each decision is a radio group
  (options + 별도 지시 (직접 입력) with a text field); choosing sends nothing; one 답변 보내기 (sticky at the bottom of the
  scroll region) sends all sendable answers as one Markdown message (`web/src/geo/notes/decision-answers.ts`) to the note's
  chat. Handoff: `prefillChat(text, {send, sessionId})` returns "sent" | "filled" | null; the panel retries ~5 s while the
  note's chat tab opens, keeps the answers and shows an error when no tab took them, and says when the tab put them in its
  composer instead. Chat tab (`chat-tab.tsx` ChatInput): skips a handoff for another chat; `send` → `onSend(..., "queue")`
  with pinned db/skill context; composer fallback when blocked or not accepted. 확인함으로 표시 is outline while decisions
  exist (one primary, B1).
- Verified: vitest (notes panel 6 tests, chat-prefill, workspace) pass; web tsc clean; copy validator 0 errors and no notes
  warnings; check-ui 0 errors. Real app (isolated copy): answers sent from the 2-decision note arrived as one user message in
  the note's chat and started a run (run state frames show the message); disconnected-model fallback shows the composer path.
- Isolated app: systemd unit `gaid-note-decisions-app` (ports 3310/18310), GAID_HOME
  ~/data/geoaidesk/work/gaid-note-decisions/home (copy of ~/.geoaidesk config, pi-agent, skills-cache and project
  review-note-style; the copied session header cwd was rewritten to the copy, otherwise "No such session");
  log ~/data/geoaidesk/work/gaid-note-decisions/app.log. Stop it before finish.
- scripts/check run 2: exit 0 (server vitest 1944 passed / 8 skipped, web vitest 1096 passed, GAID node tests 48 passed /
  1 skipped, environments smoke, production smoke PASS); log ~/data/geoaidesk/work/gaid-note-decisions/logs/check.log.
- Test app unit stopped; report review copy made (vault 연구 보고서/geoaidesk/2026-10-20-gaid-note-decisions).
## Next steps
1. task finish. Rollout to the review app (gaid-review) is the hub's call after merge.
## Failed approaches
- scripts/check run 1 failed (exit 1) only on geo/tests/distribution.test.mjs: a seam owner must be a registered package; the
  chat-prefill.ts seam now lists owner gaid-notebook-review (responsibility names gaid-note-decisions). Run 1 log:
  ~/data/geoaidesk/work/gaid-note-decisions/logs/check-1.log. Run 2 in unit gaid-note-decisions-check2.
## Notes and decisions
- No pre-selected recommended option (deviates from UI guide Q2): a note decision is the researcher's decision; a default
  would be sent as their answer by one click. All decisions on one view (deviates from Q1 one-question-per-step): the user
  asked to answer all and send once.
- Partial answers allowed; the message names unanswered decisions as left open.
- Answers sent while the chat runs are queued as a follow-up (not steering).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-20-gaid-note-decisions/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
