---
format: 1
status: active
updated: 2026-10-21T13:18:16Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"aa34d06c-a9c2-4a59-baa0-d91256af0ef9","pid":2570334,"provider":"claude","session":"43dfe263-7ab9-4d66-80b7-22ec0fd4febe","start":"47548693","token":"39b963f62ebfc6e5708f59cfe1e2e4742108fb924ff80b895da73bd72a987fa2"}
branch: task/gaid-library-folders
target: main
parent: 
---
# gaid-library-folders

## Goal and done criteria
Request from the starter:

# Request: gaid-library-folders

User feedback on gaid-research-hub (verbatim, 2026-10-21, to the geoaidesk hub):
"gaid-research-hub와 관련한 피드백이다. 우선 논문 서재에서는 보통 논문 주제 단위로 관리할 수 있는 폴더가 있어야 한다. 전체 자료 검색도 가능해야겠지만 폴더별로 정리되어야 추후 논문을 투고할 때 인용되는 논문들만 관리하는 폴더만 보편적으로 참고하고 인용문헌 관리할 때에도 해당 폴더만 볼 수 있어야 한다. 그리고 GAID 허브에 직접 추가하거나 수집한 문헌들도 Zotero로 보낼 수 있게 해야 상호 연동 된다고 볼 수 있다."
Answers recorded with this unit as follow-up (verbatim):
- gaid-research-hub#1: "동료 연구자의 경우 zotero, endnote를 도구로 사용하고 대부분은 pdf로 직접 윈도우 파일 탐색기에서 관리한다."
- gaid-research-hub#4: "이용하는 연구자 PC는 보편적으로 Windows에서 실행된다."
Other answers (closed, context only): 1단계 시험 = the user alone, PC70 and PC74 can act as two researchers; annual reports
follow the HWPX research-report skill as in seoul_geomodel and ccs_transport; RISS·DBpia usable on the institute network;
note↔paper relations = 3 kinds (지지함·반박함·조건을 붙임), built later.

Base: the library from gaid-research-hub (report reports/2026-10-21-gaid-research-hub/index.md, ADR
docs/adr/2026-10-21-research-hub-library.md; code server/src/geo/library/**, web/src/geo/library/**,
web/src/geo/contracts/library.ts).

Done criteria:
1. Topic folders in the library (nested or flat: decide and record), an item can be in several folders; search across all
   items and within a folder. For Zotero-linked items, folders map to Zotero collections (sync both ways as far as the ADR's
   narrow write-back allows; record the rule).
2. Citation management per folder: a manuscript's folder is the scope for citing in notes, bibliography export
   (BibTeX/RIS/CSL-JSON/formatted list) and any reference check.
3. Send items the researcher added or collected in GAID to Zotero (single and per folder), creating the Zotero collection,
   attaching the PDF where possible, without duplicates; Zotero runs on the researcher's Windows PC (Local API; the GAID
   server reaches it only when GAID also runs on Windows or can reach it; state what works where).
4. Real-app check with Korean screenshots 1440x900 and 1280x800 (UI guide + copy rules); Zotero tests with a separate
   profile (PC74 has Zotero desktop installed, not running; never open it on the user's screen).
Optional (propose to the user, do not build unless chosen): import a Windows Explorer PDF folder as a library folder; EndNote
import path (RIS/EndNote XML).
Coordination: gaid-design-identity (started now) will define new UI tokens later; build on current tokens and keep styling
in shared tokens so the restyle is cheap. Own GAID_HOME under ~/data/geoaidesk/work/gaid-library-folders/; do not modify
~/.geoaidesk. Outside check: no outside check (app work).

## Current state
- 2026-10-21: plan and interfaces settled (Notes). Child `gaid-library-folders--zotero-writes` (writer 8efa9960, Paseo wks_03dd19e0495248f5) owns the connector write
  additions; this unit owns contract, store, sync glue, routes, agent/note scope and UI.
## Next steps
1. Implement folders in contract/store/sync glue/routes; then UI; integrate the child; real-app + Zotero sandbox check.
## Failed approaches
## Notes and decisions
- Folder model (decision, recorded in a new ADR amending 2026-10-21 decision 3): nested folders (Zotero collections are
  nested; 1:1 mapping needs it). A folder is a `LibraryCollection`; an item can be in many. A folder view, search scope,
  citation scope and export include subfolders. A folder may be linked to one Zotero collection (`zotero` field):
  mirrored Zotero collections are linked by definition; a GAID folder becomes linked (same GAID id) when sent to Zotero.
  Linked folders take name/parent from Zotero.
- Membership rule per (item, folder): folder linked to collection C in library L and item is a Zotero item of L ->
  Zotero is the source (sync overwrites); adding in GAID writes "add to collection C" to Zotero after confirmation;
  removing in GAID is refused (remove in Zotero). Any other pair (unlinked folder, GAID item, item of another library)
  is GAID-local membership, kept across syncs. Write-back stays narrow: create a collection (only when sending a
  folder), add item to collection, create item + PDF attachment (+ full text) when sending. Never rename/delete/remove
  membership/edit metadata in Zotero.
- Send to Zotero: sync first; dedupe against the mirror of the same Zotero library (normalized DOI, else normalized
  title + year + first author); a match merges the GAID item into the mirrored one (aliases keep old id/key resolving),
  no Zotero write but membership; otherwise create item in all linked collections it belongs to, then attach the stored
  PDF. Sending a folder creates/links the folder and its subfolders (reuse an existing same-name collection under the
  same parent) and sends its items. Re-running after a crash finds the created item via the sync (idempotent).
- Citation scope: the project's attached folders (+ single attached items) are its citation scope: agent library tools
  (already), the note citation hook and the note reference list flag keys outside the scope. Per folder: export
  BibTeX/RIS/CSL-JSON/formatted list (APA-like, not full CSL) and a reference check.
- Work packages: (A) child `gaid-library-folders--zotero-writes`: `server/src/geo/library/zotero/**`, its tests and
  fixture (fake server), sandbox smoke. Interface below. (B) this unit: everything else. Integration: merge child, then
  wire `zotero-service.ts` send paths to its functions.
- Child interface (zotero/writes.ts): `ensureCollection(client, library, {name, parentKey?})`, `createItem(client,
  library, {csl, collectionKeys, tags?})`, `addItemToCollections(client, ref, collectionKeys)`, `uploadAttachment(client,
  library, parentKey, {bytes, filename, contentType, title?, fullText?})`; `addItemToInbox` keeps working.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
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
