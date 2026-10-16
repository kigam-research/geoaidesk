# Vendored GAID hub inputs

Atlas profile format, the gaid-method package contract and the taxonomy terms that the GAID hub authoring service
(server/src/geo/authoring/) checks against. Copied byte-for-byte from kigam-research/skill_hub; GAID never reads a
skill_hub checkout at runtime. Environments and catalogue skill names come from GAID's pinned geo catalogue instead.

- Source: kigam-research/skill_hub main `54fe4773d06fcb3d0dc36882d5cd44d9094cade5` (2026-10-16)
- Copied by: task gaid-hub (geoaidesk)

| File | Source path | sha256 |
|---|---|---|
| `schemas/atlas-profile.schema.json` | `schemas/atlas-profile.schema.json` | `ae2705f6dd65baf01cfed4caa036b4074bcf39eca18cc3eaadf80b1bf75502db` |
| `schemas/gaid-hub-package.schema.json` | `schemas/gaid-hub-package.schema.json` | `4d523e7781fd55a6ea5bbd037420b585c4067bb60dabc1cf6267ba28b75d30f7` |
| `schemas/gaid-method.schema.json` | `schemas/gaid-method.schema.json` | `0e79889460276e5585a050a38bb4979805575addcd08285e11c35948d4eb1845` |
| `schemas/geo-workflow.schema.json` | `schemas/geo-workflow.schema.json` | `ad385a8d98e6fed2c23db1fb7ea1fd7504e650267d13cded01b889c10c55f610` |
| `taxonomy/data-types.yaml` | `registry/taxonomy/data-types.yaml` | `ba437b49b60d0c8cdb29d08022fbb4f9cf31c7998ac263620e087703bf554a36` |
| `taxonomy/disciplines.yaml` | `registry/taxonomy/disciplines.yaml` | `092f7536e5fb99fcfde8d192f864875e75ceab4f0e7a59d27f2ca17a9a4572d3` |
| `taxonomy/formats.yaml` | `registry/taxonomy/formats.yaml` | `59f292af343a89c53935bb324b9d20fbbabd91ad2710f7eb4502108af8f88d66` |
| `taxonomy/scales.yaml` | `registry/taxonomy/scales.yaml` | `87a17c80c933ddd7a32cf815305907bf0ab0aca6f6747bf4ebca77a2e0f13c1c` |
| `taxonomy/tasks.yaml` | `registry/taxonomy/tasks.yaml` | `625af76c61d7d8b9b7eb7e89fcf28121a116a3a56869b63e4a1e3004c2bfe007` |

Refresh: fetch the new skill_hub revision with `gh api repos/kigam-research/skill_hub/tarball/<sha>` (raw.githubusercontent.com
is blocked on the KIGAM network), copy the same paths over these files, update the table and the source revision,
and run `cd server && npx vitest run test/geo-authoring*.test.ts`.
