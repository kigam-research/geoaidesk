"use client";
/** Trial step: where the draft is installed, a way back into that project, and a change request. */
import { FlaskConicalIcon, PencilLineIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AuthoringInstall, AuthoringProject } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";

const text = geoText("hub");

export function TrialStep({
  project,
  projectName,
  onOpen,
  onFeedback,
}: {
  project: AuthoringProject;
  projectName: (projectId: string) => string;
  onOpen: (install: AuthoringInstall) => void;
  onFeedback: () => void;
}) {
  const installs = project.installs.slice().reverse();
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2">
      <div className="flex items-center gap-2">
        <FlaskConicalIcon className="size-5 text-primary" aria-hidden />
        <h2 className="text-xl font-semibold">{text("trial.title")}</h2>
      </div>
      {installs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{text("trial.body")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {installs.map((install) => (
            <li key={`${install.projectId}:${install.packageRevision}`} className="flex items-center gap-3 rounded-xl border p-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{text("trial.installed", { project: projectName(install.projectId) })}</span>
                <span className="text-xs text-muted-foreground">
                  {text("draft.revision", { n: project.packages.find((p) => p.revision === install.packageRevision)?.draftRevision ?? install.packageRevision })}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={() => onOpen(install)}>
                {text("trial.openAgain")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="self-start" onClick={onFeedback}>
        <PencilLineIcon data-icon="inline-start" />
        {text("draft.feedback")}
      </Button>
    </section>
  );
}
