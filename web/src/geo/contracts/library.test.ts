import { describe, expect, it } from "vitest";
import { parseCitations } from "./library";

describe("parseCitations", () => {
  it("reads keys and locators in order", () => {
    const md = "결과는 선행연구와 같습니다 [@kim2025, p. 12]. 다른 결과도 있습니다 [see @roberts2022, pp. 3-5; @zhang2023].";
    expect(parseCitations(md).map(({ key, locator }) => ({ key, locator }))).toEqual([
      { key: "kim2025", locator: "p. 12" },
      { key: "roberts2022", locator: "pp. 3-5" },
      { key: "zhang2023", locator: undefined },
    ]);
  });

  it("accepts Korean locators, suppressed authors and keys with inner punctuation", () => {
    expect(parseCitations("[-@hong_2026:pu, 그림 4]")).toEqual([{ key: "hong_2026:pu", locator: "그림 4", index: 0 }]);
  });

  it("ignores links, e-mail addresses, bare @mentions and code", () => {
    const md = [
      "[링크 @x](https://example.org) 문의 [a@b.com] @loose",
      "`[@incode]`",
      "```",
      "[@infence]",
      "```",
      "[@real2024]",
    ].join("\n");
    expect(parseCitations(md).map((c) => c.key)).toEqual(["real2024"]);
  });

  it("does not take trailing punctuation into the key", () => {
    expect(parseCitations("[@lee2024.]").map((c) => c.key)).toEqual(["lee2024"]);
  });
});
