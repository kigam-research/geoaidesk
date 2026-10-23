import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import type { HubAccount, HubServerStatus } from "@/geo/contracts/hub-server";
import { HubServerCard } from "./card";
import { HUB_CONNECTION_CHANGED } from "./api";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const account: HubAccount = { id: "acc-1", email: "kim@example.org", displayName: "김연구", role: "admin", createdAt: "2026-10-22T01:00:00Z" };
let status: HubServerStatus;
let users: HubAccount[];
let patchConflict: boolean;
let invites: unknown[];
const calls = () => vi.mocked(apiFetch).mock.calls;
beforeEach(() => {
  localStorage.clear(); localStorage.setItem("gaid:locale", "ko"); vi.clearAllMocks();
  status = { url: "http://hub.test:8020", fromEnv: false, account: null, reachable: true, server: { name: "hub", version: "0.1.0", serverId: "server-id-not-visible" } };
  users = [account, { ...account, id: "acc-2", email: "lee@example.org", displayName: "이연구", role: "member" }];
  invites = []; patchConflict = false;
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path.endsWith("/status")) return json(status);
    if (path.endsWith("/config")) { status = { ...status, url: body.url, account: null }; return json(status); }
    if (path.endsWith("/login") || path.endsWith("/accept-invite")) { status = { ...status, account }; return json(status); }
    if (path.endsWith("/logout")) { status = { ...status, account: null }; return json(status); }
    if (path.endsWith("/me")) { status = { ...status, account: { ...account, displayName: body.displayName ?? account.displayName } }; return json(status); }
    if (path.endsWith("/admin/users")) return json({ users });
    if (path.includes("/admin/users/")) {
      if (patchConflict) return json({ error: "internal last_admin" }, 409);
      const user = users.find(u => path.endsWith(u.id))!;
      Object.assign(user, body, body.disabled ? { disabledAt: "2026-10-22" } : { disabledAt: undefined }); return json(user);
    }
    if (path.endsWith("/admin/invites") && init?.method === "POST") {
      const invite = { id: "invite-1", ...body, createdAt: "2026-10-22", expiresAt: "2026-10-29T01:00:00Z", createdBy: account.id, code: "one-time-code" };
      invites = [{ ...invite, code: undefined }]; return json(invite);
    }
    if (path.endsWith("/admin/invites")) return json({ invites });
    if (path.includes("/admin/invites/") && init?.method === "DELETE") { invites = []; return new Response(null, { status: 204 }); }
    return json({ error: "not found" }, 404);
  });
});
const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole("button", { name }));
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
it("connects, signs in and logs out through the local backend without browser credential persistence", async () => {
  status.url = null;
  const changed = vi.fn(); window.addEventListener(HUB_CONNECTION_CHANGED, changed);
  render(<HubServerCard />);
  await screen.findByText("기관 허브를 연결하지 않았습니다.");
  await waitFor(() => expect(screen.getByLabelText("허브 서버 주소")).toBeEnabled());
  change("허브 서버 주소", "http://hub.test:8020"); await click("허브 연결");
  await screen.findByRole("button", { name: "계정 로그인" });
  expect(screen.getByText(/비밀번호와 파일을 암호화하지 않습니다/)).toBeVisible();
  change("이메일", "kim@example.org"); change("비밀번호", "sample-secret"); await click("계정 로그인");
  await screen.findByText("김연구");
  expect(calls().find(([p]) => p.endsWith("/login"))?.[1]?.body).toBe(JSON.stringify({ email: "kim@example.org", password: "sample-secret" }));
  expect(JSON.stringify(localStorage)).not.toContain("sample-secret");
  expect(screen.queryByText("server-id-not-visible")).not.toBeInTheDocument();
  await click("계정 로그아웃"); await screen.findByRole("button", { name: "계정 로그인" });
  expect(changed).toHaveBeenCalledTimes(3); window.removeEventListener(HUB_CONNECTION_CHANGED, changed);
});
it("keeps environment addresses disabled and offers no disconnect", async () => {
  status.fromEnv = true; render(<HubServerCard />); await screen.findByText("기관 허브에 연결했습니다.");
  fireEvent.click(await screen.findByText("연결 주소 설정"));
  expect(screen.getByLabelText("허브 서버 주소")).toBeDisabled();
  expect(screen.getByText(/시작 환경에서 정한 주소/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "연결 끊기" })).not.toBeInTheDocument();
});
it("does not submit mismatched invite passwords and applies shared password rules", async () => {
  render(<HubServerCard />); await click("초대 코드로 가입");
  change("초대 코드", "invite-123"); change("표시 이름", "신연구"); change("비밀번호", "long-password"); change("비밀번호 재입력", "mismatched");
  expect(screen.getByLabelText("비밀번호")).toHaveAttribute("minlength", "10");
  await click("계정 만들기"); expect(await screen.findByRole("alert")).toHaveTextContent("비밀번호가 일치하지 않습니다");
  expect(calls().some(([p]) => p.endsWith("/accept-invite"))).toBe(false);
  change("비밀번호 재입력", "long-password"); await click("계정 만들기"); await screen.findByText("김연구");
  expect(calls().find(([p]) => p.endsWith("/accept-invite"))?.[1]?.body).toBe(JSON.stringify({ code: "invite-123", displayName: "신연구", password: "long-password" }));
});
it("updates display name and password, then removes the server address", async () => {
  status.account = account; render(<HubServerCard />); await click("표시 이름 변경");
  change("표시 이름", "새이름"); await click("계정 변경 저장"); await screen.findByText("새이름");
  await click("비밀번호 변경"); change("현재 비밀번호", "old-password"); change("새 비밀번호", "new-password"); change("비밀번호 재입력", "new-password"); await click("계정 변경 저장");
  await waitFor(() => expect(screen.queryByLabelText("현재 비밀번호")).not.toBeInTheDocument());
  expect(calls().filter(([p]) => p.endsWith("/me")).at(-1)?.[1]?.body).toBe(JSON.stringify({ password: { current: "old-password", next: "new-password" } }));
  fireEvent.click(screen.getByText("연결 주소 설정")); await click("연결 끊기");
  await screen.findByText("기관 허브를 연결하지 않았습니다.");
});
it("shows admin members, role changes and reversible account suspension; explains last-admin rejection", async () => {
  status.account = account; render(<HubServerCard />); fireEvent.click(await screen.findByText("허브 서버 관리"));
  const userRow = (await screen.findByText("이연구")).closest("li")!;
  fireEvent.click(within(userRow).getByRole("button", { name: "관리자로 변경" }));
  await waitFor(() => expect(within(userRow).getByRole("button", { name: "계정 사용 중지" })).toBeEnabled());
  expect(users[1].role).toBe("admin");
  fireEvent.click(within(userRow).getByRole("button", { name: "계정 사용 중지" }));
  await screen.findByText("사용 중지됨");
  fireEvent.click(within(userRow).getByRole("button", { name: "계정 사용 재개" }));
  await waitFor(() => expect(screen.queryByText("사용 중지됨")).not.toBeInTheDocument());
  patchConflict = true;
  fireEvent.click(within(userRow).getByRole("button", { name: "구성원으로 변경" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("마지막 관리자는 구성원으로 바꾸거나 사용을 중지할 수 없습니다.");
  expect(screen.getByText("internal last_admin").closest("details")).not.toHaveAttribute("open");
});
it("creates an invite, shows/copies its code only in the creation view and revokes unused invites", async () => {
  status.account = account; const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const { unmount } = render(<HubServerCard />); fireEvent.click(await screen.findByText("허브 서버 관리")); await click("초대");
  change("이메일", "new@example.org"); await click("초대 만들기"); await screen.findByText("one-time-code");
  expect(screen.getByText(/코드는 지금만 표시/)).toBeInTheDocument(); await click("초대 코드 복사"); expect(writeText).toHaveBeenCalledWith("one-time-code");
  await click("코드 닫기"); expect(screen.queryByText("one-time-code")).not.toBeInTheDocument();
  unmount(); render(<HubServerCard />); fireEvent.click(await screen.findByText("허브 서버 관리")); await click("초대");
  expect(screen.queryByText("one-time-code")).not.toBeInTheDocument(); await click("초대 취소"); await screen.findByText("만든 초대가 없습니다.");
});
it("does not show admin controls for a member and keeps failures retryable", async () => {
  status.account = { ...account, role: "member" }; const impl = vi.mocked(apiFetch).getMockImplementation()!;
  vi.mocked(apiFetch).mockImplementationOnce(async () => json({ error: "private backend failure" }, 502));
  render(<HubServerCard />); expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
  expect(screen.getByText("private backend failure").closest("details")).not.toHaveAttribute("open");
  vi.mocked(apiFetch).mockImplementation(impl); await click("상태 새로 읽기"); await screen.findByText("김연구");
  expect(screen.queryByText("허브 서버 관리")).not.toBeInTheDocument();
});
