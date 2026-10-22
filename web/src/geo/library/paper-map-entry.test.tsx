import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { LibraryUse } from "@/geo/contracts/library";
import { fetchConnections } from "@/geo/connections/api";
import { fixture } from "@/geo/connections/fixture";
import { mapProjects, PaperMapEntry } from "./paper-map-entry";

vi.mock("@/geo/connections/api", () => ({ fetchConnections: vi.fn() }));
vi.mock("@xyflow/react", async importOriginal => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return { ...actual, ReactFlow: () => <div data-testid="graph" /> };
});
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); vi.mocked(fetchConnections).mockReset().mockResolvedValue(fixture); });

const note = (projectId: string, projectName: string, noteId: string): LibraryUse => ({ kind: "note", projectId, projectName, noteId, title: noteId, locators: [] });
const attached = (projectId: string, projectName: string): LibraryUse => ({ kind: "project", projectId, projectName });

it("lists citing projects first, then attach-only projects, and ignores Workflow uses", () => {
  const uses = [attached("b", "나 프로젝트"), note("a", "가 프로젝트", "n1"), attached("a", "가 프로젝트"), note("a", "가 프로젝트", "n2"),
    { kind: "workflow", title: "W" } as LibraryUse, attached("c", "다 프로젝트")];
  expect(mapProjects(uses)).toEqual([
    { projectId: "a", projectName: "가 프로젝트", notes: 2 },
    { projectId: "b", projectName: "나 프로젝트", notes: 0 },
    { projectId: "c", projectName: "다 프로젝트", notes: 0 },
  ]);
});

it("offers no entry when no project uses the paper", () => {
  render(<PaperMapEntry itemId="li-1" uses={[{ kind: "workflow", title: "W" }]} onOpenProject={() => {}} onOpenPaper={() => {}} />);
  expect(screen.queryByRole("button", { name: "연결 지도 열기" })).toBeNull();
});

it("opens the map of the only project directly, centred on the paper, with that project named", async () => {
  const onOpenProject = vi.fn();
  render(<PaperMapEntry itemId="li-1" uses={[note("a", "가 프로젝트", "n1")]} onOpenProject={onOpenProject} onOpenPaper={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "연결 지도 열기" }));
  await screen.findByTestId("graph");
  expect(fetchConnections).toHaveBeenLastCalledWith("a", "paper:li-1", 1, expect.any(AbortSignal));
  expect(screen.getByText(/가 프로젝트 프로젝트에 기록된 연결만/)).toBeTruthy();
  // A note has no open action outside its project: the pane offers to open the project instead.
  fireEvent.click(screen.getByRole("tab", { name: "목록" }));
  fireEvent.click(screen.getByRole("button", { name: /^[^,]+, 정리 노트$/ }));
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 열기" }));
  expect(onOpenProject).toHaveBeenCalledWith("a");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "연결 지도" })).toBeNull());
});

it("asks for the project first when several use the paper", async () => {
  render(<PaperMapEntry itemId="li-1" uses={[attached("b", "나 프로젝트"), note("a", "가 프로젝트", "n1")]} onOpenProject={() => {}} onOpenPaper={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "연결 지도 열기" }));
  expect(await screen.findByText("연결 지도를 열 프로젝트")).toBeTruthy();
  expect(screen.getByText("노트 1개에서 인용")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /나 프로젝트/ }));
  await waitFor(() => expect(fetchConnections).toHaveBeenLastCalledWith("b", "paper:li-1", 1, expect.any(AbortSignal)));
});
