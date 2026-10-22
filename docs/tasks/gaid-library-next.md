---
format: 1
status: active
updated: 2026-10-22T04:48:14Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"db2f7129-57f9-4fa6-9097-90b13452fe46","pid":3154881,"provider":"claude","session":"cd9289a9-65a8-44df-8345-9053511b897a","start":"48141488","token":"2bdb9bbe3697d1aed3710ff379c4e9911149eb4cf734f8bc0d299d98901f9fa3"}
branch: task/gaid-library-next
target: main
parent: 
---
# gaid-library-next

## Goal and done criteria
Request from the starter:

# Request: gaid-library-next

User instruction (verbatim, 2026-10-21, to the geoaidesk hub): "남은 서재 관련항목 3건도 개선 작업 완료후 진행하자."
The improvement work (gaid-library-folders) completed 2026-10-21 (report reports/2026-10-21-gaid-library-folders/index.md),
so this unit starts now. Items recorded as answered with this unit as follow-up:
- gaid-research-hub#7 [확인] Does the agent find page-level evidence with the library tools and cite it in a real model chat?
  Option 가): check with the user's own chats. The user is the only tester; PC70 and PC74 can act as two researchers
  (user, 2026-10-21: "1단계를 시험할 연구자는 사용자 혼자로 충분하다. 그리고 이미 70, 74PC로 2명의 역할을 할 수 있다.").
  Prepare the test (real papers in a library folder, questions, what to look for), run what you can with the connected
  institute model, and hand the user a short checklist for their own chat check.
- gaid-research-hub#8 [부채] Literature skills (paper search, bibliography, literature review, Zotero) are missing from the
  distributed skill list. Option 가): put them into a new catalogue version (upstream literature skills absent in geo mode
  per reports/2026-10-21-gaid-research-hub §inventory: paper-lookup, citation-management, literature-review, pyzotero, …).
  Mind the Workflow model (docs/adr/2026-10-20-workflow-runtime-form.md) and the geo catalogue pin/verification.
- gaid-research-hub#9 [대기] Better BibTeX-dependent features (manuscript citations → Zotero collection, citekey pinning).
  Option 가): first re-check BBT's Zotero 10 compatibility and issues #3602/#3626 (use gh api; raw.githubusercontent.com is
  blocked); build only if resolved, otherwise record the state and leave it waiting.
Context: Windows is the usual researcher PC; colleagues use Zotero and EndNote, most keep PDFs in Windows Explorer folders.
Follow the design direction from gaid-design-identity (role variables only; no hard-coded colours/gradients/blur;
see ~/data/geoaidesk/work/hub/fded6f8b87d6.md) for any UI. Own GAID_HOME under ~/data/geoaidesk/work/gaid-library-next/;
do not modify ~/.geoaidesk. Outside check: no outside check (app work).

## Current state
- Plan (2026-10-21): three independent items, no child writers (each is small or tightly coupled to a running app).
  - #9 BBT: checked 2026-10-21 with gh api — latest release v9.0.71 (2026-10-07) still says "compatible with Zotero 8
    and Zotero 9 beta" (no Zotero 10 statement); #3602 (slows Zotero 10) and #3626 (CAYW empty on Zotero 10.0.6 /
    BBT 9.0.71) still open; no newer Zotero 10 issue since 10-08; last commits 10-17 (citeproc). Condition unmet →
    nothing built; item stays [대기] (re-recorded under Open items).
  - #8 literature skills: the catalogue archive is skill_hub's export (registry/byok/releases/<v>.yaml +
    web/scripts/export-byok.ts). Request bbaae80a7640 sent to the skill_hub hub (2026-10-21) for release 0.3.0 =
    0.2.1 + k-dense/{paper-lookup,citation-management,literature-review,pyzotero} from the pinned K-Dense commit
    92ace75a (request text: ~/data/geoaidesk/work/gaid-library-next/skill_hub-request.md). GAID side after the asset
    arrives: repin geo/distribution.json + configs/inputs.toml (version, sha256, manifest_sha256, size_bytes, download
    URL), update geo-catalogue tests that name 0.2.x/13 skills, provisioning adds new skills once per pinned label
    (pyzotero lands disabled: DEFAULT_DISABLED_SKILLS), publish the release asset with geo/catalogue-release.mjs.
  - #7 real chat check: own instance `gaid-library-next-app` (systemd user unit, ports 3330/18330,
    GAID_HOME ~/data/geoaidesk/work/gaid-library-next/home, kigam-qwen provider copied from gaid-note-style's
    models.json). Real papers in ~/data/geoaidesk/work/gaid-library-next/papers/ (Ploton 2020 Nat Commun CC-BY,
    Valavi blockCV bioRxiv 2018, Meyer & Pebesma AOA arXiv 2005.07939) + asset authoring_preview_paper (user's MPM R3
    manuscript). Put them in a library folder, attach to a project, ask page-evidence questions with institute Qwen,
    check library_* tool calls, `[@key, p. N]` citations against the PDF pages, note citation check; then a short
    checklist for the user's own chats.
  - #7 done (2026-10-21): 4 real papers seeded (bin/seed-library.mjs), session 01a15eed; q1 40 tool calls, q2 23; 34/34
    checked page citations found on the cited page (pdftotext pages); Roberts 2017 (not in library) → no fake key,
    web AAM cited by line numbers; note references resolve (4 keys; roberts2017 not in library). One wrong inference
    (inner vs outer folds both spatial). UI gaps (not fixed, optional): chat citations not clickable, wide tables clip
    the last column. Report draft reports/2026-10-21-gaid-library-next/index.md (§3.3 and checks pending).
  - #8 (2026-10-22, user correction: "gaid-catalogue-0-3-0 작업을 왜 skill_hub 워크스페이스에 물어보는 것인가? 이제 GAID
    허브와 시스템은 본 워크스페이스에서 모두 작업하고 있다. 잘못된 지침이 남아 있는 것인가?"): skill_hub request withdrawn
    (e50e5d58661c; skill_hub hub confirmed nothing made). Catalogue now built in GAID: ADR
    docs/adr/2026-10-22-gaid-builds-catalogue.md, geo/catalogue-build.mjs, geo/catalogue-src/ (release 0.3.0, 4 Korean
    profiles, sources.lock), rebuild test geo/tests/catalogue-build.test.mjs. 0.3.0 built at 64e2f756 (sha256 d09d5311…6598),
    asset ~/assets/geo-catalogue/0.3.0 (MANIFEST b39fd31e…), pinned in geo/distribution.json + configs/inputs.toml (b2954bbd).
    First 0.3.0 build (aff9f649, never published) had pyzotero ">=1.15.2,<1.16" → GET /geo/environments 500; fixed to lower
    bound, builder + server test now check packageSpec; rebuilt same version. Instance: existing project +4 skills, new
    project 3 enabled + pyzotero disabled, 19 exposed, start prompt ~26.4k tokens; geo-literature prepare OK (requests
    2.34.2, pyzotero 1.16.0); Qwen paper-lookup chat (session 01a161e9) read the skill first, 7 services, counts verified
    (Crossref 824, OpenAlex 896). Found: running a skill script creates __pycache__ → skill counted as edited → later
    catalogue updates skip it (pre-existing skills-sync behaviour; recorded as 부채).
## Next steps
1. scripts/check (unit gaid-library-next-check, log ~/data/geoaidesk/work/gaid-library-next/check.log) → humanizer on the
   report → review-copy → ask the user about publishing release geo-catalogue-0.3.0 (catalogue-release.mjs --publish;
   outward, needs the user's answer) → publish + --verify-remote → task finish.
   Done 2026-10-22: humanizer + review-copy; scripts/check running (systemd unit gaid-library-next-check).
Blocked: waiting for the user's answer on publishing release geo-catalogue-0.3.0 (asked in the writer tab 2026-10-22) and for scripts/check to exit.
## Failed approaches
## Notes and decisions
Closes: gaid-research-hub#7
Closes: gaid-research-hub#9
Closes: gaid-research-hub#8
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [확인] 사용자 본인 논문·질문으로 실제 채팅에서 쪽 인용을 확인 — 가) 보고서 3.2절 체크리스트로 확인 — 나) 확인 생략 — 권장: 가) 시험은 공개 논문과 원고 하나, 질문 둘이었음 — 막힌 일: 근거 답변 기능의 완료 판단 — 근거: reports/2026-10-21-gaid-library-next#3.2
- [결정] 카탈로그 0.3.0 파일을 GitHub 릴리스(시험판 geo-catalogue-0.3.0)로 공개할지 — 가) 지금 공개 — 나) 공개하지 않음 — 권장: 가) 고정값이 0.3.0을 가리켜 공개하지 않으면 다른 PC 새 설치에서 카탈로그 스킬이 빠짐 — 막힌 일: 다른 PC의 0.3.0 설치 — 근거: reports/2026-10-21-gaid-library-next#6
- [부채] 스크립트를 실행한 카탈로그 스킬이 __pycache__ 때문에 "고친 스킬"로 잡혀 다음 카탈로그 판에서 바뀌지 않음 — 가) 스킬 동기화의 트리 해시에서 캐시 폴더를 빼는 작은 작업 — 나) 그대로 둠 — 권장: 가) 스크립트가 있는 스킬은 첫 실행 뒤 업데이트가 멈춤 — 막힌 일: 카탈로그 스킬 업데이트 — 근거: reports/2026-10-21-gaid-library-next#3.3
- [대기] Better BibTeX 기능(원고 인용으로 Zotero 컬렉션, 인용 키 고정) — 가) Zotero 10 호환이 명시되고 #3602·#3626이 닫힌 뒤 검토 — 나) 지금 시험 — 권장: 가) 2026-10-21 재확인에서도 조건 그대로 — 막힌 일: 해당 기능 — 조건: BBT가 Zotero 10 호환을 명시 — 근거: reports/2026-10-21-gaid-library-next#3.4
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-21-gaid-library-next/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
