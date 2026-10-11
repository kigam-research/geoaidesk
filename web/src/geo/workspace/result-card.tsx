"use client";

/**
 * Body of a `geo-result` scientific result card: a reference to a
 * geo-result/v1 manifest that opens in its viewer (map, depth tracks, …).
 * Owner: gaid-korean-workspace (WP07). The card holds no layer, curve or table
 * data; the viewer reads the manifest.
 */
import type { GeoResultResult } from "@/lib/scientific-results";
import { t } from "@/geo/i18n";
import { Button } from "@/components/ui/button";

export function GeoResultBody({
  card,
  onOpenFile,
}: {
  card: GeoResultResult;
  projectId: string;
  onOpenFile?: (path: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <code className="truncate font-mono text-muted-foreground">{card.manifestPath}</code>
      {onOpenFile && (
        <Button size="sm" variant="outline" onClick={() => onOpenFile(card.manifestPath)}>
          {t("workspace.result.open", { kind: card.resultKind })}
        </Button>
      )}
    </div>
  );
}
