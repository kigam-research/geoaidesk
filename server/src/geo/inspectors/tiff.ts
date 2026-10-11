/** Classic TIFF IFD0 metadata only: no strips, tiles, raster arrays or linked IFD traversal. */
import type { GeoInspectContext } from "../inspection.ts";
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
export async function inspectTiff(ctx: GeoInspectContext, out: GeoInspection): Promise<void> {
  const read = (at: number, n: number) => ctx.readBytes!(ctx.relPath, at, n);
  const header = await read(0, 8);
  if (header.length < 8 || !["II", "MM"].includes(header.subarray(0, 2).toString())) throw new Error("Invalid TIFF");
  const le = header[0] === 73;
  const u16 = (b: Buffer, at: number) => le ? b.readUInt16LE(at) : b.readUInt16BE(at);
  const u32 = (b: Buffer, at: number) => le ? b.readUInt32LE(at) : b.readUInt32BE(at);
  const magic = u16(header, 2);
  if (magic === 43) { out.issues.push({ code: "bigtiff-unsupported", message: "BigTIFF metadata needs the rasterio helper or a format-aware reader.", severity: "warning" }); out.crs = { status: "unknown" }; return; }
  if (magic !== 42) throw new Error("Invalid TIFF magic");
  const start = u32(header, 4), countBuf = await read(start, 2);
  if (countBuf.length < 2) throw new Error("Invalid IFD offset");
  const declared = u16(countBuf, 0), count = Math.min(declared, 256);
  const entries = await read(start + 2, count * 12);
  if (entries.length < count * 12) throw new Error("Truncated IFD");
  const tags = new Map<number, number[]>();
  const supported = new Set([256, 257, 258, 277, 339, 33550, 33922, 34264, 34735]);
  const sizes: Record<number, number> = { 1: 1, 3: 2, 4: 4, 12: 8 };
  for (let i = 0; i < count; i++) {
    const at = i * 12, tag = u16(entries, at), type = u16(entries, at + 2), length = u32(entries, at + 4);
    if (!supported.has(tag)) continue;
    tags.set(tag, []); // Presence determines georeference even if values exceed this reader's limits.
    if (!sizes[type] || length > 2048) { out.issues.push({ code: "tiff-tag-limited", message: `TIFF tag ${tag} exceeds supported metadata limits.`, severity: "warning" }); continue; }
    const bytes = length * sizes[type];
    const data = bytes <= 4 ? entries.subarray(at + 8, at + 8 + bytes) : await read(u32(entries, at + 8), bytes);
    if (data.length < bytes) throw new Error("Truncated TIFF tag");
    tags.set(tag, Array.from({ length }, (_, j) => type === 1 ? data[j] : type === 3 ? u16(data, j * 2) : type === 4 ? u32(data, j * 4) : le ? data.readDoubleLE(j * 8) : data.readDoubleBE(j * 8)).filter(Number.isFinite));
  }
  const geo = [33550, 33922, 34264, 34735].some(tag => tags.has(tag));
  out.asset.format = geo ? "geotiff" : "tiff";
  out.crs = { status: "unknown" };
  const keys = tags.get(34735) ?? [];
  let geographic: number | undefined, projected: number | undefined;
  for (let at = 4; at + 3 < keys.length && at < 4 + (keys[3] ?? 0) * 4; at += 4) {
    if (keys[at + 1] !== 0 || keys[at + 2] !== 1) continue;
    const value = keys[at + 3];
    if (value <= 0 || value >= 32767) continue;
    if (keys[at] === 3072) projected = value;
    if (keys[at] === 2048) geographic = value;
  }
  if (projected ?? geographic) out.crs = { status: "declared", authority: `EPSG:${projected ?? geographic}` };
  else if (geo) out.issues.push({ code: "crs-unknown", message: "Georeference tags are present but no simple EPSG CRS key was resolved.", severity: "warning" });
  const width = tags.get(256)?.[0], height = tags.get(257)?.[0];
  if (width && height) {
    out.dimensions = [{ name: "width", size: width }, { name: "height", size: height }];
    out.extent = { bbox: [0, 0, width, height], coordinateSpace: "pixel" };
    const scale = tags.get(33550), tie = tags.get(33922), matrix = tags.get(34264);
    let transform: ((x: number, y: number) => [number, number]) | undefined;
    if (matrix?.length === 16) transform = (x, y) => [matrix[0] * x + matrix[1] * y + matrix[3], matrix[4] * x + matrix[5] * y + matrix[7]];
    else if (scale && scale.length >= 2 && tie && tie.length >= 6) transform = (x, y) => [tie[3] + (x - tie[0]) * scale[0], tie[4] - (y - tie[1]) * scale[1]];
    if (transform) {
      const points = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => transform!(x, y));
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      out.extent = { bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], coordinateSpace: out.crs.status === "declared" ? "crs" : "native" };
    }
  } else out.issues.push({ code: "tiff-dimensions-missing", message: "IFD0 width/height are missing.", severity: "warning" });
  const samples = tags.get(277)?.[0] ?? 1, bits = tags.get(258) ?? [1], sample = tags.get(339) ?? [1];
  out.bands = Array.from({ length: Math.min(samples, 128) }, (_, i) => ({ index: i + 1, dtype: `${({ 1: "uint", 2: "int", 3: "float", 4: "undefined", 5: "complex-int", 6: "complex-float" } as Record<number, string>)[sample[i] ?? sample[0]] ?? "unknown"}${bits[i] ?? bits[0]}` }));
  out.preview = { sampled: true, truncated: declared > count || samples > 128, method: "IFD0 metadata only; pixel values were not read" };
}
