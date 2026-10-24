import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import { SkillShelf } from "./shelf";
import { SkillDetail } from "./detail";
import { HubSkillInstall } from "./install";
import { RegisterSkill, RegistrationPreview, canRegister } from "./register";
import { detailFixture, installFixture, previewFixture } from "./fixtures";
import { parseHubHash } from "@/geo/hub/location";

vi.mock("@/lib/projects", async (original) => ({ ...await original<typeof import("@/lib/projects")>(), apiFetch: vi.fn() }));
vi.mock("@/geo/hub/shared-entry", () => ({ useNamedAction: () => ({ run: (f: () => void) => f(), dialog: null }) }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const folders = [{ id: "tables", name: "표 자료", createdBy: "박연구", createdAt: "2026-10-22" }];
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); localStorage.setItem("gaid:hub-user", "다른연구자"); });
afterEach(() => { vi.resetAllMocks(); localStorage.clear(); });

describe("hub skill navigation and shelf", () => {
  it("parses skill routes before authoring routes", () => {
    expect(parseHubHash("#hub/skills")).toMatchObject({ skills: true, projectId: null });
    expect(parseHubHash("#hub/s/table-check")).toMatchObject({ skillId: "table-check" });
    expect(parseHubHash("#hub/s/../../foo").open).toBe(false);
  });
  it("searches and filters the shelf and opens the chosen skill", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => response({ skills: String(url).includes("q=missing") ? [] : [detailFixture().skill] }));
    const onOpen = vi.fn(); render(<SkillShelf folders={folders} onOpen={onOpen} />);
    fireEvent.click(await screen.findByRole("button", { name: /table-check/ })); expect(onOpen).toHaveBeenCalledWith("table-check");
    fireEvent.change(screen.getByRole("combobox", { name: "주제 폴더" }), { target: { value: "tables" } });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("folder=tables"), expect.anything()));
    fireEvent.change(screen.getByRole("searchbox", { name: "Connect 스킬 검색" }), { target: { value: "missing" } });
    await screen.findByText("조건에 맞는 스킬이 없습니다. 검색어나 폴더를 바꾸세요.");
  });
});
describe("skill detail", () => {
  it("renders Markdown, grouped places to read, text files, per-revision reviews and unverified names", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => String(url).includes("/file?") ? new Response("print('read only')") : response(detailFixture()));
    render(<SkillDetail id="table-check" projects={[]} onBack={vi.fn()} onWorkflow={vi.fn()} />);
    await screen.findByRole("heading", { name: "표 자료 확인" });
    expect(screen.getByRole("heading", { name: "볼 곳" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("version 기록과 검토"));
    expect(screen.getByText(/이연구/)).toBeInTheDocument();
    expect(screen.getAllByText(/이름 확인 안 됨/).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: "확인함" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("파일 3개")); fireEvent.click(screen.getByRole("button", { name: "scripts/check.py" }));
    await screen.findByText("print('read only')");
    const old = screen.getByRole("button", { name: "version 1" }); fireEvent.click(old);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("?revision=1"), expect.anything()));
  });
  it("does not offer checking the registrant’s own revision", async () => {
    localStorage.setItem("gaid:hub-user", "박연구"); vi.mocked(apiFetch).mockResolvedValue(response(detailFixture()));
    render(<SkillDetail id="table-check" projects={[]} onBack={vi.fn()} onWorkflow={vi.fn()} />);
    await screen.findByRole("heading", { name: "table-check" });
    fireEvent.click(screen.getByText("검토 기록 남기기"));
    expect(screen.queryByRole("option", { name: "확인함" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "살펴본 내용 또는 바뀐 점" }), { target: { value: "대신 쓸 version을 정했습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "검토 기록 저장" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/revisions/2/review"), expect.objectContaining({ body: expect.stringContaining('"state":"deprecated"') })));
  });
});
describe("pinned install gate", () => {
  it("requires consent, installs the exact revision and resets consent when project or revision changes", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => response(String(url).endsWith("/install") ? { name: "table-check", revision: 2, installed: true } : installFixture()));
    const onInstalled = vi.fn(); const { rerender } = render(<HubSkillInstall skillId="table-check" revision={2} projectId="one" onInstalled={onInstalled} />);
    const button = await screen.findByRole("button", { name: "프로젝트에 설치" }); expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox")); expect(button).toBeEnabled();
    rerender(<HubSkillInstall skillId="table-check" revision={1} projectId="two" onInstalled={onInstalled} />);
    expect(await screen.findByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "프로젝트에 설치" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/hub/skills/table-check/install", expect.objectContaining({ body: JSON.stringify({ projectId: "two", revision: 1, acknowledged: true }) })));
    await waitFor(() => expect(onInstalled).toHaveBeenCalledOnce());
  });
  it.each(["edited", "conflict", "suspended"] as const)("blocks %s without a mutation", async (project) => {
    vi.mocked(apiFetch).mockResolvedValue(response(installFixture({ project })));
    render(<HubSkillInstall skillId="table-check" revision={2} projectId="one" />);
    expect(await screen.findByRole("button", { name: "프로젝트에 설치" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled(); expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it("hides raw errors in technical details and allows retry", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response("internal-path-secret", { status: 500 })).mockResolvedValueOnce(response(installFixture()));
    render(<HubSkillInstall skillId="table-check" revision={2} projectId="one" />);
    const raw = await screen.findByText(/internal-path-secret/); expect(raw.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "다시 읽기" })); await screen.findByRole("checkbox");
  });
});
describe("registration", () => {
  it("keeps unshareable licences author-only and refuses taken, unchanged or blocked previews", () => {
    const preview = previewFixture({ licence: { state: "unknown" }, existing: { id: "table-check", latestRevision: 2, mode: "taken", sameTree: false }, blocked: "taken by internal author" });
    render(<RegistrationPreview preview={preview} />);
    expect(screen.getByText(/올린 사람에게만 보입니다/)).toBeInTheDocument();
    expect(screen.getByText(/다른 사람이 올린 이름/)).toBeInTheDocument();
    expect(screen.getByText("taken by internal author").closest("details")).not.toHaveAttribute("open");
    expect(canRegister(preview)).toBe(false); expect(canRegister(previewFixture({ existing: { id: "table-check", latestRevision: 2, mode: "next", sameTree: true } }))).toBe(false);
    expect(canRegister(previewFixture())).toBe(true);
  });
  it("previews a project skill before registering and adds the next revision explicitly", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => response(String(url).includes("/skills/all") ? { enabled: [{ name: "table-check" }], disabled: [] } : String(url).endsWith("/preview") ? previewFixture({ existing: { id: "table-check", latestRevision: 2, mode: "next", sameTree: false } }) : detailFixture().skill));
    const onRegistered = vi.fn(); render(<RegisterSkill projects={[{ id: "p1", name: "표 연구" }]} folders={folders} onBack={vi.fn()} onRegistered={onRegistered} />);
    fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));
    fireEvent.change(screen.getByRole("combobox", { name: "설치할 프로젝트" }), { target: { value: "p1" } });
    await screen.findByRole("option", { name: "table-check" }); fireEvent.change(screen.getByRole("combobox", { name: "스킬 이름" }), { target: { value: "table-check" } });
    fireEvent.click(screen.getByRole("button", { name: "가져올 내용 확인" }));
    await screen.findByText("같은 이름이 있어 version 3으로 올립니다.");
    expect(apiFetch).not.toHaveBeenCalledWith("/geo/hub/skills", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));
    fireEvent.change(screen.getByRole("textbox", { name: "살펴본 내용 또는 바뀐 점" }), { target: { value: "단위 확인 보강" } });
    fireEvent.change(screen.getByRole("combobox", { name: "주제 폴더" }), { target: { value: "tables" } });
    fireEvent.click(screen.getByRole("button", { name: "스킬 올리기" }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledOnce());
    expect(apiFetch).toHaveBeenCalledWith("/geo/hub/skills", expect.objectContaining({ body: expect.stringContaining('"treeHash":"' + "b".repeat(64)) }));
  });
  it("previews the selected Workflow revision without editing the Workflow", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => response(String(url).endsWith("/entries") ? { entries: [{ id: "table-analysis", title: "표 연구", latestRevision: 3, revisions: [{ revision: 2 }, { revision: 3 }] }] } : previewFixture({ origin: { kind: "workflow", workflow: { entryId: "table-analysis", revision: 2, title: "표 연구" } } })));
    render(<RegisterSkill projects={[]} folders={folders} onBack={vi.fn()} onRegistered={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Connect Workflow에서 꺼내기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "다음 단계" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));
    await screen.findByRole("option", { name: "표 연구" });
    fireEvent.change(screen.getByRole("combobox", { name: "Connect Workflow" }), { target: { value: "table-analysis" } });
    fireEvent.change(screen.getByRole("combobox", { name: "version 기록과 검토" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "가져올 내용 확인" }));
    await screen.findByText("Workflow에서 꺼냄: 표 연구 version 0.1.1");
    expect(apiFetch).toHaveBeenLastCalledWith("/geo/hub/skills/preview", expect.objectContaining({ body: JSON.stringify({ from: "workflow", entryId: "table-analysis", revision: 2 }) }));
  });
  it("offers source skill choices and previews again with the selected name", async () => {
    vi.mocked(apiFetch).mockImplementation(async (_url, init) => response(JSON.parse(init?.body as string).name ? previewFixture() : previewFixture({ choices: ["table-check", "map-check"] })));
    render(<RegisterSkill projects={[]} folders={folders} onBack={vi.fn()} onRegistered={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "GitHub 등에서" })); fireEvent.click(screen.getByRole("button", { name: "다음 단계" }));
    fireEvent.change(screen.getByRole("textbox", { name: "GitHub 저장소 또는 Git URL" }), { target: { value: "owner/repo" } });
    fireEvent.click(screen.getByRole("button", { name: "가져올 내용 확인" }));
    const names = await screen.findByRole("combobox", { name: "스킬 이름" }); fireEvent.change(names, { target: { value: "table-check" } });
    fireEvent.click(screen.getByRole("button", { name: "가져올 내용 확인" }));
    await screen.findByRole("region", { name: "올릴 내용 미리보기" });
    expect(apiFetch).toHaveBeenLastCalledWith("/geo/hub/skills/preview", expect.objectContaining({ body: JSON.stringify({ from: "source", source: "owner/repo", name: "table-check" }) }));
  });
});
