---
format: 1
status: waiting
updated: 2026-10-12T09:17:19Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"bcdadb7d-d24a-4b57-98db-5e6554bd91e0","pid":3114713,"provider":"codex","session":"01a12f67-1771-7460-b8b3-fab00e10f0c0","start":"26264790","token":"4bba7ca56e3ec863da5f58c7e3871662c112ec047a7244500b1546e07e5e5875"}
branch: task/gaid-workflow-catalog--skill-hub
target: task/gaid-workflow-catalog
parent: gaid-workflow-catalog
---
# gaid-workflow-catalog--skill-hub

## Goal and done criteria
Request from the starter:

# Child writer brief: skill_hub site → GAID skill install (parent unit gaid-workflow-catalog, repo geoaidesk)

You are a child writer of `gaid-workflow-catalog`. Follow the task CLI steps it prints (task resume, work only in your
worktree, `task save`, `task finish`). Read AGENTS.md first ("UI copy and locales", "GeoAIDesk fork" seam rules).
Network: raw.githubusercontent.com is blocked; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` or codeload.
No paid model runs. Do not touch the review instance on ports 3000/18000 or ~/.geoaidesk.

## User request (verbatim, Korean, the relevant sentence)
> "그리고 스킬을 추가할 때에는 skill_hub 프로젝트에서 작업한 skill_hub 사이트를 클릭하여 스킬을 탐색하고 해당 사이트에서 스킬을 가져올 수
> 있게 연계하는 방안도 검토 후 적용해보아야 한다."

## Verified facts (parent's reader research, 2026-10-12)
- Published skill_hub site today: the static Geo Skill Atlas https://kigam-research.github.io/skill-atlas/ (public repo
  kigam-research/skill-atlas; 12 skills, `geo-map-and-crs` missing). Per-skill URL: `#/skills/<publisher>/<slug>[/<tab>]`.
  A devtunnel copy needs GitHub login (server cannot fetch it). The new GAID public site (skill_hub WP08) uses
  `#/skills/<publisher>/<slug>` too but is not published yet (WP11).
- Each Atlas detail page offers a package download:
  `<site>/api/catalog/packages/<publisher>/<slug>/<slug>.tar.gz` (verified: HTTP 200, application/gzip, tar of
  `<slug>/SKILL.md`, `<slug>/scripts/...`, regular files and directories only; e.g. kigam/well-log-qc-quicklook 18 KB,
  k-dense/geopandas 46 KB).
- skill_hub repo is private, so no public Git source exists per kigam skill; the `skills` CLI will not fetch a
  github.io tarball. There is no site→local-app deep link and the plan rejects one (geo-byok-plan.md:879).
- All 13 catalogue skills are already in GAID's pinned catalogue 0.2.1 (ids `kigam/<slug>`, `k-dense/<slug>`;
  `server/src/geo/catalogue.ts`, catalogue index in the staged archive).
- GAID's install gate must stay: `previewSkillSource` → user acknowledgement → `installStagedSkills` with
  `stagingToken` (server/src/agent/skills-install.ts, routes server/src/api/skills.ts, UI web/src/components/skills-panel.tsx).
  `skills` CLI accepts local paths as sources. `server/src/geo/tar.ts` is a safe gzip+tar reader (regular files/dirs only,
  path checks).

## Goal (GAID side only; do not edit skill_hub)
1. Settings → Skills install pane: a "skill_hub에서 스킬 찾기" link that opens the configured skill_hub site in a new tab,
   and a field that accepts a skill_hub skill page URL (`<site>#/skills/<publisher>/<slug>`) or a package file
   (`.tar.gz` downloaded from that page). Either one leads to the existing preview → acknowledgement → install flow, so
   the user reviews the same bytes they install.
2. Server: a GAID route (e.g. `POST /geo/skill-hub/preview` with `{ url }` or the uploaded package bytes) that
   - for a URL: accepts only configured site origins (new `skillHub` block in `geo/distribution.json`, e.g.
     `{ "sites": [{ "id": "atlas", "url": "https://kigam-research.github.io/skill-atlas/", "packages": "api/catalog/packages" }] }`,
     WP11 adds the new site later), maps it to the package URL, downloads with a size limit (outbound proxy is already
     global), and
   - for both: verifies gzip/tar with `server/src/geo/tar.ts`, extracts into a stable content-addressed directory
     outside the checkout and sandbox (under the app data/agent dir, keyed by sha256, so a recorded source path stays valid),
     then calls `previewSkillSource({ source: <dir>, scope })` and returns its normal preview response (plus which
     site/skill id it came from). Bounded size (pick a limit, e.g. 20 MB compressed / 64 MB expanded) and entry count.
   - Note when the skill is already in the pinned catalogue (same runtime name): say so in the preview (the user may
     prefer enabling the catalogue copy); the existing "already installed — will be replaced" warning stays.
3. Settings → Skills list: for a skill that comes from the pinned catalogue, a "skill_hub에서 보기" link to its site page
   (atlas id → `#/skills/<publisher>/<slug>`) if cheap; optional otherwise.
4. Copy: new locale namespace `web/src/geo/locales/skillHub/{ko,en}.json`, Korean first, validator
   `node geo/copy/validate-copy.mjs web/src/geo/locales`. Do not claim verification or features not tested.
5. Seams: add `web/src/components/skills-panel.tsx` (and any other upstream file you edit) to
   `geo/integration-boundaries.json` with owner `gaid-workflow-catalog` (append only; the parent also appends an entry
   for `web/src/components/workflows-panel.tsx`; keep both on conflict). Keep the seam narrow: GAID code in
   `server/src/geo/`, `web/src/geo/skill-hub/`. Register routes in `server/src/geo/routes.ts`.
6. Tests: server vitest for URL allowlist/mapping, size limits, traversal/link refusal, preview hand-off (fake download,
   GAID_CATALOGUE=off as the suite already sets); a web test for the pane seam. Update the AGENTS.md GeoAIDesk bullet list
   with one short bullet for this feature.

## Owned files (do not edit others; the parent owns workflows-panel.tsx, web/src/geo/workspace/*, locales/workspace/*)
server/src/geo/skill-hub*.ts or server/src/geo/skill-hub/*, server/src/geo/routes/skill-hub.ts, server/src/geo/routes.ts
(one registration line), server/test/geo-skill-hub*.test.ts, web/src/geo/skill-hub/*, web/src/geo/locales/skillHub/*,
web/src/geo/locales/index.ts (append the namespace), web/src/components/skills-panel.tsx (narrow seam),
geo/distribution.json (skillHub block; check any distribution schema/tests), geo/integration-boundaries.json (append),
AGENTS.md (one bullet).

## Evidence and done
- `cd server && npx vitest run test/geo-skill-hub*.test.ts`, `npx tsc --noEmit` in server and web, web vitest for your
  test, copy validator. Then a real end-to-end check on your own instance (other ports, data under
  ~/data/geoaidesk/work/gaid-workflow-catalog--<your slug>/): paste
  `https://kigam-research.github.io/skill-atlas/#/skills/kigam/well-log-qc-quicklook` → preview lists the skill →
  acknowledge → installed in a test project. Take two small PNG screenshots (desktop + narrow) of the Settings → Skills
  pane and put them under reports/2026-10-12-gaid-workflow-catalog/figures/ (names `skill-hub-*.png`).
- Write a short section (Korean, 합니다체) `reports/2026-10-12-gaid-workflow-catalog/skill-hub-section.md` for the parent
  report: options reviewed (Git source, package URL, file upload, deep link), chosen approach, limits, and the
  skill_hub-side request text (e.g. a GAID install target on the detail page, the public per-skill mirror, publishing the
  new site) — the parent forwards it to the hub; you do not.
- Do not run `scripts/check` in full (the parent runs it after integration); remove build caches you created before finish.

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
