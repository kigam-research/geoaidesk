import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeoChatActions } from "../workspace/chat-actions";
import { setGeoLocaleSetting } from "../i18n";
import type { HandoffPreview } from "./client";
import { plainMarkdown } from "./dialog";

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
    if (path === "/geo/authoring/handoffs") return json({ projectId: "ap-12345678-abc" }, 201);
    if (path === "/geo/hub/handoff/send") return json({ projectId: "draft-1", url: "http://localhost:54321/#/author/draft-1" }, 201);
    if (path === "/geo/hub/handoff") return new Response("gzip bytes", { headers: { "Content-Type": "application/gzip", "Content-Disposition": 'attachment; filename="gaid-analysis-12345678-20261015.tar.gz"' } });
    throw new Error(`Unexpected request: ${path}`);
  });
});
const action = "방금 한 분석을 Connect 초안으로 보내기";
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
    expect(dialog.getByRole("link", { name: "외부 허브에서 초안 시작하기" })).toHaveAttribute("href", "https://example.test/hub/#/author/new?from=gaid");
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
    expect(dialog.queryByText(/외부 허브/)).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "분석 묶음 다운로드" }));
    await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce()); expect(dialog.queryByRole("link")).not.toBeInTheDocument();
  });
  it("renders English Workflow wording and truncation notice", async () => {
    setGeoLocaleSetting("en"); preview.truncated.finalAnswer = true;
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Send the analysis just done to a Connect draft" }));
    expect(await screen.findByText(/Long text or per-file step lists were truncated/)).toBeInTheDocument();
    expect(screen.getByText(/material for a new Workflow draft/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download analysis bundle" })).toBeEnabled();
  });
  it("shows direct send only for loopback authoring sites and opens the confirmed draft", async () => {
    sites = [{ id: "local-test", url: "http://localhost:54321/", authoring: "api/gaid/" }];
    const openTab = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
      await userEvent.click(dialog.getByRole("button", { name: "외부 허브에 초안 전달" }));
      expect(await dialog.findByText(/외부 허브에 직접 전달했습니다/)).toBeInTheDocument();
      expect(openTab).toHaveBeenCalledWith("http://localhost:54321/#/author/draft-1", "_blank", "noopener,noreferrer");
      expect(dialog.getByRole("link", { name: "전달한 외부 허브 초안 열기" })).toHaveAttribute("href", "http://localhost:54321/#/author/draft-1");
      expect(saveDownload).not.toHaveBeenCalled();
      expect(apiFetch).toHaveBeenCalledWith("/geo/hub/handoff/send", expect.objectContaining({ body: JSON.stringify({ sessionId: "s1", files: ["analysis.py", "plot.png"], note: "", siteId: "local-test" }) }), "p1");
      await userEvent.click(dialog.getByRole("checkbox", { name: /analysis.py/ }));
      expect(dialog.queryByRole("link")).not.toBeInTheDocument();
    } finally { openTab.mockRestore(); }
  });
  it.each(["server-fallback", "network-error"])("downloads and shows the fallback path after %s", async cause => {
    sites = [{ id: "local-test", url: "http://localhost:54321/", authoring: "api/gaid/" }];
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
    if (cause === "network-error") apiFetch.mockRejectedValueOnce(new Error("network"));
    else apiFetch.mockResolvedValueOnce(new Response("gzip", { headers: { "Content-Type": "application/gzip" } }));
    await userEvent.click(dialog.getByRole("button", { name: "외부 허브에 초안 전달" }));
    expect(await dialog.findByText(/다운로드 경로로 전환했습니다/)).toBeInTheDocument();
    expect(saveDownload).toHaveBeenCalledOnce();
    expect(dialog.getByRole("link", { name: "외부 허브에서 초안 시작하기" })).toHaveAttribute("href", "http://localhost:54321/#/author/new?from=gaid");
  });
  it("does not offer direct send for a public hub even with an authoring path", async () => {
    sites[0].authoring = "api/gaid/";
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); const dialog = await open();
    expect(dialog.queryByRole("button", { name: "외부 허브에 초안 전달" })).not.toBeInTheDocument();
  });
  it("sends the chosen files to a new GAID hub draft and opens it in the hub", async () => {
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    const dialog = await open();
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "격자 분석 방법" } });
    await userEvent.click(dialog.getByRole("button", { name: "Connect 초안으로 보내기" }));
    expect(await dialog.findByText("GAID Connect에 새 초안을 만들고 분석 묶음을 자료로 붙였습니다.")).toBeInTheDocument();
    const call = apiFetch.mock.calls.find(([path]) => path === "/geo/authoring/handoffs")!;
    expect(JSON.parse(call[1].body)).toEqual({ sessionId: "s1", files: ["analysis.py", "plot.png"], note: "격자 분석 방법" });
    expect(dialog.getByRole("button", { name: "Connect 초안으로 보내기" })).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", { name: "Connect 초안 열기" }));
    expect(window.location.hash).toBe("#hub/ap-12345678-abc");
    expect(saveDownload).not.toHaveBeenCalled();
  });
  it("offers the chat's research notes and the project's papers for the hub draft", async () => {
    const base = apiFetch.getMockImplementation()!;
    apiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/geo/notes") return json({ notes: [
        { id: "2026-10-23-grid", title: "격자 결과", date: "2026-10-23", sessions: ["s1"] },
        { id: "2026-10-01-old", title: "이전 노트", date: "2026-10-01", sessions: ["s0"] },
      ] });
      if (path.startsWith("/geo/library?")) return json({ items: [{ id: "li-1", title: "Magnetite inversion", authors: "Kim 외", year: 2025 }] });
      return base(path, init);
    });
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />);
    const dialog = await open();
    expect(await dialog.findByRole("checkbox", { name: /격자 결과/ })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /이전 노트/ })).not.toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /Magnetite inversion/ })).toBeChecked();
    await userEvent.click(dialog.getByRole("button", { name: "Connect 초안으로 보내기" }));
    await dialog.findByText("GAID Connect에 새 초안을 만들고 분석 묶음을 자료로 붙였습니다.");
    const call = apiFetch.mock.calls.find(([path]) => path === "/geo/authoring/handoffs")!;
    expect(JSON.parse(call[1].body)).toMatchObject({ notes: ["2026-10-23-grid"], libraryItemIds: ["li-1"] });
  });
  it("shows the final answer without Markdown markers", () => {
    expect(plainMarkdown("## 최종 보고\n- **블록 크기**: `50 km` ([그림](outputs/v.png))")).toBe("최종 보고\n• 블록 크기: 50 km (그림)");
  });
});
