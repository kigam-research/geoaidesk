import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageResponse } from "@/components/ai-elements/message";
import { CitationPdfContext } from "./citation-links";
import { pageMissing, useCitationPdf } from "./citation-pdf";

const { resolveCitations } = vi.hoisted(() => ({ resolveCitations: vi.fn() }));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), resolveCitations }));

const md = [
  "니켈 후보지는 선행연구와 같습니다 [@hong2026, p. 3; @kim2025].",
  "",
  "`[@incode, p. 1]` [링크 @x](https://example.org) 문의 a@b.com",
].join("\n");

describe("library citations in Markdown (gaid-cite-open-pdf)", () => {
  it("turns each citation into a button that asks the opener for its key and locator", () => {
    const open = vi.fn().mockResolvedValue(undefined);
    render(<CitationPdfContext.Provider value={{ open }}><MessageResponse mode="static" libraryCitations>{md}</MessageResponse></CitationPdfContext.Provider>);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["@hong2026, p. 3", "@kim2025"]);
    expect(buttons[0]).toHaveAccessibleName("Open the PDF of @hong2026 at p. 3");
    // The brackets and the sentence stay as text around the buttons.
    expect(buttons[0].parentElement?.textContent).toContain("[@hong2026, p. 3; @kim2025].");
    fireEvent.click(buttons[0]);
    expect(open).toHaveBeenCalledWith({ key: "hong2026", locator: "p. 3" });
    fireEvent.click(buttons[1]);
    expect(open).toHaveBeenLastCalledWith({ key: "kim2025", locator: undefined });
    expect(screen.getByRole("link", { name: "링크 @x" })).toBeInTheDocument();
  });

  it("shows why a citation did not open beside it", async () => {
    const open = vi.fn().mockResolvedValue("This citation key is not in your library, so no PDF can be opened. (@kim2025)");
    render(<CitationPdfContext.Provider value={{ open }}><MessageResponse mode="static" libraryCitations>{md}</MessageResponse></CitationPdfContext.Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Open the PDF of @kim2025" }));
    expect(await screen.findByRole("status")).toHaveTextContent("This citation key is not in your library");
  });

  it("stays plain text without an opener or when the renderer does not ask for citations", () => {
    const { unmount } = render(<MessageResponse mode="static" libraryCitations>{md}</MessageResponse>);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByText(/선행연구와 같습니다/).textContent).toContain("[@hong2026, p. 3; @kim2025]");
    unmount();
    render(<CitationPdfContext.Provider value={{ open: vi.fn() }}><MessageResponse mode="static">{md}</MessageResponse></CitationPdfContext.Provider>);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});

describe("useCitationPdf", () => {
  beforeEach(() => { resolveCitations.mockReset(); });

  it("opens a stored PDF at the cited page and repeats the jump on a second press", async () => {
    resolveCitations.mockResolvedValue([{ key: "hong2026", itemId: "li-1", title: "Spatial PU learning", pdf: { pages: 3 } }]);
    const { result } = renderHook(() => useCitationPdf());
    expect(await act(() => result.current.open({ key: "hong2026", locator: "p. 3" }))).toBeUndefined();
    expect(result.current.pdf).toMatchObject({ itemId: "li-1", title: "Spatial PU learning", page: 3, pages: 3 });
    const first = result.current.pdf!.sequence;
    await act(() => result.current.open({ key: "hong2026", locator: "p. 3" }));
    expect(result.current.pdf!.sequence).toBeGreaterThan(first);
  });

  it("says why when the key is unknown, the paper has no PDF or the lookup fails", async () => {
    const { result } = renderHook(() => useCitationPdf());
    resolveCitations.mockResolvedValueOnce([{ key: "ghost1999" }]);
    expect(await act(() => result.current.open({ key: "ghost1999" }))).toContain("not in your library, so no PDF can be opened. (@ghost1999)");
    resolveCitations.mockResolvedValueOnce([{ key: "kim2025", itemId: "li-2", title: "Gravity" }]);
    expect(await act(() => result.current.open({ key: "kim2025", locator: "p. 2" }))).toContain("GAID has no PDF of “Gravity”");
    resolveCitations.mockRejectedValueOnce(new Error("offline"));
    expect(await act(() => result.current.open({ key: "kim2025" }))).toContain("Could not read the library");
    expect(result.current.pdf).toBeNull();
  });

  it("flags a cited page beyond the PDF, also when pdf.js reports the page count", async () => {
    resolveCitations.mockResolvedValue([{ key: "hong2026", itemId: "li-1", title: "T", pdf: {} }]);
    const { result } = renderHook(() => useCitationPdf());
    await act(() => result.current.open({ key: "hong2026", locator: "p. 12" }));
    expect(pageMissing(result.current.pdf!)).toBe(false);
    act(() => result.current.documentReady(8));
    expect(pageMissing(result.current.pdf!)).toBe(true);
  });
});
