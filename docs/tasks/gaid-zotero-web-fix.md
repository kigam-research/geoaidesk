---
format: 1
status: active
updated: 2026-10-22T05:58:05Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"bee7d319-703a-4565-a0c9-1d69e94cd031","pid":3762934,"provider":"claude","session":"870398d4-3eab-430b-ae47-a9f6c6604ea1","start":"53200219","token":"cb3fe81ab18b49eee1407e968dd49a72031d140445992e9a34169e97d8776bc3"}
branch: task/gaid-zotero-web-fix
target: main
parent: 
---
# gaid-zotero-web-fix

## Goal and done criteria
Request from the starter:

# Request: gaid-zotero-web-fix

User report (verbatim, 2026-10-22, answering gaid-library-folders#2): "gaid-library-folders#2 와 관련해서 PC Zotero는 앱이 켜져있을 때 연결되는 것을 확인했고, 웹키로는 연결은 되었는데 닿지 못했다고 한다."
Screenshot: ~/data/geoaidesk/work/hub/feedback/2026-10-22-zotero-web-unreachable.png — library header shows "Zotero 연결 안 됨" while
the Zotero card shows "연결됨 · 아직 갱신 전" and the warning "Zotero에 닿지 못했습니다. 잠시 뒤 다시 시도하세요."; library has 0 papers.
Hub facts: the test ran on the review app on PC74 (main d66762a7, backend :18000; its log shows POST /geo/library/zotero/web);
api.zotero.org answers HTTP 200 from PC74 (checked 2026-10-22), so plain network reachability is not the cause; the root cause is
not yet known.

Do:
1. Find why a saved Zotero Web API key ends in "닿지 못했습니다" on refresh (code: server/src/geo/library/zotero/**, routes, web
   screens web/src/geo/library/**). Check user/group library id resolution, key permissions, request headers/version, proxy/timeout
   handling, error mapping (a 403/404/invalid-library error must not be shown as "unreachable"). You may read the review app log
   ~/data/geoaidesk/work/review-app/launcher.log; never read keys or ~/.geoaidesk config/env files, and do not modify ~/.geoaidesk.
   If a real key is needed to reproduce, ask the user in your tab to enter one in your test app (never paste it into files/chat).
2. Fix the inconsistent status: the header and the Zotero card must report the same state (PC connection vs web key, and
   "connected but not refreshed / refresh failed with reason").
3. Show the actual cause and next action in researcher copy (geo/copy rules), e.g. wrong key permission, wrong library.
4. Note for the PC (Local API) path: it works only while the Zotero app is running (user-confirmed); make the UI say so.
Done: web-key refresh works with a valid key (verified with the user's key in your test app, or a documented reproduction), status
consistent, tests added for the error mapping, scripts/check passes, UI per guide v2 (2 styles × 2 themes). Brief report.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-zotero-web-fix/. Outside check: no outside check.

## Current state
- Root cause found and reproduced without a key (2026-10-22): Zotero Web API answers `304 Not Modified` with no
  `Last-Modified-Version` header (checked with curl on public group 1). `syncZoteroLibrary`'s final check reads
  `items?limit=1` with `If-Modified-Since-Version` and requires `final.version === libraryVersion`; on Web it is
  `undefined`, so every attempt throws SnapshotChanged, three attempts end in `library-kept-changing`, and
  `runSync` stores only `state: "unreachable"`. Reproduction: the real sync code against `groups/1` with the key
  header stripped: 12 requests, ~4 s (matches the review-app log: POST /geo/library/zotero/web 200 in 4030 ms).
  The fake server in tests set the header on 304, so tests never saw it. Incremental reads (`since` +
  If-Modified-Since-Version) had the same flaw.
- Status mismatch: the header derived "연결 안 됨" from `lastSyncAt` only; the card said "연결됨 · 아직 갱신 전"
  from the library list and the warning from `state`.
- Implemented (uncommitted until task save): client 304 fallback + sync without If-Modified-Since; error states
  (contract `ZoteroState`, `failedAt`, `detail`); runSync records them; connectWeb refuses keys without personal
  library access and drops the previous key's web user library; route sends `detail`; full syncs take children from
  the snapshot (no per-paper /children: group 1000, 169 papers, 9 requests / 7 s instead of ~180).
  UI: `web/src/geo/library/zotero-status.ts` shared by header and card; card shows connection, cause, 기술 정보,
  new-key input for web-key states, PC note.
- Verified: real Web API reproduction script (/tmp/zrepro.mts; public groups 1/100/1000, key header stripped) now
  syncs fully and incrementally; old code fails the new web-sync test with `library-kept-changing`; server tsc,
  zotero tests (53 + 7), web tsc + library tests, copy validator (0 errors), check-ui (0 errors).
- Test app: `systemd-run --user` unit `gaid-zotero-web-fix-app`, UI http://localhost:3360, backend :18360,
  GAID_HOME ~/data/geoaidesk/work/gaid-zotero-web-fix/home, log ~/data/geoaidesk/work/gaid-zotero-web-fix/app.log.
- User key test (2026-10-22): web key connected and refreshed (header and card agree, "웹 키로 연결 · 오후 2:52:43 갱신"),
  0 papers. Cause: the zotero.org library is empty (libraryVersion 1) because the user's Ubuntu Zotero app cannot sync:
  KIGAM TLS inspection (api.zotero.org issuer "KIGAM SSL"), Zotero's own NSS store does not trust it
  (SEC_ERROR_UNKNOWN_ISSUER). Not a PC/web conflict. GAID's Node trusts it via NODE_EXTRA_CA_CERTS
  (/usr/local/share/ca-certificates/KIGAM.crt); without it Node reports SELF_SIGNED_CERT_IN_CHAIN.
  Added: state `certificate-untrusted`, empty-web-library note, "Zotero 연결 해제" (POST /geo/library/zotero/disconnect;
  forgets the web key, mirrored papers stay) so a researcher can switch to the PC connection.
## Next steps
1. Screenshots (2 styles × 2 themes, 1440×900 and 1280×800), user key test in the test app, scripts/check, report.
## Failed approaches
## Notes and decisions
- Plan (all done by the top writer; small and tightly coupled, no children):
  1. client: a 304 read without the header keeps the caller's `ifModifiedSince` version; sync stops using
     If-Modified-Since-Version (`since` only, final check is a plain read) so `/collections` 304 semantics do not matter.
  2. Error mapping: richer `ZoteroLibraryState.state` (key-invalid, no-library-access, library-not-found,
     rate-limited, server-error, library-changing, failed) + `failedAt` + `detail` (code/HTTP status only, never
     bodies or keys) recorded by runSync; `unreachable` only for network/timeout. connectWeb refuses a key without
     personal-library read access instead of silently saving nothing.
  3. UI: one derived status (`web/src/geo/library/zotero-status.ts`) used by header and card; card names the
     connection (PC Zotero / web key), shows reason + next action, technical detail behind 기술 정보, allows saving a
     new key when the web key fails; PC copy says it works only while the Zotero app is running.
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
