---
format: 1
status: ready
updated: 2026-10-18T08:57:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"dd14a2b1-08ca-4ec5-b9a5-c36ac0b3decd","pid":2986331,"provider":"codex","session":"01a14e34-3599-7921-a909-ef8c86596d17","start":"20134566","token":"f8920c52ddfb78cfda8aa61a33610fd220a79d3b368da7c773080f68204acb5b"}
branch: task/gaid-notebook-review--record-cleanup
target: task/gaid-notebook-review
parent: gaid-notebook-review
---
# gaid-notebook-review--record-cleanup

## Goal and done criteria
Request from the starter:

# Child unit: record-cleanup (parent gaid-notebook-review)

Goal: make the existing notebook (it becomes the "작업 기록" / work record behind GAID research notes) follow the GAID
researcher-view rules and language. Parent report: reports/2026-10-18-gaid-notebook-review/index.md §3.1 (diagnosis);
user decision 2026-10-18: "모두 권장으로 진행하자." Read `docs/design/ui-guide.md` sections 1, 8, 9 and the copy rules in
AGENTS.md (UI copy and locales; `geo/copy/gaid-writing.md`, `geo/copy/terminology.csv`) before changing visible text.

Scope:
1. Entry card (`web/src/components/lab-notebook-entry-card.tsx` and helpers it uses): execution evidence that shows
   command lines, script paths or tool output (e.g. "보고된 근거: uv run python .pi/skills/…") moves behind a collapsed
   disclosure whose locale id ends in `.technical` (UI guide R2/R4); the visible line keeps the execution state in
   research words. Saved-result links (`notebook-result-links.tsx`) must not show chat/session or tool-call ids
   (seen in the review app as `01a13dfc-…/chatcmpl-tool-…` under "저장된 결과 1 보기"); keep the open action.
   Agent-written entry titles/bodies are data: do not translate or rewrite them.
2. Exports and print: the Markdown/JSON/ZIP exports (`server/src/agent/notebook-export.ts`, `notebook-zip.ts`) and the
   print view (`web/src/lib/notebook-print.ts`) use hard-coded English headings/labels ("Lab Notebook", type labels,
   "User notes", "Evidence status", "Proposed next investigations — not performed", …). Make them follow the UI locale:
   the web passes its locale (e.g. `?lang=ko|en`) to the export routes, the server picks Korean or English labels (default
   English when absent, so upstream callers keep working); the print view uses `t()` strings. The chat tab's
   "연구 노트 (.md)" export (`server/src/agent/session-export.ts` heading "# Lab Notebook … exported from K-Dense BYOK")
   must not show K-Dense/BYOK (AGENTS.md "Names in visible copy"): use GAID wording in the chosen language.
3. Methods draft (`server/src/agent/methods-draft.ts`): the system prompt has no language rule; add one that writes the
   draft in the language of the entries/the user's request (reuse `REPLY_LANGUAGE_RULE` from `server/src/geo/instructions.ts`
   or an equivalent sentence). Keep the existing tests passing; add one assertion for the rule.
4. `web/src/components/next-experiments-dialog.tsx:21` hard-coded English default text → locale string.

Owned files: the files above, `web/src/geo/locales/notebook/*` and `web/src/geo/locales/research/*` (new keys only where
needed), their tests, and append-only `geo/integration-boundaries.json` entries (owner `gaid-notebook-review`) for every
upstream file you edit. Do NOT touch `web/src/components/file-preview-panel.tsx`, the layout/scope logic of
`web/src/components/lab-notebook-view.tsx` (the parent rebuilds the notebook tab around it), `web/src/geo/notes/**`,
`server/src/geo/notes/**`, or docs other than your task document and `docs/lab-notebook.md` export lines if wording changes.

Checks before finish: `cd web && npx tsc --noEmit && npx vitest run` for the touched component tests;
`cd server && npm run typecheck && npx vitest run` for export/methods-draft/session-export tests;
`node geo/copy/validate-copy.mjs web/src/geo/locales`; `node geo/ui/check-ui.mjs`. No screenshots needed (the parent takes
them at integration). Network: raw.githubusercontent.com is blocked; use `gh api` if needed.

Evidence in your task document: files changed, check commands and results, and every changed/added string id with Korean
and English before → after (copy rule). Then `task finish`.

## Current state
Implemented locale-aware work-record export/print labels, collapsed copyable execution/source technical disclosures, GAID session-export branding, a Methods draft language rule and localized proposal constraints. Authored titles, bodies, code and machine JSON keys/enum values are preserved. Web/server typechecks passed; focused web tests: 7 files/98 tests, server tests: 5 files/64 tests. Final print/helper recheck: 3 files/31 tests. Copy validation: 0 errors/62 warnings (scientific-limit wording retained). UI validation: 0 errors/102 existing accepted debt. Runtime tsx smoke produced the Korean work-record heading. No deployment performed; parent integration/screenshots/full scripts/check remain.
## Next steps
<!-- task:closed -->
Closed 2026-10-18T08:57:46Z: ready; the parent gaid-notebook-review integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Initial typechecks could not start because dependencies were absent. npm ci completed in web and server without changing lockfiles.
- A task job request for dependency installation did not launch: the CLI required a clean saved source. No receipt/job was created; routine dependency setup then ran directly (13–18 seconds).
- First source checks found an over-broad label substitution in a local variable and web imports with .ts extensions; fixed both. Restored the existing English challenge/context labels after a regression assertion detected the difference.
## Notes and decisions
- Sequential integration: shared export labels → exporters/helpers → route/download language plumbing → regression checks. This tightly coupled child unit stays with its single writer.
- Optional `lang` on export requests/options; absent or unsupported values stay English. JSON preserves machine keys and authored values, adding localized display metadata.
- Necessary plumbing also touches server API routes and chat-tabs-bar; notebook-view changes are limited to the export request URL, with no layout/scope changes.
- UI rules: P3/P6, R1/R2/R4, T1. Parent owns screenshots and the integrated user report.
## Open items
None.
## Report
No separate child report. Parent incorporates this evidence into reports/2026-10-18-gaid-notebook-review/index.md and takes the integrated Korean screenshots.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

## Implementation evidence

### Files and interfaces

- server/src/agent/methods-draft.ts
- server/src/agent/notebook-export.ts
- server/src/agent/notebook-zip.ts
- server/src/agent/session-export.ts
- server/src/api/projects.ts
- server/src/api/sessions.ts
- server/test/methods-draft.test.ts
- server/test/notebook-export.test.ts
- server/test/notebook-routes.test.ts
- server/test/session-export.test.ts
- web/src/components/chat-tabs-bar.tsx
- web/src/components/lab-notebook-entry-card.test.tsx
- web/src/components/lab-notebook-view.test.tsx
- web/src/components/lab-notebook-view.tsx
- web/src/components/next-experiments-dialog.test.tsx
- web/src/components/next-experiments-dialog.tsx
- web/src/components/notebook-evidence-summary.tsx
- web/src/components/notebook-result-links.test.tsx
- web/src/components/notebook-result-links.tsx
- web/src/geo/locales/notebook/en.json
- web/src/geo/locales/notebook/ko.json
- web/src/geo/locales/research/en.json
- web/src/geo/locales/research/ko.json
- web/src/lib/next-experiments.test.ts
- web/src/lib/next-experiments.ts
- web/src/lib/notebook-execution.ts
- web/src/lib/notebook-plans.test.ts
- web/src/lib/notebook-plans.ts
- web/src/lib/notebook-print.test.ts
- web/src/lib/notebook-print.ts
- web/src/lib/notebook-result-links.ts
- web/src/geo/notebook/export-text.ts (new shared IO-free catalogue reader; only the two notebook JSON catalogues and ICU formatter are imported by server code).

The optional lang=ko|en query is sent by the notebook and chat-tab downloads. Session/project export routes normalize absent or unsupported language to English. ZIP forwards language to its Markdown renderer. JSON adds locale and display labels; existing data keys, enums, annotations and authored text remain unchanged. Print uses t() and the UI locale, with an explicit language option for deterministic callers. Shared execution, plan, proposal and result-reference text helpers default to English so existing model-context callers retain their language.

### UI rules

P3/P6, R1/R2/R4: command evidence, result identities, technical reasons and raw errors are collapsed, with copy actions. Execution/result states and the saved-result open action remain visible. T1: touched summary/link text is at least 12 px. No new UI debt. Parent owns the two viewport screenshots; none required in this child contract.

### Catalogue changes (Korean and English before → after)

All rows below are new catalogue ids (∅ means no previous catalogue entry). Export/print labels were previously hard-coded English in the owned renderers/helpers; their English labels are retained apart from GAID branding and human-readable plan field labels. Newly added metadata/disclosure labels had no prior visible counterpart. Agent-authored prose is not changed. Existing locale ids are unchanged.

| Id | Korean before → after | English before → after |
|---|---|---|
| notebook.export.title | ∅ → 작업 기록 | ∅ → Lab Notebook |
| notebook.export.project | ∅ → 프로젝트 | ∅ → Project |
| notebook.export.session | ∅ → 채팅 | ∅ → Session |
| notebook.export.chats | ∅ → 채팅 수 | ∅ → Chats |
| notebook.export.span | ∅ → 기록 기간 | ∅ → Span |
| notebook.export.entries | ∅ → 기록 수 | ∅ → Entries |
| notebook.export.unattributed | ∅ → 출처 미지정 | ∅ → Unattributed |
| notebook.export.by | ∅ → 작성: {role} | ∅ → by {role} |
| notebook.export.confidence | ∅ → 작성자 확신: {confidence} (자체 보고) | ∅ → author confidence: {confidence} (self-reported) |
| notebook.export.evidence_status | ∅ → 근거 상태 | ∅ → Evidence status |
| notebook.export.authored_interpretations | ∅ → 작성자의 해석이며 과학적 판정이 아닙니다 | ∅ → authored interpretations, not a scientific verdict |
| notebook.export.needs_review | ∅ → 검토 필요 | ∅ → Needs review |
| notebook.export.review_description | ∅ → 기록이나 연결된 근거의 인용 파일이 변경되었거나 없습니다. 주장을 반박하는 근거는 아닙니다. | ∅ → direct artifacts in this entry or its linked evidence changed or are missing. This does not refute the claim. |
| notebook.export.unavailable | ∅ → 내보낸 기록에 없음 | ∅ → unavailable in this export |
| notebook.export.supersedes | ∅ → 대체한 기록 | ∅ → supersedes |
| notebook.export.superseded_by | ∅ → 대체한 새 기록 | ∅ → superseded by |
| notebook.export.applicability | ∅ → 적용 범위 (작성자 보고) | ∅ → Applicability (authored) |
| notebook.export.revisit | ∅ → 재검토 조건 (자동 실행 아님) | ∅ → Revisit when (condition, not an automatic action) |
| notebook.export.outcome | ∅ → 결과 | ∅ → Outcome |
| notebook.export.outcome_notice | ∅ → 무효과 결과와 기술적 실패만으로 가설을 반박하지 않습니다 | ∅ → null results and technical failures do not automatically refute a hypothesis |
| notebook.export.limitations | ∅ → 한계 | ∅ → Limitations |
| notebook.export.artifact_checks | ∅ → 인용 파일 확인 | ∅ → Artifact checks |
| notebook.export.artifact_notice | ∅ → 직접 인용한 파일만 확인합니다. 바이트가 같아도 과학적 타당성이나 상위 입력 자료를 검증하지 않습니다. | ∅ → direct cited files only; unchanged bytes do not verify scientific validity or upstream inputs. |
| notebook.export.checked | ∅ → 확인: {when} | ∅ → checked {when} |
| notebook.export.incomplete | ∅ → 불완전한 확인 | ∅ → Incomplete checks |
| notebook.export.omitted | ∅ → 추가 파일 {count}개는 확인하지 않았습니다. | ∅ → {count} additional artifacts were not checked. |
| notebook.export.pinned | ∅ → 사용자가 고정함 ({times}) | ∅ → Pinned by user ({times}) |
| notebook.export.next | ∅ → 다음 연구 제안 (수행하지 않음) | ∅ → Proposed next investigations — not performed |
| notebook.export.proposal_context | ∅ → 기록된 제안 맥락 (과학적 검증 아님) | ∅ → Recorded proposal context (not scientific verification) |
| notebook.export.preference | ∅ → 사용자의 계획 선호 (실행·지출 승인 아님) | ∅ → User planning preference — not execution/spending approval |
| notebook.export.analysis_plan | ∅ → 분석 계획 제안 (승인 전 초안) | ∅ → Proposed analysis plan (draft, not approved) |
| notebook.export.robustness | ∅ → Robustness workflow 제안 (승인·실행 전) | ∅ → Proposed robustness workflow (not approved or executed) |
| notebook.export.plan_unavailable | ∅ → 계획 이력 없음 | ∅ → Plan history unavailable |
| notebook.export.result_refs | ∅ → 저장된 연구 결과 참조 | ∅ → Recorded scientific-result references |
| notebook.export.result_notice | ∅ → 원본 식별자와 저장한 내용의 해시이며 독립 검증한 측정값이 아닙니다. 원본 채팅 기록은 내보내기에 포함하지 않습니다. | ∅ → source identifiers and pinned content digests, not independently verified measurements. Canonical source session logs are not bundled in this notebook export. |
| notebook.export.missing_artifact | ∅ → 내보낼 때 파일이 없음 | ∅ → artifact missing at export time |
| notebook.export.comments | ∅ → 사용자 댓글 | ∅ → User comments |
| notebook.export.notes | ∅ → 사용자 메모 | ∅ → User notes |
| notebook.export.unresolved | ∅ → 대상을 찾지 못한 주석 | ∅ → Unresolved annotations |
| notebook.export.unknown | ∅ → 알 수 없음 | ∅ → unknown |
| notebook.export.missing_entry | ∅ → {kind}: 없는 기록 `{target}` ({when}){comment} | ∅ → {kind} for missing entry `{target}` ({when}){comment} |
| notebook.export.execution | ∅ → 실행 (작성자 보고, 독립 검증 아님): {status} | ∅ → Execution (authored, not independently verified): {status} |
| notebook.export.execution_evidence | ∅ → 보고된 실행 근거: {evidence} | ∅ → Reported execution evidence: {evidence} |
| notebook.export.no_execution_evidence | ∅ → 실행 근거 필드에 기록이 없습니다. | ∅ → Execution evidence not recorded in this field. |
| notebook.export.provisional | ∅ → 임시 기록 (아직 저장하지 않음) | ∅ → Provisional — not yet saved |
| notebook.export.interpretations | ∅ → 근거 연결은 작성자의 해석이며 독립 재현이나 확률이 아닙니다. | ∅ → Evidence links are authored interpretations, not independent replications or probabilities. |
| notebook.export.you | ∅ → 사용자 | ∅ → You |
| notebook.export.pin | ∅ → 고정됨 | ∅ → pinned |
| notebook.export.exported | ∅ → 내보낸 시각: {when} | ∅ → Exported {when} |
| notebook.export.prompt | ∅ → 요청 | ∅ → Prompt |
| notebook.export.reasoning | ∅ → 추론 | ∅ → Reasoning |
| notebook.export.command | ∅ → 명령 | ∅ → Command |
| notebook.export.tool | ∅ → 도구 | ∅ → Tool |
| notebook.export.error | ∅ → 오류 | ∅ → Error |
| notebook.export.output | ∅ → 출력 | ∅ → Output |
| notebook.export.truncated | ∅ → …(생략됨) | ∅ → …(truncated) |
| notebook.export.session_intro | ∅ → _채팅 `{session}` — GAID에서 내보낸 재현용 기록입니다._ | ∅ → _Session `{session}` — reproducible record exported from GAID._ |
| notebook.evidence.execution.technical | ∅ → 실행 기술 정보 | ∅ → Execution technical information |
| notebook.links.source.technical | ∅ → 결과 출처 기술 정보 | ∅ → Result source technical information |
| notebook.common.copy.button | ∅ → 기록 복사 | ∅ → Copy record |
| notebook.annotation.pin | ∅ → 고정 | ∅ → pin |
| notebook.annotation.comment | ∅ → 댓글 | ∅ → comment |
| notebook.annotation.note | ∅ → 메모 | ∅ → note |
| notebook.export.proposal_title | ∅ → 다음 연구 제안 | ∅ → Proposed next investigations |
| notebook.export.proposal_notice | ∅ → 연구 제안이며 관측 결과, 검증한 예측, 실행 승인 또는 지출 약정이 아닙니다. | ∅ → Proposed investigations, not observed findings, validated predictions, execution approvals or spending commitments. |
| notebook.export.target | ∅ → 대상 가설 | ∅ → Target hypothesis |
| notebook.export.target_notice | ∅ → 출처 채팅을 생략하면 제안이 작성된 채팅을 사용합니다 | ∅ → omitted source sessions default to the proposal’s session |
| notebook.export.question | ∅ → 연구 질문 | ∅ → Question |
| notebook.export.decision | ∅ → 결정할 사항 | ∅ → Decision to inform |
| notebook.export.existing | ∅ → 기존 자료 평가 | ∅ → Existing-data assessment |
| notebook.export.explanation | ∅ → 설명 | ∅ → Explanation |
| notebook.export.sources | ∅ → 출처 | ∅ → Sources |
| notebook.export.priority | ∅ → 우선순위 | ∅ → Priority |
| notebook.export.qualitative | ∅ → 정성 평가 | ∅ → qualitative |
| notebook.export.kind | ∅ → 연구 종류 | ∅ → kind |
| notebook.export.prerequisites | ∅ → 선행 조건 | ∅ → prerequisites |
| notebook.export.none | ∅ → 기록 없음 | ∅ → none declared |
| notebook.export.rationale | ∅ → 이유 | ∅ → Rationale |
| notebook.export.method | ∅ → 제안 방법 | ∅ → Proposed method |
| notebook.export.measurement | ∅ → 측정 항목 | ∅ → Measurement |
| notebook.export.controls | ∅ → 대조군 | ∅ → Controls |
| notebook.export.predicted | ∅ → {explanation}에서 예상한 결과: {outcome} | ∅ → PREDICTED under {explanation}: {outcome} |
| notebook.export.branch | ∅ → 관측할 결과: {outcome}<br>재검토할 결정: {decision} | ∅ → IF observed: {outcome}<br>THEN reconsider decision: {decision} |
| notebook.export.inconclusive | ∅ → 판단 불가 시 | ∅ → If inconclusive |
| notebook.export.inputs | ∅ → 필요한 입력 자료 (가용 여부 확인 전) | ∅ → Required inputs (not verified available) |
| notebook.export.resources | ∅ → 필요 자원 | ∅ → Resources |
| notebook.export.time | ∅ → 시간 | ∅ → Time |
| notebook.export.cost | ∅ → 비용 | ∅ → Cost |
| notebook.export.not_quote | ∅ → 견적 아님 | ∅ → not a quote |
| notebook.export.why_new | ∅ → 새 자료가 필요한 이유 | ∅ → Why new data |
| notebook.export.plan_empty | ∅ → 확정한 분석 계획이 없습니다. | ∅ → No frozen analysis plan recorded. |
| notebook.export.plan_title | ∅ → 로컬 분석 계획 기록 | ∅ → Local analysis-plan record |
| notebook.export.plan_notice | ∅ → 사용자가 확인한 로컬 기록입니다. 외부 사전등록이나 자료를 보지 않았다는 증거가 아닙니다. 계획은 의도이며 절차를 실행했다는 근거가 아닙니다. 자료 해시는 메타데이터이며 과거 자료 사본이 아닙니다. | ∅ → User-confirmed local records, not external preregistration or proof of data-naivety. Plan contents describe intentions, not evidence that procedures were executed. Dataset hashes are metadata, not retained historical data copies. |
| notebook.export.frozen | ∅ → 확정한 버전 {revision} | ∅ → Frozen revision {revision} |
| notebook.export.deviation | ∅ → 계획 이탈 | ∅ → Deviation |
| notebook.export.plan_recorded | ∅ → 기록: {when} · 작성자: 사용자 · digest {digest} | ∅ → Recorded {when} by user · digest {digest} |
| notebook.export.intent | ∅ → 분석 의도 | ∅ → Intent |
| notebook.export.declared | ∅ → 작성자 보고 | ∅ → declared |
| notebook.export.exposure | ∅ → 사전 자료 열람 | ∅ → prior exposure |
| notebook.export.revision_reason | ∅ → 수정 이유 | ∅ → Revision reason |
| notebook.export.initial | ∅ → 최초 계획 | ∅ → Initial plan |
| notebook.export.datasets | ∅ → 해당 버전에서 측정한 자료 식별 정보 | ∅ → Dataset identities measured for this revision |
| notebook.export.unverified | ∅ → 확인되지 않음 | ∅ → unverified |
| notebook.export.no_hash | ∅ → 해시 없음 | ∅ → no hash |
| notebook.export.measured | ∅ → 측정: {when} | ∅ → measured {when} |
| notebook.export.plan | ∅ → 계획 | ∅ → Plan |
| notebook.export.field | ∅ → 항목 | ∅ → field |
| notebook.export.timing | ∅ → 기록 시점 | ∅ → timing |
| notebook.export.self_reported | ∅ → 자체 보고 | ∅ → self-reported |
| notebook.export.planned | ∅ → 계획한 내용 | ∅ → Planned |
| notebook.export.actual | ∅ → 실제 수행 | ∅ → Actual |
| notebook.export.reason | ∅ → 이유 | ∅ → Reason |
| notebook.export.corrects | ∅ → 계획 이탈 {id}을 정정합니다. 원본은 유지합니다. | ∅ → Corrects deviation {id}; original retained. |
| notebook.export.plan_field.hypothesis | ∅ → 가설 / 연구 질문 | ∅ → Hypothesis / research question |
| notebook.export.plan_field.primaryOutcome | ∅ → 주요 결과와 측정 | ∅ → Primary outcome and measurement |
| notebook.export.plan_field.exclusions | ∅ → 포함·제외 규칙 | ∅ → Inclusion and exclusion rules |
| notebook.export.plan_field.model | ∅ → 통계 모델 / 분석 절차 | ∅ → Statistical model / analysis procedure |
| notebook.export.plan_field.multiplicity | ∅ → 다중 검정 방법 | ∅ → Multiple-testing approach |
| notebook.export.plan_field.qc | ∅ → QC와 성공 기준 | ∅ → QC and success criteria |
| notebook.export.plan_field.stopping | ∅ → 종료 / 표본 수 규칙 | ∅ → Stopping / sample-size rule |
| notebook.export.plan_field.exposureNotes | ∅ → 사전 자료 열람 내역 | ∅ → Prior data access and exposure details |
| notebook.export.value.first | ∅ → 우선 | ∅ → first |
| notebook.export.value.next | ∅ → 다음 | ∅ → next |
| notebook.export.value.later | ∅ → 이후 | ∅ → later |
| notebook.export.value.existing-data | ∅ → 기존 자료 | ∅ → existing-data |
| notebook.export.value.new-data | ∅ → 새 자료 | ∅ → new-data |
| notebook.export.value.literature-check | ∅ → 문헌 확인 | ∅ → literature-check |
| notebook.export.value.low | ∅ → 낮음 | ∅ → low |
| notebook.export.value.medium | ∅ → 보통 | ∅ → medium |
| notebook.export.value.high | ∅ → 높음 | ∅ → high |
| notebook.export.value.unknown | ∅ → 알 수 없음 | ∅ → unknown |
| notebook.export.value.exploratory | ∅ → 탐색적 | ∅ → exploratory |
| notebook.export.value.confirmatory | ∅ → 확증적 | ∅ → confirmatory |
| notebook.export.value.none | ∅ → 없음 | ∅ → none |
| notebook.export.value.metadata-only | ∅ → 메타데이터만 열람 | ∅ → metadata-only |
| notebook.export.value.outcomes-inspected | ∅ → 결과 열람 | ∅ → outcomes-inspected |
| notebook.export.value.before-results | ∅ → 결과 확인 전 | ∅ → before-results |
| notebook.export.value.after-results | ∅ → 결과 확인 후 | ∅ → after-results |
| notebook.export.plan_field.datasets | ∅ → 자료 | ∅ → Datasets |
| notebook.export.plan_field.intent | ∅ → 분석 의도 | ∅ → Intent |
| notebook.export.plan_field.priorExposure | ∅ → 사전 자료 열람 | ∅ → Prior exposure |
| notebook.export.proposal_judgments | ∅ → 우선순위·정보 가치·시간·비용은 작성자의 정성적 판단이며 확률, 보정한 확신, Bayesian information gain 또는 견적이 아닙니다. | ∅ → Priorities, information value, time and cost are qualitative author judgments—not computed probabilities, calibrated confidence, Bayesian information gain or provider quotes. |
| notebook.export.proposal_review | ∅ → 계획 전에 출처·대조군·실현 가능성·윤리를 검토하세요. | ∅ → Review sources, controls, feasibility and ethics before making a current analysis plan. |
| notebook.export.relation.challenges | ∅ → 반박 / 이의 제기 | ∅ → refutes / challenges |
| notebook.export.relation.context | ∅ → 관련 맥락 | ∅ → relates to |
| notebook.export.value.missing | ∅ → 파일 없음 | ∅ → missing |
| notebook.export.value.unsafe-path | ∅ → 허용되지 않은 경로 | ∅ → unsafe-path |
| notebook.export.value.unreadable | ∅ → 읽을 수 없음 | ∅ → unreadable |
| notebook.export.value.budget | ∅ → 확인 범위 초과 | ∅ → budget |
| notebook.export.value.changed-during-check | ∅ → 확인 중 변경됨 | ∅ → changed-during-check |
| research.next_experiments.default_constraints | ∅ → 새 자료를 수집하기 전에 기존 자료로 판단에 도움이 되는 저비용 확인을 우선합니다. | ∅ → Prefer informative, low-cost checks using existing data before new collection. |

### Checks

- PASS: cd web && npx tsc --noEmit.
- PASS: cd web && npx vitest run src/components/lab-notebook-entry-card.test.tsx src/components/notebook-result-links.test.tsx src/components/next-experiments-dialog.test.tsx src/components/lab-notebook-view.test.tsx src/lib/notebook-print.test.ts src/lib/notebook-plans.test.ts src/lib/next-experiments.test.ts — 7 files, 98 tests.
- PASS: cd server && npm run typecheck.
- PASS: cd server && npx vitest run test/notebook-export.test.ts test/notebook-zip.test.ts test/notebook-routes.test.ts test/methods-draft.test.ts test/session-export.test.ts — 5 files, 64 tests.
- PASS: final print-label preservation follow-up: cd web && npx vitest run src/lib/notebook-print.test.ts src/lib/notebook-plans.test.ts src/lib/next-experiments.test.ts — 3 files, 31 tests.
- PASS: node geo/copy/validate-copy.mjs web/src/geo/locales — 22 catalogues, 0 errors, 62 warnings. New English warnings recognize words such as independently verified/automatically in limitations; the scientific caveats are intentional, not quality/speed claims.
- PASS: node geo/ui/check-ui.mjs — 11,448 strings, 0 errors, 102 existing accepted debt, no added debt.
- PASS: git diff --check.
- PASS: direct tsx runtime import/render of notebookToMarkdown([], {lang: "ko"}) — Korean work-record heading; validates cross-root JSON/ICU imports outside Vitest.

Logs: ~/data/geoaidesk/work/gaid-notebook-review--record-cleanup/checks/{web,server,copy}.log. Full scripts/check and integrated screenshots remain with the parent by the child contract.
