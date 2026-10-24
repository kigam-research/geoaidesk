"use client";
/**
 * The full 서재 screen (ADR 2026-10-24 gaid-connect-workspace): the researcher's personal papers and research notes,
 * opened from the app bar over GAID Workspace or GAID Connect. The place switch shows no current place while it is
 * open, and the back action returns to the place it was opened from.
 */
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SettingsDialog } from "@/components/lazy-surfaces";
import { Button } from "@/components/ui/button";
import { geoText } from "@/geo/i18n";
import { LibraryScreen } from "@/geo/library/library-screen";
import { GaidAppBar } from "@/geo/shell/app-bar";
import { onOpenSettings, type OpenSettingsRequest } from "@/lib/settings-nav";

import type { LibraryReturn } from "./library-location";
import type { GaidPlace } from "./navigation";

const text = geoText("places");

export function LibraryPlace({
  itemId,
  returnTo,
  onClose,
  onNavigate,
  onOpenProject,
}: {
  itemId: string | null;
  returnTo: LibraryReturn;
  onClose: () => void;
  onNavigate: (place: GaidPlace) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequest, setSettingsRequest] = useState<OpenSettingsRequest | null>(null);
  useEffect(
    () =>
      onOpenSettings((request) => {
        setSettingsRequest(request);
        setSettingsOpen(true);
      }),
    [],
  );
  const placeName = text(`bar.${returnTo.place}`);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <GaidAppBar
        place={null}
        libraryOpen
        onNavigate={onNavigate}
        onHome={() => onNavigate("workspace")}
        trailing={
          <Button variant="ghost" size="sm" title={text("library.backTip")} onClick={onClose}>
            <ArrowLeftIcon data-icon="inline-start" />
            {text("library.back", { place: placeName })}
          </Button>
        }
        onOpenSettings={() => {
          setSettingsRequest(null);
          setSettingsOpen(true);
        }}
      />
      <LibraryScreen onOpenProject={onOpenProject} initialItemId={itemId} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} request={settingsRequest} />
    </div>
  );
}
