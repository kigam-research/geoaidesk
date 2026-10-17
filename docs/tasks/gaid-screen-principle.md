---
format: 1
status: done
updated: 2026-10-17T00:13:48Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"d759b1f0-0402-40f9-808a-39d3cb2ebda7","pid":2621260,"provider":"claude","session":"b02fbf17-ebb4-43b8-b72e-c3ca401b410a","start":"8295692","token":"358cbec5c59e65ced92221015167899359873e80e714cc98e0319ef0fe35c3e6"}
branch: task/gaid-screen-principle
target: main
parent: 
---
# gaid-screen-principle

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-screen-principle` (geoaidesk) — add one screen-design principle

This unit answers forwarded goal 3bc1b941ec2c from the backbone hub. Read /home/seongin3/data/geoaidesk/work/hub/3bc1b941ec2c.md
first (user's verbatim words, source decision, text to add). Small documentation change; no UI code change.

Hub facts (verified 2026-10-17):
- geoaidesk already has a UI guide: docs/design/ui-guide.md (gaid-ui-guide, main 6d736bf; values geo/ui/ui-rules.json,
  check geo/ui/check-ui.mjs) and an AGENTS.md "UI guide" rule that sends agents to its sections 1 and 9. As the user asked
  ("이미개선된부분이 있는지는 참고한뒤"), check what the guide already says about researcher-facing screens (information
  density, readable type sizes, agent internals hidden) and add the principle where agents read it first — e.g. section 1
  of the guide, cross-referencing existing rule ids — without duplicating or contradicting existing rules. Mention it in
  the AGENTS.md "UI guide" bullet only if that is where it is clearest; keep the AGENTS.md change to one short clause.
- Link to backbone's pstack-stage1 rule (docs/agent-procedures.md: 2–3 named drafts for look-dependent choices,
  `task review-copy`) only if it helps; do not copy it.
- No report needed (documentation change). Checks: scripts/check (copy/UI checks must stay green). Keep the change small.

## Current state
Result for goal 3bc1b941ec2c: geoaidesk now carries the screen-design principle as rule P7 in section 1 of
docs/design/ui-guide.md, the section AGENTS.md already tells agents to read before any UI work, so AGENTS.md is
unchanged. P7: "Design screens for human researchers. Lead with figures, maps and short labels; text explains them,
it does not replace them. Use readable type sizes (T1, nothing below 12 px) and keep agent evidence (commit SHAs,
check receipts, run logs) out of the main view (R1, R4)." Checked against what the guide already had (the user's
"이미개선된부분이 있는지는 참고한뒤"): density (P3, W5), readable type (T1), agent internals hidden (P6, R1) were
already rules, so P7 cross-references them and adds no new limit. New content: figures/maps/short labels first, and
R1's list now names commit SHAs and check receipts. The backbone draft-comparison rule was not linked (not needed
for this rule). No UI code change. Check: scripts/check passed on 2026-10-17 (second run; the first failed only a web map-viewer
timing test under a concurrent check, which passed 8/8 alone). Copy warnings shown are pre-existing; no locale edited.
## Next steps
<!-- task:closed -->
Closed 2026-10-17T00:13:48Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Placement: ui-guide section 1 (read first per AGENTS.md "UI guide" bullet); no AGENTS.md edit needed.
- skillHub install preview shows a package SHA-256; it sits in Settings → Skills (a configuration view), so R1's
  addition does not conflict with it.
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
