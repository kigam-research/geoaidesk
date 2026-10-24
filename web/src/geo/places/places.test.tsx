import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceHomeResponse } from "@/geo/contracts/workspace-home";
import { hasMethodSetup, takeMethodSetup } from "@/geo/hub/handoff";
import { parseHubHash } from "@/geo/hub/location";
import { setGeoLocaleSetting } from "@/geo/i18n";
import { GaidAppBar } from "@/geo/shell/app-bar";
import type { Project } from "@/lib/projects";

import { parseLibraryHash } from "./library-location";
import { OPEN_LIBRARY_EVENT, takeWorkspaceOpen } from "./navigation";
import { WorkspaceHome } from "./workspace-home";

const HOME: WorkspaceHomeResponse = {
  schemaVersion: "gaid-workspace-home/v1",
  recent: [
    { kind: "chat", projectId: "p1", projectName: "포천 자철석", id: "s1", title: "광체 추정", workflow: { id: "pocheon", title: "포천 자철석 광체 추정", version: "0.1.1" }, state: "running", decisions: 0, updatedAt: new Date().toISOString() },
    { kind: "note", projectId: "p2", projectName: "Yilgarn", id: "2026-10-24-pu", title: "PU 결과", workflow: null, state: "decisions", decisions: 2, updatedAt: new Date().toISOString() },
  ],
  workflows: [
    { id: "pocheon", title: "포천 자철석 광체 추정", line: "광체 경계를 추정합니다", source: "shared", version: "0.1.1", ready: true, projects: [{ id: "p1", name: "포천 자철석" }] },
  ],
  projectCount: 2,
  unreadableProjects: 1,
};

beforeEach(() => {
  window.localStorage.clear();
  setGeoLocaleSetting("ko");
});

vi.mock("./api", () => ({ useWorkspaceHome: () => ({ data: HOME, error: false, reload: () => {} }) }));

const PROJECTS: Project[] = [
  { id: "p1", name: "포천 자철석", description: "", tags: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-24T00:00:00Z", archived: false, spendLimitUsd: null },
  { id: "p2", name: "Yilgarn", description: "", tags: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z", archived: false, spendLimitUsd: null },
  { id: "p3", name: "옛 연구", description: "", tags: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", archived: true, spendLimitUsd: null },
];

function renderHome(onOpenProject = vi.fn()) {
  render(
    <WorkspaceHome
      isActive
      projects={PROJECTS}
      projectActivities={{}}
      projectLine={() => "오늘 수정"}
      onOpenProject={onOpenProject}
      onCreateProject={vi.fn()}
      onOpenConnect={vi.fn()}
      projectsView={<p>프로젝트 목록 본문</p>}
      archivedView={<p>보관 목록 본문</p>}
    />,
  );
  return onOpenProject;
}

describe("place addresses", () => {
  it("reads older #hub links as #connect", () => {
    expect(parseHubHash("#hub/e/abc123")).toEqual(parseHubHash("#connect/e/abc123"));
    expect(parseHubHash("#hub")).toEqual({ open: true, projectId: null });
    expect(parseHubHash("#connect/feeds")).toMatchObject({ open: true, feeds: true });
    expect(parseHubHash("#hubble").open).toBe(false);
    expect(parseHubHash("#library").open).toBe(false);
  });

  it("reads the 서재 address with an optional item", () => {
    expect(parseLibraryHash("#library")).toEqual({ open: true, itemId: null });
    expect(parseLibraryHash("#library/item%201")).toEqual({ open: true, itemId: "item 1" });
    expect(parseLibraryHash("#connect").open).toBe(false);
  });
});

describe("app bar", () => {
  it("shows the two places and opens 서재 from its own entry", async () => {
    const onNavigate = vi.fn();
    const opened = vi.fn();
    window.addEventListener(OPEN_LIBRARY_EVENT, opened);
    render(<GaidAppBar place="workspace" onNavigate={onNavigate} onOpenSettings={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "GAID 장소" });
    expect(within(nav).getByRole("button", { name: "Workspace" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(nav).getByRole("button", { name: "Connect" }));
    expect(onNavigate).toHaveBeenCalledWith("connect");
    await userEvent.click(screen.getByRole("button", { name: "서재" }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_LIBRARY_EVENT, opened);
  });
});

describe("Workspace home", () => {
  it("lists what to continue across projects with their state", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "GAID Workspace" })).toBeInTheDocument();
    expect(screen.getByText("실행 중")).toBeInTheDocument();
    expect(screen.getByText("결정 2")).toBeInTheDocument();
    expect(screen.getByText("포천 자철석 · Workflow 포천 자철석 광체 추정 0.1.1")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 1곳을 읽지 못해 목록에서 빠졌습니다.")).toBeInTheDocument();
    // Archived projects are counted in the sidebar, not listed among recent projects.
    expect(screen.getByRole("button", { name: /보관한 프로젝트/ })).toBeInTheDocument();
  });

  it("opens a recent chat in its project", async () => {
    const onOpenProject = renderHome();
    await userEvent.click(screen.getByRole("button", { name: "광체 추정 이어서 열기" }));
    expect(onOpenProject).toHaveBeenCalledWith("p1");
    expect(takeWorkspaceOpen("p1")).toMatchObject({ sessionId: "s1", title: "광체 추정" });
  });

  it("starts an installed Workflow in its only project", async () => {
    const onOpenProject = renderHome();
    await userEvent.click(screen.getByRole("button", { name: "포천 자철석 광체 추정 시작" }));
    expect(onOpenProject).toHaveBeenCalledWith("p1");
    expect(hasMethodSetup("p1")).toBe(true);
    expect(takeMethodSetup("p1")).toMatchObject({ methodKey: "pocheon", workflowId: null });
  });

  it("asks for the project when an analysis starts", async () => {
    const onOpenProject = renderHome();
    await userEvent.click(screen.getByRole("button", { name: "분석 시작" }));
    const dialog = await screen.findByRole("dialog", { name: "분석할 프로젝트 고르기" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Yilgarn" }));
    expect(onOpenProject).toHaveBeenCalledWith("p2");
    expect(takeWorkspaceOpen("p2")).toMatchObject({ workflows: true });
  });

  it("shows the project list as its own view", async () => {
    renderHome();
    await userEvent.click(screen.getByRole("button", { name: /^프로젝트\s*2$/ }));
    expect(screen.getByText("프로젝트 목록 본문")).toBeInTheDocument();
  });
});
