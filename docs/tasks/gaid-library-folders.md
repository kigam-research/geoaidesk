---
format: 1
status: waiting
updated: 2026-10-21T12:58:59Z
writer: {"host":"seongin3","reserved":"39b963f62ebfc6e5708f59cfe1e2e4742108fb924ff80b895da73bd72a987fa2"}
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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
