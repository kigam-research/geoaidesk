import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LibraryItemSummary } from "@/geo/contracts/library";
import { LibrarySourcePicker } from "./library-picker";

const { listLibrary } = vi.hoisted(() => ({ listLibrary: vi.fn() }));
vi.mock("@/geo/library/api", () => ({ listLibrary }));
const paper: LibraryItemSummary = { id: "paper", title: "지하수 유동 연구", authors: "김민수", year: 2026, kind: "paper", source: "gaid", hasPdf: true,
  collectionIds: [], tags: [], used: { notes: 0, workflows: 0, projects: 0 }, coverage: "full", metadataConfirmed: true, addedAt: "2026-10-24" };
const note: LibraryItemSummary = { ...paper, id: "note", kind: "note", title: "포천 연구 정리", note: { projectId: "p", noteId: "n", projectName: "포천 조사", date: "2026-10-23", local: true, originLabel: "local", status: "pending", cites: 1 } };
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); vi.clearAllMocks(); listLibrary.mockResolvedValue({ items: [paper, note] }); });

describe("library source side panel", () => {
  it("renders a non-modal inspector, keeps cross-category selections, and adds both sources", async () => {
    const add = vi.fn().mockResolvedValue(undefined), close = vi.fn();
    render(<LibrarySourcePicker open onOpenChange={close} onAdd={add} />);
    expect(screen.getByRole("complementary", { name: "서재에서 자료 고르기" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("checkbox", { name: /지하수 유동 연구/ }));
    fireEvent.click(screen.getByRole("button", { name: "정리 노트 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /포천 연구 정리/ }));
    expect(screen.getByText("2개 고름")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "자료 2개 더하기" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith(["paper", "note"]));
    expect(close).toHaveBeenCalledWith(false);
  });

  it("searches, focuses its field, and closes with Escape", async () => {
    const close = vi.fn();
    render(<LibrarySourcePicker open onOpenChange={close} onAdd={vi.fn()} />);
    await screen.findByRole("checkbox", { name: /지하수 유동 연구/ });
    const input = screen.getByRole("textbox"); expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "없는 제목" } });
    expect(screen.getByText("맞는 항목이 없습니다.")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" }); expect(close).toHaveBeenCalledWith(false);
  });

  it("keeps the panel and selection when adding fails, without exposing internal errors", async () => {
    const add = vi.fn().mockRejectedValue(new Error("internal private path")), close = vi.fn();
    render(<LibrarySourcePicker open onOpenChange={close} onAdd={add} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /지하수 유동 연구/ }));
    fireEvent.click(screen.getByRole("button", { name: "자료 1개 더하기" }));
    expect(await screen.findByText("자료를 넣지 못했습니다. 다시 시도하세요.")).toBeInTheDocument();
    expect(screen.queryByText(/internal private/)).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
