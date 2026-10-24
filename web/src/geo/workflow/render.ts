/**
 * Web helpers around the Workflow 지침 renderer (gaid-workflow-model): the same text for previews and chat starts.
 */
import { renderDigestSection, renderWorkflowDocument, workflowBlock, type InputFallback, type WorkflowDoc, type WorkflowDocSay, type WorkflowDocSettings, type WorkflowDocTarget } from "../contracts/workflow-doc";
import { geoLocale, t } from "../i18n";

export const workflowDocSay = (locale: "ko" | "en"): WorkflowDocSay => (key, values) => t(`workflowDoc.${key}`, values ?? {}, locale);

export const workflowDigestText = (digest?: WorkflowDocSettings["digest"]) => renderDigestSection(digest, workflowDocSay(geoLocale())).join("\n");

/** The document as the agent (or a CLI) would receive it, in the current UI language. */
export function workflowDocText(doc: WorkflowDoc, target: WorkflowDocTarget, settings?: WorkflowDocSettings | null): string {
  const locale = geoLocale();
  return renderWorkflowDocument(doc, { locale, target, say: workflowDocSay(locale), settings });
}

/** The first message of a Workflow chat: the 지침 with the researcher's settings in a `<workflow>` block. */
export function workflowStartMessage(doc: WorkflowDoc, inputs: WorkflowDocSettings["inputs"], choices: Record<string, string>, examples: string[] = [], papers: { key: string; title: string }[] = [], fallbacks: Record<string, InputFallback> = {}, digest?: WorkflowDocSettings["digest"]): string {
  const used = Object.keys(fallbacks).length > 0;
  const settings = { inputs, choices, ...(examples.length ? { examples } : {}), ...(papers.length ? { papers } : {}), ...(used ? { fallbacks } : {}), ...(digest ? { digest } : {}) };
  return workflowBlock(doc, workflowDocText(doc, "chat", settings), geoLocale(), {
    example: examples.length > 0, ...(used ? { fallbacks: Object.fromEntries(Object.entries(fallbacks).map(([id, value]) => [id, value.kind])) } : {}) });
}
