import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LibraryItemSummary } from "@/geo/contracts/library";
import { NoteTable, snapshotForLibrary } from "./note-items";
import { onOpenResearchNoteRequest, requestOpenResearchNote, takeOpenResearchNote } from "@/geo/notes/open-note";

const row: LibraryItemSummary = {
  id: "li-aaaaaaaaaaaa", source: "gaid", title: "포천 자력 역산", authors: "", coverage: "full", hasPdf: false, collectionIds: [], tags: [],
  used: { notes: 0, workflows: 0, projects: 0 }, metadataConfirmed: true, addedAt: "2026-10-23T00:00:00Z", kind: "note",
  note: { projectId: "p1", noteId: "2026-10-23-pocheon", projectName: "포천 자철석", originLabel: "pc71", date: "2026-10-23", status: "pending", headline: "자력 이상과 시추 대자율이 맞습니다.", local: false, cites: 2 },
};

beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); });

describe("research notes in 서재", () => {
  it("lists a note with its project, state and cited papers, and marks another PC", () => {
    const onSelect = vi.fn();
    render(<NoteTable rows={[row]} selected={null} onSelect={onSelect} />);
    expect(screen.getByText("자력 이상과 시추 대자율이 맞습니다.")).toBeInTheDocument();
    expect(screen.getByText("포천 자철석")).toBeInTheDocument();
    expect(screen.getByText("다른 PC(pc71)")).toBeInTheDocument();
    expect(screen.getByText("검토 전")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: "포천 자력 역산" }));
    expect(onSelect).toHaveBeenCalledWith("li-aaaaaaaaaaaa");
  });

  it("drops images and project file links from the library copy of a note", () => {
    const text = "---\ntitle: x\n---\n# x\n\n![그림 1](figures/a.png)\n\n- 결과 표: [anomaly.csv](../../derived/a.csv)\n- [원문](https://doi.org/10.1/x)\n";
    const out = snapshotForLibrary(text);
    expect(out).not.toContain("figures/a.png");
    expect(out).toContain("결과 표: anomaly.csv");
    expect(out).toContain("[원문](https://doi.org/10.1/x)");
  });

  it("hands an open request to the workspace of that project only, once", () => {
    const seen = vi.fn();
    const off = onOpenResearchNoteRequest(seen);
    requestOpenResearchNote({ projectId: "p1", noteId: "n1" });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(takeOpenResearchNote("p2")).toBeNull();
    expect(takeOpenResearchNote("p1")).toEqual({ projectId: "p1", noteId: "n1" });
    expect(takeOpenResearchNote("p1")).toBeNull();
    off();
  });
});
