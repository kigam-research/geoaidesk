/** Client for `GET /geo/workspace/home` (contract: web/src/geo/contracts/workspace-home.ts). */
import { useCallback, useEffect, useState } from "react";

import type { WorkspaceHomeResponse } from "@/geo/contracts/workspace-home";
import { apiFetch } from "@/lib/projects";

export async function getWorkspaceHome(): Promise<WorkspaceHomeResponse> {
  const res = await apiFetch("/geo/workspace/home");
  if (!res.ok) throw new Error(`workspace home ${res.status}`);
  return (await res.json()) as WorkspaceHomeResponse;
}

/** The Workspace home summary, read while `active` (again each time the home becomes active). */
export function useWorkspaceHome(active: boolean): { data: WorkspaceHomeResponse | null; error: boolean; reload: () => void } {
  const [data, setData] = useState<WorkspaceHomeResponse | null>(null);
  const [error, setError] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    getWorkspaceHome()
      .then((next) => {
        if (!live) return;
        setData(next);
        setError(false);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [active, round]);
  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { data, error, reload };
}
