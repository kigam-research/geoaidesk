# Hub method packages in GAID (consumer side)

Status: GAID consumer side of contract v1 (2026-10-15), agreed with the skill_hub unit gaid-hub-authoring (answer to
da92dc0fec04): skill_hub `docs/specs/gaid-method-package.md`, `schemas/gaid-method.schema.json`,
`schemas/gaid-hub-package.schema.json` (branch task/gaid-hub-authoring 9d81eca2ba5a). skill_hub owns the producer contract;
this file records what GAID reads and enforces.

## Package
One gzip tar with a single root `<slug>/` (the existing skill_hub install gate, `server/src/geo/skill-hub.ts`): `SKILL.md`
(Pi skill), optional `scripts/`, `references/`, `assets/`, hub metadata (`atlas.yaml`, `LICENSE`; GAID does not parse YAML)
and optional `gaid-method.json`. Without that file the package installs as a plain skill.

`gaid-method.json` (`gaid-method/v1`, `server/src/geo/methods/method-file.ts`; unknown keys ignored):

| Field | Rule |
|---|---|
| `methodId`, `revision`, `version` | `<owner>/<slug>` (slug = the package folder; trial hub owner `local`), positive integer revision immutable per bytes, semver `0.<revision>.0` |
| `lifecycle` | `draft` / `submitted` / `published` as the package claims it; GAID shows the hub descriptor's value instead and caps everything else at `draft` |
| `implementation`, `codeOrigin` | `descriptive` (instructions only) or `implemented` (code present); optional `supplied`/`generated`. "Tested" is a GAID trial record, never a package claim |
| `title`, `summary` | `{ko, en?}` |
| `sources[]` | `{kind: doi/url/file, ref, title?}` references; private sources are not in the package |
| `checks` | Hub receipt `{passed: true, checker, checkedAt, items[{id, status pass/warn, detail?}], warnings[]}`; the hub builds no package while a check fails |
| `provenance` | `{hub {url, projectId, draftRevision}, decisions, openQuestions[{id, text}], attempts[]}`; GAID shows open questions on the card |
| `recipes[]` | 레시피 `{id, workflowId, title, choices, unresolvedChoices}`, checked like `checkGeoStart` against this method's Workflow; opens an editable setup, never runs |
| `files[]`, `packageDigest` | Every file under `<slug>/` except `gaid-method.json`; GAID refuses a package whose tree does not match |
| `workflows[]` | geo-workflow/v1 objects; `skillIds` are `local:<slug>` (this package's skill) or catalogue Atlas ids; `environmentProfile` is a catalogue environment id; `expectedArtifacts[].files` may use `*` within a name |

An invalid file lists the method with its issues and no startable workflow.

## Fetching
- Published skill page on a configured site: unchanged; lifecycle `published`.
- Hub draft: `<site><authoring>packages/<owner>/<slug>/<revision>` (`geo/distribution.json` `skillHub.sites[].authoring`,
  e.g. `api/gaid/`) returns `gaid-hub-package/v1`. GAID requires package, manifest and page URLs on the same origin, checks
  sha256 and size, then that `gaid-method.json` names the same method id, revision and packageDigest and that the tree
  matches `files[]`. A query (capability token) is accepted in the descriptor URL and is not stored or shown. http is
  accepted only for loopback hubs (trial hub `http://127.0.0.1:4317/` on PC74).
- `GET /geo/skill-hub/methods` lists each authoring hub's `GET <authoring>methods` (`gaid-hub-methods/v1`) with descriptor
  URLs; read-only.
- Upload of a `.tar.gz`: lifecycle `draft`; an upload never overwrites a hub record for the same bytes.
- The origin of staged bytes is kept as `<agentDir>/skill-hub/packages/<sha256>.origin.json`.

Installation is always the existing preview → acknowledgement → install gate.

## LocalMethod and trials
- `GET /geo/methods`: installed skills (project, then user scope) that carry `gaid-method.json`, with workflow readiness
  computed like catalogue workflows, the installed tree hash and `editedLocally`.
- A chat started from a method workflow uses exposure `method:<slug>:<workflowId>`; its session creation pins a trial record
  (`.kady/geo/method-trials/<sessionId>.json`: method id, revision, package sha256, tree hash). Observations (tool calls,
  failures, models, files read and written, expected-artifact matches) are derived from the session's provenance log when
  read. `PUT /geo/methods/trials/:sessionId/assessment` stores the researcher's outcome and note verbatim.
- `geo-start/v1` recipes are unchanged and still refer to pinned catalogue workflows only; method 레시피 live in the package.
- GAID → hub handoff (`gaid-analysis-handoff/v1`): download the bundle and open `<hub>#/author/new?from=gaid`; optional
  direct `POST <authoring>handoffs` for loopback hubs (child unit gaid-hub-integration--handoff).
