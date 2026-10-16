---
format: 1
status: waiting
updated: 2026-10-16T08:33:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"2bcfea81-9275-44fd-a5a1-b9fafc08ffe8","pid":258415,"provider":"claude","session":"8184888d-c0b2-4d0c-aa76-7c348aa1179c","start":"2758168","token":"4dbb19fe6abf051a4775c62f53fa0c0eaaca350d579435e10a2c473b08653f8e"}
branch: task/gaid-ui-guide
target: main
parent: 
---
# gaid-ui-guide

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-ui-guide` (geoaidesk) — GAID UI/UX guide based on Samsung One UI, as the build standard

## User words (verbatim, Korean, 2026-10-16, geoaidesk hub)
> "현재 gaid ui/ux 시스템과 관련하여 https://developer.samsung.com/one-ui 를 적극 참고하여 ui/ux 가이드를 개선하자. 현재는 에이전트가
> 스스로 판단하여 개발하였지만 이제부터는 올바른 가이드를 기반으로 해서 시스템을 구축하게 하고 싶다."

Earlier user requirements this guide must carry (verbatim excerpts, 2026-10-15/16):
- "항상 새로운 시스템을 이용자는 너무 많은 정보량이 플랫폼이나 시스템에서 제공되면 역치를 넘어서지 못하고 포기하거나 유입에서 빠져나올 수
  있는 점을 고려하고 UI/UX에서도 너무 많은 글자 수자 정보량이 보이는 것은 유의해야한다."
- "사람 이용자들이 읽어야 하는 글자량이 너무 많으며, 스크롤이 한없이 아래로 내려가게 되어 있어 불친절하고 처음 사용자의 유입을 떨어뜨리게
  한다. 그리고 가급적 현재 사용자가 에이전트 작업하는 방식처럼 질문에 대해서는 권장 옵션을 포함한 선택지가 제공되어야 하고, ... 기타
  입력란을 제공하는 방식으로 하고 한번에 한 개의 질문을 하며, 질문은 탭으로 이전/다음으로 이동할 수 있게 ... 흐름도 및 명료한 설명으로
  인지부하를 낮추면서도 의도가 잘 반영될 수 있게"
- Map panels: legend and basic info beside the map without scrolling; attribute tables with column filter/sort; feature info as
  a map popup. Agent-internal details (model names, run logs, raw errors) must not be shown to researchers.

## Scope (add no other required items)
1. Study Samsung One UI design guidelines (https://developer.samsung.com/one-ui and its sub-pages; use the `oracle-search`
   skill or fetch the pages) and write the GAID UI/UX guide adapted to a desktop-first research web app: principles (focus,
   reachability/viewing area, information density, one task per screen), layout and spacing, typography scale, colour and
   states, components (buttons, lists, cards, tabs, dialogs, question/option pickers, tables, map side panels, popups,
   progress, empty/error states), motion, accessibility, Korean/English copy length, and a "what researchers never see"
   rule. Map each GAID rule to the One UI source it adapts (link + section), and state where GAID deliberately differs.
   Do not copy Samsung assets, proprietary fonts (One UI Sans) or icons; reference principles only.
2. Make it the standard agents build against: put the guide in the repo (e.g. docs/design/ui-guide.md plus tokens in a
   machine-readable file aligned with the existing WP00 tokens/copy kit in geo/copy/ and design tokens), add a short rule to
   AGENTS.md (read the guide before UI work; report which rules a change follows; visual review against it), and add
   lightweight automated checks where practical (e.g. token use, max text per first view, no raw error/model strings in
   researcher-facing locales). Keep checks proportionate.
3. Show the guide's effect on 2–3 representative existing screens (before/after mockups or screenshots), and get the guide
   and those screens visually reviewed: researcher persona (Claude Sonnet 5.5, thinking high) viewing screenshots, plus
   "Claude 고급검토"; Codex only via the "Codex 검토" profile (no "Codex 고급검토").
Present the guide's structure and key rules to the user in your tab before finalizing.

## Coordination
- Unit `gaid-hub` (writer 44493f95) is building the GAID hub authoring screens now. The hub tells it this guide is coming;
  once your guide lands on main it syncs and aligns. Settle the guide early and keep shared files (tokens, AGENTS.md rule)
  small so its merge is easy; do not rebuild its screens here.
- Design tokens/copy kit originally came from skill_hub WP00 (vendored in geo/copy/). Authoring and design now live in GAID;
  if you change a vendored skill_hub file, record it and the hub forwards the change to skill_hub.
- Writer: Claude top-level orchestrator; child writers "general work" at normal speed. No paid model runs. Checks:
  scripts/check. Report under reports/<date>-<topic>/ with small PNGs. Never touch the user's review instance. Remove build
  caches and app-written files/links after the last check.

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
