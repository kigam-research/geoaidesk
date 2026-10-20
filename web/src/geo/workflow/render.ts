/**
 * Web helpers around the Workflow 지침 renderer (gaid-workflow-model): the same text for previews and chat starts.
 */
import { renderWorkflowDocument, workflowBlock, type WorkflowDoc, type WorkflowDocSay, type WorkflowDocSettings, type WorkflowDocTarget } from "../contracts/workflow-doc";
import { geoLocale, t } from "../i18n";

export const workflowDocSay = (locale: "ko" | "en"): WorkflowDocSay => (key, values) => t(`workflowDoc.${key}`, values ?? {}, locale);

/** The document as the agent (or a CLI) would receive it, in the current UI language. */
export function workflowDocText(doc: WorkflowDoc, target: WorkflowDocTarget, settings?: WorkflowDocSettings | null): string {
  const locale = geoLocale();
  return renderWorkflowDocument(doc, { locale, target, say: workflowDocSay(locale), settings });
}

/** The first message of a Workflow chat: the 지침 with the researcher's settings in a `<workflow>` block. */
export function workflowStartMessage(doc: WorkflowDoc, inputs: Record<string, string>, choices: Record<string, string>): string {
  return workflowBlock(doc, workflowDocText(doc, "chat", { inputs, choices }), geoLocale());
}
