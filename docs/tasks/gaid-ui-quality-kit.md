---
format: 1
status: active
updated: 2026-10-24T01:50:28Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8903c027-bae6-4d62-be5f-363a50e7cd24","pid":1209415,"provider":"claude","session":"75265567-6398-46a1-800a-916e466ecb73","start":"69452397","token":"e8629b2b35ed6c90a1d8703ce6bad2bc0e6d8d0733cee71031a1026cfc73221f"}
branch: task/gaid-ui-quality-kit
target: main
parent: 
---
# gaid-ui-quality-kit

## Goal and done criteria
Request from the starter:

# Goal: gaid-ui-quality-kit — scenario D of gaid-uiux-skills-scan: the UI quality kit

Forwarded, user-confirmed goal (full text below). This unit implements item 1 (scenario D) only. Items 2 (scenario A) and 3 (scenario C) follow as separate units after this one; item 4 (scenario B) is not to be implemented; item 5 (design-skill refresh) runs as unit gaid-design-skills-refresh in parallel.

Done: the development-only 부품 상태 견본 page; shadcn lint mapped onto UI guide rules; impeccable detect with DO_NOT_TRACK; Playwright screenshot comparison of 계측/도폭 × light/dark at 1440×900 and axe-core checks, added to scripts/check as report-only first (blocking later, after false positives are settled — record the rule for switching); fix the --on-signal / --primary-foreground mismatch (guide S1 vs globals.css), add the button press (active) style (S7), check tool-activity.tsx BrainIcon/WandSparklesIcon against V2. Report with rule ids and Korean screenshots. Report source of the scenario: reports/2026-10-24-gaid-uiux-skills-scan/index.md (branch task/gaid-uiux-skills-scan until integrated; git show origin/task/gaid-uiux-skills-scan:<path>), mockups pc74:~/data/geoaidesk/work/gaid-uiux-skills-scan/mockups-src.tgz and shots/. No generated imagery; the current system is the visual authority. Licences: shadcn-ui/lint MIT, impeccable Apache-2.0 — record them in THIRD_PARTY_NOTICES.md if code or rules are vendored. Do not touch the review app or hub server. Outside check: none.

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
