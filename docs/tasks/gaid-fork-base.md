---
format: 1
status: done
updated: 2026-10-11T02:30:17Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"0c2ee874-5ddb-4118-9f20-209b6d8b615a","pid":3424104,"provider":"claude","session":"53669a44-52c3-4de7-84fd-3986e964ef40","start":"14946049","token":"204294a4c7b769cb17cdc00690c68a91f04cb61b74c54d3c345e6470c46afaf0"}
branch: task/gaid-fork-base
target: main
parent: 
---
# gaid-fork-base

## Goal and done criteria
Request from the starter:

# Writer brief: WP02 `gaid-fork-base` (geoaidesk)

This unit answers forwarded goal 96013b310a2c from the skill_hub project hub. The full forwarded request,
including the user's verbatim words, is in /home/seongin3/data/geoaidesk/work/hub/96013b310a2c.md — read it
first; it is the authoritative scope. Summary only:

- User decisions (verbatim): "2번 GeoAIDesk(약칭 GAID), 나머지는 권장방식으로 하자." and "구현 시작하자."
  Product name GeoAIDesk, short GAID; this repo (kigam-research/geoaidesk) is the separate public fork.
- Package WP02 `gaid-fork-base` (geo-byok-plan.md in kigam-research/skill_hub main d5b8d86):
  Goal: independently installable, attributed, release-oriented fork.
  Owns: fork registration/rules, `geo/distribution.json`, `geo/upstream.lock.json`,
  `geo/integration-boundaries.json`, launch wrappers, production-start seam, notices, release workflow,
  initial shared locks, app check wrapper.
  Done: clean installation opens the research workspace; production start/stop/restart preserves a project;
  excluded document extras are not auto-fetched; upstream checks are retained; user-data locations are
  distinct from the source checkout.
- Inputs: upstream base 44c52cee8e9fdc343c6132909769f49accf14a82 (main already has the backbone bootstrap
  commit 58389b87 on top); WP01 contracts in skill_hub main: docs/specs/gaid-{product,interfaces,migration}.md
  and schemas. Read the plan and contracts with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
  Relevant plan sections: "Main-session amendments", 2.1-2.7, 4.1-4.6, 7.1, WP02. Korean report:
  skill_hub reports/2026-10-11-geo-byok-plan/index.md.
- WP00 (design tokens + copy rules, skill_hub) is still running; its artifacts arrive later, so do not block
  on them.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under
  ~/data/geoaidesk/work/gaid-fork-base/, never inside the repo.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link
  (so WP03 can be sent next).

## Current state
Implementation done and checked (single writer, no child units). Branch saved at 31f94a8 + report/doc commit.
- Verified 2026-10-11: `scripts/check` all green without load (check-2.log: backend 1491 passed/11 skipped, 2 mzML
  tests skipped visibly; frontend 887; geo unit 11; start-gaid --check; production smoke PASS). check-1.log had 2
  frontend editor tests time out while a clean-clone smoke ran in parallel; 3/3 isolated reruns pass (load flake).
- Production smoke from a fresh GitHub clone of the branch (31f94a8): PASS in ~2 min (clean-clone-2/). Headless
  Chrome screenshot of the production UI from that clone: report figure 1.
- Run records: pc74:~/data/geoaidesk/work/gaid-fork-base/{smoke-1,smoke-2,clean-clone,clean-clone-2,check-*.log}.
- Re-verify safely: `node --test 'geo/tests/*.test.mjs'`; `GAID_SMOKE_DIR=<empty dir> node geo/tests/production-smoke.mjs`
  (free ports, temp data home; needs network for the first-start catalogue).

## Next steps
<!-- task:closed -->
Closed 2026-10-11T02:30:17Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-fork-base.md.

## Hand-offs (for the hub; not part of WP02 done criteria)
- WP03 gaid-runtime: stage the pinned geo catalogue archive (`geo/distribution.json` `catalogue` is `pending`); until
  then first start provisions the upstream K-Dense catalogue from `main` (auto-refresh off). Seam owners are in
  `geo/integration-boundaries.json`; the dependency locks pass to WP03 when it adds packages.
- WP07: UI branding/copy (header logo, "Brought to you by K-Dense", page title still upstream).
- WP10: Windows native / macOS runs of `start-gaid` (CI `gaid-checks.yml` runs `--check` on all three OS once on main).

## Plan (sequential; owned files)
1. Seams first (upstream edits, all narrow and env-gated so upstream dev behaviour is unchanged):
   - `start.mjs`: `--production` (build `web` when its build stamp changes, `next start` instead of `next dev`),
     product name / issues URL from env, `KADY_ENV_FILE` for the managed env file.
   - `server/src/env.ts`, `server/src/api/credentials.ts`: `KADY_ENV_FILE` (managed `.env` outside the checkout).
   - `server/src/config.ts`: catalogue extra sources filtered by `geo/distribution.json` `catalogue.excludedSources`.
2. GAID files: `geo/distribution.json`, `geo/upstream.lock.json`, `geo/integration-boundaries.json` (seam owners =
   initial shared locks), `geo/start.mjs` + `start-gaid.sh` / `start-gaid.cmd`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`,
   `docs/upstream-sync.md`, README fork header.
3. Release: replace upstream auto-release (would tag `v0.15.0` on every push to main of the fork) with a GAID
   tag-driven draft release (`geo-v<version>`) whose manifest is generated after build.
4. Checks: `geo/tests/*.test.mjs` (node:test, deterministic) + `geo/tests/production-smoke.mjs` (clean data home,
   start → create project → stop → restart → project still there, extras not fetched, data outside checkout), wired
   into `scripts/check`; upstream steps unchanged.
## Failed approaches
- Production install via upstream `npm install <pins>` rewrote server/package-lock.json under npm 11 (dirty release
  checkout, update conflicts) → production uses `npm ci`, gated by a lockfile+ABI stamp.
- First `task finish`: upstream test file-preview-panel "retains a.txt draft…" failed; pre-existing flake (unmodified
  main 3/6 full-suite runs fail on PC74; lazy editor import > default 1 s findByRole wait). Raised the wait to 4 s in
  that test (8/8 pass); recorded as a seam in geo/integration-boundaries.json.
- Build stamp included `web/next-env.d.ts`, which `next build` creates → fresh clones rebuilt on every restart.
  Excluded build-generated files.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- No child units: launcher/config seams are shared and small; split would only add integration cost.
- Production mode is a narrow `start.mjs --production` seam; `geo/start.mjs` sets env defaults and imports start.mjs.
- User data default `~/.geoaidesk` (`GAID_HOME`), separate from upstream `~/.kady`; `KADY_ENV_FILE` relocates the
  Settings-managed env file; the wrapper refuses data paths inside the checkout.
- Document-skill exclusion lives in the shipped manifest and is applied in config.ts for every launcher (dev too),
  since the license concern is the fork's use, not the launch mode. Manual installs stay possible.
- Upstream push-to-main release (would publish `v0.15.0` from the fork on merge) replaced by `geo-v*` tag → draft.
- Product version = `geo/distribution.json` version (0.1.0); update check reads the fork's `geo-v*` releases.
- UI branding left to WP07 (all visible strings go through its locale catalogues).
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [확인 gaid-fork-base#1] 공개 저장소 kigam-research/geoaidesk의 Issues 기능이 꺼져 있어 실행기 오류 메시지와 배포 설명서의 문제 신고 주소가 열리지 않습니다 — 가) 지금 Issues를 켠다 — 나) WP09/WP10에서 접수 양식을 들여올 때 켠다 — 권장: 가) 결정 D6(공개 이슈·PR)이 이미 내려졌고 안내 주소가 이미 쓰이고 있음 — 막힌 일: 없음(신고 경로만 비어 있음) — 근거: reports/2026-10-11-gaid-fork-base#5-한계
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-11-gaid-fork-base/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
