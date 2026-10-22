"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HubSkillDetail, ReviewBody } from "@/geo/contracts/hub-skills";
import { hubIdentity, hubUserName } from "@/geo/hub/shared-api";
import { NewProject } from "@/geo/hub/draft-step";
import { useNamedAction } from "@/geo/hub/shared-entry";
import { hubSkills } from "./api";
import { HubSkillInstall } from "./install";
import { Failure, FileList, Findings, Instructions, Licence, Origin, text, when } from "./parts";
import { selectClass } from "./shelf";

export function SkillDetail({ id, projects, onBack, onWorkflow, onCreateProject }: { id: string; projects: { id: string; name: string }[]; onBack: () => void; onWorkflow: (id: string) => void; onCreateProject?: (name: string) => Promise<{ id: string; name: string }> }) {
  const [detail, setDetail] = useState<HubSkillDetail | null>(null);
  const [revision, setRevision] = useState<number | undefined>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string }[]>([]);
  const availableProjects = [...projects, ...created.filter((p) => !projects.some((v) => v.id === p.id))];
  const [project, setProject] = useState("");
  const [review, setReview] = useState<ReviewBody["state"]>("checked");
  const [note, setNote] = useState("");
  const [replacement, setReplacement] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const named = useNamedAction();
  useEffect(() => {
    let alive = true;
    void hubSkills.detail(id, revision).then((value) => { if (alive) setDetail(value); }).catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [id, revision, refresh]);
  function mutate(action: () => Promise<unknown>, done?: () => void) {
    named.run(() => {
      setBusy(true); setError(null); setNotice(null);
      void action().then(() => { done?.(); setRefresh((n) => n + 1); }).catch((e) => setError(String(e))).finally(() => setBusy(false));
    });
  }
  const skill = detail?.skill;
  const shown = skill?.revisions.find((r) => r.revision === detail?.revision);
  // Only the author registers revisions; older views without `mine` fall back to the display name.
  const own = skill?.mine ?? shown?.registeredBy === hubUserName();
  const reviewState = own && review === "checked" ? "deprecated" : review;
  return <section className="flex min-h-0 flex-1 flex-col text-gaid-ink">
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gaid-edge bg-gaid-chrome px-6 py-4"><div className="min-w-0"><Button variant="ghost" size="sm" onClick={onBack}>{text("back")}</Button><h1 className="truncate text-2xl font-bold">{skill?.name ?? text("title")}</h1></div>{shown && <Button variant={installing ? "outline" : "default"} disabled={busy || shown.reviews.at(-1)?.state === "suspended"} onClick={() => named.run(() => setInstalling(!installing))}>{text("install")}</Button>}</header>
    <div className="min-h-0 flex-1 space-y-8 overflow-auto bg-gaid-face p-6">
      {error && <Failure error={error} retry={() => { setError(null); setRefresh((n) => n + 1); }} />}
      {!detail && !error && <div role="status" className="h-32 animate-pulse rounded bg-gaid-face-2 p-4">{text("loading")}</div>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {detail && shown && skill && <>
        <div className="flex flex-wrap items-center gap-4 text-sm"><span className="tabular-nums">{text("revision", { revision: shown.revision })}</span><span className="rounded bg-gaid-face-2 px-2 py-1">{text(`state.${shown.reviews.at(-1)?.state ?? "unreviewed"}`)}</span><Button variant="outline" disabled={busy} aria-label={text("starAction")} aria-pressed={skill.starredByMe} onClick={() => mutate(() => hubSkills.star(id, !skill.starredByMe))}>{text("star", { count: skill.stars })}</Button></div>
        <p className="max-w-[680px] text-sm text-gaid-ink-2">{shown.description}</p>
        {shown.reviews.at(-1)?.state === "suspended" && <p className="text-sm text-gaid-warning">{text("suspended")}</p>}
        {installing ? <section className="max-w-[680px] space-y-4"><label className="block space-y-2 text-sm"><span>{text("project")}</span><select className={`${selectClass} block w-full`} value={project} onChange={(e) => setProject(e.target.value)}><option value="">{text("chooseProject")}</option>{availableProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{onCreateProject && <NewProject onCreate={async (name) => { const p = await onCreateProject(name); setCreated((v) => [...v, p]); setProject(p.id); }} />}{project && <HubSkillInstall skillId={id} revision={shown.revision} projectId={project} />}</section> : <section className="space-y-4"><h2 className="text-lg font-semibold">{text("instructions")}</h2><Instructions content={detail.content} /><FileList key={shown.revision} files={detail.files} load={(path) => hubSkills.file(id, shown.revision, path)} /></section>}
        <details><summary className="cursor-pointer text-lg font-semibold">{text("sourceTitle")}</summary><div className="mt-4 max-w-[680px] space-y-4"><Origin origin={shown.origin} /><Licence licence={shown.licence} /></div></details>
        <Findings findings={shown.findings} />
        <details><summary className="cursor-pointer text-lg font-semibold">{text("history")}</summary><div className="mt-4 space-y-5">{[...skill.revisions].reverse().map((r) => <section key={r.revision} className="space-y-2 border-b border-gaid-edge pb-4"><Button variant="outline" aria-pressed={r.revision === shown.revision} onClick={() => { setDetail(null); setRevision(r.revision); setInstalling(false); setNote(""); setNotice(null); }}>{text("revision", { revision: r.revision })}</Button><p className="text-xs text-gaid-ink-2">{r.registeredBy} · {when(r.registeredAt)}</p><p className="text-sm">{r.note}</p><p className="text-sm">{text(`state.${r.reviews.at(-1)?.state ?? "unreviewed"}`)}</p>{r.reviews.map((mark, n) => <div key={n} className="space-y-1 text-sm"><p>{text(`state.${mark.state}`)} · {mark.by}</p><p className="text-xs text-gaid-ink-2">{mark.verified ? when(mark.at) : `${text("unverified")} · ${when(mark.at)}`}</p><p>{mark.note}</p>{mark.replacement && <p>{text("replacement")}: {mark.replacement}</p>}</div>)}</section>)}</div></details>
        <details><summary className="cursor-pointer text-lg font-semibold">{text("review")}</summary><form className="mt-4 max-w-[680px] space-y-4" onSubmit={(e) => { e.preventDefault(); mutate(() => hubSkills.review(id, shown.revision, { state: reviewState, note: note.trim(), ...(reviewState === "deprecated" && replacement.trim() ? { replacement: replacement.trim() } : {}) }), () => { setNote(""); setNotice(text("reviewSaved")); }); }}>
          <select className={selectClass} aria-label={text("review")} value={reviewState} onChange={(e) => setReview(e.target.value as ReviewBody["state"])}>{(["checked", "deprecated", "suspended"] as const).filter((s) => !own || s !== "checked").map((s) => <option key={s} value={s}>{text(`state.${s}`)}</option>)}</select>
          <label className="block space-y-2 text-sm"><span>{text("note")}</span><Textarea required maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {reviewState === "deprecated" && <label className="block space-y-2 text-sm"><span>{text("replacement")}</span><Input value={replacement} onChange={(e) => setReplacement(e.target.value)} /></label>}
          {!hubIdentity()?.account && <p className="text-xs text-gaid-ink-2">{text("unverified")}</p>}<Button variant="outline" disabled={busy || !note.trim()}>{text("saveReview")}</Button>
        </form></details>
        <details><summary className="cursor-pointer text-lg font-semibold">{text("usedBy")}</summary><ul className="mt-3 space-y-2">{skill.usedBy.length ? skill.usedBy.map((w) => <li key={`${w.entryId}:${w.revision}`}><a href={`#hub/e/${encodeURIComponent(w.entryId)}`} onClick={(e) => { e.preventDefault(); onWorkflow(w.entryId); }} className="text-sm underline underline-offset-4">{w.title} · {text("revision", { revision: w.revision })}</a></li>) : <li className="text-sm text-gaid-ink-2">{text("unused")}</li>}</ul></details>
        <section className="max-w-[680px] space-y-4"><h2 className="text-lg font-semibold">{text("comments")}</h2>{detail.comments.length ? detail.comments.map((c) => <article key={c.id} className="space-y-2 border-b border-gaid-edge pb-4"><p className="text-xs text-gaid-ink-2">{c.author} · {when(c.at)}</p><p className="text-xs tabular-nums text-gaid-ink-2">{text("revision", { revision: c.revision })}</p><p className="whitespace-pre-wrap text-sm">{c.body}</p></article>) : <p className="text-sm text-gaid-ink-2">{text("noComments")}</p>}<form className="space-y-3" onSubmit={(e) => { e.preventDefault(); mutate(() => hubSkills.comment(id, comment.trim()), () => setComment("")); }}><Textarea aria-label={text("comment")} maxLength={4000} required value={comment} onChange={(e) => setComment(e.target.value)} /><Button variant="outline" disabled={busy || !comment.trim()}>{text("postComment")}</Button></form></section>
      </>}
    </div>{named.dialog}
  </section>;
}
