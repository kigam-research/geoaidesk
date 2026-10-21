import { describe, expect, it } from "vitest";
import { citationKeyFor, exportBibliography, formatReference, parseBibliography } from "../src/geo/library/formats/index.ts";
import type { CslItem } from "../../web/src/geo/contracts/library.ts";

const paper: CslItem = { type: "article-journal", title: "A study of water & rock", author: [{ family: "Müller", given: "Anna Maria" }, { family: "Kim", given: "Jin" }],
  issued: { "date-parts": [[2024]] }, "container-title": "Geology", volume: "12", issue: "3", page: "11-20", DOI: "10.1000/rock", language: "en" };

describe("bibliography formats", () => {
  it("imports CSL objects without dropping unknown fields and reports each invalid neighbour", () => {
    const good = { ...paper, custom: { unchanged: true } };
    const r = parseBibliography(JSON.stringify([good, { type: "article" }, { ...paper, author: [null] }, paper]), "csl-json");
    expect(r.items).toEqual([good, paper]); expect(r.errors.map((e) => e.index)).toEqual([2, 3]);
    expect(parseBibliography("{bad", "csl-json").errors[0].index).toBe(0);
    expect(parseBibliography(JSON.stringify({ ...paper, issued: { "date-parts": [[2024, 13]] } }), "csl-json").errors).toHaveLength(1);
    expect(parseBibliography(exportBibliography([good], "csl-json"), "csl-json").items).toEqual([good]);
  });

  it("reads nested BibTeX, Unicode, TeX accents, @string and concatenation", () => {
    const bib = String.raw`@string{journal = "Earth" # " Science"}
@article{mueller2024,
 title={A {CO2} study}, author={M{\"u}ller, Anna and {Research and Development Group}},
 journal=journal, year=2024, doi={10.1000/x}, customfield={kept}
}`;
    const r = parseBibliography(bib, "bibtex");
    expect(r.errors).toEqual([]); expect(r.items[0].author?.[0].family).toBe("Müller");
    expect(r.items[0].author?.[1].literal).toBe("Research and Development Group");
    expect(r.items[0]["container-title"]).toBe("Earth Science"); expect(r.items[0].title).toBe("A CO2 study");
    expect(exportBibliography(r.items, "bibtex")).toContain("customfield = {kept}");
  });

  it("reports a broken BibTeX entry and recovers its valid neighbours", () => {
    const r = parseBibliography(`@article{a,title={Valid first},year=2024}
@article{broken,title={Never closes
@article{b,title={Valid second},year=2023}`, "bibtex");
    expect(r.items.map((i) => i.title)).toEqual(["Valid first", "Valid second"]); expect(r.errors).toHaveLength(1);
    expect(r.errors[0].key).toBe("broken");
    expect(parseBibliography("@article{a,title=undefinedmacro}", "bibtex").errors[0].message).toContain("macro");
    expect(parseBibliography("@article{a,title={x},title={y}}", "bibtex").errors[0].message).toContain("Duplicate");
  });

  it("round-trips the supported common metadata through BibTeX and RIS", () => {
    for (const format of ["bibtex", "ris"] as const) {
      const text = exportBibliography([paper], format), r = parseBibliography(text, format);
      expect(r.errors).toEqual([]); expect(r.items).toHaveLength(1);
      for (const field of ["title", "type", "author", "issued", "container-title", "volume", "issue", "page", "DOI", "language"])
        expect(r.items[0][field], `${format} ${field}`).toEqual(paper[field]);
    }
    const r = parseBibliography(exportBibliography([{ ...paper, title: String.raw`A {literal} 50% C:\path` }], "bibtex"), "bibtex");
    expect(r.items[0].title).toBe(String.raw`A {literal} 50% C:\path`);
    const chapter = { ...paper, type: "chapter", issued: { "date-parts": [[2024, 3, 12]] } };
    const bib = exportBibliography([chapter], "bibtex");
    expect(bib).toContain("booktitle = {Geology}"); expect(bib).not.toContain("journal =");
    expect(parseBibliography(bib, "bibtex").items[0].issued).toEqual(chapter.issued);
    expect(exportBibliography([{ ...paper, "citation-key": "stable2024" }], "bibtex")).toContain("@article{stable2024,");
    expect(parseBibliography(exportBibliography([{ ...paper, id: "importedKey" }], "bibtex"), "bibtex").items[0].id).toBe("importedKey");
  });

  it("imports RIS repeated authors, continuation lines and per-entry errors", () => {
    const text = `TY  - JOUR
TI  - 지질 연구
AU  - 김연구
AU  - Kim, Jin
PY  - 2024/03/12
SP  - 10
EP  - 21
AB  - First line
  continued
ZZ  - retained
ER  -
TY  - JOUR
AU  - Missing title
ER  -
TY  - JOUR
TI  - Third entry
ER  -`;
    const r = parseBibliography(text, "ris");
    expect(r.items).toHaveLength(2); expect(r.errors[0].index).toBe(2);
    expect(r.items[0].issued).toEqual({ "date-parts": [[2024, 3, 12]] }); expect(r.items[0].abstract).toBe("First line continued");
    expect(r.items[0].author?.[0].literal).toBe("김연구"); expect(r.items[0].page).toBe("10-21");
    expect(exportBibliography(r.items, "ris")).toContain("ZZ  - retained");
    expect(parseBibliography("TY  - JOUR\nTI  - Incomplete", "ris").errors).toHaveLength(1);
  });

  it("rejects oversized imports, invalid names and line-injecting RIS field values", () => {
    expect(parseBibliography("x".repeat(8 * 1024 * 1024 + 1), "ris").errors[0].index).toBe(0);
    const ris = exportBibliography([{ ...paper, title: "Original\nTY  - BOOK" }], "ris");
    expect(ris.match(/^TY/gm)).toHaveLength(1);
    expect(() => exportBibliography([{ ...paper, author: [null] } as unknown as CslItem], "csl-json")).toThrow();
  });
});

it("generates ASCII citation keys without fabricating Korean romanisation", () => {
  expect(citationKeyFor(paper)).toBe("muller2024");
  expect(citationKeyFor(paper, ["muller2024", "muller2024a"])).toBe("muller2024b");
  const taken = new Set(["muller2024", ..."abcdefghijklmnopqrstuvwxyz".split("").map((x) => `muller2024${x}`)]);
  expect(citationKeyFor(paper, taken)).toBe("muller2024aa");
  expect(citationKeyFor({ ...paper, author: [{ literal: "김연구" }] })).toBe("ref2024");
  expect(citationKeyFor({ ...paper, author: [{ family: "Kim", given: "연구" }] })).toBe("kim2024");
  expect(citationKeyFor({ type: "article", title: "Unknown" })).toBe("refnd");
});

it("formats a plain APA-like reference in Korean and English with explicit missing year", () => {
  expect(formatReference(paper, "en")).toBe("Müller, A. M., & Kim, J. (2024). A study of water & rock. Geology, 12(3), 11-20. https://doi.org/10.1000/rock");
  const korean = { type: "article-journal", title: "국내 지질 연구", author: [{ family: "김", given: "연구" }] };
  expect(formatReference(korean, "ko")).toBe("김연구 (연도 미상). 국내 지질 연구.");
  expect(formatReference({ ...paper, title: "<i>Plain</i> title" }, "en")).not.toContain("<i>");
});
