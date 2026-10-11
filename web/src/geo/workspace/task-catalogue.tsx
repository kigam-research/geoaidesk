"use client";

import type { ReactNode } from "react";

/**
 * The workflows view: GAID tasks from the pinned catalogue with readiness,
 * task setup and recipe import. `children` is the upstream workflow list,
 * shown when the geo catalogue is off. Mounted by app/page.tsx.
 * Owner: gaid-korean-workspace--tasks. Shows the upstream list until built.
 */
export function GeoTaskCatalogue({
  children,
}: {
  projectId: string;
  availableFiles: string[];
  children: ReactNode;
}) {
  return <>{children}</>;
}
