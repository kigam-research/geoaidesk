"use client";

/** The folders card of a library item's detail (papers and research notes): its folders, add to or remove from one. */
import { FolderIcon, FolderPlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";
import type { LibraryCollection, LibraryItem } from "@/geo/contracts/library";
import { setFolderItems, zoteroState } from "./api";
import { folderPath } from "./folder-tree";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);
const PILL = "inline-flex items-center rounded-full border px-2 py-px text-xs font-medium whitespace-nowrap";

export function ItemFolders({ item, collections, onChanged }: { item: LibraryItem; collections: LibraryCollection[]; onChanged: () => void | Promise<void> }) {
  const changeFolder = async (folderId: string, action: "add" | "remove") => {
    try {
      const r = await setFolderItems(folderId, [item.id], action);
      if (r.removeInZotero.length) toast.info(L("folders.removeInZotero"));
      else if (r.changed) toast.success(action === "add" ? L(r.writtenToZotero ? "folders.addedZotero" : "folders.added", { name: collections.find((c) => c.id === folderId)?.name ?? "" }) : L("folders.removed"));
      await onChanged();
    } catch (error) {
      const state = zoteroState(error);
      toast.error(state ? t(`library.zotero.states.${state}`) : L("folders.addFailed"));
    }
  };
  const inFolders = item.collectionIds.filter((c) => collections.some((x) => x.id === c));
  const otherFolders = collections.filter((c) => !item.collectionIds.includes(c.id)).map((c) => ({ id: c.id, path: folderPath(collections, c.id) })).sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{L("folders.itemTitle")}</h3>
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm" disabled={!otherFolders.length}><FolderPlusIcon data-icon="inline-start" />{L("folders.add.button")}</Button></PopoverTrigger>
          <PopoverContent align="end" className="max-h-72 w-64 overflow-auto p-1.5">
            {otherFolders.map((f) => (
              <button key={f.id} type="button" onClick={() => void changeFolder(f.id, "add")} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{f.path}</button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {inFolders.length === 0 ? <p className="text-sm text-muted-foreground">{L("folders.itemNone")}</p> : (
        <ul className="flex flex-wrap gap-1.5">
          {inFolders.map((fid) => (
            <li key={fid} className={cn(PILL, "gap-1 text-foreground")}>
              <FolderIcon className="size-3" aria-hidden />{folderPath(collections, fid)}
              <button type="button" aria-label={L("folders.remove.action", { name: collections.find((c) => c.id === fid)?.name ?? "" })} onClick={() => void changeFolder(fid, "remove")} className="rounded text-muted-foreground hover:text-foreground"><XIcon className="size-3" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
