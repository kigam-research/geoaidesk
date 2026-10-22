"use client";

import { useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { useProjectScopeId } from "@/lib/projects";
import { t } from "@/geo/i18n";
import type { ConnectionFocus } from "@/geo/contracts/connections";
import { ConnectionMapPane, type ConnectionMapPaneProps } from "./connection-map-pane";

type MapProps = Omit<ConnectionMapPaneProps, "onClose">;

/** A non-modal side pane keeps the researcher's work available (D1/D2). Controlled; `trigger` is optional. */
export function ConnectionMapDialog({ open, onOpenChange, trigger, ...pane }: MapProps & { open: boolean; onOpenChange: (open: boolean) => void; trigger?: ReactNode }) {
  return <DialogPrimitive.Root modal={false} open={open} onOpenChange={onOpenChange}>
    {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content aria-describedby={undefined} onInteractOutside={e => e.preventDefault()}
        className="fixed inset-y-4 right-4 z-50 w-[min(1100px,calc(100vw-48px))] overflow-hidden rounded-lg border border-gaid-frame bg-gaid-face shadow-lg outline-none">
        <DialogPrimitive.Title className="sr-only">{t("connections.title")}</DialogPrimitive.Title>
        <ConnectionMapPane {...pane} onClose={() => onOpenChange(false)} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function ConnectionMapButton({ focus, label, projectId, ...rest }: Omit<MapProps, "projectId" | "focus"> & { focus: ConnectionFocus; label?: string; projectId?: string }) {
  const activeProjectId = useProjectScopeId();
  const [open, setOpen] = useState(false);
  return <ConnectionMapDialog open={open} onOpenChange={setOpen} focus={focus} projectId={projectId ?? activeProjectId} {...rest}
    trigger={<Button variant="outline" size="sm">{label ?? t("connections.show.button")}</Button>} />;
}
