# ADR 2026-10-22: Hub-managed skills are a skill shelf with immutable revisions that Workflows pin

Status: accepted 2026-10-22 (user: "모두 권장안으로 진행하자." — options 가 for all three decisions in
reports/2026-10-22-gaid-hub-skills §6). Context: reports/2026-10-22-gaid-hub-skills §3; ADR
docs/adr/2026-10-20-workflow-runtime-form.md ("hub-managed skills later").

## Context

The GAID hub registers Workflows only; each hub entry is one Workflow plus its own bundled skill. Skills cannot be found
or shared on their own, a skill cannot be reused by another Workflow (authoring always writes a new bundled skill and
may reference catalogue skills only), GitHub skills are fetched by every researcher separately and a Workflow's
`imported` ref is free text never compared with what is installed, installed skills have no revision number, and there
is no review, licence or findings record. The user asked (2026-10-20) that the hub manage skills too.

Web research (2026-10-22, vault `웹 조사/geoaidesk/2026-10-22-research-question-answer-in-english-2--6b8718a6fe.md`):
the Agent Skills format has no version or publisher namespace; a Git ref does not guarantee the same bytes and the
`skills` CLI lock is not hash-verified on reinstall (vercel-labs/skills #806); internal registries mirror an external
package once, as an immutable reviewed artifact, and deprecate rather than delete; workflow systems pin shared components
by exact revision (GitHub Actions SHA, nf-core `git_sha`); most malicious skills in VirusTotal's 2026-10-21 sample were
instruction-only, some hiding text in HTML comments or invisible characters; a clean scan is not a safety verdict;
licences differ per skill; an approval is only as trustworthy as the reviewer's identity.

## Decision

1. **Skill shelf.** The hub keeps skills next to Workflows (`web/src/geo/contracts/hub-skills.ts`, schema
   `gaid-hub-skill/v1`). A skill's id is its runtime name, unique across the hub and never a catalogue name. Each revision
   (판) is one immutable gzip tar holding the skill folder exactly as installed, with archive SHA-256, `treeHash`
   (`hashDirectory`, the value installs record as base hash), per-file SHA-256 list, SKILL.md description, note,
   registrant, origin, licence, automatic findings and review history. Only revision 1's registrant adds revisions
   (display-name rule shared with Workflows).
2. **Three ways in.** From a project skill (origin `own`, or `github` when the install recorded an external source), out of
   a registered hub Workflow's bundled skill (origin `workflow`; the Workflow keeps its own copy, stored data unchanged),
   and from GitHub or another `skills` CLI source fetched into staging only (origin `github` with source, ref, path,
   commit when known, fetch time). A preview shows files, licence and findings before anything is stored; registration
   re-checks the previewed tree hash.
3. **Licence gate.** `institute` (own/workflow) and `declared` (known SPDX id) revisions are visible to everyone;
   `restricted` or `unknown` ones only to their registrant. Detected from SKILL.md `license:` and LICENSE files; not a
   legal opinion.
4. **Findings, not verdicts.** Registration records format problems, hidden text in Markdown (HTML comments,
   invisible/bidi Unicode, long blank runs) and lines that suggest network access, shell/process execution, package
   installation, credential paths or outside writes. They point a reviewer at lines to read.
5. **Review per revision.** `unreviewed` (default, visible at once: user decision 2) → `checked` (by someone other than the
   registrant) / `deprecated` (pinned Workflows keep working; optional replacement) / `suspended` (new installs refused,
   pinning Workflows show a blocking warning). Until gaid-backend adds accounts every review has `verified: false` and the
   UI says the name is not verified; a reviewer role distinct from members is phase 2.
6. **Workflows pin revisions.** gaid-workflow/v1 `skills[]` gains `source: "hub"` with `hub: {skillId (= name), revision,
   treeHash}`. Installing a Workflow installs its pinned hub skill revisions from the hub store (hash-checked, through the
   existing preview/acknowledgement gate, never GitHub). A new skill revision never changes a registered Workflow; its
   author adopts it by editing and re-registering. Readiness reports `installed | missing | other-revision | edited |
   conflict | suspended` by comparing the project copy with the pinned tree hash. Hub authoring proposes matching shelf
   skills before writing a new one; the researcher chooses, and chosen skills become `hub` supporting skills in steps.
7. **Installs.** Researchers install a revision into a project (Settings → Skills "GAID 허브에서", hub skill page, Workflow
   readiness). Edited project copies are never overwritten (existing rule). Settings shows the installed revision and a
   newer-revision notice; updating is an explicit install of the newer revision. No automatic update.
8. **Storage.** Phase 1 uses the existing shared hub store (`<sharedDir>/skills/<id>/`, write-once archives, atomic JSON,
   one process). gaid-backend confirmed (route 0095d2a0c339) that its proposal keeps write-once hash-addressed files,
   moves entry records to DB rows with the same shape, adds account ids with member/admin roles, and keeps installs
   client-side.

## Alternatives

- **Recommended GitHub links only:** cheapest, but upstream can change or disappear, every researcher still needs GitHub
  access, institute-written skills would have to be published on GitHub, and nothing can be reviewed as exact bytes.
- **Share skills only inside Workflows** (let a Workflow point at another Workflow's bundled skill): no new hub unit, but
  no standalone discovery and no reviewed copy of GitHub skills.
- **Dedicated package-registry service:** publication APIs, tokens, dependency solving; disproportionate for 10–50 users.
- **Hold GitHub imports until an admin approves** (decision 2 나): without accounts nobody can approve, so nothing would
  be usable in phase 1.

## Consequences

- Phase 1 (this unit): shelf, three ways in, licence gate, findings, review states with unverified names, project install,
  Workflow pins (install, readiness, exposure, 지침, CLI export, registration checks), authoring suggestions, newer-revision
  notice. Phase 2 (after gaid-backend accounts, separate unit): reviewer/admin roles, problem reports, upstream-change
  candidates with diff, optional local scanner (e.g. Cisco AI Defense Skill Scanner) feeding findings.
- Pinning fixes instruction and script bytes only; analysis reproducibility still depends on environments, inputs and
  researcher decisions (provenance records them).
- Hub skill names are first-come within the hub; a GitHub skill whose name is taken must be renamed in a project before
  registering under a new name.
