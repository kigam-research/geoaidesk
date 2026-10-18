const remoteComputeFeature = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/geo/features", () => ({ get REMOTE_COMPUTE_ENABLED() { return remoteComputeFeature.enabled; } }));
import React, { Suspense, useEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: (loader: () => Promise<React.ComponentType>) => {
  const Lazy = React.lazy(async () => ({ default: await loader() }));
  return (props: object) => <Suspense fallback={<div>Loading</div>}><Lazy {...props} /></Suspense>;
} }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
// Keep the real editor components and their draft/save state; substitute only
// CodeMirror's browser DOM with a textarea that retains its own document.
vi.mock("@uiw/react-codemirror", async (original) => ({
  ...await original<object>(),
  default: function Editor({ value, onChange, readOnly }: { value: string; onChange: (s: string) => void; readOnly?: boolean }) {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    return <textarea aria-label={readOnly ? "Viewer" : "Editor"} value={text} onChange={(event) => {
      setText(event.target.value);
      onChange?.(event.target.value);
    }} />;
  },
}));
vi.mock("@/components/ai-elements/message", () => ({ MessageResponse: () => null }));
vi.mock("@/components/pdf-viewer/pdf-viewer", () => ({ PdfViewer: () => null }));
vi.mock("@/components/file-icon", () => ({ KadyFileIcon: () => null }));
vi.mock("@/components/lab-notebook-view", () => ({ LabNotebookView: () => null }));
vi.mock("@/components/modal-jobs-panel", () => ({ ModalJobsPanel: () => null }));
vi.mock("@/components/automation-panel", () => ({ AutomationPanel: () => null }));
vi.mock("@/components/provenance-panel", () => ({ ProvenancePanel: () => null }));
vi.mock("./csv-viewer", () => ({ CsvViewer: () => null }));
import { FilePreviewPanel } from "./file-preview-panel";

function panelProps(path = "a.txt"): React.ComponentProps<typeof FilePreviewPanel> {
  return {
    projectId: "project-a",
    tabs: [{ path, content: "original A", loading: false }, { path: "b.txt", content: "original B", loading: false }],
    activeTabPath: path, onTabSelect: vi.fn(), onTabClose: vi.fn(), onDownload: vi.fn(),
    onSaveText: vi.fn(async () => true), onSaveImageBlob: vi.fn(async () => true),
    onCompileLatex: vi.fn(), showNotebook: false, onSelectNotebook: vi.fn(), showCompute: false,
    onSelectCompute: vi.fn(), computeSessionId: null, computeScope: "project", onComputeScopeChange: vi.fn(),
    onOpenComputeOutput: vi.fn(), notebookSessionId: null, notebookEntries: [], notebookStreaming: false,
    notebookSubagentCompletions: 0, onOpenNotebookFile: vi.fn(),
  };
}

afterEach(() => vi.restoreAllMocks());

// The editor loads lazily; its first dynamic import can exceed the default 1 s
// wait when the full suite runs on parallel workers.
const EDITOR_WAIT = { timeout: 4000 };

it("hides the compute tab and ignores persisted compute navigation when disabled", () => {
  remoteComputeFeature.enabled = false;
  try {
    render(<FilePreviewPanel {...panelProps()} showCompute={true} tabs={[]} activeTabPath={null} />);
    expect(screen.queryByTitle("Modal compute")).not.toBeInTheDocument();
    expect(screen.getByText("No file selected")).toBeInTheDocument();
  } finally { remoteComputeFeature.enabled = true; }
});

it.each(["a.txt", "a.tex"])("retains %s draft across file, notebook, compute, and project navigation", async (path) => {
  const props = panelProps(path);
  const { rerender } = render(<FilePreviewPanel {...props} />);
  fireEvent.click(screen.getByTitle("Edit file"));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editor" }, EDITOR_WAIT), { target: { value: "valuable unsaved A" } });
  expect(screen.queryByTitle("Where this file came from")).toBeNull();
  for (const change of [{ activeTabPath: "b.txt" }, { showNotebook: true }, { showCompute: true }, { isActive: false }]) {
    rerender(<FilePreviewPanel {...props} {...change} />);
    expect(screen.queryByRole("textbox", { name: "Editor" })).toBeNull();
    rerender(<FilePreviewPanel {...props} />);
    expect((await screen.findByRole("textbox", { name: "Editor" }, EDITOR_WAIT) as HTMLTextAreaElement).value).toBe("valuable unsaved A");
  }
  expect(props.onSaveText).not.toHaveBeenCalled();
  // The surviving editor saves through its owning workspace's callback/path.
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Save$|^Save / })); });
  expect(props.onSaveText).toHaveBeenCalledWith(path, "valuable unsaved A");
});

it("requires confirmation to close a dirty file tab or text editor", async () => {
  const props = panelProps();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<FilePreviewPanel {...props} />);
  fireEvent.click(screen.getByTitle("Edit file"));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editor" }, EDITOR_WAIT), { target: { value: "unsaved" } });
  fireEvent.click(screen.getAllByTitle("Close tab")[0]);
  expect(props.onTabClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
  expect(screen.getByRole("textbox", { name: "Editor" })).toBeTruthy();
  expect(confirm).toHaveBeenCalledTimes(2);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getAllByTitle("Close tab")[0]);
  expect(props.onTabClose).toHaveBeenCalledWith("a.txt");
});

it("retains annotations across navigation and treats a new stroke after saving as dirty", async () => {
  const props = panelProps("a.png");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.spyOn(window, "Image").mockImplementation(function Image() {
    const image = { naturalWidth: 100, naturalHeight: 100, onload: null as (() => void) | null, onerror: null };
    Object.defineProperty(image, "src", { set: () => { queueMicrotask(() => image.onload?.()); } });
    return image as unknown as HTMLImageElement;
  } as unknown as typeof Image);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["image"])));
  const { container, rerender } = render(<FilePreviewPanel {...props} />);
  await act(async () => { fireEvent.click(screen.getByTitle("Annotate with red marker")); });
  const canvas = container.querySelector("canvas")!;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
  fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.mouseUp(canvas);
  expect(screen.getByText("1 stroke")).toBeTruthy();
  rerender(<FilePreviewPanel {...props} showNotebook />);
  rerender(<FilePreviewPanel {...props} />);
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(screen.getByText("1 stroke")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
  expect(props.onSaveImageBlob).toHaveBeenCalledWith("a.png", expect.any(Blob));
  fireEvent.mouseDown(canvas, { clientX: 20, clientY: 20 });
  fireEvent.mouseUp(canvas);
  fireEvent.click(screen.getAllByTitle("Close tab")[0]);
  expect(confirm).toHaveBeenCalled();
  expect(props.onTabClose).not.toHaveBeenCalled();
});

// GeoAIDesk (gaid-system-ui-followups): a 413 tab is its own state, never a table of the notice text or an edit target.
it("shows a size-limited CSV as a preview-limit state with a first-rows sample and no edit", async () => {
  const props = panelProps("big.csv");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url).endsWith("/geo/inspect") ? new Response(JSON.stringify({
    schemaVersion: "geo-inspection/v1",
    asset: { projectId: "project-a", path: "big.csv", sourceFiles: ["big.csv"], format: "csv", family: "table", sizeBytes: 16031273, fingerprint: "f" },
    issues: [], columns: [{ name: "X" }, { name: "Y" }, { name: "Ni" }],
    preview: { sampled: true, truncated: true, rows: [["1", "2", "0.5"]], displayedRows: 1, sourceRows: 52000 },
  }), { status: 200 }) : new Response("{}", { status: 404 }));
  render(<FilePreviewPanel {...props} tabs={[{ path: "big.csv", content: "[Error: too large]", loading: false, previewLimited: true }]} />);
  expect(screen.getByText("This file is larger than the preview limit")).toBeInTheDocument();
  expect(await screen.findByRole("columnheader", { name: "Ni" })).toBeInTheDocument();
  expect(screen.getByText(/about 52,?000 rows in total \(estimate\)/)).toBeInTheDocument();
  expect(screen.queryByText("Retry")).toBeNull();
  expect(screen.queryByTitle("Edit file")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Download file" }));
  expect(props.onDownload).toHaveBeenCalledWith("big.csv");
  expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith("/geo/inspect"))).toBe(true);
});

it("offers no edit for a tab whose load failed", () => {
  render(<FilePreviewPanel {...panelProps()} tabs={[{ path: "a.txt", content: "[Error: Could not load file — click to retry]", loading: false }]} />);
  expect(screen.queryByTitle("Edit file")).toBeNull();
});
