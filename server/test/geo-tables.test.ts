import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { afterAll, beforeAll, expect, it } from "vitest";
import { inspectTable, TABLE_SOURCE_BYTES } from "../src/geo/tables/index.ts";
import type { ProjectPaths } from "../src/projects.ts";
import type { TableRequest } from "../../web/src/geo/contracts/tables.ts";
let sandbox: string;
let paths: ProjectPaths;
beforeAll(async () => { sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "gaid-tables-")); paths = { sandbox } as ProjectPaths; });
afterAll(async () => { await fs.rm(sandbox, { recursive: true, force: true }); });
async function read(name: string, content: string, options: Omit<TableRequest, "path"> = {}) {
  await fs.writeFile(path.join(sandbox, name), content);
  return inspectTable("table-test", paths, { path: name, ...options });
}
const mapping = { hole_id: 0, from_depth: 1, to_depth: 2, depth_unit: 3 };
it("proposes relevant roles but does not apply them without an explicit mapping", async () => {
  const a = await read("suggest.csv", "hole_id,from,to,depth_unit\nA,0,1,m\n");
  expect(a.relevant).toBe(true); expect(a.suggestions).toEqual(mapping); expect(a.mapping).toEqual({});
  expect(a.status).toBe("unassessed"); expect(a.issues).toEqual([]);
  const b = await read("generic.csv", "name,value,unit\nfood,3,g\n");
  expect(b.relevant).toBe(false); expect(b.suggestions).toEqual({});
});
it("preserves censored/raw fields, duplicate and blank headers, quoted multiline CSV and exact data/source rows", async () => {
  const r = await read("raw.csv", '\uFEFFsample_id,value,value,\n001,"<0.01","line1\nline2",\n001,>99,ND,\n', { mapping: { sample_id: 0, value: 1 } });
  expect(r.columns).toEqual(["sample_id", "value", "value", ""]);
  expect(r.preview[0].values).toEqual(["001", "<0.01", "line1\nline2", ""]);
  expect(r.preview[1].ref).toEqual({ path: "raw.csv", dataRow: 2, sourceRow: 4 });
  expect(r.issues[0]).toMatchObject({ code: "duplicate_id", refs: [{ dataRow: 1, sourceRow: 2 }, { dataRow: 2, sourceRow: 4 }] });
});
it("checks nested overlaps using the furthest end and reports gaps with exact original rows", async () => {
  const r = await read("intervals.tsv", "hole_id\tfrom\tto\tdepth_unit\nA\t0\t10\tm\nA\t2\t3\tm\nA\t4\t5\tm\nA\t12\t13\tm\n", { mapping });
  expect(r.status).toBe("complete");
  expect(r.issues.map(i => i.code)).toEqual(["overlap", "overlap", "gap"]);
  expect(r.issues[2].refs.map(r => r.dataRow)).toEqual([1, 4]);
  expect(r.checks.find(c => c.name === "ids")?.status).toBe("unassessed");
});
it("does not convert conflicting depth units or compare unknown-unit intervals", async () => {
  const r = await read("units.csv", "hole_id,from,to,depth_unit\nA,0,10,m\nA,5,15,ft\nB,0,5,\n", { mapping });
  expect(r.issues.map(i => i.code)).toEqual(["unit_inconsistency"]);
  expect(r.checks.find(c => c.name === "intervals")?.status).toBe("partial");
  const a = await read("declared.csv", "hole,from,to\nA,0,10\nA,5,15\n", { mapping: { hole_id: 0, from_depth: 1, to_depth: 2 }, declarations: { depth_unit: "m" } });
  expect(a.issues[0].code).toBe("overlap");
});
it("flags invalid intervals/missing IDs without treating censor strings as numeric depths", async () => {
  const r = await read("invalid.csv", "hole,from,to,unit\nA,<1,2,m\nB,3,3,m\n,0,4,m\n", { mapping });
  expect(r.issues.map(i => i.code)).toEqual(["invalid_interval", "invalid_interval", "missing_id"]);
  expect(r.status).toBe("partial");
});
it("groups assay units by analyte and permits long-form samples across analytes", async () => {
  const r = await read("assay.csv", "sample_id,analyte,value,unit,qualifier,dl\n1,Cu,<0.1,ppm,<,0.1\n1,Au,ND,ppb,ND,1\n2,Cu,2,percent,,\n", { mapping: { sample_id: 0, analyte: 1, value: 2, unit: 3, qualifier: 4, detection_limit: 5 } });
  expect(r.issues).toHaveLength(1); expect(r.issues[0]).toMatchObject({ code: "unit_inconsistency", values: ["ppm", "percent"] });
  expect(r.preview[0].values[2]).toBe("<0.1");
});
it("reports both unmatched directions and duplicate reference keys with file/data-row references", async () => {
  await fs.writeFile(path.join(sandbox, "collar.csv"), "hole_id\nA\nC\nC\n");
  const r = await read("samples.csv", "hole_id,sample_id\nA,001\nB,002\n", { mapping: { hole_id: 0, sample_id: 1 }, join: { path: "collar.csv", left: "hole_id", rightColumn: 0 } });
  expect(r.issues.map(i => i.code)).toEqual(["unmatched_left", "unmatched_right", "unmatched_right", "duplicate_id"]);
  expect(r.issues[0].refs).toEqual([{ path: "samples.csv", dataRow: 2, sourceRow: 3 }]);
  expect(r.issues[1].refs).toEqual([{ path: "collar.csv", dataRow: 2, sourceRow: 3 }]);
});
it("caps rows/findings and does not infer absence from a truncated join target", async () => {
  await fs.writeFile(path.join(sandbox, "large.csv"), "hole_id\n" + "A\n".repeat(20001));
  const r = await read("left.csv", "hole_id\nZ\n", { mapping: { hole_id: 0 }, join: { path: "large.csv", left: "hole_id", rightColumn: 0 } });
  expect(r.status).toBe("partial"); expect(r.join?.rowsAssessed).toBe(20000);
  expect(r.issues.some(i => i.code === "unmatched_left")).toBe(false);
  expect(r.issues).toHaveLength(200); expect(r.issueCount).toBeGreaterThan(200); expect(r.issuesTruncated).toBe(true);
});
it("stops on rows wider than the header and reports partial scope", async () => {
  const r = await read("ragged.csv", "sample_id,value\nA,1\nB,2,extra\nC,3\n", { mapping: { sample_id: 0 } });
  expect(r.rowsAssessed).toBe(1); expect(r.status).toBe("partial"); expect(r.reasons).toContain("row_wider_than_header");
});
it("rejects invalid mappings, unsupported paths, oversize sources and symlink escapes", async () => {
  await fs.writeFile(path.join(sandbox, "small.csv"), "a,b\n1,2");
  for (const opts of [{ mapping: { invented: 0 } }, { mapping: { hole_id: 0, sample_id: 0 } }, { mapping: { hole_id: 9 } }, { mapping: [] }, { join: { path: "small.csv", left: "hole_id", rightColumn: 0 } }]) {
    await expect(inspectTable("t", paths, { path: "small.csv", ...opts })).rejects.toMatchObject({ statusCode: 400 });
  }
  await expect(inspectTable("t", paths, { path: "../outside.csv" })).rejects.toMatchObject({ statusCode: 403 });
  await fs.symlink(os.tmpdir(), path.join(sandbox, "outside"));
  await expect(inspectTable("t", paths, { path: "outside/no.csv" })).rejects.toMatchObject({ statusCode: 403 });
  const handle = await fs.open(path.join(sandbox, "huge.csv"), "w"); await handle.truncate(TABLE_SOURCE_BYTES + 1); await handle.close();
  await expect(inspectTable("t", paths, { path: "huge.csv" })).rejects.toMatchObject({ statusCode: 413 });
});
function workbook(filename: string) {
  const z = new AdmZip();
  const add = (name: string, s: string) => z.addFile(name, Buffer.from(s));
  add("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  add("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Assays" sheetId="1" r:id="rId1"/></sheets></workbook>');
  add("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  add("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A1"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>sample_id</t></is></c><c r="B1" t="inlineStr"><is><t>value</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>001</t></is></c><c r="B2" t="inlineStr"><is><t>&lt;0.1</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>002</t></is></c><c r="B3"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>');
  z.writeZip(filename);
}
it("reads explicit XLSX worksheets despite stale dimensions and retains formulas/censored text", async () => {
  workbook(path.join(sandbox, "assays.xlsx"));
  const r = await inspectTable("t", paths, { path: "assays.xlsx", sheet: "Assays", mapping: { sample_id: 0, value: 1 } });
  expect(r.sheets).toEqual(["Assays"]); expect(r.columns).toEqual(["sample_id", "value"]);
  expect(r.preview.map(r => r.values)).toEqual([["001", "<0.1"], ["002", "=1+1"]]);
  expect(r.preview[1].ref).toEqual({ path: "assays.xlsx", sheet: "Assays", dataRow: 2, sourceRow: 3 });
  await expect(inspectTable("t", paths, { path: "assays.xlsx", sheet: "Missing" })).rejects.toMatchObject({ statusCode: 400 });
});
