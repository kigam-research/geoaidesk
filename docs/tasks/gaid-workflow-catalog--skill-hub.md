---
format: 1
status: active
updated: 2026-10-12T09:34:23Z
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
- Delivered skill_hub site navigation, configured skill-page URL and .tar.gz file preview, archive bounds/validation, durable SHA-256 sources, catalogue-name notices and the existing acknowledgement/install gate. Existing generic source installation is preserved. No automatic site updates or local-app deep links.
- Checks passed: server vitest 16 tests; web seam vitest 4 tests; server and web tsc; distribution node tests 7; copy validator 0 errors / 3 explained warnings. Safe re-verification commands are in the report section appendix. Full scripts/check is intentionally left to the parent after integration, as requested.
- Real E2E job 3 exited 0: URL preview 200 → acknowledgement → install 200; upload preview 200 with the same stagingToken; acknowledgement omitted → 400; installed SKILL.md bytes match source. Browser page errors and failed requests were empty. Desktop and 430px PNGs are tracked in the parent report folder.
- Parent report material: reports/2026-10-12-gaid-workflow-catalog/skill-hub-section.md includes options, limits, E2E evidence, screenshots, complete new ko/en copy table and the skill_hub-side request for the parent to forward. Optional per-row site links were not added.
- No paid model runs, ~/.geoaidesk changes or ports 3000/18000 review-instance changes. Isolated services stopped; generated .next and tsbuildinfo caches removed. Code checkpoints b3aa2370d63c / 40acafbb7fff; parent integration and its full checks remain separate.
## Next steps
1. Save the parent integration merge with both seams, then rerun task finish. Parent gaid-workflow-catalog integrates this unit with task complete, then runs scripts/check and forwards the report's skill_hub-side request.
## Failed approaches
- First task finish brought parent ca720112bf91 into this branch and stopped on the expected append-only integration-boundaries conflict. Kept both skills-panel.tsx and workflows-panel.tsx seams; no parent implementation was rewritten.
- E2E job 2 was cancelled after its harness launched Next in the repository root instead of web/. No application failure: corrected the external harness Next directory before a fresh run.
- Initial SkillsPanel seam test supplied an incomplete sync-status mock; fixed the fixture to use the normal default, without changing production list logic.
## Notes and decisions
- Sequential decisions: keep the existing acknowledgement/install gate; configure sites in distribution.json; use one package root and content-addressed durable sources under KADY_PI_AGENT_DIR. URL downloads refuse redirects and are limited to the exact configured site base and validated skill identifiers.
- Work packages and integration order: server adapter/routes → frontend component and narrow SkillsPanel seam → focused tests → isolated end-to-end evidence → parent report section. All files are tightly coupled and owned by this writer; no child writers. Parent owns the workflow pane and workspace locale.
- Distribution schema check uses a fixed owner allowlist; added gaid-workflow-catalog to geo/tests/distribution.test.mjs (minimal required distribution-test maintenance per the brief). The seven distribution tests pass.
- Limits: 20 MiB compressed, 64 MiB expanded tar, 10,000 file/directory entries. A package has one top-level skill folder with SKILL.md. The stable source is a snapshot, not an automatic update subscription.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
None for this child unit. The parent owns final integration/checks and forwarding the skill_hub-side request. The optional list-row site link and broader legacy Settings responsiveness are not required for this delivered scope.
## Report
Child contribution: reports/2026-10-12-gaid-workflow-catalog/skill-hub-section.md and figures/skill-hub-{desktop,narrow}.png. Parent owns the canonical index.md report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-catalog--skill-hub-20261012T091833.056202Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-catalog--skill-hub-20261012T092753.682282Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-workflow-catalog--skill-hub/evidence/web.log"],"reason":"E2E harness launched Next from repository root, not web; fix harness directory and rerun","recorded":"2026-10-12T09:29:55Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-catalog--skill-hub-20261012T093025.024721Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
