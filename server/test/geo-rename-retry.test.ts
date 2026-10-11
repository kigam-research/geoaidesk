import { describe, expect, it } from "vitest";
import { renameSyncWithRetry } from "../src/geo/rename-retry.ts";

const failing = (codes: string[]) => {
  const calls: string[] = [];
  const rename = (from: string) => {
    calls.push(from);
    const code = codes.shift();
    if (code) throw Object.assign(new Error(code), { code });
  };
  return { calls, rename };
};

describe("renameSyncWithRetry", () => {
  it("retries transient Windows locks until the rename succeeds", () => {
    const fake = failing(["EPERM", "EBUSY", "EACCES"]);
    renameSyncWithRetry("a", "b", { platform: "win32", rename: fake.rename, delayMs: 1 });
    expect(fake.calls).toHaveLength(4);
  });

  it("gives up after the last attempt with the original error", () => {
    const fake = failing(Array(5).fill("EPERM"));
    expect(() => renameSyncWithRetry("a", "b", { platform: "win32", rename: fake.rename, attempts: 3, delayMs: 1 })).toThrow("EPERM");
    expect(fake.calls).toHaveLength(3);
  });

  it("renames once elsewhere and for other errors", () => {
    const linux = failing(["EPERM"]);
    expect(() => renameSyncWithRetry("a", "b", { platform: "linux", rename: linux.rename })).toThrow("EPERM");
    expect(linux.calls).toHaveLength(1);
    const missing = failing(["ENOENT"]);
    expect(() => renameSyncWithRetry("a", "b", { platform: "win32", rename: missing.rename })).toThrow("ENOENT");
    expect(missing.calls).toHaveLength(1);
  });
});
