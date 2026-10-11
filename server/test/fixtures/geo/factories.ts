import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ProjectPaths } from "../../../src/projects.ts";
export function sandboxFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "geo-inspect-"));
  return { root, paths: { sandbox: root } as ProjectPaths, write(name: string, data: string | Buffer) { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), data); return name; }, cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}
export const las2 = `~Version Information\nVERS. 2.0 : CWLS\nWRAP. NO : one row per sample\n~Well Information\nSTRT.M 100 : start\nSTOP.M 101 : stop\nSTEP.M 0.5 : step\nNULL. -999.25 : null\n~Curve Information\nDEPT.M : depth\nGR.API : gamma ray\n~Parameter Information\nRUN. 1 : run\n~ASCII\n100 12\n100.5 -999.25\n101 14\n`;
export function shapeSet(f: ReturnType<typeof sandboxFixture>, prj = true) {
  const shp = Buffer.alloc(100 + 56);
  shp.writeUInt32BE(9994, 0); shp.writeUInt32BE(shp.length / 2, 24); shp.writeUInt32LE(1000, 28); shp.writeUInt32LE(1, 32);
  [1, 2, 3, 4].forEach((v, i) => shp.writeDoubleLE(v, 36 + i * 8));
  for (let i = 0; i < 2; i++) { const at = 100 + i * 28; shp.writeUInt32BE(i + 1, at); shp.writeUInt32BE(10, at + 4); shp.writeUInt32LE(1, at + 8); shp.writeDoubleLE(i + 1, at + 12); shp.writeDoubleLE(i + 2, at + 20); }
  const shx = Buffer.from(shp.subarray(0, 100)); shx.writeUInt32BE(58, 24);
  const dbf = Buffer.alloc(65 + 22); dbf[0] = 3; dbf.writeUInt32LE(2, 4); dbf.writeUInt16LE(65, 8); dbf.writeUInt16LE(11, 10); dbf.write("ROCK", 32); dbf[43] = 67; dbf[48] = 10; dbf[64] = 13;
  f.write("Rock.SHP", shp); f.write("rock.ShX", Buffer.concat([shx, Buffer.alloc(16)])); f.write("ROCK.dbf", dbf); f.write("Rock.CPG", "UTF-8");
  if (prj) f.write("rock.PRJ", 'GEOGCS["WGS 84",DATUM["WGS_1984"],AUTHORITY["EPSG","4326"]]');
}
export function tiff(geo = false, keys = true, bigEndian = false): Buffer {
  const le = !bigEndian;
  const entries: [number, number, number[]][] = [[256, 4, [2]], [257, 4, [3]], [258, 3, [16]], [277, 3, [1]], [339, 3, [1]]];
  if (geo) entries.push([33550, 12, [10, 10, 0]], [33922, 12, [0, 0, 0, 100, 200, 0]]);
  if (geo && keys) entries.push([34735, 3, [1, 1, 0, 1, 3072, 0, 1, 5186]]);
  const b = Buffer.alloc(512); b.write(le ? "II" : "MM");
  const w16 = (v: number, at: number) => le ? b.writeUInt16LE(v, at) : b.writeUInt16BE(v, at);
  const w32 = (v: number, at: number) => le ? b.writeUInt32LE(v, at) : b.writeUInt32BE(v, at);
  w16(42, 2); w32(8, 4); w16(entries.length, 8);
  let cursor = 8 + 2 + entries.length * 12 + 4;
  entries.forEach(([tag, type, values], i) => {
    const at = 10 + i * 12, size = type === 3 ? 2 : type === 12 ? 8 : 4;
    w16(tag, at); w16(type, at + 2); w32(values.length, at + 4);
    let dest = at + 8;
    if (values.length * size > 4) { w32(cursor, at + 8); dest = cursor; cursor += values.length * size; }
    values.forEach((value, j) => { const p = dest + j * size; if (type === 3) w16(value, p); else if (type === 4) w32(value, p); else if (le) b.writeDoubleLE(value, p); else b.writeDoubleBE(value, p); });
  });
  return b.subarray(0, cursor);
}
