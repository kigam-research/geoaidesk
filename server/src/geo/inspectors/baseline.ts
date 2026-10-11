import path from "node:path";
import { GEO_INSPECTION_SCHEMA, familyOf, formatFromName, type GeoFormat, type GeoInspection, type GeoCrs } from "../../../../web/src/geo/contracts/inspection.ts";
import type { GeoInspectContext, GeoInspector } from "../inspection.ts";
import { inspectTiff } from "./tiff.ts";
import { enrichMetadata } from "./helper.ts";

export function looksBinary(data: Buffer): boolean {
  return data.includes(0) || [...data.subarray(0, 512)].filter(v => v < 9 || (v > 13 && v < 32)).length > 8;
}
export function sniffFormat(name: string, data: Buffer): GeoFormat {
  if (data.subarray(0, 4).toString("ascii") === "LASF") return "las";
  if (data.length >= 4 && (data.subarray(0, 2).toString() === "II" || data.subarray(0, 2).toString() === "MM")) {
    const magic = data[0] === 73 ? data.readUInt16LE(2) : data.readUInt16BE(2);
    if (magic === 42 || magic === 43) return "tiff";
  }
  if (data.length >= 4 && data.readUInt32BE(0) === 9994) return "shapefile";
  if (data.subarray(0, 16).toString() === "SQLite format 3\0") return data.length >= 72 && data.readUInt32BE(68) === 0x47504b47 ? "geopackage" : "binary";
  const text = data.toString("utf8").replace(/^\uFEFF/, "");
  if (/^\s*~(?:V|Version)\b/im.test(text)) return "las";
  if (/"type"\s*:\s*"(?:FeatureCollection|Feature|Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection)"/.test(text)) return "geojson";
  const named = formatFromName(name);
  if (named !== "unknown") return named;
  return looksBinary(data) ? "binary" : "text";
}
function issue(out: GeoInspection, code: string, message: string, severity: "warning" | "info" | "error" = "warning") { out.issues.push({ code, message, severity }); }
export function base(ctx: GeoInspectContext): GeoInspection {
  return { schemaVersion: GEO_INSPECTION_SCHEMA, asset: { projectId: ctx.projectId, path: ctx.relPath, sourceFiles: ctx.sourceFiles ?? [ctx.relPath], format: ctx.format, family: familyOf(ctx.format), sizeBytes: ctx.sizeBytes, fingerprint: "" }, issues: [], inspector: { name: "gaid-baseline", version: "1.0.0" } };
}
export async function prefix(ctx: GeoInspectContext, rel = ctx.relPath): Promise<Buffer> { return ctx.readBytes!(rel, 0, 255 * 1024); }
/** Drop a partial last line rather than present a chopped sample as a complete row. */
export function completeLines(data: Buffer, size: number): string[] {
  let text = data.toString("utf8").replace(/^\uFEFF/, "");
  if (data.length < size) text = text.slice(0, Math.max(0, text.lastIndexOf("\n")));
  return text.split(/\r?\n/).filter((line, i, all) => i < all.length - 1 || line.length > 0);
}
function las(ctx: GeoInspectContext, data: Buffer, out: GeoInspection) {
  if (data.subarray(0, 4).toString() === "LASF") { issue(out, "lidar-las-unsupported", "Binary LiDAR LAS is not a LAS well log."); return; }
  const lines = completeLines(data, ctx.sizeBytes);
  const headers: string[] = [], rows: (string | number | null)[][] = [];
  let section = "", version = "", wrap = "NO", nullValue: number | undefined;
  out.depth = { basis: "unknown" }; out.curveInventory = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("~")) { section = line.slice(1).toUpperCase(); if (headers.length < 64) headers.push(line.slice(0, 512)); continue; }
    if (section.startsWith("A")) {
      if (rows.length < ctx.previewRows) rows.push(line.split(/\s+/).slice(0, 128).map(v => { const n = Number(v); return Number.isFinite(n) ? n === nullValue ? null : n : v.slice(0, 256); }));
      continue;
    }
    if (headers.length < 64) headers.push(line.slice(0, 512));
    const match = /^([^\s.]+)\s*\.([^\s]*)\s*(.*?)\s*(?::\s*(.*))?$/.exec(line);
    if (!match) continue;
    const [, mnemonic, unit, value, description] = match;
    const key = mnemonic.toUpperCase();
    if (section.startsWith("V")) { if (key === "VERS") version = value; if (key === "WRAP") wrap = value.toUpperCase(); }
    if (section.startsWith("W")) {
      if (key === "NULL") nullValue = Number(value);
      const field = ({ STRT: "start", STOP: "stop", STEP: "step" } as const)[key as "STRT"];
      if (field && Number.isFinite(Number(value))) { out.depth[field] = Number(value); if (unit) out.depth.unit = unit; }
    }
    if (section.startsWith("C") && out.curveInventory.length < 128) out.curveInventory.push({ mnemonic, unit: unit || undefined, description });
    // Only explicit basis labels, never infer MD from a generic DEPT/DEPTH mnemonic.
    const basis = key === "BASIS" ? value : /\bdepth (?:basis|reference)\s*[:=]\s*(TVD|MD|elevation)\b/i.exec(line)?.[1];
    if (/^TVD$/i.test(basis ?? "")) out.depth.basis = "TVD";
    else if (/^(?:MD|measured depth)$/i.test(basis ?? "")) out.depth.basis = "MD";
    else if (/^elevation$/i.test(basis ?? "")) out.depth.basis = "elevation";
  }
  if (/^3(?:\.|$)/.test(version)) { issue(out, "las-version-3", "LAS 3.0 sections are not supported by the LAS 2.0 reader."); rows.length = 0; }
  else if (!/^2(?:\.|$)/.test(version)) issue(out, "las-version-unsupported", `LAS version ${version || "unknown"}; baseline supports LAS 2.0.`);
  if (wrap.startsWith("YES")) { issue(out, "las-wrapped", "Wrapped LAS rows need a LAS-aware reader; physical lines are not samples."); rows.length = 0; }
  if (!lines.some(l => /^\s*~A/i.test(l))) issue(out, "las-data-not-reached", "No data section found within the header byte limit.");
  out.preview = { sampled: true, truncated: data.length < ctx.sizeBytes || lines.filter(l => /^\s*~A/i.test(l)).length === 0 || rows.length >= ctx.previewRows, method: "LAS header and first unwrapped data rows", rows, headerLines: headers, displayedRows: rows.length };
}
function wktCrs(wkt: string): GeoCrs {
  // A projected WKT can contain geographic/datum/method EPSG IDs. Only a root-level
  // authority describes the dataset CRS; taking the last nested ID invents a CRS.
  let depth = 0, quoted = false, authority: string | undefined;
  for (let at = 0; at < wkt.length; at++) {
    const c = wkt[at];
    if (c === '"') { if (quoted && wkt[at + 1] === '"') { at++; continue; } quoted = !quoted; }
    if (quoted) continue;
    if (depth === 1 && (c === "A" || c === "I" || c === "a" || c === "i")) {
      const match = /^(?:AUTHORITY|ID)\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/i.exec(wkt.slice(at));
      if (match) authority = `EPSG:${match[1]}`;
    }
    if (c === "[") depth++;
    if (c === "]") depth--;
  }
  return { status: "declared", name: /^\s*\w+\s*\[\s*"([^"]+)"/.exec(wkt)?.[1], authority, wkt };
}
const shapeTypes: Record<number, string> = { 0: "Null", 1: "Point", 3: "Polyline", 5: "Polygon", 8: "MultiPoint", 11: "PointZ", 13: "PolylineZ", 15: "PolygonZ", 18: "MultiPointZ", 21: "PointM", 23: "PolylineM", 25: "PolygonM", 28: "MultiPointM", 31: "MultiPatch" };
async function shapefile(ctx: GeoInspectContext, out: GeoInspection) {
  const files = new Map((ctx.sourceFiles ?? []).map(rel => [path.extname(rel).toLowerCase(), rel]));
  const stem = ctx.relPath.slice(0, -path.extname(ctx.relPath).length);
  out.missingCompanions = [".shp", ".shx", ".dbf", ".prj", ".cpg"].filter(ext => !files.has(ext)).map(ext => stem + ext);
  out.crs = { status: "unknown" };
  const layer: NonNullable<GeoInspection["layers"]>[number] = { name: path.basename(stem), fields: [] };
  out.layers = [layer];
  const read = async (ext: string, n: number) => files.has(ext) ? ctx.readBytes!(files.get(ext)!, 0, n) : Buffer.alloc(0);
  const shp = await read(".shp", 100), shx = await read(".shx", 100), dbf = await read(".dbf", 64 * 1024);
  if (shp.length >= 100 && shp.readUInt32BE(0) === 9994) {
    layer.geometryType = shapeTypes[shp.readUInt32LE(32)] ?? `Shape ${shp.readUInt32LE(32)}`;
    const bbox = [36, 44, 52, 60].map(n => shp.readDoubleLE(n)) as [number, number, number, number];
    if (bbox.every(Number.isFinite)) out.extent = { bbox, coordinateSpace: "native" };
  } else issue(out, "invalid-shp-header", "Missing or invalid .shp header.");
  if (shx.length >= 100 && shx.readUInt32BE(0) === 9994) {
    const count = (shx.readUInt32BE(24) * 2 - 100) / 8;
    if (Number.isSafeInteger(count) && count >= 0) layer.featureCount = count;
    else issue(out, "invalid-shx-header", "Invalid .shx index length.");
  }
  if (dbf.length >= 33) {
    const count = dbf.readUInt32LE(4), header = dbf.readUInt16LE(8);
    if (layer.featureCount === undefined) issue(out, "shx-count-unavailable", `DBF declares ${count} records; geometry count requires .shx.`);
    else if (layer.featureCount !== count) issue(out, "feature-count-mismatch", "SHP index and DBF record counts disagree.");
    for (let at = 32; at + 32 <= Math.min(header, dbf.length) && dbf[at] !== 13 && layer.fields!.length < 128; at += 32) {
      layer.fields!.push({ name: dbf.subarray(at, at + 11).toString("latin1").split("\0")[0], type: String.fromCharCode(dbf[at + 11]) });
    }
  } else issue(out, "missing-dbf", "DBF field metadata is unavailable.");
  if (files.has(".prj")) {
    const wkt = (await read(".prj", 16 * 1024)).toString("utf8").trim();
    if (/^\s*(?:PROJCS|GEOGCS|PROJCRS|GEOGCRS|GEODCRS|COMPD_CS|COMPOUNDCRS|LOCAL_CS|ENGCRS)\s*\[/i.test(wkt)) out.crs = wktCrs(wkt);
    else issue(out, "invalid-prj", "The .prj file is not recognized WKT; CRS remains unknown.");
  } else issue(out, "missing-prj", "No .prj companion: CRS is unknown. Supply the source CRS before transforming coordinates.");
  if (!files.has(".cpg")) issue(out, "encoding-unknown", "No .cpg companion: attribute text encoding is unknown.", "info");
  else out.preview = { sampled: true, truncated: false, method: `DBF encoding declaration: ${(await read(".cpg", 256)).toString("utf8").trim()}` };
  if (out.extent && out.crs.status === "declared") out.extent.coordinateSpace = "crs";
  layer.crs = out.crs; layer.extent = out.extent;
  if (out.missingCompanions.length) issue(out, "missing-companions", `Missing companions: ${out.missingCompanions.join(", ")}`);
}
function geojson(ctx: GeoInspectContext, data: Buffer, out: GeoInspection) {
  if (data.length < ctx.sizeBytes) { issue(out, "geojson-structure-truncated", "GeoJSON exceeds the structural byte limit; feature count and CRS were not inferred from a fragment."); out.crs = { status: "unknown" }; out.preview = { sampled: true, truncated: true, method: "bounded structural sniff" }; return; }
  const doc = JSON.parse(data.toString("utf8").replace(/^\uFEFF/, ""));
  const valid = ["FeatureCollection", "Feature", "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"];
  if (!doc || !valid.includes(doc.type) || (doc.type === "FeatureCollection" && !Array.isArray(doc.features))) throw new Error("Not GeoJSON");
  if (Object.hasOwn(doc, "crs")) {
    const name = doc.crs?.properties?.name;
    out.crs = typeof name === "string" ? { status: "declared", name, authority: /EPSG(?::|::)(\d+)$/i.test(name) ? `EPSG:${/EPSG(?::|::)(\d+)$/i.exec(name)![1]}` : undefined } : { status: "unknown" };
    issue(out, "geojson-legacy-crs", "A legacy GeoJSON crs member is present; it is not an RFC 7946 CRS declaration.", "info");
  } else { out.crs = { status: "declared", authority: "OGC:CRS84", name: "WGS 84 longitude/latitude (RFC 7946)", axisUnits: "degree" }; issue(out, "geojson-rfc7946", "No crs member: coordinates are interpreted as WGS 84 longitude/latitude per RFC 7946, not inferred from values.", "info"); }
  const features = doc.type === "FeatureCollection" ? doc.features : doc.type === "Feature" ? [doc] : [];
  const fields = Object.entries(features[0]?.properties ?? {}).slice(0, 128).map(([name, v]) => ({ name, type: v === null ? "null" : typeof v }));
  out.layers = [{ name: path.basename(ctx.relPath), geometryType: features[0]?.geometry?.type ?? doc.type, featureCount: features.length || (doc.type === "FeatureCollection" ? 0 : 1), fields, crs: out.crs }];
  if (Array.isArray(doc.bbox) && doc.bbox.length === 4 && doc.bbox.every(Number.isFinite)) out.extent = { bbox: doc.bbox, coordinateSpace: out.crs.status === "declared" ? "crs" : "native" };
  out.preview = { sampled: false, truncated: false, method: "complete small GeoJSON structure" };
}
/** Small RFC-style delimited parser including quoted newlines, with bounded cells/columns. */
export function delimitedRows(text: string, sep: string, maxRows: number): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quote = false;
  const append = (v: string) => { if (cell.length < 1024) cell += v; };
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const c = text[i];
    if (c === '"') { if (quote && text[i + 1] === '"') { append('"'); i++; } else if (quote || !cell) quote = !quote; else append(c); }
    else if (!quote && c === sep) { if (row.length < 128) row.push(cell); cell = ""; }
    else if (!quote && c === "\n") { if (row.length < 128) row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else append(c);
  }
  if (!quote && (cell || row.length) && rows.length < maxRows) { if (row.length < 128) row.push(cell); rows.push(row); }
  return rows;
}
function textFile(ctx: GeoInspectContext, data: Buffer, out: GeoInspection) {
  if (looksBinary(data)) { issue(out, "binary-content", "Content is binary; use a format-aware reader."); out.asset.format = "binary"; return; }
  const lines = completeLines(data, ctx.sizeBytes), sep = ctx.format === "tsv" ? "\t" : ",";
  const rows = ctx.format === "text" ? lines.slice(0, ctx.previewRows).map(l => [l.slice(0, 1024)]) : delimitedRows(lines.join("\n"), sep, ctx.previewRows + 2);
  const header = ctx.format !== "text" ? rows.shift() : undefined;
  if (header) out.columns = header.map(name => ({ name }));
  const shown = rows.slice(0, ctx.previewRows);
  const sampled = data.length < ctx.sizeBytes;
  const limited = sampled || rows.length > shown.length || (ctx.format === "text" && lines.length > shown.length) || lines.some(l => l.length > 1024) || rows.some(r => r.length >= 128) || (header?.length ?? 0) >= 128;
  out.preview = { sampled: sampled || rows.length > shown.length || (ctx.format === "text" && lines.length > shown.length), truncated: limited, rows: shown, displayedRows: shown.length, sourceRows: sampled ? Math.round(ctx.sizeBytes / Math.max(1, data.length) * Math.max(0, lines.length - (header ? 1 : 0))) : ctx.format === "text" ? lines.length : Math.max(0, delimitedRows(lines.join("\n"), sep, lines.length + 1).length - 1), method: sampled ? "prefix rows; sourceRows is an estimate from sampled bytes" : "bounded first rows; cells/columns may be limited", headerLines: header ? [lines[0]?.slice(0, 1024) ?? ""] : undefined };
}
export const baselineInspector: GeoInspector = {
  name: "gaid-baseline", version: "1.0.0", formats: ["las", "shapefile", "geopackage", "geojson", "geotiff", "tiff", "csv", "tsv", "text", "binary", "unknown", "xlsx", "netcdf"],
  async inspect(ctx) {
    const out = base(ctx);
    switch (ctx.format) {
      case "las": las(ctx, await prefix(ctx), out); break;
      case "shapefile": await shapefile(ctx, out); break;
      case "tiff": case "geotiff": await inspectTiff(ctx, out); break;
      case "geojson": geojson(ctx, await prefix(ctx), out); break;
      case "csv": case "tsv": case "text": textFile(ctx, await prefix(ctx), out); break;
      case "geopackage": {
        const h = await ctx.readBytes!(ctx.relPath, 0, 100);
        if (h.length < 72 || h.subarray(0, 16).toString() !== "SQLite format 3\0" || h.readUInt32BE(68) !== 0x47504b47) issue(out, "invalid-geopackage", "Expected SQLite GeoPackage header and application_id.");
        else { out.crs = { status: "unknown" }; await enrichMetadata(ctx, out); }
        break;
      }
      default: issue(out, "format-not-supported", "No baseline content reader for this format. Use a format-aware analysis library.", "info");
    }
    if ((out.asset.format === "geotiff" && out.crs?.status === "unknown") || out.issues.some(i => i.code === "bigtiff-unsupported")) {
      await enrichMetadata(ctx, out);
      if (out.crs?.status === "declared") out.asset.format = "geotiff";
      if (out.crs?.status === "declared" && out.extent?.coordinateSpace === "native") out.extent.coordinateSpace = "crs";
    }
    if (out.asset.format === "shapefile" && out.crs?.status === "declared" && !out.crs.authority) {
      const original = out.crs;
      await enrichMetadata(ctx, out);
      if (out.crs?.status !== "declared") out.crs = original;
      for (const layer of out.layers ?? []) layer.crs = out.crs;
    }
    out.asset.family = familyOf(out.asset.format);
    return out;
  },
};
