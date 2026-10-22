import { afterEach, describe, expect, it, vi } from "vitest";
import { matchesShortcut, shortcutLabel } from "./shortcuts";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("workspace shortcuts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Ctrl outside macOS and leaves Shift/Alt combinations to the browser", () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(shortcutLabel("search")).toBe("Ctrl K");
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "search")).toBe(true);
    expect(matchesShortcut(key({ key: "K", ctrlKey: true, shiftKey: true }), "search")).toBe(false);
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "search")).toBe(false);
    expect(matchesShortcut(key({ key: "\\", ctrlKey: true }), "sidebar")).toBe(true);
  });

  it("uses ⌘ on macOS", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(shortcutLabel("sidebar")).toBe("⌘\\");
    expect(matchesShortcut(key({ key: "k", metaKey: true }), "search")).toBe(true);
    expect(matchesShortcut(key({ key: "k", ctrlKey: true }), "search")).toBe(false);
  });
});
