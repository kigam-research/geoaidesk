---
format: 1
status: active
updated: 2026-10-22T14:36:29Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"80c56972-fb1c-4772-8d6a-0aff1507bcd2","pid":2748886,"provider":"codex","session":"01a1640a-9683-7250-88e1-fd32f5a623a3","start":"56771685","token":"fdf77feb4e49f6d0188b2ab0078c1bc3dc304fbd1395538e883631d3c7bc86fc"}
branch: task/gaid-hub-feeds--server
target: task/gaid-hub-feeds
parent: gaid-hub-feeds
---
# gaid-hub-feeds--server

## Goal and done criteria
Request from the starter:

# Child unit: hub-server feed collection (parent gaid-hub-feeds)

Goal: the institute hub server (`node geo/hub-server.mjs`, `server/src/geo/hub-server/`) keeps administrator-approved
information sources, collects them on a schedule, and serves the collected items to logged-in GAIDs. The parent
(gaid-hub-feeds) builds the GAID backend proxy routes and the web screens in parallel against the same contract.

User decisions (verbatim, 2026-10-22): "1번 관리자 승인방식, 원문제목과 피드요약만, 첫목록도 권장하는 각 지구과학 분야로 10개를 스스로 선정하여라."
Meaning: only sources an administrator approved are read; items carry the original title, the feed's own short summary
and the link only (no model calls, never full text, never Nature full text or whole GeekNews posts).

Settled interfaces (on the parent branch at 6871f5a8; read them first, do not change them without messaging the parent):
- `web/src/geo/contracts/hub-feeds.ts` — types, FEED_LIMITS, FEED_SOURCE_ID.
- `server/src/geo/hub-server/protocol.ts` — the "Information feeds" section lists the exact routes and bodies.
- `geo/feeds/sources.json` — 18 shipped proposals (feed / github-releases / github-search). They are state `proposed`
  until an administrator approves them; never collect a proposed or stopped source.

Owned files (only these):
- new `server/src/geo/hub-server/feeds/` (suggested: `sources.ts` load+validate the shipped list and additions,
  `parse.ts` RSS 2.0 / RSS 1.0 RDF / Atom with htmlparser2 in xmlMode (already a server dependency), `fetch.ts` bounded
  HTTP + GitHub API, `store.ts` SQLite access, `schedule.ts` the interval loop)
- `server/src/geo/hub-server/core.ts` (migration 3 + HUB_TABLES), `index.ts` (routes), `cli.ts` (commands + serve loop)
- new `server/test/geo-hub-server-feeds.test.ts`
- `docs/geo/hub-server.md` (an operator section: approving the proposals, CLI commands, interval, GitHub token)

Required behaviour:
1. Migration 3 (never edit 1 or 2): tables for source state/records (an approved copy of the definition is stored at
   approval time; shipped proposals with no row are `proposed`), collected items (id per contract, source id, record JSON,
   published/fetched times), add them to HUB_TABLES so backup/check-backup count them. Existing hub homes must migrate.
2. Routes exactly as in protocol.ts. `/feeds` needs any logged-in account and returns only items of currently approved
   sources, newest first (publishedAt, else fetchedAt), filtered by category/field/q, limit 1–300 default 200,
   `collectedAt` = latest successful fetch. Admin routes use the existing admin check; validate add bodies strictly
   (FEED_SOURCE_ID, kind-specific fields, http(s) URLs, owner/name repo, 1–5 queries ≤ 200 chars, ≤ 60 match words,
   Korean `HubServerError` messages like the rest of the server). Approve/stop/add/delete write audit events.
   Deleting a shipped proposal answers 409. Stopping hides its items (keep rows).
3. Collection: `serve` runs every approved source once ~30 s after start and then every
   `GAID_HUB_FEEDS_INTERVAL_HOURS` (default FEED_LIMITS.intervalHours; `0` turns it off; also a `--feeds-interval-hours`
   flag); sources run one at a time; a failing source records `lastFetch {ok:false, error}` and does not stop others;
   the timer is cleared on app close. `POST /admin/feeds/fetch` and a CLI `feeds fetch [--source ID]` run it now.
   HTTP: http/https only, timeout/size/redirect limits from FEED_LIMITS (stream and stop at the byte cap), a
   `User-Agent: GAID-hub-server/<version> (+https://github.com/kigam-research/geoaidesk)`, uses global fetch (the
   process may have a proxy dispatcher). GitHub: `https://api.github.com/repos/<repo>/releases?per_page=10` (skip drafts,
   and prereleases when `skipPrereleases`; title `<repo name> <tag>` or the release name, summary = release body as plain
   text, link html_url, github.release) and `search/repositories?q=<query>&sort=updated&per_page=20` per query
   (dedupe by full_name; title = full_name, summary = description, github.repo/stars). Optional token from
   `GAID_HUB_FEEDS_GITHUB_TOKEN` (never logged or stored).
   Parsing: RSS 2.0 `<item>` (title, link, guid, description, pubDate), RSS 1.0/RDF `<item>` (title, link,
   `dc:date`, description), Atom `<entry>` (title, link rel=alternate|first href, id, summary else the start of content,
   published else updated). Never use `content:encoded`. Text: strip tags, decode entities, collapse whitespace, remove
   the WordPress tail "The post … appeared first on …", Copernicus repeats the title and authors before the abstract —
   acceptable to keep, but drop a leading copy of the title if trivially detectable. Truncate title 300 / summary 400
   chars on a character boundary with "…". Links must be http(s) else drop the item. Dates to ISO or null.
   `match`: per contract (case-insensitive substring; ≤ 3 ASCII-letter words match whole words only).
   Store: upsert by id keeping the first fetchedAt; then prune to FEED_LIMITS.itemsPerSource newest and maxAgeDays.
4. CLI: `feeds list` (sources with state and last fetch), `feeds approve ID...|--all-proposed`, `feeds stop ID`,
   `feeds fetch [--source ID]`; approvals from the CLI are recorded with decidedBy "operator (CLI)". Add them to HELP.
5. Tests (vitest, no network): parser fixtures for each format (inline strings modelled on the real feeds: Nature RDF,
   Copernicus RSS 2.0, GeekNews Atom with HTML content, WordPress RSS with the tail), match rules, routes (member sees
   only approved items; member 403 on admin routes; approve/stop/add/delete/409), collection with an injected fetch
   (a failing source does not stop the next; byte cap; prerelease skip; dedupe/prune), migration from a v2 home.
   Inject fetch/clock through options (e.g. `buildHubServer({ ..., feedFetch })`); tests never hit the network.
6. One live smoke from PC74 (not in the test suite): start a server in a temp home, approve all proposals by CLI,
   run `feeds fetch`, and record per-source item counts / errors in your final message.

Checks: `cd server && npx tsc --noEmit && npx vitest run test/geo-hub-server-feeds.test.ts test/geo-hub-server.test.ts test/geo-hub-server-skills.test.ts`.
Do not run the full scripts/check (the parent runs it at the end). Data for experiments goes under
`~/data/geoaidesk/work/gaid-hub-feeds/`, never inside the repo.
Network note: the KIGAM network blocks raw.githubusercontent.com; api.github.com and the shipped feed URLs work.
Time box: the user pauses work at 03:00 KST 2026-10-23; aim to `task finish` well before 02:30 KST. If you cannot finish
by then, save, write the state in your task document and report what is left.
Report back (final message, English): files changed, the live smoke table, anything in the contract that should change.

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
