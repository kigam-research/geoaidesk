---
format: 1
status: active
updated: 2026-10-11T11:00:45Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"dd92b59d-5d21-4c94-a719-5bfb201dd6bd","pid":976479,"provider":"claude","session":"b8a248da-4217-409e-9ef6-b7a845d8cd98","start":"17161315","token":"755162dc1445543293b14cc570ff1c499e9d6d77636aaecc6688a83b01392fa6"}
branch: task/gaid-release-proof
target: main
parent: 
---
# gaid-release-proof

## Goal and done criteria
Request from the starter:

# Writer brief: WP10 `gaid-release-proof` (geoaidesk)

This unit answers forwarded goal 74dde3d16e8f from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, inputs and approval boundaries, is in
/home/seongin3/data/geoaidesk/work/hub/74dde3d16e8f.md — read it first; it is the authoritative scope (goal, owned files,
done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main (882cd56 or later) contains WP02, WP03 + gaid-runtime-followups, WP04, WP05 and WP07 (6d2d290); reports
  under reports/2026-10-11-*/index.md. No other geoaidesk unit is running.
- Answered items that this unit carries (geoaidesk docs/open-items/closed/gaid-runtime.md):
  gaid-runtime#1 가) — test 64K and 98K local contexts on real tasks; gaid-runtime#2 가) — publish the catalogue archive on
  the geoaidesk GitHub Release and let the app download it pinned by hash. Pin skill_hub catalogue 0.2.1
  (sha256 e9f506068a4cb2e0b2f207ccc2db760db7641e624fa08ba729604421c6ef55f5; artifact
  pc74:~/data/skill_hub/work/gaid-catalogue-proof/0.2.1/; register it as an asset per AGENTS.md / configs/inputs.toml).
- WP07 noted that the vendored GAID brand assets (geo/brand/README) still lack institutional branding clearance for public
  release. Raise it with the user in the writer tab before any public release; do not decide it yourself.
- Approval boundaries from the request: ask the user in your tab before any paid/subscription model run (personal API,
  ChatGPT sign-in) and before publishing a public GitHub Release.
- skill_hub WP09 gaid-contributions and WP08 are still running; import WP09 public intake templates when they land on
  skill_hub main (ask the geoaidesk hub if blocked on them).
- Writer setup by the user's choice ("현재 수행중인 작업까지만 astra fast로 작업 후 다시 기존대로 opus 5.5 오케스트레이터에
  gpt 6.1 sol high 워커로 작업하는 방식으로 진행하자."): you are the Claude top-level orchestrator; child writers and
  delegated workers use the Paseo profile "general work" (gpt-6.1-sol high) at normal speed.
- skill_hub files: `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- `task job run` works in this repo (backbone 0031581 exempts `.env.example`); use it for runs to keep (install/update
  trials, model-route runs).
- Other hosts: `ssh pc71` (PC71 WSL), `ssh pc71-win` (PC71 Windows), `ssh pc70`; use them only as needed for the advertised
  environments (Linux/WSL first, Windows native P1, macOS untested).
- Checks: `scripts/check`. App data under ~/data/geoaidesk/work/gaid-release-proof/, never inside the repo. After your last
  check, remove regenerable build caches from the worktree (server/node_modules, server/src/helpers/.venv,
  web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__) so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link (WP11 follows).

## Current state
- 2026-10-11: catalogue 0.2.1 copied unchanged into asset pc74:~/assets/geo-catalogue/0.2.1/ (ASSET.md, MANIFEST.sha256
  sha256 9ac82d84…ee48; `cd ~/assets/geo-catalogue/0.2.1 && sha256sum --check MANIFEST.sha256`).
- d5702af: distribution pins catalogue 0.2.1 with `download.url`; launcher download (geo/start.mjs `planCatalogue`,
  `downloadCatalogue`, tests in geo/tests/start.test.mjs); `/version/latest` picks the highest `geo-v*` release
  (`pickLatestRelease`, server/test/geo-distribution.test.ts); harness geo/release-proof/instance.mjs + README.
- b72725d: geo/catalogue-release.mjs (check/publish/verify-remote of the catalogue release; not published), release
  manifest names the download URL, geo/compatibility.json (all not-run/untested so far) + geo/tests/compatibility.test.mjs.
- Child install integrated (e87dbc3, closed): Linux (PC74) install + update 882cd56→d5702af PASSED, PC71 WSL install +
  update PASSED, PC71 Windows native install FAILED (backend stopped right after the readiness probe during a
  scheduled-task first start; prep printed "skills download skipped/failed"). Records/sha256 in the child's task doc
  (docs/tasks/gaid-release-proof--install.md). Two harness-bug update jobs disposed as superseded by job 4.
- Windows diagnosis (writer, 2026-10-11): from an ssh session the launcher starts fine on the same checkout with an
  ASCII and with a "diag home 한글" data home; the original backend exit did not reproduce. Prep hit
  `EPERM rename …skill-sync-staging\<skill>.new-… -> .pi\skills\<skill>` (transient Windows lock after cpSync) →
  fix 8b977c1: server/src/geo/rename-retry.ts used by skills-sync.ts directory renames (seam recorded).
- Provider terms re-check (ChatGPT Pro research, 2026-10-11; answer ~/data/geoaidesk/work/gaid-release-proof/
  oracle-provider-terms-harvest.md): SIWC OSS flow is official for local OSS apps; terms (2026-09-29) say "Use your app's
  own name during sign-in and activation"; Pi sends agent_name_hint=Pi → fix 8b977c1 rewrites the hint to the product name
  (server/src/geo/siwc.ts, provider-auth.ts seam). Anthropic: legal page "does not permit third-party developers to offer
  Claude.ai login into their own applications"; Pi's Anthropic login uses Claude Code's client id → do not advertise
  (written provider answer needed to change that). Copilot: Pi reuses VS Code's GitHub app id; only the official SDK
  route is documented → do not advertise. Gemini CLI OAuth reuse prohibited (Pi has no such login).
- Windows rerun at d2c535f: scheduled task GAID-Proof2-20261011 on pc71-win runs install-proof then update-proof
  (out C:\Users\KIGAM_Ahn\gaid-proof\windows-{install,update}-2, status proof2-status.txt, logs proof2-*.log).
- Windows root cause (2026-10-11): reruns at d2c535f failed the same way from a scheduled task AND from an
  interactive ssh session (fresh clone, data home "GAID home 한글"); second starts and ASCII data homes pass. Isolated
  on pc71-win: Node 24.13 `fs.rmSync` (any), recursive `fs.rmdirSync` and `fs.cpSync`, and Node 22.21 `fs.cpSync`, kill
  the process (0xC0000409 / 0xC0000005, no JS error) when a path has non-ASCII characters; primitives and async
  fs.cp/fs.rm work. A Korean Windows user name puts the default data home on such a path. Fix 616113d:
  geo/win-fs-shim.mjs (JS rmSync/cpSync/rmdirSync for non-ASCII paths on win32 only), loaded by geo/start.mjs in-process
  and via NODE_OPTIONS --import for every child; verified on pc71-win for Node 24.13 and 22.21. Windows install proof
  rerun at 616113d: out C:\Users\KIGAM_Ahn\gaid-proof\windows-install-4, local log
  ~/data/geoaidesk/work/gaid-release-proof/windows-install-4.log.
- Routes child integrated (closed): 4 local records; jobs 1–3 exit 1 = partial task outcomes by the record contract
  (evidence, not harness failures; no disposition). geo/compatibility.json, docs/geo/compatibility.md, local-model
  profile/copy (localModel.recorded/compact64/evidence) and docs/local-models-ollama.md updated from them.
- scripts/check job 1 (tree 41b789e; receipt ~/data/geoaidesk/runs/gaid-release-proof-20261011T104757.348242Z) exit 1:
  backend 153 files passed (2 known mzML tests skipped by the network probe), web 1 failed — card.test.tsx still
  looked for the old local-model copy "CPU 오프로딩 약 18%"; test updated to the new string. Rerun pending.
- Network: GitHub release downloads (release-assets.githubusercontent.com) work from PC74; raw.githubusercontent.com is blocked.

## Plan (orchestration)
Sequential decisions (writer):
1. Catalogue pin 0.2.1 + download contract (gaid-runtime#2 가): `geo/distribution.json` `catalogue` → 0.2.1 with
   `download.url` = asset on a dedicated geoaidesk release `geo-catalogue-0.2.1` (prerelease, so it never becomes the
   app's "latest"); the launcher (`geo/start.mjs`) downloads into `<GAID_HOME>/catalogue/` only when no candidate
   location has the archive, verifies sha256, atomic rename. `GAID_CATALOGUE_URL` overrides the URL (tests, mirrors),
   `GAID_CATALOGUE_DOWNLOAD=0` disables it. catalogue.ts stays network-free.
2. Update check: `/version/latest` uses `/releases/latest`, which skips prereleases; the preview channel publishes
   prereleases, so pick the highest `geo-v*` tag from the release list instead (writer).
3. Shared harness `geo/release-proof/instance.mjs` (start/stop a GAID checkout with its own data home and ports, API
   helper) — writer, before children start.
4. Evidence formats: `gaid-install-evidence/v1`, `gaid-route-evidence/v1` (JSON under ~/data/geoaidesk/work/gaid-release-proof/
   or a job output); `geo/compatibility.json` (`gaid-compatibility/v1`) is written by the writer from them, with the
   plan §2.7 route fields.
Independent packages:
- child `install` (general work): `geo/release-proof/{install,update}-proof.mjs` + runs on PC74 Linux, PC71 WSL,
  PC71 Windows native. Owns `geo/release-proof/install-*`, `update-*`, its fixtures.
- child `routes` (general work): `geo/release-proof/route-trial.mjs` + local Ollama 64K/98K LAS and map+table runs on
  PC74. Owns `geo/release-proof/route-*`. Paid routes are designed, run only after the user asks.
Writer: catalogue/launcher/update-check, `geo/compatibility.json` + test, `docs/geo/` guides (install, routes,
update/rollback/remove), upstream integration log, release workflow (catalogue release asset), WP09 template import
when it lands, report. Integration order: writer interfaces → children → compatibility.json/docs → checks → report.
User decisions in this tab: brand clearance (geo/brand), paid runs (API, ChatGPT sign-in), publishing the catalogue
release and the app release.

## Workers
- `gaid-release-proof--install` (closed 2026-10-11; general work, writer d710da92, worktree ~/worktrees/geoaidesk/gaid-release-proof--install),
  brief ~/data/geoaidesk/work/gaid-release-proof/prompts/install.md; started 2026-10-11 from d5702af.
- `gaid-release-proof--routes` (general work, writer 9b44cd61, worktree ~/worktrees/geoaidesk/gaid-release-proof--routes),
  brief ~/data/geoaidesk/work/gaid-release-proof/prompts/routes.md; started 2026-10-11 from d5702af.
On a child's finish: `task complete gaid-release-proof--<child>`.

## Next steps
1. Writer: catalogue release script + workflow, `geo/compatibility.json` + test, `docs/geo/` guides, upstream log,
   provider-terms re-check, mzML test failures (seen in a full vitest run at d5702af: massspec-helper, sci-helper-errors;
   check whether they also fail on main), then ask the user: brand clearance, paid runs, publication.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [결정] 로고(GAID 브랜드 이미지)의 기관 공개 승인 — 가) 승인 받음, 공개 릴리스에 그대로 사용 — 나) 미승인, 앱 릴리스는 GitHub 초안까지만 만들고 공개는 승인 뒤 — 다) 미승인, 로고 없이 글자 표기로 공개 — 권장: 나) 공개 전 승인이 필요하다는 기록(geo/brand) — 막힌 일: 앱 릴리스 공개 — 근거: reports/2026-10-11-gaid-release-proof#6-결정할-일
- [결정] 카탈로그 아카이브 0.2.1 공개(geoaidesk 릴리스 geo-catalogue-0.2.1, 시험판) — 가) 지금 공개하고 새 설치의 실제 내려받기까지 시험 — 나) 앱 릴리스 공개 때 함께 공개 — 권장: 가) 아카이브에는 스킬과 라이선스 고지만 있고 로고가 없음 — 막힌 일: 새 공개 설치의 카탈로그 스킬 설치 — 근거: reports/2026-10-11-gaid-release-proof#6-결정할-일
- [결정] 유료·구독 모델 경로 시험(D4) — 가) 개인 API 키와 ChatGPT 로그인 모두 — 나) API 키만 — 다) ChatGPT 로그인만 — 라) 이번 출시는 미시험으로 표기 — 권장: 가) D4가 출시 전 두 경로 시험을 정함 — 막힌 일: API·구독 경로 안내 — 근거: reports/2026-10-11-gaid-release-proof#6-결정할-일
- [결정] 로컬 모델 경로의 안내 방식 — 가) 지원으로 안내하지 않고 시험 결과와 한계만 공개 — 나) 98K 지도·면적표 과제에 한해 시험된 조합으로 안내 — 권장: 가) 4건 중 1건만 기준 통과 — 막힌 일: C 사이트·설치 안내의 로컬 모델 문구 — 근거: reports/2026-10-11-gaid-release-proof#6-결정할-일
## Report
Report: reports/2026-10-11-gaid-release-proof/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof-20261011T104757.348242Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-release-proof-20261011T105926.584146Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
