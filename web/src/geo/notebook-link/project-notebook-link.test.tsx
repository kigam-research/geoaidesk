import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectNotebookLink } from "./project-notebook-link";
import { apiFetch, useProjectScopeId } from "@/lib/projects";

vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn(), useProjectScopeId: vi.fn() }));
const fetched = vi.mocked(apiFetch);
const scoped = vi.mocked(useProjectScopeId);
const url = "https://notebooklm.google.com/notebook/study";
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko"); fetched.mockReset(); scoped.mockReturnValue("project-a");
});

describe("ProjectNotebookLink", () => {
  it("reads and saves with the owning project's explicit scope", async () => {
    fetched.mockResolvedValueOnce(response({ url: null, updatedAt: null }));
    fetched.mockResolvedValueOnce(response({ url, updatedAt: "2026-10-24T00:00:00Z" }));
    render(<ProjectNotebookLink />);
    await screen.findByRole("button", { name: "노트북 링크 저장" });
    expect(fetched.mock.calls[0][2]).toBe("project-a");
    fireEvent.click(screen.getByRole("button", { name: "노트북 링크 저장" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: url } });
    fireEvent.click(screen.getByRole("button", { name: "링크 저장" }));
    await screen.findByRole("link", { name: "노트북 열기" });
    expect(fetched).toHaveBeenLastCalledWith("/geo/notebook-link", expect.objectContaining({ method: "PUT", body: JSON.stringify({ url }) }), "project-a");
  });
  it("does not show an old project's late response after switching projects", async () => {
    let finishA!: (value: Response) => void;
    fetched.mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve; }));
    fetched.mockResolvedValueOnce(response({ url: null, updatedAt: null }));
    const { rerender } = render(<ProjectNotebookLink />);
    scoped.mockReturnValue("project-b"); rerender(<ProjectNotebookLink />);
    await screen.findByRole("button", { name: "노트북 링크 저장" });
    await act(async () => { finishA(response({ url, updatedAt: "2026-10-24T00:00:00Z" })); });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fetched.mock.calls[1][2]).toBe("project-b");
    expect((fetched.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });
  it("keeps a failed load read-only and lets the researcher retry", async () => {
    fetched.mockResolvedValueOnce(response({ detail: "Malformed record" }, 409));
    fetched.mockResolvedValueOnce(response({ url, updatedAt: "2026-10-24T00:00:00Z" }));
    render(<ProjectNotebookLink />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "노트북 링크 저장" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "링크 다시 읽기" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "노트북 열기" })).toHaveAttribute("href", url));
  });
});
