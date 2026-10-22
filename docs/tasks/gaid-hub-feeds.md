---
format: 1
status: active
updated: 2026-10-22T15:09:06Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"ae22402c-3c23-4d4f-a3f2-53a34a33fd4e","pid":2316190,"provider":"claude","session":"a84ff37e-f54b-47e9-b216-7e2a5ce01bc0","start":"56712264","token":"2910bef256a9caa5c7498bb6d9647f32045f60a92a90aded98a1e4fdbf68e513"}
branch: task/gaid-hub-feeds
target: main
parent: 
---
# gaid-hub-feeds

## Goal and done criteria
Request from the starter:

# Goal: gaid-hub-feeds — curated information feeds in the GAID hub

## User request (verbatim)

First message:
> 사용자는 GAID 허브와 관련해서 이제 스킬 정보 제공 시스템을 추가해두고 싶다. Geeknews나 github에서 상위 도구들에 대한 정보를 제공하고, geoscience와 관련되어 유용한 스킬이나 nature지에 등재된 정보나 권위있는 blog 정보들을 제공해주는 기능을 만들고 싶다. 가능할까?

Decision after the hub's proposal:
> 1번 관리자 승인방식, 원문제목과 피드요약만, 첫목록도 권장하는 각 지구과학 분야로 10개를 스스로 선정하여라. 따로 먼저하자. opus 5.5 high fast writer로 진행하자.

Meaning of the decisions (they answer the hub's four questions):
1. Sources: only sources an administrator approved are read (관리자 승인 방식). Researchers do not add sources.
2. No AI summary: show the original title and the feed's own summary only (원문 제목과 피드 요약만). No model calls.
3. Initial source list: the writer selects 10 authoritative sources itself, spread across geoscience fields
   (for example geology, geophysics, hydrology, climate/atmosphere, remote sensing/GIS, natural hazards, ocean,
   mineral/energy resources), plus the tool/skill sources the user named (GeekNews, GitHub). Record why each was
   chosen and verify each feed is reachable from PC74.
4. Order: run this separately, before gaid-hub-skills-2 (따로 먼저).

## Hub proposal the user accepted (verified facts, 2026-10-22, from PC74)

- Reachable feeds: GeekNews Atom `https://news.hada.io/rss/news`; Nature `https://www.nature.com/nature.rss`
  and Nature Geoscience `https://www.nature.com/ngeo.rss` (RSS 1.0/RDF); AGU Eos `https://eos.org/feed` (RSS 2.0).
- GitHub via `gh api` works (search, releases). Counts: `topic:agent-skills` 35,574 repos; `agent-skills geospatial`
  45; `claude skills gis` 29; `SKILL.md geoscience` 0 — geoscience skills need administrator curation, automatic
  search alone is not enough.
- Proposed shape: the institute hub server (gaid-backend, `server/src/geo/hub-server/`, no agent) fetches the
  approved sources on a schedule and keyword-classifies; GAIDs show the items in a new place inside the GAID hub
  (for example tool news, skills, papers, blogs) with source and fetch time and an "automatically collected, not
  reviewed" label. GitHub skill items link into the existing install path (Settings → Skills preview +
  acknowledgement gate); never auto-install. Show title, the feed's short summary and the link only; never copy
  Nature full text or whole GeekNews posts. Without a hub server, decide (and record) what a local GAID shows.
- Upstream tools to track by release: Pi, pi-subagents, pi-web-access, skills CLI, Claude Code, Codex (adjust if
  the writer finds better identifiers).

## Notes for the writer

- KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` or
  codeload.github.com.
- Follow the repo's AGENTS.md: UI guide v2 and copy rules (locales, geo/copy), boundaries file before editing
  upstream files, bounded server-side fetches (see `server/src/geo/authoring/url-sources.ts`), hub-server
  migrations and e2e test patterns.
- Outside check: none (not a research goal).
- Done: the user's outcome above plus the repo checks (`scripts/check`). Anything beyond that is "Optional".

## Current state
- Integrated: child gaid-hub-feeds--server completed and closed (hub server: migration 3, feeds/{sources,parse,fetch,store,
  schedule}.ts, routes, CLI `feeds list|approve|stop|fetch`, operator guide; 2 live receipts in ~/data/geoaidesk/runs/).
- Parent: GAID proxies (`/geo/hub/feeds`, `/geo/hub-server/admin/feeds/*`, 10-min timeout for collect-now), web 자료 소식 place
  (`#hub/feeds`, sidebar group, filters, GitHub skill handoff), admin "자료 소식 출처" tab, locales hubFeeds, AGENTS.md section.
- Integration fixes: shared FEED_LIMITS.perSourceUnfiltered; `feed_items.sort_at` (undated items of a source's first
  collection sort below dated ones, later undated items by first collection time; migration 3 is unreleased, edited in place);
  skills-panel reads a pending import request after mount (first-open handoff lost it; affects Workflow readiness too).
- Verified: server feeds/e2e/hub tests 76 + web hub tests pass; GAID ↔ real hub server e2e `server/test/geo-hub-feeds-e2e.test.ts`;
  live: local hub on 127.0.0.1:8711 (home ~/data/geoaidesk/work/gaid-hub-feeds/hub-home), 18/18 sources collected (~21 s),
  default list 154 items; browser checks + 14 screenshots in ~/data/geoaidesk/work/gaid-hub-feeds/playwright/ (SHA256SUMS).
- Temporary services (stop at finish): user units `gaid-hub-feeds-app` (GAID 3110/8110, data under the work dir) and
  `gaid-hub-feeds-hub` (hub 8711).
## Next steps
1. Record the scripts/check result in the report appendix, stop the two temporary units, `task finish`.
## Failed approaches
## Notes and decisions
- Orchestration: sequential = contract → (child server ∥ parent GAID/web) → integration. Owned files: child =
  `server/src/geo/hub-server/{feeds/,core.ts,index.ts,cli.ts}`, `server/test/geo-hub-server-feeds.test.ts`,
  `docs/geo/hub-server.md`; parent = everything else. Integration order: child merge first, then parent e2e.
- Without a hub server a GAID shows no items, only how to connect (decision of this unit): the user chose administrator
  approval, and a local fetch would read sources nobody approved and make each PC poll external feeds.
- Source selection (user: 10 by field): Nature Geoscience, Nature (geoscience words only), Eos (AGU), Solid Earth
  (geology/geophysics), HESS (hydrology), NHESS (hazards), Ocean Science, Carbon Brief (climate blog), NASA Earth
  Observatory (remote sensing), Ore Geology Reviews (resources). Tools: GeekNews (AI tool/skill/GIS words only), releases
  of Pi, pi-subagents, pi-web-access, skills CLI, Claude Code, Codex (prereleases skipped). Skills: GitHub search for
  geospatial/GIS/geology/earth-science agent skills. Considered but left out: EGU Blogs (feed nearly empty), GMD,
  Communications Earth & Environment, USGS significant earthquakes (data, not reading) — administrators can add them.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [결정] 기관 허브 서버를 gaid-hub-feeds 변경으로 갱신한 뒤 제안 출처를 승인하는 범위 — 가) 18곳 모두 승인 — 나) 일부만 승인 — 권장: 가) PC74에서 18곳 모두 수집을 확인했고 필요 없는 출처는 나중에 멈출 수 있음 — 막힌 일: 연구자 화면의 자료 소식 — 조건: 시험 운영 허브 서버(PC74:8700)를 main으로 갱신한 뒤, 관리자 계정으로 설정 → 기관 GAID 허브 → 허브 서버 관리 → 자료 소식 출처 — 근거: reports/2026-10-22-gaid-hub-feeds/index.md#6-결정할-일
## Report
Report: reports/2026-10-22-gaid-hub-feeds/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
