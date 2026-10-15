import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeoChatActions } from "../workspace/chat-actions";
import { setGeoLocaleSetting } from "../i18n";
import type { HandoffPreview } from "./client";

const { apiFetch, saveDownload } = vi.hoisted(() => ({ apiFetch: vi.fn(), saveDownload: vi.fn() }));
vi.mock("@/lib/projects", () => ({ apiFetch }));
vi.mock("./client", async importOriginal => ({ ...await importOriginal<typeof import("./client")>(), saveDownload }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let preview: HandoffPreview;
let sites: { id: string; url: string; authoring?: string }[];
beforeEach(() => {
  window.localStorage.clear(); setGeoLocaleSetting("ko");
  preview = { request: "Check samples", finalAnswer: "Run finished, not reviewed", modelRef: "gaid-local/qwen", files: [
    { path: "analysis.py", role: "code", size: 10, sha256: "a", provenanceStepIds: ["one"] },
    { path: "plot.png", role: "result", size: 20, sha256: "b", provenanceStepIds: ["two"] },
    { path: "user_data/raw.csv", role: "user-data", size: 30, sha256: "c", provenanceStepIds: ["three"] },
  ], excluded: { policy: 1, unavailable: 0, tooLarge: 0, fileLimit: 0, unselected: 0 }, truncated: { request: false, finalAnswer: false, provenanceStepIds: false } };
  sites = [{ id: "hub", url: "https://example.test/hub/" }];
  saveDownload.mockReset();
  apiFetch.mockReset().mockImplementation(async (path: string) => {
    if (path === "/geo/hub/handoff/preview") return json(preview);
    if (path === "/geo/skill-hub") return json({ sites });
    if (path === "/geo/hub/handoff") return new Response("gzip bytes", { headers: { "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="gaid-analysis-12345678-20261015.tar.gz"' } });
    throw new Error(`Unexpected request: ${path}`);
  });
});
const action = "방금 한 분석을 skill_hub 초안으로 보내기";
async function open() {
  await userEvent.click(screen.getByRole("button", { name: action }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("Check samples");
  return within(dialog);
}
describe("hub analysis handoff", () => {
  it("disables the composer entry without a session or during streaming", () => {
    const { rerender } = render(<GeoChatActions projectId="p1" sessionId={null} isStreaming={false} />);
    expect(screen.getByRole("button", { name: action })).toBeDisabled();
    rerender(<GeoChatActions projectId="p1" sessionId="s1" isStreaming />);
    expect(screen.getByRole("button", { name: action })).toBeDisabled(); expect(apiFetch).not.toHaveBeenCalled();
  });
  it("previews content, defaults to code/results only, downloads exact choices and links to authoring", async () => {
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    const dialog = await open();
    expect(dialog.getByText("Run finished, not reviewed")).toBeInTheDocument();
    expect(dialog.getByText(/사용 모델: gaid-local\/qwen/)).toBeInTheDocument();
    expect(dialog.getByText(/원본 자료는 직접 선택한 파일만/)).toBeInTheDocument();
    expect(dialog.getByRole("checkbox", { name: /analysis.py/ })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /plot.png/ })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /user_data\/raw.csv/ })).not.toBeChecked();
    expect(dialog.queryByRole("link")).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("checkbox", { name: /plot.png/ }));
    await userEvent.click(dialog.getByRole("checkbox", { name: /user_data\/raw.csv/ }));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Workflow draft" } });
    await userEvent.click(dialog.getByRole("button", { name: "분석 묶음 다운로드" }));
    await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce());
    expect(apiFetch).toHaveBeenCalledWith("/geo/hub/handoff", expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "s1", files: ["analysis.py", "user_data/raw.csv"], note: "Workflow draft" }) }), "p1");
    expect(saveDownload.mock.calls[0][1]).toBe("gaid-analysis-12345678-20261015.tar.gz");
    expect(dialog.getByRole("link", { name: "skill_hub에서 초안 시작하기" })).toHaveAttribute("href", "https://example.test/hub/#/author/new?from=gaid");
    expect(dialog.getByRole("link")).toHaveAttribute("target", "_blank");
    expect(dialog.getByText(/묶음을 첨부하세요/)).toBeInTheDocument();
    expect(apiFetch.mock.calls.every(([path]) => !path.startsWith("/skills"))).toBe(true);
  });
  it("shows download errors without losing choices or note", async () => {
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "Keep this note" } });
    await userEvent.click(dialog.getByRole("checkbox", { name: /plot.png/ }));
    apiFetch.mockResolvedValueOnce(json({ code: "size" }, 413));
    await userEvent.click(dialog.getByRole("button", { name: "분석 묶음 다운로드" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("크기가 제한을 넘었습니다");
    expect(dialog.getByRole("textbox")).toHaveValue("Keep this note"); expect(dialog.getByRole("checkbox", { name: /plot.png/ })).not.toBeChecked();
    expect(saveDownload).not.toHaveBeenCalled();
  });
  it("allows retry after a failed preview and disables download if streaming starts", async () => {
    apiFetch.mockResolvedValueOnce(json({ code: "session" }, 404));
    const { rerender } = render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    await userEvent.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByRole("alert")).toHaveTextContent("대화 기록을 찾지 못했습니다");
    await userEvent.click(screen.getByRole("button", { name: "분석 다시 읽기" }));
    await screen.findByText("Check samples");
    rerender(<GeoChatActions projectId="p1" sessionId="s1" isStreaming />);
    expect(screen.getByRole("button", { name: "분석 묶음 다운로드" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /analysis.py/ })).toBeDisabled();
  });
  it("does not save an in-flight download into a different project/session", async () => {
    const { rerender } = render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
    let resolve!: (response: Response) => void;
    apiFetch.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
    await userEvent.click(dialog.getByRole("button", { name: "분석 묶음 다운로드" }));
    rerender(<GeoChatActions projectId="p2" sessionId="s2" isStreaming={false} />);
    await act(async () => { resolve(new Response("gzip")); });
    expect(saveDownload).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("supports text-only download with no configured hub", async () => {
    preview.files = []; sites = [];
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
    expect(dialog.getByText(/요청과 답변만 다운로드할 수 있습니다/)).toBeInTheDocument();
    expect(dialog.getByText(/사이트가 설정되지 않았습니다/)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "분석 묶음 다운로드" }));
    await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce()); expect(dialog.queryByRole("link")).not.toBeInTheDocument();
  });
  it("renders English Workflow wording and truncation notice", async () => {
    setGeoLocaleSetting("en"); preview.truncated.finalAnswer = true;
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Send the analysis just done to a skill_hub draft" }));
    expect(await screen.findByText(/Long text or per-file step lists were truncated/)).toBeInTheDocument();
    expect(screen.getByText(/material for a skill or Workflow draft/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download analysis bundle" })).toBeEnabled();
  });
});
