/**
 * `.geo-start.json` recipe checks (`POST /geo/recipes/check`; skill_hub
 * gaid-interfaces.md §6, schemas/geo-start.schema.json). The rules port
 * skill_hub `checkGeoStart` (web/shared/atlas/byok-export.ts) and add the
 * schema check the exporter runs separately. A valid recipe becomes an
 * editable task setup; nothing is executed.
 */
import type {
  GeoRecipeCheckResponse,
  GeoRecipeIssue,
} from "../../../../web/src/geo/contracts/workspace.ts";
import type { GeoCatalogue } from "../catalogue.ts";

// Patterns of skill_hub schemas/atlas-profile.schema.json $defs.
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LOCAL_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const ATLAS_ID = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;
const KEYS = new Set(["schemaVersion", "workflowId", "catalogueVersion", "skillIds", "exampleId", "choices", "unresolvedChoices"]);

interface Recipe {
  workflowId: string;
  catalogueVersion: string;
  skillIds: string[];
  exampleId?: string;
  choices: Record<string, string | number | boolean>;
  unresolvedChoices: string[];
}

function schemaIssues(value: unknown): GeoRecipeIssue[] {
  const issue = (subject: string, message: string): GeoRecipeIssue => ({ code: "schema", subject, message });
  if (!value || typeof value !== "object" || Array.isArray(value)) return [issue("$", "Recipe must be a JSON object")];
  const recipe = value as Record<string, unknown>;
  const out: GeoRecipeIssue[] = [];
  for (const key of Object.keys(recipe)) if (!KEYS.has(key)) out.push(issue(key, `Unknown field ${key}`));
  if (recipe.schemaVersion !== "geo-start/v1") out.push(issue("schemaVersion", "schemaVersion must be geo-start/v1"));
  if (typeof recipe.workflowId !== "string" || !SLUG.test(recipe.workflowId)) out.push(issue("workflowId", "workflowId must be a slug"));
  if (typeof recipe.catalogueVersion !== "string" || !SEMVER.test(recipe.catalogueVersion)) {
    out.push(issue("catalogueVersion", "catalogueVersion must be a semver version"));
  }
  const skills = recipe.skillIds;
  if (!Array.isArray(skills) || skills.length === 0 || skills.some((id) => typeof id !== "string" || !ATLAS_ID.test(id))) {
    out.push(issue("skillIds", "skillIds must be a non-empty list of publisher/slug ids"));
  } else if (new Set(skills).size !== skills.length) out.push(issue("skillIds", "skillIds must be unique"));
  if (recipe.exampleId !== undefined && (typeof recipe.exampleId !== "string" || !LOCAL_ID.test(recipe.exampleId))) {
    out.push(issue("exampleId", "exampleId must be a local id"));
  }
  const choices = recipe.choices;
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) out.push(issue("choices", "choices must be an object"));
  else {
    for (const [key, choice] of Object.entries(choices)) {
      if (!LOCAL_ID.test(key)) out.push(issue(`choices.${key}`, `Choice key ${key} is not a local id`));
      if (!["string", "number", "boolean"].includes(typeof choice)) out.push(issue(`choices.${key}`, `Choice ${key} must be a string, number or boolean`));
    }
  }
  const unresolved = recipe.unresolvedChoices;
  if (!Array.isArray(unresolved) || unresolved.some((key) => typeof key !== "string" || !LOCAL_ID.test(key))) {
    out.push(issue("unresolvedChoices", "unresolvedChoices must be a list of local ids"));
  } else if (new Set(unresolved).size !== unresolved.length) out.push(issue("unresolvedChoices", "unresolvedChoices must be unique"));
  return out;
}

export function checkRecipe(value: unknown, catalogue: GeoCatalogue | null): GeoRecipeCheckResponse {
  if (!catalogue) return { ok: false, issues: [{ code: "catalogue-off", message: "The geo catalogue is not active" }] };
  const schema = schemaIssues(value);
  if (schema.length) return { ok: false, issues: schema };
  const recipe = value as Recipe;
  const issues: GeoRecipeIssue[] = [];
  const workflow = catalogue.workflows.find((candidate) => candidate.id === recipe.workflowId);
  if (!workflow) {
    issues.push({ code: "unknown-workflow", subject: recipe.workflowId, message: `Workflow not in this catalogue: ${recipe.workflowId}` });
  } else {
    for (const id of workflow.skillIds) {
      if (!recipe.skillIds.includes(id)) issues.push({ code: "workflow-skill", subject: id, message: `Workflow skill missing: ${id}` });
    }
    const known = new Set((workflow.requiredScientificChoices ?? []).map((choice) => choice.id));
    for (const key of [...Object.keys(recipe.choices), ...recipe.unresolvedChoices]) {
      if (!known.has(key)) issues.push({ code: "unknown-choice", subject: key, message: `Choice not in the workflow: ${key}` });
    }
  }
  if (recipe.catalogueVersion !== catalogue.index.catalogueVersion) {
    issues.push({
      code: "catalogue-version",
      subject: recipe.catalogueVersion,
      message: `Recipe for catalogue ${recipe.catalogueVersion}; this app has ${catalogue.index.catalogueVersion}`,
    });
  }
  const ids = new Set(catalogue.index.skills.map((skill) => skill.id));
  for (const id of recipe.skillIds) {
    if (!ids.has(id)) issues.push({ code: "unknown-skill", subject: id, message: `Skill not in the catalogue: ${id}` });
  }
  if (
    recipe.exampleId &&
    !catalogue.index.skills.some((skill) => recipe.skillIds.includes(skill.id) && (skill.exampleIds ?? []).includes(recipe.exampleId!))
  ) {
    issues.push({ code: "unknown-example", subject: recipe.exampleId, message: `Example does not belong to the selected skills: ${recipe.exampleId}` });
  }
  for (const key of recipe.unresolvedChoices) {
    if (key in recipe.choices) issues.push({ code: "choice-state", subject: key, message: `Choice both answered and unresolved: ${key}` });
  }
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    setup: {
      workflowId: recipe.workflowId,
      choices: Object.fromEntries(Object.entries(recipe.choices).map(([key, choice]) => [key, String(choice)])),
      unresolvedChoices: [...recipe.unresolvedChoices],
      skillIds: [...recipe.skillIds],
      exampleId: recipe.exampleId ?? null,
    },
  };
}
