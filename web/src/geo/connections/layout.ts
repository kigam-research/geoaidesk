import dagre from "@dagrejs/dagre";
import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import type { ConnectionEdgeKind, ConnectionMapResponse, ConnectionNode } from "@/geo/contracts/connections";
import { t } from "@/geo/i18n";

export const CONNECTION_CARD = { width: 224, height: 88 };
export type ConnectionCardData = Record<string, unknown> & {
  item: ConnectionNode; focus: boolean; select: (id: string) => void;
};
export type ConnectionFlowNode = Node<ConnectionCardData, "connection">;
export function edgeLabel(kind: ConnectionEdgeKind): string { return t("connections.edge." + kind); }

/** Deterministic LR layout, never mutates the server response. */
export function layoutConnections(map: ConnectionMapResponse, select: (id: string) => void): { nodes: ConnectionFlowNode[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph({ multigraph: true }).setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: 112, nodesep: 44, marginx: 32, marginy: 32 });
  for (const item of map.nodes) graph.setNode(item.id, { ...CONNECTION_CARD });
  map.edges.forEach((edge, i) => graph.setEdge(edge.from, edge.to, {}, String(i)));
  dagre.layout(graph);
  const nodes: ConnectionFlowNode[] = map.nodes.map(item => {
    const p = graph.node(item.id);
    return {
      id: item.id, type: "connection", data: { item, focus: item.id === map.focus, select },
      width: CONNECTION_CARD.width, height: CONNECTION_CARD.height,
      position: { x: p.x - CONNECTION_CARD.width / 2, y: p.y - CONNECTION_CARD.height / 2 },
      sourcePosition: Position.Right, targetPosition: Position.Left,
      draggable: false, connectable: false,
    };
  });
  const edges: Edge[] = map.edges.map((e, i) => ({
    id: "connection-" + i, source: e.from, target: e.to, type: "smoothstep",
    label: edgeLabel(e.kind),
    ariaLabel: t(e.confidence === "inferred" ? "connections.relationInferred" : "connections.relation", {
      from: map.nodes.find(n => n.id === e.from)?.title ?? "",
      relation: edgeLabel(e.kind),
      to: map.nodes.find(n => n.id === e.to)?.title ?? "",
    }),
    style: { stroke: "var(--gaid-ink-3)", strokeWidth: 1.5, ...(e.confidence === "inferred" ? { strokeDasharray: "6 4" } : {}) },
    labelStyle: { fill: "var(--gaid-ink-2)", fontSize: 15 },
    labelBgStyle: { fill: "var(--gaid-face)" }, labelBgPadding: [6, 4],
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--gaid-ink-3)" },
    focusable: false, selectable: false,
  }));
  return { nodes, edges };
}
