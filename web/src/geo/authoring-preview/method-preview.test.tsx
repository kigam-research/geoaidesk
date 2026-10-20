import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewMethodPane } from "./method-pane";
import { PreviewTrialPane } from "./trial-pane";
import { PreviewDialogs } from "./preview-dialogs";
import { t } from "@/geo/i18n";
import type { AuthoringPreviewState } from "@/geo/contracts/authoring-preview";
import ko from "@/geo/locales/previewMethod/ko.json";
import en from "@/geo/locales/previewMethod/en.json";

function state(
  patch: Partial<AuthoringPreviewState> = {},
): AuthoringPreviewState {
  return {
    version: 1,
    step: "method",
    source: { kind: "sample", name: "sample.pdf" },
    purpose: "다른 지역 자료에 적용",
    exampleAnalysis: true,
    choice: null,
    deferred: false,
    code: null,
    previousResults: null,
    draft: null,
    savedAt: null,
    dialog: null,
    trialData: null,
    comparisonNote: "",
    trialRequestPreview: false,
    ...patch,
  };
}
function props(patch: Partial<AuthoringPreviewState> = {}) {
  return { state: state(patch), onEvent: vi.fn(), onSourcePage: vi.fn() };
}

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));

describe("controlled method choices", () => {
  it("leaves the answer empty, preserves purpose and links real source pages", async () => {
    const p = props();
    render(<PreviewMethodPane {...p} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).not.toBeChecked());
    expect(
      screen.getByRole("button", { name: "선택한 방식으로 초안 보기" }),
    ).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByText("논문 설정과 적용 목적"));
    expect(screen.getByText(p.state.purpose)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "원고 9쪽 보기" }));
    await user.click(
      screen.getByRole("button", { name: "Figure 6 · 20쪽 보기" }),
    );
    expect(p.onSourcePage.mock.calls).toEqual([[9], [20]]);
    await user.click(screen.getByRole("button", { name: "나중에 답하기" }));
    expect(p.onEvent.mock.calls).toEqual([[{ type: "defer" }]]);
    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).not.toBeChecked());
  });

  it("emits all choices and requires metadata for the attached-code draft", async () => {
    const p = props();
    const view = render(<PreviewMethodPane {...p} />);
    const user = userEvent.setup();
    for (const radio of screen.getAllByRole("radio")) await user.click(radio);
    expect(p.onEvent.mock.calls).toEqual(
      ["attach-code", "draft-code", "procedure"].map((value) => [
        { type: "choice", value },
      ]),
    );
    view.rerender(
      <PreviewMethodPane {...p} state={state({ choice: "attach-code" })} />,
    );
    expect(
      screen.getByRole("button", { name: "선택한 방식으로 초안 보기" }),
    ).toBeDisabled();
    const file = new File(["# code"], "analysis.py", { type: "text/plain" });
    await user.upload(screen.getByLabelText("분석 코드 파일 선택"), file);
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "attach",
      role: "code",
      file: { name: "analysis.py", size: file.size },
    });
    view.rerender(
      <PreviewMethodPane
        {...p}
        state={state({
          choice: "attach-code",
          code: { name: file.name, size: file.size },
        })}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "선택한 방식으로 초안 보기" }),
    );
    expect(p.onEvent).toHaveBeenLastCalledWith({ type: "create-draft" });
    await user.click(screen.getByRole("button", { name: "코드 연결 해제" }));
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "remove-attachment",
      role: "code",
    });
  });

  it.each(["draft-code", "procedure"] as const)(
    "allows the %s preview, never claims code was written",
    async (choice) => {
      const p = props({ choice, deferred: true });
      render(<PreviewMethodPane {...p} />);
      expect(screen.getByRole("status")).toHaveTextContent("답변을 미뤘습니다");
      const button = screen.getByRole("button", {
        name: "선택한 방식으로 초안 보기",
      });
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(p.onEvent).toHaveBeenLastCalledWith({ type: "create-draft" });
    },
  );

  it("does not display fixture findings for another source", () => {
    render(
      <PreviewMethodPane
        {...props({ source: { kind: "local-pdf", name: "other.pdf" } })}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByText("공간 의존성을 고려한 평가"),
    ).not.toBeInTheDocument();
  });
});

describe("draft and illustrative dialogs", () => {
  const draft = { title: "공간 PU 분석", summary: "방법 초안 설명" };
  it("emits edits, save, navigation and each dialog request", async () => {
    const p = props({
      draft,
      choice: "procedure",
      savedAt: "2026-10-15T08:00:00Z",
    });
    render(<PreviewTrialPane {...p} />);
    fireEvent.change(screen.getByLabelText("Workflow 이름"), {
      target: { value: "새 이름" },
    });
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "edit-draft",
      field: "title",
      value: "새 이름",
    });
    fireEvent.change(screen.getByLabelText("Workflow 설명"), {
      target: { value: "새 설명" },
    });
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "edit-draft",
      field: "summary",
      value: "새 설명",
    });
    const user = userEvent.setup();
    for (const [name, event] of [
      ["구현 방식 수정", { type: "step", step: "method" }],
      ["파일 내용 예시 보기", { type: "dialog", value: "files" }],
      ["시험 준비 열기", { type: "dialog", value: "trial" }],
      ["공유할 내용 살펴보기", { type: "dialog", value: "sharing" }],
      ["미리보기 저장", { type: "save" }],
    ] as const) {
      await user.click(screen.getByRole("button", { name }));
      expect(p.onEvent).toHaveBeenLastCalledWith(event);
    }
    expect(screen.getByText("미시험")).toBeVisible();
    expect(screen.getByText("아직 실행하지 않았습니다.")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "2026-10-15T08:00:00Z",
    );
  });

  it("prepares metadata and criteria without any execution action", async () => {
    const p = props({ draft, choice: "draft-code", dialog: "trial" });
    const view = render(<PreviewDialogs {...p} />);
    const user = userEvent.setup();
    expect(
      screen.getByRole("button", { name: "시험 요청 요약 보기" }),
    ).toBeDisabled();
    const file = new File(["x,y"], "trial.csv");
    await user.upload(screen.getByLabelText("시험 자료 파일 선택"), file);
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "attach",
      role: "trial",
      file: { name: file.name, size: file.size },
    });
    fireEvent.change(screen.getByLabelText("비교 기준"), {
      target: { value: "기준 고정" },
    });
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "comparison",
      value: "기준 고정",
    });
    const ready = {
      ...p.state,
      trialData: { name: file.name, size: file.size },
      comparisonNote: "기준 고정",
    };
    view.rerender(<PreviewDialogs {...p} state={ready} />);
    await user.click(
      screen.getByRole("button", { name: "시험 요청 요약 보기" }),
    );
    expect(p.onEvent).toHaveBeenLastCalledWith({
      type: "preview-trial-request",
    });
    view.rerender(
      <PreviewDialogs {...p} state={{ ...ready, trialRequestPreview: true }} />,
    );
    expect(
      screen.getByRole("heading", { name: "시험 요청 요약 · 미실행" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "요청 내용을 미리 본 상태입니다. 자료 분석, 코드 실행과 결과 판정은 하지 않았습니다.",
      ),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(p.onEvent).toHaveBeenLastCalledWith({ type: "dialog", value: null });
  });

  it("does not enable a trial request for the procedure-only branch even with complete metadata", async () => {
    const p = props({
      draft,
      choice: "procedure",
      dialog: "trial",
      trialData: { name: "trial.csv", size: 32 },
      comparisonNote: "Compare fixed evaluation criteria",
    });
    render(<PreviewDialogs {...p} />);
    const button = screen.getByRole("button", { name: "시험 요청 요약 보기" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        "절차 설명 방식입니다. 실행 가능한 코드가 없어 시험 요청 요약을 만들지 않습니다.",
      ),
    ).toBeVisible();
    await userEvent.click(button);
    expect(p.onEvent).not.toHaveBeenCalled();
  });

  it("shows separate instruction/request illustrations and source navigation", async () => {
    const p = props({ draft, choice: "draft-code", dialog: "files" });
    render(<PreviewDialogs {...p} />);
    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByRole("heading", { name: "SKILL.md · 지침 예시" }),
    ).toBeVisible();
    expect(
      dialog.getByRole("heading", { name: ".geo-start.json · 요청 구성 예시" }),
    ).toBeVisible();
    expect(dialog.getByText(draft.summary)).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "원고 9쪽 보기" }),
    );
    expect(p.onSourcePage).toHaveBeenCalledWith(9);
    expect(p.onEvent).toHaveBeenLastCalledWith({ type: "dialog", value: null });
  });

  it("keeps sharing as a private content review with only a close action", async () => {
    const p = props({ draft, dialog: "sharing" });
    render(<PreviewDialogs {...p} />);
    expect(
      screen.getByText(
        "원본 PDF, 첨부 코드, 연구 자료와 기존 결과 파일은 공유 후보에 포함하지 않습니다.",
      ),
    ).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "미리보기 닫기" }),
    );
    expect(p.onEvent).toHaveBeenLastCalledWith({ type: "dialog", value: null });
  });

  it("restores keyboard focus to the opener after dismissing a controlled dialog", async () => {
    function Harness() {
      const [current, setCurrent] = useState(
        state({ draft, choice: "procedure", step: "trial" }),
      );
      const p = {
        state: current,
        onSourcePage: vi.fn(),
        onEvent: (
          event: import("@/geo/contracts/authoring-preview").PreviewEvent,
        ) => {
          if (event.type === "dialog")
            setCurrent((previous) => ({ ...previous, dialog: event.value }));
        },
      };
      return (
        <>
          <PreviewTrialPane {...p} />
          <PreviewDialogs {...p} />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "시험 준비 열기" });
    const user = userEvent.setup();
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

it("keeps every previewMethod ID bilingual and formatable", () => {
  function keys(value: object, prefix = ""): string[] {
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === "string"
        ? [prefix + key]
        : keys(child, `${prefix}${key}.`),
    );
  }
  expect(keys(ko)).toEqual(keys(en));
  for (const locale of ["ko", "en"] as const)
    for (const key of keys(ko)) {
      const result = t(
        `previewMethod.${key}`,
        { name: "file.csv", size: 12, time: "recorded time" },
        locale,
      );
      expect(result).not.toBe(`previewMethod.${key}`);
      expect(result).not.toMatch(/\{(?:name|size|time)\}/);
    }
});
