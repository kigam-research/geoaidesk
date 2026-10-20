import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliExportButton, cliExportUrl } from "./cli-export";

vi.mock("@/lib/api-auth", () => ({ withApiToken: (url: string) => `${url}&test-auth=attached` }));
vi.mock("@/lib/projects", () => ({ API_BASE: "http://localhost:8000", getActiveProjectId: () => "research-b" }));

describe("CLI export", () => {
  beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); });
  it("offers checked targets and authenticated project-scoped downloads", async () => {
    const user = userEvent.setup();
    render(<CliExportButton source={{ kind: "project", workflowId: "well-qc", method: "method-one" }} />);
    await user.click(screen.getByRole("button", { name: "CLI에서 쓰기" }));
    const pi = screen.getByRole("link", { name: "Pi용 파일 받기" });
    const url = new URL(pi.getAttribute("href")!);
    expect(url.pathname).toBe("/geo/workflows/well-qc/cli-export");
    expect(Object.fromEntries(url.searchParams)).toEqual({ target: "pi", locale: "ko", project: "research-b", method: "method-one", "test-auth": "attached" });
    expect(screen.getByRole("link", { name: "Claude Code용 받기" })).toHaveAttribute("download");
    expect(screen.queryByText(/Codex/)).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Pi용 파일 받기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CLI에서 쓰기" })).toHaveFocus();
  });
  it("targets registered hub entries without a method query and preserves locale", () => {
    localStorage.setItem("gaid:locale", "en");
    const url = new URL(cliExportUrl({ kind: "hub", entryId: "entry-abc" }, "claude"));
    expect(url.pathname).toBe("/geo/hub/entries/entry-abc/cli-export");
    expect(url.searchParams.get("locale")).toBe("en");
    expect(url.searchParams.has("method")).toBe(false);
  });
});
