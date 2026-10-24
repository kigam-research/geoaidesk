import { describe, expect, it } from "vitest";
import { citationPage, citationSpans, parseCitations } from "./library";

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

describe("citationSpans and citationPage (gaid-cite-open-pdf)", () => {
  it("gives the offsets of each citation inside its brackets", () => {
    const text = "같습니다 [see @roberts2022, pp. 3-5; @zhang2023]. 그리고 [-@hong_2026:pu, 그림 4 ]";
    const spans = citationSpans(text);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["@roberts2022, pp. 3-5", "@zhang2023", "-@hong_2026:pu, 그림 4"]);
    expect(spans.map((s) => [s.key, s.locator])).toEqual([["roberts2022", "pp. 3-5"], ["zhang2023", undefined], ["hong_2026:pu", "그림 4"]]);
  });

  it("finds nothing in links, e-mail addresses and bare mentions", () => {
    expect(citationSpans("[링크 @x](https://example.org) [a@b.com] @loose")).toEqual([]);
  });

  it("reads the first PDF page of page locators only", () => {
    expect(["p. 12", "pp. 3-5", "p.7", "page 9", "pages 2–4", "12쪽", "4 페이지"].map(citationPage)).toEqual([12, 3, 7, 9, 2, 12, 4]);
    expect(["그림 4", "chap. 2", "p. 0", undefined].map(citationPage)).toEqual([undefined, undefined, undefined, undefined]);
  });
});
