# Upstream synchronization

GeoAIDesk follows [K-Dense-AI/k-dense-byok](https://github.com/K-Dense-AI/k-dense-byok). The current base is
recorded in `geo/upstream.lock.json`; the upstream surfaces the fork changes, and who owns each, are in
`geo/integration-boundaries.json`.

## Cadence

- Look at upstream changes weekly; normally integrate one selected release a month.
- Integrate a narrow regression fix earlier when it matters to GAID users.

## Procedure

1. Start a task unit (backbone task workflow; never on `main`).
2. `git fetch upstream` and pick the release commit.
3. `git merge --no-ff <commit>` on the task branch. Never rebase or squash upstream history.
4. Resolve conflicts. Conflicts are expected in the seams listed in `geo/integration-boundaries.json`; keep
   upstream behaviour and re-apply the GAID change narrowly. A conflict outside the list means a seam was not
   recorded: add it.
5. Update `geo/upstream.lock.json` (`commit`, `committedAt`, `packageVersion`, `harness` pins).
6. Re-check that the excluded sources in `geo/distribution.json` are still excluded (upstream may add catalogue
   sources in `server/src/config.ts`).
7. Run `scripts/check` (upstream CI steps, geo checks and the production smoke).
8. Record the integration in the log below and finish the task with a merge commit.

## Log

| Date | Upstream commit | Conflicts (files) | Seams changed | Effort | Regressions |
|---|---|---|---|---|---|
| 2026-10-11 | `44c52ce` (0.15.0) | — (initial fork base) | — | — | — |
