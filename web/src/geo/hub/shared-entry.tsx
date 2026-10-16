"use client";
/**
 * A registered method in the shared GAID hub (`#hub/e/<id>`): details, method flow, stars and comments, and "use in my
 * research" (install into one of my projects, prepare its inputs, open its start settings).
 */
import { ChevronLeftIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { HubEntryDetail } from "@/geo/contracts/hub-shared";
import { geoText } from "@/geo/i18n";
import { withApiToken } from "@/lib/api-auth";
import { API_BASE } from "@/lib/projects";

import { HubUserDialog } from "./hub-dialogs";
import { InputPrep } from "./input-prep";
import { MethodFlow, type StepVisual } from "./method-flow";
import { SharedMethod } from "./shared-method";
import { hubUserName, sharedHub } from "./shared-api";
import { TechnicalDetail } from "./technical";
import { localText } from "./text";

const text = geoText("hub");

/** Absolute, token-carrying URL for an image path the hub API returns. */
export const hubImage = (path: string | null | undefined) => (path ? withApiToken(`${API_BASE}${path}`) : null);

function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Run `action` once the researcher has a display name (asks for it the first time). */
export function useNamedAction() {
  const [pending, setPending] = useState<null | (() => void)>(null);
  const run = (action: () => void) => (hubUserName() ? action() : setPending(() => action));
  const dialog = (
    <HubUserDialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
      onSaved={() => {
        const action = pending;
        setPending(null);
        action?.();
      }}
    />
  );
  return { run, dialog };
}

export function SharedEntryScreen({
  entryId,
  projects,
  onOpenSetup,
  onBack,
}: {
  /** Back to the hub list. */
  onBack?: () => void;
  entryId: string;
  projects: { id: string; name: string }[];
  onOpenSetup: (projectId: string, methodKey: string, workflowId: string | null, recipeId: string | null) => void;
}) {
  const [detail, setDetail] = useState<HubEntryDetail | null>(null);
  const [folders, setFolders] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [useOpen, setUseOpen] = useState(false);
  const named = useNamedAction();

  const load = useCallback(async () => {
    try {
      setDetail(await sharedHub.entry(entryId));
      setError(null);
      const list = await sharedHub.folders().catch(() => ({ folders: [] }));
      setFolders(Object.fromEntries(list.folders.map((f) => [f.id, f.name])));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [entryId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!detail)
    return (
      <div className="flex flex-col gap-2 p-10 text-sm text-muted-foreground">
        <p>{error ? text("home.error") : text("home.loading")}</p>
        {error && <TechnicalDetail detail={error} />}
      </div>
    );
  const e = detail.entry;
  const latest = e.revisions.at(-1);
  const visuals: Record<string, StepVisual> = Object.fromEntries(
    Object.entries(detail.visuals).map(([k, v]) => [
      k,
      { src: hubImage(v.src)!, kind: "generated" as const, caption: v.caption },
    ]),
  );
  const outputImages: Record<string, StepVisual> = Object.fromEntries(
    Object.entries(detail.outputImages).map(([k, v]) => [
      k,
      { src: hubImage(v.src)!, kind: "generated" as const, caption: v.caption },
    ]),
  );
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      {onBack && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeftIcon data-icon="inline-start" />
            {text("shared.back")}
          </Button>
        </div>
      )}
      <SharedMethod
        method={{
          id: e.id,
          title: e.title,
          tagline: localText(detail.profile.tagline),
          note: latest?.note || undefined,
          summary: localText(detail.profile.summary) || e.summary,
          author: e.author,
          folder: folders[e.folderId] ?? null,
          revision: e.latestRevision,
          registeredAt: latest ? text("shared.registeredAt", { when: when(latest.registeredAt) }) : "",
          kind: e.kind,
          tags: e.tags,
          stars: e.stars,
          starred: e.starredByMe,
          trials: e.trials,
          image: hubImage(e.cover),
          comments: detail.comments.map((c) => ({
            id: c.id,
            author: c.author,
            at: when(c.at),
            body: c.body,
            revision: c.revision,
          })),
        }}
        profile={detail.profile}
        flow={<MethodFlow profile={detail.profile} visuals={visuals} outputImages={outputImages} />}
        onStar={() =>
          named.run(() => {
            void sharedHub
              .star(e.id, !e.starredByMe)
              .then(load)
              .catch((err: Error) => toast.error(err.message));
          })
        }
        onComment={(body) =>
          named.run(() => {
            void sharedHub
              .comment(e.id, body)
              .then(load)
              .catch((err: Error) => toast.error(err.message));
          })
        }
        onTry={() => named.run(() => setUseOpen(true))}
      />
      <UseInProjectDialog
        open={useOpen}
        onOpenChange={setUseOpen}
        entryId={e.id}
        revision={e.latestRevision}
        projects={projects}
        onOpenSetup={onOpenSetup}
      />
      {named.dialog}
    </main>
  );
}

function UseInProjectDialog({
  open,
  onOpenChange,
  entryId,
  revision,
  projects,
  onOpenSetup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  /** The revision shown on the page: installation is pinned to it. */
  revision: number;
  projects: { id: string; name: string }[];
  onOpenSetup: (projectId: string, methodKey: string, workflowId: string | null, recipeId: string | null) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState<{
    methodKey: string;
    workflowId: string | null;
    recipeId: string | null;
  } | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{text("shared.try")}</DialogTitle>
        </DialogHeader>
        {installed ? (
          <InputPrep
            projectId={projectId}
            projectName={projects.find((p) => p.id === projectId)?.name ?? projectId}
            methodKey={installed.methodKey}
            onOpenSetup={() => {
              onOpenChange(false);
              onOpenSetup(projectId, installed.methodKey, installed.workflowId, installed.recipeId);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {text("trial.project")}
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm font-normal"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {text("trial.consent")}
            </label>
            <Button
              disabled={!consent || busy || !projectId}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await sharedHub.install(entryId, projectId, revision);
                  setInstalled({ methodKey: r.install.methodKey, workflowId: r.workflowId, recipeId: r.recipeId });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {text("trial.install")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
