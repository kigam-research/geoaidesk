/** Manual integration trial: existing sample paper/findings → real configured authoring model → package + 지침.
 * Run only with an isolated GAID_HOME and TASK_OUTPUT_DIR. Does not register or install the package.
 */
import "../src/env.ts";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { modelConfig, preflight } from "../src/geo/authoring/model.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { buildPackage, checkMethod } from "../src/geo/authoring/package.ts";
import { loadVocabulary } from "../src/geo/authoring/vocabulary.ts";
import { workflowDocFor, workflowDocSay } from "../src/geo/workflow-doc.ts";
import { renderWorkflowDocument } from "../../web/src/geo/contracts/workflow-doc.ts";
import type { GeoWorkflow } from "../src/geo/catalogue-types.ts";

const home = process.env.GAID_HOME;
const output = process.env.TASK_OUTPUT_DIR;
if (!home?.includes("/work/gaid-workflow-model--authoring/") || !output) throw Error("isolated trial home and output required");
const store = new AuthoringStore(path.join(home, "pi-agent/skill-hub/authoring"));
await store.initialize();
const source = await store.read(process.env.GAID_TRIAL_SOURCE ?? "ap-b232edf4-30a");
const config = modelConfig("kigam-qwen/qwen3.8-flash-next", "medium");
await preflight(config); // Use the configured app route; never read credentials here.
const project = await store.create({ title: "Workflow 단계 형식 시험", target: "workflow", model: config.ref, goal: source.goal });
await cp(store.within(source.id, "sources"), store.within(project.id, "sources"), { recursive: true });
await store.mutate(project.id, (p) => {
  p.sources = structuredClone(source.sources);
  p.extractions = structuredClone(source.extractions);
  p.findings = structuredClone(source.findings);
  p.questions = structuredClone(source.questions);
  p.decisions = structuredClone(source.decisions);
  p.sourceRevision = source.sourceRevision;
});
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "project-id.txt"), project.id);
console.log(JSON.stringify({ project: project.id, source: source.id, model: config.ref, inputSources: source.sources.map((s) => ({ kind: s.kind, name: s.name })), findings: source.findings.length }));
const attempt = await runOperation(store, project.id, "draft", `structured-${Date.now()}`, { config });
console.log(JSON.stringify({ outcome: attempt.outcome, validationErrors: attempt.validationErrors, error: attempt.error, usage: attempt.usage }));
await writeFile(path.join(output, "attempt.json"), JSON.stringify(attempt, null, 2));
const result = await store.read(project.id);
const draft = result.drafts.at(-1);
if (!draft?.workflow) throw Error("real authoring produced no accepted Workflow");
const ctx = { store, vocabulary: loadVocabulary(), checker: "gaid-workflow-authoring-trial" };
await writeFile(path.join(output, "draft.json"), JSON.stringify(draft, null, 2));
const checks = await checkMethod(result, draft, ctx);
await writeFile(path.join(output, "checks.json"), JSON.stringify(checks, null, 2));
const built = await buildPackage(result, draft, ctx);
if (!("record" in built)) throw Error(JSON.stringify(built));
await writeFile(path.join(output, "gaid-method.json"), JSON.stringify(built.record.manifest, null, 2));
const doc = workflowDocFor(draft.workflow as unknown as GeoWorkflow, { skills: draft.workflow.skills ?? [] });
const text = renderWorkflowDocument(doc, { locale: "ko", target: "chat", say: workflowDocSay("ko"), settings: { inputs: {}, choices: {} } });
await writeFile(path.join(output, "workflow-chat.md"), text);
console.log(JSON.stringify({ schema: draft.workflow.schemaVersion, steps: draft.workflow.steps?.length, checks: checks.map((f) => ({ check: f.check, code: f.code, level: f.level })), packageDigest: built.record.manifest.packageDigest, docKind: doc.kind, renderedChars: text.length }));
process.exit(0);
