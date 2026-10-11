# Third-party notices

This file lists the third-party material GeoAIDesk depends on or fetches, and what it deliberately does not
fetch. Each component keeps its own license; nothing here relicenses it.

## Software dependencies

| Component | Where | License |
|---|---|---|
| K-Dense BYOK (upstream application) | whole repository | MIT, `LICENSE` |
| Pi coding-agent SDK (`@earendil-works/pi-agent-core`, `pi-ai`, `pi-coding-agent` 1.0.0) | `server/package.json` | MIT |
| `pi-subagents` 0.74.0, `pi-web-access` 0.35.0, `skills` 1.7.0 | `server/package.json` | MIT |
| Other npm packages | `server/package-lock.json`, `web/package-lock.json` | as declared in each package |
| Python helper packages | `server/src/helpers/uv.lock` | as declared in each package |
| ZetaJS bridge | `web/public/office/` | MIT (license file vendored there) |
| GAID logo and icons (outlined Pretendard 1.3.9 lettering; domain icons from Lucide) | `geo/brand/`, `web/public/brand/gaid-*.svg`, `web/src/app/icon.svg`, `web/src/app/apple-icon.png` | Pretendard: SIL OFL 1.1; Lucide: ISC (Feather: MIT); texts in `geo/brand/licenses/` |

Exact versions are pinned by the lockfiles; the license of each installed package is in its own metadata under
`node_modules/` or the helper environment.

## Content fetched at runtime

| Content | When | Terms |
|---|---|---|
| Scientific skill catalogue `K-Dense-AI/scientific-agent-skills` | First start (project preparation); automatic refresh is off in GeoAIDesk (`KADY_SKILLS_AUTO_SYNC=0`) | Repository license MIT; individual skills state their own terms in `SKILL.md` |
| Geo catalogue archive `geo-catalogue-<version>.tar.gz` (skill_hub) | Not yet wired; recorded in `geo/distribution.json` when staged | Per-skill components and notices in the archive's `notices/NOTICE.md`; example data keeps its own terms |
| ZetaOffice WebAssembly runtime (LibreOffice-based) | First use of **Edit in Office**, from the ZetaOffice CDN, SHA-256 pinned | <https://zetaoffice.net/> and <https://www.libreoffice.org/about-us/licenses/> |

## Excluded sources

| Source | Reason | Effect |
|---|---|---|
| `anthropics/skills`: `docx`, `pdf`, `pptx`, `xlsx` | Their license files restrict use outside Anthropic's services and redistribution (skill_hub `docs/specs/geo-byok-plan.md` §2.6) | Not bundled and not fetched automatically (`geo/distribution.json` `catalogue.excludedSources`). A user may still install a skill manually from Settings, under that skill's own terms. The built-in Office viewers are separate code and are not affected. |
