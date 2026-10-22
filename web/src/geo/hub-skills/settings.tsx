"use client";
import type { InstalledHubSkill } from "@/geo/contracts/hub-skills";
import { Button } from "@/components/ui/button";
import { text } from "./parts";

export function InstalledSkillState({ skill, onUpdate }: { skill: InstalledHubSkill; onUpdate?: () => void }) {
  const newer = skill.latestRevision !== null && skill.latestRevision > skill.revision;
  return <div className="mt-2 space-y-2 text-sm">
    <p className="tabular-nums text-gaid-ink-2">{text("installedRevision", { revision: skill.revision })}</p>
    {skill.edited && <p className="text-gaid-warning">{text("edited")}</p>}
    {skill.state === "suspended" && <p className="text-gaid-warning">{text("suspended")}</p>}
    {newer && <div className="flex flex-wrap items-center gap-3"><span className="tabular-nums">{text("newRevision", { revision: skill.latestRevision! })}</span>{onUpdate && <Button variant="outline" size="sm" onClick={onUpdate}>{text("update", { revision: skill.latestRevision! })}</Button>}</div>}
  </div>;
}
