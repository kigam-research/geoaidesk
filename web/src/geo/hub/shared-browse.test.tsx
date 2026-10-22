import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import { SharedBrowse } from "./shared-browse";
import { sharedHub } from "./shared-api";
import { HubHome } from "./hub-home";
import { HubSidebar, useHubSidebarCollapsed, type HubView } from "./hub-sidebar";
import { useState } from "react";

/** The hub as GaidHub draws it: the sidebar beside the home lists, one view state. */
function Hub() {
  const [view, setView] = useState<HubView>({ kind: "home" });
  return (
    <>
      <HubSidebar view={view} onView={setView} folders={[{ id: "geo", name: "지질", count: 1 }]} registryTotal={1} mineCount={0} />
      <HubHome view={view} onView={setView} recommended={[]} folders={[]} folderId="all" onFolder={vi.fn()} registryFolders={[{ id: "geo", name: "지질", count: 1 }]} projects={[]} onCreate={vi.fn()} onOpen={vi.fn()} onOpenEntry={vi.fn()} />
    </>
  );
}

vi.mock("./shared-api", () => ({ sharedHub: { folders: vi.fn(), entries: vi.fn() } }));
const folder = { id: "geo", name: "지질", entries: 1, createdBy: "김 연구원", createdAt: "2026-10-18" };
const entry = { id: "entry-one", title: "지질 지도 확인", tagline: "원본 좌표와 범위를 확인합니다.", author: "김 연구원", stars: 3, folderId: "geo" } as HubEntry;
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.mocked(sharedHub.folders).mockResolvedValue({ folders: [folder] });
  vi.mocked(sharedHub.entries).mockResolvedValue({ entries: [entry] });
});
afterEach(() => { vi.clearAllMocks(); localStorage.removeItem("gaid:locale"); });

async function loaded() { return screen.findByRole("button", { name: "지질 지도 확인 열기" }); }

describe("Shared hub browse", () => {
  it("opens a registered entry, combines debounced search with folders, and resets no results", async () => {
    const open = vi.fn();
    render(<SharedBrowse onOpen={open} />);
    fireEvent.click(await loaded());
    expect(open).toHaveBeenCalledWith("entry-one");
    expect(sharedHub.entries).toHaveBeenCalledWith("all", "");
    expect(screen.getByText(entry.tagline!)).toBeTruthy();
    expect(screen.getByLabelText("star 3개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^지질\s*1$/ }));
    await waitFor(() => expect(sharedHub.entries).toHaveBeenLastCalledWith("geo", ""));
    await loaded();
    vi.mocked(sharedHub.entries).mockResolvedValue({ entries: [] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "없는 방법" } });
    expect(screen.queryByRole("button", { name: "지질 지도 확인 열기" })).toBeNull();
    expect(sharedHub.entries).not.toHaveBeenCalledWith("geo", "없는 방법");
    await screen.findByText("조건에 맞는 Workflow가 없습니다. 검색어나 폴더를 바꾸세요.");
    expect(screen.getByText("원소 기호(Ni)나 Workflow 이름(PU)으로도 찾을 수 있습니다.")).toBeTruthy();
    expect(sharedHub.entries).toHaveBeenLastCalledWith("geo", "없는 방법");
    fireEvent.click(screen.getByRole("button", { name: "전체 Workflow 보기" }));
    await waitFor(() => expect(sharedHub.entries).toHaveBeenLastCalledWith("all", ""));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("shows an empty registry and a recoverable error instead of treating an error as empty", async () => {
    vi.mocked(sharedHub.entries).mockRejectedValueOnce(new Error("offline"));
    render(<SharedBrowse onOpen={vi.fn()} />);
    await screen.findByText("등록 Workflow를 읽지 못했습니다. 목록을 다시 읽으세요.");
    expect(screen.queryByText("등록된 Workflow가 없습니다. 추천 Workflow를 살펴보세요.")).toBeNull();
    vi.mocked(sharedHub.entries).mockResolvedValue({ entries: [] });
    fireEvent.click(screen.getByRole("button", { name: "목록 다시 읽기" }));
    await screen.findByText("등록된 Workflow가 없습니다. 추천 Workflow를 살펴보세요.");
    expect(screen.queryByText("원소 기호(Ni)나 Workflow 이름(PU)으로도 찾을 수 있습니다.")).toBeNull();
    expect(screen.getByRole("button", { name: "추천 Workflow 보기" })).toBeTruthy();
  });

  it("ignores an older response arriving after a newer folder result", async () => {
    let resolve!: (r: { entries: HubEntry[] }) => void;
    vi.mocked(sharedHub.entries).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<SharedBrowse onOpen={vi.fn()} />);
    await waitFor(() => expect(sharedHub.entries).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "newer" } });
    await loaded();
    await act(async () => { resolve({ entries: [] }); });
    expect(screen.getByRole("button", { name: "지질 지도 확인 열기" })).toBeTruthy();
  });

  it("opens on 추천 Workflow with the registry list and keeps the search when switching to personal drafts and back", async () => {
    render(<Hub />);
    expect(screen.getByRole("button", { name: "추천 Workflow" }).getAttribute("aria-current")).toBe("page");
    await loaded();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "지도" } });
    fireEvent.click(screen.getByRole("button", { name: /초안과 등록한 것/ }));
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "추천 Workflow" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("지도");
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /^지질\s*1$/ }));
    await waitFor(() => expect(sharedHub.entries).toHaveBeenLastCalledWith("geo", "지도"));
  });

  it("marks the list a detail screen came from and keeps the places in the hidden (rail) sidebar", () => {
    const onView = vi.fn();
    const { rerender } = render(
      <HubSidebar view={{ kind: "mine" }} onView={onView} folders={[{ id: "geo", name: "지질", count: 1 }]} registryTotal={1} mineCount={2} />,
    );
    expect(screen.getByRole("button", { name: /초안과 등록한 것/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "추천 Workflow" }).getAttribute("aria-current")).toBeNull();
    rerender(
      <HubSidebar collapsed view={{ kind: "registry", folder: "geo" }} onView={onView} folders={[{ id: "geo", name: "지질", count: 1 }]} registryTotal={1} mineCount={2} />,
    );
    expect(screen.getByRole("button", { name: "허브에 등록된 Workflow" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "추천 Workflow" }));
    expect(onView).toHaveBeenCalledWith({ kind: "home" });
  });
});

describe("Hub sidebar visibility", () => {
  function Probe() {
    const [collapsed, toggle] = useHubSidebarCollapsed();
    return <button type="button" onClick={toggle}>{collapsed ? "rail" : "open"}</button>;
  }
  const media = (matches: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({ matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  afterEach(() => { vi.unstubAllGlobals(); localStorage.removeItem("gaid:hub-sidebar"); });

  it("starts as the rail below 1280 px until the researcher chooses, then keeps the choice", () => {
    media(true);
    const { unmount } = render(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "rail" }));
    expect(screen.getByRole("button", { name: "open" })).toBeTruthy();
    expect(localStorage.getItem("gaid:hub-sidebar")).toBe("open");
    unmount();
    render(<Probe />);
    expect(screen.getByRole("button", { name: "open" })).toBeTruthy();
  });

  it("starts expanded in a regular window", () => {
    media(false);
    render(<Probe />);
    expect(screen.getByRole("button", { name: "open" })).toBeTruthy();
  });
});
