"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProjectProvider } from "@/lib/use-projects";
import { ApiTokenGate } from "@/components/api-token-gate";

/** The prototype must not fetch projects, sync project cookies, or open credential prompts. */
export function GeoRuntimeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/authoring-preview" || pathname?.startsWith("/authoring-preview/")) return <>{children}</>;
  return <ProjectProvider>{children}<ApiTokenGate /></ProjectProvider>;
}
