# Release evidence harness (WP10 gaid-release-proof)

Scripts that produce GeoAIDesk release evidence. They are not part of `scripts/check` (they need network, minutes to
hours and, for model routes, a model). Outputs go outside the checkout (`--out`, default under
`~/data/geoaidesk/work/gaid-release-proof/`); `geo/compatibility.json` is written from the records by the release owner.

| File | Purpose |
|---|---|
| `instance.mjs` | Start/stop a GAID checkout in production mode with its own data home and ports; API helper; host facts |

## Records

Every record is one JSON file. Outcomes are `passed`, `failed`, `partial`, `skipped` or `not-run`; a record keeps
failed and not-run steps visible. Logs and large outputs stay next to the record and are referenced by relative path.

`gaid-install-evidence/v1` (install and update proofs):

```text
schema, kind ("install" | "update"), recordedAt, host {label, platform, arch, wsl, osRelease, node, uv, git},
app {version, commit, fromVersion?, fromCommit?, method ("git-clone" | "source-archive" | "git-checkout")},
catalogue {source ("download" | "asset" | "archive" | "missing"), label?, state},
steps [{id, outcome, durationMs?, detail?}], result, logs []
```

`gaid-route-evidence/v1` (model-route trials; connection and task are separate outcomes):

```text
schema, recordedAt, host {...}, app {version, commit},
route {accountRoute ("local" | "api-key" | "chatgpt-signin" | ...), provider, modelId, appContextTokens,
       serverContextTokens?, billingMode},
connection {outcome, testedAt, latencyMs?, detail?},
task {workflowId, outcome, startedAt, durationMs, inputs [{name, sha256}], expectedArtifacts [{id, files, present}],
      turns, toolCalls, retries, dependencyRepairs [], contextPeakTokens?, contextPeakRatio?, inputTokens?,
      outputTokens?, ledgerCostUsd?, offload?, errors []},
knownLimits []
```
