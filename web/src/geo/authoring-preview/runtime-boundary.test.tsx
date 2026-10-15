import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ path: "/authoring-preview", project: vi.fn(), auth: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("@/lib/use-projects", () => ({ ProjectProvider: ({ children }: { children: ReactNode }) => { mocks.project(); return <>{children}</>; } }));
vi.mock("@/components/api-token-gate", () => ({ ApiTokenGate: () => { mocks.auth(); return null; } }));
import { GeoRuntimeBoundary } from "./runtime-boundary";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("does not mount project or credential consumers on the isolated preview route", () => {
  mocks.path = "/authoring-preview";
  render(<GeoRuntimeBoundary><div>Preview</div></GeoRuntimeBoundary>);
  expect(screen.getByText("Preview")).toBeInTheDocument();
  expect(mocks.project).not.toHaveBeenCalled(); expect(mocks.auth).not.toHaveBeenCalled();
});
it.each(["/", "/office", "/authoring-preview-unrelated"])("preserves workspace providers on %s", (path) => {
  mocks.path = path;
  render(<GeoRuntimeBoundary><div>Workspace</div></GeoRuntimeBoundary>);
  expect(mocks.project).toHaveBeenCalled(); expect(mocks.auth).toHaveBeenCalled();
});
