import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import { apiFetch } from "@/lib/projects";
import { openMethodSetup } from "@/geo/hub/handoff";
import { RecipeAdd } from "@/geo/workspace/recipe-add";
import { HubPicker } from "./hub-picker";

vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
vi.mock("@/geo/hub/handoff", () => ({ openMethodSetup: vi.fn() }));
vi.mock("@/geo/workspace/task-setup", () => ({ fieldClass: "field" }));
vi.mock("@/components/workflows-panel", () => ({ WORKFLOW_CATEGORIES: [] }));
export const entry = (over: Partial<HubEntry> = {}): HubEntry => ({
  id: "entry-paper", methodId: "local/paper", slug: "paper", title: "논문 분석", tagline: "암상 분류", summary: "분류 설정", kind: "workflow", implementation: "descriptive", recipe: true,
  tags: [], author: "연구자", folderId: "general", cover: null, latestRevision: 2, revisions: [{ revision: 1, version: "0.1.0" }, { revision: 2, version: "0.2.0" }] as HubEntry["revisions"], stars: 3, starredByMe: false, comments: 0, trials: 0, updatedAt: "2026-10-20", ...over,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  localStorage.clear(); localStorage.setItem("gaid:locale", "ko"); localStorage.setItem("gaid:hub-user", "연구자");
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === "/geo/skill-hub/preview") return json({ skills: [{ name: "paper", files: 1 }], contents: [{ name: "paper", files: ["SKILL.md"], hasCode: false, prompts: [{ ko: "분석해 주세요." }] }] });
    if (path === "/geo/methods") return json({ methods: [] });
    if (path === "/geo/hub/entries/entry-paper/install") return json({ install: { methodKey: "project:paper" }, workflowId: "classify", recipeId: "defaults" });
    return json({ entries: [entry(), entry({ id: "entry-skill", title: "스킬만", kind: "skill", recipe: false })] });
  });
});
it("filters recipes, shows metadata and searches with the shared hub client", async () => {
  const onSelect = vi.fn();
  render(<HubPicker recipesOnly onSelect={onSelect} />);
  expect(screen.getByRole("status")).toHaveTextContent("Connect 목록을 읽는 중");
  fireEvent.click(await screen.findByRole("button", { name: /논문 분석/ }));
  expect(screen.queryByText("스킬만")).not.toBeInTheDocument();
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ latestRevision: 2 }));
  expect(screen.getByText("version 0.2.0")).toBeInTheDocument(); expect(screen.getByText("★ 3")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "암상" } });
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/hub/entries?q=%EC%95%94%EC%83%81", expect.anything()));
});
it("recovers a failed list and explains the empty filtered state without raw errors", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(json({ error: "private server failure" }, 500)).mockResolvedValueOnce(json({ entries: [entry({ recipe: false })] }));
  render(<HubPicker recipesOnly onSelect={vi.fn()} />);
  expect(await screen.findByRole("alert")).not.toHaveTextContent("private server failure");
  fireEvent.click(screen.getByRole("button", { name: "목록 다시 읽기" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/저장한 시작 설정이 있는 Workflow|Connect 목록을 읽는 중/);
  await screen.findByText(/저장한 시작 설정이 있는 Workflow가 없습니다/);
});
it("ignores an old search response", async () => {
  let resolve!: (response: Response) => void;
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  render(<HubPicker onSelect={vi.fn()} />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "new" } });
  await screen.findByText("논문 분석");
  await act(async () => resolve(json({ entries: [entry({ title: "stale" })] })));
  expect(screen.queryByText("stale")).not.toBeInTheDocument();
});
function recipeDialog() {
  render(<RecipeAdd projectId="p1" workflows={[]} categories={[]} onSaved={vi.fn()} onOpen={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Connect에서 가져오기" }));
  return screen.getByRole("dialog");
}
it("RecipeAdd installs the shown revision only after acknowledgement and hands off the recipe", async () => {
  const dialog = recipeDialog();
  expect(within(dialog).getByRole("button", { name: "Connect에서 찾기" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(await screen.findByRole("button", { name: /논문 분석/ }));
  const install = screen.getByRole("button", { name: "설치 후 시작 설정 열기" });
  expect(install).toBeDisabled(); expect(openMethodSetup).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(install);
  await waitFor(() => expect(openMethodSetup).toHaveBeenCalledWith({ projectId: "p1", methodKey: "project:paper", workflowId: "classify", recipeId: "defaults" }));
  expect(apiFetch).toHaveBeenCalledWith("/geo/hub/entries/entry-paper/install", expect.objectContaining({ body: JSON.stringify({ projectId: "p1", acknowledged: true, revision: 2 }) }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("opens an already installed recipe without installing over local edits", async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => path === "/geo/methods" ? json({ methods: [{ enabled: true, methodId: "local/paper", key: "project:paper", workflows: [{ id: "classify" }], recipes: [{ id: "local-defaults", workflowId: "classify" }], editedLocally: true }] }) : json({ entries: [entry()] }));
  recipeDialog(); fireEvent.click(await screen.findByRole("button", { name: /논문 분석/ }));
  expect(await screen.findByText(/이미 사용할 수 있습니다/)).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "시작 설정 열기" }));
  expect(openMethodSetup).toHaveBeenCalledWith(expect.objectContaining({ recipeId: "local-defaults" }));
  expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path.endsWith("/install"))).toBe(false);
});
it("keeps failed installation retryable and does not require hub identity to install", async () => {
  localStorage.removeItem("gaid:hub-user");
  const implementation = vi.mocked(apiFetch).getMockImplementation()!;
  vi.mocked(apiFetch).mockImplementation(async (path, ...args) => path.endsWith("/install") ? json({ error: "HTTP 500 internal" }, 500) : implementation(path, ...args));
  recipeDialog(); fireEvent.click(await screen.findByRole("button", { name: /논문 분석/ }));
  const install = screen.getByRole("button", { name: "설치 후 시작 설정 열기" }); expect(install).toBeDisabled();
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(install);
  expect(await screen.findByRole("alert")).toHaveTextContent("Workflow를 설치하지 못했습니다");
  expect(screen.getByRole("alert")).not.toHaveTextContent("internal"); expect(install).toBeEnabled();
  expect(openMethodSetup).not.toHaveBeenCalled();
});
it("keeps the existing file-import controls available as the second route", () => {
  const dialog = recipeDialog(); fireEvent.click(within(dialog).getByRole("button", { name: "파일에서 가져오기" }));
  expect(within(dialog).getByLabelText("Geo 작업 저장한 시작 설정 파일")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "저장한 시작 설정 저장" })).toBeDisabled();
});
it("opens disabled installed methods for inspection rather than reinstalling them", async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => path === "/geo/methods" ? json({ methods: [{ enabled: false, methodId: "local/paper", key: "project:paper", workflows: [], recipes: [] }] }) : json({ entries: [entry()] }));
  recipeDialog(); fireEvent.click(await screen.findByRole("button", { name: /논문 분석/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Workflow 열기" }));
  expect(openMethodSetup).toHaveBeenCalledWith({ projectId: "p1", methodKey: "project:paper", workflowId: null, recipeId: null });
  expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path.endsWith("/install"))).toBe(false);
});
