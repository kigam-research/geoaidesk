import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ConnectionMapPane } from "./connection-map-pane";
import { fetchConnections } from "./api";
import { fixture } from "./fixture";
vi.mock("./api", () => ({ fetchConnections: vi.fn() }));
vi.mock("@xyflow/react", async importOriginal => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual, ReactFlow: () => <div data-testid="graph" /> };
});
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); vi.mocked(fetchConnections).mockResolvedValue(fixture); });
it("selects without navigation, opens explicitly, recentres and changes depth from its accessible list", async () => {
  const onOpenPaper = vi.fn();
  render(<ConnectionMapPane projectId="project-a" focus="note:n" onOpenPaper={onOpenPaper} onClose={() => {}} />);
  await screen.findByTestId("graph");
  fireEvent.click(screen.getByRole("tab", { name: "목록" }));
  fireEvent.click(screen.getByRole("button", { name: /근거 논문/ }));
  expect(onOpenPaper).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "논문 열기" }));
  expect(onOpenPaper).toHaveBeenCalledWith("p");
  fireEvent.click(screen.getByRole("button", { name: "선택한 항목 중심으로 보기" }));
  await waitFor(() => expect(fetchConnections).toHaveBeenLastCalledWith("project-a", "paper:p", 1, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "2단계" }));
  await waitFor(() => expect(fetchConnections).toHaveBeenLastCalledWith("project-a", "paper:p", 2, expect.any(AbortSignal)));
});
it("shows a recoverable loading error without the raw error", async () => {
  vi.mocked(fetchConnections).mockRejectedValueOnce(new Error("private machinery"));
  render(<ConnectionMapPane projectId="project-a" focus="note:n" onClose={() => {}} />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private machinery");
  fireEvent.click(screen.getByRole("button", { name: "연결 다시 읽기" }));
  await screen.findByTestId("graph");
});
