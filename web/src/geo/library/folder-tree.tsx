"use client";

/**
 * 서재 폴더 (gaid-library-folders): "전체 논문" plus the nested folder tree. A folder linked to a Zotero collection
 * carries a link mark; papers dragged from the table onto a folder are added to it (the detail pane's folder picker is
 * the keyboard path).
 */
import { useMemo, useState, type DragEvent } from "react";
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FolderPlusIcon, LibraryIcon, Link2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryCollection } from "@/geo/contracts/library";

const L = (key: string, values?: Record<string, unknown>) => t(`library.folders.${key}`, values as never);
/** MIME type of a dragged table row (the paper's GAID id). */
export const ITEM_DRAG_TYPE = "application/x-gaid-library-item";

export interface FolderNode {
  folder: LibraryCollection;
  children: FolderNode[];
}

/** Folders as a tree, siblings sorted by name; a folder whose parent is missing is shown at the top level. */
export function folderTree(collections: LibraryCollection[]): FolderNode[] {
  const ids = new Set(collections.map((c) => c.id));
  const byParent = new Map<string | undefined, LibraryCollection[]>();
  for (const c of collections) {
    const parent = c.parentId && ids.has(c.parentId) && c.parentId !== c.id ? c.parentId : undefined;
    byParent.set(parent, [...(byParent.get(parent) ?? []), c]);
  }
  const seen = new Set<string>();
  const build = (parent: string | undefined): FolderNode[] =>
    (byParent.get(parent) ?? [])
      .filter((c) => !seen.has(c.id) && (seen.add(c.id), true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ folder, children: build(folder.id) }));
  return build(undefined);
}

/** "상위 › 하위" path of a folder, for chips and pickers. */
export function folderPath(collections: LibraryCollection[], id: string): string {
  const parts: string[] = [];
  let current = collections.find((c) => c.id === id);
  for (let i = 0; current && i < 20; i++) {
    parts.unshift(current.name);
    current = current.parentId ? collections.find((c) => c.id === current!.parentId) : undefined;
  }
  return parts.join(" › ");
}

export interface FolderTreeProps {
  collections: LibraryCollection[];
  counts: Record<string, number>;
  total: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onDropItem: (folderId: string, itemId: string) => void;
}

export function FolderTree({ collections, counts, total, selected, onSelect, onCreate, onDropItem }: FolderTreeProps) {
  const tree = useMemo(() => folderTree(collections), [collections]);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<string | null>(null);
  const toggle = (id: string) => setClosed((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const drop = (id: string) => ({
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(ITEM_DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(id); } },
    onDragLeave: () => setOver((cur) => (cur === id ? null : cur)),
    onDrop: (e: DragEvent) => { const item = e.dataTransfer.getData(ITEM_DRAG_TYPE); setOver(null); if (item) { e.preventDefault(); onDropItem(id, item); } },
  });

  const row = (node: FolderNode, depth: number) => {
    const { folder } = node;
    const open = !closed.has(folder.id);
    return (
      <li key={folder.id} role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={selected === folder.id}>
        <div
          {...drop(folder.id)}
          className={cn("group flex h-8 items-center gap-1 rounded-md pr-2 text-sm", selected === folder.id ? "bg-primary/10 text-primary" : "hover:bg-muted", over === folder.id && "ring-2 ring-primary")}
          style={{ paddingLeft: 4 + depth * 14 }}
        >
          {node.children.length ? (
            <button type="button" onClick={() => toggle(folder.id)} aria-label={open ? L("collapse", { name: folder.name }) : L("expand", { name: folder.name })} className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground">
              {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
            </button>
          ) : <span className="size-5 shrink-0" aria-hidden />}
          <button type="button" onClick={() => onSelect(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none focus-visible:underline">
            <FolderIcon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{folder.name}</span>
          </button>
          {folder.zotero && (
            <Tooltip>
              <TooltipTrigger asChild><span tabIndex={0} aria-label={L("linkedHint")} className="text-muted-foreground"><Link2Icon className="size-3.5" /></span></TooltipTrigger>
              <TooltipContent>{L("linkedHint")}</TooltipContent>
            </Tooltip>
          )}
          <span className="gaid-numeric text-xs text-muted-foreground">{counts[folder.id] ?? 0}</span>
        </div>
        {open && node.children.length > 0 && <ul role="group">{node.children.map((child) => row(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <nav className="flex w-[216px] shrink-0 flex-col gap-1" aria-label={L("title")}>
      <div className="flex h-9 items-center justify-between">
        <h2 className="text-sm font-semibold">{L("title")}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={L("new.button")} onClick={onCreate}><FolderPlusIcon /></Button>
          </TooltipTrigger>
          <TooltipContent>{L("new.button")}</TooltipContent>
        </Tooltip>
      </div>
      <button type="button" onClick={() => onSelect(null)} aria-pressed={selected === null}
        className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-sm", selected === null ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
        <LibraryIcon className="size-4" aria-hidden />
        <span className="flex-1 text-left">{L("all")}</span>
        <span className="gaid-numeric text-xs text-muted-foreground">{total}</span>
      </button>
      {tree.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{L("empty")}</p>
      ) : (
        <ul role="tree" aria-label={L("title")} className="min-h-0 flex-1 overflow-auto">{tree.map((node) => row(node, 0))}</ul>
      )}
    </nav>
  );
}
