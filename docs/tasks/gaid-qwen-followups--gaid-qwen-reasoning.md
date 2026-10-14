---
format: 1
status: active
updated: 2026-10-14T12:15:03Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"f950c83f-f114-403b-86ba-8e4e7d56f2d1","pid":435067,"provider":"codex","session":"01a13a50-2bfe-7e91-a78c-e914e61554c1","start":"44569531","token":"75fb704827e2463ede22fe734b25b74e4d6334906fb417af71c64d9809eb566c"}
branch: task/gaid-qwen-followups--gaid-qwen-reasoning
target: task/gaid-qwen-followups
parent: gaid-qwen-followups
---
# gaid-qwen-followups--gaid-qwen-reasoning

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-qwen-reasoning` (geoaidesk)

Parent unit: `gaid-qwen-followups` (Claude orchestrator). You are the single writer of this child unit.

## Goal (user answer, verbatim Korean, 2026-10-14)
> "1번은 가로하고 2번은 가로 하면서 높음을 지정하면 보통으로 보내지게 하자."
Item 2 가) with the user's addition: per custom model server, configure which reasoning levels it accepts and never
send an unaccepted value; when "높음" (high) is selected for the KIGAM server, send "보통" (medium). Make the
substitution visible to the user (thinking selector), not silent.

## Verified facts
- KIGAM vLLM server (`http://10.13.15.67:8000/v1`, openai-completions) answers 400 "Unexpected reasoning effort high.
  Supported types are xhigh (default), medium, and low." It accepts `reasoning_effort` low, medium, xhigh; "off" sends
  no field. Today the app sends minimal/high as-is (rejected) and clamps xhigh down to high (Pi treats an unmapped xhigh
  as unsupported). Evidence: reports/2026-10-14-gaid-kigam-qwen-trial/index.md §3.1.
- Pi 1.0 `Model.thinkingLevelMap?: Partial<Record<"off"|"minimal"|"low"|"medium"|"high"|"xhigh"|"max", string|null>>` is
  accepted per model in `models.json` (pi-coding-agent `dist/core/model-config.js` ThinkingLevelMapSchema).
  pi-ai `getSupportedThinkingLevels`: null = unsupported; xhigh/max supported only when mapped to a string.
  `clampThinkingLevel` searches UPWARD first (high -> xhigh). openai-completions sends
  `reasoning_effort = thinkingLevelMap[level] ?? level`. So `high: "medium"` keeps "high" selectable and puts
  "medium" on the wire, for the lead, subagent child `pi` processes (same agentDir models.json) and one-shot calls.

## Decided design (do not re-open; raise a concern only with concrete evidence)
- Per custom provider setting `reasoningLevels?: Array<"minimal"|"low"|"medium"|"high"|"xhigh">` = the levels the server
  accepts under their own names. Absent/empty = today's behaviour (no map written). "off" is always selectable.
- Written into models.json as each `reasoning: true` model's `thinkingLevelMap`: accepted level -> itself; unaccepted
  level -> nearest LOWER accepted level, else nearest HIGHER accepted level; none accepted -> null. KIGAM {low,medium,
  xhigh} gives minimal->"low", low->"low", medium->"medium", high->"medium", xhigh->"xhigh". Do not write `off` or `max`.
  Round-trip: derive `reasoningLevels` back from the map when listing (accepted = levels mapped to their own name), or
  keep it in the sidecar `kady-custom-models.json`; your choice, but models.json stays the source Pi reads and a
  hand-written provider's map is never rewritten. Existing saved providers are not rewritten until the user saves.
- Picker rows for custom servers (`customModelForClient`, /providers/models) expose the effective wire level per
  selectable level when it differs (e.g. `thinkingSentAs: { high: "medium", minimal: "low" }`), computed from the
  resolved Pi model's map. Keep it scoped to custom servers.
- Settings -> Providers -> Custom model servers card: per-server control for accepted reasoning levels (checkbox per
  level, Korean first), with a one-line explanation that unaccepted levels are sent as the nearest accepted lower one.
- Thinking selector (chat tab; defaults panel if the model is known there): when the selected model maps the chosen
  level to another, the chip and the option row show it (e.g. chip "높음 → 보통", row note "이 서버에는 보통으로
  보냅니다"). Wording follows the copy rules below.

## Scope and owned files
Own: `server/src/agent/custom-models.ts`, `server/src/api/model-providers.ts` (custom-models routes only),
`web/src/lib/custom-models.ts`, `web/src/components/custom-models-card.tsx`, `web/src/components/thinking-selector.tsx`,
the wiring in `web/src/components/chat-tab.tsx` / `web/src/components/settings/defaults-panel.tsx` / the models hook,
`web/src/geo/locales/app/{ko,en}.json` (or a new GAID namespace), tests next to these, the AGENTS.md sentence
"`modelThinkingLevels` is deliberately not exposed" (update it to describe the new setting), and
`geo/integration-boundaries.json` entries for any upstream file you newly edit (owner: gaid-qwen-followups).
Do NOT touch: `server/src/api/projects.ts`, `server/src/api/skills.ts`, `server/src/geo/provision.ts`,
`geo/release-proof/*`, `geo/compatibility.json`, `docs/geo/compatibility.md`, reports/ (parent owns them).
Do not change the user's review instance (~/deploy/geoaidesk, ports 3000/18000, ~/.geoaidesk). No paid model runs.
A live check against the KIGAM server is optional and the parent will do the real re-trial; if you do one, one short
request at a time.

## Rules
- Read AGENTS.md first (copy rules for user-facing text: geo/copy/gaid-writing.md, terminology.csv; strings in the
  locale catalogue, Korean first; record string ids with ko/en text in your task document).
- Checks: run the server and web vitest suites and both typechecks for touched areas, plus
  `node geo/copy/validate-copy.mjs web/src/geo/locales`. The parent runs the full `scripts/check` after integration;
  you may run it too (`task job run -- scripts/check`).
- Network: KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"`.
- Python via `uv run`; no bare python or pip.
- Keep your task document current; publish with `task save`, finish with `task finish`. No report of your own: put a
  short result summary (what changed, string ids ko/en, tests run with counts) in your task document's Current state;
  the parent writes the report.

## Current state
- Resumed in the assigned worktree; confirmed the decided per-provider mapping and owned interfaces.
- Implemented provider-level reasoningLevels validation and sidecar round-trip; reasoning models receive Pi thinkingLevelMap on explicit save only. Hand-written providers/maps remain untouched.
- Custom picker rows derive thinkingSentAs from the resolved Pi model. Chat uses fresh discovery metadata even for restored tabs; Defaults shows known-model substitutions. Added server checkboxes and visible chip/row mapping.
- Targeted checks passed: server custom-models 12 tests; web custom-models/thinking/defaults 15 tests. Real Pi runtimes independently reload the map; intercepted completion payloads prove all six levels, including high -> medium, xhigh unchanged and Off omitted, with zero network calls.
- Server typecheck passed; web typecheck and full suites pending. Copy validator passed with 0 errors / 56 existing warnings; no new string warnings.
- No review-instance changes and no live/paid model requests.
## Next steps
1. Run the saved snapshot server/web suites with the scientific helper environment; record final counts.
2. Review the final diff, remove regenerable local caches, save and finish for parent integration.
## Failed approaches
## Notes and decisions
- Sequential decisions: preserve accepted design; persist accepted levels in the managed sidecar (including servers with no reasoning models); Pi reads each reasoning model map from models.json.
- Owned interfaces: optional reasoningLevels on custom providers; optional thinkingSentAs on custom picker models. Integrate backend first, then UI and regression checks.
- Work is tightly coupled across these interfaces and remains with this single writer; no nested child units.
- codegraph is unavailable for this exact worktree (unindexed); native source reads are used without creating an index.
### Added UI strings (all before: absent)

| ID (app namespace) | Korean after | English after |
|---|---|---|
| customModels.acceptedReasoningLevels | 서버가 지원하는 추론 수준 | Reasoning levels accepted by the server |
| customModels.reasoningLevelsHelp | 선택하지 않은 수준은 가장 가까운 낮은 지원 수준으로 보냅니다. 낮은 수준이 없으면 가장 가까운 높은 수준으로 보냅니다. 아무것도 선택하지 않으면 기존 동작을 유지합니다. 끄기는 항상 선택할 수 있습니다. | Unselected levels are sent as the nearest lower accepted level, or the nearest higher one if none is lower. Leave all unchecked to keep the existing behavior. Off is always selectable. |
| chat.thinking.mappedLevel | {selected} → {sentAs} | {selected} → {sentAs} |
| chat.thinking.sentAs | 해당 서버에는 {level}으로 보냅니다. | Sent to this server as {level}. |

## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
