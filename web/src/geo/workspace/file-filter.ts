/**
 * File tree filter (UI guide v2 N5, N6): keeps files and folders whose name contains the query, with the folders that
 * lead to them. Folders kept only because something inside matches are opened; a folder that matches by name keeps
 * its whole content and the researcher's own open/closed choice.
 */
import type { TreeNode } from "@/lib/use-sandbox";

export interface FilteredTree { nodes: TreeNode[]; expanded: Set<string>; matches: number }

export function filterTree(nodes: TreeNode[], query: string): FilteredTree {
  const needle = query.trim().toLocaleLowerCase();
  const expanded = new Set<string>();
  let matches = 0;
  if (!needle) return { nodes, expanded, matches };
  const visit = (siblings: TreeNode[]): TreeNode[] => {
    const kept: TreeNode[] = [];
    for (const node of siblings) {
      if (node.name.toLocaleLowerCase().includes(needle)) {
        matches += 1;
        kept.push(node);
        continue;
      }
      if (node.type !== "directory") continue;
      const children = visit(node.children ?? []);
      if (!children.length) continue;
      expanded.add(node.path);
      kept.push({ ...node, children });
    }
    return kept;
  };
  return { nodes: visit(nodes), expanded, matches };
}
