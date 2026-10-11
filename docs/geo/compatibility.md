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
| Windows native (x64) | see `geo/compatibility.json` | First installs started from a scheduled task failed twice (backend stopped right after its first request, without an error); the same checkout started normally from an interactive session. A transient Windows rename lock in skill installation was found and fixed. |
| macOS (Apple Silicon, Intel) | untested | No macOS host was available. |

The install checks call the app's API and fetch the served page; they are not browser interaction tests.

## Model routes

| Route | Status | Evidence |
|---|---|---|
| Local Ollama, `qwen3:30b-a3b-instruct-2507-q4_K_M`, 64K context | connection passed; tasks partial | Well-log QC stopped at the 45-minute cap without the figure; map-plus-area-table produced an exact area table but no map. About 7% of the model on the CPU. |
| Local Ollama, same model, 98K context | connection passed; 1 of 2 tasks passed | Map-plus-area-table passed its check in 76 s (exact areas on synthetic data); well-log QC produced every file but reached the cap in a tool-call loop and its QC values have defects. About 18% on the CPU. |
| Personal API key | not run | Paid; runs only at the user's request. |
| Sign in with ChatGPT | not run | Official flow for local open-source apps; GAID registers under its own name. Uses the plan's included usage and the app's limit. |
| Claude Pro/Max sign-in (Pi OAuth) | not advertised | Anthropic does not permit third-party developers to offer Claude.ai login; use a personal Anthropic API key. |
| GitHub Copilot sign-in (Pi OAuth) | not advertised | Only the official Copilot SDK route is documented. |

Common findings of the local trials: no run read the workflow skill the chat exposed, generated scripts needed
repeated repairs, and the outputs are not validated scientific results. Hardware: one RTX 4090 24 GB.
