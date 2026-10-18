import { describe, expect, it } from "vitest";
import { matchesHubSearch } from "../src/geo/hub-shared/search.ts";

describe("shared hub commodity search", () => {
  it.each([
    ["니켈", "Ni exploration"], ["Ni", "니켈 탐사"], ["NICKEL", "Ni-PU"],
    ["구리", "Cu"], ["gold", "Au"], ["은", "Ag"], ["아연", "Zn"],
    ["납", "Pb"], ["리튬", "Li"], ["코발트", "Co"], ["백금족", "PGE"],
    ["희토류", "REE"], ["철", "Fe"], ["우라늄", "U"], ["텅스텐", "W"],
    ["rare earth elements", "REE"], ["platinum group", "PGE"], ["백금족", "platinum group elements"],
    ["몰리브덴", "Mo"], ["주석", "Sn"], ["흑연", "graphite"],
  ])("expands %s to %s", (query, field) => {
    expect(matchesHubSearch(query, [field])).toBe(true);
  });

  it("requires every word, across separate fields, ignoring whitespace and case", () => {
    expect(matchesHubSearch("  니켈\tPu\n한계  ", ["Ni", "PU learning", "한계 설명"])).toBe(true);
    expect(matchesHubSearch("니켈 PU 없는말", ["Ni", "PU learning"])).toBe(false);
    expect(matchesHubSearch("  ", [])).toBe(true);
  });

  it("matches short symbols and acronyms only as words and treats punctuation literally", () => {
    for (const [query, fields] of [
      ["Ni", ["unlabelled", "mining"]], ["니켈", ["mining"]],
      ["Co", ["copper", "condition"]], ["U", ["PU"]], ["PU", ["input"]],
    ] as const) expect(matchesHubSearch(query, [...fields])).toBe(false);
    expect(matchesHubSearch("Ni", ["(Ni), Cu-Ni / NI."])).toBe(true);
    expect(matchesHubSearch("[Ni]", ["[Ni]"])).toBe(true);
    expect(matchesHubSearch(".*", ["Ni"])).toBe(false);
  });
});
