/**
 * `fs.renameSync` that rides out transient Windows locks. Right after a tree
 * is copied, Windows Defender or the search indexer can hold a handle on it,
 * and renaming the directory fails with EPERM/EACCES/EBUSY for a moment
 * (seen on a native Windows first start, gaid-release-proof). Same idea as
 * graceful-fs: retry with a short backoff, then give up with the last error.
 * Other platforms and other errors rename once, unchanged.
 */
import fs from "node:fs";

const TRANSIENT = new Set(["EPERM", "EACCES", "EBUSY"]);
const sleeper = new Int32Array(new SharedArrayBuffer(4));

export function renameSyncWithRetry(
  from: string,
  to: string,
  { platform = process.platform, rename = fs.renameSync, attempts = 12, delayMs = 50 } = {},
): void {
  for (let attempt = 1; ; attempt++) {
    try {
      rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      if (platform !== "win32" || !TRANSIENT.has(code) || attempt >= attempts) throw err;
      Atomics.wait(sleeper, 0, 0, Math.min(delayMs * attempt, 1000));
    }
  }
}
