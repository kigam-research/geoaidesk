"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { useProjectScopeId } from "@/lib/projects";
import { t } from "@/geo/i18n";
import type { ConnectionFocus } from "@/geo/contracts/connections";
import { ConnectionMapPane, type ConnectionOpenActions } from "./connection-map-pane";

/** A non-modal side pane keeps the researcher's work available (D1/D2). */
export function ConnectionMapButton({ focus, label, projectId, ...actions }: ConnectionOpenActions & { focus: ConnectionFocus; label?: string; projectId?: string }) {
  const activeProjectId = useProjectScopeId();
  const [open, setOpen] = useState(false);
  return <DialogPrimitive.Root modal={false} open={open} onOpenChange={setOpen}>
    <DialogPrimitive.Trigger asChild><Button variant="outline" size="sm">{label ?? t("connections.show.button")}</Button></DialogPrimitive.Trigger>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content aria-describedby={undefined} onInteractOutside={e => e.preventDefault()}
        className="fixed inset-y-4 right-4 z-50 w-[min(1100px,calc(100vw-48px))] overflow-hidden rounded-lg border border-gaid-frame bg-gaid-face shadow-lg outline-none">
        <DialogPrimitive.Title className="sr-only">{t("connections.title")}</DialogPrimitive.Title>
        <ConnectionMapPane focus={focus} projectId={projectId ?? activeProjectId} {...actions} onClose={() => setOpen(false)} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
