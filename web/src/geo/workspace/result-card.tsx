"use client";

import type { GeoResultResult } from "@/lib/scientific-results";
import { rawFileUrl } from "@/lib/use-sandbox";
import { t } from "@/geo/i18n";
import { Button } from "@/components/ui/button";

export function GeoResultBody({ card, projectId, onOpenFile }: { card: GeoResultResult; projectId: string; onOpenFile?: (path: string) => void }) {
  return <div className="min-w-0 space-y-2 text-xs break-words">
    <p>{t("workspace.result.kind", { kind: card.resultKind })}</p>
    <code className="block font-mono text-muted-foreground">{card.manifestPath}</code>
    {card.thumbnailPath && /* rawFileUrl includes project scoping and withApiToken. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={rawFileUrl(card.thumbnailPath, projectId)} alt={t("workspace.result.thumbnail", { title: card.title })} className="max-h-48 max-w-full rounded object-contain" />}
    {onOpenFile && <Button size="sm" variant="outline" onClick={() => onOpenFile(card.manifestPath)}>{t("workspace.result.open", { kind: card.resultKind })}</Button>}
  </div>;
}
