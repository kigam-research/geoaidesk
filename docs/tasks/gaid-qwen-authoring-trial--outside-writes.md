---
format: 1
status: waiting
updated: 2026-10-15T13:52:02Z
writer: {"host":"seongin3","reserved":"b0845f03617ec5fec6a81b6335a63097afbad9aae9e7139698eec72bd755f81a"}
branch: task/gaid-qwen-authoring-trial--outside-writes
target: task/gaid-qwen-authoring-trial
parent: gaid-qwen-authoring-trial
---
# gaid-qwen-authoring-trial--outside-writes

## Goal and done criteria
Request from the starter:

# Child brief: confirm agent writes outside the project

Parent unit: gaid-qwen-authoring-trial (repo geoaidesk). You are a child writer; your branch merges into the parent.
Read AGENTS.md (the "Raw-data guard" caveat) and docs/data-guard.md first.

## Why (observed 2026-10-15 in the parent's trial)
GAID's in-app agent (a local Qwen model), asked by a researcher to put a workflow "in the app's list", wrote outside its
project without any prompt: it edited the app install's `geo/distribution.json`, created `~/assets/geo-catalogue/0.2.2/`
and `<GAID_HOME>/catalogue/`. Only its own `rm -rf` got a confirmation card. The user chose (verbatim answer "모두
권장으로 하자" to the option "확인 창을 띄우고 에이전트 지침에도 금지를 적습니다"): show a confirmation card before the agent
writes outside the project, and state the rule in the agent guidance (the parent already added the guidance line).

## Goal and design
- Lead agent (`server/src/agent/data-guard.ts`): `write` / `edit` / `generate_image` whose target resolves outside the
  sandbox, and `bash` commands whose mutating targets resolve outside the sandbox (redirections, `tee`, `cp`/`mv`/`rm`/
  `mkdir`/`touch`/`ln`/`chmod`/`sed -i` … targets — whatever the classifier already extracts), raise the existing
  permission request (same card, allow once / deny), governed by the existing `destructiveConfirm` policy switch.
  Allowed without asking: the sandbox, the OS temp dir (`os.tmpdir()`, `/tmp`), `/dev/null`. Reads are not gated.
- Classifier (`server/src/agent/bash-classifier.ts`): a new verdict kind for outside-project writes; keep it pure. The
  child copy `server/pi-packages/kady-guard/classifier.ts` must stay byte-identical (parity test
  `bash-classifier.test.ts`); child processes have no UI, so the child package blocks outside writes outright (same
  allowances) with a clear reason.
- Permission payload gets a kind (e.g. `kind: "outside-project"`, path) so the card can title it correctly; card:
  `web/src/components/permission-card.tsx` (title per kind; Korean first, English with the same meaning; strings in
  `web/src/geo/locales/work/{ko,en}.json`, follow `geo/copy/gaid-writing.md`). The parent hid the guard's English
  "Destructive shell command:" reason on the card; keep the model-facing reason strings in English and hide them on the
  card the same way.
- Honest limits: a Python script or other program run through `bash` can still write anywhere; say so in
  docs/data-guard.md (heuristic, not a security boundary).

## Scope and ownership
Own: data-guard.ts, bash-classifier.ts, kady-guard/classifier.ts (+ its index if needed), permissions payload,
permission-card.tsx (+ test), docs/data-guard.md, their tests. Do NOT edit: modal-related files (a sibling switches Modal
off), `server/src/geo/**`, `web/src/geo/workspace/**`, `web/src/components/skills-panel.tsx`, `geo/copy/**`.
Upstream files you edit go in `geo/integration-boundaries.json` as one appended seam with
`"owner": "gaid-qwen-authoring-trial"` (already allowed).

## Checks and evidence
Server: `npm run typecheck`, `npx vitest run test/bash-classifier.test.ts test/data-guard*.test.ts` (and any test you
touch); web: `npx tsc --noEmit`, permission-card test; `node geo/copy/validate-copy.mjs web/src/geo/locales`;
`node --test geo/tests/distribution.test.mjs`. The parent runs the full `scripts/check` after integration. Report the
cases covered (table of command → verdict), tests run, and the limits. No network needed (raw.githubusercontent.com is
blocked anyway). Remove build caches you created in your worktree before finishing.

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
