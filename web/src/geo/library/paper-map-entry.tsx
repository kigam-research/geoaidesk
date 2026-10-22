"use client";

/**
 * Library paper → connection map (gaid-visuals-next; answer to gaid-research-visuals#3 가)). The library spans projects and
 * the map is the links inside one project, so the researcher picks the project where the paper is used: its notes cite
 * it or the project has it attached. One such project opens directly; several open a short project choice first.
 */
import { useState } from "react";
import { WaypointsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/geo/i18n";
import { ConnectionMapDialog } from "@/geo/connections";
import type { LibraryUse } from "@/geo/contracts/library";

const L = (key: string, values?: Record<string, unknown>) => t(`library.map.${key}`, values as never);

export interface MapProject { projectId: string; projectName: string; notes: number }

/** Projects where the paper is used: citing projects first (most notes first), then projects that only attach it. */
export function mapProjects(uses: LibraryUse[]): MapProject[] {
  const byId = new Map<string, MapProject>();
  for (const use of uses) {
    if (use.kind !== "note" && use.kind !== "project") continue;
    const entry = byId.get(use.projectId) ?? { projectId: use.projectId, projectName: use.projectName, notes: 0 };
    if (use.kind === "note") entry.notes += 1;
    byId.set(use.projectId, entry);
  }
  return [...byId.values()].sort((a, b) => b.notes - a.notes || a.projectName.localeCompare(b.projectName));
}

export function PaperMapEntry({ itemId, uses, onOpenProject, onOpenPaper }: { itemId: string; uses: LibraryUse[]; onOpenProject: (projectId: string) => void; onOpenPaper: (itemId: string) => void }) {
  const [project, setProject] = useState<MapProject | null>(null);
  const [picking, setPicking] = useState(false);
  const projects = mapProjects(uses);
  if (!projects.length) return null;
  const open = (p: MapProject) => { setPicking(false); setProject(p); };
  const label = <><WaypointsIcon data-icon="inline-start" />{L("button")}</>;
  return <>
    {projects.length === 1
      ? <Button variant="ghost" size="sm" onClick={() => open(projects[0])}>{label}</Button>
      : <Popover open={picking} onOpenChange={setPicking}>
        <PopoverTrigger asChild><Button variant="ghost" size="sm">{label}</Button></PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <p className="px-2 pb-1 text-sm text-muted-foreground">{L("pickTitle")}</p>
          {projects.map((p) => (
            <button key={p.projectId} type="button" onClick={() => open(p)} className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted">
              <span className="truncate text-sm">{p.projectName}</span>
              <span className="text-sm text-muted-foreground">{p.notes ? L("notes", { n: p.notes }) : L("attached")}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>}
    {project && <ConnectionMapDialog open onOpenChange={(o) => { if (!o) setProject(null); }}
      projectId={project.projectId} projectName={project.projectName} focus={`paper:${itemId}`}
      onOpenPaper={(id) => { setProject(null); onOpenPaper(id); }}
      onOpenProject={() => onOpenProject(project.projectId)} />}
  </>;
}
