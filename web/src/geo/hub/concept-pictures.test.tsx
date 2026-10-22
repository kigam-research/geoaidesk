import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptPicture, themedSrc } from "./concept-picture";
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
    expect(screen.getByText(/Workflow를 설명하는 그림입니다/)).toBeTruthy();
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

describe("concept pictures and screen themes", () => {
  it("offers fitting an older white picture to the screen themes, and not for a themed picture", () => {
    const d = draft();
    const first = d.profile.procedure.nodes[0];
    const a = action();
    render(<DraftStep draft={d} trialCount={0} checkIssues={null} rail={null} visualAction={a}
      cover="/cover.png" coverThemed visuals={{ [first.id]: visual }} />);
    const cover = within(screen.getByRole("group", { name: "대표 그림 개념 그림 동작", hidden: true }));
    expect(cover.queryByRole("button", { name: "화면 테마에 맞추기", hidden: true })).toBeNull();
    const step = within(screen.getByRole("group", { name: `${first.label} 개념 그림 동작` }));
    expect(step.getByText(/흰 바탕으로 만든 예전 그림입니다/)).toBeTruthy();
    fireEvent.click(step.getByRole("button", { name: "화면 테마에 맞추기" }));
    expect(a.onMake).toHaveBeenLastCalledWith([first.id], undefined, true);
  });

  it("frames a themed picture with the well colour and asks for the dark-mode file in dark mode", () => {
    expect(themedSrc("/p.png?revision=2", true, true)).toBe("/p.png?revision=2&theme=dark");
    expect(themedSrc("/p.png", true, true)).toBe("/p.png?theme=dark");
    expect(themedSrc("/p.png", false, true)).toBe("/p.png");
    expect(themedSrc("/p.png", true, false)).toBe("/p.png");
    const { container } = render(<><ConceptPicture src="/a.png" themed /><ConceptPicture src="/b.png" /></>);
    const [themed, older] = container.querySelectorAll("span");
    expect(themed.className).toContain("bg-[var(--gaid-pic-well)]");
    expect(older.className).toContain("bg-[var(--gaid-pic-mat)]");
    expect(container.querySelector("img")!.getAttribute("style")).toBeNull();
  });
});
