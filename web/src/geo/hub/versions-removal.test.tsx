import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import { RegisterDialog } from "./hub-dialogs";
import { RemoveWorkflowDialog, RemovedWorkflows } from "./removed-workflows";
import { sharedHub } from "./shared-api";
import { HubSidebar } from "./hub-sidebar";
import { parseHubHash } from "./location";

vi.mock("./shared-api", () => ({ sharedHub: { remove: vi.fn(), restore: vi.fn() } }));
const entry = {
  id: "entry-one", title: "공간 예측 Workflow", author: "등록자", latestRevision: 3,
  revisions: [{ revision: 1 }, { revision: 2 }, { revision: 3, version: "0.2.0" }],
  removed: { at: "2026-10-23T00:00:00.000Z", by: "관리자", reason: "새 절차로 교체" },
} as HubEntry;
beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => { localStorage.removeItem("gaid:locale"); vi.resetAllMocks(); });

describe("Workflow removal and restoration", () => {
  it("states the effect and local restoration rule, then sends an optional bounded reason only on confirmation", async () => {
    const onRemoved = vi.fn();
    render(<RemoveWorkflowDialog open onOpenChange={vi.fn()} entry={entry} local onRemoved={onRemoved} />);
    expect(screen.getByText(/「공간 예측 Workflow」을 허브 목록에서 제거/)).toBeInTheDocument();
    expect(screen.getByText(/프로젝트에 이미 설치한 사본은 유지/)).toBeInTheDocument();
    expect(screen.getByText(/등록자가 제거된 Workflow 목록에서 복원/)).toBeInTheDocument();
    expect(sharedHub.remove).not.toHaveBeenCalled();
    const reason = screen.getByRole("textbox");
    expect(reason).toHaveAttribute("maxLength", "500");
    fireEvent.change(reason, { target: { value: "  새 절차로 교체  " } });
    fireEvent.click(screen.getByRole("button", { name: "허브에서 제거" }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
    expect(sharedHub.remove).toHaveBeenCalledWith(entry.id, "새 절차로 교체");
  });

  it("keeps the reason after a rejected removal and hides the raw failure in technical detail", async () => {
    vi.mocked(sharedHub.remove).mockRejectedValueOnce(new Error("HTTP 403"));
    const done = vi.fn();
    render(<RemoveWorkflowDialog open onOpenChange={vi.fn()} entry={entry} local={false} onRemoved={done} />);
    expect(screen.getByText(/관리자가 제거된 Workflow 목록에서 복원/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "사유 유지" } });
    fireEvent.click(screen.getByRole("button", { name: "허브에서 제거" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox")).toHaveValue("사유 유지");
    expect(screen.getByText("HTTP 403").closest("details")).not.toHaveAttribute("open");
    expect(done).not.toHaveBeenCalled();
  });

  it("shows the removal record and restores the registered version, then refreshes counts", async () => {
    const refresh = vi.fn(async () => undefined);
    render(<RemovedWorkflows entries={[entry]} onRestored={refresh} onBack={vi.fn()} />);
    expect(screen.getByText("version 0.2.0 · 등록자")).toBeInTheDocument();
    expect(screen.getByText(/관리자 님이 .* 제거/)).toBeInTheDocument();
    expect(screen.getByText("제거 사유: 새 절차로 교체")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Workflow 복원" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(sharedHub.restore).toHaveBeenCalledWith(entry.id);
    expect(await screen.findByRole("status")).toHaveTextContent("허브 목록에 복원했습니다");
  });

  it("exposes the removed route and hides its sidebar item when not permitted", () => {
    expect(parseHubHash("#hub/removed")).toEqual({ open: true, projectId: null, removed: true });
    const props = { view: { kind: "removed" as const }, folders: [], registryTotal: 0, mineCount: 0, onView: vi.fn() };
    const { rerender } = render(<HubSidebar {...props} />);
    expect(screen.queryByText("제거된 Workflow")).not.toBeInTheDocument();
    rerender(<HubSidebar {...props} showRemoved removedCount={1} />);
    expect(screen.getByText("제거된 Workflow")).toBeInTheDocument();
  });
});

describe("registration version choices", () => {
  const props = { open: true, onOpenChange: vi.fn(), folders: [{ id: "geo", name: "Geoscience" }] };
  it("assigns 0.1.0 only on first registration", () => {
    render(<RegisterDialog {...props} onRegister={vi.fn()} />);
    expect(screen.getByText("처음 등록하면 version 0.1.0이 됩니다.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it.each(["patch", "minor", "major"] as const)("sends %s and previews its resulting version", async (bump) => {
    const save = vi.fn(async () => undefined);
    render(<RegisterDialog {...props} currentVersion="0.1.2" onRegister={save} />);
    const group = screen.getByRole("group", { name: "다음 version (현재 0.1.2)" });
    const choices = within(group).getAllByRole("radio");
    expect(choices[0]).toBeChecked();
    expect(group).toHaveTextContent("version 0.1.3");
    expect(group).toHaveTextContent("version 0.2.0");
    expect(group).toHaveTextContent("version 1.0.0");
    fireEvent.click(choices[["patch", "minor", "major"].indexOf(bump)]);
    fireEvent.click(screen.getByRole("button", { name: "허브에 등록" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("geo", "", bump));
  });

  it("does not register an unknown current version as a first release", () => {
    render(<RegisterDialog {...props} versionPending onRegister={vi.fn()} />);
    expect(screen.getByRole("button", { name: "허브에 등록" })).toBeDisabled();
    expect(screen.queryByText(/처음 등록하면/)).not.toBeInTheDocument();
  });

  it("keeps the entry's folder when it arrives after the folder list, without losing the note", () => {
    const folders = [{ id: "general", name: "일반" }, { id: "geo", name: "Geoscience" }];
    const save = vi.fn();
    const { rerender } = render(<RegisterDialog {...props} folders={folders} versionPending onRegister={save} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "남길 말" } });
    rerender(<RegisterDialog {...props} folders={folders} initialFolder="geo" currentVersion="0.2.0" onRegister={save} />);
    expect(screen.getByRole("combobox")).toHaveValue("geo");
    expect(screen.getByRole("textbox")).toHaveValue("남길 말");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "general" } });
    rerender(<RegisterDialog {...props} folders={[...folders]} initialFolder="geo" currentVersion="0.2.0" onRegister={save} />);
    expect(screen.getByRole("combobox")).toHaveValue("general");
  });
});
