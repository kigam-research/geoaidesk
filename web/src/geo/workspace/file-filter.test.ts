import { describe, expect, it } from "vitest";
import type { TreeNode } from "@/lib/use-sandbox";
import { filterTree } from "./file-filter";

const file = (path: string): TreeNode => ({ name: path.split("/").pop()!, type: "file", path });
const dir = (path: string, children: TreeNode[]): TreeNode => ({ name: path.split("/").pop()!, type: "directory", path, children });
const tree = [
  dir("user_data", [dir("user_data/samples", [file("user_data/samples/Seoul_Litho.shp"), file("user_data/samples/dem.tif")])]),
  dir("results", [file("results/area.csv")]),
  file("README.md"),
];

describe("filterTree", () => {
  it("returns the tree unchanged for an empty query", () => {
    expect(filterTree(tree, "  ").nodes).toBe(tree);
  });

  it("keeps matches with the folders that lead to them, opened", () => {
    const result = filterTree(tree, "litho");
    expect(result.matches).toBe(1);
    expect(result.nodes.map((n) => n.path)).toEqual(["user_data"]);
    expect(result.nodes[0].children![0].children!.map((n) => n.path)).toEqual(["user_data/samples/Seoul_Litho.shp"]);
    expect([...result.expanded].sort()).toEqual(["user_data", "user_data/samples"]);
  });

  it("keeps a folder that matches by name with its whole content and does not force it open", () => {
    const result = filterTree(tree, "RESULTS");
    expect(result.nodes).toEqual([tree[1]]);
    expect(result.expanded.size).toBe(0);
  });
});
