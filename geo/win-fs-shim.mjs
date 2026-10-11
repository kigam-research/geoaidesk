/**
 * Windows workaround for Node's native recursive file helpers on non-ASCII
 * paths (gaid-release-proof, 2026-10-11). On Windows, `fs.cpSync` (Node 22.21
 * and 24.13) and `fs.rmSync` / recursive `fs.rmdirSync` (Node 24.13) kill the
 * process outright (0xC0000005 / 0xC0000409, no JavaScript error) when a path
 * contains non-ASCII characters, e.g. a Korean user name in
 * `C:\Users\<name>\.geoaidesk`. The primitive calls (readdir, lstat, mkdir,
 * copyFile, unlink, rmdir, rename) and the async `fs.cp` / `fs.rm` work.
 *
 * Loaded with `--import` (geo/start.mjs puts it in NODE_OPTIONS on Windows, so
 * the backend, prep, the UI server and agent child processes all get it), it
 * replaces those three functions on Windows with JavaScript implementations
 * built from the primitives, only for calls whose paths contain non-ASCII
 * characters; every other call goes to Node unchanged. Elsewhere it does
 * nothing.
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toPath = (p) => (p instanceof URL ? fileURLToPath(p) : Buffer.isBuffer(p) ? p.toString() : String(p));
const nonAscii = (...paths) => paths.some((p) => p !== undefined && /[^\x00-\x7f]/.test(toPath(p)));
const RETRYABLE = new Set(["EBUSY", "EMFILE", "ENFILE", "ENOTEMPTY", "EPERM"]);
const sleeper = new Int32Array(new SharedArrayBuffer(4));

function systemError(code, message, p) {
  return Object.assign(new Error(`${code}: ${message}, '${p}'`), { code, path: p });
}

function removeTree(target) {
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) removeTree(path.join(target, entry));
    fs.rmdirSync(target);
    return;
  }
  try {
    fs.unlinkSync(target);
  } catch (err) {
    if (err.code !== "EPERM") throw err;
    fs.chmodSync(target, 0o666); // read-only files
    fs.unlinkSync(target);
  }
}

/** `fs.rmSync` semantics (force, recursive, maxRetries, retryDelay) from primitives. */
export function rmSyncJs(p, { force = false, recursive = false, maxRetries = 0, retryDelay = 100 } = {}) {
  const target = toPath(p);
  const stat = fs.lstatSync(target, { throwIfNoEntry: false });
  if (!stat) {
    if (force) return;
    throw systemError("ENOENT", "no such file or directory, rm", target);
  }
  if (stat.isDirectory() && !recursive) {
    throw systemError("ERR_FS_EISDIR", "Path is a directory: rm returned EISDIR (is a directory)", target);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      removeTree(target);
      return;
    } catch (err) {
      if (err.code === "ENOENT" && force) return;
      if (!RETRYABLE.has(err.code) || attempt >= maxRetries) throw err;
      Atomics.wait(sleeper, 0, 0, retryDelay * (attempt + 1));
    }
  }
}

function copyEntry(src, dest, opts) {
  if (opts.filter && !opts.filter(src, dest)) return;
  const stat = opts.dereference ? fs.statSync(src) : fs.lstatSync(src);
  if (stat.isDirectory()) {
    if (!opts.recursive) throw systemError("ERR_FS_EISDIR", "Recursive option is required to copy a directory", src);
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copyEntry(path.join(src, entry), path.join(dest, entry), opts);
    return;
  }
  const exists = fs.lstatSync(dest, { throwIfNoEntry: false });
  if (exists) {
    if (!opts.force) {
      if (opts.errorOnExist) throw systemError("ERR_FS_CP_EEXIST", "Target already exists", dest);
      return;
    }
    if (stat.isSymbolicLink()) fs.unlinkSync(dest);
  }
  if (stat.isSymbolicLink()) {
    let link = fs.readlinkSync(src);
    if (!opts.verbatimSymlinks && !path.isAbsolute(link)) link = path.resolve(path.dirname(src), link);
    fs.symlinkSync(link, dest);
    return;
  }
  fs.copyFileSync(src, dest, opts.mode ?? 0);
  if (opts.preserveTimestamps) fs.utimesSync(dest, stat.atime, stat.mtime);
}

/** `fs.cpSync` semantics (recursive, force, errorOnExist, filter, dereference, mode, timestamps) from primitives. */
export function cpSyncJs(src, dest, options = {}) {
  const opts = { force: true, ...options };
  const from = path.resolve(toPath(src));
  const to = path.resolve(toPath(dest));
  if (from === to) throw systemError("ERR_FS_CP_EINVAL", "src and dest cannot be the same", to);
  if (to.startsWith(from + path.sep)) throw systemError("ERR_FS_CP_EINVAL", `cannot copy ${from} to a subdirectory of self`, to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  copyEntry(from, to, opts);
}

/** Install the replacements (idempotent). `platform` is for tests. */
export function installWinFsShim({ platform = process.platform } = {}) {
  if (platform !== "win32" || fs.rmSync.__gaidShim) return false;
  const { rmSync, cpSync, rmdirSync } = fs;
  fs.rmSync = Object.assign((p, options) => (nonAscii(p) ? rmSyncJs(p, options) : rmSync(p, options)), { __gaidShim: true });
  fs.cpSync = (src, dest, options) => (nonAscii(src, dest) ? cpSyncJs(src, dest, options) : cpSync(src, dest, options));
  fs.rmdirSync = (p, options) => (options?.recursive && nonAscii(p) ? rmSyncJs(p, { recursive: true }) : rmdirSync(p, options));
  syncBuiltinESMExports();
  return true;
}

installWinFsShim();
