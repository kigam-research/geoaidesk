# ADR 2026-10-20: A Workflow reaches the agent as one rendered instruction document

Status: proposed (gaid-workflow-model, awaiting user confirmation). Context: reports/2026-10-20-gaid-workflow-model §3.11–3.14.

## Context

The user decided (2026-10-20) that GAID is Workflow-centred: the hub unit and the Workflow panel row are Workflows, skills
are parts a Workflow uses (built-in catalogue skills, skills imported from GitHub and similar sources, skills bundled with
the Workflow; hub-managed skills later). skill_hub is legacy; GAID owns the Workflow format. The user also asked that the
form in which a hub Workflow reaches the agent chat, and how it applies in a CLI agent (Claude Code, Codex), be defined,
fixed and shown in the hub.

Current form (verified in code, 2026-10-20):

- System prompt: upstream Kady prompt + GEO_INSTRUCTIONS + Pi's `<available_skills>` index (name, description, SKILL.md
  location), restricted by the chat's exposure (`workflow:<id>` / `method:<slug>:<wf>`) to the Workflow's `skillIds`.
- First message: an unsent composer draft (`taskDraft`): researcher's inputs and choices, "Workflow 지시문:" + the
  Workflow `prompt` (one paragraph), an example-values caveat, the boundary, a review reminder. On send the composer
  appends `Make sure to use the skills: '<skillIds[0]>'` (`buildSkillsContext`).
- The procedure is not in the Workflow: it is in the skill's SKILL.md ("처리 절차", 8 steps for conformal-grid-priority)
  and separately in `atlas.yaml` `procedure` (7 nodes, drawn by the hub). The model receives it only if it decides to
  `read` SKILL.md. The hub shows the 7-node flow but never the message the agent receives.
- Upstream BYOK Workflows are a prompt template; the launch dialog shows the final prompt. Kady already expands
  `/skill:<name>` to `<skill …>` and `/<template>` to `<prompt-template …>` blocks rendered as chips.

## Decision (proposed)

1. **A Workflow's runtime form is one instruction document (Workflow 지침)**, rendered deterministically by GAID from the
   Workflow's structured parts: purpose; the researcher's settings (inputs and choices; unresolved ones to ask before the
   step that needs them); skills used (name, source, what each is for); numbered steps (what to do, which skill and which
   part of it to read first, checks, the researcher decision a step depends on, outputs); result files; interpretation
   limits; closing rules (review state, research note). One renderer (IO-free, shared by server and web) produces the
   hub preview, the project preview, the chat start message and the CLI file, so all show the same text.
2. **Structured parts are the source.** The Workflow object gains `steps[]` and `skills[]` (schema `gaid-workflow/v1`,
   superset of `geo-workflow/v1`): step `{id, title, does, skill?, read?, checks[], choiceIds[], outputs[]}`, skill
   `{name, source: catalogue|bundled|imported, ref?, role: primary|supporting, purpose}`. The hub flow diagram is drawn
   from `steps[]`. Hub authoring writes the procedure once, into `steps[]`; a bundled SKILL.md keeps method know-how and
   script usage, with section headings that steps can point to, and a check warns when SKILL.md and steps disagree.
3. **In the GAID chat**, starting a Workflow opens a new chat whose exposure offers only the Workflow's skills (unchanged)
   and whose first message is a `<workflow id revision digest>` block with the rendered document, followed by any text
   the researcher adds. The transcript shows it as a "Workflow · <title> · <n>판" card that expands to the full text
   (like the existing skill/template chips). The `Make sure to use the skills` nudge is dropped for Workflow starts; each
   step names its skill instead. Skills are not inlined (context budget: tool schemas alone are ~19K tokens of the start
   prompt); the agent reads a skill when a step tells it to.
4. **In a CLI agent**, "CLI에서 쓰기" exports a folder: the rendered document as a prompt/command file whose settings
   section becomes `$ARGUMENTS` plus the list of choices to ask when empty, and the Workflow's skills as Agent Skills
   folders (SKILL.md + files). Pi (`.pi/prompts/`, `.pi/skills/`) is the reference layout GAID runs itself; Claude Code
   and Codex layouts are checked in implementation before they are offered.
5. **Older Workflows keep working.** `geo-workflow/v1` objects (5 hub entries, installed copies, 7 catalogue Workflows)
   get derived steps from their primary skill's procedure (hub `atlas.yaml`, catalogue details) and a step note "자세한
   방법은 스킬 지침의 처리 절차를 따릅니다", labelled 이전 형식. Re-registering through hub editing writes the new form.
   Upstream BYOK Workflows render their prompt as the document unchanged. No stored data is rewritten.

## Alternatives

- **Keep today's form and only show it** (short prompt + "use the skill" nudge): rejected; whether the procedure reaches the
  model depends on the model's choice, and the hub cannot show one final form.
- **Inline the bundled skill** (`/skill:<name>` block as the first message): works today without format change, but keeps
  the procedure inside one skill, does not fit Workflows with several or imported skills, and spends context on text the
  current step does not need. Kept only as a manual option.
- **Step runner** (GAID drives each step as its own turn with gates): most control, but large, not portable to CLI agents,
  and contrary to "a task template, not a DAG". `steps[]` keeps this possible later.

## Consequences

- Hub, project and chat show the same Workflow text; the chat transcript records which Workflow revision ran.
- Format work stays inside GAID (`gaid-workflow/v1`, renderer, derivation); the pinned catalogue archive is unchanged.
- Authoring and hub editing must produce `steps[]`; the flow diagram's researcher-decision marks come from `choiceIds`.
- Imported (GitHub) skills become referable through `skills[].source: imported` with the source and ref recorded, and
  readiness offers to import a missing one through the existing gate.
