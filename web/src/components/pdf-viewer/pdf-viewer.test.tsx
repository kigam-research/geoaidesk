import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "./pdf-viewer";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(), rawFileUrl: vi.fn(), fetchAnnotations: vi.fn(), subscribeAnnotations: vi.fn(), saveAnnotations: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }));
vi.mock("@/lib/use-sandbox", () => ({ rawFileUrl: mocks.rawFileUrl }));
vi.mock("@/lib/projects", () => ({ useProjectScopeId: () => "context-project" }));
vi.mock("@/lib/pdf-annotations", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/pdf-annotations")>(),
  fetchAnnotations: mocks.fetchAnnotations, subscribeAnnotations: mocks.subscribeAnnotations, saveAnnotations: mocks.saveAnnotations,
}));
vi.mock("./use-pdf-page-rendering", () => ({ usePdfPageRendering: () => ({ pageRef: null, canvasRef: null, textLayerRef: null, viewport: null, size: null }) }));

function makeDocument(pages = 12) {
  return { numPages: pages, getPage: vi.fn(async () => ({ getViewport: () => ({ width: 600, height: 900 }) })), destroy: vi.fn() };
}

beforeEach(() => {
  localStorage.setItem("gaid:locale", "en");
  mocks.rawFileUrl.mockImplementation((path, project) => `/sandbox/raw?path=${encodeURIComponent(path)}&project=${project}`);
  mocks.fetchAnnotations.mockResolvedValue({ doc: { version: 1, annotations: [] }, lastModified: null, etag: null });
  mocks.subscribeAnnotations.mockReturnValue(vi.fn());
  mocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve(makeDocument()) }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("/* worker */"));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("PDF raw source seam", () => {
  it("loads raw blob URLs without sandbox resolution or any annotation API and retains functional navigation/zoom", async () => {
    const ready = vi.fn();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<PdfViewer path="paper.pdf" sourceUrl="blob:local-paper" onDocumentReady={ready} />);
    await waitFor(() => expect(ready).toHaveBeenCalledWith(12));
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: "blob:local-paper" }));
    expect(mocks.rawFileUrl).not.toHaveBeenCalled();
    expect(mocks.fetchAnnotations).not.toHaveBeenCalled();
    expect(mocks.subscribeAnnotations).not.toHaveBeenCalled();
    expect(mocks.saveAnnotations).not.toHaveBeenCalled();
    expect(screen.getByRole("link")).toHaveAttribute("href", "blob:local-paper");
    expect(screen.queryByText("Add note")).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll("[data-pdf-page]")).toHaveLength(12));
    const page = screen.getByRole("textbox");
    fireEvent.change(page, { target: { value: "3" } });
    fireEvent.submit(page.closest("form")!);
    expect(scroll.mock.instances.at(-1)).toHaveAttribute("data-pdf-page", "3");
    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(screen.getByText("110%")).toBeInTheDocument();
  });

  it("preserves legacy scoped sandbox URLs, cache-busting, annotation loading and polling", async () => {
    render(<PdfViewer path="folder/paper.pdf" projectId="explicit-project" reloadToken={7} />);
    await waitFor(() => expect(mocks.getDocument).toHaveBeenCalled());
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: "/sandbox/raw?path=folder%2Fpaper.pdf&project=explicit-project&_r=7" }));
    expect(mocks.fetchAnnotations).toHaveBeenCalledWith("folder/paper.pdf", "explicit-project");
    expect(mocks.subscribeAnnotations).toHaveBeenCalledWith("folder/paper.pdf", null, expect.any(Function), 3000, "explicit-project");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/sandbox/raw?path=folder%2Fpaper.pdf&project=explicit-project");
  });

  it("queues page requests through document load and reapplies only for a new sequence, not zoom", async () => {
    let resolve!: (doc: ReturnType<typeof makeDocument>) => void;
    mocks.getDocument.mockReturnValue({ promise: new Promise((done) => { resolve = done; }) });
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const ready = vi.fn();
    const { rerender } = render(<PdfViewer path="paper.pdf" sourceUrl="/sample.pdf" pageRequest={{ page: 9, sequence: 1 }} onDocumentReady={ready} />);
    await waitFor(() => expect(mocks.getDocument).toHaveBeenCalled());
    expect(scroll).not.toHaveBeenCalled();
    await act(async () => resolve(makeDocument()));
    await waitFor(() => expect(scroll).toHaveBeenCalledOnce());
    expect(scroll.mock.instances.at(-1)).toHaveAttribute("data-pdf-page", "9");
    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(scroll).toHaveBeenCalledOnce();
    rerender(<PdfViewer path="paper.pdf" sourceUrl="/sample.pdf" pageRequest={{ page: 9, sequence: 2 }} onDocumentReady={vi.fn()} />);
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(mocks.getDocument).toHaveBeenCalledOnce();
    rerender(<PdfViewer path="paper.pdf" sourceUrl="/sample.pdf" pageRequest={{ page: 99, sequence: 3 }} />);
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("exposes a recoverable loading/error state for a rejected raw PDF", async () => {
    mocks.getDocument.mockReturnValue({ promise: Promise.reject(new Error("invalid PDF")) });
    render(<PdfViewer path="bad.pdf" sourceUrl="blob:bad" />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading PDF");
    expect(await screen.findByRole("alert")).toHaveTextContent("Select another PDF");
    expect(mocks.fetchAnnotations).not.toHaveBeenCalled();
  });
});
