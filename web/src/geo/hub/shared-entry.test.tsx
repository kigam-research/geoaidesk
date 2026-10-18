import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UseInProjectDialog } from "./shared-entry";
import { sharedHub } from "./shared-api";

const { createProject } = vi.hoisted(() => ({ createProject: vi.fn() }));
vi.mock("@/lib/use-projects", () => ({ useProjects: () => ({ create: createProject }) }));
vi.mock("./shared-api", () => ({ sharedHub: { install: vi.fn() }, hubUserName: () => "연구자" }));
vi.mock("./input-prep", () => ({ InputPrep: ({ projectName }: { projectName: string }) => <p>{projectName} 입력 준비</p> }));

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => { localStorage.removeItem("gaid:locale"); vi.resetAllMocks(); });
function show() {
  return render(<UseInProjectDialog open onOpenChange={vi.fn()} entryId="entry-method" revision={2}
    projects={[{ id: "default", name: "Default" }]} onOpenSetup={vi.fn()} />);
}

describe("shared install project creation", () => {
  it("creates a project, selects it and installs the viewed revision there", async () => {
    createProject.mockResolvedValue({ id: "new-study", name: "니켈 연구" });
    vi.mocked(sharedHub.install).mockResolvedValue({ install: { methodKey: "local:method" }, workflowId: "run", recipeId: null } as Awaited<ReturnType<typeof sharedHub.install>>);
    show();
    fireEvent.click(screen.getByRole("button", { name: "새 프로젝트 만들기" }));
    const create = screen.getByRole("button", { name: "프로젝트 만들기" });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "새 프로젝트 이름" }), { target: { value: "  니켈 연구  " } });
    fireEvent.click(create);
    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ name: "니켈 연구" }));
    await waitFor(() => expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("new-study"));
    expect(sharedHub.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "프로젝트에 설치하기" }));
    await waitFor(() => expect(sharedHub.install).toHaveBeenCalledWith("entry-method", "new-study", 2));
    await screen.findByText("니켈 연구 입력 준비");
  });

  it("keeps the name on failure, hides raw errors and allows retry or return", async () => {
    vi.mocked(createProject).mockRejectedValueOnce(new Error("HTTP 500 private detail"));
    show();
    fireEvent.click(screen.getByRole("button", { name: "새 프로젝트 만들기" }));
    fireEvent.change(screen.getByRole("textbox", { name: "새 프로젝트 이름" }), { target: { value: "연구" } });
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await screen.findByText("프로젝트를 만들지 못했습니다. 이름을 바꿔 다시 만드세요.");
    expect(screen.getByText("HTTP 500 private detail").closest("details")?.open).toBe(false);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("연구");
    fireEvent.click(screen.getByRole("button", { name: /^취소$/ }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("default");
    expect(sharedHub.install).not.toHaveBeenCalled();
  });
});
