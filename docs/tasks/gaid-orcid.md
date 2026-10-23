---
format: 1
status: active
updated: 2026-10-23T01:40:43Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"ca53ee3a-1baa-4c53-a886-8b6a2b35ab75","pid":2058627,"provider":"claude","session":"f7c1067b-f670-4e6e-8814-18489c0168f7","start":"54821171","token":"dae9ec8a184e9be9fa328343821519f08272071bd5d8e2924897cb9c9d582b43"}
branch: task/gaid-orcid
target: main
parent: 
---
# gaid-orcid

## Goal and done criteria
Request from the starter:

# Request: gaid-orcid

User request (verbatim, 2026-10-22, to the geoaidesk hub): "별도 작업으로 이용자들의 ORICD를 연동하는 기능도 구현 가능하면 진행하고 싶다."
("ORICD" = ORCID.)

Order: feasibility first, then a short plan the user confirms in your tab, then implement the confirmed scope.
1. Feasibility (oracle-search for current facts, Extra High; KIGAM network blocks raw.githubusercontent.com): ORCID Public API vs Member
   API (what is free, rate limits, whether KIGAM/KISTI consortium membership exists or is needed), OAuth "Sign in with ORCID" /
   authenticated iD (/authenticate scope), redirect URI rules (https vs loopback/localhost, how it fits a PC-local GAID and the institute
   hub server on PC74 over internal HTTP), reading a researcher's public works/employment/education, sandbox for testing, terms of use.
   Check reachability of orcid.org / pub.orcid.org / sandbox.orcid.org from PC74.
2. What it should enable for researchers (value first): link an ORCID iD to the researcher's GAID hub account (gaid-backend accounts;
   gaid-hub-server-trial is deploying the server now) and show it on hub entries/profiles; import the researcher's publications as
   the basis of "내 논문" (planned in reports/2026-10-21-gaid-research-hub, phase 2: ORCID + Crossref + OpenAlex + KCI, researcher confirms
   each match); optionally prefill library items. Say what is not worth building.
3. Anything needing the user's action (ORCID account, registering a public API client and redirect URI, client secret storage) — ask in
   your tab; never put secrets in Git, files or chat; store them like other GAID keys (server-side config).
Coordination: gaid-hub-server-trial owns the hub server/accounts code now; agree interfaces through the hub, do not edit its files in
parallel. gaid-user-acceptance is testing in the review app (PC74 :3000) — do not touch it; own GAID_HOME under
~/data/geoaidesk/work/gaid-orcid/. UI per docs/design/ui-guide.md v2. ADR if there is a real architecture choice. scripts/check passes.
Outside check: no outside check.

## Current state
- RESUMED 2026-10-23 10:17 KST: the user wrote in this tab that they are back and resuming, and gave the sandbox client
  id "NMSX0X5YG2CKUCUQ" (= APP-NMSX0X5YG2CKUCUQ; `GET pub.sandbox.orcid.org/v3.0/client/APP-NMSX0X5YG2CKUCUQ` → name "GAID_Test";
  not a production client). gaid-hub-server-trial is finished and merged; no other active unit owns hub server code.
- PAUSED 2026-10-23 03:00 KST (hub pause-0300-gaid-orcid). Nothing running (no job, worker or child). Exact next action
  after the user's resume instruction via the project hub: read the user's answer on phase 2 (ORCID client IDs + whether
  production accepted the loopback redirect) or their choice to close phase 1 first, then follow Next steps 2 or 3.
- Phase 1 (feasibility) running. PC74 reachability checked 2026-10-22 (curl, HTTP 200): orcid.org, pub.orcid.org
  (anonymous /v3.0/<iD>/works returns JSON with DOIs), sandbox.orcid.org, pub.sandbox.orcid.org, OpenAlex, Crossref.
- Oracle xhigh research done 2026-10-22: session `i-am-building-an-orcid`, vault note
  `웹 조사/geoaidesk/2026-10-22-i-am-building-an-orcid--e234c882d8.md` (prompt/output also in
  ~/data/geoaidesk/work/gaid-orcid/oracle-q1.{md,out}).
- Feasibility findings (official ORCID pages, checked 2026-10-22):
  - Free Public API covers everything requested: authenticated iD (`/authenticate` or OIDC `openid`), public
    works/employment/education read. Member API only adds writing to ORCID / read-limited data — not needed.
  - Limits: anonymous 12 req/s, burst 40, 25,000 reads/day/IP; registered public client 100,000/day. No polling
    (Public API ToS 2024-10-23). Public credentials belong to one individual (one set per person, not shareable);
    client_secret must stay server-side; non-commercial use.
  - OIDC discovery (fetched): code / id_token / id_token token, `client_secret_post` only, no PKCE advertised,
    claims sub/name/given_name/family_name (no email). Redirect URI FAQ: "only HTTPS URIs are accepted in production.
    You can test using HTTP URIs" (sandbox). Whether Developer Tools accepts http://127.0.0.1 for a production public
    client is unverified — only a real registration settles it.
  - Anonymous `GET https://pub.orcid.org/v3.0/<iD>/works` works from PC74 (HTTP 200 JSON with DOIs, verified curl).
  - Korea: KISTI is a member (Korea DOI Center auto-update); no Korean consortium or KIGAM membership confirmed.
  - Display guidelines: official iD icon + https://orcid.org/<iD> link; an iD not proven by OAuth must be shown
    as unauthenticated.
- Phase 1 server done and pushed (d47244486e34 + follow-up): contract `web/src/geo/contracts/orcid.ts`,
  `server/src/geo/orcid/{client,works,service}.ts`, routes `server/src/geo/routes/orcid.ts`, library `ownWork` / filter
  `mine` / origin `orcid`, Zotero refresh+merge keep `ownWork`. Verified: `cd server && npx tsc --noEmit -p .`;
  `npx vitest run test/geo-library*.test.ts test/geo-orcid.test.ts test/geo-hub-e2e.test.ts` (9 files, 110 tests pass);
  own-work Zotero test fails without the keep line (checked). Live smoke (real pub.orcid.org + Crossref, test iD
  0000-0002-1825-0097, temp library under ~/data/geoaidesk/work/gaid-orcid/smoke/): link → 6 works → 6 added from Crossref.
- UI: child gaid-orcid--ui (general work) finished, completed and closed 2026-10-22 (integrated 87924824): ORCID card,
  import dialog, mine filter, official ORCID icons (THIRD_PARTY_NOTICES), 24 screenshots in the report folder; boundary
  seam `web/public/geo/orcid/` owned by gaid-orcid. Full scripts/check passed on tree 9d9a8a4aaa46 (backend 2191 passed /
  8 skipped, frontend 1207, distribution/copy/UI checks). Reviewed diff and two screenshots.
- Existing hooks: library import preview/confirm (`/geo/library/import`), metadata client
  (`server/src/geo/library/metadata/`), hub account contract `web/src/geo/contracts/hub-server.ts` (owned by gaid-hub-server-trial).
## Next steps
1. Phase 2 server done and pushed (d278514fb5a7): hub `orcid-client set|show|clear` CLI (secret from stdin, file mode 600,
   not in backups), `/hub/v1/orcid{,/start,/finish}`, migration v4 (`account_orcid`, `orcid_states`), `HubAccount.orcid`,
   `HubEntry.authorOrcid` joined at read; GAID `/geo/orcid/auth/start`, `/geo/orcid/callback` (static page),
   `DELETE /geo/orcid/auth`, `OrcidStatus.hub`. Tests: geo-hub-orcid (fake ORCID signing RS256 tokens) + hub suites pass.
2. Child gaid-orcid--authui (writer b35bb8b9-c459-4233-ba31-c386537b4e3f, brief ~/data/geoaidesk/work/gaid-orcid/child-auth-ui.md)
   builds the phase 2 screens; on its finish: `task complete gaid-orcid--authui`, review, integrate.
3. Real sandbox end-to-end (jobs 1 + 2 below: test hub http://127.0.0.1:8711 with home ~/data/geoaidesk/work/gaid-orcid/e2e/hub,
   test GAID backend :8000 with GAID_HOME ~/data/geoaidesk/work/gaid-orcid/e2e/gaid-home, logged in as orcid-test@example.org):
   waiting for the user to (a) confirm the sandbox redirect URI, (b) run
   `node geo/hub-server.mjs orcid-client set --home ~/data/geoaidesk/work/gaid-orcid/e2e/hub --sandbox --client-id APP-NMSX0X5YG2CKUCUQ`
   and type the secret, (c) open the authorize URL I generate (POST /geo/orcid/auth/start on :8000) in a browser on PC74 and
   sign in with the sandbox account. Then check the callback page, `GET /geo/orcid` (linked) and stop both jobs.
4. Production: still unknown whether ORCID production accepts the loopback redirect (user to try registering).
5. After 2–3: full scripts/check, report section for phase 2, humanizer, review-copy, task finish.
## Failed approaches
## Notes and decisions
- User decisions 2026-10-22 (this tab, verbatim choices): scope "1단계 먼저, 2단계는 등록 후 (Recommended)"; ORCID app
  owner "제 개인 ORCID 계정 (Recommended)".
  - Phase 1 (now, no user action): researcher enters an ORCID iD (shown as unauthenticated per ORCID display
    guidelines), "ORCID에서 내 논문 가져오기" reads public works anonymously from pub.orcid.org, fills metadata by DOI
    (Crossref → OpenAlex, else the ORCID record), shows new / already in library / possible duplicate, and adds only
    what the researcher keeps; kept and matched items are marked as the researcher's own works (basis of 내 논문).
  - Phase 2 (after the user registers a sandbox, then production, public API client): authenticated iD via OIDC,
    client secret only in hub server config, iD on hub account/entries — interface agreed through the hub with
    gaid-hub-server-trial. Not in phase 1.
  - Not built: writing to ORCID (Member API), periodic sync/polling (ToS), ORCID as hub login, institute-wide
    discovery.
- Phase 1 design (contract `web/src/geo/contracts/orcid.ts`):
  - User-level profile `<library root>/orcid.json` (local, like zotero.json; not synced).
  - Routes `server/src/geo/routes/orcid.ts`: GET/PUT/DELETE `/geo/orcid`, POST `/geo/orcid/works` (preview from
    ORCID only, fast), POST `/geo/orcid/works/confirm` (enrich chosen DOIs, bulk-read non-DOI details, add or mark).
  - Library: `MetadataOrigin` gains `orcid`; `LibraryItem.ownWork {orcid, putCode, markedAt}`; list filter `mine` and
    count; Zotero mirror refresh and merge keep `ownWork`.
- Packages / owners / integration order:
  1. Contract + server (writer, me): `web/src/geo/contracts/orcid.ts`, `server/src/geo/orcid/`,
     `server/src/geo/routes/orcid.ts`, library store/routes/zotero-service small edits, server tests.
  2. UI (child writer after the contract is pushed): `web/src/geo/orcid/`, library screen seam, locales
     `web/src/geo/locales/orcid/`, ORCID icons (official assets), screenshots per ui-guide §12.
  3. Integrate, scripts/check, report.
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
Report: reports/2026-10-22-gaid-orcid/index.md
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-orcid-20261023T013942.970747Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid-20261023T013952.968887Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
