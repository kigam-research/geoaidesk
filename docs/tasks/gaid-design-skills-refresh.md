---
format: 1
status: waiting
updated: 2026-10-24T01:49:48Z
writer: {"host":"seongin3","reserved":"3dff85c378d3f25a9e25cd3e5cb5168bcefd62820b51026e8e6382502701c477"}
branch: task/gaid-design-skills-refresh
target: main
parent: 
---
# gaid-design-skills-refresh

## Goal and done criteria
Request from the starter:

# Goal: gaid-design-skills-refresh — item 5 (decision 2) of gaid-uiux-skills-scan: refresh the design-skill copies GAID agents read

Hub routing decision for 'route to wherever those copies should live now': skill_hub is legacy since 2026-10-20, so put the refreshed read-only copies in this repo at `.claude/skills/impeccable/` and `.claude/skills/design-taste-frontend/` (Claude Code agents working in geoaidesk worktrees discover them; Codex/other agents read them by path). Leave skill_hub untouched. Update AGENTS.md (the UI guide v2 bullet that says 'skills in skill_hub .claude/skills/') and any docs pointing there.

Done: impeccable skill-v4.7.0 and taste-skill v2.1.4 copied from their upstream repos at pinned tags/commits (record source URL, tag, commit, licence; check taste-skill's licence permits redistribution — if not, do not vendor it: document how to read it instead and report back), telemetry off (DO_NOT_TRACK or the skill's own switch documented), no global install, no change to ~/.claude. Keep brand-guide where it is unless the user decides otherwise. Add licences/notices (THIRD_PARTY_NOTICES.md). No file over 5 MB. KIGAM network blocks raw.githubusercontent.com — use gh api or codeload.github.com. Checks: scripts/check. Outside check: none.

## Forwarded goal (verbatim)

Goal from gaid-uiux-skills-scan (user-confirmed follow-up units).

User answer (verbatim, 2026-10-24) to the two decisions in reports/2026-10-24-gaid-uiux-skills-scan/index.md section 6:
"모두 권장으로 진행하자."

That means:
1. Implement scenario D first: UI quality kit. A development-only "부품 상태 견본" page (shared parts pinned in every state with
   the shadcn skill's data-preview custom variants, live token contrast table), shadcn lint (`shadcn-ui/lint`, MIT) mapped onto
   UI guide V1 rules, impeccable detect (Apache-2.0, telemetry off via DO_NOT_TRACK), Playwright screenshot comparison of the
   four combos (계측/도폭 × light/dark, 1440×900) and axe-core checks, added to scripts/check first as report-only, blocking
   later after false positives are settled. Fix the two facts found while drawing the kit: UI guide S1 names an `--on-signal`
   role that globals.css does not define (buttons use `--primary-foreground`); `web/src/components/ui/button.tsx` has no press
   (active) style although S7 requires one. Also check `web/src/components/tool-activity.tsx` BrainIcon/WandSparklesIcon against V2.
2. Then scenario A: hub recommended cards without a concept picture draw the Workflow's own analysis stages (from WorkflowDoc
   steps[]) plus input/output formats instead of the title-guessed icon; list rows show a stage-count readout; pictures keep
   precedence. Decide how this sits with UI guide I10 (scales only where they show a position).
3. Then scenario C: 서재 right-rail cards (ORCID, 서재 상태, Zotero) consolidate into one header connection-status button + popover;
   the right side becomes the selected paper's inspector; empty library explains connections in one line (F4).
4. Scenario B (chat analysis plan using shadcn AI Elements patterns, orbit instead of shimmer) is NOT to be implemented yet:
   first a separate discussion of where the plan signal comes from (Workflow steps vs an agent-declared plan, R1, provenance).
5. Decision 2: refresh the read-only design-skill copies GAID agents read (currently skill_hub `.claude/skills/`:
   impeccable 4.3.1, design-taste-frontend v1) to impeccable skill-v4.7.0 and taste-skill v2.1.4, telemetry off, no global
   install. Route to wherever those copies should live now (skill_hub is legacy since 2026-10-20).

Mockups (code-built from the real tokens/components, no generated images) and their source:
`pc74:~/data/geoaidesk/work/gaid-uiux-skills-scan/mockups-src.tgz`, shots in `.../shots/`. Report: reports/2026-10-24-gaid-uiux-skills-scan/index.md
(branch task/gaid-uiux-skills-scan until integrated). Lesson to keep: no generated imagery; the current system is the visual authority.

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
