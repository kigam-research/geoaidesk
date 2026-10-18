# Raw-data guard

The raw-data guard checks file and shell tools before execution for the lead
agent and background specialists. It reduces accidental changes to raw data
and files outside the project. Tools still run with the current OS user's
filesystem access.

## What it does

- Protected paths are read-only for the agent. By default this means everything
  under `user_data/` (your uploads). `write`, `edit`, `generate_image`, and shell
  commands that would mutate a protected path are refused before execution.
  The reason tells the model to copy the data into a working folder such as
  `derived/` and operate on the copy. Reading is unaffected.
- Writes outside the project's sandbox ask first when `destructiveConfirm` is
  on. The guard checks file-tool targets and recognized shell mutations:
  redirects, `tee`, `cp`/`mv` destinations (`mv` sources too), `rm`, `mkdir`,
  `touch`, `ln` destinations, `install`, `chmod`, `sed -i`, `perl -i`, `dd of=`,
  and the existing `find`, `xargs` and destructive Git patterns. It tracks `cd`
  lexically, collapses `.`/`..`, and recognizes home paths (`~`, `$HOME`,
  `${HOME}`). The permission card identifies the outside-project change,
  target path and command or file operation. Other shell variables remain
  unresolved and recognized mutations using them can ask for confirmation.
- The sandbox, the OS temporary directory (`os.tmpdir()`), `/tmp`, and the exact
  path `/dev/null` do not require an outside-project confirmation. Protected
  paths still take priority. Existing destructive-command checks still apply;
  recursive removal of non-protected working subtrees is allowed as described below.
  Reading outside files or copying them into the sandbox does not ask.
- Destructive shell commands also ask first when `destructiveConfirm` is on:
  `rm -rf <dir>`, `git clean -f`, `git reset --hard`, `git checkout -- .`,
  `find … -delete`, `shred`, and `dd`. Routine recursive clean-ups such as
  `.venv`, `node_modules`, and `__pycache__` are allowed, as are other literal
  working subtrees (for example `derived/mpm_run/outputs/folds`) when all targets
  resolve inside the sandbox and cannot contain protected paths, `.pi/` or `.kady/`.
  Removing the sandbox root, protected ancestors, internal state, unresolved
  variables and wildcard targets remains guarded. Explicit temporary subtrees
  under `/tmp` or the OS temporary directory are also allowed. An outside-project target takes priority over the destructive
  title; a protected target is blocked without asking.
- For either kind of request, you can allow the operation once or deny it.
  No answer within ten minutes, stopping the run, or no interactive run to
  display the card blocks the operation. A pending card is restored when the
  chat reconnects.
- Background specialists use the vendored `kady-guard` Pi package. They have
  no confirmation UI, so outside-project writes and destructive commands are
  blocked outright, even when the lead's `destructiveConfirm` switch is off.
  The reason asks the specialist to report the target or command to the lead.
  Protected-path blocks and temporary-directory allowances are shared.

## Configuring it

Settings → General (the Project group) → Raw-data guard, saved with the card's
own Save button:

- Protected paths: one sandbox-relative glob per line (`user_data/**`,
  `raw/*.csv`, `reference`). A plain path protects its whole subtree. Changes
  apply immediately, including to live chats.
- Ask before destructive shell commands: this existing switch controls both
  destructive-shell and outside-project confirmations for the lead agent.
  Turning it off skips both confirmations; protected paths remain read-only.

The policy lives in `sandbox/.kady/policy.json`. Lead and child processes read
that file on each tool call.

## Limits

This is a heuristic guard, not a security boundary. It recognizes common
mutation patterns without executing or fully parsing the shell. A Python
script or any other program launched through `bash` can still write anywhere
the OS user can write. Aliases, unusual utilities, dynamic shell expansion,
subshells and complex option combinations can evade classification or cause
false positives. Paths are resolved lexically; symlinks are not followed, so
a sandbox path pointing outside can evade the outside-project check. The
permission card shows the first recognized outside target; allowing it once
allows the entire tool call, including any additional targets in that command.
Keep backups of irreplaceable raw data. See
[limitations](./limitations.md#local-shell-trust-boundary) for the trust model.
