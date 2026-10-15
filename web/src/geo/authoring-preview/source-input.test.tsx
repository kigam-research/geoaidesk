import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PREVIEW_PDF_BYTES, PreviewSourceInput } from "./source-input";

beforeEach(() => localStorage.setItem("gaid:locale", "en"));

function setup() {
  const callbacks = { onSample: vi.fn(), onPdfFile: vi.fn(), onUrl: vi.fn(), onClear: vi.fn() };
  render(<PreviewSourceInput source={{ kind: "local-pdf", name: "original.pdf" }} {...callbacks} />);
  const choose = (file: File) => fireEvent.change(screen.getByLabelText("Source PDF file"), { target: { files: [file] } });
  return { ...callbacks, choose };
}

describe("source input boundary", () => {
  it("records only HTTP/HTTPS URLs without fetching them", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { onUrl } = setup();
    const input = screen.getByLabelText("Paper or source URL");
    for (const url of ["not a URL", "javascript:alert(1)", "file:///tmp/paper.pdf", "ftp://example.org/paper.pdf"]) {
      fireEvent.change(input, { target: { value: url } });
      fireEvent.click(screen.getByRole("button", { name: "Add URL" }));
      expect(screen.getByRole("alert")).toHaveTextContent("URL format is invalid");
      expect(onUrl).not.toHaveBeenCalled();
    }
    for (const url of ["https://example.org/paper", "http://example.org/paper"]) {
      fireEvent.change(input, { target: { value: ` ${url} ` } });
      fireEvent.submit(input.closest("form")!);
      expect(onUrl).toHaveBeenLastCalledWith(url);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("checks extension and MIME, and rejects empty or oversized PDFs without replacing the current source", () => {
    const { choose, onPdfFile } = setup();
    const oversized = new File(["content"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_PREVIEW_PDF_BYTES + 1 });
    for (const file of [
      new File(["content"], "paper.txt", { type: "application/pdf" }),
      new File(["content"], "paper.pdf", { type: "text/plain" }),
      new File([], "empty.pdf", { type: "application/pdf" }), oversized,
    ]) {
      choose(file);
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onPdfFile).not.toHaveBeenCalled();
      expect(screen.getByText("original.pdf")).toBeInTheDocument();
    }
  });

  it("accepts nonempty PDFs with declared or absent MIME, including the size boundary and reselection", () => {
    const { choose, onPdfFile } = setup();
    const boundary = new File(["content"], "PAPER.PDF", { type: "application/pdf" });
    Object.defineProperty(boundary, "size", { value: MAX_PREVIEW_PDF_BYTES });
    const noMime = new File(["content"], "paper.pdf");
    for (const file of [boundary, noMime, noMime]) {
      choose(file);
      expect(onPdfFile).toHaveBeenLastCalledWith(file);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
    expect(onPdfFile).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText("Source PDF file")).toHaveValue("");
  });

  it("delegates the explicit sample and clear actions", () => {
    const { onSample, onClear } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open sample manuscript" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove source original.pdf" }));
    expect(onSample).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });
});
