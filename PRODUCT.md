# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

KIGAM geoscience researchers are the primary audience. Newcomers and researchers without coding experience need guided use of research methods and low-input coauthoring from their papers and work. Coding researchers need inspectable, reusable methods and an execution path that preserves their scripts and preferred tools.

## Product Purpose

Build a geoscience research agent framework and shared method ecosystem with the institutional role the user associates with the KIGAM Geo Big Data Open Platform. GAID is the research workspace; skill_hub is the discovery, contribution and distribution hub for skills, workflow recipes and cases. Their combined goal is an institutional Second brain that retains research questions, methods, results, corrections, limitations and reusable knowledge.

## Positioning

The intended value is reuse of an institution's research methods across researchers and datasets, with scientific context and working examples. A generic chat interface is insufficient. Researcher-facing conclusions and decisions must be understandable without reading agent transcripts or file hashes. Native coding tools remain compatible ways to work, not competitors that require users to abandon their workflow.

## Operating Context

- User-confirmed target: institution-web access by default, optional local execution.
- User-confirmed first pilot: create a new skill/recipe from the user's paper “Uncertainty-Aware Mineral Prospectivity Mapping with Positive-Unlabeled Learning and Conformal Calibration: Ni Mineralization in the Yilgarn Craton” (DOI `10.1007/s11053-026-10778-w`) and supplied materials, as if `kigam/spatial-pu-workflow` did not exist. The existing skill is a withheld comparison reference, not input to the authoring agent or assumed researcher knowledge. Exact transfer dataset is not selected.
- Current GAID is a local/single-user web app. Its separate frontend and backend, existing review deployment, and data stores are not yet a verified institutional multi-user service.
- Researchers should be able to attach a paper, documents or prior work, inspect an extracted method, answer only consequential missing questions, and obtain a reusable skill or recipe. This authoring journey is a target, not a shipped feature.
- Start with PDF/URL/material ingestion and an original-document viewer. A grounded summary and relevant figures appear only after analysis, with source locations. NotebookLM is a source-processing/journey reference, not a target for identical outputs or a claim of API integration. Researcher-authored methods must map to actual skill and workflow mechanisms and then to GAID setup, execution and research records.
- Published methods and privately authored research records have distinct sharing scopes. Institution-level memory must preserve those scopes and source identity.

## Capabilities and Constraints

Existing foundations include scientific file inspection/viewers, typed results, notebook entries/plans/next-investigation proposals, observed provenance, project-local research memory, pinned skill catalogues, guided workflow setup, and portable helpers in some skill packages. Catalogue workflows currently open chat drafts; saved recipes are setup presets, not complete executable method packages. Specialized executable robustness workflows already exist.

skill_hub has method metadata, cases/evidence, versioned package export, manual Studio authoring and a dormant curated contribution backend. It does not yet extract methods from uploaded papers. The prepared GAID site and app release await institutional brand approval; preparation is not deployment.

Keep current source-data semantics, result identities, historical notebook records and qualified evidence. Never equate an agent's statement, file generation, execution success, numerical agreement and scientific review. Research interpretation may remain tentative after the program completes.

Open architecture decisions: institutional identity integration, storage/retention, compute isolation and quotas, local-runner connection model, transfer dataset and scientific reuse criteria. These are not settled by this document.

## Brand Commitments

Preserve GeoAIDesk/GAID identity and the existing institutional brand-approval boundary. User-facing Korean follows the repository copy guidance and terminology; English has the same behavior and limits. The user explicitly requires current 21st.dev template research, shadcn/ui and connected shadcnblocks resources, UUPM, impeccable and taste where each applies. No generic dashboard skin counts as a researched UX proposal.

## Evidence on Hand

- User request and confirmed answers: `docs/tasks/gaid-improve.md`.
- Current software behavior: GAID workflow setup/session/exposure contracts, notebook UI/store/result/memory code, and dated reports in `reports/`.
- Cross-project read-only audit: skill_hub at `957d3662e3a0b31932389c4c75794f6cdf7e5eea`, contracts in `docs/specs/gaid-interfaces.md`, Atlas profile/evidence model and contribution/Studio source.
- Public reference: `https://data.kigam.re.kr/` and its official introduction and API guidance. Logged-in submission/institutional operations have not been tested here.
- No user research interviews, new scientific trials or institutional multi-user deployment tests have been performed in this design phase. No adoption or performance claims may be invented.
- Spatial-PU pilot material located: immutable 5-km Yilgarn input under `~/assets/yilgarn-gis-db/20260911`, author R3 manuscript and stored paper-related figures/results under `~/pc71-projects/narr/mpm_nested_cv/`, and frozen original code in skill_hub `skills/spatial-pu-workflow/references/upstream/`. Author R3 files are not a verified publisher PDF. The 40-km Atlas showcase is a separate aggregate case, not reproduction evidence for the original paper.

## Product Principles

1. Organize work around the researcher's question, meaningful result and next decision.
2. Reuse inspected inputs and documents; ask only missing questions that change validity, interpretation or execution.
3. Keep methods portable and source-linked; separate method drafts from executed and checked recipes.
4. Preserve observed records beneath a readable research narrative, with consequential warnings visible in context.
5. Judge value by a second researcher's successful reuse, including clear failure/uncertainty, rather than catalogue size or chat volume.

## Accessibility & Inclusion

The user reports excessive text, small type and unclear attention hierarchy. Prioritize readable Korean prose, visible focus, keyboard operation, progressive disclosure and responsive layouts. Noncoding contributors must not be required to use GitHub or write package metadata to express their research method. Coding contributors need access to scripts, parameters and recorded execution details without taking over the default interface.
