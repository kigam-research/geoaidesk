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
| `server/src/geo/hub-server/`, `geo/hub-server.mjs` | Institute GAID hub server (accounts, shared hub records, library sync; SQLite); guide `docs/geo/hub-server.md` |
| `web/src/geo/` | GAID UI modules: inspection contract, viewer registry seam + generic inspection viewer, start-prompt budget chip, local-model Settings card, `defineGeoStrings` |
| `configs/inputs.toml` | Named inputs: `geo_catalogue` (pc74:~/assets/geo-catalogue/<version>, built by `geo/catalogue-build.mjs`; public copy on the geoaidesk release `geo-catalogue-<version>`), `k_dense_scientific_agent_skills` (source of imported K-Dense skills) |
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
- Institute hub server data: `GAID_HUB_SERVER_HOME` (default `~/.geoaidesk-hub`: `hub.sqlite`, `blobs/`, `server.json`). Test
  instance of gaid-backend: `pc74:~/data/geoaidesk/work/gaid-backend/hub-home` (test accounts only).
- Institute hub server service (gaid-hub-server-trial): `pc74` user unit `gaid-hub-server.service`, `0.0.0.0:8700` (plain HTTP
  pilot; HTTPS switch in `docs/geo/hub-server-https.md`), pinned snapshot `~/deploy/geoaidesk-hub-server/<sha>/`, home
  `pc74:~/data/geoaidesk/hub-server/home`, log `.../hub-server/logs/hub-server.log`, backups `.../hub-server/backups/`, frozen
  import source `.../hub-server/import-source/`. The review app (`gaid-review`, :3000/:18000) runs from `~/deploy/geoaidesk`,
  loopback only since 2026-10-23 (user: token access off until the following Monday; started without `KADY_HOST`,
  `NEXT_PUBLIC_ADK_API_URL`, `KADY_AUTH_TOKEN`; the LAN mode used `KADY_HOST=0.0.0.0`,
  `NEXT_PUBLIC_ADK_API_URL=http://10.13.15.74:18000` and the fixed token in `~/data/geoaidesk/work/review-app/access-token`),
  data `~/.geoaidesk`, log `~/data/geoaidesk/work/review-app/launcher.log`.
- Deployed SHAs: hub server `7703739a40ef0ac99ae1bb3e3d130c745ea8376b` (2026-10-23, gaid-hub-rollout-versions; schema
  migrations 4 (ORCID) and 5 (Workflow removal); ORCID client not configured, open item gaid-orcid#1; backup
  `.../hub-server/backups/2026-10-23-before-7703739a` with the previous unit file; previous snapshot
  `982389c59f5cda2b666fc9893d0d27a8017cad6c` kept for rollback); review app `3171c57c8a99d1a0995fb091c07a1a861f2e02f2`
  (2026-10-23, gaid-hub-rollout-versions; loopback only; config backup
  `~/data/geoaidesk/work/review-app/config-backup-20261023T183027`).

## Upstream
- Remote `upstream` = `https://github.com/K-Dense-AI/k-dense-byok.git`; integration base
  `44c52cee8e9fdc343c6132909769f49accf14a82` (2026-10-04).
