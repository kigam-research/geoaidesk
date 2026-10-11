# geoaidesk — project map

GeoAIDesk (GAID): a geoscience research desk built on the public fork of
[K-Dense-AI/k-dense-byok](https://github.com/K-Dense-AI/k-dense-byok) (MIT), a local AI research-assistant app
that uses the user's own model credentials. Repo: https://github.com/kigam-research/geoaidesk (public, GitHub fork).
Plan and work packages: skill_hub `docs/specs/geo-byok-plan.md` and `reports/2026-10-11-geo-byok-plan/index.md`;
the skill_hub hub sends app packages here (first: WP02 `gaid-fork-base`).

## Structure
| Path | Role |
|---|---|
| `server/` | Backend (TypeScript, Pi coding-agent SDK, Fastify), port 8000; tests in `server/test/` |
| `server/src/helpers/` | Python helper environment (uv project) used by scientific tools and tests |
| `server/pi-packages/` | Vendored Pi packages (PDF annotations, Modal) |
| `web/` | Frontend (Next.js 16 / React 19), port 3000 |
| `start.mjs`, `start.sh`, `start.cmd` | Cross-platform launcher (installs deps, seeds skills, starts both services); development entry points |
| `start-gaid.sh`, `start-gaid.cmd`, `geo/start.mjs` | GeoAIDesk entry points: production build, user data under `GAID_HOME` |
| `geo/` | Distribution manifest, upstream lock, integration boundaries, release manifest script, `tests/` (unit + production smoke) |
| `server/src/geo/` | GAID backend modules: distribution manifest, catalogue staging/provisioning, task exposure and prompt budget, environments, inspection + tools + read hints, local model, routes (`/geo/*`) |
| `web/src/geo/` | GAID UI modules: inspection contract, viewer registry seam + generic inspection viewer, start-prompt budget chip, local-model Settings card, `defineGeoStrings` |
| `configs/inputs.toml` | Named inputs: `geo_catalogue` (pc74:~/assets/geo-catalogue/0.2.0, skill_hub catalogue archive) |
| `NOTICE.md`, `THIRD_PARTY_NOTICES.md` | Fork attribution, third-party and excluded sources |
| `docs/` | Upstream user documentation; `docs/cloud-policy.md` hosted-cloud work policy; `docs/tasks/` task documents |
| `scripts/check` | Declared checks (upstream CI steps on Linux + GAID checks and production smoke) |
| `.github/workflows/` | Upstream CI (`tests.yml`, unchanged), `gaid-checks.yml`, GAID tag-driven draft `release.yml` |

## Data and hosts
- data_host: pc74; replica: pc71. Root checkout `pc74:~/repos/geoaidesk`; outputs `pc74:~/data/geoaidesk`.
- App state outside Git. Distribution (`start-gaid.*`): everything under `GAID_HOME` (default `~/.geoaidesk`:
  `projects/`, `pi-agent/`, `config.env`, `skills-cache/`, `office-assets/`). Development launchers: projects under
  `KADY_PROJECTS_ROOT` (default `<checkout>/projects`, ignored), Pi agent config/auth under `~/.kady/pi-agent`
  (`PI_CODING_AGENT_DIR`), credentials in `.env`. Never read or stage env/credential files.
- Smoke runs keep their logs under `~/data/geoaidesk/work/<slug>/` when `GAID_SMOKE_DIR` points there.
- Deployed SHAs: none yet.

## Upstream
- Remote `upstream` = `https://github.com/K-Dense-AI/k-dense-byok.git`; integration base
  `44c52cee8e9fdc343c6132909769f49accf14a82` (2026-10-04).
