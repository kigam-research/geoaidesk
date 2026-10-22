"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Handle, Panel, Position, ReactFlow, useReactFlow, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { CONNECTION_NODE_KINDS, type ConnectionFocus, type ConnectionMapResponse, type ConnectionNodeKind } from "@/geo/contracts/connections";
import { fetchConnections } from "./api";
import { edgeLabel, layoutConnections, type ConnectionFlowNode } from "./layout";
import "./connections.css";

export interface ConnectionOpenActions {
  onOpenNote?: (id: string) => void;
  onOpenFile?: (path: string) => void;
  onOpenChat?: (id: string) => void;
  onOpenPaper?: (id: string) => void;
  onOpenWorkflow?: (id: string) => void;
}
export interface ConnectionMapPaneProps extends ConnectionOpenActions {
  projectId: string;
  focus: ConnectionFocus;
  onClose: () => void;
  /** Shown in the header when the map opens outside its project (the library). */
  projectName?: string;
  /** Outside the project, items without their own open action open the project instead. */
  onOpenProject?: () => void;
}

function ConnectionCard({ data, selected }: NodeProps<ConnectionFlowNode>) {
  const item = data.item;
  return <>
    <Handle type="target" position={Position.Left} className="connection-handle" />
    <button type="button" title={item.title} aria-pressed={selected} onClick={() => data.select(item.id)}
      className={cn("connection-card relative flex h-full w-full flex-col justify-center gap-1 rounded-md border border-gaid-control-edge bg-gaid-face px-3 text-left text-gaid-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:bg-gaid-chrome", (selected || data.focus) && "gaid-index border-gaid-signal bg-gaid-signal-tint", data.focus && "font-semibold")}>
      <span className="flex items-center justify-between gap-2 text-sm text-gaid-ink-2">
        <span>{t("connections.kind." + item.kind)}</span>
        {data.focus && <span>{t("connections.focus")}</span>}
      </span>
      <span className="w-full truncate text-base">{item.title}</span>
      {item.attention && <span className="truncate text-sm text-gaid-warning">{t("connections.attention." + item.attention)}</span>}
    </button>
    <Handle type="source" position={Position.Right} className="connection-handle" />
  </>;
}
function ViewportControls() {
  const flow = useReactFlow();
  return <Panel position="bottom-left" className="flex gap-2">
    <Button variant="outline" size="sm" onClick={() => flow.zoomIn()}>{t("connections.zoom.in.button")}</Button>
    <Button variant="outline" size="sm" onClick={() => flow.zoomOut()}>{t("connections.zoom.out.button")}</Button>
    <Button variant="outline" size="sm" onClick={() => flow.fitView({ padding: 0.2, maxZoom: 1 })}>{t("connections.zoom.fit.button")}</Button>
  </Panel>;
}

const nodeTypes = { connection: ConnectionCard };

function ConnectionMapContent({ projectId, focus, onClose, projectName, onOpenProject, ...actions }: ConnectionMapPaneProps) {
  const [centre, setCentre] = useState<ConnectionFocus>(focus);
  const [depth, setDepth] = useState<1 | 2>(1);
  const [view, setView] = useState<"map" | "list">("map");
  const [response, setResponse] = useState<{ key: string; data: ConnectionMapResponse | null; error: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const uid = useId();
  const requestKey = JSON.stringify([projectId, centre, depth, reload]);
  const data = response?.key === requestKey ? response.data : null;
  const error = response?.key === requestKey && response.error;
  useEffect(() => {
    const controller = new AbortController();
    fetchConnections(projectId, centre, depth, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setResponse({ key: requestKey, data: result, error: false }); setSelected(result.focus);
    }).catch(() => { if (!controller.signal.aborted) setResponse({ key: requestKey, data: null, error: true }); });
    return () => controller.abort();
  }, [projectId, centre, depth, requestKey]);
  const select = useCallback((id: string) => setSelected(id), []);
  const layout = useMemo(() => data ? layoutConnections(data, select) : { nodes: [], edges: [] }, [data, select]);
  const item = data?.nodes.find(n => n.id === selected);
  const handlers: Record<ConnectionNodeKind, ((ref: string) => void) | undefined> = {
    note: actions.onOpenNote, file: actions.onOpenFile, figure: actions.onOpenFile,
    chat: actions.onOpenChat, paper: actions.onOpenPaper, workflow: actions.onOpenWorkflow,
  };
  return <section className="connection-pane flex h-full min-h-0 flex-col bg-gaid-face text-gaid-ink" aria-label={t("connections.title")}>
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gaid-edge bg-gaid-chrome px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold">{t("connections.title")}</h2>
        <p className="mt-1 text-sm text-gaid-ink-2">{projectName ? t("connections.hintProject", { project: projectName }) : t("connections.hint")}</p>
      </div>
      <Button variant="ghost" onClick={onClose}>{t("connections.close.button")}</Button>
    </header>
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gaid-edge px-5 py-3">
      <div className="gaid-seg" role="group" aria-label={t("connections.depth.label")}>
        {([1, 2] as const).map(n => <button type="button" key={n} aria-pressed={depth === n} onClick={() => setDepth(n)}>{t("connections.depth." + n)}</button>)}
      </div>
      <div className="gaid-seg" role="tablist" aria-label={t("connections.view.label")}>
        {(["map", "list"] as const).map(v => <button type="button" key={v} role="tab" id={uid + v} aria-selected={view === v} aria-controls={uid + "content"} tabIndex={view === v ? 0 : -1} onClick={() => setView(v)} onKeyDown={e => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault(); const next = e.key === "Home" ? "map" : e.key === "End" ? "list" : v === "map" ? "list" : "map"; setView(next);
            document.getElementById(uid + next)?.focus();
          }
        }}>{t("connections.view." + v)}</button>)}
      </div>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_248px]">
      <div id={uid + "content"} role="tabpanel" aria-labelledby={uid + view} className="relative min-h-0 min-w-0" tabIndex={0}>
        {error ? <div className="space-y-3 p-6" role="alert">
          <p>{t("connections.error")}</p>
          <Button variant="outline" onClick={() => setReload(n => n + 1)}>{t("connections.retry.button")}</Button>
        </div> : !data ? <div role="status" className="space-y-4 p-6">
          <p className="text-sm text-gaid-ink-2">{t("connections.loading")}</p>
          <div className="h-20 w-56 rounded-md border border-gaid-edge bg-gaid-chrome" />
          <div className="ml-20 h-20 w-56 rounded-md border border-gaid-edge bg-gaid-chrome" />
        </div> : view === "map" ? <ReactFlow key={data.focus + depth} nodes={layout.nodes.map(n => ({ ...n, selected: n.id === selected }))} edges={layout.edges} nodeTypes={nodeTypes}
          fitView fitViewOptions={{ padding: 0.12, minZoom: 0.75, maxZoom: 1 }} minZoom={0.3} maxZoom={1.5}
          nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} elementsSelectable={false}
          onNodeClick={(_e, node) => select(node.id)} onNodeDoubleClick={e => e.preventDefault()}
          ariaLabelConfig={{ "node.a11yDescription.default": t("connections.keyboard.hint"), "node.a11yDescription.keyboardDisabled": t("connections.keyboard.hint"), "edge.a11yDescription.default": t("connections.keyboard.links"), "handle.ariaLabel": t("connections.keyboard.handle") }} aria-label={t("connections.view.map")}><ViewportControls /></ReactFlow> :
          <div className="h-full overflow-auto p-4">
            <ul className="divide-y divide-gaid-edge" aria-label={t("connections.list.label")}>
              {data.nodes.map(n => <li key={n.id}><button type="button" onClick={() => select(n.id)} aria-label={t("connections.item.label", { title: n.title, kind: t("connections.kind." + n.kind) })} aria-pressed={selected === n.id}
                className={cn("relative w-full rounded-md px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring hover:bg-gaid-chrome", selected === n.id && "gaid-index bg-gaid-signal-tint")}>
                <span className="block truncate font-medium">{n.title}</span>
                <span className="block text-sm text-gaid-ink-2">{t("connections.kind." + n.kind)}{n.attention ? " · " + t("connections.attention." + n.attention) : ""}</span>
              </button></li>)}
            </ul>
            <h3 className="mb-2 mt-5 font-semibold">{t("connections.links.title")}</h3>
            <ul className="space-y-2 text-sm text-gaid-ink-2">{data.edges.map((e, i) => <li key={i}>
              {t("connections.relation", { from: data.nodes.find(n => n.id === e.from)?.title ?? "", relation: edgeLabel(e.kind), to: data.nodes.find(n => n.id === e.to)?.title ?? "" })}
              {e.confidence === "inferred" && <span> ({t("connections.inferred")})</span>}
            </li>)}</ul>
          </div>}
      </div>
      <aside className="flex min-h-0 flex-col gap-5 border-l border-gaid-edge bg-gaid-chrome p-4" aria-label={t("connections.legend.title")}>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("connections.legend.title")}</h3>
          <p className="flex items-center gap-2 text-sm"><span className="w-7 border-t border-gaid-ink-3" aria-hidden />{t("connections.observed")}</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><span className="w-7 border-t border-dashed border-gaid-ink-3" aria-hidden />{t("connections.inferred")}</p>
          <p className="mt-3 text-sm text-gaid-ink-2">{CONNECTION_NODE_KINDS.map(k => t("connections.kind." + k)).join(", ")}</p>
        </div>
        <div className="min-h-0 border-t border-gaid-edge pt-4" aria-live="polite">
          {item && <>
            <p className="text-xs text-gaid-ink-2">{t("connections.kind." + item.kind)}</p>
            <h3 className="mt-1 line-clamp-3 break-words font-semibold" title={item.title}>{item.title}</h3>
            {item.detail && <p className="mt-2 line-clamp-2 break-words text-sm text-gaid-ink-2">{item.detail}</p>}
            {item.attention && <p className="mt-2 text-sm text-gaid-warning">{t("connections.attention." + item.attention)}</p>}
            <div className="mt-4 flex flex-col gap-2">
              {!handlers[item.open.kind] && onOpenProject
                ? <Button onClick={onOpenProject}>{t("connections.open.project.button")}</Button>
                : <Button disabled={!handlers[item.open.kind] || item.attention === "missing"} onClick={() => handlers[item.open.kind]?.(item.open.ref)}>{t("connections.open." + item.kind + ".button")}</Button>}
              {!handlers[item.open.kind] && !onOpenProject && <p className="text-xs text-gaid-ink-2">{t("connections.open.unavailable")}</p>}
              <Button variant="outline" disabled={item.id === data?.focus} onClick={() => setCentre(item.id as ConnectionFocus)}>{t("connections.centre.button")}</Button>
            </div>
          </>}
        </div>
        <div className="mt-auto text-sm text-gaid-ink-2" role="status">
          {data && <p>{t("connections.count", { count: data.nodes.length })}</p>}
          {data?.nodes.length === 1 && <p className="mt-2">{t("connections.empty")}</p>}
          {data?.truncated && <p className="mt-2">{t("connections.truncated.limit")}</p>}
        </div>
      </aside>
    </div>
  </section>;
}

/** Reset view-local state when an external entry point changes project or focus. */
export function ConnectionMapPane(props: ConnectionMapPaneProps) {
  return <ConnectionMapContent key={JSON.stringify([props.projectId, props.focus])} {...props} />;
}
