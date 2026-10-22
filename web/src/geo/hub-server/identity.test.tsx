import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import { openSettings } from "@/lib/settings-nav";
import { SharedEntryScreen, useNamedAction } from "@/geo/hub/shared-entry";
import { HUB_USER_KEY, hubUserName, refreshHubIdentity, sharedHub } from "@/geo/hub/shared-api";
import { fixtureDraft } from "@/geo/hub/fixtures";
vi.mock("@/lib/projects", async original => ({ ...await original<typeof import("@/lib/projects")>(), apiFetch: vi.fn() }));
vi.mock("@/lib/settings-nav", () => ({ openSettings: vi.fn() }));
vi.mock("@/lib/use-projects", () => ({ useProjects: () => ({ create: vi.fn() }) }));
vi.mock("@/geo/hub/shared-method", () => ({ SharedMethod: ({ onEdit }: { onEdit?: { mode: string } }) => <p>{onEdit?.mode}</p> }));
let configured: boolean;
let account: boolean;
let mine: boolean | undefined;
let unavailable: boolean;
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear(); localStorage.setItem("gaid:locale", "ko"); localStorage.setItem(HUB_USER_KEY, "stale-browser-name");
  configured = false; account = false; mine = undefined; unavailable = false;
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === "/geo/hub-server/status") return unavailable ? json({ error: "offline" }, 502) : json({ url: configured ? "http://hub.test" : null });
    if (path === "/geo/hub/me") return json({ name: account ? "계정이름" : null, account });
    if (path === "/geo/hub/folders") return json({ folders: [] });
    if (path === "/geo/hub/entries/entry-1") return json({ entry: { id: "entry-1", author: "계정이름", mine, revisions: [], tags: [] }, profile: fixtureDraft().drafts[0].profile, visuals: {}, outputImages: {}, comments: [] });
    return json({ stars: 1, starredByMe: true });
  });
  await refreshHubIdentity();
});
function Action({ run = vi.fn() }: { run?: () => void }) {
  const named = useNamedAction(); return <><button onClick={() => named.run(run)}>act</button>{named.dialog}</>;
}
it("uses the account name and writes without a browser display-name header", async () => {
  configured = account = true; await refreshHubIdentity(); const run = vi.fn(); render(<Action run={run} />);
  fireEvent.click(screen.getByRole("button", { name: "act" })); await waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(hubUserName()).toBe("계정이름"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await sharedHub.star("entry-1", true);
  const init = vi.mocked(apiFetch).mock.calls.find(([p]) => p.endsWith("/star"))?.[1];
  expect(new Headers(init?.headers).has("X-GAID-User")).toBe(false);
  expect(localStorage.getItem(HUB_USER_KEY)).toBe("stale-browser-name");
});
it("routes configured-but-logged-out actions to the Settings card despite a saved browser name", async () => {
  configured = true; await refreshHubIdentity(); const run = vi.fn(); render(<Action run={run} />);
  fireEvent.click(screen.getByRole("button", { name: "act" }));
  await waitFor(() => expect(openSettings).toHaveBeenCalledWith({ tab: "services", section: "gaid-hub-server" }));
  expect(run).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(hubUserName()).toBeNull();
});
it("preserves local display-name entry when no institute hub is configured", async () => {
  localStorage.removeItem(HUB_USER_KEY); const run = vi.fn(); render(<Action run={run} />);
  fireEvent.click(screen.getByRole("button", { name: "act" })); const dialog = await screen.findByRole("dialog");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "로컬이름" } });
  fireEvent.click(screen.getByRole("button", { name: "이름 저장" })); await waitFor(() => expect(run).toHaveBeenCalledOnce());
  expect(dialog).not.toBeInTheDocument(); expect(localStorage.getItem(HUB_USER_KEY)).toBe("로컬이름");
});
it.each([true, false])("uses entry.mine=%s even after the account's display name changes", async (value) => {
  configured = account = true; mine = value; await refreshHubIdentity();
  render(<SharedEntryScreen entryId="entry-1" projects={[]} onOpenSetup={vi.fn()} onOpenDraft={vi.fn()} />);
  expect(await screen.findByText(value ? "edit" : "copy")).toBeInTheDocument();
});
it("does not fall back to local name actions when the hub status cannot be read", async () => {
  unavailable = true; const run = vi.fn(); render(<Action run={run} />);
  fireEvent.click(screen.getByRole("button", { name: "act" }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/hub-server/status", expect.anything()));
  expect(run).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
