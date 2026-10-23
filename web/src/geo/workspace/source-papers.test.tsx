import { renderHook, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowPaper } from "@/geo/contracts/library";

const papers: WorkflowPaper[] = [
  { ref: "10.1190/geo", title: "PGI ore body", doi: "10.1190/geo", state: "in-library", itemId: "li-aaaaaaaaaaaa", itemTitle: "PGI ore body", citationKey: "heo2025", matchedBy: "doi" },
  { ref: "astic.pdf", title: "Guided inversion", state: "attached", itemId: "li-bbbbbbbbbbbb", citationKey: "astic2020", matchedBy: "title" },
  { ref: "10.5555/x", title: "Missing paper", doi: "10.5555/x", state: "not-in-library" },
];
const getWorkflowPapers = vi.fn(async () => ({ method: "pgi", papers }));
const attachWorkflowPapers = vi.fn(async () => ({ method: "pgi", added: ["li-aaaaaaaaaaaa"], papers: papers.map((p) => (p.state === "in-library" ? { ...p, state: "attached" as const } : p)) }));
vi.mock("@/geo/library/api", () => ({ getWorkflowPapers: (...a: unknown[]) => getWorkflowPapers(...(a as [])), attachWorkflowPapers: (...a: unknown[]) => attachWorkflowPapers(...(a as [])) }));
vi.mock("@/geo/library/add-paper-dialog", () => ({ AddPaperDialog: ({ open, initialDoi }: { open: boolean; initialDoi?: string }) => (open ? <p>논문 넣기 {initialDoi}</p> : null) }));

const { SourcePapers, citablePapers, useWorkflowPapers } = await import("./source-papers");

beforeEach(() => { window.localStorage.clear(); Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] }); getWorkflowPapers.mockClear(); attachWorkflowPapers.mockClear(); });

describe("Workflow source papers in the start window", () => {
  it("loads nothing for a Workflow that is not an installed method", () => {
    renderHook(() => useWorkflowPapers("p1", null));
    expect(getWorkflowPapers).not.toHaveBeenCalled();
  });

  it("attaches only after the researcher's action and names attached papers for the start message", async () => {
    const { result } = renderHook(() => useWorkflowPapers("p1", "pgi"));
    await waitFor(() => expect(result.current.papers).toHaveLength(3));
    expect(attachWorkflowPapers).not.toHaveBeenCalled();
    expect(citablePapers(result.current)).toEqual([{ key: "astic2020", title: "Guided inversion" }]);

    const view = render(<SourcePapers state={result.current} />);
    expect(screen.getByText(/서재에 있음/)).toBeInTheDocument();
    expect(screen.getByText(/제목으로 찾음/)).toBeInTheDocument();
    expect(screen.getByText("서재에 없는 논문 1편은 서재에 넣은 뒤 붙일 수 있습니다.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "서재에 넣기" }));
    expect(screen.getByText("논문 넣기 10.5555/x")).toBeInTheDocument();

    await act(async () => { await userEvent.click(screen.getByRole("button", { name: "근거 논문 1편 붙이기" })); });
    expect(attachWorkflowPapers).toHaveBeenCalledWith("p1", "pgi", ["li-aaaaaaaaaaaa"]);
    view.rerender(<SourcePapers state={result.current} />);
    expect(citablePapers(result.current).map((p) => p.key)).toEqual(["heo2025", "astic2020"]);
    expect(screen.queryByRole("button", { name: /붙이기/ })).toBeNull();
  });
});
