import { describe, expect, it } from "vitest";
import type { MapFeature } from "../../contracts/maps";
import { distinctValues, MISSING_KEY, nextSort, tableRows } from "./table";

const rows = (values: Record<string, unknown>[]): MapFeature[] => values.map(properties => ({ type: "Feature", geometry: null, properties }));
const features = rows([{ age: 10, unit: "Qa" }, { age: null, unit: "Jgr" }, { age: 2, unit: "qa2" }, { age: 100, unit: "Qa" }, { unit: "PCEbgn" }]);

describe("attribute table state", () => {
  it("sorts numbers numerically with missing values last in both directions, stable on ties", () => {
    expect(tableRows(features, { field: "age", direction: "asc" })).toEqual([2, 0, 3, 1, 4]);
    expect(tableRows(features, { field: "age", direction: "desc" })).toEqual([3, 0, 2, 1, 4]);
    expect(tableRows(features, { field: "unit", direction: "asc" })).toEqual([1, 4, 0, 3, 2]);
  });
  it("filters by case-insensitive text and by an explicit value set, missing values included by key", () => {
    expect(tableRows(features, undefined, { unit: { text: "QA" } })).toEqual([0, 2, 3]);
    expect(tableRows(features, undefined, { age: { values: [MISSING_KEY] } })).toEqual([1, 4]);
    expect(tableRows(features, undefined, { age: { text: "1" } })).toEqual([0, 3]);
    expect(tableRows(features, undefined, { unit: { values: [] } })).toEqual([]);
    expect(tableRows(features, { field: "age", direction: "desc" }, { unit: { values: ["Qa"] } })).toEqual([3, 0]);
  });
  it("lists distinct values by frequency and reports a cut list", () => {
    expect(distinctValues(features, "unit").values.map(v => [v.key, v.count])).toEqual([["Qa", 2], ["Jgr", 1], ["PCEbgn", 1], ["qa2", 1]]);
    expect(distinctValues(features, "unit", 2)).toMatchObject({ more: true, values: [{ key: "Qa" }, { key: "Jgr" }] });
  });
  it("cycles header sort ascending, descending, unsorted", () => {
    expect(nextSort(undefined, "age")).toEqual({ field: "age", direction: "asc" });
    expect(nextSort({ field: "age", direction: "asc" }, "age")).toEqual({ field: "age", direction: "desc" });
    expect(nextSort({ field: "age", direction: "desc" }, "age")).toBeUndefined();
    expect(nextSort({ field: "age", direction: "desc" }, "unit")).toEqual({ field: "unit", direction: "asc" });
  });
});
