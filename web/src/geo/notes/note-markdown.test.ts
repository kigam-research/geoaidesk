import { describe, expect, it } from "vitest";
import { noteBody, rebaseNoteLinks, rebasePath, splitDecisions, stripFrontmatter } from "./note-markdown";

const NOTE = "연구노트/2026-10-15-다원소/index.md";

describe("research note markdown", () => {
  it("drops frontmatter and the title heading", () => {
    const md = "---\ntitle: A\nstatus: pending\n---\n# A\n\n## 한눈에\n\ntext\n";
    expect(stripFrontmatter(md).startsWith("# A")).toBe(true);
    expect(noteBody(md, NOTE).trim().startsWith("## 한눈에")).toBe(true);
  });

  it("rebases relative links and images from the note folder to the sandbox root", () => {
    expect(rebasePath("연구노트/n/", "figures/a b.png")).toBe(`${encodeURIComponent("연구노트")}/n/figures/a%20b.png`);
    expect(rebasePath("연구노트/n/", "../../derived/x.csv")).toBe("derived/x.csv");
    expect(rebasePath("연구노트/n/", "../../../etc/passwd")).toBeNull();
    expect(rebasePath("연구노트/n/", "https://example.org/x")).toBeNull();
    expect(rebasePath("연구노트/n/", "#section")).toBeNull();
    const out = rebaseNoteLinks("![m](figures/m.png) [t](../../results/t.csv) `![c](figures/c.png)` <img src=\"figures/h.png\">", NOTE);
    expect(out).toContain("](%EC%97%B0%EA%B5%AC%EB%85%B8%ED%8A%B8/2026-10-15-%EB%8B%A4%EC%9B%90%EC%86%8C/figures/m.png)");
    expect(out).toContain("](results/t.csv)");
    expect(out).toContain("`![c](figures/c.png)`");
    expect(out).toContain('src="%EC%97%B0%EA%B5%AC%EB%85%B8%ED%8A%B8/2026-10-15-%EB%8B%A4%EC%9B%90%EC%86%8C/figures/h.png"');
  });

  it("splits the decisions section in Korean, English and numbered headings", () => {
    const ko = "## 결과\n\nr\n\n## 결정할 일\n\n1. q\n   - 가) a\n\n## 근거\n\n- e\n";
    const parts = splitDecisions(ko);
    expect(parts.before).toContain("## 결과");
    expect(parts.decisions).toContain("1. q");
    expect(parts.after.startsWith("## 근거")).toBe(true);
    expect(splitDecisions("## 5. Decisions\n\n1. q\n").decisions).toContain("1. q");
    expect(splitDecisions("```\n## 결정할 일\n```\n").decisions).toBeNull();
    expect(splitDecisions("## 결과\n").decisions).toBeNull();
  });
});
