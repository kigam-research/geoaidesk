---
format: 1
status: done
updated: 2026-10-24T03:00:12Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"1a91e208-7b70-439e-8b39-477b8539d9b0","pid":1214844,"provider":"claude","session":"935f0de9-bf01-4092-ac64-61673682a5ce","start":"69454174","token":"3dff85c378d3f25a9e25cd3e5cb5168bcefd62820b51026e8e6382502701c477"}
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
- Done in the worktree: `.claude/skills/impeccable/` = upstream pbakaus/impeccable tag `skill-v4.7.0` commit
  `aeeb3d8c30b5f95aeeb3e893b0f1a308af8fdb8f`, path `.claude/skills/impeccable/` (Claude Code build; Apache-2.0);
  `.claude/skills/design-taste-frontend/` = Leonxlnx/taste-skill tag `v2.1.4` commit
  `6010f91a9935f1c167dfc500fb1a475681892e6b`, path `skills/taste-skill/` (frontmatter name `design-taste-frontend`; MIT,
  redistribution permitted with the notice). Fetched via codeload; `diff -r` identical incl. the one exec bit. Licences in
  `.claude/skills/licenses/`, provenance/telemetry/omissions in `.claude/skills/SOURCE.md`, THIRD_PARTY_NOTICES section
  "Design skills for developers", AGENTS.md UI guide v2 bullet repointed, `.gitignore` tracks only these copies under
  `.claude/` (+ ignores `/.taste-skill/`; boundaries entry updated). Largest file 1.1 MB (`impeccable/scripts/data/font-index.json`).
- Telemetry: `.impeccable/config.json` gains `"telemetry": false` (project opt-out). Verified with the 0.1.16 engine cached in
  `~/data/geoaidesk/work/gaid-design-skills-refresh/impeccable-home` (IMPECCABLE_HOME, `~/.impeccable` untouched):
  `telemetry status` in the repo = off (config), outside the repo = on. taste-skill has no telemetry.
- Not copied (deliberate): impeccable hook manifest (`.claude/settings.json`) and reviewer agents (`.claude/agents/`); they
  would change every Claude session in the repo. skill_hub and ~/.claude untouched. Historical task docs/reports that cite
  the skill_hub paths are left as dated records.
- scripts/check passed 2026-10-24 (exit 0; backend 2300 passed / 8 skipped, web 1289 passed, GAID checks and production
  smoke PASS; log ~/data/geoaidesk/work/gaid-design-skills-refresh/check.log).
## Next steps
<!-- task:closed -->
Closed 2026-10-24T03:00:12Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- No report: config/vendoring task (no result for user review). Small and coupled: no child writers.
- Optional (not done): vendor impeccable's reviewer agents / design hook if the user wants the full impeccable build loop
  in this repo; scenario D (gaid-ui-quality-kit) can call `.claude/skills/impeccable/scripts/impeccable detect` directly.
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
