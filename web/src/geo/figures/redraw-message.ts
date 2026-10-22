import { t } from "@/geo/i18n";
import type { FigureRecord, FigureTarget, JournalSummary } from "@/geo/contracts/figures";

/** User-editable composer text, never an automatic run. */
export function redrawMessage(figure: FigureRecord, target: FigureTarget | null, journal: JournalSummary | null): string {
  const width = journal?.widths.find(w => w.id === target?.width);
  return t("figures.redrawPrompt.record", {
    path: figure.path,
    script: figure.origin?.script ?? t("figures.unknown"),
    inputs: figure.origin?.inputs.filter(i => i.role !== "script").map(i => i.path).join(", ") || t("figures.unknown"),
    target: target ? `${journal?.name ?? target.journalId}, ${width?.label ?? target.width}${width?.mm ? ` (${width.mm} mm)` : ""}` : t("figures.keepSize"),
  });
}
