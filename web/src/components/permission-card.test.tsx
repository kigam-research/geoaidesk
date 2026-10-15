import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as projects from "@/lib/projects";
import { PermissionCard, parsePermissionPayload } from "./permission-card";
import type { ActivityItem } from "@/lib/use-agent";

const item = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: "perm_1",
  label: "Permission needed",
  status: "running",
  timestamp: 1,
  toolName: "permission",
  args: { toolCallId: "tc1", toolName: "bash", command: "rm -rf results", reason: "Destructive shell command: rm -rf results" },
  ...overrides,
});

describe("PermissionCard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses the payload defensively", () => {
    expect(parsePermissionPayload(null)).toEqual({});
    expect(parsePermissionPayload({ command: "rm -rf x", reason: 3 })).toEqual({ command: "rm -rf x", kind: undefined, path: undefined, toolCallId: undefined, toolName: undefined, reason: undefined, outcome: undefined });
  });

  it("posts the decision to the permissions route", async () => {
    const calls: Array<{ path: string; body?: string }> = [];
    vi.spyOn(projects, "apiFetch").mockImplementation(async (path: string, init?: RequestInit) => {
      calls.push({ path, body: typeof init?.body === "string" ? init.body : undefined });
      return new Response(JSON.stringify({ ok: true }));
    });
    render(<PermissionCard item={item()} sessionId="s1" projectId="p" />);
    expect(screen.getByText("The AI agent wants to run a destructive command")).toBeInTheDocument();
    // The guard's English reason is meant for the model, not repeated on the card.
    expect(screen.queryByText("Destructive shell command: rm -rf results")).toBeNull();
    expect(screen.getByText("rm -rf results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ path: "/sessions/s1/permissions/perm_1", body: JSON.stringify({ allow: true }) });
  });

  it("shows outside-project title and target, hides the model reason and submits deny", async () => {
    const request = vi.spyOn(projects, "apiFetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<PermissionCard item={item({ args: { kind: "outside-project", path: "/opt/gaid/file", toolName: "write", command: "write /opt/gaid/file", reason: "Outside-project write: write /opt/gaid/file" } })} sessionId="s1" projectId="p" />);
    expect(screen.getByText("The AI agent wants to change files outside the project")).toBeInTheDocument();
    expect(screen.getByText("Target: /opt/gaid/file")).toBeInTheDocument();
    expect(screen.queryByText("Outside-project write: write /opt/gaid/file")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/sessions/s1/permissions/perm_1", expect.objectContaining({ body: JSON.stringify({ allow: false }) }), "p"));
  });

  it("renders a resolved outside-project request in Korean", () => {
    localStorage.setItem("gaid:locale", "ko");
    try {
      render(<PermissionCard item={item({ status: "complete", args: { kind: "outside-project", path: "/opt/gaid/file", outcome: "allowed" } })} sessionId="s1" projectId="p" />);
      expect(screen.getByText("프로젝트 밖 파일 변경")).toBeInTheDocument();
      expect(screen.getByText("변경 대상: /opt/gaid/file")).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
    } finally { localStorage.removeItem("gaid:locale"); }
  });

  it("does not call a shell-variable target outside the project", () => {
    localStorage.setItem("gaid:locale", "ko");
    try {
      render(<PermissionCard item={item({ args: { kind: "outside-project", path: "$A/geo/x.json", command: "cp a $A/geo/x.json" } })} sessionId="s1" projectId="p" />);
      expect(screen.getByText("AI agent가 위치를 확인할 수 없는 파일을 변경하려고 합니다")).toBeInTheDocument();
      expect(screen.getByText("변경 대상: $A/geo/x.json (셸 변수라 앱이 위치를 확인하지 못했습니다)")).toBeInTheDocument();
    } finally { localStorage.removeItem("gaid:locale"); }
  });

  it("shows the outcome once resolved and hides the buttons", () => {
    render(
      <PermissionCard
        item={item({ status: "error", args: { command: "rm -rf results", outcome: "denied" } })}
        sessionId="s1"
        projectId="p"
      />,
    );
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow once" })).toBeNull();
  });
});
