/**
 * File-aware task suggestions (`POST /geo/suggestions`, skill_hub
 * geo-byok-plan §3.6): detected data + workflow input roles + readiness, at
 * most three, matching installed methods first, then readiness.
 *
 * A specific format (LAS, shapefile, GeoPackage, GeoJSON, GeoTIFF, Parquet)
 * matches on its own. A generic format (CSV, XLSX, JSON, Markdown, PNG) says
 * little about the task, so it needs a content signal from the inspected
 * columns; otherwise nothing is suggested rather than every workflow that
 * accepts a table. Installed methods are a user-selected library, so their
 * declared input formats suffice. Nothing runs: a suggestion only opens a task setup.
 */
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
import type {
  GeoSuggestion,
  GeoSuggestionSignal,
  GeoWorkflowSummary,
} from "../../../../web/src/geo/contracts/workspace.ts";
import type { LocalMethodWorkflow } from "../../../../web/src/geo/contracts/methods.ts";
import { GENERIC_FORMATS } from "./formats.ts";

export const MAX_SUGGESTIONS = 3;

const ELEMENT =
  /^(SiO2|TiO2|Al2O3|Fe2O3|FeOt?|MnO|MgO|CaO|Na2O|K2O|P2O5|LOI|Ag|Al|As|Au|Ba|Be|Bi|Ca|Cd|Ce|Co|Cr|Cs|Cu|Fe|Ga|Ge|Hf|Hg|In|K|La|Li|Mg|Mn|Mo|Na|Nb|Ni|P|Pb|Pd|Pt|Rb|Re|S|Sb|Sc|Se|Sn|Sr|Ta|Te|Th|Ti|Tl|U|V|W|Y|Zn|Zr)(?:[\s_\-([]*(?:ppm|ppb|pct|%|wt%|wt_pct|g\/t|gpt)?[)\]]?)?$/;
const TIME = /^(t|time|elapsed(_?time)?|min(ute)?s?|sec(ond)?s?|hours?|days?)(\b|_|\s|\(|$)/i;
const DRAWDOWN = /(drawdown|^s$|^s[_\s(]|head|water_?level|^wl\b)/i;
const X = /^(x|easting|lon|long|longitude|utm_?x|x_?coord)$/i;
const Y = /^(y|northing|lat|latitude|utm_?y|y_?coord)$/i;
const LABEL = /(label|positive|occurrence|deposit|target|presence|^pu$|^class$)/i;

function columnNames(inspection: GeoInspection | null): string[] {
  return (inspection?.columns ?? []).map((column) => column.name).filter((name) => typeof name === "string");
}

/** Content signals keyed by the catalogue workflow they point to. */
export function contentSignals(inspection: GeoInspection | null): Map<string, GeoSuggestionSignal> {
  const signals = new Map<string, GeoSuggestionSignal>();
  const columns = columnNames(inspection).map((name) => name.trim());
  const elements = columns.filter((name) => ELEMENT.test(name));
  if (elements.length >= 3) signals.set("assay-composition", { kind: "element-columns", columns: elements.slice(0, 6) });
  const time = columns.find((name) => TIME.test(name));
  const drawdown = columns.find((name) => DRAWDOWN.test(name));
  if (time && drawdown && time !== drawdown) {
    signals.set("pumping-test-diagnosis", { kind: "time-drawdown-columns", columns: [time, drawdown] });
  }
  const x = columns.find((name) => X.test(name));
  const y = columns.find((name) => Y.test(name));
  const label = columns.find((name) => LABEL.test(name));
  if (x && y && label) signals.set("spatial-pu-study", { kind: "xy-label-columns", columns: [x, y, label] });
  for (const layer of inspection?.layers ?? []) {
    if (!/polygon/i.test(layer.geometryType ?? "")) continue;
    const fields = (layer.fields ?? []).filter((field) => /str|text|char|object|categor/i.test(field.type)).map((field) => field.name);
    if (fields.length) {
      signals.set("geo-map-and-crs", { kind: "categorical-field", columns: fields.slice(0, 6) });
      break;
    }
  }
  return signals;
}

const READY_ORDER = { ready: 0, "needs-environment": 1, "missing-skills": 2, unavailable: 3 } as const;

export function suggestWorkflows(
  format: string | null,
  inspection: GeoInspection | null,
  workflows: (GeoWorkflowSummary | LocalMethodWorkflow)[],
): GeoSuggestion[] {
  if (!format) return [];
  const signals = contentSignals(inspection);
  const generic = GENERIC_FORMATS.has(format);
  const scored: { suggestion: GeoSuggestion; score: number }[] = [];
  for (const workflow of workflows) {
    const roleIndex = workflow.inputRoles.findIndex((role) => role.formats.includes(format));
    if (roleIndex < 0) continue;
    const role = workflow.inputRoles[roleIndex];
    const signal = signals.get(workflow.id);
    const exposure = "exposure" in workflow ? workflow.exposure : undefined;
    if (generic && !signal && !exposure) continue;
    const score = (signal ? 3 : 0) + (generic ? 0 : 2) + (role.required ? 1 : 0) + (roleIndex === 0 ? 1 : 0);
    scored.push({
      score,
      suggestion: {
        workflowId: workflow.id,
        ...(exposure ? { exposure, workflow } : {}),
        title: workflow.title,
        match: {
          roleId: role.id,
          roleLabel: role.label,
          format,
          required: role.required,
          ...(signal ? { signal } : {}),
        },
        needs: workflow.requiredScientificChoices.filter((choice) => !choice.requiredWhen).map((choice) => choice.label),
        readiness: workflow.readiness,
      },
    });
  }
  scored.sort(
    (a, b) =>
      Number(Boolean(b.suggestion.exposure)) - Number(Boolean(a.suggestion.exposure)) ||
      READY_ORDER[a.suggestion.readiness.state] - READY_ORDER[b.suggestion.readiness.state] || b.score - a.score,
  );
  return scored.slice(0, MAX_SUGGESTIONS).map((entry) => entry.suggestion);
}
