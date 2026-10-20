import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftStep } from "./draft-step";
import { fixtureDraft } from "./fixtures";
import { MethodFlow } from "./method-flow";
import { onOpenSettings } from "@/lib/settings-nav";

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
const visual = { src: "/concept.png", kind: "generated" as const, caption: "개념 그림" };
const action = (connected: boolean | null = true) => ({
  busy: false, progress: null, has: true, error: null, errorDetail: null, usageLimit: false,
  connected, onMake: vi.fn(),
});
const draft = () => fixtureDraft().drafts[0];

describe("concept pictures in a draft", () => {
  it("keeps the explanation and make action visible without login, and opens provider settings", () => {
    const settings = vi.fn();
    const off = onOpenSettings(settings);
    render(<DraftStep draft={draft()} trialCount={0} checkIssues={null} rail={null} visualAction={action(false)} />);
    expect(screen.getByText(/방법을 설명하는 그림입니다/)).toBeTruthy();
    expect(screen.getByText(/OpenAI Codex \(legacy\)로 로그인/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "개념 그림 다시 만들기" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "제공사 설정 열기" }));
    expect(settings).toHaveBeenCalledWith({ tab: "providers" });
    off();
  });

  it("provides picture-local redo and a verbatim bounded instruction for cover, step and output", () => {
    const d = draft();
    const first = d.profile.procedure.nodes[0];
    d.profile.outputs = [{ id: "map", kind: "map-raster", label: "지도", interpretation: "개념 지도" }];
    first.outputs = ["map"];
    const a = action();
    render(<DraftStep draft={d} trialCount={0} checkIssues={null} rail={null} visualAction={a}
      cover="/cover.png" visuals={{ [first.id]: visual }} outputImages={{ map: visual }} />);
    const cover = within(screen.getByRole("group", { name: "대표 그림 개념 그림 동작", hidden: true }));
    fireEvent.click(cover.getByText("다시 만들기"));
    expect(a.onMake).toHaveBeenLastCalledWith(["cover"]);
    const step = within(screen.getAllByRole("group").find((e) => {
      const label = e.getAttribute("aria-label");
      return label?.endsWith("개념 그림 동작") && label !== "지도 개념 그림 동작" && label !== "대표 그림 개념 그림 동작";
    })!);
    fireEvent.click(step.getByRole("button", { name: "고쳐 만들기" }));
    const field = step.getByLabelText("그림 수정 요청") as HTMLInputElement;
    expect(field.maxLength).toBe(500);
    expect((step.getByRole("button", { name: "수정 요청으로 만들기" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: "  블록을 크게  " } });
    fireEvent.click(step.getByRole("button", { name: "수정 요청으로 만들기" }));
    expect(a.onMake).toHaveBeenLastCalledWith([first.id], "  블록을 크게  ");
    fireEvent.click(within(screen.getByRole("group", { name: "지도 개념 그림 동작" })).getByRole("button", { name: "다시 만들기" }));
    expect(a.onMake).toHaveBeenLastCalledWith(["output:map"]);
  });

  it("does not show editing controls in the shared read-only flow", () => {
    const d = draft();
    render(<MethodFlow profile={d.profile} visuals={{ [d.profile.procedure.nodes[0].id]: visual }} />);
    expect(screen.queryByRole("button", { name: "다시 만들기" })).toBeNull();
  });
});
