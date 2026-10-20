import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SkillsPanel } from "@/components/skills-panel";
import { ReadinessNotice } from "@/geo/workspace/readiness";
import { onOpenSettings } from "@/lib/settings-nav";
import * as capabilities from "@/lib/capabilities";
import { requestSkillImport, takeSkillImport } from "./import-request";
vi.mock("@/lib/use-projects", () => ({ useProjects: () => ({ activeProject: { id: "p1", name: "研究" }, activeProjectId: "p1" }) }));
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.spyOn(capabilities, "getAllSkills").mockResolvedValue({ scope: "project", enabled: [], disabled: [], problems: [], shadowed: [] });
});
it("names the missing imported skill and prefills the existing acknowledgement gate without downloading", async () => {
  const opening = vi.fn(); const stop = onOpenSettings(opening);
  const preview = vi.spyOn(capabilities, "previewSkillSource");
  const view = render(<ReadinessNotice projectId="p1" onPrepared={vi.fn()} value={{ state: "missing-skills", skills: [{ id: "imported:sample", runtimeName: "sample", title: null, source: "imported", ref: "owner/repo#v2", installed: false, enabled: false }], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null }} />);
  expect(screen.getByText(/sample/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "GitHub 등에서 가져오기" }));
  expect(opening).toHaveBeenCalledWith({ tab: "skills", projectId: "p1" });
  view.unmount(); render(<SkillsPanel />);
  expect(await screen.findByDisplayValue("owner/repo#v2")).toBeInTheDocument();
  expect(preview).not.toHaveBeenCalled(); stop();
});
it("keeps import requests project-scoped", () => {
  requestSkillImport("other", "other/repo#v3");
  expect(takeSkillImport("p1")).toBeNull();
  expect(takeSkillImport("other")).toBe("other/repo#v3");
});
