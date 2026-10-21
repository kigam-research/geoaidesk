import { describe, expect, it } from "vitest";
import { folderSubtree, type LibraryCollection } from "@/geo/contracts/library";
import { folderPath, folderTree } from "./folder-tree";

const f = (id: string, name: string, parentId?: string): LibraryCollection => ({ id, owner: "local", name, source: "gaid", ...(parentId ? { parentId } : {}) });

describe("folder tree", () => {
  const cols = [f("b", "원고 B"), f("a", "원고 A"), f("a2", "결과", "a"), f("a1", "방법", "a"), f("orphan", "고아", "missing"), f("x", "자기 참조", "x")];
  it("nests by parent, sorts siblings and lifts folders whose parent is missing", () => {
    const tree = folderTree(cols);
    expect(tree.map((n) => n.folder.id)).toEqual(["orphan", "a", "b", "x"]);
    expect(tree[1].children.map((n) => n.folder.name)).toEqual(["결과", "방법"]);
  });
  it("names a folder by its path and collects a subtree without looping", () => {
    expect(folderPath(cols, "a1")).toBe("원고 A › 방법");
    expect([...folderSubtree(cols, "a")].sort()).toEqual(["a", "a1", "a2"]);
    expect([...folderSubtree([f("p", "p", "q"), f("q", "q", "p")], "p")].sort()).toEqual(["p", "q"]);
  });
});
