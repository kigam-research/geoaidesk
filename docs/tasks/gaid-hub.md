---
format: 1
status: active
updated: 2026-10-16T02:14:30Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"44493f95-ae0b-4928-a7a8-aece5a9dd72d","pid":473002,"provider":"claude","session":"86221638-71d6-426f-8fae-de543721f7e2","start":"369943","token":"7b34b1e9deea5360f09dd28a3eb9c003ae004588a4f735954bd988c2a9967395"}
branch: task/gaid-hub
target: main
parent: 
---
# gaid-hub

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-hub` (geoaidesk) — GAID hub inside GAID: authoring moved from skill_hub, one-system UX, re-test

## User words (verbatim, Korean, 2026-10-16, geoaidesk hub)
Hub's question: 1) migration way 가) one unit, services/checks/endpoints first and the researcher screens rebuilt to the GAID
prototype and screen rules with mandatory visual review, or 나) functions first and screens later; 2) skill_hub's authoring
after the move: turn off or keep for a while; 3) re-test the revised package inside GAID after the move?
User:
> "1번 - (가)안으로 하자. 우선은 GAID시스템에서 프로젝트 선택화면에서 GAID 허브로 접속할 수 있는 기능을 제공하고 GAID 허브에서 스킬
> 또는 워크플로우를 생성할 수 있게 하는 방식으로 하나의 시스템이라는 인식을 가질 수 있게 UI/UX가 개선되어야 한다. 그리고 고급검토의 경우
> Codex 고급 검토는 이제 제외해도 된다. Claude 고급 검토만 수행한다. codex는 일반 검토인 'codex 검토' 에이전트로만 수행한다. 2번은 우선
> 끈다. 3번은 옮긴뒤 GAID안에서 다시해야한다. 특히 Variogram이나 계산량이 많이 소요될 것으로 보이는 것들은 최대한 간단하게 하여 테스트할
> 수 있게 하여야 한다. 그리고 스킬 및 워크플로우를 생성하는 GAID 허브와 관련해서는 UX/UI도 이미 시안대로 구현이 안되어 있지만 사람
> 이용자들이 읽어야 하는 글자량이 너무 많으며, 스크롤이 한없이 아래로 내려가게 되어 있어 불친절하고 처음 사용자의 유입을 떨어뜨리게 한다.
> 그리고 가급적 현재 사용자가 에이전트 작업하는 방식처럼 질문에 대해서는 권장 옵션을 포함한 선택지가 제공되어야 하고, 사람 이용자가 다른
> 의견을 원할 경우 입력할 수 있는 기타 입력란을 제공하는 방식으로 하고 한번에 한 개의 질문을 하며, 질문은 탭으로 이전/다음으로 이동할 수
> 있게 한 뒤 모든 질문에 대한 답변이 일괄 반영되어 스킬 또는 워크플로우 초안이 생성되고 사용자가 시각적으로나 잘 정리된 흐름도 및 명료한
> 설명으로 인지부하를 낮추면서도 의도가 잘 반영될 수 있게 UI/UX 시스템이 구성되어야 한다. 사용자의 요구사항을 이해하였는지 먼저 확인 받자."
Hub's confirmed understanding included: "2번 끈다" = disable skill_hub's authoring screens and authoring endpoints
(`#/author`, `/api/authoring`, `/api/gaid`) without deleting code. User: "이해한바가 맞다. 진행하자."

## Scope (from the user's words; add no other required items)
1. Move skill_hub's authoring into geoaidesk: authoring service (PDF page text, code archive intake, durable
   questions/answers/drafts, restart recovery), coauthor agent (analyze/draft/revise prompts, citation anchors, one bounded
   repair) wired to GAID's own model runtime, package builder + the six checks + GAID manifest (gaid-method/v1), tests.
   Inventory: skill_hub reports/2026-10-16-gaid-hub-authoring/index.md §3.6 + appendix A (paths, commits); GAID side:
   reports/2026-10-16-gaid-hub-integration/index.md appendix B. Read skill_hub read-only via
   `gh api "repos/kigam-research/skill_hub/contents/<path>?ref=main" -H "Accept: application/vnd.github.v3.raw"`
   (raw.githubusercontent.com is blocked). Take Atlas profile format, taxonomy terms and environment list as vendored,
   versioned inputs with provenance (like geo/copy/), not a runtime dependency on the skill_hub checkout.
   The hub-fetch path (LocalMethod install from a remote hub) stays; locally authored methods install through the same gate.
2. One-system UX: the project selection screen gives an entrance to the GAID hub; in the GAID hub the researcher creates a
   skill or Workflow and brings it into a project to test, with GAID's look and navigation (no feeling of a separate site).
3. Authoring screens follow the prototype (`/authoring-preview`, docs/design/authoring-preview-runtime.md,
   docs/design/source-authoring-agents.md, docs/design/spatial-pu-pilot.md, researcher-ecosystem report) and these rules:
   little text to read, no endless scroll; one question at a time with options including a marked recommended option and an
   "기타" (other) free-text field; tabs to move previous/next between questions; all answers applied together to generate the
   skill or Workflow draft; the draft shown as a clear flow diagram with short, plain explanations; agent-internal details
   (model names, run logs, raw schema errors, file-path check output) hidden from the researcher (available on demand at most).
   Copy kit rules (geo/copy/), "Workflow" term, Korean/English locales.
4. Re-test inside GAID with the user's paper and scenario (asset authoring_preview_paper, docs/design/spatial-pu-pilot.md;
   pre-existing PU skill out of the authoring context; Qwen route KIGAM qwen3.8-flash-next, reasoning low/medium/xhigh, no
   paid runs): author in the GAID hub → install → bounded run. Keep computation-heavy steps (e.g. variogram) minimal so the
   test completes: subsample/limit as the skill states, and record what was reduced. Carry over the 7 package defects
   (geoaidesk request 351e0b68701b result) and skill_hub's revision-4 fixes (downsampling, install command names e.g.
   scikit-gstat, file names, option labels).
5. Reviews: researcher persona (Claude Sonnet 5.5, thinking high) viewing screenshots at each step; "Claude 고급검토" visual
   review before/after; Codex only via the "Codex 검토" profile (no "Codex 고급검토"). Triage as usual.

## Facts and rules
- skill_hub is asked (request 6f3090e0823f) to turn off its authoring routes; its public site, catalogue releases and Atlas
  stay there. Open items from gaid-hub-integration (#1 re-test, #2 GAID defects) belong to this unit's area — take them.
- Writer: Claude top-level orchestrator; child writers "general work" (gpt-6.1-sol high) at normal speed; settle shared
  interfaces first, then split packages. Own GAID instance on free ports with its own GAID_HOME under
  ~/data/geoaidesk/work/gaid-hub/; never touch the user's review instance (gaid-review, 3000/18000, ~/.geoaidesk). Shared Qwen
  server: one session at a time. Present the screen/flow design (a few key screens) to the user in your tab before building
  all screens. Checks: scripts/check. Report under reports/<date>-<topic>/ with small PNGs. Remove build caches and
  app-written files/links from the worktree after the last check.

## Current state
- 2026-10-16: resumed; inventory read (skill_hub report §3.6/appendix A, hub-integration appendix B, design docs).
  skill_hub reference snapshot (read-only, never a runtime dependency): main 54fe4773d06fcb3d0dc36882d5cd44d9094cade5,
  ~/data/geoaidesk/work/gaid-hub/inputs/skill_hub/ (tarball sha256 cdea8d08…aa2c4, from `gh api .../tarball/<sha>`).
- Dev instance: user unit `gaid-hub-dev` (next dev from this worktree, hot reload), ports 3330/18330,
  GAID_HOME ~/data/geoaidesk/work/gaid-hub/home (pi-agent models.json/kady-settings copied from the hub-integration
  instance: kigam-qwen/qwen3.8-flash-next default), launcher ~/data/geoaidesk/work/gaid-hub/bin/dev.sh,
  log ~/data/geoaidesk/work/gaid-hub/logs/dev.log. Re-check: `systemctl --user status gaid-hub-dev`.
## Next steps
1. Settle the shared contract `web/src/geo/contracts/authoring.ts` + HTTP surface (below), then start the server-port child.
2. Build the few key screens (entrance, question tabs, draft flow) with fixture data, screenshot, present to the user.
## Failed approaches
## Notes and decisions
### Orchestration plan (2026-10-16)
Sequential decisions: (1) shared records/contract + route surface (parent) → (2) server port and screen design run in
parallel → (3) user approves key screens → (4) build all screens → (5) wire end to end, reviews → (6) re-test in GAID →
(7) report, scripts/check, cleanup.

Placement decisions:
- Server: `server/src/geo/authoring/` (store, sources, anchors, prompts, agent, model adapter, package, checks, routes).
  User-level store (not per GAID project): `<GAID_HOME-derived agent dir>/authoring/` (exact helper picked from
  existing path helpers); routes `/geo/authoring/*`, global (no project scope), loopback/auth as other geo routes.
- Model: GAID's own runtime (`ModelRuntime.completeSimple` via the one-shot pattern of next-experiments.ts), model =
  the researcher's chosen connected model (default: app default); ledgered under pseudo session `authoring`; spend cap
  applies. No direct provider endpoint calls.
- Contract types: `web/src/geo/contracts/authoring.ts` (port of skill_hub web/shared/authoring/records.ts, adapted);
  gaid-method types reuse/extend `web/src/geo/contracts/methods.ts`.
- Vendored hub inputs with provenance: `geo/hub/` (atlas-profile, gaid-method, gaid-hub-package, geo-workflow schemas;
  taxonomy YAML; SOURCE.md with skill_hub SHA). Environments and catalogue skill ids come from GAID's pinned catalogue
  (environments.json, catalogue/index.json), not from a skill_hub checkout. The atlas check runs single-profile
  validation (no whole-catalogue compile).
- Install: a locally built package goes through the existing preview → acknowledgement → install gate (no HTTP fetch);
  remote hub-fetch stays.
- Web: GAID hub screens under `web/src/geo/hub/` and a route outside the project workspace; entrance on the project
  selection screen (`web/src/components/project-view.tsx`, add to integration-boundaries).
- UX rules (user, 2026-10-16): little text, no endless scroll, one question at a time in tabs (prev/next), options with a
  marked recommendation + "기타" free text, all answers applied together → draft, draft as flow diagram with short
  plain explanations, agent internals hidden (on demand at most).

Work packages:
- P1 server port (child writer, general work): owns `server/src/geo/authoring/**`, `server/test/geo-authoring*.test.ts`,
  `geo/hub/**`. Interface: the contract file + route table fixed by the parent.
- P2 screens (parent first for key screens; may split later): owns `web/src/geo/hub/**`, locales `web/src/geo/locales/hub/`,
  the entrance edit in project-view.tsx.
- P3 re-test (parent, after integration): own instance, Qwen route, researcher persona + Claude 고급검토 + Codex 검토.
Integration order: P1 → wire P2 to real endpoints → P3.
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
