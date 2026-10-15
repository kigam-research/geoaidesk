import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PreviewSourcePane } from "./source-pane";

const viewer = vi.hoisted(() => vi.fn());
vi.mock("@/components/pdf-viewer/pdf-viewer", () => ({ PdfViewer: (props: unknown) => { viewer(props); return <div data-testid="pdf" />; } }));
beforeEach(() => localStorage.setItem("gaid:locale", "en"));

it("uses the real viewer seam with raw URL, fit width, page requests and ready callback", () => {
  const onPdfReady = vi.fn();
  render(<PreviewSourcePane source={{ kind: "local-pdf", name: "paper.pdf" }} sourceUrl="blob:paper"
    pageRequest={{ page: 9, sequence: 1 }} onPdfReady={onPdfReady} />);
  expect(viewer).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "blob:paper", hideAnnotationUi: true,
    initialFitWidth: true, pageRequest: { page: 9, sequence: 1 }, onDocumentReady: onPdfReady }));
});

it("shows honest empty, record-only URL and file-reselection states without mounting a PDF", () => {
  const { rerender } = render(<PreviewSourcePane source={null} sourceUrl={null} pageRequest={{ page: 1, sequence: 0 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Select a PDF");
  rerender(<PreviewSourcePane source={{ kind: "url", name: "Paper URL", reference: "https://example.org/paper" }}
    sourceUrl={null} pageRequest={{ page: 1, sequence: 1 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Remote document fetching is not connected");
  rerender(<PreviewSourcePane source={{ kind: "local-pdf", name: "paper.pdf" }} sourceUrl={null} pageRequest={{ page: 1, sequence: 2 }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Reselect the file");
  expect(viewer).not.toHaveBeenCalled();
});
