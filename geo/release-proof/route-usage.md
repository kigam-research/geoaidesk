# Route trial harness

One invocation produces `gaid-route-evidence/v1` in `record.json`. Start mode uses the parent's `instance.mjs` and a
fresh GAID home. Attach mode requires `--api` plus the matching `--data-home` on the same filesystem; it creates a
new project and never stops the attached service. Do not point it at a production project store for qualification.

```sh
task job run --gpu --input assets:geo-catalogue/0.2.1 --input assets:force2020-welllogs/c8d01ee9 -- node geo/release-proof/route-trial.mjs --context 65536 --workflow well-log-qc
```

Repeat for context 98304 and workflow `geo-map-and-crs`: four independent jobs, serialized by the host GPU lock.
The output defaults to `TASK_OUTPUT_DIR` (otherwise a timestamped external work directory). Never restart an
unstarted job manually; use its `task job resume` receipt. Failed records are kept. At most one repeat is allowed
after a harness-only correction, not application tuning. Each invocation builds in its job snapshot, not the writer
worktree. The managed Ollama variant is retained (no weights duplicated), unloaded at the end; the original model
is never changed. All services started by a successful launcher are stopped in `finally`.

## Inputs and outcomes

- Workflow prompt, required choices and artifact file contracts come from the pinned catalogue's `workflows.json`.
  `workflow:<id>` exposure is sent when each new chat is created; connection and task use distinct chats.
- FORCE 25/9-1 is hash-checked against the named asset. The prompt keeps the unconfirmed depth basis/datum explicit,
  chooses 1400–1800 original index units for the figure and full rows for QC, and preserves header discrepancies.
- The permitted MIT synthetic-rectangles example supplies a recipe rather than binary source layers. The harness
  reproduces it as projected GeoJSON (declared EPSG:5186), uploads only the input, and never supplies output files.
  Area-table acceptance independently checks A=30000 and B=20000 m2 within 1e-6 m2; this is engineering evidence.
- `passed` needs every expected file nonempty, requested area agreement, a completed/settled stream, no terminal
  run errors, matching loaded Ollama context, and a local/$0 ledger. Recovered tool errors and dependency repairs
  remain visible but do not automatically fail a completed task. Nonempty artifacts do not certify scientific quality.
- Raw SSE, Ollama API/CLI samples every 15 s, original session JSONL, notebook and provenance remain under the run.
  VRAM fraction describes allocated bytes, while CLI `ollama ps` reports the CPU/GPU split. A missing usage field
  stays unknown. Token totals use the ledger (including compaction/aborted usage); streamed turn totals are retained
  separately. Dependency-repair detection is a command-pattern observation, not an exhaustive package audit.
- The data guard's destructive-command confirmations (`permission_request`) are answered by `--permission`
  (default `deny`; `allow`, or `none` to leave them pending as before 2026-10-14) and listed in `permissionRequests`.
- A timeout/disconnected SSE explicitly aborts the server-owned run, then waits up to 120 s for accounting to settle.
  Startup failures and cleanup failures are visible in the record. Records are never overwritten.

## Custom OpenAI-compatible server (`custom-server`)

For a keyless server the user does not pay per token for (for example an institution's vLLM). The harness starts a
fresh instance, registers the server through `PUT /custom-models` the way Settings → Custom model servers does
(`openai-completions`, `reasoning: true`, declared cost 0, `--context` and `--max-tokens`), records the server's
`/models` list, and runs the same connection and task chats with `--thinking` (default `off`). The route is billed as
the app bills custom providers (`payg` at the declared cost); accounting passes when every ledger row costs $0.
`--thinking-probe off,low,high` adds one connection chat per level; `--also-connect id1,id2` adds one for each other
model id on the same server. No Ollama sampling or GPU lock is involved.

```sh
task job run --input assets:geo-catalogue/0.2.1 --input assets:force2020-welllogs/c8d01ee9 -- node geo/release-proof/route-trial.mjs --route custom-server --base-url http://HOST:PORT/v1 --model MODEL_ID --context 262144 --workflow geo-map-and-crs
```

## Paid route design (not executed by this child)

Both nonlocal routes refuse before filesystem/network/model activity without `--allow-paid`. The parent owns the
user's approval; this child never passes that flag. Credentials are configured by the user inside the isolated
GAID instance's Settings, not passed as CLI arguments, copied from another application's auth, or put in evidence.

`api-key`: attach to the instance after the user saves one personal provider key. Select the exact provider/model
ref with `--model`. The harness verifies `/providers` resolves `authType=api_key`, confirms that exact model in
`/providers/models`, creates a project with an explicit spend cap (default $1), then runs the separate connection
and task chats and collects the actual ledger. Use a priced personal provider, not a $0 gateway masquerading as a
paid acceptance result. The credential API and key files are not read by the harness.

`chatgpt-signin`: the user completes GAID's own Settings sign-in first. Attach and select an `openai/...` model (Sign in with ChatGPT;
the legacy `openai-codex` login is a different route and is refused). The harness does not automate login,
reuse another client's identity, or promise subscription quota. Provider refusal and quota errors remain evidence.

```sh
# Parent only, after approval; placeholders are not tested combinations.
node geo/release-proof/route-trial.mjs --route api-key --allow-paid --api http://127.0.0.1:PORT --data-home /external/trial/home --model PROVIDER/MODEL --spend-limit-usd 1
node geo/release-proof/route-trial.mjs --route chatgpt-signin --allow-paid --api http://127.0.0.1:PORT --data-home /external/trial/home --model openai/MODEL
```

Cost order: local provider charges are $0 (hardware/electricity excluded). ChatGPT sign-in is ledgered according to
the resolved subscription route; quota/plan charges are external, not assumed unlimited. A personal API task costs
more than the tiny connection probe because tool schemas and accumulated history are resent every turn. For a
planning envelope of 50k–500k input tokens and 2k–20k output tokens, use the chosen model's picker pricing:
`(inputTokens * pricing.prompt + outputTokens * pricing.completion) / 1000000` (picker prices are USD/million tokens).
These are sizing assumptions, not
a quote or a promised token count. The $1 cap is an admission threshold, not a hard cap on one already admitted
request. No API or subscription qualification is claimed until those separately approved runs exist.
