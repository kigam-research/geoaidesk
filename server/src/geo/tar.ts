/**
 * Minimal reader for the catalogue archive (gzip + POSIX/GNU tar), so staging
 * needs no extra dependency. Only regular files and directories are accepted:
 * the exporter writes nothing else, and a link entry in a skill archive is
 * exactly what a staging adapter must refuse. Paths are checked before any
 * caller sees them (no absolute paths, no `..`, no backslashes).
 */
import zlib from "node:zlib";

export interface TarEntry {
  path: string;
  type: "file" | "directory";
  mode: number;
  data: Buffer;
}

const BLOCK = 512;

function field(header: Buffer, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString("utf-8");
}

function octal(header: Buffer, offset: number, length: number): number {
  const raw = header.subarray(offset, offset + length);
  // GNU base-256 for sizes over 8 GiB; the catalogue never needs it.
  if (raw[0] & 0x80) throw new Error("tar: base-256 numeric fields are not supported");
  const text = field(header, offset, length).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function checksumOk(header: Buffer): boolean {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
  return sum === octal(header, 148, 8);
}

function paxPath(data: Buffer): string | undefined {
  let offset = 0;
  let found: string | undefined;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number.parseInt(data.subarray(offset, space).toString("ascii"), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data.subarray(space + 1, offset + length - 1).toString("utf-8");
    const eq = record.indexOf("=");
    if (eq > 0 && record.slice(0, eq) === "path") found = record.slice(eq + 1);
    offset += length;
  }
  return found;
}

/** Normalized relative path, or an error for anything that could escape. */
export function safeEntryPath(raw: string): string {
  const trimmed = raw.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!trimmed) throw new Error("tar: empty entry path");
  if (trimmed.includes("\\") || trimmed.startsWith("/") || /^[A-Za-z]:/.test(trimmed)) {
    throw new Error(`tar: unsafe entry path "${raw}"`);
  }
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`tar: unsafe entry path "${raw}"`);
  }
  return parts.join("/");
}

/** Every entry of a `.tar.gz`, in archive order. */
export function readTarGz(archive: Buffer): TarEntry[] {
  return readTar(zlib.gunzipSync(archive));
}

export function readTar(tar: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longName: string | undefined;
  let paxName: string | undefined;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    if (!checksumOk(header)) throw new Error(`tar: bad header checksum at offset ${offset}`);
    const size = octal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156] || 0x30);
    const dataStart = offset + BLOCK;
    const data = tar.subarray(dataStart, dataStart + size);
    if (data.length !== size) throw new Error("tar: truncated archive");
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (typeflag === "L") {
      longName = field(data, 0, data.length);
      continue;
    }
    if (typeflag === "x") {
      paxName = paxPath(data);
      continue;
    }
    if (typeflag === "g") continue;

    const prefix = field(header, 345, 155);
    const name = field(header, 0, 100);
    const raw = paxName ?? longName ?? (prefix ? `${prefix}/${name}` : name);
    longName = undefined;
    paxName = undefined;
    const entryPath = safeEntryPath(raw);
    const mode = octal(header, 100, 8);
    if (typeflag === "0" || typeflag === "\0" || typeflag === "7") {
      entries.push({ path: entryPath, type: "file", mode, data: Buffer.from(data) });
    } else if (typeflag === "5") {
      entries.push({ path: entryPath, type: "directory", mode, data: Buffer.alloc(0) });
    } else {
      throw new Error(`tar: entry "${entryPath}" has unsupported type "${typeflag}"`);
    }
  }
  return entries;
}
