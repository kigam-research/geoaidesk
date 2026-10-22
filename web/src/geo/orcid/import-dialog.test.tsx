import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrcidImportDialog } from "./import-dialog";
import { ORCID_LIMITS, type OrcidWork } from "@/geo/contracts/orcid";
import { defaultSelection, selectNew } from "./selection";
import { confirmOrcidWorks, previewOrcidWorks, OrcidApiError } from "./api";

vi.mock("./api", async (importOriginal) => ({ ...await importOriginal<typeof import("./api")>(), confirmOrcidWorks: vi.fn(), previewOrcidWorks: vi.fn() }));
const work = (putCode: number, match: OrcidWork["match"] = { kind: "new" }): OrcidWork => ({ putCode, title: `Paper ${putCode}`, year: 2024, type: "journal-article", sources: ["Crossref"], match });
const works = [work(1), work(2, { kind: "in-library", itemId: "li-a", title: "Existing", ownWork: false }), work(3, { kind: "similar", itemId: "li-b", title: "Similar existing paper" }), work(4, { kind: "in-library", itemId: "li-c", title: "Own", ownWork: true })];
const preview = { orcid: "0000-0002-1825-0097", works, omitted: 1, readAt: "2026-10-22T00:00:00Z" };

beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); vi.mocked(previewOrcidWorks).mockResolvedValue(preview); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ORCID import decisions", () => {
  it("does not preselect similar or already-own works and caps requests", () => {
    expect(defaultSelection(works)).toEqual([1, 2]);
    expect(selectNew(works)).toEqual([1]);
    expect(defaultSelection(Array.from({ length: 250 }, (_, i) => work(i))).length).toBe(ORCID_LIMITS.confirm);
  });
  it("keeps researcher choices on close, submits only kept works, and explains metadata fallback", async () => {
    let finish!: (value: Awaited<ReturnType<typeof confirmOrcidWorks>>) => void;
    vi.mocked(confirmOrcidWorks).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const changed = vi.fn();
    const props = { collections: [], onOpenChange: vi.fn(), onImported: changed };
    const { rerender } = render(<OrcidImportDialog {...props} open />);
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes[0]).toBeChecked(); expect(boxes[1]).toBeChecked(); expect(boxes[2]).not.toBeChecked(); expect(boxes[3]).toBeDisabled();
    fireEvent.click(boxes[0]);
    rerender(<OrcidImportDialog {...props} open={false} />);
    rerender(<OrcidImportDialog {...props} open />);
    expect((await screen.findAllByRole("checkbox"))[0]).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "1편 가져오기" }));
    expect(confirmOrcidWorks).toHaveBeenCalledWith({ putCodes: [2], collectionId: undefined });
    expect(screen.getByRole("button", { name: "논문 가져오는 중" })).toBeDisabled();
    await act(async () => { finish({ outcomes: [], added: 0, marked: 1, failed: 0, lookupFailed: 1 }); });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ORCID 기록으로 채웠습니다/)).toBeInTheDocument();
  });
  it("provides retry after an unreachable ORCID record", async () => {
    vi.mocked(previewOrcidWorks).mockRejectedValueOnce(new OrcidApiError("upstream 502", 502));
    render(<OrcidImportDialog open onOpenChange={vi.fn()} collections={[]} onImported={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ORCID에서 읽지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "다시 읽기" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(4));
  });
});
