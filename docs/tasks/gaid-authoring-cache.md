---
format: 1
status: waiting
updated: 2026-10-24T11:38:55Z
writer: {"host":"seongin3","reserved":"01b6763312835def33e04b6cef6092bb6449bf54aa80b7e7776c7a4cc604157f"}
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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
