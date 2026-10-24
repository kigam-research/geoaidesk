import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// GeoAIDesk (gaid-check-speed): findBy*/waitFor wait up to 5 s instead of 1 s. The declared check shares the PC with
// other checks and jobs; under that load lazy panels and editors took longer than 1 s to appear and unrelated tests
// failed (PC74 check logs, 2026-10-10..24). Passing tests still finish as soon as the element appears.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom doesn't implement ResizeObserver / matchMedia — many Radix/Shadcn
// components reach for them on mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserver;
}

// jsdom also has no layout engine, so Element.prototype.scrollIntoView is
// simply absent — components that auto-scroll (e.g. LabNotebookView) throw
// on mount without this.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

// On Node >= 22 with experimental WebStorage, Node's own `localStorage`
// global shadows jsdom's implementation; without --localstorage-file it is
// undefined, breaking every test that touches window.localStorage.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const localStorageShim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageShim,
  });
}

if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
