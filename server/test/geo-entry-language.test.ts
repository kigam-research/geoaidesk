import { describe, expect, it } from "vitest";
import { entryLanguageExtension, entryLanguageRefusal, latestRequestText } from "../src/geo/entry-language.ts";

const user = (content: unknown) => ({ type: "message", message: { role: "user", content } });
const assistant = (text: string) => ({ type: "message", message: { role: "assistant", content: [{ type: "text", text }] } });

describe("notebook entry language (gaid-first-use-fixes)", () => {
  it("reads the latest user request from string or block content", () => {
    expect(latestRequestText([user("first"), assistant("x"), user([{ type: "text", text: "붙인 논문을 비교하세요" }, { type: "image" }])])).toBe("붙인 논문을 비교하세요");
    expect(latestRequestText([assistant("only")])).toBe("");
  });

  it("refuses a Japanese title or body for a Korean request and passes everything else", () => {
    const korean = "붙인 논문에서 무작위 교차검증과 공간 교차검증의 성능 차이를 정리하세요.";
    expect(entryLanguageRefusal({ type: "method", title: "報告値から差と比率を計算します" }, korean)).toMatch(/Japanese.*Korean/);
    expect(entryLanguageRefusal({ type: "note", title: "비교", body: "三論文の距離設定を再確認します" }, korean)).toMatch(/call notebook again/);
    // Korean text that quotes a Japanese name, English titles and non-Korean requests are left alone.
    expect(entryLanguageRefusal({ title: "「地質図」 표기를 확인합니다" }, korean)).toBeUndefined();
    expect(entryLanguageRefusal({ title: "Compute ratios from reported values" }, korean)).toBeUndefined();
    expect(entryLanguageRefusal({ title: "報告値から差と比率を計算します" }, "Compare the attached papers.")).toBeUndefined();
    expect(entryLanguageRefusal({ title: "報告値" }, "「地質図」를 일본어로 정리하세요")).toBeUndefined();
  });

  it("blocks through the lead tool_call hook and ignores other tools", async () => {
    let hook: ((event: unknown, ctx: unknown) => Promise<unknown>) | undefined;
    entryLanguageExtension({ on(name: string, handler: typeof hook) { if (name === "tool_call") hook = handler; } } as never);
    const ctx = { sessionManager: { getBranch: () => [user("수치를 비교하세요")] } };
    await expect(hook!({ toolName: "notebook", input: { title: "差を計算します" } }, ctx)).resolves.toMatchObject({ block: true });
    await expect(hook!({ toolName: "notebook", input: { title: "차이를 계산합니다" } }, ctx)).resolves.toBeUndefined();
    await expect(hook!({ toolName: "write", input: { title: "差を計算します" } }, ctx)).resolves.toBeUndefined();
    await expect(hook!({ toolName: "notebook", input: { title: "差" } }, { sessionManager: { getBranch: () => { throw new Error("x"); } } })).resolves.toBeUndefined();
  });
});
