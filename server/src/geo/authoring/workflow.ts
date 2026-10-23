/** Structured authoring: the Workflow owns the procedure; Atlas is its flow-diagram projection. */
import type { DraftProfile, LocalWorkflow, MethodDraft } from "../../../../web/src/geo/contracts/authoring.ts";
import type { GaidWorkflowStep } from "../../../../web/src/geo/contracts/workflow-doc.ts";
import { stageWarnings, type StageWarning } from "../../../../web/src/geo/contracts/workflow-stages.ts";
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
    for (const id of step.inputIds ?? [])
      if (!workflow.inputRoles.some((r) => r.id === id)) problems.push(`workflow.steps.${step.id}.inputIds: unknown input ${id}`);
    for (const id of step.outputs ?? [])
      if (!workflow.expectedArtifacts.some((a) => a.id === id)) problems.push(`workflow.steps.${step.id}.outputs: unknown artifact ${id}`);
  }
  for (const choice of workflow.requiredScientificChoices) {
    if (!steps.some((s) => s.choiceIds?.includes(choice.id))) problems.push(`workflow choice ${choice.id} must be attached to the step that needs it`);
    if (choice.default !== undefined && choice.options?.length && !choice.options.includes(choice.default))
      problems.push(`workflow choice ${choice.id}: default must be one of its option ids`);
  }
  for (const artifact of workflow.expectedArtifacts)
    if (!steps.some((s) => s.outputs?.includes(artifact.id))) problems.push(`workflow artifact ${artifact.id} must be attached to the step that writes it`);
  return problems;
}

/**
 * Analysis-flow stage warnings (gaid-workflow-stages) of a structured Workflow. Older drafts get the same warnings;
 * they only change what the researcher and the coauthor are told, never stored data.
 */
export function workflowStageWarnings(workflow: LocalWorkflow): StageWarning[] {
  return stageWarnings({
    inputRoles: workflow.inputRoles.map((r) => ({ id: r.id, label: r.label })),
    choices: workflow.requiredScientificChoices.map((c) => ({ id: c.id, label: c.label, default: c.default })),
    steps: (workflow.steps ?? []).map((s) => ({ id: s.id, title: s.title, inputIds: s.inputIds, choiceIds: s.choiceIds })),
  });
}

const STAGE_FLOW = "자료 준비 → 처리·모델링 → 평가 → 해석·결과";
/** Korean object/subject particle after a quoted name: by the last Hangul syllable's final consonant, else both forms. */
const particle = (word: string, pair: [string, string]) => {
  const code = word.trim().replace(/[」』)\]]+$/, "").slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? pair[code % 28 ? 0 : 1] : `${pair[0]}(${pair[1]})`;
};

/** One researcher sentence per stage warning (package and registration check). */
export function stageWarningText(workflow: LocalWorkflow, warning: StageWarning): string {
  const steps = workflow.steps ?? [];
  const stepTitle = (id: string) => steps.find((s) => s.id === id)?.title.ko || id;
  const inputLabel = (id: string) => workflow.inputRoles.find((r) => r.id === id)?.label.ko || id;
  switch (warning.code) {
    case "stage-count":
      return `Workflow 단계가 ${steps.length}개입니다. ${STAGE_FLOW}처럼 분석 흐름에 따라 3~5단계로 묶어 주세요.`;
    case "required-choices": {
      const n = workflow.requiredScientificChoices.filter((c) => !c.default?.trim()).length;
      return `연구자가 시작할 때 꼭 정해야 하는 조건이 ${n}개입니다. 결과를 바꾸는 조건 6개 이하만 남기고, 나머지는 기본값을 두어 시작 요약에서 바꿀 수 있게 해 주세요.`;
    }
    case "item-split": {
      const ids = warning.detail.match(/^steps (.+) are one/)?.[1].split(", ") ?? [];
      const titles = ids.map((id) => `「${stepTitle(id)}」`).join(", ");
      const last = ids.length ? stepTitle(ids.at(-1)!) : "";
      return `${titles ? `단계 ${titles}${particle(last, ["이", "가"])}` : "여러 단계가"} 입력 자료나 조건 하나씩으로 나뉘어 있습니다. 항목별 절차가 아니라 ${STAGE_FLOW} 같은 분석 흐름으로 묶어 주세요.`;
    }
    case "unmapped-input": {
      const id = warning.detail.match(/^input (\S+) /)?.[1] ?? "";
      return `입력 자료 「${inputLabel(id)}」${particle(inputLabel(id), ["을", "를"])} 어느 단계에서 쓰는지 정해져 있지 않습니다.`;
    }
    case "unknown-input": {
      const m = warning.detail.match(/^workflow\.steps\.([^.]+)\.inputIds: unknown input (\S+)/);
      const title = m ? stepTitle(m[1]) : "?";
      return `단계 「${title}」${particle(title, ["이", "가"])} Workflow에 없는 입력 자료(${m?.[2] ?? "?"})를 가리킵니다.`;
    }
  }
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
