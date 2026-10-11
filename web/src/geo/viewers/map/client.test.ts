import { afterEach, expect, it, vi } from "vitest";
import { mapPost } from "./client";
import { apiFetch } from "@/lib/projects";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); });
it("retries only a busy reader and retains project and abort scope", async () => {
  vi.useFakeTimers();
  const signal = new AbortController().signal;
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "busy" }), { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify({ scope: "full-layer" })));
  const pending = mapPost("/geo/area-table", { path: "x.gpkg" }, "p", signal);
  await vi.runAllTimersAsync(); expect(await pending).toEqual({ scope: "full-layer" });
  expect(apiFetch).toHaveBeenCalledTimes(2); expect(apiFetch).toHaveBeenLastCalledWith("/geo/area-table", expect.objectContaining({ signal }), "p");
});
it("does not repeat an invalid source request", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "missing CRS" }), { status: 422 }));
  await expect(mapPost("/geo/area-table", {}, "p", new AbortController().signal)).rejects.toThrow("missing CRS"); expect(apiFetch).toHaveBeenCalledTimes(1);
});
it("a cancelled project/file never issues its queued retry", async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  vi.mocked(apiFetch).mockImplementationOnce(async () => { controller.abort(); return new Response(JSON.stringify({ detail: "busy" }), { status: 429 }); });
  const outcome = expect(mapPost("/geo/vector-page", {}, "p", controller.signal)).rejects.toThrow();
  await vi.runAllTimersAsync(); await outcome; expect(apiFetch).toHaveBeenCalledTimes(1);
});
