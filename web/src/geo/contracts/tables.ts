/** Explicit, read-only semantic overlay. Column indices are zero-based; source refs are one-based. */
export const TABLE_SCHEMA = "geo-tables/v1";
export const TABLE_ROLES = ["hole_id", "sample_id", "from_depth", "to_depth", "depth_unit", "x", "y", "z", "crs", "survey_depth", "azimuth", "dip", "analyte", "value", "unit", "detection_limit", "qualifier"] as const;
export type TableRole = typeof TABLE_ROLES[number];
export type TableMapping = Partial<Record<TableRole, number>>;
export interface TableSource { path: string; sheet?: string }
export interface TableRef extends TableSource { dataRow: number; sourceRow: number }
export interface TableRequest extends TableSource {
  mapping?: TableMapping;
  /** Explicit constants, never inferred from values or names. */
  declarations?: { depth_unit?: string; unit?: string; analyte?: string; crs?: string };
  join?: TableSource & { left: TableRole; rightColumn: number };
}
export type TableIssueCode = "overlap" | "gap" | "invalid_interval" | "missing_id" | "duplicate_id" | "unmatched_left" | "unmatched_right" | "unit_inconsistency";
export interface TableIssue { code: TableIssueCode; refs: TableRef[]; role?: TableRole; values?: string[] }
export interface TableResult {
  schemaVersion: typeof TABLE_SCHEMA;
  projectId: string;
  source: TableSource;
  sheets: string[];
  columns: string[];
  preview: { ref: TableRef; values: (string | null)[] }[];
  previewTruncated: boolean;
  rowsAssessed: number;
  relevant: boolean;
  suggestions: TableMapping;
  mapping: TableMapping;
  status: "complete" | "partial" | "unassessed";
  reasons: string[];
  checks: { name: "intervals" | "ids" | "units" | "join"; status: "complete" | "partial" | "unassessed"; reason?: string }[];
  issues: TableIssue[];
  issueCount: number;
  issuesTruncated: boolean;
  limits: { sourceBytes: number; rows: number; columns: number; cells: number; parsedBytes: number; issues: number };
  join?: { source: TableSource; columns: string[]; rowsAssessed: number; status: "complete" | "partial" | "unassessed" };
}
