---
format: 1
status: active
updated: 2026-10-11T08:16:41Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"d710da92-8f5d-43bb-b429-400890d2850d","pid":1176037,"provider":"codex","session":"01a12a08-5c19-71c3-9c52-877e889e02ec","start":"17255386","token":"7b5dc6eae16a3dd2ec7620f787d20642f161f7b59b932865ba211889ad0dd09a"}
branch: task/gaid-release-proof--install
target: task/gaid-release-proof
parent: gaid-release-proof
---
# gaid-release-proof--install

## Goal and done criteria
Request from the starter:

# Child writer brief: gaid-release-proof--install (geoaidesk, parent gaid-release-proof)

Goal: release-specific installation, deterministic preview, restart/reopen and update evidence for GeoAIDesk on the
advertised environments (plan decision D3: Linux/WSL first, Windows native P1, macOS untested), as scripts plus actual
records. Parent package: WP10 in skill_hub docs/specs/geo-byok-plan.md; done criteria that concern you: "clean installs
and deterministic previews work on advertised environments; existing projects/skills/history survive update; missing
combinations remain untested".

Base: the parent branch at d5702af or later. Read AGENTS.md, geo/release-proof/README.md (record format
`gaid-install-evidence/v1`) and geo/release-proof/instance.mjs (shared harness owned by the parent: use it; if it
needs a change, make the minimal change and say so in your task document).

Owned files (create): `geo/release-proof/install-proof.mjs`, `geo/release-proof/update-proof.mjs`, helpers under
`geo/release-proof/install-*`, a pure unit test `geo/tests/release-proof-install.test.mjs` only if there is pure logic
worth testing. Do not edit geo/distribution.json, geo/start.mjs, server/ or web/ code; report needed app fixes to the
parent (task document + finish) with evidence instead, unless a fix is a one-line obvious bug in your own scripts.

What the scripts do:
1. install-proof: from a git ref (or a `git archive` source tarball) make a fresh checkout outside any repo
   (`--out <dir>`), fresh GAID_HOME, run the production launcher via instance.mjs (first start installs packages, builds
   the UI, prepares the helper venv and the catalogue), then record steps: first start (time), UI served (production,
   not dev), backend health, catalogue status ready (record source: download/asset/archive; with the catalogue release
   not yet published, pass `GAID_CATALOGUE_URL=file://...` or `GAID_CATALOGUE_ARCHIVE`, and record which), default
   project provisioned with the catalogue skills, deterministic previews through the real API with known answers:
   LAS (`POST /geo/inspect`, `POST /geo/series-window`; use geo/tests/fixtures or a synthetic LAS with exact values),
   map raster window, vector page and the full-layer area table on synthetic geometry with an analytically known area
   (see geo/tests/maps-helper.test.mjs and geo/tests/fixtures/maps_fixture.py), CSV/TSV table checks
   (`POST /geo/tables/inspect`); then stop, restart (build reused) and reopen: project, files, previews still answer.
   Also the environments: `GET /geo/environments` and the import test (geo/tests/environments-smoke.mjs logic) for the
   project target.
2. update-proof: install a base ref (default: `882cd56`, the main commit before this unit) the same way, seed user
   state through the API the way a user would — a second project, uploaded files, an edited catalogue skill (local
   edit), an authored user skill, a disabled skill, project settings (spend limit, AGENTS.md edit), a chat session with
   history and notebook annotations (if no model is available, write the session the way the app does — check
   server/src/agent/session-registry.ts for the JSONL layout — and say so in the record), provenance user steps from
   the uploads — then update the checkout in place to the candidate ref the way a user would (`git fetch` +
   `git checkout <ref>`, or replacing an extracted source archive while keeping GAID_HOME), restart, and verify every
   seeded item is still accessible through the API, the edited/user skills were not overwritten, and the catalogue
   moved to the new pin (0.2.0 → 0.2.1) for untouched skills. Record each check as its own step.
3. Write one `gaid-install-evidence/v1` JSON per run, plus logs, under `--out`.

Runs to produce (records are the deliverable; use `task job run -- <cmd>` on PC74 for runs to keep, outputs then in the
job output dir; otherwise ~/data/geoaidesk/work/gaid-release-proof/install/<host>/):
- PC74 native Ubuntu 24.04 (this host): install-proof of the parent branch head, update-proof 882cd56 → head.
- PC71 WSL (`ssh pc71`; Node v22.21 present; `uv` was not on the non-interactive PATH — install or locate it per the
  host, record what you had to do as a setup step): install-proof and update-proof. The catalogue asset is not
  replicated there; copy the archive (pc74:~/assets/geo-catalogue/0.2.1/geo-catalogue-0.2.1.tar.gz, sha256
  e9f50606…5f5) to a run directory and use GAID_CATALOGUE_ARCHIVE or a file: URL.
- PC71 Windows native (`ssh pc71-win`; Node v24.13, Git 2.51, uv 0.12.1 present): install-proof through
  `start-gaid.cmd` semantics (instance.mjs runs `node geo/start.mjs`; that is what start-gaid.cmd wraps — check), with
  a path containing a space and a Korean character for the data home if feasible; record what fails rather than
  working around it in app code.
- macOS: not available; record nothing (it stays "untested" in the compatibility file).
A run that fails is still a record: keep it, note the cause, and fix only your harness. App-level failures go to the
parent with the record path.

Network: the KIGAM network blocks raw.githubusercontent.com; use `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H
"Accept: application/vnd.github.v3.raw"` or codeload.github.com. GitHub release downloads, npm registry and PyPI work.
Clone the app from the local repo/branch (`git clone --branch task/gaid-release-proof
https://github.com/kigam-research/geoaidesk.git`, the repo is public) on remote hosts.

Constraints: no model runs that cost money (none are needed); no GitHub releases, tags or other publication; app data
never inside a checkout; do not leave services running on any host (stop them; check ports). Use free ports.

Evidence back to the parent (task document "Current state" and your finish): per host and kind, the record path and
sha256, result, failed steps with causes, setup the host needed, timings. Before finishing, run `node --test
'geo/tests/*.test.mjs'`; the full scripts/check is the parent's. Remove build caches you created inside your worktree
before finishing (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts,
web/tsconfig.tsbuildinfo, __pycache__).

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
