"use client";
/**
 * Computer resources behind one icon button (UI guide v2 R1): CPU, memory and GPU percentages are machinery, so the
 * workspace shows them only in this popover, not in the app bar.
 */
import { CpuIcon } from "lucide-react";

import { ResourceMonitor } from "@/components/resource-monitor";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { geoText } from "@/geo/i18n";

const appText = geoText("app");

export function SystemResourcesButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={appText("header.systemResources")} title={appText("header.systemResources")}>
          <CpuIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <ResourceMonitor />
      </PopoverContent>
    </Popover>
  );
}
