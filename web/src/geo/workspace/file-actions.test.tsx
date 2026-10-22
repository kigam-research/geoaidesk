import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeoFileActions, WORKFLOW_STRIP_KEY } from "./file-actions";
import { GeoChatActions } from "./chat-actions";
import { setGeoLocaleSetting, t } from "@/geo/i18n";
const request = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ request, text: (value: { ko: string }) => value.ko }));
vi.mock("./task-setup", () => ({ TaskSetup: (props: { open: boolean; exposure?: string; initialBindings: Record<string, string> }) => props.open ? <div data-testid="setup" data-exposure={props.exposure}>{JSON.stringify(props.initialBindings)}</div> : null }));
vi.mock("./readiness", () => ({ Readiness: () => null }));
vi.mock("@/geo/hub-handoff/dialog", () => ({ HandoffDialog: () => <div data-testid="handoff" /> }));
const method = { id: "shared-id", title: { ko: "설치한 방법" }, readiness: { state: "ready" } };
beforeEach(() => {
  window.localStorage.clear();
  setGeoLocaleSetting("ko");
  request.mockReset();
  request.mockImplementation(async (path: string) => path === "/geo/suggestions" ? { suggestions: [{ workflowId: method.id, exposure: "method:table-method:shared-id", workflow: method, title: method.title, match: { roleId: "grid", roleLabel: { ko: "격자" }, format: "csv" }, needs: [], readiness: method.readiness }] }
    : path === "/geo/workflows" ? { catalogue: { state: "off" }, workflows: [{ ...method, title: { ko: "동일 ID의 카탈로그" } }] }
    : { type: "directory", path: "", children: [] });
});

describe("file method actions", () => {
  it("opens the installed method with its exposure and file binding even without the catalogue", async () => {
    render(<GeoFileActions path="research.csv" projectId="p" />);
    fireEvent.click(await screen.findByRole("button", { name: "열린 파일로 시작할 수 있는 Workflow 1개" }));
    fireEvent.click(await screen.findByRole("button", { name: "시작 설정 열기" }));
    await waitFor(() => expect(screen.getByTestId("setup")).toHaveAttribute("data-exposure", "method:table-method:shared-id"));
    expect(screen.getByTestId("setup")).toHaveTextContent('"grid":"research.csv"');
  });
  it("starts as one line above a table, expands by keyboard and remembers the choice in this browser", async () => {
    const { unmount } = render(<GeoFileActions path="research.csv" projectId="p" />);
    const toggle = await screen.findByRole("button", { name: "열린 파일로 시작할 수 있는 Workflow 1개" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "시작 설정 열기" })).not.toBeInTheDocument();
    toggle.focus(); await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toContainElement(screen.getByRole("button", { name: "시작 설정 열기" }));
    expect(window.localStorage.getItem(WORKFLOW_STRIP_KEY)).toBe("open");
    unmount();
    render(<GeoFileActions path="layers/geology.shp" projectId="p" />);
    expect(await screen.findByRole("button", { name: "시작 설정 열기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "열린 파일로 시작할 수 있는 Workflow 1개" }));
    expect(window.localStorage.getItem(WORKFLOW_STRIP_KEY)).toBe("line");
  });
  it("keeps the strip open without a toggle for files that do not need the height", async () => {
    render(<GeoFileActions path="notes/summary.md" projectId="p" />);
    expect(await screen.findByRole("button", { name: "시작 설정 열기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "열린 파일로 시작할 수 있는 Workflow" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { expanded: false })).not.toBeInTheDocument();
  });
  it("shows a named hub-draft action and opens the existing handoff", () => {
    render(<GeoChatActions projectId="p" sessionId="s" isStreaming={false} />);
    const button = screen.getByRole("button", { name: t("hubHandoff.open") });
    expect(button).toHaveTextContent("허브 초안으로 보내기");
    fireEvent.click(button);
    expect(screen.getByTestId("handoff")).toBeInTheDocument();
  });
});
