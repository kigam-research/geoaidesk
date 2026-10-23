import { afterEach, describe, expect, it, vi } from "vitest";

import { newOpId } from "./api";

describe("newOpId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("works without crypto.randomUUID (plain-http LAN page, not a secure context)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const id = newOpId();
    expect(id).toMatch(/^op-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newOpId()).not.toBe(id);
  });
});
