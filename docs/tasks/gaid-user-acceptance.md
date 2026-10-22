---
format: 1
status: active
updated: 2026-10-22T08:59:17Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"710474d1-9809-4533-b0b1-5a0edc17bbfe","pid":1859784,"provider":"claude","session":"f4e07cfa-88db-4747-9ba1-fc8c58c82256","start":"54715930","token":"a780e9fad0fb5b0384caeffe705dafe12ce274e9137acdb948d6f60822ba6255"}
branch: task/gaid-user-acceptance
target: main
parent: 
---
# gaid-user-acceptance

## Goal and done criteria
Request from the starter:

# Request: gaid-user-acceptance

User words (verbatim, 2026-10-22, to the geoaidesk hub): "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자. 사용자가 직접 확인해야하는 부분과 관련해서는 유료 구독 모델 시험의 경우 3000번 시험용 앱을 사용하여라. 그리고 PU빠른 시험은 제외해도 된다. gaid-release proof#2를 제외하고는 직접 테스트 에이전트(GPT 6.1 sol high 워커)를 GAID 허브와 시스템을 모르는 이용자라고 간주한 뒤 테스트를 진행하게 하면 된다. gaid-zotero-web-fix는 인증서 문제를 이미 해결한 것으로 이해하고 있다. 웹 서재에도 논문을 추가해두었다."

Run user acceptance checks with a tester that does not know GAID: create a reader on the Paseo "general work" profile (GPT 6.1 sol high,
as the user named) with `task reader gaid-user-acceptance --prompt-file <file>`, give it the role of a researcher using GAID hub and the
GAID system for the first time (no repo docs, reports or prior sessions; only the app and the task goal in researcher words), and let it
work through the app screens. You prepare inputs, watch, verify its claims against evidence, and write the report.
App: the user's review app on PC74, http://localhost:3000 (backend :18000, data ~/.geoaidesk). The user explicitly chose it ("유료 구독 모델
시험의 경우 3000번 시험용 앱을 사용하여라"); use it for all four checks because its model logins, Zotero key and library live there. Work in new
projects named "검토용 - 수용 시험 …"; do not delete or edit existing projects, hub entries or settings except what a check needs (a login
the user must do is the user's: ask in your tab). Tell the hub when testing is done (gaid-hub-server-trial waits for it before touching the
review app). Do not restart the review app; if it must restart, ask the hub.

Checks (items answered with this unit as follow-up):
1. gaid-library-next#1: page-cited answers from the library in a real chat (checklist in reports/2026-10-21-gaid-library-next/index.md §3.2):
   papers in a library folder attached to a project, questions, every cited page verified by you.
2. gaid-research-visuals#1: the AI agent reads the figure skill (gaid-figures), draws one figure at a target journal's final width and font
   size, and runs the check.
3. gaid-zotero-web-fix#1: with the user's Zotero web key, refresh brings in the papers the user added to the web library; send a GAID folder
   to Zotero (user says the certificate problem is solved and the web library has papers).
4. gaid-release-proof#1: paid/subscription model routes (ChatGPT sign-in, personal API key; Claude sign-in optional) — connection plus one
   task each with geo/release-proof/route-trial.mjs; spending the user's subscription is approved by the user's words above.
Excluded: gaid-hub-followups#1 (user excluded it) and gaid-release-proof#2 (needs brand approval).
Report each check as passed / failed (with evidence and screenshots) / blocked (what the user must do); open fix work only through the hub.
Outside check: no outside check.

## Current state
- Review app: gaid-review active, ~/deploy/geoaidesk at 52d8ca9d, :3000/:18000 healthy (2026-10-22 17:55 KST).
- Connected in the review app: ChatGPT sign-in (`openai`, oauth; also legacy openai-codex), MiniMax API key (`minimax`, payg,
  MiniMax-M3 $0.3/$1.2 per M). Claude sign-in not connected (optional, skipped unless the user signs in).
- Zotero web connection (user library 22256213): state `key-invalid` ("web · invalid-key · HTTP 403", failedAt
  2026-10-22T08:55:42Z); library has 0 items, 0 folders. Check 3 needs the user to save a valid web key (read+write).
- route-trial.mjs gained `--project-name` so attach-mode trial projects follow the "검토용 - 수용 시험 …" naming.

## Plan (sequential decisions, packages, order)
- Tester: one `task reader` on "general work" (GPT 6.1 sol high) acting as a first-time researcher, UI-only through
  playwright-cli against http://localhost:3000; it runs checks 1–3 and a UI-level model-route use for check 4.
  Its prompt carries no repo paths or GAID internals. Model for chats: ChatGPT sign-in (subscription, approved).
- Writer (me): run route-trial.mjs in attach mode for check 4 (two jobs: chatgpt-signin openai/gpt-6.1-sol,
  api-key minimax/MiniMax-M3, $1 cap, workflow well-log-qc), verify the tester's claims (open cited PDF pages myself,
  run the figure check myself, read Zotero state through the API), write the report.
- No child writers: no code changes beyond the harness option.
## Next steps
1. Start the tester reader; start the two route-trial jobs; ask the user for a valid Zotero web key.
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
