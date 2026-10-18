---
format: 1
status: active
updated: 2026-10-18T05:00:58Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"67556782-4e39-4225-a8e6-ec2cfcbc0a94","pid":2562420,"provider":"codex","session":"01a14d52-3852-76d0-91eb-002d0c05241d","start":"18653523","token":"706cb393c680deb9e7376fd62f4fb19feaf63b84034021c2e3f99c9c33c86a07"}
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
All six code changes are implemented. No deployment or parent integration yet. Full scripts/check job job-geoaidesk-gaid-hub-followups--defects-1 at a68e8e1ea773 exited 1. Backend: 169 files / 1,873 tests passed; 1 file / 11 tests skipped visibly. Frontend: 156 files / 1,051 tests passed; 13 failures in 3 files (details below). Downstream distribution/production stages did not execute.

- Running activities tick elapsed minutes/seconds from ActivityItem.timestamp; completed/error items unmount the timer. Bash commands remain in the collapsed disclosure; the main bash label is localized.
- POST /geo/suggestions includes installed, enabled method Workflows, prioritized by matching declared input format (including generic CSV without catalogue-only column heuristics). The response carries the method exposure and complete Workflow. FileActions binds the current file and opens the correct TaskSetup even when catalogue/method ids collide or the catalogue is off. Pi project-over-global shadowing is preserved.
- Oversized previews return ETag with 413, answer unchanged requests with 304 before the size check, and resume ordinary preview after change. The client retains the 413 validator and existing message. Actual browser observation: one initial 413, then nine 304 responses during a running-chat fixture (no repeating 413).
- The hub action has a visible label. Parent-owned hubHandoff locale files were imported unchanged from cdda9dcf98b8e88e336e7e8f6f7dd9c7e5bde797 under explicit file-only authorization. Composer controls wrap to keep the label and send/stop reachable at 1280×800.
- Lead bash tools inherit an opaque per-project/session process marker. Linux abort (including the existing HTTP path through session.abort) and registry disposal send TERM, then KILL after 350 ms, to matching processes, including detached nohup/setsid jobs. Another chat is unaffected. Windows is a no-op beyond Pi's existing abort. Existing shellPath/commandPrefix settings are retained. No subagent ownership claim.
- Literal recursive cleanup of non-protected sandbox work no longer asks for confirmation. Sandbox root, protected ancestors, .pi/.kady, wildcard/unresolved and outside targets remain guarded. Classifier parity is retained. Exact supplied trial replay confirmed only rm -rf outputs/folds; a second prompt is not evidenced in that JSONL snapshot. Parent accepted this limitation.

Focused verification so far: server workspace, guard hook/classifier and oversized-cache tests pass; real-session detached process/other-chat/disposal/shell-prefix test passes; existing session-registry tests pass. Frontend elapsed timer/cache tests (25) and method-selection/visible-handoff tests (2) pass. Server and web typechecks passed after process/suggestion changes; full scripts/check will recheck the final snapshot. UI validator (final strings): 11,110 strings, 0 errors, 102 pre-existing accepted debt. Copy validator: 0 errors, 57 existing warnings.

### Korean section for the parent report (humanizer file-mode reviewed)

장시간 계산 중인 채팅에 경과시간을 표시했습니다. 설치한 방법 중 파일 형식과 맞는 방법을 먼저 추천하며, 추천을 누르면 해당 방법의 작업 설정에 현재 파일이 연결됩니다. 8 MB를 넘는 CSV는 기존 크기 제한 안내를 유지하고, 파일이 바뀌지 않았으면 본문을 다시 받지 않습니다. 실제 화면에서는 첫 요청의 413 이후 304 응답을 확인했습니다.

허브 전송 버튼에 ‘허브 초안으로 보내기’를 표시했습니다. 1280×800에서도 버튼이 잘리지 않도록 입력창의 동작 버튼이 줄바꿈됩니다. 실행 중단과 대화 정리는 Linux에서 해당 채팅이 시작한 백그라운드 계산도 종료합니다. 다른 채팅의 계산은 유지되는지 시험했습니다. Windows에서는 기존 실행 중단 동작을 유지합니다.

보호된 자료와 내부 상태 폴더를 포함하지 않는 작업 폴더의 재귀 삭제는 확인 창 없이 실행됩니다. 제공된 시험 기록에서는 outputs/folds 삭제 확인 한 건을 확인했습니다. 두 번째 확인 요청은 기록에서 확인하지 못했습니다. 연구 계산을 다시 수행한 결과는 아니며, 화면의 실행 상태는 모델을 호출하지 않는 고정 응답으로 재현했습니다. 파일 추천·큰 파일 응답과 백그라운드 프로세스 시험에는 실제 앱 경로를 사용했습니다.

화면 규칙: P3, P4, F1, B3, W1, L6, A1, R1을 따릅니다. 새 예외는 추가하지 않았습니다. 두 해상도에서 동작 버튼과 상태 표시를 확인했습니다. 명령줄은 접힌 상세 영역에만 있습니다.

| String id | Korean before → after | English before → after |
| --- | --- | --- |
| workspace.run.elapsed | 없음 → {minutes}분 {seconds}초째 실행 중 | absent → Running for {minutes}m {seconds}s |
| workspace.run.analysis | bash → 분석 실행 | bash → Run analysis |
| hubHandoff.openLabel (parent-owned) | 없음 → 허브 초안으로 보내기 | absent → Send to hub draft |
| hubHandoff.open (parent-owned) | 방금 한 분석을 skill_hub 초안으로 보내기 → 방금 한 분석을 GAID 허브 초안으로 보내기 | Send the analysis just done to a skill_hub draft → Send the analysis just done to a GAID hub draft |

Screenshots (parent should copy into its canonical report's figures/):
- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/defects/progress-method-{1440,1280}.png
- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/defects/large-file-{1440,1280}.png
- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/defects/method-setup-{1440,1280}.png

Safe re-verification: use npm test focused files in server/test/{geo-session-processes,session-registry,geo-workspace,bash-classifier,data-guard,sandbox-file-cache}.test.ts and web/src/{components/tool-activity,lib/use-sandbox-refresh,geo/workspace/file-actions}.test.tsx; scripts/check is the full declared check. Screenshot fixture scripts/logs are external under ~/data/geoaidesk/work/gaid-hub-followups--defects/. Do not replay any job recorded below.

## Next steps
1. Wait for recorded supplementary job 2, then inspect its receipt/log. It rechecks the full frontend (VITEST_MAX_WORKERS=4; only parent-owned old handoff test excluded) and all downstream stages skipped when scripts/check stopped. Backend code is unchanged since its full 1,873-test pass. Job 1 is terminal, not resumable.
2. Inspect every failure. Parent-owned web/src/geo/hub-handoff/hub-handoff.test.tsx is being rewritten with the parent HandoffDialog; do not edit it. If it is the only failing check, record "parent-owned test, fixed at integration" and task finish per parent authorization. Fix any other failure in this unit. Temporary browser/dev services are stopped.
## Failed approaches
- First full check: 11 failures in parent-owned hub-handoff.test.tsx (old skill_hub button names/old dialog text), accepted by parent as "parent-owned test, fixed at integration". Do not edit it here.
- First full check: workspace.test.tsx correctly caught catalogue-only suggestions appearing when catalogue is off. Fixed FileActions to keep only method-exposure suggestions without an active catalogue; installed methods remain available.
- First full check: map viewer first test timed out waiting for the viewport table during highly parallel frontend execution. No map code changed. All 8 map viewer tests passed in the isolated rerun; the original failure was consistent with resource contention. Rechecking the full frontend with VITEST_MAX_WORKERS=4 (supported by the installed Vitest) before finish.
- Initial resume calls encountered other live task transactions; retried after they completed (no lock edits).
- Initial elapsed string keys incorrectly repeated the namespace; focused rendering caught the missing lookup, fixed to nested namespace-local keys.
- SIGKILL delivery is asynchronous; the real detached-process test caught an immediate-state race. Added bounded post-signal observation before abort returns.
- Visual review caught a clipped hub label due to the composer inner nowrap query; removed only that inner nowrap rule and recaptured both sizes.
- Shell-prefix test initially assumed a settings file had been seeded by ensureProjectExists; it had not. The fixture now creates its own settings before session construction.
## Notes and decisions
- Supplementary verifier: /home/seongin3/data/geoaidesk/work/gaid-hub-followups--defects/verify-remainder.sh; sha256 105b4d173b7db4add57a4de64861c818ffc7aa0738556bd7dd061966621878b9. It does not alter scripts/check or parent tests. Full frontend excluding only the parent-owned handoff file, then launcher/distribution/copy/UI/environment/production smoke. Catalogue-off and installed-method UI focused rerun: 27 passed. Integration checkpoint cf126308e71b.
- Parent instruction after full-check launch: only the old hub-handoff.test.tsx button-name failure may remain for integration; do not edit the parent-owned test. No other failure is waived. At the bounded check on this instruction, the recorded job was still running through backend tests (no final exit/result yet).
- Parent clarification: chat-actions renders hubHandoff.openLabel, keeps hubHandoff.open for aria/title. Parent exclusively owns those locale keys; not edited here. Parent locale commit cdda9dc was received unchanged before UI/check verification.
- Integration order: UI feedback and label are independent; suggestion server/client contract is owned together; cache server/client contract is owned together; process lifecycle precedes abort/dispose tests. Only the main writer edits. Parent owns authoring, hub handoff, TaskSetup and trials; these remain untouched.
- Optional raw shell-output tail is omitted: elapsed time meets the feedback goal without introducing more machinery into the main view.
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
- /home/seongin3/data/geoaidesk/runs/gaid-hub-followups--defects-20261018T045312.006938Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-hub-followups--defects-20261018T050052.337343Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
