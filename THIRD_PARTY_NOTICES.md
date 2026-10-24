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
| cmcrameri 1.10 (Python wrapper by Callum Rollo, scientific colour maps by Fabio Crameri) | helper environment and new geo project environments | MIT; Copyright (c) 2020 Fabio Crameri (maps), Copyright (c) 2020 Callum Rollo (Python/packaging); installed `cmcrameri-*.dist-info/licenses/LICENSE.txt` |
| SciencePlots 2.2.2 | helper environment and new geo project environments | MIT; license in the installed distribution |
| pypdf 6.21.2 | helper environment and new geo project environments; deterministic PDF figure inspection | BSD-3-Clause; license in the installed distribution |
| React Flow (`@xyflow/react`) 12.12.0; dagre (`@dagrejs/dagre`) 3.1.1 | research connection map; `web/package.json` | MIT |
| ZetaJS bridge | `web/public/office/` | MIT (license file vendored there) |
| GAID logo and icons (outlined Pretendard 1.3.9 lettering; domain icons from Lucide) | `geo/brand/`, `web/public/brand/gaid-*.svg`, `web/src/app/icon.svg`, `web/src/app/apple-icon.png` | Pretendard: SIL OFL 1.1; Lucide: ISC (Feather: MIT); texts in `geo/brand/licenses/` |

Exact versions are pinned by the lockfiles; the license of each installed package is in its own metadata under
`node_modules/` or the helper environment.

Scientific colour maps used through cmcrameri should be cited in research: Crameri (2018),
<https://doi.org/10.5194/gmd-11-2541-2018>, and Crameri, Shephard & Heron (2020),
<https://doi.org/10.1038/s41467-020-19160-7>.

## Scientific figure skill adapted into GeoAIDesk

`geo/skills/gaid-figures/` adapts K-Dense-AI/scientific-agent-skills' `scientific-visualization` v1.4,
revision `92ace75a` (MIT, Copyright (c) 2025 K-Dense Inc.). Its full license is kept in that skill's
`LICENSE`; `SOURCE.md` lists the retained network-free export, palette and metadata helpers and GAID changes.
Journal snapshots are separately checked official-page facts with their own source URLs and dates.
The colour-vision previews implement the full-severity matrices of Machado, Oliveira & Fernandes (2009),
<https://doi.org/10.1109/TVCG.2009.113>, with NumPy; see the skill's source note.

## Writing guidance adapted into GeoAIDesk

| Material | Where | License |
|---|---|---|
| Attention Control (`aaddrick/attention-control`), through KIGAM's Korean adaptation: delivery rules for chat answers | `REPLY_STYLE_RULE` in `server/src/geo/instructions.ts` (condensed, reworded) | MIT, Copyright (c) 2026 aaddrick; portions Copyright (c) 2026 Ayoub Ghriss |
| Humanizer (`blader/humanizer` v3.1.0), through KIGAM's Korean adaptation: prose patterns for research notes; its patterns come from Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup) | `geo/skills/gaid-note-style/` (condensed, reworded; seeded into each project's `.pi/skills/`) | MIT, Copyright (c) 2025 Siqi Chen; text in `geo/skills/gaid-note-style/LICENSE` |

## Design skills for developers (not shipped in the app)

Unmodified copies read by coding agents working on GAID's screens; the app never loads them. Pins, telemetry and what
was left out: `.claude/skills/SOURCE.md`.

| Material | Where | License |
|---|---|---|
| Impeccable (`pbakaus/impeccable` skill 4.7.0, tag `skill-v4.7.0`, commit `aeeb3d8c`); its `reference/ios.md` and `reference/android.md` derive from `ehmo/platform-design-skills` (MIT) | `.claude/skills/impeccable/` | Apache-2.0; `.claude/skills/licenses/impeccable-LICENSE` and its notices `impeccable-NOTICE.md` |
| tasteskill (`Leonxlnx/taste-skill` v2.1.4, commit `6010f91a`), skill `design-taste-frontend` | `.claude/skills/design-taste-frontend/` | MIT, Copyright (c) 2026 Leonxlnx; `.claude/skills/licenses/taste-skill-LICENSE` |

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
## ORCID iD icons

`web/public/geo/orcid/ORCID-iD_icon_vector.svg` and
`web/public/geo/orcid/ORCID-iD_icon_unauth_vector.svg` are official, unmodified ORCID icons, downloaded on
2026-10-22 from the [ORCID brand library](https://orcid.filecamp.com/s/o/LdPTOOrMoSrjElD5/OJjCdaqbG7Jdu0ga)
(authenticated Default file `42DBWh3MuwolJCUX`; unauthenticated Default file `SYYuVmbGk7Y4qec2`).
ORCID makes its website content available under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The icons remain subject to [ORCID's brand guidelines](https://info.orcid.org/brand-guidelines/) and
[iD display guidelines](https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/).
Phase 1 displays only the unauthenticated icon and the unauthenticated suffix; these assets are never recoloured.

