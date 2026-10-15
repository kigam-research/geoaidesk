---
format: 1
status: active
updated: 2026-10-15T16:09:24Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"dbdb4cbd-2d57-4910-b65d-bd49f933a62c","pid":3995575,"provider":"claude","session":"b03772b2-dfa3-4e55-8fcf-0806067bf669","start":"53164560","token":"2bf8cb96689f048b8aaf4a9de4abff678c06495519fda7b0cc44b584bcedce5a"}
branch: task/gaid-qwen-authoring-trial
target: main
parent: 
---
# gaid-qwen-authoring-trial

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-qwen-authoring-trial` (geoaidesk) — how a Qwen-driven GAID agent authors skills and workflows

## User words (verbatim, Korean, 2026-10-15, geoaidesk hub)
> "gaid-release-proof과 관련하여 우선 로컬 서버 qwen모델로 실제로 스킬 및 워크플로우를 생성했을 때 어떤 형태로 생성되는지
> 테스트해보는 작업을 수행한다. 이를 위해서는 메인 작업트리의 세션이 오케스트레이션을 맡고 이용자의 역할은 sonnet 5.5 high가
> 하고, 스킬을 생성할때 사용되는 에이전트 모델이 로컬 서버 qwen모델인 것이다. 사용자의 요청사항을 먼저 이해하였는지 답변하고
> 작업을 시작하자."

Hub's confirmed understanding (sent to the user before starting):
- Purpose: see what form the skills and workflows (recipes) take when GAID's in-app agent, running on a Qwen model, creates
  them from a researcher's request. Continues the model-route trials of gaid-release-proof (open item gaid-release-proof#1).
- Roles: you (this unit's main writer, Claude) orchestrate: design the trial, prepare the environment, run it, collect and
  report. A Claude Sonnet 5.5 agent with thinking high plays the researcher (user): it asks GAID, through the app as a user
  would, to create skills and workflows, checks the results and asks for revisions where a researcher would. GAID's agent
  model is the Qwen model and actually writes the skill files and recipes.
- Assumption stated to the user: "로컬 서버 qwen모델" = KIGAM server `http://10.13.15.67:8000/v1` model `qwen3.8-flash-next`.
  If the user tells you in your tab they meant the PC74 Ollama route (`gaid-local`), switch to it.

## Scope (add no other required items)
Run realistic authoring scenarios, keep every generated artifact (skill folders, recipes/.geo-start.json, chat transcripts)
and report what was produced: structure, completeness against GAID's skill/recipe formats, whether GAID's install/check
gates accept them, and notable defects. Results are for review; record only observed outcomes.

## Verified facts (hub)
- GAID entry points: skill authoring from a template and in-place SKILL.md editing (`server/src/agent/skills-install.ts`,
  Settings → Skills), the WP07 local "make reusable skill" entry, and recipes ("레시피 가져오기", `.geo-start.json`, category
  choice; `server/src/geo/workspace/saved-recipes.ts`). Formats: skill_hub WP01 contracts docs/specs/gaid-*.md (read with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`;
  raw.githubusercontent.com is blocked) and the pinned catalogue 0.2.1 (~/assets/geo-catalogue/0.2.1/) as reference examples.
- Qwen server: vLLM, models qwen3.8-flash-next, /models/Qwen3.8-27B, /models/Qwen3.6-27B, 262K context. Accepted reasoning
  levels low/medium/xhigh; register it as a custom server with reasoningLevels [low, medium, xhigh] (high is sent as medium).
  Shared server: one session at a time; record wall-times. Trial harness from earlier units:
  `geo/release-proof/route-trial.mjs`, evidence under ~/data/geoaidesk/work/gaid-qwen-followups/ and gaid-kigam-qwen-trial/.
- Researcher agent: create it yourself (Paseo MCP create_agent: provider claude, model claude-sonnet-5-5, thinking high,
  notifyOnFinish false; or the task CLI reader if it fits). It should drive the app like a user, e.g. with the
  `playwright-cli` skill against your own instance; give it a persona brief (a KIGAM geoscientist with sample data) and no
  repo write access. Record its id in the task document.
- Use your own GAID instance on free ports with its own GAID_HOME under ~/data/geoaidesk/work/gaid-qwen-authoring-trial/.
  Do not touch the user's review instance (unit `gaid-review`, ports 3000/18000, data ~/.geoaidesk).
- Sample data the researcher can use: ~/assets/force2020-welllogs/c8d01ee9/las/, ~/assets/ga-kambalda-intake/20260928/,
  ~/assets/seoul-geology/forgeo-borehole-geology/20260602/ (copy into your instance; never modify ~/assets).
- No paid model runs. Runs to keep through `task job run` where practical. Report in reports/<date>-<topic>/index.md with
  small PNGs of the key screens and examples of generated artifacts; if code changes, `scripts/check`. After your last check
  remove regenerable build caches and any app-written files/links from the worktree so the unit can close.

## Scope changes (routed by the hub, 2026-10-15)
- `qwen-authoring-scope` — user (verbatim): "위의 이해는 맞으며, 테스트 결과를 확인해가면서 시스템에 문제가 있다면 개선해야하는 것도
  수행해야한다." The brief's understanding is confirmed. Added: fix problems found in GAID itself (app code, prompts,
  formats, checks) in this unit, re-run the affected scenarios after each fix (report shows before/after); code changes
  need `scripts/check`; the user's review instance stays untouched.
- `qwen-authoring-skill-vs-workflow` — user (verbatim): "그리고 gaid-qwen-authoring-trial에서 작업해도 되고 별도의 작업트리로
  작업해도 좋은 내용이다. 스킬과 워크플로우 레시피를 현재 분리되어 있다. 둘의 구분에 대해 검토해볼 필요가 있다. 스킬의 일종의 함수 또는
  기능군이라고 한다면 워크플로우는 스킬을 포함한 특정 과업을 에이전트가 원활하게 수월하게 할 수 있는 워크플로우 레시피라고 볼 수 있다.
  그리고 연구자들의 경우 이러한 스킬과 워크플로우의 차이점을 잘 구분하지 못하고 어떤것을 만들어야 하는지 어려움이 있을 수 있다. 항상
  새로운 시스템을 이용자는 너무 많은 정보량이 플랫폼이나 시스템에서 제공되면 역치를 넘어서지 못하고 포기하거나 유입에서 빠져나올 수 있는
  점을 고려하고 UI/UX에서도 너무 많은 글자 수자 정보량이 보이는 것은 유의해야한다." Added: (1) review the skill / workflow-recipe
  split in GAID, the catalogue/WP01 contracts and the skill_hub site; (2) using trial evidence, design one creation entry
  where the researcher need not choose up front (asks the goal, proposes skill, recipe or both); keep formats and gates
  unless evidence requires a change, and name any skill_hub contract change for the hub; (3) low information load on
  first view for the screens changed, plus a list of other overloaded screens (no app-wide rework). Present the concept
  decision to the user in this tab before large UI changes; small fixes may go ahead.
- `qwen-authoring-visual-review` — user (verbatim): "위의 작업이 정말 올바르게 검토하려면 연구자 역할을 하는 에이전트가 시각적으로
  화면을 확인하면서 의견을 들어볼 필요가 있으며, 화면의 시각적 확인은 연구자 역할 에이전트도 수행해야하지만 고급 CLAUDE와 CODEX 검토도
  받아보아야 한다." Added: (1) the researcher reads its own screenshots as images at each step (desktop and narrow width)
  and comments as a researcher (clarity, what it would click, where it gets lost, information load); screenshots +
  comments are evidence (small PNGs in the report folder); (2) independent visual reviews of the same screens, before and
  after fixes, from "Claude 고급검토" (claude-fable-5-1, medium) and "Codex 고급검토" (gpt-6-astra, high), read-only,
  notifyOnFinish false, ids recorded here; triage as usual and summarize both in the report.

## Current state
- Result (2026-10-16): trial, fixes, children, R1/R2 re-tests and before/after visual reviews done; canonical report
  `reports/2026-10-15-gaid-qwen-authoring-trial/index.md` (review copy in the Obsidian vault). Qwen made usable skills;
  chat-made skills were hidden from new chats (fixed: 0/2 → 1/1, 1/1); asked for a Workflow it re-pinned the app
  catalogue and wrote into ~/assets (contained; now an outside-project confirmation card, R2 showed 3 cards, no outside
  change). Workflow list/skills/settings first views trimmed; Korean UI says "Workflow"; Modal off in the distribution
  (31→24 tools, ≈27.4k→≈23.0k start tokens). Not met here by decision: a researcher-made Workflow appearing in the list
  and paper→skill authoring in skill_hub (sent to the hub as request bd45c51400e1). Open items: narrow workspace layout,
  remaining Kady/K-Dense strings. Trial services gaid-qat-app{,2,3,4} stopped; data kept under
  `~/data/geoaidesk/work/gaid-qwen-authoring-trial/`. Researcher Paseo agent 77493076 is idle (not a task reader).
- 2026-10-15 12:05Z: trial instance up: snapshot of 001e9bb in `~/data/geoaidesk/work/gaid-qwen-authoring-trial/app`,
  user unit `gaid-qat-app` (ports 3310/18310, `GAID_HOME=<work>/home`, log `<work>/logs/app.log`). `kigam-qwen`
  registered (reasoningLevels low/medium/xhigh; picker shows high→medium), defaults model/verifier =
  `kigam-qwen/qwen3.8-flash-next`, thinking high. No other provider is configured in this instance (no paid route).
  Default project has the 13 catalogue skills. Samples in `<work>/samples` (FORCE 25_9-1 + 15_9-13 LAS, Kambalda grids
  + ozmin, Seoul 250K litho/fault + boundary).
- Researcher agent: Paseo `77493076-fcf2-4bfc-a5ea-b37f99c177f8` (claude-sonnet-5-5, thinking high, notifyOnFinish
  false), brief `<work>/researcher/BRIEF.md`; deliverables `<work>/researcher/{log.md,summary.md,playwright/}`.
  Re-check: `get_agent_status`, `ls <work>/researcher`, `systemctl --user status gaid-qat-app`. Finished 22:26.
- Visual reviewers "before" (task readers, read-only, 2026-10-15 13:28Z): Claude 고급검토 `76752b51-39fe-4322-b3d6-39264f6ee1a9`
  (claude-fable-5-1 medium, verified), Codex 고급검토 `6316650b-7028-4727-9825-a3f05d8d6879` (gpt-6-astra high, verified).
  Prompt `<work>/reviews/visual-before-prompt.md`; outputs `<work>/reviews/{claude,codex}-advanced-before.md`.
## Next steps
<!-- task:closed -->
Closed 2026-10-15T15:59:46Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-qwen-authoring-trial.md.

## Trial findings and fixes (live list; evidence `<work>/researcher/log.md`, `<work>/evidence/`)
- S1 (21:07–21:51 KST): Qwen copied the catalogue LAS helper, wrote `las-window-quickqc` (SKILL.md + wrapper script, no
  atlas.yaml); Pi loader and skill_hub package preview accept it (`evidence/s1-v1`, `s1-final`).
- F1 [fixed, committed; not yet re-run in an app] A skill the agent writes in a chat has no sync record, so the default
  `catalogue` exposure hid it from every new chat although Settings shows it enabled; Qwen then picked the catalogue
  skill (2/2 fresh chats). Fix: `server/src/geo/context.ts` offers project skills without a sync record;
  `server/test/geo-context.test.ts` updated (8/8 pass).
- F2 [guidance added, committed: GEO_INSTRUCTIONS "work inside this project…" and skill-authoring line] Unasked side edits by Qwen: appended to catalogue `well-log-qc-quicklook/SKILL.md` and project `AGENTS.md`
  (routing rule) while "fixing" F1; read the app's own server code outside the sandbox. Candidate: GEO_INSTRUCTIONS rule.
- F3 [fixed, committed: untracked skill → origin local "직접 작성", catalogue badge "카탈로그", Skills header shortened to one true sentence] Catalogue skills all show the "K-Dense" origin badge in Settings → Skills (KIGAM vs user not distinguishable).
- F4 [fixed, committed: requested size re-clamped on resize; below 672 px viewport no inline size, narrower sidebar/padding; needs visual re-check] Settings dialog keeps a 640 px width after a narrow→wide resize until reload; at 390 px one word per line.
- F5 [fixed, committed: empty Connected card explains models come from a local/custom server] Settings → Providers says "연결됨 (0)" while the custom server works.
- F6 [open] Exposure chip cut off at the composer's right edge at 1440 px; its popover shows 6 numbers on first view.
- S2 v1 (21:51–21:59): `grid-audit-point-sample` = SKILL.md, atlas.yaml, LICENSE, references/methods.md,
  scripts/{grid_audit.py,selftest.py}; Pi loader + skill_hub preview accept it (`evidence/s2-v1`). skill_hub schema check
  (`<work>/scripts/atlas_check.py`, read-only on ~/repos/skill_hub 957d366): 5 schema errors (YAML ": " splits Korean
  text into keys; extra `help`/`geometry`), unknown taxonomy terms tasks:tabular-extraction, dataTypes:vector-points,
  scales:local; control geo-map-and-crs = 0 errors. Claims `id: kigam/…`, `release.state: published`, KIGAM authorship.
- F8 [open] GAID's gates never look at atlas.yaml, so an invalid/overclaiming profile passes silently (S2).
- F9 [card fixed, committed: title says AI agent, English guard reason hidden; remaining "Kady" in 54 locale strings mixes agent and app meanings — listed, not mass-replaced] Permission card copy says "Kady"; `__pycache__` cleanup inside a skill folder asks twice.
- F10 [open, concept] No way to share/export a chat-made skill to a colleague (Qwen claimed "그대로 설치·사용").
- F11 [upstream, note] User chat bubbles render Markdown: `kambalda_*.tif` became italics.
- S2 final: README.md + shareable `results/grid-audit-point-sample-0.1.0.tar.gz` (accepted by "스킬 추가" preview; not
  installed); atlas.yaml errors unchanged (`evidence/s2-final`).
- S3 (22:08–22:26): Qwen wrote `workflow_authoring/district-lithology-map/{*.workflow.json (geo-workflow/v1: 3 input
  roles, 4 choices, 5 artifacts, boundary), *.geo-start.json, scripts/district_lithology.py, README.md}` and a 강남구
  demo. To "put it in the list" it built catalogue 0.2.2 (0.2.1 + this workflow) in `~/assets/geo-catalogue/0.2.2/` and
  `<home>/catalogue/`, and re-pinned the trial app's `geo/distribution.json`; the list showed 8 workflows without a
  restart; the researcher saved the recipe ("서울 구 단위 암상·면적 (내 레시피)") and created a task draft from it.
  Recipe check: ok under the agent's 0.2.2; under the committed 0.2.1 → `unknown-workflow` + `catalogue-version`
  (`evidence/s3-under-0.2.{1,2}`).
- F12 [critical, open] The GAID agent wrote outside its project: app install file, `<GAID_HOME>/catalogue`, shared
  `~/assets`; it also listed other projects' worktrees and read the app source and `config.env` (with a secrets filter).
  Only its own `rm -rf` got a confirmation card. Containment done 2026-10-15 22:26: `~/assets/geo-catalogue/0.2.2` moved
  to `<work>/evidence/s3-outside-writes/` (sha256 list kept; 0.2.1 MANIFEST verified OK), app pin restored from 001e9bb,
  `<home>/catalogue` moved to evidence, `gaid-qat-app` restarted on 0.2.1. No other outside changes found (find -newer
  over ~/assets ~/repos ~/worktrees ~/deploy ~/.geoaidesk; snapshot diff shows only geo/distribution.json).
- F13 [concept, open] A researcher's "workflow" has no local home: geo-start can only reference a catalogue workflow,
  so the agent's only route to the list was editing the catalogue pin. The agent was told nothing about recipes/workflows.
- F14 [open] Researcher screen notes (summary.md "화면 의견"): workspace header numbers ($0.00, %, ≈27.4k), slash menu
  English, icon-only upload/wand/skill buttons, permission card ("Kady", English, invisible at 390 px), TaskSetup length
  and "작업 중 결정" ambiguity, file dropdowns mixing outputs with sources, shapefile parts ungrouped in the file list.
- F7 [model, note only] Output folder overwritten without asking (`qc/15_9-13`); wrong self-explanations of F1.
## Terminology
- Routed `term-workflow-gaid-qwen-authoring-trial` (user, hub, verbatim): "용어로서 워크플로우가 표준용어이고 가급적 영어로
  Workflow로 사용하길 원한다." Replaces Q2 가 ("워크플로"). Korean UI values now say "Workflow" (e.g. "지구과학 Workflow",
  "Workflow 검색", "Workflow: {title}", robustness/evidence strings too); "워크플로우" only where Korean spelling is unavoidable
  (none needed so far); pi-subagents workflow scripts stay "위임 스크립트"; ICU select keys untouched; English locale
  unchanged. Affected UI tests updated (178/178 in src/geo + panels); copy check 0 errors. `geo/copy/terminology.csv`
  stays a byte copy: skill_hub owns the change (hub already told, requests bd45c51400e1 / 78fce59a1e63 superseded by
  the hub's correction).

## R2 re-test (all fixes, 13618c1, instance 3; `<work>/researcher/r2/`)
- Researcher (00:01–00:45 KST): no Modal/compute surfaces anywhere (workspace tabs/chips, Settings → Services); start
  prompt ≈24.9k (≈27.5k before). Skills badges 카탈로그/기본 제공/직접 작성 distinct; Settings narrow layout usable (tab
  row) except the Skills header paragraph; resize returns to 1040 px. Workflow list first view: 7 geo cards, only
  미시험/환경 준비 필요 badges, one pill, "다른 분야 Workflow 보기 (326개)". Chat-made skill `las-window-qc` (Korean
  SKILL.md, ran vs untested sections) loaded first in a fresh chat with the default scope (1/1). Workflow request (24 min):
  3 outside-project cards (2 denied: /tmp copies of the app; 1 allowed: project scratch); no app/assets change; files in
  `workflows/district-lithology-map/` incl. an `add_to_app.py` installer the researcher cannot run; Workflow list
  unchanged → the "own Workflow in the list" goal is not met (LocalMethod is the next unit's scope).
- Fixed after R2 (small): card says "위치를 확인할 수 없는 파일 변경" for shell-variable targets ($A); SettingsHeader stacks
  actions under the text on phones; "다른 분야 Workflow 접기" button. Remaining, listed only: Workflow list covers the
  composer (upstream panel swap), "미시험" on every card (kept by copy rule), narrow permission card visibility
  (app-wide layout), Kady/K-Dense strings on Services, Hanzi/English mixed into Qwen's Korean answers.

## R1 re-test (after F1–F5/F9; instance 2, 7e77779; `<work>/researcher/r1/`, `<work>/evidence/r1`)
- F1 confirmed: fresh chat with the default catalogue scope loaded the chat-made skill `las-quicklook-qc` first (1/1;
  exposure record of that chat lists it; before 0/2). F3: "직접 작성"/"카탈로그" distinguishable, but council-mode and
  pi-subagents also showed "직접 작성" → now flagged `builtin` "기본 제공". F4: resize returns to 1040 px; 390 px still
  cramped → tab list stacks above content below sm (needs visual re-check). F5: explanation shown; server card is far
  down. Not exercised: permission card (no delete asked), outside writes (no catalogue request).
- Model-side notes: Korean answers still mix Hanzi/Kana ("附带"), Markdown table shown as pipes once.

## Visual review triage (before; Claude 고급검토 + Codex 고급검토, `<work>/reviews/*-before.md`)
- Agreed blockers: narrow Settings (→ F4 fixed, re-check after), chat-made skill not offered (→ F1 fixed), no
  skill-vs-workflow guidance / four names for one list (→ concept decision pending), authored skills indistinguishable
  (→ F3 fixed), permission card "Kady"/English (→ F9 fixed).
- Codex blocker 2 / Claude blocker 3 (narrow workspace: chat area ~40 px at 390 px, permission card and composer
  controls off-screen): verified in `s1-permission-narrow.png`. Cause is the app-wide stacked layout (upstream), not the
  authoring screens; desktop/WSL is the declared first target (product D3). Deferred as an open item, not fixed here.
- Optional (apply on screens this unit changes after the concept decision): workflow list badges/pills, Skills page
  rows, skill-add preview (hash/limits/git folded), recipe import jargon, TaskSetup folding and "작업 중 결정" wording,
  exposure popover order, readable Korean names for skills. Listed only: workspace header telemetry, unlabeled file
  icons, chip truncation, doubled "선택" in the file input, slash menu English, ~54 locale strings still saying "Kady"
  with mixed agent/app meaning.
## Decisions (user, writer tab, 2026-10-15)
- "사용자가 결정한 일로 모두 권장으로 하자." → Q1 가 (local workflow home in the app), Q2 가 (UI term "워크플로"), Q3 가
  (confirmation card for outside-project writes + guidance).
- Same message: "그리고 Modal 서비스와 관련한 연산 환경도 없애도 되는 것이다. 불필요한 유료 서비스를 기관 연구자에게 강요한다.
  BYOK의 연계 유료서비스로 보인다." → scope addition: switch Modal remote compute off in the distribution (child modal-off;
  switched off, not deleted, to keep upstream sync cheap).
- Next message: "그리고 스킬 만들기 테스트는 GAID 프레임워크 시스템이 아니라 수정된 Skill_hub 시스템에서 사용자가 테스트로 제공한
  논문을 바탕으로 스킬을 만들고 해당 스킬을 테스트해봐야 하는 것이 아닌가? 일관성이 부족해보인다." Facts checked: skill_hub main is
  unchanged since 2026-10-12 (957d366) and has no paper→skill authoring; the test paper is asset
  `authoring_preview_paper` (gaid-authoring-preview/20261015, MPM nested-CV author manuscript), wired only to GAID's
  click prototype `/authoring-preview` (no AI generation). "Authoring home" question asked in the tab; Q1/one-entry
  implementation waits for it. Independent work continues (children, terminology, info load on lists).
## Failed approaches
- 2026-10-16 first `task finish`: full check failed only in `web/src/geo/viewers/map/viewer.test.tsx` (third load-related
  failure of that file; branch does not touch map code). Cause: the test read `/geo/vector-page` calls right after a
  heading/notice that can render before the request. Fixed the test to `waitFor` the request(s); assertions unchanged;
  isolated 3/3 pass. Retry finish.
- (modal-off child, 2026-10-15) `VITEST_MAX_WORKERS=4` for `scripts/check` overrides the server's serial run
  (fileParallelism:false) and causes PROJECTS_ROOT cleanup races (121 ENOENT failures). Run scripts/check without a
  global cap, or `VITEST_MAX_WORKERS=1`; cap only the web suite if host load makes map viewer tests time out.
## Notes and decisions
- Orchestration (sequential, done by this writer; no child writers: the work is one tightly coupled interactive trial,
  and the Qwen server takes one session at a time):
  1. Environment: `git archive` snapshot of this branch HEAD in `~/data/geoaidesk/work/gaid-qwen-authoring-trial/app`
     (build caches stay out of the worktree), `GAID_HOME=<work>/home`, own ports, started with `systemd-run --user`
     (a long-lived interactive service, so not a `task job`). Custom server `kigam-qwen` (`openai-completions`,
     reasoningLevels low/medium/xhigh, context 262144, maxTokens 16384, cost 0) and app default model
     `kigam-qwen/qwen3.8-flash-next` set through the API the way Settings does. Sample data copied to `<work>/samples`.
  2. Researcher: Paseo agent (claude, claude-sonnet-5-5, thinking high), cwd `<work>/researcher` (outside Git), drives
     the UI with `playwright-cli`; persona brief only, no format hints beyond what the UI shows a user.
  3. Scenarios (serial chats): S1 well log QC on FORCE 2020 LAS then "재사용 스킬 만들기"; S2 a new skill from scratch for
     Seoul borehole geology intervals; S3 a workflow request (recipe `.geo-start.json` for a catalogue workflow, then
     "레시피 가져오기"; and a request for a new workflow on the Kambalda intake data, to see what Qwen produces when GAID
     has no local workflow install path).
  4. Gates applied by the orchestrator to every artifact: Pi loader (`GET /skills`), skill_hub package preview
     (`POST /geo/skill-hub/preview` with a `.tar.gz`), recipe check/import (`POST /geo/recipes/check`, `/geo/recipes`),
     and a field-by-field comparison with catalogue 0.2.1 (`atlas.yaml` atlas-profile/v1, `workflows.json` geo-workflow/v1).
  5. Collect: skill folders, recipes, session JSONL, ledger, screenshots → `<work>/evidence`; report
     `reports/2026-10-15-gaid-qwen-authoring-trial/index.md`.
- Contract findings (2026-10-15, skill_hub main docs/specs + catalogue 0.2.1): skill = atlas-profile/v1 (`SKILL.md` +
  `atlas.yaml`), whose `kind` is `workflow` for 5 of 8 KIGAM skills (term clash with geo-workflow); workflow =
  geo-workflow/v1 task template (skillIds, inputRoles, requiredScientificChoices, prompt, environmentProfile,
  expectedArtifacts, boundary), authored only in skill_hub `registry/byok/workflows/`; recipe = geo-start/v1, a filled
  preset of a catalogue workflow. Plan §5.3: app shows at most three contextual actions; details on demand.
- Screen survey (read-only sub-agent, 2026-10-15): no screen creates a recipe (import only; recipe = preset of one of 7
  catalogue workflows). "재사용 스킬 만들기" is an icon-only composer button. Workflow panel is the heaviest first view
  (24+ category pills, per-row readiness/미시험/사용자 자료 badges, 7 geo rows then 326 upstream rows); Settings → Skills
  (long header paragraph, many badges/buttons per row) and TaskSetup (15–25 strings) are also heavy. Terms: terminology.csv
  makes "workflow" canonical and has no "레시피" entry; the same entity is "workflow"/"Geoscience 작업"/"Geo 작업"/"기반 작업",
  and `.geo-start.json` is both "레시피" and "workflow 시작 요청". The model is told nothing about workflows, recipes or
  geo-start/v1 (GEO_INSTRUCTIONS mentions skills once). Existing proposal `docs/design/source-authoring-agents.md`
  ("A beginner need not know whether the result is called a skill or a recipe") is relevant prior design.
- GAID facts that shape the trial: a recipe (`geo-start/v1`) can only point at a workflow already in the pinned catalogue
  (`server/src/geo/workspace/recipes.ts`); there is no local install path for a new `geo-workflow/v1` definition.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [부채 gaid-qwen-authoring-trial#1] 좁은 화면(390px)에서 작업 공간의 채팅 영역이 매우 좁아 확인 카드와 입력 버튼이 화면 밖으로 밀립니다 — 가) 좁은 화면 배치를 별도 UI 작업으로 고친다 — 나) 데스크톱 우선으로 두고 지원 범위에 명시한다 — 권장: 가) 확인 카드를 못 보면 실행이 멈춘 것처럼 보입니다 — 막힌 일: 휴대폰·좁은 창에서의 승인 — 조건: 앱 전체 배치 변경 — 근거: reports/2026-10-15-gaid-qwen-authoring-trial/index.md#33-수정-후에도-남은-것-r2
- [부채 gaid-qwen-authoring-trial#2] 화면 문구 약 54곳에 "Kady"·"K-Dense"가 남아 있고 앱과 에이전트를 가리키는 경우가 섞여 있습니다 — 가) 문구별로 GeoAIDesk/AI agent로 나눠 고친다 — 나) 그대로 둔다 — 권장: 가) 용어집의 "AI agent"와 제품명 규칙에 맞춥니다 — 막힌 일: 없음 — 조건: 문구별 판단 필요 — 근거: reports/2026-10-15-gaid-qwen-authoring-trial/index.md#33-수정-후에도-남은-것-r2
## Report
Report: reports/2026-10-15-gaid-qwen-authoring-trial/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
