import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LibraryItemSummary } from "@/geo/contracts/library";
import { ProjectLibraryPanel } from "./project-library-panel";
import { OPEN_LIBRARY_EVENT } from "@/geo/places/navigation";

const { listLibrary, attachToProject, getLibraryItem, getDigestCandidates } = vi.hoisted(() => ({ listLibrary: vi.fn(), attachToProject: vi.fn(), getLibraryItem: vi.fn(), getDigestCandidates: vi.fn() }));
vi.mock("./api", () => ({ listLibrary, attachToProject, getLibraryItem, getDigestCandidates }));
const paper: LibraryItemSummary = {
  id: "p1", title: "포천 자력 이상 연구", authors: "김민수 외", year: 2025, citationKey: "kim2025", source: "gaid", kind: "paper",
  storedPdf: true, hasPdf: true, coverage: "full", collectionIds: ["folder"], tags: [], used: { notes: 8, workflows: 0, projects: 2 }, metadataConfirmed: true, addedAt: "2026-10-24",
};
const other = { ...paper, id: "p2", title: "단층의 수리 특성", authors: "이민수 외", citationKey: undefined };
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.clearAllMocks();
  listLibrary.mockImplementation(async (q) => ({ total: q.filter === "project" ? 1 : 2, items: q.filter === "project" ? [paper] : [paper, other] }));
  getLibraryItem.mockRejectedValue(new Error("not available"));
  getDigestCandidates.mockResolvedValue({ digests: [] });
  attachToProject.mockResolvedValue({ itemIds: ["p1", "p2"], collectionIds: [] });
});

describe("project library inspector", () => {
  it("reads the explicit project scope, selects a paper, and opens its PDF at page 1", async () => {
    const open = vi.fn();
    render(<ProjectLibraryPanel projectId="project-a" onOpenPdf={open} />);
    fireEvent.click(await screen.findByRole("button", { name: /포천 자력 이상 연구/ }));
    expect(listLibrary).toHaveBeenCalledWith(expect.objectContaining({ filter: "project", kind: "paper" }), "project-a");
    expect(screen.getByRole("button", { name: "프로젝트 문헌 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "PDF 열기 1쪽" }));
    expect(open).toHaveBeenCalledWith(paper, 1);
    expect(screen.queryByText(/8회/)).not.toBeInTheDocument(); // Global counts must not masquerade as project counts.
  });

  it("adds a whole-library paper to the current project and links its full-screen detail", async () => {
    const full = vi.fn(); window.addEventListener(OPEN_LIBRARY_EVENT, full);
    render(<ProjectLibraryPanel projectId="project-b" onOpenPdf={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "전체 서재" }));
    fireEvent.click(await screen.findByRole("button", { name: /단층의 수리 특성/ }));
    fireEvent.click(screen.getByRole("button", { name: "프로젝트에 넣기" }));
    await waitFor(() => expect(attachToProject).toHaveBeenCalledWith("project-b", "p2"));
    expect(await screen.findByRole("button", { name: "프로젝트에 넣음" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "서재 전체 화면" }));
    expect(full.mock.calls[0][0].detail).toEqual({ itemId: "p2" });
    window.removeEventListener(OPEN_LIBRARY_EVENT, full);
  });

  it("keeps a cited page and searches the server instead of only the visible rows", async () => {
    const open = vi.fn();
    render(<ProjectLibraryPanel projectId="a" selectedId="p1" citedPage={6} onOpenPdf={open} />);
    // The citation can precede the list; its detail lookup may fail while the scope list still resolves it.
    fireEvent.click(await screen.findByRole("button", { name: "PDF 열기 6쪽" }));
    expect(open).toHaveBeenCalledWith(paper, 6);
    fireEvent.change(screen.getByRole("textbox", { name: "제목, 저자로 찾기" }), { target: { value: "시추" } });
    await waitFor(() => expect(listLibrary).toHaveBeenCalledWith(expect.objectContaining({ q: "시추", offset: 0 }), "a"));
  });

  it("selects the cited paper again when the same citation is pressed after browsing another paper", async () => {
    const { rerender } = render(<ProjectLibraryPanel projectId="a" selectedId="p1" citationSequence={1} onOpenPdf={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "전체 서재" }));
    fireEvent.click(await screen.findByRole("button", { name: /단층의 수리 특성/ }));
    expect(screen.getByRole("button", { name: /단층의 수리 특성/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "제목, 저자로 찾기" }), { target: { value: "단층" } });
    await waitFor(() => expect(listLibrary).toHaveBeenCalledWith(expect.objectContaining({ q: "단층" }), "a"));
    expect(await screen.findByRole("button", { name: /단층의 수리 특성/ })).toHaveAttribute("aria-pressed", "true");
    rerender(<ProjectLibraryPanel projectId="a" selectedId="p1" citationSequence={2} onOpenPdf={vi.fn()} />);
    expect(screen.getByRole("button", { name: /포천 자력 이상 연구/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a readable failure and allows retry without exposing a raw server error", async () => {
    listLibrary.mockRejectedValue(new Error("/private/cache internal stack"));
    render(<ProjectLibraryPanel projectId="a" onOpenPdf={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("문헌을 읽지 못했습니다");
    expect(screen.queryByText(/private/)).not.toBeInTheDocument();
    listLibrary.mockResolvedValue({ total: 1, items: [paper] });
    fireEvent.click(screen.getByRole("button", { name: "다시 읽기" }));
    expect(await screen.findByRole("button", { name: /포천 자력 이상 연구/ })).toBeInTheDocument();
  });
});
