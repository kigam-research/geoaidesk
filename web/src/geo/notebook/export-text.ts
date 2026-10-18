/** IO-free export labels, shared with the server; machine keys and authored data stay unchanged. */
import ko from "../locales/notebook/ko.json" with { type: "json" };
import en from "../locales/notebook/en.json" with { type: "json" };
import { formatMessage, type MessageValues } from "../icu";

export type NotebookExportLocale = "ko" | "en";
export const notebookExportLocale = (lang?: string): NotebookExportLocale => lang === "ko" ? "ko" : "en";
export function notebookExportText(lang?: string) {
  const locale = notebookExportLocale(lang);
  const catalogue: Record<string, string> = locale === "ko" ? ko : en;
  return (key: string, values: MessageValues = {}) => formatMessage(catalogue[key] ?? key, locale, values);
}

/** Additive display metadata for JSON exports; never translate data keys or enum values. */
export function notebookExportLabels(lang?: string) {
  const text = notebookExportText(lang);
  return Object.fromEntries(["export.title", "export.notes", "export.comments", "export.evidence_status",
    "type.hypothesis", "type.method", "type.observation", "type.decision", "type.note",
    "execution.planned", "execution.attempted", "execution.completed", "execution.unverified",
  ].map((key) => [key, text(key)]));
}
