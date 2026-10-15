---
format: 1
status: active
updated: 2026-10-15T06:19:50Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"f7b1833c-ee21-47b2-a47b-733efe41ebb6","pid":862022,"provider":"codex","session":"01a13e25-78e0-77d0-977c-0bc65868bd1b","start":"51000600","token":"6331bb98ad7a5d6a212beb6348c7759bb7f33b032b95f02ab23b0254d2b27553"}
branch: task/gaid-improve
target: main
parent: 
---
# gaid-improve

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-improve` (geoaidesk) — standing session for GAID improvements

## User words (verbatim, Korean, 2026-10-15, geoaidesk hub)
> "GAID개선 작업을 수행하려고 한다. 우선 현재까지 최신 현황을 파악해두고 사용자의 지시를 기다리는 작업트리 세션을 생성해두자.
> 해당 세션은 gpt 6 astra ultrahigh fast 모드로 켜두자."
Writer setup chosen by the user: Codex gpt-6-astra, thinking "ultra" (the user picked "ultra" when asked what "ultrahigh"
means), fast mode (service_tier priority). Keep fast and this thinking level through resume and handoff.

## What to do now
1. Get the current state of GAID and record it briefly in docs/tasks/gaid-improve.md (no report, no code changes):
   - geoaidesk main (latest commit), merged work packages and units: reports/*/index.md (newest:
     reports/2026-10-14-gaid-qwen-followups, 2026-10-14-gaid-kigam-qwen-trial, 2026-10-13-gaid-ui-locale,
     2026-10-12-gaid-workflow-catalog, 2026-10-12-gaid-map-table-ux, 2026-10-12-gaid-map-tiles, 2026-10-11-*), AGENTS.md
     GeoAIDesk section, docs/open-items/ (currently no open items), geo/compatibility.json, docs/geo/.
   - Known external states (hub-verified): skill_hub new GAID site has "GAID에서 설치" pages but public publication waits
     for institutional brand approval (skill_hub report reports/2026-10-12-gaid-site-cutover); app release geo-v0.1.0 is a
     GitHub draft for the same reason. KIGAM internal Qwen server http://10.13.15.67:8000/v1 works (see the trial reports).
   - The user's review instance: unit `gaid-review` from ~/deploy/geoaidesk (main 81b620b), ports 3000/18000, data
     ~/.geoaidesk, custom provider `kigam-qwen` registered (reasoning levels low/medium/xhigh). The user uses it from PC71
     through `ssh -N -L 3000:localhost:3000 -L 18000:localhost:18000 pc74`. Read-only for you: do not stop or modify it;
     the hub updates it after merges.
2. Then wait for the user's instructions in this tab. Summarize the state to the user in Korean (합니다체) in a few lines
   and ask what to improve. Do not start changes before the user says so.

## Rules
- Follow the worktree's AGENTS.md. Child writers/workers, if needed later, use the "general work" profile at normal speed
  unless the user says otherwise. No paid model runs unless the user asks. Checks: scripts/check when code changes.
- Unrelated new goals go to the hub with `task hub --send`.

## Scope update: researcher ecosystem design (2026-10-15)

User request (verbatim):

> 사용자의 GAID와 Skill_hub의 구축 목표는 https://data.kigam.re.kr/ 과 동등한 수준의 지구과학 연구용 에이전트 프레임워크를 구축하고 싶은 것이다. 현재 구축한 시스템들은 비교적 목표를 도달하려고 했지만 여전히 신규 유입된 사람들과 코딩을 잘하는 연구자들의 입장에서 보았을 때에도 큰 이점이 없다고 생각한다. 현재 skill_hub는 스킬 및 워크플로우 레시피 제공 허브 플랫폼으로 수정개선되어야 할 필요가 있으며, GAID 시스템도 Workflow 기능이 UI/UX적으로 잘 활용될 수 있게 전면 수정될 필요가 있다고 생각한다. 단순한 채팅 에이전트 플랫폼의 경우에는 시간이 지날 수록 native codex, claude cli 시스템보다 나은점이 없어질 것이며, 현재 대시보드 시스템에서도 전반적으로 에이전트가 생각하는 방식의 디자인이다. 예를 들어서 GAID의 연구노트 시스템에서도 취지는 좋지만 보고된 근거, 결과파일 확인, SHA 대조 등과 같이 에이전트가 작업하기에 중요한 요소 위주로 노출되고 있으며, 사람 연구자가 중요하게 생각하는 결론이나 연구작업을 어떤 요청에 따라 어떤 흐름으로 수행했고, 어떤 결과가 나왔으며, 개선이나 제안점 또는 한계점, 더 나은 조사 방법, 관련 인터넷 자료, 논문 자료 등을 제공하는 방식과 같이 사람 연구자가 중요하게 생각하는 요소들이 연구노트에 정리되어야 한다. 그리고 시스템에 글자가 너무 많으며, 폰트도 작고 사람 연구자가 어디에 집중해야 할지도 불분명해진다. 사용자의 최종 목표는 https://data.kigam.re.kr/ 과 동등한 수준의 지구과학 연구용 에이전트 프레임워크를 구축하는 것이며, 연구자들이 해당 플랫폼에서 본인들의 연구 작업물들, 출판한 논문을 기반으로 스킬이나 워크플로우형 레시피를 작성하고 이것이 공유되는 생태계를 조성하여 KIGAM의 인공지능 생태계이자 기관 Second brain과 같은 역할을 하게 하고 싶다. 이러한 관점에서 연구자들이 유입될 수 있는 매력적인 기능 요소들이 있어야 하며, 연구자들은 코딩에 익숙하지 않기 때문에 스킬이나 워크플로우 레시피를 생성할 때 너무 많은 입력을 요구하게 해서는 안되며, 오히려 관련 문서나 본인들의 논문을 첨부하면, 에이전트가 분석 후 해당 문헌이나 자료들로부터 연구자와 함께 스킬 또는 워크플로우를 레시피를 생성할 수 있게 하는 필수 질문과 응답을 받아서 자동으로 생성해주는 기능도 필요하다. 에이전트는 확률적인 모델이므로 이를 위한 기반 코드와 시스템은 갖추어야 구현 가능할 것이라 판단한다. 사용자의 요청에 대해 심도있게 추론한 후에 현재 시스템의 현황과 어떤 방식으로 수정개선해나가고 추가적으로 어떤 것을 구현해야하는지를 함께 논의하고 작업해나가자.

Current phase: evidence-backed product/architecture discussion. Deliver a concrete assessment, proposed researcher journeys, reusable foundations versus missing contracts/services, and phased implementation options. Do not treat the broad ecosystem vision as an instruction to silently replace both products or publish anything. No product code edits or review-instance changes in this phase; skill_hub inspection is read-only. Keep this task open for the discussion and agreed implementation.

## Current state
- Resumed on 2026-10-15 in `/home/seongin3/worktrees/geoaidesk/gaid-improve`; initial worktree clean.
- Fetched `origin/main`: `81b620bb827788bbf51e3a1bbdde3eda83a4b24f` (Qwen decision ledger closure). The review deployment's HEAD matches it. This branch differs from main only in this task document. No app code, user data, services, or model settings changed; no inference or automated checks run for this orientation.
- Baseline: GAID 0.1.0 preview, pinned geo catalogue 0.2.1 (13 skills), production launcher with external user data; geo inspection/context/environment support, LAS depth and table checks, vector/raster maps and result adapters, Korean workspace/workflow setup, saved recipes and skill_hub package installation are merged. Evidence: AGENTS.md GeoAIDesk section and reports dated 2026-10-11/12.
- Later merged units: map tiles/basemaps/Markdown image hints (`dc2b80c`), map/table interaction (`a8fe765`), unified workflow catalogue (`1826fce`), full Korean/English UI (`06c488a`), institution Qwen trials (`6ba34e3`), and project provisioning + accepted reasoning levels (`69b6ab5`). See the matching reports/2026-10-12-*, reports/2026-10-13-gaid-ui-locale, and reports/2026-10-14-*.
- Domain boundaries retained: display tiles/reduced LAS windows are not analysis inputs; polygon area sums do not dissolve overlaps; paged vector sorting/filtering covers only the loaded page; table checks do not convert units or replace censored values. LAS supports bounded LAS 2.0 numerical data, not LAS 3/LiDAR/desurveying. Evidence: `docs/geo/well-tables.md`, `docs/geo/basemaps.md`, and the map/map-table reports. Native reader reconciled older limits with later tile/runtime/locale work; old reports are historical snapshots.
- Latest model evidence (2026-10-14, `geo/compatibility.json` and `reports/2026-10-14-gaid-qwen-followups/index.md`): institution Qwen passed map/area and LAS QC at 239/268 seconds; custom-server accepted levels are low/medium/xhigh, with high → medium and minimal → low visible in the UI. Local Qwen 30B 64K passed both tasks; 98K passed map but failed LAS at the 45-minute cap after repeated 100-line reads. These are single-run, bounded task checks, not validated scientific findings or performance guarantees; no re-trial in this unit.
- UI language follows one saved choice; reply language follows user instructions/request. The 326 upstream workflow prompt bodies remain English by the accepted decision `gaid-ui-locale#1`. Server errors, source content and embedded Office menus remain untranslated. Skills Settings still includes inherited wording inconsistent with GAID's pinned catalogue (`reports/2026-10-13-gaid-ui-locale/index.md`, section 5); no correction authorized yet.
- Compatibility records report install/update passes for native Linux, WSL2 and native Windows; macOS remains untested. Paid/subscription release-proof routes remain untested in the manifest (separate MiniMax reply-language probes are not release-proof coverage). Do not infer current guarantees from dated records.
- Ledger correction to the brief: `docs/open-items/gaid-release-proof.md` still contains #1 (model-route trials) and #2 (brand approval before app release). #1's 2026-10-11 Qwen-offline condition is stale after the later trials. The UI-language choice and both institution-Qwen decisions are closed. This writer did not edit the hub-owned ledger.
- Hub-verified external state, not rechecked remotely: the new skill_hub GAID install pages and app release `geo-v0.1.0` await institutional brand approval; the app release is a draft. Review instance `gaid-review`: `~/deploy/geoaidesk`, ports 3000/18000, data `~/.geoaidesk`, `kigam-qwen` configured with low/medium/xhigh. PC71 access: `ssh -N -L 3000:localhost:3000 -L 18000:localhost:18000 pc74`. It remains read-only to this writer; the hub owns updates.
- Safe re-verification: `git fetch origin main`; `git log -1 origin/main`; `git diff --name-only origin/main`; `git -C /home/seongin3/deploy/geoaidesk rev-parse HEAD`; reread the named reports, `geo/compatibility.json`, `docs/geo/`, and `docs/open-items/` (including closed decisions). Do not restart services or repeat recorded jobs.
## Next steps
1. Inspect the reference portal and current GAID/skill_hub user journeys and contracts, then synthesize the researcher-first redesign proposal.
2. Present the proposed first end-to-end slice and the few scope decisions that change architecture; continue design with the user's answers. Do not close the standing unit during this discussion.
3. Once implementation scope/interfaces are settled, use isolated CLI child writer units for independent packages, route skill_hub implementation to its hub, and run `scripts/check` for code changes.
## Failed approaches
None.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- Orientation sequence: confirm the checkout and instructions → inspect current main and recent Qwen/UI reports → reconcile an independent read-only summary of earlier packages and geo docs → checkpoint the baseline → wait for the user.
- Ownership: the parent is the sole writer of `docs/tasks/gaid-improve.md`. A native reader may inspect existing reports/docs only and return evidence; no child writer is needed for this documentation-only orientation. Integrate its findings into this document after checking them against main and newer reports.
- Reader: `/root/baseline_reader` completed its read-only review of earlier merged packages and `docs/geo/`; findings integrated above. No child writer units or running jobs remain.
- Design phase sequence: distinguish product roles and terms → independently audit notebook, workflow execution, and skill_hub → compare public reference/primary-source prior art → integrate current-versus-proposed journeys and execution contracts → discuss the first slice. Parent owns this task document and the canonical design report; readers own no files/interfaces.
- Active read-only readers: `/root/baseline_reader` (notebook/research records), `/root/workflow_audit` (workflow/recipe contracts), `/root/skillhub_audit` (other repo, read-only). No child writers. Oracle research may run as a recorded job; do not repeat it after interruption.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
None: the starter explicitly requested a brief task-document baseline, no report and no code changes.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
