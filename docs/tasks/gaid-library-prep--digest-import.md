---
format: 1
status: active
updated: 2026-10-24T13:13:21Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"1ef64c16-7ce7-4dc0-b515-7ddd6f5be993","pid":612268,"provider":"codex","session":"01a16dfe-ec96-7931-8a4e-8c46fe624b05","start":"73472374","token":"8c86f6aacd6d99a9587f369d850ab7400e204640366550f87dd91b9c95692e53"}
branch: task/gaid-library-prep--digest-import
target: task/gaid-library-prep
parent: gaid-library-prep
---
# gaid-library-prep--digest-import

## Goal and done criteria
Request from the starter:

# Goal: gaid-library-prep--digest-import — import a Gemini Notebook output into 서재 as an 외부 정리 (literature digest)

Parent unit gaid-library-prep (geoaidesk). User request (verbatim, 2026-10-24, part owned by the parent): "내서재에서 해당 기능들을 사용하여 미리 자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한 자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다."
User decision 2026-10-24 on the design report (verbatim): "모두 권장으로 하자." — the item is named "문헌 정리"; Gemini imports are marked "외부 정리", enter as 검토 전, are never a citation source, and GAID sends nothing to Google.

Read first in your worktree: AGENTS.md; reports/2026-10-24-gaid-library-prep/index.md (sections 3.2, 3.3 and figure 4 = figures/03-import-gemini.png, the approved mockup of your sheet); docs/tasks/gaid-library-prep.md "Phase 2 plan"; the settled interfaces: web/src/geo/contracts/library.ts (DigestImportPreviewBody, DigestImportPreview, DigestImportMatch, DigestImportBody, DIGEST_IMPORT_BYTES, DIGEST_IMPORT_TYPES, LibraryDigestExternal), server/src/geo/library/digests.ts (addExternalDigest, digestOutline), LibraryStore.storeFile, web client previewDigestImport/importDigest in web/src/geo/library/api.ts. Mockup source: web/src/geo/dev/library-prep/screens.tsx (DigestImport) and its strings in web/src/geo/locales/devLibraryPrep/.

Build:
1. Server `server/src/geo/library/digest-import.ts` and two routes registered in `server/src/geo/routes/library.ts` next to the other digest routes (minimal hunk):
   - `POST /geo/library/digests/import/preview` (body DigestImportPreviewBody; bodyLimit fitting DIGEST_IMPORT_BYTES base64): accept only DIGEST_IMPORT_TYPES by extension and content (DOCX = zip with word/document.xml, refuse macro-enabled/encrypted; PDF = %PDF-; text types UTF-8). Convert to Markdown text: .md/.markdown/.txt as is; .csv as a bounded Markdown table (say how many rows were kept); .pdf via pdftotext (whole document, bounded pages; scanned PDF with no text → clear 422 message); .docx by reading word/document.xml with the existing adm-zip dependency (paragraph text, Heading 1/2/3 styles → #/##/###, list paragraphs → "- ", tables → Markdown rows; bound expanded size and entries). Match sources: DOIs in the text vs library papers (normalizeDoi; only papers: isPaperItem, not removed) → by "doi"; library paper titles (normalised, length ≥ 20) found in the normalised text → by "title"; DOIs not in the library → `unmatched` (with the line as title). Return DigestImportPreview with a token (in-memory, TTL 30 min, at most 20 pending, bytes kept only in memory), title = first heading or file name, headings, excerpt (≤ 600 chars).
   - `POST /geo/library/digests/import` (DigestImportBody): look up the token, store the original with `store.storeFile(bytes, DIGEST_IMPORT_BYTES)`, normalise notebookUrl with `normalizeNotebookUrl` (web/src/geo/contracts/notebook-link.ts; invalid → 400), call `addExternalDigest` with external { service: "gemini-notebook", fileName, mediaType, file, notebookUrl }, covers = the kept matches, unmatched from the preview. Reply 201 { item }.
   - Errors in research language with the existing LibraryError pattern; never echo file contents in errors.
2. Web `web/src/geo/library/digest-import-sheet.tsx`: `export function DigestImportSheet({ open, onOpenChange, collectionId, collectionName, notebookUrl, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; collectionId?: string; collectionName?: string; notebookUrl?: string; onImported: (item: LibraryItem) => void })` — a 720 px sheet (UI guide D2) like the mockup: file field (pick or drop; types and 30 MB limit in the hint), the limit line right under the file ("외부 정리는 검토 전으로 들어오고 인용 근거로 쓰지 않습니다 …"), name (prefilled from the preview), notebook address (prefilled from `notebookUrl`, optional), matched papers as checkbox rows (all checked; by DOI/by title) and unmatched sources (not linked), footer: folder line + 취소 + filled `서재에 넣기`. States: reading the file (button progress, B6), read failure (F5 message + 기술 정보 disclosure only if needed), empty match list (one line). Use shared parts (Dialog/Sheet from components/ui, Button, Input, tokens; see how web/src/geo/library/add-paper-dialog.tsx and the start window build sheets). The parent mounts it from the 서재 folder header; do not edit library-screen.tsx.
3. Strings only in locale namespace `digestImport` (web/src/geo/locales/digestImport/{ko,en}.json, already registered and empty): Korean first, English with the same meaning, copy rules in AGENTS.md "UI copy and locales" and geo/copy/gaid-writing.md.
4. Tests: server `server/test/geo-library-digest-import.test.ts` (md, csv, docx built in the test with adm-zip, pdf if pdftotext is available else skipped with a reason; DOI and title matching; token expiry/unknown token; refused types; notebook URL validation; the created item is kind digest/origin external/status pending and never exported); web component test for the sheet (preview → confirm calls importDigest with the kept covers).

Owned files: the four above plus their tests and the digestImport namespace. Minimal hunk allowed in server/src/geo/routes/library.ts (route registration only). If you need a contract change, keep it additive in web/src/geo/contracts/library.ts and say so in your task document; do not change existing digest types.
Rules: follow AGENTS.md (UI guide v2 sections 1, 2, 10 and D2/B1/B6/F5/R1/R2 before UI work; copy rules). Network: the KIGAM network blocks raw.githubusercontent.com; use NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt for npm. Server tests: unset VITEST_MAX_WORKERS or use 1. Python only via uv. Do not touch the review app (ports 3000/18000) or any hub server.
Evidence: cd server && npm run typecheck && npx vitest run test/geo-library-digest*.test.ts test/geo-library.test.ts; cd web && npx tsc --noEmit && npx vitest run <your test>; node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs. One Korean screenshot of the sheet with a real converted file at 1440×900 (instrument/light; mapsheet/dark too) into ~/data/geoaidesk/work/gaid-library-prep--digest-import/ (a dev harness or the running app; do not commit harness pages). Record what you changed, the rule ids followed, string ids (ko/en) and check results in your task document, then task finish. The parent runs full scripts/check after integration.

## Current state
Resumed in the printed worktree. Settled contracts and approved mockup verified. Codegraph is unavailable for this unindexed worktree; native source reads used. Implementation and declared targeted checks pass: server typecheck; web tsc; server digest/library tests 16/16; import sheet tests 3/3; copy validator 0 errors (101 existing warnings); UI static check 0 errors. Real-file visual QA remains. Dependencies installed by recorded job (exit 0), reused locally with unchanged lockfiles.
## Next steps
1. Implement bounded file conversion + preview token service and minimal import routes.
2. Implement the sheet and ko/en strings, then meaningful server/component tests.
3. Run declared checks and capture real-conversion screenshots; finish for parent integration.
## Failed approaches
## Notes and decisions
- Phase plan: tightly coupled implementation owned here; no additional worker. Service and routes first, then UI using the settled contract, then checks/screenshots. Parent owns library-screen mounting and full scripts/check. No existing contract change planned.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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
- /home/seongin3/data/geoaidesk/runs/gaid-library-prep--digest-import-20261024T130820.073353Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-library-prep--digest-import-20261024T131157.689490Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->
