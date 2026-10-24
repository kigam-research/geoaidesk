# Design-skill copies (read-only)

GAID's UI rule (AGENTS.md "UI guide v2", `docs/design/ui-guide.md`) asks every screen, mockup or logo to be designed as an
impeccable + design-taste-frontend + brand-guide expert. The two skills are kept here as pinned, unmodified copies so
every geoaidesk checkout and worktree has the same version: Claude Code discovers them as project skills, other agents
(Codex, Pi) read `SKILL.md` and its references by path. They replace the copies in skill_hub `.claude/skills/`
(impeccable 4.3.1, design-taste-frontend v1), which are legacy and were left untouched. Nothing is installed globally.

Do not edit files under `impeccable/` or `design-taste-frontend/`; refresh them by copying a newer pinned upstream tree
and updating this file. GAID's own rules win where a skill disagrees (ui-guide section 1).

| Copy | Upstream | Tag | Commit | Path in upstream | Licence |
|---|---|---|---|---|---|
| `impeccable/` (skill 4.7.0, engine 0.1.16 in `scripts/VERSION`) | https://github.com/pbakaus/impeccable | `skill-v4.7.0` | `aeeb3d8c30b5f95aeeb3e893b0f1a308af8fdb8f` | `.claude/skills/impeccable/` (the Claude Code build) | Apache-2.0: `licenses/impeccable-LICENSE`, `licenses/impeccable-NOTICE.md` |
| `design-taste-frontend/` (tasteskill v2.1.4) | https://github.com/Leonxlnx/taste-skill | `v2.1.4` | `6010f91a9935f1c167dfc500fb1a475681892e6b` | `skills/taste-skill/` | MIT, Copyright (c) 2026 Leonxlnx: `licenses/taste-skill-LICENSE` |

Fetched 2026-10-24 from `https://codeload.github.com/<owner>/<repo>/tar.gz/<commit>` (archive sha256: impeccable
`bf32d5721d7cf7145f5f449886a27f58f6130f543f784dfd099e3e183aa54864`, taste-skill
`1c47e20a30476073d884905c9b0e00a7e5adc89e632a232ab6ed1910dffb25fe`). The copied trees are byte-identical to those paths
(`diff -r`), file modes included. raw.githubusercontent.com is blocked on the KIGAM network; use codeload or `gh api`.

Not copied: impeccable's Claude Code hook manifest (upstream `.claude/settings.json`: detector on every Edit/Write and a
deep pass on Stop) and its reviewer agents (upstream `.claude/agents/impeccable-*.md`, named in `reference/new-work.md`),
because they would change every agent session in this repo. Run `scripts/impeccable detect` explicitly instead.

## Network and telemetry

- **impeccable.** `scripts/impeccable` runs a self-contained engine. On first use it downloads the engine for this
  platform from the upstream GitHub release (`engine-v<VERSION>`), checks it against the release's `.sha256` sidecar and
  caches it in `~/.impeccable/bin/` (`IMPECCABLE_HOME` moves the cache; `IMPECCABLE_BIN` points at a preinstalled
  engine). Starting a new design asks the roll API at `https://impeccable.style/api` for visual directions; that call
  always happens. Its anonymous choice telemetry is off for this repo through `"telemetry": false` in
  `.impeccable/config.json` (upstream README "Telemetry": the project setting opts everyone out). Outside this checkout
  set `DO_NOT_TRACK=1` or `IMPECCABLE_NO_TELEMETRY=1`; `scripts/impeccable telemetry status` shows the state.
- **design-taste-frontend.** No telemetry. `scripts/draw.mjs` keeps recent draws in `~/.taste-skill/history.json`
  (`TASTE_SKILL_HISTORY` moves it) and writes its sheet to `.taste-skill/` in the working directory (ignored by Git
  here). `scripts/assets.mjs` searches and downloads pictures from open collections (Openverse, Internet Archive,
  Art Institute of Chicago, The Met and others) only when run.
- **brand-guide.** No skill copy; the GAID brand is `geo/brand/` (logo, licences) and the UI guide.
