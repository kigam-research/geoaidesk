"use client";

/**
 * Generic `geo-inspection/v1` viewer (placeholder; implemented by the
 * gaid-runtime `inspect` child unit).
 */
import type { ViewerProps } from "@/lib/viewers/registry";

export default function GeoInspectionViewer({ path }: ViewerProps) {
  return <div className="p-4 text-sm text-muted-foreground">{path}</div>;
}
