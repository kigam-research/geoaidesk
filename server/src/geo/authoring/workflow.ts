/** Structured authoring: the Workflow owns the procedure; Atlas is its flow-diagram projection. */
import type { DraftProfile, LocalWorkflow, MethodDraft } from "../../../../web/src/geo/contracts/authoring.ts";
import type { GaidWorkflowStep } from "../../../../web/src/geo/contracts/workflow-doc.ts";
import { procedureSteps, workflowDocFor } from "../workflow-doc.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";

export function procedureFor(workflow: LocalWorkflow): DraftProfile["procedure"] {
  const nodes = (workflow.steps ?? []).map((step, i, steps) => ({
    id: step.id,
    label: step.title,
    summary: step.does,
    type: (step.choiceIds ?? []).length ? "human-gate" as const : i === 0 ? "input" as const : i === steps.length - 1 ? "output" as const : "analysis" as const,
    checks: step.checks,
    decisionIds: step.choiceIds,
    outputs: [...new Set((step.outputs ?? []).flatMap((id) => workflow.expectedArtifacts.find((a) => a.id === id)?.output ?? []))],
  }));
  return { nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id, relation: "next" as const })) };
}

/** A new edit/package snapshot only. Never write back to the original stored draft or registered revision. */
export function structuredDraft(draft: MethodDraft): MethodDraft {
  const out = structuredClone(draft);
  if (!out.workflow) return out;
  const workflow = out.workflow!;
  if (workflow.schemaVersion !== "gaid-workflow/v1") {
    const doc = workflowDocFor(workflow as unknown as GeoWorkflow, {
      skills: workflow.skillIds.map((id, i) => ({ name: i === 0 ? draft.slug : id.split("/").at(-1)!, source: i === 0 ? "bundled" : "catalogue" })),
      procedure: procedureSteps(draft.profile),
    });
    workflow.schemaVersion = "gaid-workflow/v1";
    workflow.skills = doc.skills;
    workflow.steps = doc.steps.map((step) => ({ ...step, read: step.title }));
    // Legacy Atlas decisions need not share the Workflow choice ids. Keep existing links and conservatively ask
    // remaining choices before the first step; assign artifacts to the final writing step.
    if (workflow.steps.length) {
      for (const choice of workflow.requiredScientificChoices)
        if (!workflow.steps.some((step) => step.choiceIds?.includes(choice.id))) (workflow.steps[0].choiceIds ??= []).push(choice.id);
      workflow.steps.at(-1)!.outputs = workflow.expectedArtifacts.map((a) => a.id);
    }
  }
  out.profile.procedure = procedureFor(workflow);
  return out;
}

/** Cross references and coverage are checked both on model output and on manually edited drafts before packaging. */
export function workflowProblems(workflow: LocalWorkflow, slug: string): string[] {
  const problems: string[] = [];
  const skills = workflow.skills ?? [];
  const names = new Set(skills.map((s) => s.name));
  if (!skills.length || skills[0].name !== slug || skills[0].source !== "bundled" || skills[0].role !== "primary")
    problems.push(`workflow.skills must start with bundled primary skill ${slug}`);
  if (names.size !== skills.length) problems.push("workflow.skills names must be unique");
  const steps = workflow.steps ?? [];
  if (steps.length < 3 || steps.length > 12) problems.push("workflow.steps needs 3-12 steps");
  if (new Set(steps.map((s) => s.id)).size !== steps.length) problems.push("workflow.steps ids must be unique");
  for (const step of steps) {
    if (!step.title.ko || !step.does.ko) problems.push(`workflow.steps.${step.id} needs title and does`);
    if (!step.skill || !names.has(step.skill)) problems.push(`workflow.steps.${step.id}.skill must name workflow.skills`);
    if (step.skill === slug && !step.read?.ko) problems.push(`workflow.steps.${step.id}.read must name its SKILL.md heading`);
    for (const id of step.choiceIds ?? [])
      if (!workflow.requiredScientificChoices.some((c) => c.id === id)) problems.push(`workflow.steps.${step.id}.choiceIds: unknown choice ${id}`);
    for (const id of step.outputs ?? [])
      if (!workflow.expectedArtifacts.some((a) => a.id === id)) problems.push(`workflow.steps.${step.id}.outputs: unknown artifact ${id}`);
  }
  for (const choice of workflow.requiredScientificChoices)
    if (!steps.some((s) => s.choiceIds?.includes(choice.id))) problems.push(`workflow choice ${choice.id} must be attached to the step that needs it`);
  for (const artifact of workflow.expectedArtifacts)
    if (!steps.some((s) => s.outputs?.includes(artifact.id))) problems.push(`workflow artifact ${artifact.id} must be attached to the step that writes it`);
  return problems;
}

/** Compare real Markdown headings, ignoring fenced code and optional numeric heading prefixes. */
export function headingMismatch(instructions: string, steps: GaidWorkflowStep[], slug: string): boolean {
  const text = instructions.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const section = text.match(/^##\s+처리 절차\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m)?.[1] ?? "";
  const clean = (s: string) => s.replace(/^\d+[.)]\s*/, "").replace(/\s+#+\s*$/, "").trim();
  const headings = [...section.matchAll(/^###\s+(.+)$/gm)].map((m) => clean(m[1]));
  const own = steps.filter((s) => s.skill === slug);
  return headings.length !== own.length || own.some((s, i) => headings[i] !== clean(s.title.ko) || clean(s.read?.ko ?? "") !== headings[i]);
}
