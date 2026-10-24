import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DigestImportSheet } from "./digest-import-sheet";
import { importDigest, previewDigestImport } from "./api";
import type { DigestImportPreview, LibraryItem } from "@/geo/contracts/library";

vi.mock("./api", () => ({ previewDigestImport: vi.fn(), importDigest: vi.fn(), LibraryApiError: class extends Error {} }));
const preview: DigestImportPreview = {
  token: "preview-token", fileName: "briefing.md", mediaType: "text/markdown", size: 100, title: "문헌 비교", headings: ["비교"], excerpt: "# 문헌 비교",
  matches: [{ itemId: "a", title: "First paper about magnetite", authors: "Heo", by: "doi" }, { itemId: "b", title: "Second paper about inversion", authors: "Astic", by: "title" }], unmatched: [{ title: "Unknown reference", doi: "10.1234/unknown" }],
};
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); vi.mocked(previewDigestImport).mockResolvedValue(preview); vi.mocked(importDigest).mockResolvedValue({ item: { id: "digest-a", kind: "digest" } as LibraryItem }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Gemini output import sheet", () => {
  it("previews a chosen file and imports only the researcher-kept paper links", async () => {
    const onImported = vi.fn(), onOpenChange = vi.fn();
    render(<DigestImportSheet open onOpenChange={onOpenChange} onImported={onImported} collectionId="folder" collectionName="포천" notebookUrl="https://notebooklm.google.com/notebook/a" />);
    expect(screen.getByRole("button", { name: "서재에 넣기" })).toBeDisabled();
    const file = new File(["# 문헌 비교"], "briefing.md", { type: "text/markdown" });
    fireEvent.change(screen.getByLabelText("결과 파일"), { target: { files: [file] } });
    await screen.findByText("First paper about magnetite");
    expect(previewDigestImport).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText("정리 이름")).toHaveValue("문헌 비교");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("checkbox", { name: /Second paper/ }));
    fireEvent.click(screen.getByRole("button", { name: "서재에 넣기" }));
    await waitFor(() => expect(importDigest).toHaveBeenCalledWith({ token: "preview-token", title: "문헌 비교", collectionId: "folder", notebookUrl: "https://notebooklm.google.com/notebook/a", covers: ["a"] }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith({ id: "digest-a", kind: "digest" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByText(/외부 정리는 검토 전으로/)).toBeInTheDocument();
  });
  it("reports an unsupported file, permits replacement, and rejects a non-https notebook URL", async () => {
    render(<DigestImportSheet open onOpenChange={vi.fn()} onImported={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("결과 파일"), { target: { files: [new File(["x"], "macro.docm")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("지원하지 않는 파일");
    expect(previewDigestImport).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("결과 파일"), { target: { files: [new File(["# Title"], "a.md")] } });
    await screen.findByText("First paper about magnetite");
    fireEvent.change(screen.getByLabelText("노트북 주소 (선택)"), { target: { value: "http://example.org" } });
    fireEvent.click(screen.getByRole("button", { name: "서재에 넣기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("https 주소");
    expect(importDigest).not.toHaveBeenCalled();
  });
  it("keeps the latest file when an older read resolves later and preserves a dismissed draft", async () => {
    let resolveOld!: (p: DigestImportPreview) => void;
    vi.mocked(previewDigestImport).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const props = { open: true, onOpenChange: vi.fn(), onImported: vi.fn() };
    const view = render(<DigestImportSheet {...props} />);
    const input = screen.getByLabelText("결과 파일");
    fireEvent.change(input, { target: { files: [new File(["old"], "old.md")] } });
    fireEvent.change(input, { target: { files: [new File(["new"], "briefing.md")] } });
    await screen.findByText("First paper about magnetite");
    resolveOld({ ...preview, title: "Old file", token: "old" });
    await waitFor(() => expect(screen.getByLabelText("정리 이름")).toHaveValue("문헌 비교"));
    view.rerender(<DigestImportSheet {...props} open={false} />);
    view.rerender(<DigestImportSheet {...props} />);
    expect(screen.getByLabelText("정리 이름")).toHaveValue("문헌 비교");
  });
});
