# What GeoAIDesk 0.1.0 was tested on

The machine-readable source is [`geo/compatibility.json`](../../geo/compatibility.json); this page summarises it.
A combination is claimed only with a recorded install or route trial for this version. Failed, partial and not-run
results stay listed. Anything not on this page is untested. Records and logs are kept outside Git by locator and
sha256; the harness that produced them is in `geo/release-proof/`.

## Operating systems

| Environment | Status | Evidence (2026-10-11) |
|---|---|---|
| Linux x86-64, Ubuntu 24.04 (native) | tested | Clean install, restart, deterministic previews (LAS values, raster window, vector page, full-layer area table, CSV/TSV interval checks) and an update from the previous main commit that kept projects, chats, notebook notes, settings and edited/authored/disabled skills. |
| Windows + WSL 2 (Ubuntu) | tested | Same install and update checks as Linux. The Windows/WSL model-endpoint boundary was not tested. |
| Windows native (x64, Windows 11) | tested | Same install and update checks; the install used a data home containing a space and Korean characters, the update an ASCII one. Two defects found on such paths were fixed for this release: Node's native copy/remove helpers killed the app, and the map helper misread non-ASCII paths. Earlier versions cannot start from such a path. |
| macOS (Apple Silicon, Intel) | untested | No macOS host was available. |

The install checks call the app's API and fetch the served page; they are not browser interaction tests.

## Model routes

| Route | Status | Evidence |
|---|---|---|
| Local Ollama, `qwen3:30b-a3b-instruct-2507-q4_K_M`, 64K context | connection passed; tasks partial | Well-log QC stopped at the 45-minute cap without the figure; map-plus-area-table produced an exact area table but no map. About 7% of the model on the CPU. |
| Local Ollama, same model, 98K context | connection passed; 1 of 2 tasks passed | Map-plus-area-table passed its check in 76 s (exact areas on synthetic data); well-log QC produced every file but reached the cap in a tool-call loop and its QC values have defects. About 18% on the CPU. |
| KIGAM internal Qwen server (vLLM, `qwen3.8-flash-next`, 262K context; custom model server) | connection passed; 2 of 2 tasks passed (2026-10-14) | Map-plus-area-table passed in 11 min (exact areas; the map's area-CRS inset is empty). Well-log QC passed in 11 min with every count matching the LAS, but its quicklook draws depth upward; a first attempt stalled at an unanswered destructive-command confirmation. Works only at thinking level off, low or medium (see below). |
| Personal API key | not run (deferred) | Paid; deferred for 0.1.0 at the user's choice. |
| Sign in with ChatGPT | not run (deferred) | Official flow for local open-source apps; GAID registers under its own name. Uses the plan's included usage and the app's limit. |
| Claude Pro/Max sign-in (Pi OAuth) | not advertised | Anthropic does not permit third-party developers to offer Claude.ai login; use a personal Anthropic API key. |
| GitHub Copilot sign-in (Pi OAuth) | not advertised | Only the official Copilot SDK route is documented. |

Thinking level on the KIGAM server: GAID sends the chat's thinking level to the server as `reasoning_effort`. The
server accepts only `low`, `medium` and `xhigh`, so the chat default (`high`), `minimal` and `xhigh` (lowered to `high`
for a custom model) fail with HTTP 400. Set the chat's thinking level to off, low or medium; at off the server still
reasons at its own default. The server's three model ids report the same weights; only `qwen3.8-flash-next` ran the
tasks. The route is billed as a custom provider at its declared cost of 0, not as the local class.

Skills in the trials: catalogue skills reach a project at app launch, so a project created while the app runs has
none until the next start. Every route trial ran in such a project (2026-10-11 and 2026-10-14), so the exposed
workflow skill was missing from it; one 2026-10-14 run found an older copy elsewhere on the host by searching outside
its project folder.

Common findings of the local trials: no run read the workflow skill the chat exposed (it was not installed in
the trial project, see above), generated scripts needed
repeated repairs, and the outputs are not validated scientific results. Hardware: one RTX 4090 24 GB.
