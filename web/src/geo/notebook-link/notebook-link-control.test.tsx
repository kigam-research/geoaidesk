import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotebookLinkControl } from "./notebook-link-control";

beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); });
const savedUrl = "https://notebooklm.google.com/notebook/study";

describe("NotebookLinkControl", () => {
  it("opens saved links in an isolated new tab and shows the destination host", () => {
    render(<NotebookLinkControl context="folder" url={savedUrl} onSave={vi.fn()} />);
    const link = screen.getByRole("link", { name: "노트북 열기" });
    expect(link).toHaveAttribute("href", savedUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("title", "notebooklm.google.com");
    expect(screen.getByRole("button", { name: "링크 바꾸기" })).toBeInTheDocument();
  });
  it("saves a normalized link from a small popover", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotebookLinkControl context="project" url={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "노트북 링크 저장" }));
    expect(screen.getByText("프로젝트의 Gemini Notebook 링크")).toBeInTheDocument();
    expect(screen.getByText("GAID는 페이지만 열며 자료를 보내지 않습니다.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: `  ${savedUrl}  ` } });
    fireEvent.click(screen.getByRole("button", { name: "링크 저장" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(savedUrl));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });
  it("keeps invalid input beside the field and never calls onSave", () => {
    const onSave = vi.fn();
    render(<NotebookLinkControl context="folder" url={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "노트북 링크 저장" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "링크 저장" }));
    expect(screen.getByRole("alert")).toHaveTextContent("노트북 주소를 확인하세요.");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("removes only on explicit action and can cancel or Escape without saving", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<NotebookLinkControl context="folder" url={savedUrl} onSave={onSave} />);
    const trigger = screen.getByRole("button", { name: "링크 바꾸기" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "링크 삭제" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
  it("shows a save failure without exposing the server error and keeps the draft", async () => {
    render(<NotebookLinkControl context="folder" url={null} onSave={vi.fn().mockRejectedValue(new Error("Internal path /secret"))} />);
    fireEvent.click(screen.getByRole("button", { name: "노트북 링크 저장" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: savedUrl } });
    fireEvent.click(screen.getByRole("button", { name: "링크 저장" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("링크를 저장하지 못했습니다."));
    expect(screen.getByRole("textbox")).toHaveValue(savedUrl);
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  });
  it("does not render unsafe legacy or synced URLs as links", () => {
    render(<NotebookLinkControl context="folder" url="javascript:alert(1)" onSave={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
