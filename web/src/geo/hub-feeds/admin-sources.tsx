"use client";
/**
 * Settings → 기관 GAID 허브 → 허브 서버 관리 → 자료 소식 출처 (administrators only). Shipped proposals stay `proposed`
 * until approved here or by the server CLI; only approved sources are collected (user decision 2026-10-22).
 */
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  FEED_CATEGORIES,
  FEED_FIELDS,
  FEED_LIMITS,
  FEED_SOURCE_KINDS,
  type FeedCategory,
  type FeedField,
  type FeedFetchResponse,
  type FeedSource,
  type FeedSourceAddBody,
  type FeedSourceKind,
} from "@/geo/contracts/hub-feeds";
import { Field, fieldClass } from "@/geo/hub-server/parts";
import { cn } from "@/lib/utils";

import { hubFeeds } from "./api";
import { FeedFailure, feedDate, text } from "./feeds";

export function FeedSourcesAdmin() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [busy, setBusy] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FeedFetchResponse | null>(null);
  const load = useCallback(async () => setSources((await hubFeeds.sources()).sources), []);
  useEffect(() => {
    let live = true;
    load().catch((e) => live && setError(String(e instanceof Error ? e.message : e))).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [load]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const proposed = sources.filter((s) => s.state === "proposed");
  const collect = () => run(async () => {
    setFetching(true); setResult(null);
    try { setResult(await hubFeeds.fetch()); } finally { setFetching(false); }
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[680px] text-[13px] text-gaid-ink-2">{text("admin.intro", { hours: FEED_LIMITS.intervalHours })}</p>
      <div className="flex flex-wrap gap-2">
        {proposed.length > 0 && (
          <Button type="button" disabled={busy} onClick={() => void run(async () => { for (const s of proposed) await hubFeeds.decide(s.id, { state: "approved" }); })}>
            {text("admin.approveProposed.button")}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={busy || !sources.some((s) => s.state === "approved")} onClick={() => void collect()}>
          {text("admin.fetch.button")}
        </Button>
      </div>
      {fetching && <p role="status" className="text-[13px] text-gaid-ink-2">{text("admin.fetching")}</p>}
      {result && !fetching && (
        <p role="status" className="text-[13px] text-gaid-ink-2">
          {text("admin.fetched", { count: result.results.length, failed: result.results.filter((r) => !r.ok).length })}
        </p>
      )}
      {error && <FeedFailure error={error} />}
      <ul className="divide-y divide-gaid-edge">
        {sources.map((s) => <SourceRow key={s.id} source={s} busy={busy} run={run} />)}
        {!busy && !sources.length && <li className="py-3 text-[13px] text-gaid-ink-2">{text("admin.empty")}</li>}
      </ul>
      <AddSource busy={busy} onAdd={(body) => run(() => hubFeeds.add(body))} />
    </div>
  );
}

function SourceRow({ source: s, busy, run }: { source: FeedSource; busy: boolean; run: (action: () => Promise<unknown>) => Promise<void> }) {
  const where = s.kind === "feed" ? s.url : s.kind === "github-releases" ? s.repo : s.queries?.join(", ");
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{s.title}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs",
              s.state === "approved" ? "bg-gaid-success-tint text-gaid-success" : s.state === "stopped" ? "bg-gaid-face-2 text-gaid-ink-2" : "bg-gaid-warning-tint text-gaid-warning",
            )}
          >
            {text(`admin.state.${s.state}`)}
          </span>
          <span className="text-[13px] text-gaid-ink-2">{text(`category.${s.category}`)} · {text(`field.${s.field}`)}</span>
        </p>
        <p className="break-all text-[13px] text-gaid-ink-2">{s.publisher} <span className="font-mono">{where}</span></p>
        <p className={cn("text-[13px] tabular-nums", s.lastFetch && !s.lastFetch.ok ? "text-gaid-warning" : "text-gaid-ink-2")}>
          {!s.lastFetch
            ? text("admin.never")
            : s.lastFetch.ok
              ? text("admin.lastOk", { when: feedDate(s.lastFetch.at, true), count: s.lastFetch.items })
              : text("admin.lastFailed", { when: feedDate(s.lastFetch.at, true) })}
          {s.lastFetch?.error ? ` ${s.lastFetch.error}` : ""}
        </p>
        {s.decidedBy && s.decidedAt && <p className="text-[13px] text-gaid-ink-2">{text("admin.decided", { name: s.decidedBy, when: feedDate(s.decidedAt, true) })}</p>}
        <details className="text-[13px]">
          <summary className="cursor-pointer text-gaid-ink-2">{text("admin.reason")}</summary>
          <p className="mt-1 max-w-[680px]">{s.reason}</p>
        </details>
      </div>
      <div className="flex flex-wrap gap-2">
        {s.state !== "approved" && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => hubFeeds.decide(s.id, { state: "approved" }))}>
            {text("admin.approve.button")}
          </Button>
        )}
        {s.state === "approved" && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => hubFeeds.decide(s.id, { state: "stopped" }))}>
            {text("admin.stop.button")}
          </Button>
        )}
        {!s.builtIn && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(() => hubFeeds.remove(s.id))}>
            {text("admin.delete.button")}
          </Button>
        )}
      </div>
    </li>
  );
}

const words = (value: string, split: RegExp) => value.split(split).map((w) => w.trim()).filter(Boolean);

function AddSource({ busy, onAdd }: { busy: boolean; onAdd: (body: FeedSourceAddBody) => Promise<void> }) {
  const [kind, setKind] = useState<FeedSourceKind>("feed");
  const [form, setForm] = useState({ id: "", title: "", publisher: "", homepage: "", url: "", repo: "", queries: "", match: "", reason: "" });
  const [category, setCategory] = useState<FeedCategory>("papers");
  const [field, setField] = useState<FeedField>("general");
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async () => {
    const match = words(form.match, /,/);
    const body: FeedSourceAddBody = {
      id: form.id.trim(), kind, title: form.title.trim(), publisher: form.publisher.trim(), homepage: form.homepage.trim(),
      category, field, reason: form.reason.trim(), ...(match.length ? { match } : {}),
      ...(kind === "feed" ? { url: form.url.trim() } : kind === "github-releases" ? { repo: form.repo.trim(), skipPrereleases: true } : { queries: words(form.queries, /\n/) }),
    };
    await onAdd(body);
  };
  const label = "flex min-w-0 flex-col gap-1.5 text-[13px] text-gaid-ink-2";
  return (
    <details className="text-[15px]">
      <summary className="cursor-pointer font-medium">{text("admin.add.title")}</summary>
      <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
          <label className={label}>{text("admin.add.kind")}
            <select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as FeedSourceKind)}>
              {FEED_SOURCE_KINDS.map((k) => <option key={k} value={k}>{text(`admin.add.kinds.${k}`)}</option>)}
            </select>
          </label>
          <AddField label="admin.add.id" required pattern="[a-z0-9][a-z0-9-]{1,47}" value={form.id} onChange={set("id")} />
          <AddField label="admin.add.name" required maxLength={120} value={form.title} onChange={set("title")} />
          <AddField label="admin.add.publisher" required maxLength={120} value={form.publisher} onChange={set("publisher")} />
          <AddField label="admin.add.homepage" required type="url" value={form.homepage} onChange={set("homepage")} />
          {kind === "feed" && <AddField label="admin.add.url" required type="url" value={form.url} onChange={set("url")} />}
          {kind === "github-releases" && <AddField label="admin.add.repo" required pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" value={form.repo} onChange={set("repo")} />}
          {kind === "github-search" && (
            <label className={label}>{text("admin.add.queries")}
              <textarea required rows={3} className={cn(fieldClass, "h-auto py-2")} value={form.queries} onChange={set("queries")} />
            </label>
          )}
          <label className={label}>{text("categoryGroup")}
            <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value as FeedCategory)}>
              {FEED_CATEGORIES.map((c) => <option key={c} value={c}>{text(`category.${c}`)}</option>)}
            </select>
          </label>
          <label className={label}>{text("field.label")}
            <select className={fieldClass} value={field} onChange={(e) => setField(e.target.value as FeedField)}>
              {FEED_FIELDS.map((f) => <option key={f} value={f}>{text(`field.${f}`)}</option>)}
            </select>
          </label>
          <AddField label="admin.add.match" value={form.match} onChange={set("match")} />
          <AddField label="admin.add.reasonField" required maxLength={300} value={form.reason} onChange={set("reason")} />
        </fieldset>
        <Button type="submit" className="self-start" disabled={busy}>{text("admin.add.button")}</Button>
      </form>
    </details>
  );
}

/** `Field` from the hub server card reads its label from the hubServer namespace; this one reads hubFeeds. */
function AddField({ label, ...props }: Omit<Parameters<typeof Field>[0], "label"> & { label: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-gaid-ink-2">
      {text(label)}
      <input {...props} className={fieldClass} />
    </label>
  );
}
