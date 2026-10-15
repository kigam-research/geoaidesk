# Hub method packages in GAID (consumer side)

Status: GAID implementation of contract draft v0 (2026-10-15), sent to the skill_hub unit gaid-hub-authoring as request
da92dc0fec04. skill_hub owns the producer contract; this file records what GAID reads and enforces, and changes when the
agreed version lands in skill_hub docs/specs/.

## Package
One gzip tar with a single root `<slug>/` (the existing skill_hub install gate, `server/src/geo/skill-hub.ts`): `SKILL.md`
(Pi skill), optional `scripts/`, `references/`, `assets/`, hub metadata (`atlas.yaml`, `LICENSE`; GAID does not parse YAML)
and optional `gaid-method.json`. Without that file the package installs as a plain skill.

`gaid-method.json` (`gaid-method/v1`, `server/src/geo/methods/method-file.ts`; unknown keys ignored):

| Field | Rule |
|---|---|
| `methodId`, `revision` | Hub identity and immutable revision of these bytes |
| `lifecycle` | `draft` / `submitted` / `published` as the package claims it; GAID shows the hub descriptor's value instead and caps everything else at `draft` |
| `implementation` | `descriptive` (instructions only) or `implemented` (code present); "tested" is a GAID trial record, never a package claim |
| `title`, `summary` | `{ko, en?}` |
| `sources[]` | `{kind: doi/url/file, ref, title?}` references; private sources are not in the package |
| `checks[]` | Hub validation summary `{name, state: pass/fail/warn, detail?}` (atlas, schema, taxonomy) |
| `workflows[]` | geo-workflow/v1 objects; `skillIds` are `local:<slug>` (this package's skill) or catalogue Atlas ids; `environmentProfile` is a catalogue environment id; `expectedArtifacts[].files` may use `*` within a name |

An invalid file lists the method with its issues and no startable workflow.

## Fetching
- Published skill page on a configured site: unchanged; lifecycle `published`.
- Hub draft: a descriptor URL under a configured site's `authoring` path (`geo/distribution.json` `skillHub.sites[].authoring`)
  returns `gaid-hub-package/v1` `{methodId, revision, lifecycle, sha256, size, packageUrl}`. GAID requires the package on the
  same origin, checks sha256 and size, and checks that `gaid-method.json` names the same method id and revision. A query
  (capability token) is accepted in the descriptor URL and is not stored or shown. http is accepted only for loopback hubs.
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
- `geo-start/v1` recipes are unchanged and still refer to pinned catalogue workflows only.
