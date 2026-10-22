/**
 * Hub skills in authoring (gaid-hub-skills, ADR docs/adr/2026-10-22-hub-managed-skills.md §6): before the model writes a
 * new skill, the hub asks the researcher whether one of the shelf's matching skills should be used. Chosen skills reach the
 * draft as `source: "hub"` supporting skills pinned to the revision current when the draft was written.
 */
import type { AuthoringProject, Question } from "../../../../web/src/geo/contracts/authoring.ts";
import { HubSkillStore, listHubSkills } from "../hub-skills/index.ts";

export const HUB_SKILLS_KEY = "hub-skills";
const NONE = "none";

export interface HubSkillCandidate {
  name: string;
  description: string;
  revision: number;
  treeHash: string;
}

const words = (text: string) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));

/** Up to three shelf skills that share words with the project; all of them when the shelf has three or fewer. */
export function matchingHubSkills(project: AuthoringProject, candidates: HubSkillCandidate[]): HubSkillCandidate[] {
  if (candidates.length <= 3) return candidates;
  const context = words([project.title, project.goal ?? "", ...project.findings.map((f) => f.statement)].join(" "));
  return candidates
    .map((c) => ({ c, score: [...words(`${c.name.replace(/-/g, " ")} ${c.description}`)].filter((w) => context.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, 3)
    .map((x) => x.c);
}

/** The standard hub-skill question, or null when nothing matches. */
export function hubSkillQuestion(project: AuthoringProject, candidates: HubSkillCandidate[]): Omit<Question, "id" | "revision" | "materiality" | "evidence" | "status" | "attemptId" | "draftRevision" | "createdAt"> | null {
  const matches = matchingHubSkills(project, candidates);
  if (!matches.length) return null;
  return {
    key: HUB_SKILLS_KEY,
    text: "허브에 있는 스킬 가운데 Workflow 단계에서 함께 쓸 것이 있나요?",
    reason: "허브 스킬을 고르면 그 스킬의 판을 고정해 단계에 연결하고, 같은 내용을 새로 쓰지 않습니다.",
    affects: "Workflow의 사용 스킬과 단계",
    answerType: "choice-or-text",
    options: [
      ...matches.map((c) => ({ id: c.name, label: c.name, hint: c.description.slice(0, 120) })),
      { id: NONE, label: "새 스킬만 쓰기", hint: "허브 스킬 없이 Workflow에 딸린 스킬만 씁니다." },
    ],
  };
}

/** Shelf skills the researcher's live hub-skills answer names (the chosen option, or names written in 기타). */
export function chosenHubSkills(project: AuthoringProject, candidates: HubSkillCandidate[]): HubSkillCandidate[] {
  const decision = project.decisions.find((d) => d.key === HUB_SKILLS_KEY && !d.supersededBy && d.status === "answered");
  if (!decision || decision.optionId === NONE) return [];
  return candidates.filter((c) => c.name === decision.optionId || new RegExp(`(^|[^a-z0-9-])${c.name}([^a-z0-9-]|$)`).test(decision.response));
}

/** Visible shelf skills whose latest revision is usable (not suspended or deprecated). */
export async function loadHubSkillCandidates(store = new HubSkillStore()): Promise<HubSkillCandidate[]> {
  return (await listHubSkills(store, { user: null })).flatMap((skill) => {
    const latest = skill.revisions.find((r) => r.revision === skill.latestRevision);
    if (!latest || skill.visibility !== "hub" || skill.state === "suspended" || skill.state === "deprecated") return [];
    return [{ name: skill.name, description: latest.description, revision: latest.revision, treeHash: latest.treeHash }];
  });
}
