---
format: 1
status: done
updated: 2026-10-24T13:28:50Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"4c7a414c-4971-467e-bd4e-be3a24b50c1e","pid":908712,"provider":"claude","session":"a59c5297-7707-4492-9e14-c91549b87e67","start":"72988241","token":"01b6763312835def33e04b6cef6092bb6449bf54aa80b7e7776c7a4cc604157f"}
branch: task/gaid-authoring-cache
target: main
parent: 
---
# gaid-authoring-cache

## Goal and done criteria
Request from the starter:

# Goal: gaid-authoring-cache — make Workflow-authoring prompt caching work per provider, with measurement that can tell why a call missed

## User requests (verbatim, 2026-10-24)

> gaid-authoring-tokens과 관련하여 질문이다. GAID 시스템에서는 왜 캐시를 읽지 못하나? 입력토큰은 덜써서 좋지만 캐시 재사용율이 너무 낮다. PI특성 때문인지 수정이 가능한지 답변만 해줘.

> 해당 문제를 oracle search로 검색해서 조사하자. 정말 1, 2번만 수행하면 되는지 확인하고 싶다.

> 작업하자.

"작업하자" answers the hub's proposal of the recommended order below (from the Oracle Pro research).

## Verified context

- Previous unit gaid-authoring-tokens (reports/2026-10-24-gaid-authoring-tokens/index.md, merged): authoring = `completeSimple` one-shot calls
  (analysis → draft → at most one repair per stage); it added a per-project cacheKey → Pi `sessionId`/`prompt_cache_key`, a shared
  `AUTHORING_SYSTEM` + sources-first user message, partial repair/revise patches. Measured (legacy `openai-codex/gpt-6.1-sol` login, not
  `openai`): 109,908 input, 33,792 cached (31%); the draft call missed cache although its prefix matched.
- Oracle Pro research 2026-10-24 (vault `웹 조사/geoaidesk/2026-10-24-gaid-github-app-kigam-research--7b2bdfccf3.md`; reread it, check
  the sources it cites before relying on them; key claims to verify against Pi 1.0.0 source in server/node_modules):
  - Pi 1.0.0 `openai-responses`: Sign in with ChatGPT (`isChatGPTSignIn`) omits `prompt_cache_retention`/`prompt_cache_options`;
    `openai-codex-responses` sends only `prompt_cache_key`. So `cacheRetention: "long"` does nothing on both subscription paths; on the
    API-key path it maps to `24h` (older models) or `{ttl:"30m"}` (explicit-cache models).
  - Pi's Anthropic adapter already attaches `cache_control` (system + last user block; `long` → 1h), not at the end of the sources.
  - GAID joins "sources + per-stage task" into one user message and folds the previous assistant reply into a user string in `toContext()`,
    so no reusable cache entry is guaranteed at the end of the sources, and Pi's codex continuation (exact extension of previous input +
    response items) cannot apply.
  - Ledger/attempt usage lacks `cacheWrite`; `agent.ts` attempt accumulation drops `cacheRead`; Pi normalises input = raw − cached − write.
  - Realistic upper bound for the 3-call shape with a cold first call ≈ 54.5%; judge by uncached input + writes + output + time per Workflow.

## Done criteria (the recommended order the user accepted)

1. Measurement: per authoring call record provider/model/API adapter, auth kind, stage/repair, raw and normalised usage incl. cacheRead and
   cacheWrite, request/response id when available, start/first-token/end time and gap to the previous call; ledger rows keep cacheWrite.
   Fix the `cacheRead` loss in attempt accumulation.
2. Split the sources into their own content block/message and put the cache boundary at the end of the sources (explicit breakpoint where the
   path supports it; for Anthropic reposition Pi's marker within the 4-marker limit). Verify in the final provider payload (Pi `onPayload`)
   that the boundary survives, for the OpenAI (API key / Sign in with ChatGPT), legacy Codex and Anthropic paths that are available.
3. Per-provider retention policy: Anthropic 1h only when the measured gap makes it pay; subscription paths: check what is allowed, do not
   bypass Pi's omission blindly; API-key path as Pi supports. Document the policy.
4. Compare repair with native message history (previous assistant reply kept as an assistant message / response items) against the current
   string fold, on cost and quality; adopt only if it is better.
5. Raise first-draft pass rate where the check failures show an easy fix (no weaker checks).
6. Re-measure with the same paper/answers as gaid-authoring-tokens on the available logins (state which; one run each is acceptable) and
   report before/after: uncached input, cache read/write, output, list price, time, cache ratio; explain any remaining miss with the new records.
7. scripts/check passes; report under reports/ (Korean, result first).

Optional (not required): prewarm requests or scheduling changes — only if the new records show they would pay.
Constraints: do not touch the review app or the hub server. Logins: use what works on PC74 (see PROJECT.md / past sessions); report a missing
login instead of substituting. Outside check: the gaid-authoring-tokens baseline (same paper, same answers).

## Current state
Result for the hub (2026-10-24, legacy Codex login, same paper/answers as gaid-authoring-tokens, one run each; report
reports/2026-10-24-gaid-authoring-cache/index.md):
- Cause of the low reuse: the legacy Codex backend keeps an implicit cache entry only at the end of a request's input and
  reuses it only when a later request diverges within a few tens of tokens of that end (40 probe calls: short tail 13/13
  hits; tails >= ~400 tokens and the real analysis task 0, also in both real runs). It refuses prompt_cache_breakpoint.
- Changes: sources as their own block; per-path boundary/retention (OpenAI API key: explicit breakpoint, 30m default /
  24h older models; Sign in with ChatGPT and Codex: nothing sent; Anthropic: cache_control on the sources, 1h only after a
  >5 min gap); per-call records (path, auth, payload blocks/markers, prefix hash, raw + normalised usage, times, Codex
  WebSocket reuse); attempt usage keeps cacheRead/cacheWrite, ledger cacheWriteTokens; native repair history on Codex
  only; a sources warm-up before an operation's first call on Codex (not repeated within 20 min); draft prompt rules for
  the three most frequent first-reply failures (gaid-draft/2026-10-24.2).
- Before/after (list price, GPT-6.1 Sol API rates): 10-24 after $0.50, 31% cache; re-measure 1 (no warm-up) $0.50, 0%;
  re-measure 2 (warm-up) $0.40, 60% (uncached input 76,116 → 33,865). Both re-measures passed the draft on the first reply.
- Checks: scripts/check passed after reruns (web vitest load flakes in 4 untouched files passed on rerun; a geo test needed
  the new boundaries owner listed).
- Not verified: Anthropic, OpenAI API key and Sign in with ChatGPT (no working login on PC74; payloads checked offline);
  repair quality native vs fold (no repair happened); Codex TTL beyond 20 min.
Details:
- Logins on PC74 (~/.geoaidesk/pi-agent, also the review app's /model-providers): only OpenAI Codex (legacy) works.
  Sign in with ChatGPT is stored but not connected (stale since 10-24), no Anthropic login, no API keys. Paths without a
  login are verified offline on Pi's real adapters' final payloads (test/geo-authoring-cache.test.ts).
- Pi 1.0.0 verified in server/node_modules (pi-ai 1.0.0, openai SDK 7.19.0): openai-responses omits prompt_cache_* and
  max_output_tokens for Sign in with ChatGPT; `long` → 24h only without supportsExplicitPromptCacheMode (gpt-6.1-sol has
  it), else {ttl:"30m"}; openai-codex sends prompt_cache_key + session-id only, one WebSocket per sessionId (5 min idle),
  previous_response_id delta only for an exact extension; Anthropic marks system block(s) + last user block (an effort
  system message may follow); adapters need `normalizeContext` (ModelRuntime does it).
- Probes on legacy Codex (~/data/geoaidesk/work/gaid-authoring-cache/probe/codex-{1,2}.jsonl, sources 24.9K tokens, fresh
  nonce per sequence): S+T1 → S+T2 hits 24,704 as one string and as blocks; after a 151 s / 9.4K-token reply; after 270 s;
  after 330 s on a new WebSocket. prompt_cache_breakpoint → "Codex error: prompt_cache_breakpoint is not supported on this
  model". Prewarm [S] works but adds nothing here. Repair after a 9.5K reply: native history 233 uncached / 34,176 read,
  fold 8,714 uncached / 24,704 read. So H1 (entry reusable only as whole) is false on this backend; the 10-24 analyze→draft
  miss (identical 95,770-char prefix, draft started ~15 s after analysis ended) is not reproducible: provider side.
- Code: cache.ts (path/plan/boundary/payload summary/raw usage), model.ts (sources block + task block, fold/native
  history, historyFor: native on openai-codex, call records, cacheRetention, ledger cacheWrite), agent.ts (sources message
  with cacheBoundary, usage keeps cacheRead/cacheWrite, attempt.calls + record calls, recentGapMs), ledger.ts
  (optional cacheWrite / cacheWriteTokens; boundaries entry), contract AuthoringAttempt.usage/calls, prompts
  (gaid-draft/2026-10-24.2: ≥2 options or drop a settled choice, recipe keyed by choice ids, workflow needs
  decisions + userDecisions), docs/design/hub-authoring-service.md "Prompt cache", AGENTS.md line.
- Tests: server typecheck clean; vitest test/geo-authoring* 81 passed (incl. new geo-authoring-cache.test.ts, 7).
- First-draft data (all PC74 authoring stores, prompt versions 10-22.1 … 10-24.1): 23 draft/revise attempts, 8 passed
  first; 13 of 15 failures only had the three errors the prompt now addresses.
- Re-measure 1 (run-codex, code without warm-up, 21:02-21:28 KST): analyze 25,893 uncached / 0 read / 15,213 out, 343 s;
  draft accepted on the FIRST reply (no repair), 35,068 uncached / 0 read / 22,776 out, 616 s; list $0.50. Records: same
  prefixSha, key, instructions (830 tokens) and sources block (24,017 tokens, provider attribution) in both calls, draft
  sent 8 s after the analysis ended, still 0 read. Codex WebSocket counters were empty: pi-coding-agent has its own pi-ai
  copy (same 1.0.0 files); model.ts now reads that copy.
- Cause found (probes codex-3/4): the legacy backend keeps an implicit entry only at the end of a request's input, and a
  later request reuses it only when it diverges within a few tokens of that end: after a first request with a ~30-token
  tail after the sources the next one read 24,704; with tails of ~400, 1,200, 2,200, 5,000 tokens, and after the real
  analysis task (1,044 tokens), it read 0. A 10K-token task after a short-tail first request read 24,704. So every
  operation's first call misses by structure on this path (analysis → draft, draft → revise); repairs hit (they extend).
- Fix: warm-up call (cache.ts `plan.prewarm`, model.ts `PREWARM_TAIL`, agent.ts `warmUp`/`lastWarmAt`): on openai-codex
  only, before an operation's first call, send [system, sources, one-line tail] unless a warm-up of this project is
  younger than CODEX_WARM_TTL_MS (10 min placeholder until delay600/1200 probes end). Ledgered, in attempt.calls with
  purpose "prewarm". Test added (geo-authoring-cache.test.ts, 8 tests).
## Next steps
<!-- task:closed -->
Closed 2026-10-24T13:28:50Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- H1 "an implicit entry is reusable only by a request that contains the whole earlier input" — refuted by probes (above).
- Explicit prompt_cache_breakpoint on the legacy Codex backend — refused by the backend.
- "Provider-side variance" for the analyze→draft miss (first reading after probes 1-2) — wrong; it is the end-of-input
  entry rule above, reproduced every time.
## Notes and decisions
- Orchestration: tightly coupled (model.ts/agent.ts/prompts.ts/ledger.ts + measurement), done by this writer; no child
  units. Owned upstream seam: server/src/cost/ledger.ts (optional cacheWrite) — added to geo/integration-boundaries.json.
- Logins: same as gaid-authoring-tokens (user decision there): KADY_PI_AGENT_DIR=~/.geoaidesk/pi-agent read through Pi,
  all stores under ~/data/geoaidesk/work/gaid-authoring-cache/. Its Sign in with ChatGPT login was stale on 10-24.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-authoring-cache/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
