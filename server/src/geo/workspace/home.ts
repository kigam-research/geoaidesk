/** Read-only cross-project Workspace home. No provisioning, hub fetch, interpreter probe or session cold-open. */
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_ROOT } from "../../config.ts";
import { resolvePaths, type ProjectMeta, type ProjectPaths } from "../../projects.ts";
import { runBroker } from "../../agent/run-broker.ts";
import { schedulerSessionId } from "../../agent/scheduler-state.ts";
import { geoCatalogueActive, loadGeoCatalogue, type GeoCatalogue } from "../catalogue.ts";
import { readSessionExposure } from "../context.ts";
import { geoEnvironmentService, type GeoEnvironmentService } from "../environments.ts";
import { installedMethods, listLocalMethods, parseMethodExposure } from "../methods/local-methods.ts";
import { pinnedHubSkills } from "../methods/hub-pin-install.ts";
import { localHubSkillStore, remoteSkillRecord } from "../hub-skills/active.ts";
import { revisionState, type StoredHubSkill } from "../hub-skills/records.ts";
import { listResearchNotes } from "../notes/store.ts";
import { entries, homeSessions } from "./home-sessions.ts";
import { listWorkflows } from "./workflows.ts";
import type { GeoWorkflowSummary, Localized } from "../../../../web/src/geo/contracts/workspace.ts";
import type { LocalMethodSummary } from "../../../../web/src/geo/contracts/methods.ts";
import {
  WORKSPACE_HOME_SCHEMA, WORKSPACE_HOME_RECENT_LIMIT,
  type WorkspaceHomeResponse, type WorkspaceHomeRecent, type WorkspaceHomeWorkflow, type WorkspaceHomeWorkflowRef,
} from "../../../../web/src/geo/contracts/workspace-home.ts";

export interface WorkspaceHomeOptions {
  catalogue?: () => GeoCatalogue | null;
  environments?: Pick<GeoEnvironmentService, "cachedReadiness">;
}
const projectId = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const label = (v: Localized | null | undefined): string => v?.ko ?? v?.en ?? "";
const line = (v: Localized | null | undefined): string => label(v).replace(/\s+/g, " ").trim();
const time = (v: string): number => Date.parse(v) || 0;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === "ENOENT";

/** listProjects() adopts orphan folders by writing index.json; the home only adopts them in memory. */
function activeProjects(): ProjectMeta[] {
  const projects = new Map<string, ProjectMeta>();
  const add = (raw: ProjectMeta) => {
    if (raw && typeof raw.id === "string" && projectId.test(raw.id) && typeof raw.name === "string") projects.set(raw.id, raw);
  };
  try {
    const index = JSON.parse(fs.readFileSync(path.join(PROJECTS_ROOT, "index.json"), "utf8"));
    for (const raw of Object.values(index.projects ?? {})) add(raw as ProjectMeta);
  } catch (error) { if (!missing(error)) throw error; }
  for (const dir of entries(PROJECTS_ROOT)) {
    if (!dir.isDirectory() || !projectId.test(dir.name) || projects.has(dir.name)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PROJECTS_ROOT, dir.name, "project.json"), "utf8"));
      if (raw.id === dir.name) add(raw);
    } catch { /* Unregistered, invalid directories are not projects. */ }
  }
  return [...projects.values()].filter(p => !p.archived).sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || a.id.localeCompare(b.id));
}

function catalogueOf(): GeoCatalogue | null {
  if (!geoCatalogueActive()) return null;
  try { return loadGeoCatalogue({ readOnly: true }); } catch { return null; }
}

/** Bounded names-only inventory for required input availability. Hidden/internal trees and links are never visited. */
function inputExtensions(paths: ProjectPaths): Set<string> {
  const extensions = new Set<string>();
  let visited = 0;
  const walk = (dir: string, depth: number): void => {
    if (depth > 6 || visited >= 3000) return;
    for (const entry of entries(dir)) {
      if (++visited > 3000) return;
      if (entry.name.startsWith(".") || ["node_modules", "secrets", "secure", "__pycache__"].includes(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, depth + 1);
      else if (entry.isFile()) extensions.add(path.extname(entry.name).slice(1).toLowerCase());
    }
  };
  walk(paths.sandbox, 0);
  return extensions;
}

function ready(workflow: GeoWorkflowSummary, files: Set<string>): boolean {
  return workflow.readiness.state === "ready" && workflow.inputRoles.every(role => !role.required
    || role.example?.state === "present" || role.extensions.some(ext => files.has(ext)));
}

interface Group {
  value: WorkspaceHomeWorkflow;
  at: number;
  projectTimes: Map<string, number>;
}

export async function workspaceHome(options: WorkspaceHomeOptions = {}): Promise<WorkspaceHomeResponse> {
  const projects = activeProjects();
  const catalogue = (options.catalogue ?? catalogueOf)();
  const environments = options.environments ?? geoEnvironmentService();
  // listLocalMethods/listWorkflows retain their existing readiness semantics, but the home never triggers a probe.
  const service: Pick<GeoEnvironmentService, "readiness"> = {
    readiness: async (data, id, target, sandbox) => {
      const cached = environments.cachedReadiness(data, id, target, sandbox);
      if (!cached) throw new Error("Environment has not been probed");
      return cached;
    },
  };
  const recent: WorkspaceHomeRecent[] = [];
  const groups = new Map<string, Group>();
  const skillRecords = new Map<string, StoredHubSkill | null>();
  let unreadableProjects = 0;
  for (const project of projects) {
    try {
      const paths = resolvePaths(project.id);
      if (!fs.statSync(paths.sandbox).isDirectory()) throw new Error("Project sandbox is not a directory");
      const files = inputExtensions(paths);
      const pins = installedMethods(paths).flatMap(method => pinnedHubSkills(method.file.method));
      for (const pin of pins) {
        if (skillRecords.has(pin.skillId)) continue;
        // Reuse the last remote record, or read the local shelf. Home never downloads a hub archive.
        const remote = remoteSkillRecord(pin.skillId);
        const record = remote === undefined ? await localHubSkillStore().find(pin.skillId).catch(() => null) : remote;
        skillRecords.set(pin.skillId, record);
      }
      const methods = await listLocalMethods(paths, catalogue, service, { hubSuspended: (id, revision) => {
        const record = skillRecords.get(id)?.revisions.find(r => r.revision === revision);
        const pin = pins.find(p => p.skillId === id && p.revision === revision);
        return !record || revisionState(record) === "suspended" || record.treeHash !== pin?.treeHash;
      } });
      // Project methods shadow global ones, just as the Workflow panel and Pi do.
      const unique = new Map<string, LocalMethodSummary>();
      for (const method of methods) if (!unique.has(method.runtimeName)) unique.set(method.runtimeName, method);
      const hidden = schedulerSessionId(paths);
      const sessions = (await homeSessions(paths)).filter(s => s.id !== hidden);
      const running = new Set(runBroker.activeForProject(project.id).map(run => run.sessionId));
      const used = new Map<string, number>();
      const refs = new Map<string, WorkspaceHomeWorkflowRef | null>();
      const resolveWorkflow = (sessionId: string): WorkspaceHomeWorkflowRef | null => {
        if (refs.has(sessionId)) return refs.get(sessionId)!;
        const exposure = readSessionExposure(paths, sessionId);
        const methodRef = exposure ? parseMethodExposure(exposure.mode) : null;
        let ref: WorkspaceHomeWorkflowRef | null = null;
        if (methodRef) {
          const method = unique.get(methodRef.runtimeName);
          const workflow = method?.workflows.find(w => w.id === methodRef.workflowId);
          if (method && workflow) ref = { id: method.runtimeName, title: label(workflow.title), version: method.hubVersion };
        } else if (exposure?.mode.startsWith("workflow:")) {
          const workflow = catalogue?.workflows.find(w => w.id === exposure.mode.slice("workflow:".length));
          if (workflow) ref = { id: workflow.id, title: label(workflow.title), version: null };
        }
        refs.set(sessionId, ref);
        return ref;
      };
      const projectRecent: WorkspaceHomeRecent[] = sessions.map(session => {
        const workflow = resolveWorkflow(session.id);
        const exposure = readSessionExposure(paths, session.id);
        const key = workflow ? `${exposure?.mode.startsWith("method:") ? "method" : "catalogue"}:${workflow.id}` : null;
        if (key) used.set(key, Math.max(used.get(key) ?? 0, time(session.updatedAt)));
        return {
          kind: "chat", projectId: project.id, projectName: project.name, id: session.id, title: session.title, workflow,
          state: running.has(session.id) ? "running" : "idle", decisions: 0, updatedAt: session.updatedAt,
        };
      });
      for (const note of listResearchNotes(paths).notes) {
        if (note.status === "superseded") continue;
        const decisions = note.status === "pending" ? note.decisions.length : 0;
        let workflow = [...note.sessions].reverse().map(resolveWorkflow).find(ref => ref !== null) ?? null;
        // Older notes can retain a pinned method-trial link even when their exposure record is no longer present.
        if (!workflow && note.method) {
          const method = [...unique.values()].find(m => m.methodId === note.method!.methodId);
          const flow = method?.workflows.find(w => w.id === note.method!.workflowId);
          if (method && flow) workflow = { id: method.runtimeName, title: label(flow.title), version: method.hubVersion };
        }
        projectRecent.push({
          kind: "note", projectId: project.id, projectName: project.name, id: note.id, title: note.title, workflow,
          state: decisions > 0 ? "decisions" : note.status === "confirmed" ? "checked" : "unreviewed",
          decisions, updatedAt: note.updatedAt,
        });
      }
      const catalogueIds = [...used.keys()].filter(key => key.startsWith("catalogue:")).map(key => key.slice("catalogue:".length));
      const catalogueWorkflows = catalogue && catalogueIds.length
        ? await listWorkflows(paths, { ...catalogue, workflows: catalogue.workflows.filter(w => catalogueIds.includes(w.id)) }, service) : [];
      // Commit this project's contribution only after all of its stores were successfully read.
      const add = (key: string, value: Omit<WorkspaceHomeWorkflow, "projects">, at: number) => {
        const group = groups.get(key);
        const projectTime = at || time(project.updatedAt);
        if (!group) groups.set(key, { value: { ...value, projects: [{ id: project.id, name: project.name }] }, at, projectTimes: new Map([[project.id, projectTime]]) });
        else {
          // A grouped slug can have different installed versions. The newest-used project's version represents it.
          if (at > group.at) { group.value = { ...value, ready: group.value.ready || value.ready, projects: group.value.projects }; group.at = at; }
          else group.value.ready ||= value.ready;
          group.value.projects.push({ id: project.id, name: project.name });
          group.projectTimes.set(project.id, projectTime);
        }
      };
      for (const method of unique.values()) {
        if (!method.workflows.length) continue;
        const at = used.get(`method:${method.runtimeName}`) ?? 0;
        add(`method:${method.runtimeName}`, {
          id: method.runtimeName, title: label(method.title), line: line(method.summary) || line(method.workflows[0].description),
          source: method.origin.hubEntry ? "shared" : "draft", version: method.hubVersion,
          ready: method.enabled && method.workflows.some(w => ready(w, files)),
        }, at);
      }
      // Only actually used catalogue Workflows are represented; no all-catalogue probes.
      for (const workflow of catalogueWorkflows) {
        add(`catalogue:${workflow.id}`, { id: workflow.id, title: label(workflow.title), line: line(workflow.description), source: "catalogue", version: null, ready: ready(workflow, files) }, used.get(`catalogue:${workflow.id}`)!);
      }
      recent.push(...projectRecent);
    } catch {
      unreadableProjects++;
    }
  }
  const workflows = [...groups.values()].sort((a, b) => Number(a.value.source === "catalogue") - Number(b.value.source === "catalogue") || b.at - a.at || a.value.id.localeCompare(b.value.id)).map(group => {
    group.value.projects.sort((a, b) => group.projectTimes.get(b.id)! - group.projectTimes.get(a.id)! || a.id.localeCompare(b.id));
    return group.value;
  });
  recent.sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || a.projectId.localeCompare(b.projectId) || a.id.localeCompare(b.id));
  return { schemaVersion: WORKSPACE_HOME_SCHEMA, recent: recent.slice(0, WORKSPACE_HOME_RECENT_LIMIT), workflows, projectCount: projects.length, unreadableProjects };
}
