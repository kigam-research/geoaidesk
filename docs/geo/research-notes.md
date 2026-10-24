# Research notes

GAID's research notebook is organised around **research notes** (정리 노트): one Markdown note per analysis (one
research question), written result first, stored where the researcher can see and open it. The notebook entries the
agent logs while it works (`notebook` tool, `.kady/notebook/`) stay as the **work record** (작업 기록) behind the notes.
User decision 2026-10-18 (reports/2026-10-18-gaid-notebook-review, §6 1-가 and 2-가).

Contract: `web/src/geo/contracts/research-notes.ts`. Server: `server/src/geo/notes/`. Screens: `web/src/geo/notes/`.

## Storage

- `연구노트/<YYYY-MM-DD>-<topic>/index.md` in the project sandbox, figures in `연구노트/<id>/figures/`. The folder is
  visible in the file tree; Obsidian opens it as is; a ZIP of the folder is a complete copy.
- The file is the master. The researcher may edit it in GAID or elsewhere; the server only parses it and rewrites
  nothing except the `status` line when the researcher marks a note confirmed or back to pending.
- `.kady/geo/notes.json` maps a note id to the chats (session ids) whose lead agent wrote or edited it. It is filled by
  the write/edit hook and is the only server-owned state; losing it loses only the chat links.

## Format

```markdown
---
title: 다원소 분석값 점검과 조성 탐색
date: 2026-10-15
status: pending
headline: 지정 입력 2개는 시료 자료가 아니어서 참조 자료로 형식을 시연했습니다.
cover: figures/01-anomaly-map.png
supersedes:
---
# 다원소 분석값 점검과 조성 탐색

## 한눈에

| | |
|---|---|
| 요청 | 지정한 두 파일의 단위·검출한계·한정자를 점검하고 조성을 탐색 |
| 결론 | … |
| 믿을 수 있는 정도 | … |
| 결정할 일 | 1건 |

## 결과

![참조 자료의 Ni 이상치 후보 위치](figures/01-anomaly-map.png)

그림 1. … 볼 것: …

## 한 일

1. …

## 한계

- …

## 결정할 일

1. 의뢰 지역 시료 자료로 다시 분석할지
   - 가) 시료 표를 올려 다시 실행 (권장: 지금 결과는 참조 자료 시연)
   - 나) 시연으로 마무리

## 근거

- 결과 표: [anomaly_candidates_Ni.csv](../../derived/assay_explorer_demo/anomaly_candidates_Ni.csv)
- 스크립트: [run_kola.py](../../scripts/run_kola.py)
```

Rules:

- Frontmatter fields: `title` (required), `date` (YYYY-MM-DD), `status` (`pending` | `confirmed` | `superseded`; the
  agent writes `pending`, only the researcher sets `confirmed`), `headline` (one sentence), `cover` (path relative to the
  note), `supersedes` (note ids, comma-separated).
- Sections in this order, headings in the reply language: 한눈에 / At a glance, 결과 / Results, 한 일 / What was done,
  한계 / Limits, 결정할 일 / Decisions, 근거 / Evidence. Write "없음" / "None" under an empty section.
- Decisions: numbered questions; options as `- 가) …`, `- 나) …` (or `a)`, `b)`); one option may carry
  `(권장: <reason>)` / `(recommended: <reason>)`. A decision the researcher answered moves out of the section (into 한 일)
  with the answer.
- Research language in the body: no command lines, tool names, session ids or internal paths; links to files go in 근거.
  Image paths are relative to the note's folder (`MARKDOWN_IMAGE_RULE`); copy the figures a note shows into its
  `figures/`.

## When the agent writes a note

- When an analysis the researcher asked for has produced results (files, figures or a stated finding), the lead agent
  writes a note in the same turn before its final reply, or updates the note of the same question when the chat
  continues it. A new question gets a new note; a note that replaces an older conclusion names it in `supersedes`.
- The researcher can ask at any time with **노트 정리** (prefills the chat with a request; normal chat billing).
- Decisions are answered in the note view (gaid-note-decisions, user request 2026-10-20): for each decision the researcher
  picks an option or **별도 지시 (직접 입력)** and writes an instruction; choosing sends nothing. **답변 보내기** sends all
  answers as one message to the chat that wrote the note (else the active chat), queued after a running turn; unanswered
  decisions are named as left open. When that chat cannot be opened (for example the tab limit) the answers stay selected;
  when it cannot send (budget, disconnected model) the message lands in its chat box.
- No note for chit-chat, setup, failed starts with no result, or questions answered without analysis.
- Notebook entries keep being logged as before; the note does not replace them.

The lead's instruction is one line in `GEO_INSTRUCTIONS` (`server/src/geo/instructions.ts`, `RESEARCH_NOTE_RULE`);
after a write/edit of `연구노트/*/index.md` the tool result lists format problems (missing frontmatter or sections,
malformed decisions, missing images) so the agent fixes them in the same turn.

## Prose style

Before writing or updating a note the lead reads the `gaid-note-style` skill (gaid-output-style) and polishes the
note's prose with it: Korean notes in 합니다체 throughout (also stated in `RESEARCH_NOTE_RULE`, gaid-note-style; the skill
alone was not followed), result first, no staging, inflation or empty hedges, Korean sentence rules (verbs instead of
nominalised phrases, no translationese), with facts, numbers, links and stated confidence unchanged. The skill ships in
`geo/skills/gaid-note-style/` (condensed from blader/humanizer, MIT, and KIGAM's Korean rules; `THIRD_PARTY_NOTICES.md`)
and `server/src/geo/note-style.ts` copies it into each geo project's `.pi/skills/` when a chat starts or the project is
provisioned. The copy is the project's: it follows a new shipped version only while unedited, and a deleted or
disabled copy stays that way. `applyExposure` keeps it offered under every task selection. Chat answers follow
`REPLY_STYLE_RULE` (a compact Attention Control rule) in the same system-prompt block.

## In the library (서재)

A note can be brought into the researcher's library as a **정리 노트** item, a category separate from papers (user decision
2026-10-23, gaid-note-library). From the note view: 더 보기 → 서재에 넣기; from 서재: 정리 노트 → 정리 노트 가져오기 (notes of
every project on this PC). The note file stays the master: the library item keeps the title, date, status, headline, the
library papers the note cites and a text snapshot (first 64 KiB, no figures), and GAID re-reads the file when the library is
opened and before institute hub sync. Only the GAID instance whose project holds the note refreshes it; on another PC (hub
sync) the item shows its last snapshot and cannot be opened in a project. A deleted file keeps the item with "노트 파일 없음".
Removing the item from the library never touches the file. Note items are never written to Zotero, never exported as
references and never count as citation scope. 프로젝트에서 열기 opens the project's notebook tab on the note.

## Exports (결과 묶음, 공개 자료)

Two downloads start from a note's 더 보기 menu (gaid-note-bundle-export, user decision 2026-10-24; contract
`web/src/geo/contracts/note-export.ts`, server `server/src/geo/notes/export.ts`, sheets `web/src/geo/notes/note-export.tsx`).
Both are previewed first; the download sends the preview's `digest` back and the server answers 409 when the note, its
files or the candidate list changed in between. The browser saves a file only when its bytes match the server's
`X-Content-SHA256`.

- **결과 묶음** (`GET/POST /geo/notes/:id/bundle`): for another researcher or a reviewer. ZIP with `note/` (every visible
  regular file of the note folder; links and dot files skipped; at most 200 files / 64 MiB), `data-fingerprints.json`
  (files the note's chats read or wrote, from provenance: sha256 and size when used, and whether the file is the same,
  changed, missing or not compared now; the note folder and dot directories are left out; at most 2,000 rows),
  `environment/<id>.json` (stored environment records of those chats, at most 16), `workflow/workflow.json` and
  `workflow/instructions.md` (the method trial of the newest Workflow chat: version from the package origin at start, 지침
  rendered while the method is installed), `references.md` + `references.json` (cited keys resolved in 서재, CSL JSON keyed
  by citation key), a README in the UI language, `manifest.json` and `SHA256SUMS`. Data files themselves are never
  included, and the bundle does not claim reproduction. What could not be included is named as a gap
  (`NoteBundleGap`) in the preview and the README.
- **공개 자료 내보내기** (`GET/POST /geo/notes/:id/public-export`): files for the researcher to upload to Gemini Notebook
  by hand. Candidates are the note as Markdown (reference list appended), the Workflow 지침 as Markdown, and the stored
  PDFs of cited papers (with the licence from the paper's metadata when recorded, else 이용 조건 확인 안 됨; up to 50 MB
  each). Nothing is pre-ticked; each chosen file needs its own "기관 밖으로 내보내도 되는 자료입니다" confirmation, and the
  server refuses a file without `mayLeave: true`. Each export appends a local record to `.kady/geo/public-exports.jsonl`
  (time, note, file names, sha256). GAID calls no Google service and uploads nothing.

A project can also keep the address of a related Gemini Notebook (under the 정리 노트 list summary: 노트북 열기, 링크 바꾸기),
and so can each 서재 folder. GAID stores only the https address and opens it in a new tab; it never reads the page.
