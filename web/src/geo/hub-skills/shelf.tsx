"use client";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HubSkill } from "@/geo/contracts/hub-skills";
import type { HubFolder } from "@/geo/contracts/hub-shared";
import { PageBody, PageHeader } from "@/geo/shell/page-header";
import { hubSkills } from "./api";
import { Failure, text } from "./parts";

export const selectClass = "h-9 max-w-full rounded-md border border-gaid-control-edge bg-gaid-face px-3 text-sm text-gaid-ink focus-visible:outline-2 focus-visible:outline-ring";
export function SkillShelf({ folders = [], onOpen, onRegister }: { folders?: HubFolder[]; onOpen: (id: string) => void; onRegister?: () => void }) {
  const [skills, setSkills] = useState<HubSkill[]>([]);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => void hubSkills.list(query, folder).then((value) => { if (alive) setSkills(value.skills); }).catch((e) => { if (alive) setError(String(e)); }).finally(() => { if (alive) setLoading(false); }), 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, folder, retry]);
  const ordered = [...skills].sort((a, b) => sort === "popular" ? b.stars - a.stars : b.updatedAt.localeCompare(a.updatedAt));
  const filtered = folder !== "all" || !!query.trim();
  return <PageBody className="gap-5">
    <PageHeader title={text("title")} context={text("context")} actions={onRegister && <Button onClick={onRegister}>{text("register")}</Button>} />
      <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-48 flex-1"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden /><Input type="search" data-gaid-search aria-label={text("search")} placeholder={text("search")} value={query} onChange={(e) => { setLoading(true); setError(null); setQuery(e.target.value); }} className="pl-9" /></div><select className={selectClass} aria-label={text("folder")} value={folder} onChange={(e) => { setLoading(true); setError(null); setFolder(e.target.value); }}><option value="all">{text("allFolders")}</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select><select className={selectClass} aria-label={text("sort")} value={sort} onChange={(e) => setSort(e.target.value)}>{["recent", "popular"].map((s) => <option key={s} value={s}>{text(s)}</option>)}</select></div>
      {error ? <Failure error={error} retry={() => { setLoading(true); setError(null); setRetry((n) => n + 1); }} /> : loading ? <div role="status" className="space-y-3"><p className="text-sm text-gaid-ink-2">{text("loading")}</p>{[0, 1, 2].map((n) => <div key={n} className="h-14 animate-pulse rounded bg-gaid-face-2" />)}</div> : <><p className="text-xs tabular-nums text-gaid-ink-2" role="status">{text("count", { count: skills.length })}</p>{!skills.length ? <p className="text-sm text-gaid-ink-2">{text(filtered ? "empty" : "emptyAll")}</p> : <ul className="divide-y divide-gaid-edge">{ordered.map((s) => <li key={s.id}><button type="button" onClick={() => onOpen(s.id)} className="flex min-h-14 w-full items-center gap-4 rounded px-3 py-2 text-left hover:bg-gaid-hover focus-visible:outline-2 focus-visible:outline-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block truncate text-xs text-gaid-ink-2">{s.description}</span></span><span className="shrink-0 text-xs tabular-nums text-gaid-ink-2">{text("revision", { revision: s.latestRevision })}</span><span className="shrink-0 rounded bg-gaid-face-2 px-2 py-1 text-xs">{text(`state.${s.state}`)}</span></button></li>)}</ul>}</>}
  </PageBody>;
}
