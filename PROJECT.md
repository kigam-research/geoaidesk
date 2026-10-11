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
| `start.mjs`, `start.sh`, `start.cmd` | Cross-platform launcher (installs deps, seeds skills, starts both services) |
| `docs/` | Upstream user documentation; `docs/cloud-policy.md` hosted-cloud work policy; `docs/tasks/` task documents |
| `scripts/check` | Declared checks (upstream CI steps on Linux) |
| `.github/workflows/` | Upstream CI (`tests.yml`) and release workflow |

## Data and hosts
- data_host: pc74; replica: pc71. Root checkout `pc74:~/repos/geoaidesk`; outputs `pc74:~/data/geoaidesk`.
- App state outside Git: projects under `KADY_PROJECTS_ROOT` (default `<checkout>/projects`, ignored);
  Pi agent config/auth under `~/.kady/pi-agent` (`PI_CODING_AGENT_DIR`); credentials in `.env` (never read or staged).
- Deployed SHAs: none yet.

## Upstream
- Remote `upstream` = `https://github.com/K-Dense-AI/k-dense-byok.git`; integration base
  `44c52cee8e9fdc343c6132909769f49accf14a82` (2026-10-04).
