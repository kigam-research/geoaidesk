/**
 * Editing a registered hub method (gaid-hub-editing). The latest revision stays with the researcher who registered the
 * method (the same hub server account, or the same display name in the local store): they edit in place (next revision),
 * anyone else edits a copy that is registered as a separate entry naming its original. Opening never changes the entry's
 * registered revisions.
 */
import { hubVersionOf } from "../../../../web/src/geo/contracts/hub-version.ts";
import { cp } from "node:fs/promises";
import { extname } from "node:path";
import type { AuthoringProject, HubEntryLink, MethodDraft } from "../../../../web/src/geo/contracts/authoring.ts";
import type { EditEntryResult } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { structuredDraft } from "../authoring/workflow.ts";
import { addSource } from "../authoring/sources.ts";
import { restoreExampleBytes } from "../authoring/examples.ts";
import { readTarGz } from "../tar.ts";
import { AuthoringError, now, type AuthoringStore } from "../authoring/store.ts";
import type { StoredEntry } from "./store.ts";
import { isEntryAuthor, type Actor, type HubRecordStore } from "./records.ts";

const readable = async (authoring: AuthoringStore, id: string) => authoring.read(id).catch(() => null);

export async function openEntryForEdit(
  store: HubRecordStore,
  authoring: AuthoringStore,
  entryId: string,
  actor: Actor,
): Promise<EditEntryResult> {
  return store.serial(entryId, async () => {
    const record = await store.read(entryId);
    const mode = isEntryAuthor(record.entry, actor) ? "edit" : "copy";
    const link: HubEntryLink = {
      entryId,
      revision: record.entry.latestRevision,
      ...(hubVersionOf(record.entry) ? { version: hubVersionOf(record.entry)! } : {}),
      mode,
      title: record.entry.title,
      author: record.entry.author,
    };
    const linked = await readable(authoring, record.authoringProjectId);
    if (mode === "edit" && linked) return { authoringProjectId: linked.id, mode, created: false };
    if (mode === "copy") {
      // A repeated "복사해서 고치기" reopens the researcher's own copy instead of making another.
      for (const summary of await authoring.list())
        if (summary.hubEntry?.entryId === entryId && summary.hubEntry.mode === "copy" && summary.author === actor.name)
          return { authoringProjectId: summary.id, mode, created: false };
    }
    const created = await seedFromEntry(store, authoring, record, linked, actor.name, link);
    if (mode === "edit") {
      // The seeded draft is now the entry's linked draft: a second "방법 고치기" reopens it.
      record.authoringProjectId = created.id;
      await store.write(record, actor);
    }
    return { authoringProjectId: created.id, mode, created: true };
  });
}

/**
 * A new draft whose first revision is the registered snapshot. Sources, findings, questions and current decisions come
 * along when the original draft is on this server, so its questions can be answered again; otherwise the registered
 * package becomes the code source the snapshot's code files point to.
 */
async function seedFromEntry(
  store: HubRecordStore,
  authoring: AuthoringStore,
  record: StoredEntry,
  original: AuthoringProject | null,
  user: string,
  link: HubEntryLink,
): Promise<AuthoringProject> {
  const revision = record.entry.latestRevision;
  const snapshot = record.snapshots[revision];
  if (!snapshot) throw new AuthoringError("등록한 version을 찾을 수 없습니다.", 404);
  const project = await authoring.create({
    author: user,
    title: record.entry.title,
    ...(original?.goal ? { goal: original.goal } : {}),
    target: snapshot.draft.workflow ? "workflow" : "skill",
  });
  let draft: MethodDraft = structuredDraft(snapshot.draft);
  // A copy is another method: it needs its own name (method id), an edit keeps the entry's.
  if (link.mode === "copy") draft = renamed(draft, await freeSlug(store, authoring, draft.slug));
  if (original) {
    if (original.sources.length)
      await cp(authoring.within(original.id, "sources"), authoring.within(project.id, "sources"), {
        recursive: true,
        errorOnExist: false,
      });
    if (authoring.exists(original.id, "examples"))
      await cp(authoring.within(original.id, "examples"), authoring.within(project.id, "examples"), {
        recursive: true,
        errorOnExist: false,
      });
  } else if (draft.codeFiles.length) {
    const archive = await store.bytes(record.entry.id, `packages/${revision}.tar.gz`);
    const { source, extraction } = await addSource(authoring, project.id, {
      name: `${snapshot.package.slug}-hub-${revision}.tar.gz`,
      mediaType: "application/gzip",
      kind: "code",
      contentBase64: archive.toString("base64"),
    });
    // The unpacker drops a single top-level folder (`<slug>/`); match either layout.
    const listed = new Set((extraction.files ?? []).map((f) => f.path));
    draft.codeFiles = draft.codeFiles.map((f) => ({
      path: f.path,
      sourceId: source.id,
      sourcePath: listed.has(f.path) ? f.path : `${snapshot.package.slug}/${f.path}`,
    }));
  }
  // Bundled example data travels in the package; the next package of this draft needs the bytes again.
  await restoreExampleBytes(
    authoring,
    { ...project, ...(original ? { extractions: original.extractions } : {}) },
    draft,
    async () => {
      const prefix = `${snapshot.package.slug}/`;
      const archive = await store.bytes(record.entry.id, `packages/${revision}.tar.gz`);
      return new Map(
        readTarGz(archive)
          .filter((e) => e.type === "file" && e.path.startsWith(prefix))
          .map((e) => [e.path.slice(prefix.length), e.data]),
      );
    },
  );
  const visuals: NonNullable<AuthoringProject["visuals"]> = {};
  let index = 0;
  for (const [key, visual] of Object.entries(snapshot.visuals)) {
    const n = index++;
    const file = `visuals/hub-${revision}/${n}${extname(visual.file).toLowerCase()}`;
    await authoring.writeFile(project.id, file, await store.bytes(record.entry.id, visual.file));
    let dark: string | undefined;
    if (visual.dark) {
      dark = `visuals/hub-${revision}/${n}-dark${extname(visual.dark.file).toLowerCase()}`;
      await authoring.writeFile(project.id, dark, await store.bytes(record.entry.id, visual.dark.file));
    }
    Object.defineProperty(visuals, key, {
      value: { file, ...(dark ? { dark } : {}), caption: visual.caption, model: "gaid-hub", draftRevision: 1 },
      enumerable: true,
    });
  }
  return authoring.mutate(project.id, (p) => {
    if (original) {
      p.sources = [...structuredClone(original.sources), ...p.sources];
      p.extractions = { ...structuredClone(original.extractions), ...p.extractions };
      p.findings = structuredClone(original.findings);
      p.questions = structuredClone(original.questions.filter((q) => q.status !== "superseded"));
      p.decisions = structuredClone(original.decisions.filter((d) => !d.supersededBy));
      p.sourceRevision = Math.max(p.sourceRevision, original.sourceRevision);
    }
    const decisionIds = new Set(p.decisions.map((d) => d.id));
    draft = {
      ...draft,
      revision: 1,
      baseRevision: 0,
      origin: "researcher",
      createdAt: now(),
      decisionIds: draft.decisionIds.filter((id) => decisionIds.has(id)),
    };
    delete draft.attemptId;
    p.title = record.entry.title;
    p.drafts = [draft];
    p.visuals = visuals;
    p.hubEntry = link;
    return structuredClone(p);
  });
}

/** `<slug>-copy`, `<slug>-copy-2`, … not used by any draft, package or registered method on this server. */
async function freeSlug(store: HubRecordStore, authoring: AuthoringStore, slug: string): Promise<string> {
  const used = new Set<string>();
  for (const id of await authoring.ids()) {
    const p = await authoring.read(id);
    for (const d of p.drafts) used.add(d.slug);
    for (const pk of p.packages) used.add(pk.slug);
  }
  for (const r of await store.list()) used.add(r.entry.slug);
  const base = slug.slice(0, 40).replace(/-+$/, "");
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${base}-copy` : `${base}-copy-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** The draft under another slug: the skill name and the Workflow's own references to it. */
function renamed(draft: MethodDraft, slug: string): MethodDraft {
  const from = `local:${draft.slug}`;
  const to = `local:${slug}`;
  const out = structuredClone(draft);
  if (out.workflow) {
    if (out.workflow.id === draft.slug) out.workflow.id = slug;
    for (const skill of out.workflow.skills ?? []) if (skill.name === draft.slug && skill.source === "bundled") skill.name = slug;
    for (const step of out.workflow.steps ?? []) if (step.skill === draft.slug) step.skill = slug;
    out.workflow.skillIds = out.workflow.skillIds.map((id) => (id === from ? to : id));
    for (const a of out.workflow.expectedArtifacts ?? []) if (a.skill === from) a.skill = to;
  }
  out.slug = slug;
  return out;
}
