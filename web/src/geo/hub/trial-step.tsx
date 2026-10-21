"use client";
/**
 * Trial step: where the draft is installed, the GAID trials of that method (from the project's trial records,
 * observed by GAID, never from model prose) and a way to revise the draft from a trial.
 */
import { PencilLineIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuthoringInstall, AuthoringProject } from "@/geo/contracts/authoring";
import type { MethodTrial, MethodTrialsResponse } from "@/geo/contracts/methods";
import { geoLocale, geoText } from "@/geo/i18n";
import { apiFetch } from "@/lib/projects";

import { InputPrep } from "./input-prep";

const text = geoText("hub");

async function loadTrials(install: AuthoringInstall, slug: string): Promise<MethodTrial[]> {
  const res = await apiFetch(`/geo/methods/trials?skill=${encodeURIComponent(slug)}`, {}, install.projectId);
  if (!res.ok) return [];
  return ((await res.json()) as MethodTrialsResponse).trials;
}

function shortList(paths: string[], max = 8): string {
  if (!paths.length) return "없음";
  const shown = paths.slice(0, max).join(", ");
  return paths.length > max ? `${shown} 외 ${paths.length - max}개` : shown;
}

/** Feedback text for `revise` from one trial: the researcher's note and what GAID observed. */
function when(iso: string): string {
  try {
    return new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** GAID trial chats of the method across the projects it is installed in (null while loading). */
export function useTrialCount(installs: AuthoringInstall[], slug: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!installs.length || !slug) return;
    let live = true;
    const latest = new Map(installs.map((i) => [i.projectId, i]));
    void Promise.all([...latest.values()].map((i) => loadTrials(i, slug))).then(
      (lists) => live && setCount(lists.reduce((n, l) => n + l.length, 0)),
    );
    return () => {
      live = false;
    };
  }, [installs, slug]);
  return installs.length ? count : 0;
}

export function trialFeedback(trial: MethodTrial): string {
  const lines = [
    `GAID 시험 (${when(trial.startedAt)})`,
    trial.assessment
      ? `연구자 평가: ${text(`trial.outcome.${trial.assessment.outcome}`)}. ${trial.assessment.note}`
      : "연구자 평가: 없음",
    `관찰: 도구 호출 ${trial.observed.toolCalls}회, 실패 ${trial.observed.failedToolCalls}회`,
    `결과 파일: ${shortList(trial.observed.outputs.map((o) => o.path))}`,
    ...trial.expected
      .filter((e) => e.required && !e.found.length && !e.foundElsewhere?.length)
      .map((e) => `예상했지만 없는 결과: ${e.files.join(", ") || e.id}`),
    ...trial.expected
      .filter((e) => e.foundElsewhere?.length)
      .map((e) => `예상한 위치(${e.files.join(", ")})가 아닌 곳에 저장된 결과: ${e.foundElsewhere!.join(", ")}`),
  ];
  return lines.join("\n");
}

export function TrialStep({
  project,
  projectName,
  onOpen,
  onFeedback,
  onDraft,
}: {
  onDraft: () => void;
  project: AuthoringProject;
  projectName: (projectId: string) => string;
  onOpen: (install: AuthoringInstall) => void;
  onFeedback: (prefill?: string) => void;
}) {
  const installs = project.installs.slice().reverse();
  const slug = project.drafts.at(-1)?.slug ?? "";
  const [trials, setTrials] = useState<Record<string, MethodTrial[]>>({});
  useEffect(() => {
    let live = true;
    const projects = [...new Set(installs.map((i) => i.projectId))];
    void Promise.all(
      projects.map(async (pid) => [pid, await loadTrials(installs.find((i) => i.projectId === pid)!, slug)] as const),
    ).then((rows) => live && setTrials(Object.fromEntries(rows)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.installs.length, slug]);

  const latestDraft = project.drafts.at(-1)?.revision ?? 0;
  const installedDraft = Math.max(
    0,
    ...installs.map((i) => project.packages.find((p) => p.revision === i.packageRevision)?.draftRevision ?? 0),
  );
  const latestByProject = new Map<string, AuthoringInstall>();
  for (const i of installs) if (!latestByProject.has(i.projectId)) latestByProject.set(i.projectId, i);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{text("trial.title")}</h2>
      </div>
      {latestDraft > installedDraft && installedDraft > 0 && (
        <div className="flex items-center gap-3 rounded-none border border-border bg-background p-3 text-sm">
          <span className="flex-1">{text("trial.newer", { n: latestDraft, installed: installedDraft })}</span>
          <Button size="sm" onClick={onDraft}>
            {text("trial.toDraft")}
          </Button>
        </div>
      )}
      {latestByProject.size === 0 ? (
        <p className="text-sm text-muted-foreground">{text("trial.body")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...latestByProject.values()].map((install) => {
            const list = trials[install.projectId] ?? [];
            return (
              <li key={install.projectId} className="flex flex-col gap-3 rounded-none border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">
                      {text("trial.installed", { project: projectName(install.projectId) })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {text("draft.revision", {
                        n:
                          project.packages.find((p) => p.revision === install.packageRevision)?.draftRevision ??
                          install.packageRevision,
                      })}
                    </span>
                  </span>
                  {list.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => onOpen(install)}>
                      {text("trial.openAgain")}
                    </Button>
                  )}
                </div>
                {list.length === 0 ? (
                  // No trial yet: the same input and environment preparation as the shared-method path.
                  <InputPrep
                    projectId={install.projectId}
                    projectName={projectName(install.projectId)}
                    methodKey={install.methodKey}
                    onOpenSetup={() => onOpen(install)}
                  />
                ) : (
                  <ul className="flex flex-col divide-y rounded-none border text-sm">
                    {list.slice(0, 3).map((trial) => (
                      <li key={trial.sessionId} className="flex items-center gap-3 p-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            {trial.assessment ? (
                              <Badge variant={trial.assessment.outcome === "useful" ? "default" : "secondary"}>
                                {text(`trial.outcome.${trial.assessment.outcome}`)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">{text("trial.unrated")}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{when(trial.startedAt)}</span>
                            <span className="text-xs text-muted-foreground">
                              {text("trial.observed", {
                                files: trial.observed.outputs.length,
                                failed: trial.observed.failedToolCalls,
                              })}
                            </span>
                          </span>
                          {trial.assessment?.note && (
                            <span className="line-clamp-2 text-muted-foreground">{trial.assessment.note}</span>
                          )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => onFeedback(trialFeedback(trial))}>
                          {text("trial.revise")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" className="self-start" onClick={() => onFeedback()}>
        <PencilLineIcon data-icon="inline-start" />
        {text("draft.feedback")}
      </Button>
    </section>
  );
}
