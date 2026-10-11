# Hosted cloud work policy (backbone)

For hosted cloud sessions (Claude web, Codex cloud) in a repo whose AGENTS.md has "Work policy v1". Local or Paseo
sessions use the `task` CLI instead and do not need this file. Copy it into a managed repo as docs/cloud-policy.md.

- Work only on your own new branch from fresh origin/main; never continue a task branch owned by a local
  session. Confirm a genuinely new goal once unless the user already named it.
- Delegate available native readers with a short goal, artifact/revision, scope, allowed actions and evidence
  contract. The main session owns edits, checks and publication; no parallel writers without a verified isolated
  ownership/integration path. If delegation is unavailable, continue in the main session. Do not assume local
  plugins, home instructions or Paseo profiles exist in cloud, or install a local peer runtime merely for review.
  Fixed personas are unnecessary; add task-specific criteria.
- Writers and reviewers lead with whether the user's outcome/normal workflow is achieved and the evidence or
  gap. Review contracts include that outcome, acceptance evidence, scope/exclusions and accepted tradeoffs (see
  templates/independent-review.md when available). Block on concrete failures with realistic preconditions and
  material goal impact, not severity labels or hypothetical hardening. Preserve work-loss protections and
  assess usability/automation lost to safeguards. Writers triage blockers vs optional suggestions/uncertainties
  instead of fixing every finding. Keep declared checks; use proportionate evidence, without new tests merely
  for prose or to mirror implementation. Rechecks cover agreed fixes and introduced material regressions. Stop
  with sufficient goal evidence and relevant blockers resolved; reopen accepted tradeoffs only for new material
  evidence. No mandatory extra reviewer/round, invented hostile-actor model, or new approval gate.
- Cloud-to-local connectors do not exempt local workers from the local task policy. A wrapper's own
  worktree/WIP/publish flow is not a verified writer path for this repo; preserve existing legacy runs.
- Standing user request for this task: commit and push reviewed task files, open this task's PR and merge it
  without asking, within the current user and tool limits. Never stage .env*, secrets/, secure/, *.pem, *.key,
  id_* (at any depth) or files over 5MB. No force-push or history rewrite.
- Keep docs/tasks/<slug>.md current by replacing it: goal, verified state, next steps, failed approaches. No
  task status or history in AGENTS.md or PROJECT.md.
- To finish: merge fresh origin/main, run the declared checks on the final commit, push, open the PR, and merge
  it with a merge commit (not squash or rebase). Do not delete branches; local cleanup does. If checks are
  unavailable in the cloud, report that instead of claiming they passed.
- On a requested handoff or repeated no-progress attempts, push the updated task document; if the push fails,
  report local-only state. Ask the user on judgment-dependent conflicts or unfixable checks.
- Agent-facing text in English; answers to the user in Korean 합니다체.

## Delegated cloud run
A local task writer may submit a cloud session as a delegated run of its own unit. The submitted prompt then starts
with templates/cloud-delegated.md and names a base commit and a result branch `cloud/<slug>/<n>`. A delegated run
follows that preamble instead of the rules above: it pushes only the result branch and never opens a pull request,
merges or edits task documents. Claude ends with a `cloud-result.json` record commit; Codex leaves a final diff and a `cloud-result:` line.
The local writer collects only the recorded result commit or final diff, checks it and finishes the unit as usual.

Local writer commands (inside the owning unit worktree):
- `task cloud submit codex|claude --prompt-file F [--base SHA]` records intent before submission and starts a watcher
  through `task job run`. Codex needs a repo environment id in `~/.config/backbone/cloud.json` under
  `codex.environments.<repo name>`.
- `task cloud submit --recover <run> [--session <provider id>]` finds an existing submission and attaches its watcher.
  It never submits again. If the submission is unknown, look for the printed title and supply its session id.
- `task cloud watch <run> [--max-wait SECONDS]` waits at most 6 hours by default. Exit 0 means a terminal result;
  exit 3 means timeout, not a running job. A checkpoint without the result record is not completion.
- `task cloud list` shows this unit's runs and watcher outcomes.
- `task cloud collect <run>` merges only Claude's recorded result commit or applies Codex's final diff.
  It reports blocked, failed and no-change separately without merging. Conflicts leave the writer worktree unchanged.
  Review the result and save the updated run record before finishing.
