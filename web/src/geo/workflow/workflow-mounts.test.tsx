import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { legacyWorkflowDoc } from "@/geo/contracts/workflow-doc";
import type { LocalMethodSummary, LocalMethodWorkflow } from "@/geo/contracts/methods";
import { MethodDetail } from "@/geo/methods/methods";
import { TaskSetup } from "@/geo/workspace/task-setup";
import { GeoTaskCatalogue } from "@/geo/workspace/task-catalogue";
import { DraftStep } from "@/geo/hub/draft-step";
import { SharedEntryScreen } from "@/geo/hub/shared-entry";
import { CatalogueWorkflowScreen } from "@/geo/hub/catalogue-workflow";
import { fixtureDraft } from "@/geo/hub/fixtures";
import { apiFetch } from "@/lib/projects";
const { shared, hub } = vi.hoisted(() => ({ shared: { entry: vi.fn(), folders: vi.fn(), catalogue: vi.fn(), skillSource: vi.fn(), catalogueSkillSource: vi.fn() }, hub: { workflow: vi.fn() } }));
vi.mock("@/geo/hub/shared-api", () => ({ sharedHub: shared, hubUserName: () => "연구자" }));
vi.mock("@/geo/hub/api", () => ({ hubApi: hub }));
vi.mock("@/lib/projects", async (original) => ({ ...await original<typeof import("@/lib/projects")>(), apiFetch: vi.fn() }));
vi.mock("@/lib/use-projects", () => ({ useProjects: () => ({ create: vi.fn() }) }));
const draft = fixtureDraft().drafts[0];
const doc = legacyWorkflowDoc({ id: "flow", title: { ko: "화면 연결 시험" }, description: null, inputRoles: [], requiredScientificChoices: [], prompt: { ko: "단계를 따르세요." }, expectedArtifacts: [], boundary: null, skills: [{ name: "grid", source: "bundled" }], procedure: [{ id: "check", label: { ko: "자료 점검" }, summary: { ko: "원본 자료를 점검합니다." } }] });
const workflow: LocalMethodWorkflow = { id: "flow", title: doc.title, description: null, disciplines: [], inputRoles: [], requiredScientificChoices: [], prompt: doc.instructions, skillIds: ["local:grid"], environmentProfile: "geo-core", expectedArtifacts: [], boundary: null, exampleCaseIds: [], doc,
  exposure: "method:grid:flow", trials: { count: 0, lastOutcome: null }, readiness: { state: "ready", skills: [], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null } };
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/geo/workflows" ? { catalogue: { state: "ready" }, workflows: [workflow] } : url === "/geo/recipes" ? { categories: [], recipes: [] } : url === "/geo/methods" ? { methods: [] } : { trials: [] }), { headers: { "Content-Type": "application/json" } }));
  hub.workflow.mockResolvedValue({ doc }); shared.catalogue.mockResolvedValue({ doc });
  shared.folders.mockResolvedValue({ folders: [] });
});
it("mounts the document in a project's Workflow detail and keeps the CLI action slot", () => {
  const method = { key: "grid", title: doc.title, summary: null, runtimeName: "grid", origin: { kind: "upload" }, lifecycle: "draft", issues: [], sources: [], workflows: [workflow], recipes: [] } as unknown as LocalMethodSummary;
  render(<MethodDetail method={method} projectId="p1" onClose={vi.fn()} onSetup={vi.fn()} exportAction={() => <span>CLI export slot</span>} />);
  expect(screen.getByText("1. 자료 점검")).toBeInTheDocument();
  expect(screen.getByText("CLI export slot")).toBeInTheDocument();
});
it("mounts the chat-target instruction disclosure in the start summary", () => {
  render(<TaskSetup workflow={workflow} projectId="p1" availableFiles={[]} open onOpenChange={vi.fn()} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByText("AI agent가 받는 지침 보기"));
  expect(screen.getByText(/# Workflow: 화면 연결 시험/)).toHaveTextContent("정하지 않은 조건: 없음");
});
it("opens a built-in panel row's detail without starting its setup", async () => {
  render(<GeoTaskCatalogue projectId="p1" availableFiles={[]}>{(extension) => <>{extension.rows?.map((row) => row.detail && <button key={row.id} onClick={row.detail.onSelect}>{row.detail.label}</button>)}</>}</GeoTaskCatalogue>);
  fireEvent.click(await screen.findByRole("button", { name: "Workflow 상세 보기" }));
  expect(screen.getByText("1. 자료 점검")).toBeInTheDocument();
});
it("loads a built-in hub recommendation as a read-only Workflow page", async () => {
  render(<CatalogueWorkflowScreen id="flow" onBack={vi.fn()} />);
  expect(await screen.findByText("1. 자료 점검")).toBeInTheDocument();
  expect(shared.catalogue).toHaveBeenCalledWith("flow");
});
it("mounts the document on the author's draft screen at the shown revision", async () => {
  render(<DraftStep draft={draft} authoringId="draft-one" trialCount={0} checkIssues={0} rail={null} />);
  expect(await screen.findByText("원본 자료를 점검합니다.")).toBeInTheDocument();
  expect(hub.workflow).toHaveBeenCalledWith("draft-one", draft.revision);
});
it("mounts the registered entry document while preserving its profile and comments", async () => {
  shared.entry.mockResolvedValue({ entry: { id: "entry-one", title: "등록 Workflow", summary: "등록 설명", author: "연구자", folderId: "folder", latestRevision: 1, revisions: [], kind: "workflow", tags: [], stars: 0, starredByMe: false, trials: 0, cover: null }, profile: draft.profile, visuals: {}, outputImages: {}, workflowDoc: doc, comments: [] });
  render(<SharedEntryScreen entryId="entry-one" projects={[]} onOpenSetup={vi.fn()} />);
  expect(await screen.findByText("원본 자료를 점검합니다.")).toBeInTheDocument();
  expect(screen.getByText("AI agent가 받는 지침 보기")).toBeInTheDocument();
});
