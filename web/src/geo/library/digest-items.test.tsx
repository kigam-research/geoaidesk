import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LibraryItem, LibraryItemResponse, LibraryItemSummary } from "@/geo/contracts/library";
import { DigestItemDetail, DigestTable } from "./digest-items";
import { DigestMakeSheet } from "./digest-make-sheet";
import { onDigestChatRequest, takeDigestChat } from "./digest-handoff";
import { DigestRequestCard, parseDigestRequest } from "./digest-request-card";

const api = vi.hoisted(() => ({
  setDigestStatus: vi.fn(), removeLibraryItem: vi.fn(), attachToProject: vi.fn(), checkFolder: vi.fn(), listLibrary: vi.fn(), makeDigest: vi.fn(),
  LibraryApiError: class extends Error { status = 0; },
}));
vi.mock("./api", () => api);
vi.mock("./item-folders", () => ({ ItemFolders: () => null }));
vi.mock("@/components/ai-elements/message", () => ({ MessageResponse: ({ children }: { children: string }) => <div>{children}</div> }));
const projects = vi.hoisted(() => ({ listProjects: vi.fn() }));
vi.mock("@/lib/projects", () => projects);

const row: LibraryItemSummary = {
  id: "g1", title: "포천 자철석 PGI 문헌 정리", authors: "", source: "gaid", kind: "digest", coverage: "full", hasPdf: false, collectionIds: ["d3"], tags: [],
  used: { notes: 0, workflows: 0, projects: 0 }, metadataConfirmed: true, addedAt: "2026-10-24",
  digest: { origin: "gaid", status: "pending", workflow: "compare-papers", covers: 5, unmatched: 0, date: "2026-10-24", newPapers: 1, local: true },
};
const item: LibraryItem = {
  id: "g1", owner: "local", source: "gaid", kind: "digest", csl: { type: "document", title: "포천 자철석 PGI 문헌 정리" }, metadataOrigin: "import", metadataConfirmed: true,
  collectionIds: ["d3"], tags: [], attachments: [], read: { coverage: "full" }, addedAt: "2026-10-24", updatedAt: "2026-10-24",
  digest: {
    origin: "gaid", status: "pending", covers: ["p1", "p2"], collectionId: "d3", text: "# 포천\n\n## 연구 질문\n\nPGI", headings: ["연구 질문", "방법 비교"], createdAt: "2026-10-24T00:00:00Z",
    made: { workflow: "compare-papers", question: "PGI가 무엇을 더하는가", origin: "gi-x", originLabel: "pc74", projectId: "proj", projectName: "포천 자철석 광체 추정", digestId: "2026-10-24-포천", path: "문헌정리/2026-10-24-포천/index.md", contentSha256: "x", fileUpdatedAt: "t", refreshedAt: "t" },
  },
};
const data: LibraryItemResponse = { item, uses: [], digestPapers: [{ id: "p1", title: "Heo 2025" }, { id: "p2", title: "Astic 2020" }], digestNewPapers: 1 };
const folders = [{ id: "d3", owner: "local", name: "포천 자철석 PGI", source: "gaid" as const }];

beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.clearAllMocks();
  projects.listProjects.mockResolvedValue([{ id: "proj", name: "포천 자철석 광체 추정", archived: false }, { id: "other", name: "다른 프로젝트", archived: false }]);
});

describe("문헌 정리 in 서재", () => {
  it("lists a digest with its covered papers, origin and review state", () => {
    const select = vi.fn();
    render(<DigestTable rows={[row]} selected={null} onSelect={select} />);
    expect(screen.getByText("논문 5편 · 정리 뒤 더한 논문 1")).toBeInTheDocument();
    expect(screen.getByText("GAID에서 만듦")).toBeInTheDocument();
    expect(screen.getByText("검토 전")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: "포천 자철석 PGI 문헌 정리" }));
    expect(select).toHaveBeenCalledWith("g1");
  });

  it("marks a digest checked, offers making it again and attaches its papers for a Workflow", async () => {
    api.setDigestStatus.mockResolvedValue({ item });
    api.attachToProject.mockResolvedValue({ itemIds: [], collectionIds: [] });
    const reload = vi.fn().mockResolvedValue(undefined), remake = vi.fn(), openProject = vi.fn();
    render(<DigestItemDetail data={data} collections={folders} onClose={vi.fn()} onOpenProject={openProject} onSelect={vi.fn()} onChanged={vi.fn()} onReload={reload} onRemake={remake} />);
    expect(screen.getByText("일반 Workflow 논문 비교 · 프로젝트 포천 자철석 광체 추정 · 2026-10-24")).toBeInTheDocument();
    expect(screen.getByText("다룬 논문 2편")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인함으로 표시" }));
    await waitFor(() => expect(api.setDigestStatus).toHaveBeenCalledWith("g1", "confirmed"));
    fireEvent.click(screen.getByRole("button", { name: "다시 만들기" }));
    expect(remake).toHaveBeenCalledWith("d3");
    fireEvent.click(screen.getByRole("button", { name: "Workflow에서 쓰기" }));
    fireEvent.click(await screen.findByRole("button", { name: "다른 프로젝트" }));
    await waitFor(() => expect(openProject).toHaveBeenCalledWith("other"));
    expect(api.attachToProject.mock.calls).toEqual([["other", "p1"], ["other", "p2"]]);
  });

  it("makes a digest request and hands the message to the project's new chat", async () => {
    api.checkFolder.mockResolvedValue({ folderId: "d3", items: 3, projects: [{ id: "proj", name: "포천 자철석 광체 추정" }], issues: [] });
    api.listLibrary.mockResolvedValue({ total: 3, items: [{ hasPdf: true }, { hasPdf: true }, { hasPdf: false }] });
    api.makeDigest.mockResolvedValue({ requestId: "dr", projectId: "proj", path: "문헌정리/x/index.md", covers: ["p1"], message: "문헌 정리를 만들어 주세요: x" });
    const openProject = vi.fn(), close = vi.fn(), seen = vi.fn();
    const off = onDigestChatRequest(seen);
    render(<DigestMakeSheet open onOpenChange={close} collections={folders} folderId="d3" onOpenProject={openProject} />);
    expect(await screen.findByText("논문 3편 · PDF 2편")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /논문 비교/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /정리 요청 넣기/ })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "연구 질문" }), { target: { value: "PGI가 무엇을 더하는가" } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "정리할 프로젝트" })).toHaveValue("proj"));
    fireEvent.click(screen.getByRole("button", { name: /정리 요청 넣기/ }));
    await waitFor(() => expect(openProject).toHaveBeenCalledWith("proj"));
    expect(api.makeDigest).toHaveBeenCalledWith({ projectId: "proj", workflow: "compare-papers", question: "PGI가 무엇을 더하는가", collectionId: "d3" });
    expect(seen).toHaveBeenCalled();
    expect(takeDigestChat("proj")?.task).toMatchObject({ title: "문헌 정리", text: "문헌 정리를 만들어 주세요: x" });
    off();
  });

  it("shows a sent request as one line plus a collapsed card of the agent's instructions", () => {
    const text = '문헌 정리를 만들어 주세요: 포천\n\n<library-digest-request id="dr-1" workflow="compare-papers" path="문헌정리/x/index.md">\n## 연구 질문 first\n</library-digest-request>';
    const parsed = parseDigestRequest(text)!;
    expect(parsed).toMatchObject({ line: "문헌 정리를 만들어 주세요: 포천", workflow: "compare-papers", path: "문헌정리/x/index.md" });
    expect(parseDigestRequest("문헌 정리를 만들어 주세요")).toBeNull();
    render(<DigestRequestCard request={parsed} />);
    expect(screen.queryByText(/연구 질문 first/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /문헌 정리 요청 · 논문 비교/ }));
    expect(screen.getByText(/연구 질문 first/)).toBeInTheDocument();
  });
});
