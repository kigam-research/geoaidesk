import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUB_FEEDS_SCHEMA, type FeedListResponse, type FeedSource } from "@/geo/contracts/hub-feeds";
import { parseHubHash } from "@/geo/hub/location";
import { apiFetch } from "@/lib/projects";

import { FeedSourcesAdmin } from "./admin-sources";
import { FeedScreen } from "./feeds";

vi.mock("@/lib/projects", async (original) => ({ ...(await original<typeof import("@/lib/projects")>()), apiFetch: vi.fn() }));
const importRequest = vi.hoisted(() => vi.fn());
vi.mock("@/geo/skills/import-request", () => ({ requestSkillImport: importRequest }));
const settings = vi.hoisted(() => vi.fn());
vi.mock("@/lib/settings-nav", async (original) => ({ ...(await original<typeof import("@/lib/settings-nav")>()), openSettings: settings }));

const response = (data: unknown, status = 200) => new Response(data === null ? null : JSON.stringify(data), { status });
const list: FeedListResponse = {
  schema: HUB_FEEDS_SCHEMA,
  connected: true,
  collectedAt: "2026-10-22T12:00:00Z",
  sources: [
    { id: "hess", title: "HESS", publisher: "EGU", homepage: "https://hess.example.org", category: "papers", field: "hydrology", lastFetch: { at: "2026-10-22T12:00:00Z", ok: true, items: 1 } },
    { id: "github-geo-skills", title: "GitHub 지구과학 스킬 검색", publisher: "GitHub", homepage: "https://github.com/topics/agent-skills", category: "skills", field: "general", lastFetch: { at: "2026-10-22T12:00:00Z", ok: false, items: 0, error: "요청이 많습니다." } },
  ],
  items: [
    { id: "a".repeat(32), sourceId: "hess", sourceTitle: "HESS", category: "papers", field: "hydrology", title: "Groundwater recharge in karst", summary: "We estimate recharge.", link: "https://doi.org/10.5194/hess-1", publishedAt: "2026-10-21T00:00:00Z", fetchedAt: "2026-10-22T12:00:00Z" },
    { id: "b".repeat(32), sourceId: "github-geo-skills", sourceTitle: "GitHub 지구과학 스킬 검색", category: "skills", field: "general", title: "muend/geoai-skills", summary: "", link: "https://github.com/muend/geoai-skills", publishedAt: null, fetchedAt: "2026-10-22T12:00:00Z", github: { repo: "muend/geoai-skills", stars: 42 } },
  ],
};
beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => { vi.resetAllMocks(); localStorage.clear(); });

describe("research feeds place", () => {
  it("has its own hub route", () => {
    expect(parseHubHash("#hub/feeds")).toMatchObject({ open: true, feeds: true, projectId: null });
  });

  it("shows original titles as links, the feed summary and source; filters on the server", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => response(list));
    render(<FeedScreen projects={[{ id: "p1", name: "카르스트" }]} />);
    const link = await screen.findByRole("link", { name: /Groundwater recharge in karst/ });
    expect(link).toHaveAttribute("href", "https://doi.org/10.5194/hess-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("We estimate recharge.")).toBeInTheDocument();
    expect(screen.getByText("피드에 요약이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText(/내용은 검토 전입니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "논문" }));
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith(expect.stringContaining("category=papers"), expect.anything()));
    fireEvent.change(screen.getByRole("combobox", { name: "분야" }), { target: { value: "hydrology" } });
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith(expect.stringContaining("field=hydrology"), expect.anything()));
  });

  it("hands a GitHub skill to Settings → Skills of the chosen project, never installing it", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => response(list));
    render(<FeedScreen projects={[{ id: "p1", name: "카르스트" }, { id: "p2", name: "단층" }]} />);
    fireEvent.click(await screen.findByRole("button", { name: "프로젝트로 가져오기" }));
    fireEvent.change(screen.getByRole("combobox", { name: "가져올 프로젝트" }), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("button", { name: "설정에서 가져오기" }));
    expect(importRequest).toHaveBeenCalledWith("p2", "muend/geoai-skills");
    expect(vi.mocked(apiFetch).mock.calls.every(([url]) => String(url).startsWith("/geo/hub/feeds"))).toBe(true);
  });

  it("without a hub server login explains where to connect", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => response({ ...list, connected: false, items: [], sources: [], collectedAt: null }));
    render(<FeedScreen projects={[]} />);
    fireEvent.click(await screen.findByRole("button", { name: "허브 서버 설정 열기" }));
    expect(settings).toHaveBeenCalledWith({ tab: "services", section: "gaid-hub-server" });
  });

  it("shows a readable failure with the technical detail collapsed", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => response({ error: "연결한 허브 서버가 자료 소식을 지원하지 않습니다." }, 404));
    render(<FeedScreen projects={[]} />);
    expect(await screen.findByText("자료 소식을 읽지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("기술 정보")).toBeInTheDocument();
  });
});

describe("feed sources for administrators", () => {
  const source = (id: string, state: FeedSource["state"], builtIn = true): FeedSource => ({
    id, kind: "feed", title: id.toUpperCase(), publisher: "EGU", homepage: "https://example.org", url: `https://example.org/${id}.xml`,
    category: "papers", field: "hydrology", reason: "수문 학술지입니다.", state, builtIn,
  });
  it("approves every proposal, stops an approved one and deletes only additions", async () => {
    const calls: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url} ${init?.body ?? ""}`);
      if (method === "DELETE") return response(null, 204);
      if (method !== "GET") return response(source("x", "approved"));
      return response({ sources: [source("hess", "proposed"), source("nhess", "proposed"), source("os", "approved"), source("mine", "stopped", false)] });
    });
    render(<FeedSourcesAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "제안 모두 승인" }));
    await waitFor(() => expect(calls.filter((c) => c.startsWith("PATCH"))).toHaveLength(2));
    expect(calls).toContain('PATCH /geo/hub-server/admin/feeds/sources/hess {"state":"approved"}');
    await waitFor(() => expect(screen.getByRole("button", { name: "멈추기" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    await waitFor(() => expect(calls).toContain('PATCH /geo/hub-server/admin/feeds/sources/os {"state":"stopped"}'));
    expect(screen.getAllByRole("button", { name: "지우기" })).toHaveLength(1);
  });
});
