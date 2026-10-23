import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectScopeProvider } from "@/lib/projects";
import { MessageResponse } from "./message";

describe("Markdown research artifacts", () => {
  it("opens relative report links in the owning project's file preview", () => {
    const open = vi.fn();
    render(<ProjectScopeProvider value="penguin-study"><MessageResponse mode="static" onOpenFile={open}>
      {"[Report](./results/penguins%20report.md)\n\n![Figure](figures/mass.png)"}
    </MessageResponse></ProjectScopeProvider>);
    const link = screen.getByRole("link", { name: "Report" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.pathname).toBe("/sandbox/raw");
    expect(url.searchParams.get("path")).toBe("results/penguins report.md");
    expect(url.searchParams.get("project")).toBe("penguin-study");
    fireEvent.click(link);
    expect(open).toHaveBeenCalledWith("results/penguins report.md");
    const imageUrl = new URL(screen.getByAltText("Figure").getAttribute("src")!);
    expect(imageUrl.searchParams.get("project")).toBe("penguin-study");
    expect(imageUrl.searchParams.get("path")).toBe("figures/mass.png");
    expect(screen.queryByText(/\[blocked\]/)).not.toBeInTheDocument();
  });

  it("keeps external links external and refuses traversal and script URLs", () => {
    const open = vi.fn();
    render(<MessageResponse mode="static" onOpenFile={open}>
      {'[Source](https://example.org/paper)\n\n[Escape](../private.txt)\n\n[Encoded escape](%2e%2e/private.txt)\n\n[Script](javascript:alert%281%29)'}
    </MessageResponse>);
    expect(screen.getByRole("link", { name: "Source" })).toHaveAttribute("href", "https://example.org/paper");
    expect(screen.queryByRole("link", { name: "Escape" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Encoded escape" })).not.toBeInTheDocument();
    for (const link of screen.queryAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^javascript:/i);
    }
    expect(open).not.toHaveBeenCalled();
  });

  // GeoAIDesk (gaid-first-use-fixes): a link still being written showed "[blocked]" until the answer finished.
  it("shows a link that is still streaming as its text, not as a blocked link", () => {
    const full = "끝.\n\n[쪽별 근거와 한계를 담은 연구노트](연구노트/2026-10-22-무작위/index.md)";
    for (let n = 4; n < full.length; n += 5) {
      const { container, unmount } = render(<ProjectScopeProvider value="p"><MessageResponse mode="streaming" isAnimating>
        {full.slice(0, n)}
      </MessageResponse></ProjectScopeProvider>);
      expect(container.textContent).not.toMatch(/\[blocked\]/);
      expect(container.querySelector("[title^='Blocked URL']")).toBeNull();
      unmount();
    }
    render(<ProjectScopeProvider value="p"><MessageResponse mode="streaming">{full}</MessageResponse></ProjectScopeProvider>);
    const url = new URL(screen.getByRole("link", { name: "쪽별 근거와 한계를 담은 연구노트" }).getAttribute("href")!);
    expect(url.searchParams.get("path")).toBe("연구노트/2026-10-22-무작위/index.md");
  });

  it("resolves a Markdown file's links against its own folder without leaving the sandbox", () => {
    const open = vi.fn();
    render(<ProjectScopeProvider value="p"><MessageResponse mode="static" baseDir="results/log_25_9_1/" onOpenFile={open}>
      {"[투고용 PDF](../../figures/Figure_1.pdf)\n\n[기록](rules/check.md)\n\n[밖](../../../secret.txt)"}
    </MessageResponse></ProjectScopeProvider>);
    fireEvent.click(screen.getByRole("link", { name: "투고용 PDF" }));
    expect(open).toHaveBeenCalledWith("figures/Figure_1.pdf");
    fireEvent.click(screen.getByRole("link", { name: "기록" }));
    expect(open).toHaveBeenCalledWith("results/log_25_9_1/rules/check.md");
    expect(screen.queryByRole("link", { name: "밖" })).not.toBeInTheDocument();
    expect(screen.getByText("밖")).toBeInTheDocument();
    expect(screen.queryByText(/\[blocked\]/)).not.toBeInTheDocument();
  });
});
