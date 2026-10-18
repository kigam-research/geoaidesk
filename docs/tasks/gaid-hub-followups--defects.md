---
format: 1
status: waiting
updated: 2026-10-18T04:43:06Z
writer: {"host":"seongin3","reserved":"706cb393c680deb9e7376fd62f4fb19feaf63b84034021c2e3f99c9c33c86a07"}
branch: task/gaid-hub-followups--defects
target: task/gaid-hub-followups
parent: gaid-hub-followups
---
# gaid-hub-followups--defects

## Goal and done criteria
Request from the starter:

# Child unit: gaid-hub-followups--defects (GeoAIDesk)

Parent: gaid-hub-followups (Claude writer). User request, verbatim (2026-10-18): "gaid-hub-integration와 gaid-hub의 작업 및 개선 작업에 대해 권장 옵션으로 작업 진행하자." then "시작하자."
Your package = the GAID defects from reports/2026-10-16-gaid-hub-integration/index.md section 5 and
reports/2026-10-16-gaid-hub/index.md section 5, fixed under the GAID screen rules (docs/design/ui-guide.md: read sections
1, 9 and F/B before UI work; copy rules in AGENTS.md "UI copy and locales"; every visible string in web/src/geo/locales).

Network note: the KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"`.

## Items (done = each works in the real app path and has a focused test)
1. Long-run progress in chat. The running tool card (web/src/components/tool-activity.tsx:186, StatusDot :166) shows only a
   spinner. Add an elapsed-time label (e.g. "3분 12초째 실행 중") from ActivityItem.timestamp (web/src/lib/use-agent.ts:29),
   ticking while running. Optionally forward a capped tail of Pi's bash partialResult in tool_update
   (server/src/agent/events.ts:460) and show the last output line under a disclosure — only if it stays within R1 (no
   command lines in the main view; a raw-output tail belongs behind a collapsed disclosure). Follow F1.
2. Installed hub methods in task suggestions for an uploaded file. web/src/geo/workspace/file-actions.tsx:25 calls
   POST /geo/suggestions (server/src/geo/routes/workspace.ts:66, server/src/geo/workspace/suggestions.ts:62) which only
   sees catalogue workflows. Include installed method Workflows (listLocalMethods, server/src/geo/methods/local-methods.ts:99;
   LocalMethodWorkflow extends GeoWorkflowSummary) using their inputRoles formats as the signal, carry `exposure`
   (`method:<slug>:<workflow>`) and open TaskSetup with that exposure, as web/src/geo/methods/methods.tsx:112 does. Methods
   whose input format matches the file come first.
3. Open CSV over 8 MB in the file panel: refreshOpenTabs (web/src/lib/use-sandbox.ts:706; polls page.tsx:518 every 1.5 s
   while streaming and use-sandbox.ts:741 every 15 s) re-requests it and gets 413 from server/src/api/sandbox.ts:383 forever
   (2,138 console errors in one session). Stop the loop: remember "too large" per path+mtime/etag and skip it until the file
   changes (prefer: server sends an ETag with the 413 so a 304 can follow; client keeps it). The panel keeps showing its
   existing too-large message.
4. web/src/geo/workspace/chat-actions.tsx:14 icon-only "방금 한 분석을 skill_hub 초안으로 보내기" button (mounted at
   web/src/components/chat-tab.tsx:1319): give it a visible short text label (W1 ≤ 16 chars, B3 object+action, e.g.
   "허브 초안으로 보내기"; "skill_hub" is now the GAID hub, see AGENTS.md "GAID hub"). Do NOT change the HandoffDialog
   (web/src/geo/hub-handoff/dialog.tsx) or server/src/geo/hub-handoff/ — the parent owns those (it adds the GAID-hub receive).
5. Chat "실행 중단" must also stop background computation the agent started. POST /sessions/:id/abort
   (server/src/api/sessions.ts:509) only calls session.abort(); Pi's bash kills its process group only while the bash call is
   still running, so `nohup ... &` / setsid children survive. Track the processes each session's bash calls start (e.g. an
   env marker such as GAID_SESSION_ID=<id> injected into the bash tool's environment, then find and kill those process
   groups on abort; or record pgids through the bash spawn hook) and terminate them (SIGTERM, then SIGKILL after a short
   grace) on abort and on session dispose. Lead only is required; children of subagents are optional. Linux first; on
   Windows degrade to a no-op with no error. Add a test that starts `sleep 300 &` (detached) through the session path and
   checks it is gone after abort.
6. The data-protection confirmation must not block unattended trials. In the v5 trial, `rm -rf derived/mpm_run/outputs/folds`
   (inside the sandbox) paused for confirmation; there was a second prompt in the same trial — find it in
   ~/data/geoaidesk/work/gaid-hub/home/projects/yilgarn-40km-2a436b/sandbox/.pi/sessions/*.jsonl (read-only) and in
   server/src/agent/bash-classifier.ts. Recommended direction: recursive removals whose targets all resolve inside the
   sandbox, outside the protected globs (user_data/** by default) and outside .kady/.pi, are not "destructive" (they cannot
   touch the researcher's raw data or outside files); keep prompting for outside-project and protected targets. The
   classifier is copied byte-for-byte into server/pi-packages/kady-guard/classifier.ts (parity test
   bash-classifier.test.ts) — change both. Update docs/data-guard.md. If you find the second prompt needs a different
   rule, apply the same principle (inside-sandbox, non-protected work does not prompt).

## Rules
- Work only in your printed worktree. Before editing an upstream file (outside geo/, server/src/geo/, web/src/geo/), add it to
  geo/integration-boundaries.json with owner "gaid-hub-followups". Keep Korean first, English the same meaning.
- Do not touch: server/src/geo/authoring/**, server/src/geo/hub-handoff/**, web/src/geo/hub/**, web/src/geo/hub-handoff/**,
  web/src/geo/workspace/task-setup.tsx, server/src/geo/methods/trials.ts (parent and sibling own them). If you need a change
  there, write it in your task document and tell the parent.
- Checks: targeted vitest for changed areas + `cd server && npm run typecheck`, `cd web && npx tsc --noEmit`,
  `node geo/ui/check-ui.mjs`, `node geo/copy/validate-copy.mjs web/src/geo/locales`. Run the full scripts/check once before
  task finish (it needs the catalogue asset; it is on this PC).
- UI changes: Korean screenshots at 1440x900 and 1280x800 of the changed views (use the playwright-cli skill, PC74; run your
  own dev instance with data under ~/data/geoaidesk/work/gaid-hub-followups--defects/, ports 3340/18340, through
  `systemd-run --user` with file logs; never inside the repo). Put the small PNGs and a section text for the parent's report
  (Korean, rule ids followed, string ids with ko/en before→after) in your task document's Current state, and the PNGs under
  ~/data/geoaidesk/work/gaid-hub-followups/figures/defects/. The parent writes the one report.
- Finish with `task finish`. No report of your own.

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
