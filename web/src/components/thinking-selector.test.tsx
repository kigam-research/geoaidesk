import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThinkingSelector, THINKING_LEVELS } from "./thinking-selector";

describe("ThinkingSelector", () => {
  it("shows the current level on the chip", () => {
    render(<ThinkingSelector selected="high" onChange={() => {}} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("lists all six levels and fires onChange with the picked one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThinkingSelector selected="high" onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    // Chip + popover row can both show the selected label — use getAllByText.
    for (const level of THINKING_LEVELS) {
      expect(screen.getAllByText(level.label).length).toBeGreaterThan(0);
    }
    await user.click(screen.getByText("XHigh"));
    expect(onChange).toHaveBeenCalledWith("xhigh");
  });

  it("when disabled: shows Off, does not open, never fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThinkingSelector selected="high" onChange={onChange} disabled />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows wire substitutions on the chip and options while keeping the selected intent", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThinkingSelector selected="high" onChange={onChange} thinkingSentAs={{ high: "medium", minimal: "low" }} />);
    expect(screen.getByText("High → Medium")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Sent to this server as Medium.")).toBeInTheDocument();
    expect(screen.getByText("Minimal → Low")).toBeInTheDocument();
    await user.click(screen.getAllByText("High → Medium")[1]);
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("refreshes the substitution when server metadata changes and never maps Off", () => {
    const { rerender } = render(<ThinkingSelector selected="high" onChange={() => {}} thinkingSentAs={{ high: "medium" }} />);
    rerender(<ThinkingSelector selected="high" onChange={() => {}} />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("High → Medium")).not.toBeInTheDocument();
    rerender(<ThinkingSelector selected="off" onChange={() => {}} thinkingSentAs={{ high: "medium" }} />);
    expect(screen.getByText("Off")).toBeInTheDocument();
  });
});
