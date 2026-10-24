import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DigestCandidate } from "@/geo/contracts/library";
import type { GeoStartTaskDetail, GeoWorkflowSummary } from "@/geo/contracts/workspace";
import type { Workflow } from "@/components/workflows-panel";
import { DigestChoice, DigestSummary, digestSettings, useDigestCandidates } from "./digest-choice";
import { TaskSetup } from "./task-setup";
import { UpstreamStart } from "./upstream-start";
import { onStartGeoTask } from "./events";

const { getDigestCandidates, getWorkflowPapers } = vi.hoisted(() => ({ getDigestCandidates: vi.fn(), getWorkflowPapers: vi.fn(async () => ({ papers: [] })) }));
vi.mock("@/geo/library/api", () => ({ getDigestCandidates, getWorkflowPapers }));
vi.mock("@/geo/library/add-paper-dialog", () => ({ AddPaperDialog: () => null }));

const gaid: DigestCandidate = { itemId: "li-aaaaaaaaaaaa", title: "광체 연구 문헌 정리", origin: "gaid", status: "pending", date: "2026-10-24", covered: 2, total: 2, recommended: true, newPapers: 0, papers: [{ key: "hong2026", title: "Original" }] };
const external: DigestCandidate = { ...gaid, itemId: "li-bbbbbbbbbbbb", title: "Gemini에서 가져온 정리", origin: "external", recommended: false, covered: 1, newPapers: 1 };
const workflow: GeoWorkflowSummary = {
  id: "test", title: { ko: "광체 연구" }, description: { ko: "논문의 결과를 비교합니다." }, disciplines: [], inputRoles: [], requiredScientificChoices: [],
  prompt: null, skillIds: [], environmentProfile: "geo-core", expectedArtifacts: [], boundary: null, exampleCaseIds: [],
  readiness: { state: "ready", skills: [], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null },
  doc: { schemaVersion: "gaid-workflow/v1", kind: "structured", id: "test", title: { ko: "광체 연구" }, version: null, purpose: null, inputRoles: [], choices: [], skills: [], steps: [], artifacts: [], boundary: null, instructions: null },
};
beforeEach(() => {
  window.localStorage.clear(); Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] });
  getDigestCandidates.mockReset().mockResolvedValue({ digests: [gaid, external] });
});

describe("digest selection", () => {
  it("pre-selects only a recommended GAID digest and retains explicit none on refresh", async () => {
    const { result } = renderHook(() => useDigestCandidates("p1", "ore"));
    await waitFor(() => expect(result.current.selected).toEqual(gaid));
    expect(getDigestCandidates).toHaveBeenCalledWith("p1", "ore");
    act(() => result.current.choose(null));
    await act(() => result.current.reload());
    expect(result.current.selected).toBeNull();
    act(() => result.current.choose(external.itemId));
    await act(() => result.current.reload());
    expect(result.current.selected).toEqual(external);
    expect(digestSettings(result.current.selected)).toEqual({ key: `digest:${external.itemId}`, title: external.title, origin: "external", status: "pending", covers: ["hong2026"] });
  });

  it.each([[external], [{ ...external, recommended: true }], [{ ...gaid, recommended: false }]])("does not auto-select external or un-recommended candidates: %j", async (candidate) => {
    getDigestCandidates.mockResolvedValue({ digests: [candidate] });
    const { result } = renderHook(() => useDigestCandidates("p1", null));
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(result.current.selected).toBeNull();
  });

  it("shows radio choices, review state and reference-only limits, and hides empty choices", async () => {
    function Harness() { const state = useDigestCandidates("p1", null); return <DigestChoice state={state} />; }
    const view = render(<Harness />);
    const recommended = await screen.findByRole("radio", { name: /광체 연구 문헌 정리/ });
    expect(recommended).toHaveAttribute("aria-checked", "true");
    const imported = screen.getByRole("radio", { name: /Gemini에서 가져온 정리/ });
    expect(imported).toHaveTextContent("외부 정리"); expect(imported).toHaveTextContent("참고로만 읽음");
    expect(imported).toHaveTextContent("검토 전"); expect(imported).toHaveTextContent("논문 1편이 더해졌습니다");
    await userEvent.click(imported); expect(imported).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: /정리 없이 시작/ }));
    expect(imported).toHaveAttribute("aria-checked", "false");
    view.unmount();
    const empty = render(<DigestChoice state={{ candidates: [], selected: null, failed: false, choose: vi.fn(), reload: vi.fn(), reset: vi.fn() }} />);
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("keeps project scopes separate and ignores an earlier response that arrives late", async () => {
    let resolveOld!: (value: { digests: DigestCandidate[] }) => void;
    getDigestCandidates.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue({ digests: [external] });
    const { result, rerender } = renderHook(({ project }) => useDigestCandidates(project, null), { initialProps: { project: "old" } });
    rerender({ project: "new" });
    await waitFor(() => expect(result.current.candidates).toEqual([external]));
    await act(async () => resolveOld({ digests: [gaid] }));
    expect(result.current.candidates).toEqual([external]);
    expect(result.current.selected).toBeNull();
  });

  it("shows the summary note and Edit back to the introduction", async () => {
    const edit = vi.fn();
    render(<DigestSummary state={{ candidates: [gaid], selected: gaid, failed: false, choose: vi.fn(), reload: vi.fn(), reset: vi.fn() }} onEdit={edit} />);
    expect(screen.getByText("GAID에서 만듦 · 검토 전")).toBeInTheDocument();
    expect(screen.getByText("인용은 원래 논문의 쪽으로 겁니다.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "먼저 읽을 정리 수정" }));
    expect(edit).toHaveBeenCalled();
  });
});

it("carries the choice from the introduction through the summary into the chat instruction block", async () => {
  render(<TaskSetup workflow={workflow} projectId="p1" availableFiles={[]} open onOpenChange={vi.fn()} onRefresh={vi.fn()} />);
  await screen.findByRole("radio", { name: /광체 연구 문헌 정리/ });
  await userEvent.click(screen.getByRole("tab", { name: /요약/ }));
  expect(screen.getByText(gaid.title)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "먼저 읽을 정리 수정" }));
  expect(screen.getByRole("radio", { name: /광체 연구 문헌 정리/ })).toHaveAttribute("aria-checked", "true");
  await userEvent.click(screen.getByRole("radio", { name: /Gemini에서 가져온 정리/ }));
  await userEvent.click(screen.getByRole("tab", { name: /요약/ }));
  expect(screen.getByText("외부 정리 · 검토 전")).toBeInTheDocument();
  expect(screen.getByText(/참고로만 읽고, 인용은/)).toBeInTheDocument();
  const listener = vi.fn((detail: GeoStartTaskDetail) => { detail.result = "opened"; }), unsubscribe = onStartGeoTask(listener);
  await userEvent.click(screen.getByRole("button", { name: "시작 초안 만들기" }));
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ workflowBlock: expect.stringContaining(`<library-digest key="digest:${external.itemId}" status="pending" origin="external" covers="hong2026">`) }));
  unsubscribe();
});

it("offers digests for a general Workflow and adds the same first-reading instructions to its prompt", async () => {
  const general = { id: "summarize-paper", name: "Summarize", description: "Summary", category: "research", prompt: "Summarize the paper", placeholders: [], requiresFiles: false } as unknown as Workflow;
  render(<UpstreamStart workflow={general} projectId="p1" open onOpenChange={vi.fn()} />);
  await screen.findByRole("radio", { name: /광체 연구 문헌 정리/ });
  await userEvent.click(screen.getByRole("tab", { name: /요약/ }));
  const listener = vi.fn((detail: GeoStartTaskDetail) => { detail.result = "opened"; }), unsubscribe = onStartGeoTask(listener);
  await userEvent.click(screen.getByRole("button", { name: "시작 초안 만들기" }));
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining(`key="digest:${gaid.itemId}"`) }));
  unsubscribe();
});

it("treats a malformed candidate response as unavailable without breaking Workflow setup", async () => {
  getDigestCandidates.mockResolvedValue({ skills: [] });
  const { result } = renderHook(() => useDigestCandidates("p1", null));
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.candidates).toEqual([]);
  expect(result.current.selected).toBeNull();
});
