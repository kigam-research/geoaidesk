import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LegacySkillHubInstall as SkillHubInstall, SkillHubInstall as HubSkillInstall, SkillHubPreviewNotes } from "./skill-hub";
import { SkillsPanel } from "@/components/skills-panel";
import { apiFetch } from "@/lib/projects";
import { installSkills } from "@/lib/capabilities";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/use-projects", () => ({ useProjects: () => ({ activeProjectId: "test", activeProject: { name: "Test" } }) }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => ({ confirm: vi.fn(), dialog: null }) }));
vi.mock("@/lib/capabilities", async (original) => ({ ...await original<typeof import("@/lib/capabilities")>(), getAllSkills: vi.fn().mockResolvedValue({ enabled: [], disabled: [], problems: [], shadowed: [] }), installSkills: vi.fn().mockResolvedValue({ installed: ["example"], conflicts: [] }) }));
const result = { source: "/durable/sha", stagingKey: "key", stagingToken: "reviewed", skills: [{ name: "example", description: "Example description", installed: false, files: 1 }], problems: [], skillHub: { sha256: "a".repeat(64), catalogueAvailable: true, catalogueNames: ["example"] } };
beforeEach(() => {
  localStorage.setItem("gaid:locale", "en");
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/geo/skill-hub" ? { sites: [{ id: "atlas", url: "https://kigam-research.github.io/skill-atlas/" }] } : url === "/geo/skill-hub/methods" ? { hubs: [] } : url === "/geo/hub/entries" ? { entries: [] } : result), { headers: { "Content-Type": "application/json" } }));
});
it("opens the configured site in a new tab and submits page URLs with explicit project/scope", async () => {
  const onPreview = vi.fn();
  render(<SkillHubInstall scope="global" projectId="test" onStart={vi.fn()} onPreview={onPreview} onError={vi.fn()} />);
  const link = await screen.findByRole("link", { name: "Find skills on skill_hub" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  fireEvent.change(screen.getByLabelText("Skill page URL"), { target: { value: "https://kigam-research.github.io/skill-atlas/#/skills/kigam/example" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview skill" }));
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith(result));
  expect(apiFetch).toHaveBeenLastCalledWith("/geo/skill-hub/preview?scope=global", expect.objectContaining({ method: "POST", body: expect.stringContaining('"scope":"global"') }), "test");
});
it("submits downloaded packages and reports server validation errors", async () => {
  const onError = vi.fn();
  render(<SkillHubInstall scope="project" projectId="test" onStart={vi.fn()} onPreview={vi.fn()} onError={onError} />);
  await screen.findByRole("link");
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: "archive" }), { status: 400 }));
  fireEvent.change(screen.getByLabelText("Skill file bundle file (.tar.gz)"), { target: { files: [new File(["bytes"], "example.tar.gz")] } });
  fireEvent.click(screen.getByRole("button", { name: "Preview file bundle" }));
  await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Links and parent paths are not allowed")));
  expect(apiFetch).toHaveBeenLastCalledWith("/geo/skill-hub/preview?scope=project", expect.objectContaining({ body: expect.any(FormData) }), "test");
});
it("does not deliver a stale preview after project/scope unmount", async () => {
  let finish!: (value: Response) => void;
  const onPreview = vi.fn();
  const pane = render(<SkillHubInstall scope="project" projectId="test" onStart={vi.fn()} onPreview={onPreview} onError={vi.fn()} />);
  await screen.findByRole("link");
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  fireEvent.change(screen.getByLabelText("Skill page URL"), { target: { value: "https://example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview skill" }));
  pane.unmount();
  await act(async () => { finish(new Response(JSON.stringify(result))); });
  expect(onPreview).not.toHaveBeenCalled();
});
it("SkillsPanel reuses acknowledgement and the reviewed staging token on installation", async () => {
  render(<SkillsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /^Add$/ }));
  fireEvent.click(screen.getByText("Previous skill_hub"));
  await screen.findByRole("link", { name: "Find skills on skill_hub" });
  fireEvent.change(screen.getByLabelText("Skill page URL"), { target: { value: "https://kigam-research.github.io/skill-atlas/#/skills/kigam/example" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview skill" }));
  await screen.findByText("Example description");
  expect(screen.getByText(/default catalogue includes/)).toBeInTheDocument();
  const install = screen.getByRole("button", { name: "Install 1 skill" });
  expect(install).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Trust this source" }));
  expect(install).toBeEnabled();
  fireEvent.click(install);
  await waitFor(() => expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ source: "/durable/sha", names: ["example"], stagingToken: "reviewed", acknowledged: true, scope: "project" })));
});

it("lists hub packages and previews the descriptor through the existing gate", async () => {
  const descriptorUrl = "https://hub.test/api/gaid/packages/local/paper/2";
  vi.mocked(apiFetch).mockImplementation(async (url) => new Response(JSON.stringify(
    url === "/geo/skill-hub" ? { sites: [] } : url === "/geo/skill-hub/methods" ? { hubs: [
      { siteId: "local-hub", url: "https://hub.test", state: "ok", methods: [{ methodId: "local/paper", revision: 2, version: "0.2.0", title: { ko: "논문", en: "Paper package" }, lifecycle: "submitted", implementation: "descriptive", createdAt: "2026-10-15T12:00:00Z", descriptorUrl }] },
      { siteId: "offline-hub", url: "https://offline.test", state: "error", detail: "Hub offline", methods: [] },
    ] } : result)));
  const onPreview = vi.fn();
  render(<SkillHubInstall projectId="p1" scope="project" onStart={vi.fn()} onPreview={onPreview} onError={vi.fn()} />);
  expect(await screen.findByText("Paper package")).toBeInTheDocument(); expect(screen.getByText(/Submitted · Instructions only/)).toBeInTheDocument(); expect(screen.getByRole("alert")).toHaveTextContent("Hub offline");
  fireEvent.click(screen.getAllByRole("button", { name: "Preview file bundle" })[0]);
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith(result));
  expect(apiFetch).toHaveBeenLastCalledWith("/geo/skill-hub/preview?scope=project", expect.objectContaining({ body: JSON.stringify({ url: descriptorUrl, scope: "project" }) }), "p1");
});

it("shows hub draft identity, revision and effective lifecycle in preview notes", () => {
  render(<SkillHubPreviewNotes preview={{ ...result, skillHub: { ...result.skillHub, draft: { methodId: "local/paper", revision: 2, lifecycle: "draft", url: "https://hub.test/api/gaid/packages/local/paper/2" } } }} />);
  expect(screen.getByText("Hub method: local/paper · revision 2 · Draft")).toBeInTheDocument();
  expect(screen.getByText(/Changes on the site are not fetched automatically/)).toBeInTheDocument();
});

const hubEntry = { id: "entry-paper", methodId: "local/paper", title: "Hub skill", tagline: "Skill package", author: "Researcher", stars: 4, latestRevision: 3, kind: "skill", recipe: false };
it("previews the selected shared-hub revision with project and scope and leaves legacy collapsed", async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/geo/hub/entries" ? { entries: [hubEntry] } : result)));
  const onPreview = vi.fn();
  render(<HubSkillInstall scope="global" projectId="test" onStart={vi.fn()} onPreview={onPreview} onError={vi.fn()} />);
  expect(screen.queryByLabelText("Skill page URL")).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /Hub skill/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preview file bundle" }));
  await waitFor(() => expect(onPreview).toHaveBeenCalledWith(result));
  expect(apiFetch).toHaveBeenLastCalledWith("/geo/skill-hub/preview", expect.objectContaining({ body: JSON.stringify({ hubEntry: { id: "entry-paper", revision: 3 }, scope: "global" }) }), "test");
  expect(vi.mocked(apiFetch).mock.calls.some(([url]) => url === "/geo/skill-hub/methods")).toBe(false);
});
it("SkillsPanel shared-hub preview uses the same explicit trust and staging-token install gate", async () => {
  vi.mocked(apiFetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/geo/hub/entries" ? { entries: [hubEntry] } : result)));
  render(<SkillsPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /^Add$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Hub skill/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preview file bundle" }));
  await screen.findByText("Example description");
  const install = screen.getByRole("button", { name: "Install 1 skill" }); expect(install).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Trust this source" })); fireEvent.click(install);
  await waitFor(() => expect(installSkills).toHaveBeenCalledWith(expect.objectContaining({ stagingToken: "reviewed", acknowledged: true, scope: "project" })));
});
