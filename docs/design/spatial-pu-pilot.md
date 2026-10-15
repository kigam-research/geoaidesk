# Spatial PU source-first authoring pilot

Status: source-first design in progress. Image-first delivery remains selected; no composition is approved and no product code is implemented.

## User-confirmed scenario

Assume no Spatial-PU skill exists. The researcher provides a PDF or paper URL and optional code, data and previous results, then collaborates with the agent to create a reusable skill and workflow recipe. The existing `kigam/spatial-pu-workflow` is a withheld comparison reference after generation, not generator input or prior researcher knowledge. Primary entry is institutional web, with optional local execution.

Pilot paper: DOI `10.1007/s11053-026-10778-w`. Discovered author R3 material is not a verified publisher PDF. Local source files are not silently preloaded user uploads. A live pilot must record the actual supplied source set before extracting content.

NotebookLM informs source handling and source-grounded artifact creation; it is not an execution dependency or a claim of equivalent functionality. Public-source research is running under job `job-geoaidesk-gaid-improve-2`.

## Existing mechanisms that constrain the design

| Object | Current behavior | Design consequence |
|---|---|---|
| BYOK workflow | Bundled prompt, placeholders and file references sent to the active chat | A generated workflow may be prompt-led; do not depict a machine-enforced DAG without implementing one. There is no dynamic stock-workflow CRUD endpoint. |
| Pi skill | `SKILL.md` with trigger description and optional scripts, references, assets | Produce real files with usable relative paths and invocation, not just a card or summary. Scripts run only when invoked. |
| Prompt template | Project/user Markdown expanded into a request | A compatible reusable launch request can accompany the new skill. |
| `geo-start/v1` | Preset referencing known pinned workflow/skill IDs | Cannot introduce a new method. Add local-method registration without changing the meaning of old presets. |
| Hub contribution | Generated `SKILL.md`, `atlas.yaml`, `LICENSE` and full file set; dormant service owns PR/checks | The system can serialize files without asking researchers for YAML/Git. Skill submission does not currently update the workflow registry. |

Current GAID supports upload, PDF viewing/annotations, structured interview, local skill preview/install/invocation, notebook and typed results. It lacks durable source extraction and source-to-method authoring objects. skill_hub runtime rejects PDFs. Locally available K-Dense `markitdown` and `scientific-writing` offer extraction/evidence patterns but are not selected in GAID's 13-skill catalogue. MarkItDown's conversion receipt does not provide reliable page-coordinate/figure anchors.

## End-to-end researcher journey

1. **Add sources.** Upload PDF or paste URL/DOI. Add code/data/prior results when available; enter an optional short reuse goal. Do not require skill names, stages, YAML, model choices or a full questionnaire.
2. **Open and analyze sources.** Retain the original when available. Show the real PDF viewer first, alongside received files and actual access/extraction status. For a web page or metadata-only result, show that source kind, not a simulated PDF. Start grounded analysis after source acquisition; automatic analysis may begin on successful acquisition, while missing access stays explicit.
3. **Understand the proposed method.** Show research question, input/assumptions, methods, relevant figures and limitations derived from the supplied set. A selected finding opens its actual PDF page/section or code location. Display figures only after real extraction/selection; use original page crops or extracted images, never generated scientific imagery.
4. **Resolve necessary gaps.** Ask contextual questions only when they affect method scope, validity, implementation or reuse. Reuse source-known facts. Separate paper reproduction from new-data generalization. Unanswered consequential choices remain unresolved; timeout is not an answer.
5. **Create reusable artifacts.** Produce an agent skill and its workflow launch request from a shared method draft. The user reviews ordinary method language, required inputs, expected outputs and remaining work. Code/metadata files remain available in a secondary technical view. If code is missing, expose descriptive-only versus implemented/untested status and offer code development as a visible next step.
6. **Try in GAID and revise.** Save privately and install/resolve the draft package using existing install semantics. Trial uses a fixed package/input revision, actual code and recorded checks. Publish is not a prerequisite for private trial. A failed run returns to the linked method draft without discarding source findings or answers.
7. **Use and share.** A new local method card starts setup with the generated skill. Research notes emphasize conclusions, figures, limitations and next steps; provenance stays in details. Optional hub submission exports the portable method, not private PDF/data by default. Hub publication/registry updates are a distinct lifecycle.

## Visible states and evidence

| State | What may appear | What must not be implied |
|---|---|---|
| Source received | Supplied filename/URL and upload/access status | Paper understood or figures selected |
| Original available | Real retained PDF, page navigation or fetched web text | Publisher PDF if only author manuscript; full text if only abstract |
| Extracting / partial | Actual task name, available page coverage, gaps | Invented percent complete or complete OCR of unreadable pages |
| Analysis ready | Source-linked findings and extracted figure/caption references | New scientific computation or unobserved results |
| Clarification | Contextual missing decision, source-known values alongside | Every paper parameter being a universal default |
| Draft created | Actual package/launch artifacts and unresolved limitations | Installed, executed, validated or published merely because generated |
| Trial | Observed run state, outputs and comparison against declared criteria | Scientific review implied by exit 0 |
| Private saved / shared | Exact selected version and scope | Raw sources automatically public |

## Proposed minimal application records

These names describe interfaces for discussion, not shipped schemas.

- `SourceDocument`: source type, acquisition status, retained project path or URL snapshot, document kind and revision.
- `ExtractionRecord`: source revision, parser/version, actual covered pages, text/figure outputs, partial/error reasons.
- `GroundedFinding`: source page/section/code anchors, finding kind, source statement versus agent interpretation, unresolved gaps. Figure references retain captions and actual page/region anchors.
- `MethodDraft`: selected source findings, researcher answers, scope, input/choice/output contract, instruction/code draft and revisions.
- `MethodPackage`: Pi-compatible skill tree, environment requirements, launch request, evidence references and explicit implementation/testing state. Hub adapter adds Atlas metadata and publication fields.
- `LocalMethod`: app-owned identity for a new private method card; resolves local package version and launch contract without requiring a pinned catalogue workflow ID.
- `ValidationAttempt`: package/input revision, actual environment, invoked code, outputs/checks and limitations. Reuse existing runs/provenance/results rather than inventing success from model prose.

Source/private-workspace storage and method-distribution storage are separate. Derived output changes must invalidate affected method findings/checks, not silently rewrite original evidence.

## Pilot evaluation without the pre-existing skill

Authoring inputs may include the supplied paper, original research repository snapshot, original data documentation and previous output files. Exclude the existing skill's `SKILL.md`, generalized helpers, Atlas workflow description, generated reference guides and evaluation findings from the generation context. Where original code is archived inside the skill tree, copy only verified original upstream files into the isolated input set; do not expose the containing skill directory.

Freeze the generated package before comparison. Evaluate evidence alignment, unresolved conditions, valid installation/invocation and useful outputs, not textual similarity to the old skill. The reference skill itself is not infallible. Compare paper-specific reproduction and new-data generalization separately. An independent transfer dataset is not selected; do not rename the 40-km aggregate showcase as independent transfer evidence.

Published-study facts: 5-km cells and 50-km evaluation blocks. The historical 40-km/1,122-cell Atlas example is separate. These facts belong to paper/source findings, not the intake screen and not new-data defaults.

## Image-first deliverable

The next image round must communicate the sequence, not only its polished endpoint. Preserve GAID white/slate, blue `#1f5eff`, Pretendard, shadcn new-york and Lucide character; reduce exposed detail and enlarge reading type. No new brand choice is required.

Required states across the visual set:

- Source intake/original PDF: upload or URL, source list, actual document viewer, no pre-existing PU method card or map hero.
- Grounded analysis and focused questions: selected PDF page beside a source-linked finding; relevant figure only as a page-linked extracted derivative after analysis.
- Generated skill/workflow and GAID handoff: readable method draft, actual output types, private trial action and untested state, optional sharing later.

Template references retained: 21st AI CRM detail sheet, shadcnblocks `application-shell17` navigation, Design Process Case Study reading sequence and shadcn Resizable/Sheet. UUPM's contextual input validation and readable hierarchy remain useful. Taste does not govern a multi-step editor. Impeccable Operate/Read principles govern these surfaces. Public NotebookLM source research will refine the flow before the next renders.

## History, output handling and next integration

Initial A/B/C comps were rejected in premise by the user: they showed a preselected representative map and ready-made method. Their reusable shell/typography is not approval of their flow. All five image calls completed; originals/prompts remain external under `~/data/geoaidesk/work/gaid-improve/design/spatial-pu/`. Do not publish them as current options or repeat generation. New review-sized images, when ready, belong in the canonical report and result registry; full prompts/sidecars stay external. `.impeccable/config.json` records the user's `buildPath: comp`.

The installed impeccable CLI has a phase-command mismatch with its skill reference (`start --comp` versus `start --direction --kind`). No build-phase state was fabricated. Read the actual installed contract before product implementation. Project output policy overrides the skill's suggested in-repo original-image folder.

Sequential decisions: source lifecycle → real output/runtime contracts → visible flow → image comparison → user composition choice → shared implementation interfaces. Parent owns this brief, task/product/report and image integration. Three native readers completed independent source/recipe/hub audits; no child writers or scientific analysis jobs were started. Once code is authorized and interfaces are fixed, split independent source-processing, local-method runtime and presentation packages into isolated CLI child writers; route hub code to its project hub.
