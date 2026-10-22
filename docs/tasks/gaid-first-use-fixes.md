---
format: 1
status: done
updated: 2026-10-22T13:04:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c7c994c8-9104-4a2d-91ca-02598ddfa51c","pid":3710652,"provider":"claude","session":"71412738-bdac-483a-bb75-b3200c12f5e4","start":"55874657","token":"7300838461defcef07e6e5adf36f6fd631e6d0e4dc5860a2c9bdad6b1f73a570"}
branch: task/gaid-first-use-fixes
target: main
parent: 
---
# gaid-first-use-fixes

## Goal and done criteria
Request from the starter:

# Request: gaid-first-use-fixes

User decision (verbatim, 2026-10-22): "gaid-user-acceptance#1 가) 후속 작업 하나로 묶어 고침"
Fix, in one unit, the 8 screen problems a first-time researcher hit in the acceptance test (evidence and screenshots:
reports/2026-10-22-gaid-user-acceptance/index.md §3.5 "처음 쓰는 사용자가 막히거나 헷갈린 점"):
1. a new chat's default model is not connected;
2. two models with the same name in the picker;
3. links shown as "[blocked]";
4. the citation column of wide tables in chat (clipped/unreadable);
5. arXiv suggested in bibliography recommendations;
6. the "모두 읽음" wording;
7. "형식 확인 필요" shown far too often;
8. a progress card in Japanese.
For each: reproduce, find the cause, fix it, verify in the real app (2 styles × 2 themes where UI changes; 1440×900 and 1280×800),
copy per geo/copy rules and UI per docs/design/ui-guide.md v2. scripts/check passes; report per item before/after.
Coordination: gaid-hub-server-trial is connecting the user's review app (PC74 :3000) to the hub server — do not touch the review app or
~/.geoaidesk; own GAID_HOME under ~/data/geoaidesk/work/gaid-first-use-fixes/ (copy review-app data read-only if you need realistic state).
gaid-orcid is active (accounts/ORCID); avoid its files. Outside check: no outside check.

## Current state
Causes found (2026-10-22, from the tester's screens/notes, review-app session data read-only, and probes):
1. Default model: no saved default → built-in `openrouter/openai/gpt-6-astra`; OpenRouter is not configured on the
   review app, while ChatGPT sign-in offers `openai/gpt-6-astra`. chat-tab never falls back.
2. Duplicate names: `openai/*` (Sign in with ChatGPT) and `openai-codex/*` (legacy login) both connected; every legacy
   model also exists under `openai`.
3. "[blocked]": (a) chat, while streaming: Streamdown completes an open link as `streamdown:incomplete-link`, the
   sanitize schema drops that href, harden then shows "[blocked]" ("Blocked URL: undefined"). Reproduced in vitest.
   (b) Markdown files in the file panel (and research notes): links are resolved against the sandbox root, not the
   file's folder, so `../../figures/x.pdf` is refused → href removed → "[blocked]".
4. Wide tables: Streamdown `th` is `whitespace-nowrap px-4`; 6–7 headers exceed the chat width.
5. arXiv: `identifyPdf` finds `2005.07939v1`, but `/geo/library/lookup` ignores arXiv ids and searches by the
   mis-extracted title "P REDICTING INTO UNKNOWN SPACE ?". Crossref has no arXiv DOIs; OpenAlex maps the arXiv DOI to
   the later journal version (DOI mismatch); DataCite returns the exact preprint record.
6. "본문 N쪽 모두 읽음": library detail wording for text extraction coverage.
7. "형식 확인 필요": agents write `cover: null` (YAML null); `store.ts` treats "null" as an image path → `image-missing`.
   The current parser finds no other problem in all 5 acceptance notes. `supersedes: null` likewise becomes ["null"].
8. Japanese cards: `notebook` tool entry titles written by GPT-6.1 Sol in Japanese; the chip also shows the raw English
   type ("Method").

All 8 fixed by this writer (no children; small, shared files). Saved d0f6e67f. Fixes: 1 `web/src/geo/models/start-model.ts`
(pickStartModel, used by chat-tab for chats that have not run); 2 same file `isSupersededLegacyModel` in model-selector;
3 `sandbox-markdown.ts` (baseDir, target-less links → text) + plugin passed as `[fn, options]` (Streamdown caches
processors by plugin name + options: pre-existing stale-project bug) + MarkdownViewer baseDir/onOpenFile; 4 th/td
overrides in message.tsx (wrap, px-2) + REPLY_STYLE_RULE "at most five columns"; 5 DataCite in metadata client,
`arxivDoi` in the PDF lookup route, `MetadataOrigin` += `datacite`; 6 library locale wording (ids in the report);
7 parser reads YAML null/~ as absent; 8 `server/src/geo/entry-language.ts` tool_call hook + localized chip type.
Verified: unit tests per fix; full server 2209 + web 1212 passed mid-way (before the padding/rule edits); real app on
3310/18310 (unit gaid-gfuf, GAID_HOME `~/data/geoaidesk/work/gaid-first-use-fixes/home`, copies of proj-ca300f,
proj-bc576f and the library without auth/keys; session cwd paths rewritten in the copies): 73 shots in
`~/data/geoaidesk/work/gaid-first-use-fixes/shots/` (scripts in `../bin/`, run `bin/make.sh <name> bin/sN.js all`).
Item 2 not visible in the real app (no ChatGPT sign-in copied: token refresh could log out the review app).
scripts/check passed on the rerun (log `~/data/geoaidesk/work/gaid-first-use-fixes/logs/check2.log`); the first run failed only on the seam-owner list in `geo/tests/distribution.test.mjs` (owner added).
Overlap: gaid-orcid edits `MetadataOrigin` in `web/src/geo/contracts/library.ts` and library locales (`filter.unread`
is adjacent to its `filter.mine`); resolve at merge.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T13:04:54Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-first-use-fixes.md.

## Failed approaches
- Table cells with `overflow-wrap:anywhere` fit 6 columns at the default chat width but split names ("Pebes ma");
  replaced by whole-word wrapping (fits when the chat is widened; narrower scrolls inside the table, guide X2).
## Notes and decisions
- First `task finish` check failed once in `server/test/provenance.test.ts` ("declared write" got change `modified` instead of `created`); untouched code, passed in both scripts/check runs and 5/5 isolated reruns: timing flake under load, finish retried.
- Restored chats (opened from history) are left as they are: the client does not restore a session's model and still
  shows the new-tab default; noted as a limit in the report.
Closes: gaid-user-acceptance#1
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [확인 gaid-first-use-fixes#1] 검토용 앱 반영 뒤 모델 선택 창에서 GPT-6.1 Sol 등이 한 번씩만 보이는지 확인 — 가) 한 번씩 보임 — 나) 아직 두 번 보임 — 권장: 가) 시험 앱 목록으로 자동 시험은 통과 — 막힌 일: 없음 — 조건: 검토용 앱이 이 수정으로 갱신된 뒤 — 근거: reports/2026-10-22-gaid-first-use-fixes#3.2
## Report
Report: reports/2026-10-22-gaid-first-use-fixes/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
