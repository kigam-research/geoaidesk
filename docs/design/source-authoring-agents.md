# Source-grounded skill and workflow coauthoring

Status: implementation proposal, not shipped code. Read with `spatial-pu-pilot.md` and the canonical task report. NotebookLM is a processing-flow reference only; none of its screen layout, branding or visual design is selected.

## Outcome and sources

A researcher provides sources and a reuse goal. A coauthor helps identify usable methods and missing decisions, creates a real skill and reusable launch request, and revises them from observed trial results. The researcher sees method language and outputs, not package metadata forms. The application records source revisions, decisions, attempts and state transitions independently of any model's narrative.

Procedure references inspected:

- Codex system `skill-creator`: `/home/seongin3/.codex/skills/.system/skill-creator/SKILL.md`, especially intent/resources, validation and independent forward-testing. Its validator checks its own frontmatter/scaffolding, not scientific decisions.
- Anthropic `skill-creator`: official `anthropics/skills` revision `dbd4588f9e1033efb41dad4bef2f7947c8993d44`, `skills/skill-creator/SKILL.md`. Local cache matches official bytes, SHA-256 `dcd4803e61e913e6fc27294184cd3a71f09f5e924ff20c8a9a20173e7b3c2bcf`. Intent/interview, realistic tasks and expected outputs, artifact review, optional baseline comparison and trigger evaluation.
- Neither vendor's CLI, invocation syntax, package transport or test harness is a generic GAID runtime contract. GAID targets Pi skills and its actual installation/exposure behavior. Codex `agents/openai.yaml` is not Pi metadata; Anthropic's ZIP-format `.skill` is not the hub's tar.gz transport. Use adapters, not renamed files.

No vendor skill was installed or invoked to create a real method in this phase. No paid/model authoring evaluation or scientific rerun has occurred.

## Authoring loop adapted from the creators

1. Infer intended use, input/output examples and known constraints from supplied sources and the current request. Ask only material gaps. A beginner need not know whether the result is called a skill or a recipe.
2. Propose a concise usage scope and representative request. For example, paper reproduction and a generalized new-region method are different scopes. Preserve researcher corrections as explicit decisions.
3. Draft the method with evidence anchors and necessary resources. Scripts handle repeated or fragile computation; references hold conditional detail; assets exist only when actual output needs them. Do not create empty folders or generic manuals.
4. Generate the Pi skill and launch request from the same draft. A private method card needs the additive local-method registry described in the pilot brief.
5. Offer a small realistic trial with visible expected artifacts/checks. For scientific comparisons, freeze the criterion before inspecting candidate outputs; do not tune tolerances to produce a passing grade. Existing task authorization and budget boundaries still apply.
6. Inspect actual artifacts and observed checks, collect researcher feedback, revise the relevant method/resource and rerun only affected checks. A new-skill baseline without the skill can be useful, but is not a compulsory doubled workload for every edit.
7. Test discoverability separately from execution. Use representative positive and near-miss requests through GAID's actual exposure/selection path. Keep the description precise; do not copy broad "pushy" triggers that activate unrelated research work.

The withheld existing PU skill is available only to later evaluation, not the authoring context or an undisclosed example answer. Compare useful behavior/evidence, not matching prose. The reference skill is not scientific ground truth.

## Agents and ownership

| Role | Scope | Output | May mutate authoritative state? |
|---|---|---|---|
| Lead coauthor | Understand request, integrate evidence, propose method/questions, explain changes | Typed proposals against one draft revision | Only through validated application operations |
| Source reader, optional | Selected source pages/figures; unresolved passages | Findings with exact anchors and limits | No; no direct user interview |
| Code mapper/builder, optional | Supplied code interface, portable helpers and bounded staging changes | Input/output mapping or candidate files | Candidate staging only; no accepted decisions/package replacement |
| Checker, optional | Specific evidence conflict or candidate trial artifacts | Findings with artifact evidence and uncertainty | No; cannot grant execution/scientific approval |
| Application services | Source intake/extraction, persistence, validation, job dispatch, packaging | Durable records and observed receipts | Yes, within explicit transition rules |

Use the lead alone for small/tightly coupled work. Add an independent role only for useful parallel reading, substantial separate code, or a concrete review need. Do not run all four model providers as a standing panel. Only the lead presents questions to the researcher, consistent with current GAID child tools excluding `interview`.

## Durable records and proposal operations

Retain the pilot's source/extraction/finding/method/package/local-method/validation records. Add:

- `AuthoringAttempt`: route/model, capability profile, source/draft revision, prompt/tool-schema version, proposal, validation errors, usage and terminal outcome. Store emitted artifacts/observed actions, not private chain-of-thought.
- `Question`: server-assigned stable ID, affected field/decision, draft revision, reason, evidence refs, answer type/options, materiality, dependencies and status.
- `Decision`: exact user response, optional normalized value, attribution, related question/source revision, time and supersession history. Model interpretation is not rewritten as the user's words.
- `DraftPatch`: base revision, operation/idempotency ID, changed fields/files, evidence refs and dependencies. Failed proposals never replace the last accepted state.

Illustrative typed operations (names not implemented):

- `submit_findings(sourceRevision, findings)`
- `propose_draft_patch(baseRevision, patch)`
- `propose_questions(baseRevision, questions)`
- `record_answer(questionId, questionRevision, response)` — UI/server operation, not a model-authored user answer
- `build_package(draftRevision)`
- `request_trial(packageRevision, inputRevision, checkPlan)`

The application applies schema, source/file-reference and revision checks before committing a proposal. Creation/retry with the same operation ID returns the existing result rather than duplicating questions/packages. Concurrent answers cannot be overwritten by a model response generated from an older draft. Recovery reconstructs the work from persisted records, not by asking the model to remember the conversation.

## Question policy

1. Check existing sources/decisions for the requested field first. Source-known facts are not mandatory confirmation forms.
2. Every proposed question names the missing condition, why it affects the result and which action depends on it. Reject malformed or already-answered stable fields. Semantic similarity can flag duplicate wording, but is not a perfect deterministic deduplicator.
3. Show a short contextual question or small related group, with plain-language options when useful and free text when necessary. A justified recommendation is not a submitted answer. Keep technical fields generated behind the scenes.
4. A required unresolved decision blocks only dependent generation/execution, not all source reading or draft saving. The user may defer it; the draft remains incomplete in that respect.
5. Answer validation checks option membership, value type, required fields and question revision. Ambiguous free text is stored verbatim; an important interpretation is surfaced as a proposal instead of silently converted to a new scientific commitment.
6. Timeout, cancel, disconnect, provider error and preselection leave the question unanswered. Restart reopens the same persisted question; it does not infer a recommended default.
7. Source/draft changes supersede only affected questions/checks. Preserve unaffected decisions. A scope-changing conflict is visible; ordinary supported edits need no new approval ceremony.

Programs can enforce declared required conditions, not discover every unknown scientific assumption. Model checks and researcher inspection are still needed for missing conditions or invalid interpretations. Neither JSON validity nor two models agreeing establishes scientific truth.

## Nondeterminism and failure handling

| Condition | Application behavior |
|---|---|
| Malformed output | Preserve attempt, return precise validation errors for a bounded repair; retain previous valid draft |
| Invented source ID/page/file | Reject invalid reference. Existing anchors still require semantic review: existence does not prove support |
| Missing implementation or data | Save descriptive/partial method with explicit limits; do not mark executable/validated |
| Interrupted generation | Resume from last committed draft; no partial file tree becomes the installed package |
| Duplicate response/retry | Idempotent operation ID and base-revision check |
| Provider failure or switch | Preserve decisions; new attempt records new model and same declared input revision; no silent connection changes |
| Trial exits 0 | Record process success only; declared output checks and research interpretation stay separate |
| Candidate package changes | New package revision; invalidate affected validation evidence, retain earlier history |
| Model reviewer says pass | Store reviewer judgment with evidence; never substitute it for numerical checks or researcher assessment |

Initial proposal: one bounded format-repair attempt per failed response, then show a recoverable draft/error or use an explicitly configured fallback. This count is an implementation starting point, not a quality guarantee. Do not retry unknown external execution outcomes automatically. Long-running trial state belongs to the job manager, not a still-open chat promise.

## Model routing using existing GAID connections

The user reports working Codex, Claude, MiniMax and 67-IP Qwen 3.8 Flash Next connections. Preserve these exact existing routes; no new provider installation or authentication scheme is required by this design.

Historical verified institutional route: `kigam-qwen/qwen3.8-flash-next`, `http://10.13.15.67:8000/v1`. Oct 14 map/LAS trials do not establish paper-to-skill authoring ability. Do not substitute the older local Ollama Qwen3 30B. Current exact Codex/Claude/MiniMax model refs/capabilities were not queried in this audit.

- Lead uses the researcher/project's selected connected model. Codex or Claude are initial candidates, not demonstrated winners. The lead role is not bound to a vendor.
- A bounded source-reading role can use institutional Qwen or another chosen route after testing the needed contract. Supply extracted text and, only if supported, page images. Do not presume native PDF, vision, tool or constrained-JSON support.
- MiniMax remains an eligible route; no unsupported cheap/fast/quality tier is assigned.
- Independent checking may use a different available route when it adds value. Agreement is evidence to inspect, not certification.
- Capability profile is per exact route/model and includes supported input modalities, tool-call/structured-output behavior, context/output limits and observed errors. GAID currently lacks a general JSON-Schema capability flag.
- Prefer typed tool submission where supported, otherwise validated JSON proposals through the existing provider-neutral one-shot adapter. Provider-enforced schema mode is an optimization, never the sole validator. Subscription access is used through its existing connection, not treated as a generic API key. Preserve current billing/usage accounting.

Existing precedent: `server/src/agent/next-experiments.ts` persists a request receipt, handles usage for invalid responses and restricts source IDs; `one-shot-reasoning.ts` uses provider-neutral `completeSimple`. Extend these patterns rather than bypassing model resolution or calling arbitrary provider endpoints.

## Bounded first implementation proof

1. Submit PDF/URL plus optional original code without the old PU skill in scope. Verify original-source status and recorded extraction.
2. Generate grounded findings and one meaningful unresolved question; restart the authoring service and recover the same question/draft without a duplicate.
3. Answer it; inject a stale or malformed proposal and verify it cannot overwrite that answer or create a valid package claim.
4. Generate and install a genuine private skill/launch request, then run one authorized bounded behavior case using exact package/input revisions. Inspect actual output, not an agent's completion message.
5. Revise from an observed issue; retain decisions and previous package/check history. Confirm sharing is optional and excludes private source files unless deliberately selected.

Before fixing model roles, a separate small authoring-contract probe can use manuscript pp. 1–2, p. 9 and Figure 6 on p. 20, optionally a small original-code slice. Check source references, missing questions, malformed responses and correction effort; no training. That excerpt probe cannot prove complete paper reproduction or a full reusable PU pipeline. No such model probe is run or authorized by the design document alone.

## Implementation ownership and integration order

Set shared record/proposal schemas first. Candidate independent packages after scope is agreed: source intake/extraction; durable draft/question service; private local-method/package adapter; researcher UI. Integrate records and validators before wiring model writes, then question presentation, then package/trial handoff, then UI states and bounded end-to-end checks. Parent owns shared interfaces and integration. Hub-specific contribution/registry changes go to the skill_hub hub. No child writer is started for the current documentation/design phase.
