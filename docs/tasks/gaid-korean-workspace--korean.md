---
format: 1
status: waiting
updated: 2026-10-11T06:50:05Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"95c18540-98e5-43b9-a8b5-0d904e284979","pid":449523,"provider":"codex","session":"01a129b9-f186-77a1-ae42-9253040f3f74","start":"16741475","token":"ec255bab0a5fc65b75b65f6aeb3722d4f293311e4cecceb860ef9f810f3b27e0"}
branch: task/gaid-korean-workspace--korean
target: task/gaid-korean-workspace
parent: gaid-korean-workspace
---
# gaid-korean-workspace--korean

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-korean-workspace--korean` (geoaidesk, WP07 Korean primary path and branding)

You are a child writer of top-level unit `gaid-korean-workspace` (WP07 of the GeoAIDesk plan). Run `task resume` for
your slug first, read the returned worktree's AGENTS.md, and work only there. Base: parent branch at ba1a71b.

## Goal (from the package text; do not add required items)
WP07 owns "geo branding/locales" and "Korean primary UI": "All visible strings go into web/src/geo/locales"; done
criterion "Primary-path Korean, keyboard, narrow-layout, and actual-screen checks are recorded" (the parent records the
browser checks; you make the primary path Korean and keyboard/narrow-safe). Product name decided by the user:
GeoAIDesk (short GAID): "GeoAIDesk" in titles and first mentions, "GAID" in compact chrome.

## Already settled by the parent (read first; do not change)
- `web/src/geo/i18n.ts`: `t("<namespace>.<key>", values)`, `geoText(ns)`, `geoLocale()`, `setGeoLocaleSetting()`
  (`gaid:locale`, a change reloads the page). ICU formatter `web/src/geo/icu.ts`.
- Catalogues `web/src/geo/locales/<namespace>/{ko,en}.json`, aggregated by `web/src/geo/locales/index.ts` (namespaces
  already registered: app, workspace, viewers, depth, map, tables, context, localModel). The copy validator
  `node geo/copy/validate-copy.mjs web/src/geo/locales` runs in `scripts/check`.
- Copy rules: `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv` (e.g. `workflow`, `AI agent`, `스킬`, `Geoscience
  자료` stay in that form), `geo/copy/approved/{ko,en}.json` (user-approved general states you may reuse verbatim), and
  the agent prompt block in AGENTS.md ("UI copy and locales"). Design tokens: `geo/copy/gaid-app.css` (WP00, approved).

## Owned files
- Locale namespaces `app`, `viewers`, `depth`, `map`, `tables`, `context`, `localModel` (not `workspace`, which the
  sibling `gaid-korean-workspace--tasks` owns, and not `web/src/geo/workspace/**`).
- The existing geo module dictionaries: move `web/src/geo/{context,local-model}/strings.ts`,
  `web/src/geo/viewers/strings.ts`, `web/src/geo/viewers/{depth,map,tables}/strings.ts` and the inline
  `defineGeoStrings` in `viewers/tables/table-option.tsx` into their catalogues, keeping keys and call sites working
  (e.g. the exported lookups become thin `geoText("<ns>")` wrappers). Convert `{name}` placeholders as needed (ICU
  uses the same form). Remove `defineGeoStrings` from i18n.ts only if nothing uses it any more.
- Upstream files on the primary path (below), `web/src/app/layout.tsx`, `web/src/app/globals.css`, `web/public/`
  brand assets, `web/src/components/settings/appearance-panel.tsx`, and their tests where a visible string changes.
- `geo/integration-boundaries.json`: add or extend one entry per upstream file you edit (owner `gaid-korean-workspace`),
  and `THIRD_PARTY_NOTICES.md` for any font you add.

## Primary path (translate these; everything else stays upstream English and is listed in your task document)
Open the app → project switcher / projects screen → file tree (upload, new file/folder, empty state) → file preview
toolbar and empty/loading/error states → chat tabs bar → chat composer (placeholder, send/stop, attach/+ menu
top-level items, model/thinking/compute selectors, context chips) → tool activity and run status lines → model setup
(connect-model card, Settings dialog navigation, Providers panel headings/row actions, Defaults panel, the local model
card) → result cards (scientific-result-card labels) → Settings → Appearance (language). Use namespace `app` for
upstream strings, ids by surface (`app.header.*`, `app.files.*`, `app.chat.composer.*`, `app.settings.providers.*`, …).

Rules for upstream strings:
- English catalogue values keep the upstream English text unless a copy rule or the brand requires a change (then
  update the affected upstream tests and say so in your task document). Upstream tests run with an English
  `navigator.language`, so unchanged English keeps them passing.
- Brand: replace visible "Kady", "K-Dense BYOK" product naming with GeoAIDesk/GAID or with a neutral role
  (`AI agent`, per terminology). Keep upstream attribution visible once (e.g. version tooltip or Settings: "K-Dense
  BYOK 기반 (MIT)") and keep LICENSE/NOTICE untouched. Code identifiers, storage keys, env vars, event names and API
  paths stay as they are (no functional rebranding, plan §6).
- No question titles, hype adjectives, emoji, celebration; execution state is never shown as verified.

## Branding and theme
- `layout.tsx`: title "GeoAIDesk", Korean description (from the approved strings where one fits), `lang` that
  follows `geoLocale()` on the client (server render stays valid).
- Header: GAID wordmark (text) + "GeoAIDesk" where space allows. The GAID logo is still being made in skill_hub
  (child gaid-design-copy--assets); do not invent a logo image. Replace the K-Dense logo usage in the header; keep the
  files if other code references them.
- Theme: apply the WP00 app tokens (`geo/copy/gaid-app.css` values: brand #1f5eff, ink/body/muted, borders, radius
  10px, status colours) to the light theme in `globals.css`; keep dark mode working (upstream dark values may stay).
  Fonts: Pretendard Variable for UI text and a Hangul-capable monospace for code/paths if you can add them under OFL
  with notices (self-hosted files in `web/public/fonts/` or an npm package; one dependency change at most, recorded in
  the boundaries file); otherwise keep the CSS font stack from the token file with system fallbacks and say so.
  `word-break: keep-all` for Korean text.
- Settings → Appearance: a 언어 / Language control: 자동(브라우저 언어) / 한국어 / English → `setGeoLocaleSetting` + reload.

## Accessibility and layout
Translated controls keep their accessible names in the active language (aria-label/title via `t()`); no layout break
at 375 px for header, file tree toggle and composer toolbar with Korean text (wrap or truncate with a title).

## Checks (yours)
`cd web && npx tsc --noEmit && npm test && node ../geo/copy/validate-copy.mjs src/geo/locales` (full web suite,
because upstream tests assert strings) plus `npx eslint` on files you touched (pre-existing errors in untouched lines
may stay). The parent runs `scripts/check` and the browser checks. No paid model runs. The KIGAM network blocks
raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` for GitHub files.

## Coordination
The sibling child edits only `web/src/geo/workspace/**` and `locales/workspace`. The parent may edit mount lines in
`app/page.tsx`, `chat-tab.tsx`, `file-preview-panel.tsx` and `scientific-result-card.tsx` (lines mentioning
`Geo…` components); leave those lines as they are and translate around them. Run `task sync` before finishing if the
parent tells you it changed shared files.

## Finish
Keep your task document current: list string ids with Korean and English text (before/after for changed English),
edited upstream files, and the surfaces left in English. `task save` reviewed files, then `task finish`.

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
