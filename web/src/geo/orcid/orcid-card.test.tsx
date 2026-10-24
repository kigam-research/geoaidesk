import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrcidCard } from "./orcid-card";
import { getOrcid, linkOrcid, startOrcidAuth, unlinkOrcid, unlinkOrcidAuth } from "./api";
vi.mock("./api", async (importOriginal) => ({ ...await importOriginal<typeof import("./api")>(), linkOrcid: vi.fn(), unlinkOrcid: vi.fn(), getOrcid: vi.fn(), startOrcidAuth: vi.fn(), unlinkOrcidAuth: vi.fn() }));
const props = { onStatus: vi.fn(), onChanged: vi.fn(), onRetry: vi.fn(), onImport: vi.fn(), loadError: false };
beforeEach(() => { vi.mocked(getOrcid).mockResolvedValue({ profile: null, ownWorks: 0, hub: { state: "no-account" } }); localStorage.setItem("gaid:locale", "ko"); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("validates iDs locally and normalizes a pasted record URL before linking", async () => {
  vi.mocked(linkOrcid).mockResolvedValue({ profile: null, ownWorks: 0, hub: { state: "no-account" } });
  render(<OrcidCard {...props} status={{ profile: null, ownWorks: 0, hub: { state: "no-account" } }} />);
  fireEvent.change(screen.getByLabelText("ORCID iD 또는 주소"), { target: { value: "0000-0002-1825-0098" } });
  fireEvent.click(screen.getByRole("button", { name: "iD 연결" }));
  expect(screen.getByRole("alert")).toHaveTextContent("iD가 올바르지 않습니다");
  expect(linkOrcid).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("ORCID iD 또는 주소"), { target: { value: "https://orcid.org/0000-0002-1825-0097" } });
  fireEvent.click(screen.getByRole("button", { name: "iD 연결" }));
  await waitFor(() => expect(linkOrcid).toHaveBeenCalledWith("0000-0002-1825-0097"));
});
it("shows the unauthenticated iD and confirms unlinking before changing the link", async () => {
  vi.mocked(unlinkOrcid).mockResolvedValue({ profile: null, ownWorks: 0, hub: { state: "no-account" } });
  render(<OrcidCard {...props} status={{ profile: { schema: "gaid-orcid/v1", orcid: "0000-0002-1825-0097", authenticated: false, linkedAt: "2026-10-22", name: "Josiah Carberry" }, ownWorks: 3, hub: { state: "no-account" } }} />);
  expect(screen.getByText("(인증 안 됨)")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "https://orcid.org/0000-0002-1825-0097");
  fireEvent.click(screen.getByRole("button", { name: "연결 해제" }));
  expect(unlinkOrcid).not.toHaveBeenCalled();
  expect(screen.getByText(/내 논문 표시는 유지합니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "연결 해제" }));
  await waitFor(() => expect(unlinkOrcid).toHaveBeenCalledTimes(1));
});

const linked = {
  profile: { schema: "gaid-orcid/v1" as const, orcid: "0000-0002-1825-0097", authenticated: true, environment: "sandbox" as const, linkedAt: "2026-10-23" },
  ownWorks: 3,
  hub: { state: "linked" as const, environment: "sandbox" as const, link: { id: "0000-0002-1825-0097", environment: "sandbox" as const, authenticatedAt: "2026-10-23" } },
};
it("opens a detached tab synchronously, navigates after start and refreshes on return without polling", async () => {
  let complete!: (value: { authorizeUrl: string; expiresAt: string }) => void;
  vi.mocked(startOrcidAuth).mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  const tab = { opener: {}, location: { href: "about:blank" }, close: vi.fn(), closed: false };
  const open = vi.spyOn(window, "open").mockReturnValueOnce(tab as unknown as Window);
  render(<OrcidCard {...props} status={{ profile: null, ownWorks: 0, hub: { state: "ready", environment: "sandbox" } }} />);
  fireEvent.click(screen.getByRole("button", { name: "ORCID로 본인 확인" }));
  expect(open).toHaveBeenCalledWith("about:blank", "_blank");
  expect(tab.opener).toBeNull();
  expect(tab.location.href).toBe("about:blank");
  complete({ authorizeUrl: "https://sandbox.orcid.org/oauth/authorize?state=test", expiresAt: "2026-10-23T12:00:00Z" });
  await waitFor(() => expect(tab.location.href).toContain("sandbox.orcid.org/oauth"));
  expect(await screen.findByRole("status")).toHaveTextContent("ORCID에서 본인 확인을 마치면");
  expect(getOrcid).not.toHaveBeenCalled();
  vi.mocked(getOrcid).mockResolvedValueOnce(linked);
  fireEvent.focus(window);
  await waitFor(() => expect(props.onStatus).toHaveBeenCalledWith(linked));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  open.mockRestore();
});
it("offers a real sign-in link when a popup is blocked, and closes placeholder tabs on failure", async () => {
  const open = vi.spyOn(window, "open").mockReturnValueOnce(null);
  vi.mocked(startOrcidAuth).mockResolvedValueOnce({ authorizeUrl: "https://orcid.org/oauth/authorize", expiresAt: "2026-10-23" });
  render(<OrcidCard {...props} status={{ profile: null, ownWorks: 0, hub: { state: "ready", environment: "production" } }} />);
  fireEvent.click(screen.getByRole("button", { name: "ORCID로 본인 확인" }));
  expect(await screen.findByRole("link", { name: "ORCID 로그인 열기" })).toHaveAttribute("href", "https://orcid.org/oauth/authorize");
  const close = vi.fn();
  open.mockReturnValueOnce({ opener: {}, close } as unknown as Window);
  vi.mocked(startOrcidAuth).mockRejectedValueOnce(new Error("hub down"));
  fireEvent.click(screen.getByRole("button", { name: "ORCID로 본인 확인" }));
  await screen.findByRole("alert");
  expect(close).toHaveBeenCalledOnce();
  expect(screen.queryByRole("link", { name: "ORCID 로그인 열기" })).not.toBeInTheDocument();
  open.mockRestore();
});
it("shows a sandbox authenticated iD, hides typed input and confirms the hub unlink (not the local unlink)", async () => {
  vi.mocked(unlinkOrcidAuth).mockResolvedValueOnce({ ...linked, hub: { state: "ready", environment: "sandbox" }, profile: { ...linked.profile, authenticated: false } });
  render(<OrcidCard {...props} status={linked} />);
  expect(screen.queryByText("(인증 안 됨)")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("ORCID iD 또는 주소")).not.toBeInTheDocument();
  const link = screen.getByRole("link", { name: /인증된 ORCID iD/ });
  expect(link).toHaveAttribute("href", "https://sandbox.orcid.org/0000-0002-1825-0097");
  expect(link.querySelector("img")).toHaveAttribute("src", "/geo/orcid/ORCID-iD_icon_vector.svg");
  expect(screen.getByText("ORCID 시험 환경 (시험용 기록)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "본인 확인 연결 해제" }));
  expect(unlinkOrcidAuth).not.toHaveBeenCalled();
  expect(screen.getByText(/iD는 인증 안 된 상태로 남고/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "본인 확인 연결 해제" }));
  await waitFor(() => expect(unlinkOrcidAuth).toHaveBeenCalledOnce());
  expect(unlinkOrcid).not.toHaveBeenCalled();
});
it.each([
  ["no-account", "ORCID 본인 확인에는 기관 Connect 서버 로그인이 필요합니다."],
  ["not-configured", "기관 Connect 서버에 ORCID 연결이 설정되지 않았습니다. 서버 관리자에게 문의하세요."],
  ["unreachable", "기관 Connect 서버에 연결하지 못했습니다. 연결 상태를 다시 읽으세요."],
] as const)("keeps typed-iD linking available with hub state %s", (state, hint) => {
  render(<OrcidCard {...props} status={{ profile: null, ownWorks: 0, hub: { state } }} />);
  expect(screen.getByText(hint)).toBeInTheDocument();
  expect(screen.getByLabelText("ORCID iD 또는 주소")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "ORCID로 본인 확인" })).not.toBeInTheDocument();
  if (state === "unreachable") {
    fireEvent.click(screen.getByRole("button", { name: "다시 읽기" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  }
});
