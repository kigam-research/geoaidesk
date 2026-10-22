import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import type { LibrarySyncStatus } from "@/geo/contracts/hub-server";
import { LibrarySyncLine } from "@/geo/library/sync-line";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
let status: LibrarySyncStatus;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  vi.clearAllMocks(); localStorage.setItem("gaid:locale", "ko");
  status = { available: true, running: false, lastSyncedAt: "2026-10-22T02:00:00Z", pending: { items: 2, folders: 1, files: 3 }, conflicts: 2 };
  vi.mocked(apiFetch).mockImplementation(async (_, init) => init?.method === "POST" ? json({ status: { ...status, pending: { items: 0, folders: 0, files: 0 } } }) : json(status));
});
it("is absent without an account and shows pending/conflict counts when available", async () => {
  status.available = false; const { rerender } = render(<LibrarySyncLine refreshKey={0} />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled()); expect(screen.queryByRole("button")).not.toBeInTheDocument();
  status.available = true; rerender(<LibrarySyncLine refreshKey={1} />);
  expect(await screen.findByRole("status")).toHaveTextContent("대기 6개, 충돌 보관 2개");
});
it("syncs through the local backend, refreshes the library, and prevents duplicate requests", async () => {
  const onSynced = vi.fn(); let resolve!: (response: Response) => void;
  const impl = vi.mocked(apiFetch).getMockImplementation()!;
  vi.mocked(apiFetch).mockImplementation((p, init) => init?.method === "POST" ? new Promise(r => { resolve = r; }) : impl(p, init));
  render(<LibrarySyncLine onSynced={onSynced} />); fireEvent.click(await screen.findByRole("button", { name: "지금 동기화" }));
  expect(screen.getByRole("button", { name: "서재 동기화 중" })).toBeDisabled();
  resolve(json({ status: { ...status, pending: { items: 0, folders: 0, files: 0 } } }));
  await waitFor(() => expect(onSynced).toHaveBeenCalledOnce()); expect(screen.getByRole("status")).toHaveTextContent("대기 0개");
});
it("shows a sync error next to retry and keeps technical details collapsed", async () => {
  const impl = vi.mocked(apiFetch).getMockImplementation()!;
  vi.mocked(apiFetch).mockImplementation(async (p, init) => init?.method === "POST" ? json({ error: "private sync detail" }, 502) : impl(p, init));
  render(<LibrarySyncLine />); fireEvent.click(await screen.findByRole("button", { name: "지금 동기화" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("서재를 동기화하지 못했습니다");
  expect(screen.getByText("private sync detail").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByRole("button", { name: "지금 동기화" })).toBeEnabled();
});
it("disables manual sync while the backend is already syncing", async () => {
  status.running = true; render(<LibrarySyncLine />); expect(await screen.findByRole("button", { name: "서재 동기화 중" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("충돌 보관 2개");
});
