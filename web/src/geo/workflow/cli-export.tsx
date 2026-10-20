"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { withApiToken } from "@/lib/api-auth";
import { API_BASE, getActiveProjectId } from "@/lib/projects";
import { geoLocale, t } from "@/geo/i18n";

export type CliExportSource = { kind: "project"; workflowId: string; method?: string } | { kind: "hub"; entryId: string };

/** The server rejects unverified targets too. These are the real-CLI-checked adapters, not a capability guess. */
export function cliExportUrl(source: CliExportSource, target: "pi" | "claude") {
  const query = new URLSearchParams({ target, locale: geoLocale(), project: getActiveProjectId() });
  if (source.kind === "project" && source.method) query.set("method", source.method);
  const route = source.kind === "hub" ? `/geo/hub/entries/${encodeURIComponent(source.entryId)}` : `/geo/workflows/${encodeURIComponent(source.workflowId)}`;
  return withApiToken(`${API_BASE}${route}/cli-export?${query}`);
}

export function CliExportButton({ source }: { source: CliExportSource }) {
  const titleId = useId();
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm">{t("workflowCli.export.button")}</Button></PopoverTrigger>
    <PopoverContent align="end" aria-labelledby={titleId} className="space-y-3 text-sm">
      <h3 id={titleId} className="font-medium">{t("workflowCli.target.title")}</h3>
      <p className="text-muted-foreground">{t("workflowCli.target.hint")}</p>
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" asChild><a href={cliExportUrl(source, "pi")} download>{t("workflowCli.pi.button")}</a></Button>
        <Button variant="outline" size="sm" asChild><a href={cliExportUrl(source, "claude")} download>{t("workflowCli.claude.button")}</a></Button>
      </div>
    </PopoverContent>
  </Popover>;
}
