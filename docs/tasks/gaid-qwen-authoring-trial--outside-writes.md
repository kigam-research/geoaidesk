---
format: 1
status: active
updated: 2026-10-15T14:10:18Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"ffc3948e-1dea-402c-8e2c-549c8367b527","pid":493121,"provider":"codex","session":"01a13fd5-b49b-72f1-bc25-6c5b0b437e72","start":"53833288","token":"b0845f03617ec5fec6a81b6335a63097afbad9aae9e7139698eec72bd755f81a"}
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
Implemented the requested outside-project confirmation. Lead write/edit/generate_image and recognized shell mutations carry kind/path through the existing allow-once/deny permission lifecycle; the existing destructiveConfirm switch governs both confirmations. Children block outside writes without a UI. Sandbox/OS-temp/null allowances, reads, protected-path precedence and classifier parity are covered. Scoped checks passed: server 224 tests, web 25 tests, distribution 7 tests, both typechecks; copy validation has 0 errors and 56 unrelated existing warnings. task finish also automatically runs the repository-wide scripts/check: the first full attempt passed the backend (1775 passed, 11 skipped) but failed one unrelated map-viewer wait assertion in the full web suite; that file then passed alone (8 tests). Retrying finish with VITEST_MAX_WORKERS=4 to bound web-suite contention. Parent integration and deployment remain pending. No deployment or real Qwen/browser trial was performed here. Docs explicitly retain Python/program/symlink/parser limitations. Temporary dependency links and compiler cache are removed before finish.

## Next steps
<!-- task:closed -->
Closed 2026-10-15T14:02:49Z: ready; the parent gaid-qwen-authoring-trial integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Checks
- PASS: server npm run typecheck.
- PASS: server npx vitest run test/bash-classifier.test.ts test/data-guard.test.ts (224 tests, including byte parity, lead outcomes/policy, pending-card restore and child blocks).
- PASS: web npx tsc --noEmit.
- PASS: web npx vitest run src/components/permission-card.test.tsx src/lib/use-agent-events.test.ts (25 tests; old destructive payloads, outside kind/path, English/Korean titles, hidden model reason, allow/deny routes and event replay).
- PASS: node geo/copy/validate-copy.mjs web/src/geo/locales (0 errors, 56 warnings outside the three added IDs).
- PASS: node --test geo/tests/distribution.test.mjs (7 tests).
- PASS: git diff --check.
- The brief assigns full scripts/check to the parent, but task finish automatically invokes it here too. First attempt: backend 1775 passed / 11 skipped; web 1022 passed / 1 failed (map-viewer wait assertion). Isolated map-viewer rerun: 8 passed. Full-check log: ~/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-wzj64i37.log. Retry uses the installed Vitest-supported VITEST_MAX_WORKERS=4 (runtime env only; no test/config source workaround).
- Dependencies reused from the parent's external app snapshot through temporary node_modules symlinks; no dependency manifest/lockfile changed. Latest server test log: ~/data/geoaidesk/work/gaid-qwen-authoring-trial--outside-writes/server-check.log.

## Failed approaches
- Second finish reached the full-check web phase and failed the unrelated map-viewer wait assertion under the default parallel suite; isolated rerun passed. No map source/test edited.
- Final code review found optional rootless cwd resolution could consult the host cwd via path.resolve. Kept rootless paths relative, copied the classifier, and added two parity-run regression assertions; the requested pure-classifier contract is preserved (224 scoped server tests passed).
- First task finish checkpointed the code, then hit a merge conflict with parent 749160e in the appended integration-boundaries seam. Kept the parent's expanded existing responsibility and this child's new seam; no implementation conflict. All scoped checks passed again on the merged snapshot before rerunning task finish.
- Initial task resume met a sibling task transaction; retried after the sibling completed and resumed successfully at the original path.
- First new hook tests used ../outside under the Vitest /tmp sandbox. Those targets correctly matched the temporary-directory allowance, so the tests were corrected to /opt/gaid targets (and relative paths that actually escape /tmp). One child fixture retained the old target until the next correction. Final rerun passed.
- One UI test used status done rather than the existing complete enum. Corrected the fixture; web typecheck and tests passed.

## Notes and decisions
- Sequential decisions: retain protected-path priority; recognize lexical sandbox/home/temp paths with options supplied by the runtime; collect outside writes before destructive fallback. Reads remain ungated. No filesystem probing or host cwd lookup in the classifier. Node path normalization receives absolute runtime roots; homeDir/tempDirs are injected by the lead and child adapters.
- Owned interfaces: verdict kind `outside-project` with path; optional permission kind/path across broker -> activity -> card. Existing frames without kind retain destructive rendering.
- This is tightly coupled work across the classifier and permission path; no reader needed. Parent owns instructions and the final report; sibling owns Modal.
- Add the small `use-agent.ts` transport seam (required for kind/path to reach the card) and its existing event test.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None. The heuristic limitations are part of the accepted brief, not a new decision gate.
## Report
Contribution to the parent's canonical report (no separate child report):

### Result and limits
Outside-project mutations now use the existing confirmation card for the lead; children block them. Protected raw data stays blocked even in a compound command that also writes outside. The classifier is heuristic: Python/other programs, dynamic shell constructs and symlinks can still write outside; the card authorizes a whole tool call and names its first recognized outside target. The temporary-directory exception also applies when a test project happens to live in /tmp. Existing destructive checks remain separate.

### Representative covered commands
Options: sandbox /proj/sandbox; home /home/test; OS temp /var/tmp/custom.

| Command or file operation | Verdict |
|---|---|
| write/edit/generate_image /opt/gaid/file | outside-project (lead asks; child blocks) |
| echo x > /opt/gaid/geo/distribution.json | outside-project |
| echo x >> ../outside.txt | outside-project, /proj/outside.txt |
| tee /opt/gaid/file | outside-project |
| cp derived/a /opt/gaid/a; cp -t /opt/gaid derived/a | outside-project |
| mv /opt/gaid/a derived/a; mv derived/a /opt/gaid/a | outside-project (source and destination mutations) |
| rsync -a derived/ /opt/gaid/; install derived/a /opt/gaid/a | outside-project |
| install -d /opt/gaid derived/dir; ln -s derived/a /opt/gaid/link | outside-project |
| rm /opt/gaid/a; rm -rf ../elsewhere | outside-project |
| mkdir -p ~/assets/geo-catalogue/0.2.2 | outside-project |
| mkdir -p "$HOME/.geoaidesk/catalogue" | outside-project |
| touch /opt/gaid/file; chmod 600 /opt/gaid/file | outside-project |
| sed -i 's/a/b/' /opt/gaid/file; perl -pi -e 's/a/b/' /opt/gaid/file | outside-project |
| dd if=derived/a of=/opt/gaid/file; find /opt/gaid -name '*.tmp' -delete | outside-project |
| cd /opt/gaid && touch file; cd /opt/gaid; git reset --hard | outside-project |
| echo x > /proj/sandbox/../outside.txt; touch /tmp/../outside | outside-project after normalization |
| touch /tmp-other/file; touch /var/tmp/custom-other/file | outside-project (not a temp subtree) |
| cat /opt/gaid/file; cp /opt/gaid/a derived/a | allow (reads are not gated) |
| mkdir -p derived/a; sed -i 's/a/b/' derived/a | allow |
| echo x > /tmp/outside.txt; touch /var/tmp/custom/file; echo x > /dev/null | allow |
| cd /opt/gaid && cd /proj/sandbox && touch derived/file | allow |
| rm -rf results; git clean -fdx; git reset --hard HEAD~1 | destructive (existing confirmation) |
| touch /opt/file; rm user_data/a | protected (block takes priority) |
| perl -pi -e's/a/b/' user_data/a.csv; find . -exec rm user_data/a.csv | protected |

Windows drive, UNC and Git Bash protected paths and outside siblings remain covered by the shared table. Deny/timeout/no-UI/cancel block both kinds; allow permits one call. Switching destructiveConfirm off skips lead confirmations but not protected-path blocks or the child's outside-write block.

### Copy changes (new IDs; existing destructive copy unchanged)
All IDs are in work. Before: absent in both languages.

| ID suffix | Korean after | English after |
|---|---|---|
| permission_card.outside_project_pending | AI agent가 프로젝트 밖 파일을 변경하려고 합니다 | The AI agent wants to change files outside the project |
| permission_card.outside_project | 프로젝트 밖 파일 변경 | File change outside the project |
| permission_card.outside_project_target | 변경 대상: {path} | Target: {path} |

Updated docs/data-guard.md and the AGENTS.md Raw-data guard caveat to match. Applied humanizer file-mode prose review to docs/data-guard.md, retaining all conditions and the limits. No hero/approved copy changed.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
