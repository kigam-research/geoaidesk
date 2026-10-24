# GAID hub authoring service

Status: implemented in task gaid-hub (2026-10-16). Moved from skill_hub (`web/server/authoring/`, spec
`docs/specs/hub-authoring-service.md` at 54fe477) into GAID's backend. Contract: `web/src/geo/contracts/authoring.ts`.
Package format: skill_hub `docs/specs/gaid-method-package.md` v1 (`gaid-method/v1`), received by GAID as described in
`docs/design/hub-method-package.md`.

## Flow

1. The researcher opens the GAID hub (project list → "GAID 허브", URL `#hub`) and uploads sources: paper PDF, code
   archive (`.zip`/`.tar.gz`) or single files. The server keeps the original bytes privately, hashes them and extracts
   page text (poppler `pdftotext`/`pdfinfo`) or a file inventory (in-process tar/zip readers; links, devices, absolute
   paths and `..` are refused; 64 MiB / 10,000 entries expanded).
2. `analyze`: the coauthor reads the extracted text and returns anchored findings, a scope proposal and at most five
   questions. The server verifies every anchor (source, page or file, quote found there) and drops the rest.
   The hub adds two standard questions unless the model asked the same thing: `code-use` (include the supplied code;
   only when a code source exists) and `trial-scale` (add a reduced quick first-trial setting; recommended), see
   `standardQuestions` in `server/src/geo/authoring/agent.ts` (gaid-hub-followups).
3. The researcher answers one question at a time (options with a marked recommendation, a free-text "기타" field,
   "나중에 정하기") and applies all answers together (`POST /answers`, all or none). That starts the draft.
4. `draft`/`revise`: the coauthor writes the skill, Workflow and 레시피; the server validates vocabularies, keeps
   server-owned fields, records imports, runs the six checks and allows one bounded repair. A 레시피 value is kept only
   when it names the answered decision behind it (`{"value", "decision"}`); paper values and model suggestions stay open
   for the start settings. When `trial-scale` = `quick-and-full`, the Workflow must carry the choice `run-scale`
   (`quick`/`full`) and the server sets `quick` as the start default. Labels lose "(선택)"/"(필수)" markers. A warning
   (`artifact-file`) flags expected result files that SKILL.md does not name; trial records also report a declared file
   saved in another folder (`foundElsewhere`).
5. The draft screen shows the method as a flow diagram. "설치하고 시작 설정 열기" builds the package (once per draft
   revision) and installs it into the chosen GAID project through the normal gate, then opens the Workflow start
   settings there. Trial feedback (`revise`) produces the next draft revision.

Hub-side receive: the chat's "허브 초안으로 보내기" (`HandoffDialog`) calls `POST /geo/authoring/handoffs` (request's
project scope, `{sessionId, files, note}`): the server builds the `gaid-analysis-handoff/v1` bundle, creates a new method
(goal = note) and attaches the bundle as its first source (kind `gaid-analysis`), then the hub opens `#hub/<id>`. An
uploaded `gaid-analysis-*.tar.gz` is recognised as the same kind. The download and external-hub paths remain.

## Storage

`<KADY_PI_AGENT_DIR>/skill-hub/authoring/` (GAID: `<GAID_HOME>/pi-agent/skill-hub/authoring/`; tests: `GAID_AUTHORING_DIR`):
`projects/<id>/project.json` (atomic replace), `sources/<sid>/{original,pages/,files/}`, `attempts/<attemptId>.json`
(request and raw responses, no hidden reasoning), `packages/<rev>/<slug>.tar.gz`. Deleting a project moves its folder to
`archive/`. A running attempt found at startup becomes `interrupted`; operations carry an `opId` and repeat safely.

## Model route

GAID's own model runtime (`ModelRuntime.completeSimple`): the project's model, else the request's `model`, else the app
default (Settings → Defaults). Thinking level from the request (`low|medium|high|xhigh`, default medium), timeout
`GAID_AUTHORING_TIMEOUT_MS` (15 min), `GAID_AUTHORING_MAX_TOKENS` (32,000). Every response is ledgered in the `default`
project under session `gaid-hub-authoring` before validation; its spend cap applies (402). A repair turn is folded into one
user message, so no provider-specific assistant message is rebuilt. Replies are JSON by prompt and server validation only.
Prompt cost (gaid-authoring-tokens, report `reports/2026-10-24-gaid-authoring-tokens/`): every call of a project has the
same system prompt (`AUTHORING_SYSTEM`) and starts its user message with the sources, the operation's task text after
them, and passes the authoring project id as Pi `sessionId` (prompt-cache key), so analyze, draft, revise and repair share a
cacheable prefix. A draft repair after a usable reply and every revise return only the top-level fields they change; the
server lays them over the previous reply / current draft before validation (analysis repairs and first drafts stay whole).

## Checks and inputs

Six checks (schema, atlas, taxonomy, portability, workflow, claims). Atlas profile/gaid-method/geo-workflow schemas and
taxonomy terms are vendored in `geo/hub/` (`SOURCE.md`); environment ids/packages and catalogue skill names come from
the pinned geo catalogue. Packages are deterministic tar.gz (sorted, mtime 0, owner 0, 0644/0755) with
`gaid-method.json` (`provenance.hub.url` = `gaid-local:`, lifecycle `draft`). Installed packages get origin `gaid-hub`.

## Not ported

skill_hub's `/api/gaid` feed and handoff routes (other apps reading the hub) and its researcher screens; GAID has its
own screens (`web/src/geo/hub/`). The remote hub fetch path (`skillHub.sites[].authoring` descriptors) stays.
