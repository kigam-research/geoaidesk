import type { MapFeature } from "../../contracts/maps";

/** Attribute-table browsing state. Display only: it never changes the source, the map style or area analysis. */
export type SortDirection = "asc" | "desc";
export interface TableSort { field: string; direction: SortDirection }
/** Per column: case-insensitive "contains" text and/or an explicit set of value keys (see `valueKey`). */
export interface ColumnFilter { text?: string; values?: string[] }
export type TableFilters = Record<string, ColumnFilter>;

/** Missing values (null/undefined) share one key that no string value can take. */
export const MISSING_KEY = "\u0000missing";
export const DISTINCT_LIMIT = 200;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function valueKey(value: unknown): string {
  if (value == null) return MISSING_KEY;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function isActive(filter?: ColumnFilter): boolean {
  return !!filter && (!!filter.text?.trim() || filter.values !== undefined);
}
function matches(value: unknown, filter: ColumnFilter): boolean {
  if (filter.values && !filter.values.includes(valueKey(value))) return false;
  const text = filter.text?.trim().toLowerCase();
  return !text || (value != null && valueKey(value).toLowerCase().includes(text));
}
/** Numbers compare numerically, text with numeric collation; missing values stay last in both directions. */
export function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b
    : typeof a === "boolean" && typeof b === "boolean" ? Number(a) - Number(b)
      : collator.compare(valueKey(a), valueKey(b));
  return direction === "asc" ? order : -order;
}
/** Feature indices (row = index in `features`) after filtering and a stable sort. */
export function tableRows(features: MapFeature[], sort?: TableSort, filters: TableFilters = {}): number[] {
  const active = Object.entries(filters).filter(([, f]) => isActive(f));
  const rows = features.map((_, n) => n).filter(n => active.every(([field, f]) => matches(features[n].properties[field], f)));
  if (sort) rows.sort((a, b) => compareValues(features[a].properties[sort.field], features[b].properties[sort.field], sort.direction) || a - b);
  return rows;
}
/** Value keys of one column with counts, most frequent first; `more` when the list was cut at `limit`. */
export function distinctValues(features: MapFeature[], field: string, limit = DISTINCT_LIMIT): { values: { key: string; value: unknown; count: number }[]; more: boolean } {
  const counts = new Map<string, { key: string; value: unknown; count: number }>();
  for (const f of features) {
    const value = f.properties[field]; const key = valueKey(value);
    const entry = counts.get(key);
    if (entry) entry.count++; else counts.set(key, { key, value, count: 1 });
  }
  const values = [...counts.values()].sort((a, b) => b.count - a.count || compareValues(a.value, b.value, "asc"));
  return { values: values.slice(0, limit), more: values.length > limit };
}
/** Header click cycle: ascending → descending → unsorted. */
export function nextSort(current: TableSort | undefined, field: string): TableSort | undefined {
  if (current?.field !== field) return { field, direction: "asc" };
  return current.direction === "asc" ? { field, direction: "desc" } : undefined;
}
