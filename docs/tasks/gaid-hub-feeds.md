---
format: 1
status: active
updated: 2026-10-22T14:59:45Z
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
- Shared interfaces settled and pushed (6871f5a8): contract `web/src/geo/contracts/hub-feeds.ts`, shipped proposals
  `geo/feeds/sources.json` (10 geoscience + GeekNews + 6 GitHub release sources + 1 GitHub skill search; all 18 URLs
  answered 200 from PC74 on 2026-10-22), routes in `server/src/geo/hub-server/protocol.ts` "Information feeds".
- Child `gaid-hub-feeds--server` (writer 80c56972, Paseo general work) builds the hub-server side; started 2026-10-22 23:58 KST.
## Next steps
1. Parent: GAID routes (`server/src/geo/routes/hub-feeds.ts`, `/geo/hub/feeds`, admin proxies under
   `/geo/hub-server/admin/feeds/*`), web `web/src/geo/hub-feeds/` (feed screen at `#hub/feeds`, sidebar place, admin
   sources section in Settings → 기관 GAID 허브), locales `hubFeeds`, docs, report with screenshots.
2. When the child finishes: `task complete gaid-hub-feeds--server`, integrate, end-to-end check against a real hub server,
   then `scripts/check`.
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
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
