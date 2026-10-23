import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MethodDraft } from "@/geo/contracts/authoring";
import { hubApi } from "./api";
import { ExampleDataSection } from "./example-data";
import { fixtureDraft } from "./fixtures";

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => {
  localStorage.removeItem("gaid:locale");
  vi.restoreAllMocks();
});

const SHA = "a".repeat(64);

function withSource() {
  const p = fixtureDraft();
  p.sources.push({
    id: "src-data",
    kind: "code",
    name: "grid-data.tar.gz",
    title: "공개 항공자력 격자",
    mediaType: "application/gzip",
    sha256: SHA,
    size: 10,
    addedAt: "2026-10-23T00:00:00Z",
    status: "extracted",
    doi: "10.1000/grid",
  });
  p.extractions["src-data"] = {
    sourceId: "src-data",
    sourceSha256: SHA,
    tool: "tar",
    coveredPages: [],
    emptyPages: [],
    figures: [],
    characters: 0,
    at: "2026-10-23T00:00:00Z",
    files: [{ path: "grid.csv", size: 2048, sha256: SHA, text: true }],
  };
  return p;
}

describe("draft example data area", () => {
  it("adds example data from a draft source with a suggested title and source, as a new revision", async () => {
    const project = withSource();
    const draft = project.drafts[0];
    const next: MethodDraft = structuredClone(draft);
    next.revision = draft.revision + 1;
    const attach = vi.spyOn(hubApi, "attachExample").mockResolvedValue(next);
    const onChanged = vi.fn();
    render(<ExampleDataSection draft={draft} project={project} onChanged={onChanged} />);

    expect(screen.getByRole("heading", { name: "예제 자료" })).toBeTruthy();
    expect(screen.getByText("예제 자료가 없습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "예제 자료 넣기" }));
    fireEvent.click(screen.getByRole("button", { name: "초안 자료에서" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /grid\.csv/ }));
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("공개 항공자력 격자");
    expect((screen.getByLabelText("출처") as HTMLInputElement).value).toBe("공개 항공자력 격자, doi:10.1000/grid");
    fireEvent.click(screen.getByLabelText("모의 계산으로 만든 합성 자료입니다"));
    const form = screen.getByRole("form", { name: "예제 자료 넣기" });
    fireEvent.submit(form);
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(next));
    expect(attach).toHaveBeenCalledWith(project.id, {
      baseRevision: draft.revision,
      roleId: "grid",
      from: { kind: "source", sourceId: "src-data", paths: ["grid.csv"] },
      title: "공개 항공자력 격자",
      source: "공개 항공자력 격자, doi:10.1000/grid",
      license: "",
      synthetic: true,
    });
  });

  it("shows an attached example with its source, licence, synthetic mark and how it reaches the project, and removes it after confirmation", async () => {
    const project = fixtureDraft();
    const draft = project.drafts[0];
    draft.workflow!.inputRoles[0].example = {
      title: { ko: "합성 격자 표" },
      source: { ko: "논문 그림 3을 따라 만든 자료" },
      license: "CC BY 4.0",
      synthetic: true,
      files: [{ name: "grid.csv", sha256: SHA, size: 3 * 1024 * 1024, url: "https://example.org/grid.csv" }],
    };
    const remove = vi.spyOn(hubApi, "removeExample").mockResolvedValue(draft);
    render(<ExampleDataSection draft={draft} project={project} onChanged={() => undefined} />);
    expect(screen.getByText("합성 격자 표")).toBeTruthy();
    expect(screen.getByText("합성 자료")).toBeTruthy();
    expect(screen.getByText("처음 쓸 때 내려받음")).toBeTruthy();
    expect(screen.getByText("출처: 논문 그림 3을 따라 만든 자료")).toBeTruthy();
    expect(screen.getByText("이용 조건: CC BY 4.0")).toBeTruthy();
    expect(screen.getByText("3 MiB, 파일 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "예제 자료 빼기" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "예제 자료 뺀 초안 만들기" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(project.id, "grid", draft.revision));
  });
});
