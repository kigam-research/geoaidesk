---
format: 1
status: waiting
updated: 2026-10-24T04:41:00Z
writer: {"host":"seongin3","reserved":"00c14d6dd6304a7e205cd4a0aa93d107e3a761b0ada434db515eb05d24ebb6cf"}
branch: task/gaid-hub-stage-cards
target: main
parent: 
---
# gaid-hub-stage-cards

## Goal and done criteria
Request from the starter:

# Goal: gaid-hub-stage-cards — scenario A of gaid-uiux-skills-scan: hub cards show the Workflow's own analysis stages

User-confirmed follow-up (answer verbatim: "모두 권장으로 진행하자."), item 2 of the forwarded goal below. Order agreed: scenario D
(gaid-ui-quality-kit) → shared-part fix (gaid-ui-shared-contrast, user "gaid-ui-quality-kit#1 가로 진행하자.") → this unit → scenario C.

## Done

- Hub recommended cards without a concept picture draw the Workflow's own analysis stages (from WorkflowDoc `steps[]`, which are 3-5
  analysis-flow stages since gaid-workflow-stages) plus input/output formats, instead of the title-guessed icon; list rows show a
  stage-count readout; concept pictures keep precedence. Older Workflows without steps keep a sensible fallback (no invented stages).
- Decide and record how the stage diagram sits with UI guide I10 (scales only where they show a position): a stage diagram that is not a
  position readout must not reuse StepScale's graduated look, or the guide gets an amendment proposed for the user.
- Scenario mockups/shots: `pc74:~/data/geoaidesk/work/gaid-uiux-skills-scan/mockups-src.tgz` and `shots/`; report
  `reports/2026-10-24-gaid-uiux-skills-scan/index.md` (scenario A). No generated imagery; current system is the visual authority.
- The UI quality kit runs in scripts/check (report-only; impeccable/axe now at 0): keep them at 0 for your screens. Report with rule ids
  and Korean screenshots (계측/도폭 × light/dark, 1440×900 and 1280×800). Copy rules ("version", never 판). Checks: scripts/check.
- Fold in, where your screens are touched, the relevant items of open debt gaid-ui-audit#1 (hub authoring stage display differing from
  StepScale; native select boxes) only if small; otherwise leave them.

Do not touch the review app or the hub server; the hub deploys after integration. Outside check: none.

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
