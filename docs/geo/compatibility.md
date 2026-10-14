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

The 2026-10-14 re-trial ran each task once with the geo catalogue skills installed in the trial project; earlier
records (without skills) stay in the JSON.

| Route | Status | Evidence |
|---|---|---|
| Local Ollama, `qwen3:30b-a3b-instruct-2507-q4_K_M`, 64K context | connection passed; 2 of 2 tasks passed (2026-10-14) | Well-log QC passed in 52 s after reading the workflow skill; every count matches the LAS and the quicklook draws the requested interval. Map-plus-area-table passed in 54 s (exact areas on synthetic data; the skill was not read). On 2026-10-11, without skills, both tasks were partial. About 7% of the model on the CPU. |
| Local Ollama, same model, 98K context | connection passed; 1 of 2 tasks passed (2026-10-14) | Map-plus-area-table passed in 2 min 25 s (exact areas; skill not read). Well-log QC failed: the model did not read the skill, paged through the raw LAS 100 lines at a time and hit the 45-minute cap with no files. About 22% on the CPU. |
| KIGAM internal Qwen server (vLLM, `qwen3.8-flash-next`, 262K context; custom model server) | connection passed; 2 of 2 tasks passed (2026-10-14) | With skills and thinking level high (sent as medium): map-plus-area-table passed in 4 min (exact areas, correct map) and well-log QC in 4 min 28 s (every count matches the LAS, depth drawn downward); both runs read the workflow skill in the project. Needs the accepted reasoning levels below. |
| Personal API key | not run (deferred) | Paid; deferred for 0.1.0 at the user's choice. |
| Sign in with ChatGPT | not run (deferred) | Official flow for local open-source apps; GAID registers under its own name. Uses the plan's included usage and the app's limit. |
| Claude Pro/Max sign-in (Pi OAuth) | not advertised | Anthropic does not permit third-party developers to offer Claude.ai login; use a personal Anthropic API key. |
| GitHub Copilot sign-in (Pi OAuth) | not advertised | Only the official Copilot SDK route is documented. |

Thinking level on the KIGAM server: the server accepts `reasoning_effort` `low`, `medium` and `xhigh` only. Register
it in Settings → Providers → Custom model servers with "Reasoning levels the server accepts" set to Low, Medium and
XHigh. GAID then sends minimal as low and high as medium, sends xhigh unchanged, and the thinking selector
shows the substitution (for example "높음 → 보통"). Without that setting the chat default (high), minimal and xhigh
(lowered to high) fail with HTTP 400. At off GAID sends no value and the server reasons at its own default. The server's three
model ids report the same weights; only `qwen3.8-flash-next` ran the tasks. The route is billed as a custom provider
at its declared cost of 0, not as the local class.

Skills in the trials: since the 2026-10-14 follow-up, a project gets the catalogue skills when it is created, also
while the app runs. Before that they arrived only at the next launch, so the 2026-10-11 trials and the first
2026-10-14 KIGAM trial ran without them. In the re-trial the KIGAM model and the local 64K well-log run read the
workflow skill; the other local runs did not. The KIGAM re-trial also changed the thinking level, so the two effects
are not separated.

Common findings of the local trials: generated scripts needed repairs, one run invented a timestamp in its run log,
and the outputs are not validated scientific results. Hardware: one RTX 4090 24 GB.
