# ADR 2026-10-21: Nested library folders linked to Zotero collections; folders are citation scopes

Status: accepted 2026-10-21 (gaid-library-folders, from the user's feedback on gaid-research-hub). Amends decision 3 of
`docs/adr/2026-10-21-research-hub-library.md` (the narrow Zotero write-back) and extends decision 4 (project stores
references).

## Context

User (2026-10-21): "논문 서재에서는 보통 논문 주제 단위로 관리할 수 있는 폴더가 있어야 한다. 전체 자료 검색도 가능해야겠지만
폴더별로 정리되어야 추후 논문을 투고할 때 인용되는 논문들만 관리하는 폴더만 보편적으로 참고하고 인용문헌 관리할 때에도 해당
폴더만 볼 수 있어야 한다. 그리고 GAID 허브에 직접 추가하거나 수집한 문헌들도 Zotero로 보낼 수 있게 해야 상호 연동 된다고 볼 수
있다." Colleagues use Zotero and EndNote, most manage PDFs in Windows Explorer folders, and researcher PCs run Windows.

The phase-1 library had flat-capable `LibraryCollection`s (GAID ones and mirrored Zotero collections, never mixed),
Zotero as the only source of a Zotero item's collection membership, and one Zotero write per item ("GAID 수집함").

## Decision

1. **Nested folders.** Folders nest (Zotero collections nest, so a 1:1 mapping needs it). A paper can be in several
   folders. A folder view, search inside a folder, bibliography export, the reference check and a project's citation
   scope include subfolders. "전체 논문" searches the whole library.
2. **A folder may be linked to one Zotero collection.** Mirrored Zotero collections are linked by definition; a GAID
   folder becomes linked, keeping its GAID id, when it is sent to Zotero. A linked folder takes its name and parent from
   Zotero; GAID renames, moves and deletes unlinked folders only. A collection deleted in Zotero disappears from GAID,
   except when GAID papers or GAID folders are in it, or it was a GAID folder: then it stays as an unlinked GAID folder.
3. **Membership rule.** For a Zotero paper and a folder linked to a collection of the same Zotero library, Zotero is the
   source: the sync sets it; adding the paper in GAID also adds it to the Zotero collection; removing it is done in
   Zotero. Every other pair (unlinked folder, GAID paper, a paper of another Zotero library) is GAID's own membership and
   survives syncs.
4. **Write-back, still narrow and only after the researcher acts.** Allowed: create a collection (only when sending a
   folder; an existing same-name collection under the same parent is reused), add a paper to a collection, create a paper
   with its PDF attachment and full text when sending, add tags, add a note link (as before). Never rename, move or
   delete collections, remove memberships, edit metadata or write annotations.
5. **Sending without duplicates.** GAID syncs first, then compares each GAID paper with the mirror of the target Zotero
   library (same DOI, else same normalized title + year + first author). A match is merged: the Zotero copy gains the
   paper's folders, tags and, when it has none, the PDF; the GAID id and citation key stay valid as aliases. Otherwise
   GAID creates the Zotero item in all linked collections of its folders (or "GAID 수집함" when none) and stores the
   new Zotero reference before uploading the PDF, so an interrupted send is not repeated as a second item. A Zotero
   citation key assigned later (Better BibTeX) keeps the earlier GAID key as an alias.
6. **Citation scope.** The folders and single papers attached to a project are its citation scope: the agent's library
   tools search only them, the research-note citation check and the note's reference list mark keys outside them, and
   the folder's reference check lists such citations. A project with nothing attached keeps the whole library.

## Where it works

- GAID and Zotero on the same Windows PC: Local API (`127.0.0.1:23119`), writes after Zotero's approval window; "항상
  허용" (Always Allow) lets one send write many objects, "허용" once stops after the first write and GAID reports it.
- GAID in WSL on a Windows PC: reaches the Windows Zotero only when WSL can open Windows `localhost` (WSL mirrored
  networking). Not verified.
- GAID on the institute server: Zotero Web API with the researcher's key (write access needed to send; PDFs use the
  researcher's Zotero storage quota). The fake Web protocol is tested; a real account is not.

## Alternatives considered

- *Flat folders*: simpler UI, but Zotero's nested collections would have to be flattened or dropped. Rejected.
- *Separate GAID folders and Zotero collections that never mix*: no rule needed, but a manuscript folder could not hold
  both kinds of papers, which is the common case. Rejected.
- *Full two-way membership sync (remove in GAID removes in Zotero)*: symmetric, but GAID would delete Zotero state the
  researcher made in Zotero, against decision 3 of the base ADR. Rejected for now.
- *Folders per manuscript only through a future "내 논문"*: the request needs folders now; a manuscript can later point
  at a folder. Deferred.

## Consequences

- Contract `web/src/geo/contracts/library.ts`: `LibraryCollection.zotero.serverId`, `LibraryItem.aliases`,
  `folderSubtree`, folder routes and results. Sync reconciliation in `server/src/geo/library/zotero-service.ts`
  (`reconcileFolders`); connector writes in `server/src/geo/library/zotero/writes.ts`.
- Not built (proposed as optional): import a Windows Explorer PDF folder as a library folder; an EndNote XML import path
  (RIS import and export exist).
