---
format: 1
status: waiting
updated: 2026-10-20T13:55:24Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"5d1f02f4-c1d7-45c6-94b1-e23826920ff8","pid":2414289,"provider":"codex","session":"01a15998-92e0-72a2-bd54-db683ae2e7f0","start":"39247260","token":"492f28b4693ca05ccac8371ea73b8486e2156fde236a5b7544a88fa3795b321f"}
branch: task/gaid-workflow-model--cli
target: task/gaid-workflow-model
parent: gaid-workflow-model
---
# gaid-workflow-model--cli

## Goal and done criteria
Request from the starter:

# Child task: gaid-workflow-model--cli ("CLI에서 쓰기")

Parent: gaid-workflow-model (geoaidesk). Read first: ADR docs/adr/2026-10-20-workflow-runtime-form.md (accepted),
report reports/2026-10-20-gaid-workflow-model/index.md §3.12–3.14, and the shared contract
web/src/geo/contracts/workflow-doc.ts (renderWorkflowDocument with target "cli"), server/src/geo/workflow-doc.ts
(workflowDocFor, workflowDocSay), web/src/geo/workflow/render.ts. skill_hub is legacy: no skill_hub work.

## Goal
A researcher can take any Workflow GAID shows (catalogue "기본 Workflow", a Workflow installed in the project from the
hub, a registered hub entry) and use it in a CLI agent: download a folder (zip) that holds
1. the Workflow 지침 rendered with target "cli" (settings come from `$ARGUMENTS`; empty → the agent asks for the listed
   conditions) as the CLI's prompt/command file, and
2. every skill the Workflow uses as an Agent Skills folder (SKILL.md + its files) — catalogue skills from the pinned
   catalogue staging, the bundled skill from the installed package / hub snapshot package, imported skills from the
   project's installed copy (skip with a note in a README when absent),
3. a short README (Korean and English) saying how to start it in that CLI.

Targets, each offered only after you verified it with the real CLI on PC74:
- Pi (reference; GAID itself runs Pi): `.pi/prompts/<workflow-id>.md` + `.pi/skills/<name>/` (Pi prompt template
  frontmatter `description`, `argument-hint`; `$ARGUMENTS`/`$@` substitution). CLI: `node <server>/node_modules/@earendil-works/pi-coding-agent/dist/cli.js`.
- Claude Code (`/home/seongin3/.local/bin/claude`): `.claude/commands/<id>.md` + `.claude/skills/<name>/`.
- Codex (`/home/seongin3/.local/bin/codex`): find the current prompt/skills locations (Context7 docs or `codex --help`;
  raw.githubusercontent.com is blocked on this network). If you cannot verify one, leave it out and say so.
Verification = in a scratch dir under ~/data/geoaidesk/work/gaid-workflow-model--cli/, unpack the export, start the
CLI non-interactively where possible, and confirm (a) the command/prompt is listed or expands with the argument text
and (b) the skill is discovered. Do not run a full analysis and do not spend model budget beyond the minimum
non-interactive check; record what was checked. Never read or print credentials.

## Interfaces (fixed by the parent)
- Server: `GET /geo/workflows/:id/cli-export?target=pi|claude|codex` (project-scoped via X-Project-Id; resolves a
  catalogue Workflow id, or an installed method Workflow via `?method=<runtimeName>`) and
  `GET /geo/hub/entries/:id/cli-export?target=…` (latest registered revision). Response: `application/zip`,
  `Content-Disposition` filename `<workflow-id>-<target>.zip`. Use workflowDocFor + renderWorkflowDocument(target "cli")
  with workflowDocSay; locale from `?locale=ko|en` (default ko). Bound sizes (reuse existing package limits) and
  never include files outside the skill folders; no absolute paths in the files.
- Web: `web/src/geo/workflow/cli-export.tsx` exporting
  `CliExportButton({ source }: { source: { kind: "project"; workflowId: string; method?: string } | { kind: "hub"; entryId: string } })`
  — a "CLI에서 쓰기" control that lets the researcher pick a verified target and downloads (use `withApiToken()` /
  existing download helpers for URLs the browser loads). The parent and the views child place it; you may place it in
  one screen to test. Copy goes in a new locale namespace `workflowCli` (ko first, en same meaning) — do not edit other
  namespaces.
- Tests: server route tests (zip contents, both sources, target layouts, size/path safety) and a web test for the
  button.

## Rules and checks
Follow AGENTS.md (UI copy rules, ui-guide sections 1/9, integration-boundaries for any upstream file you touch with
owner gaid-workflow-model). Isolated GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model--cli/ (copy of
~/data/geoaidesk/work/gaid-workflow-model/home is fine; never ~/.geoaidesk). Run scripts/check; remove build caches
before finishing. Put the evidence (layouts verified per CLI with commands run and outcomes, string ids, tests,
check results) in your task document's Current state, first and self-contained.

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
