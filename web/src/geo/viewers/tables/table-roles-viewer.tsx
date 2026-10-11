"use client";
import { useEffect, useRef, useState } from "react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { apiFetch } from "@/lib/projects";
import { TABLE_ROLES, TABLE_SCHEMA, type TableMapping, type TableRequest, type TableResult, type TableRole } from "@/geo/contracts/tables";
import { t } from "./strings";
const control = "rounded border bg-background px-2 py-1 text-sm";
export default function TableRolesViewer(props: ViewerProps) {
  return <TableRoles key={`${props.projectId ?? "active"}:${props.path}`} {...props} />;
}
function TableRoles({ path, name, projectId }: ViewerProps) {
  const [data, setData] = useState<TableResult | null>(null);
  const [mapping, setMapping] = useState<TableMapping>({});
  const [declarations, setDeclarations] = useState<NonNullable<TableRequest["declarations"]>>({});
  const [assessment, setAssessment] = useState<TableResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [joinPath, setJoinPath] = useState("");
  const [joinSheet, setJoinSheet] = useState("");
  const [joinData, setJoinData] = useState<TableResult | null>(null);
  const [joinLeft, setJoinLeft] = useState<TableRole>("hole_id");
  const [joinRight, setJoinRight] = useState(0);
  const ac = useRef<AbortController | null>(null);
  async function request(body: TableRequest, receive: (r: TableResult) => void) {
    ac.current?.abort();
    const controller = new AbortController(); ac.current = controller;
    setBusy(true); setError("");
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await apiFetch("/geo/tables/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal }, projectId);
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail ?? t("failed"));
      if (result.schemaVersion !== TABLE_SCHEMA) throw new Error(t("failed"));
      if (!controller.signal.aborted) receive(result);
    } catch (err) {
      if (ac.current === controller) setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      clearTimeout(timer);
      if (ac.current === controller) setBusy(false);
    }
  }
  function load(sheet?: string) {
    setAssessment(null); setData(null); setMapping({}); setDeclarations({}); setJoinEnabled(false); setJoinData(null);
    void request({ path, sheet }, setData);
  }
  useEffect(() => {
    load();
    return () => { const c = ac.current; ac.current = null; c?.abort(); };
    // Parent key remounts on project/file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const change = () => setAssessment(null);
  const label = (key: string) => t(key as Parameters<typeof t>[0]);
  return <div className="h-full space-y-4 overflow-auto p-4 text-sm" data-testid="geo-table-roles">
    <header className="space-y-2"><h2 className="font-semibold">{t("title")} · {name}</h2><p>{t("notice")}</p><p className="text-xs text-muted-foreground">{t("limits")}</p></header>
    {error && <p role="alert">{t("failed")}: {error}</p>}
    {busy && <p role="status">{t("loading")}</p>}
    <button className={control} disabled={busy} onClick={() => load(data?.source.sheet)}>{t("retry")}</button>
    {data && <fieldset disabled={busy} className="space-y-4">
      {data.sheets.length > 0 && <label className="flex gap-2">{t("sheet")}<select className={control} value={data.source.sheet} onChange={e => load(e.target.value)}>{data.sheets.map(s => <option key={s}>{s}</option>)}</select></label>}
      <section className="space-y-2"><h3 className="font-semibold">{t("columns")}</h3><p>{t(data.relevant ? "proposal" : "irrelevant")}</p>
        {data.relevant && <button className={control} onClick={() => { change(); setMapping(data.suggestions); }}>{t("suggest")}</button>}
        <div className="grid gap-2 sm:grid-cols-2">{TABLE_ROLES.map(role => <label key={role} className="flex flex-col gap-1">{t(role)}<select className={control} value={mapping[role] ?? ""} onChange={e => {
          change(); const next = { ...mapping }; delete next[role];
          if (e.target.value !== "") { const index = Number(e.target.value); for (const key of TABLE_ROLES) if (next[key] === index) delete next[key]; next[role] = index; }
          setMapping(next);
        }}><option value="">{t("none")}</option>{data.columns.map((c, i) => <option key={i} value={i}>{i + 1}: {c}</option>)}</select></label>)}</div>
      </section>
      <details><summary>{t("declarations")}</summary><div className="grid gap-2 pt-2 sm:grid-cols-2">{(["depth_unit", "unit", "analyte", "crs"] as const).map(role => <label key={role} className="flex flex-col">{t(role)}<input maxLength={128} className={control} value={declarations[role] ?? ""} onChange={e => { change(); setDeclarations({ ...declarations, [role]: e.target.value }); }} /></label>)}</div></details>
      <section className="space-y-2"><label className="flex gap-2"><input type="checkbox" checked={joinEnabled} onChange={e => { change(); setJoinEnabled(e.target.checked); }} />{t("join")}</label>
        {joinEnabled && <div className="space-y-2 rounded border p-2">
          <label className="flex flex-col">{t("joinPath")}<input className={control} value={joinPath} maxLength={4096} onChange={e => { change(); setJoinData(null); setJoinPath(e.target.value); }} /></label>
          <label className="flex flex-col">{t("joinSheet")}<input className={control} value={joinSheet} maxLength={128} onChange={e => { change(); setJoinData(null); setJoinSheet(e.target.value); }} /></label>
          <button className={control} disabled={!joinPath.trim()} onClick={() => void request({ path: joinPath, sheet: joinSheet || undefined }, r => { change(); setJoinData(r); setJoinRight(0); })}>{t("loadJoin")}</button>
          <label className="flex flex-col">{t("left")}<select className={control} value={joinLeft} onChange={e => { change(); setJoinLeft(e.target.value as TableRole); }}>{TABLE_ROLES.map(r => <option disabled={mapping[r] === undefined} value={r} key={r}>{t(r)}</option>)}</select></label>
          {joinData && <label className="flex flex-col">{t("right")}<select className={control} value={joinRight} onChange={e => { change(); setJoinRight(Number(e.target.value)); }}>{joinData.columns.map((c, i) => <option value={i} key={i}>{i + 1}: {c}</option>)}</select></label>}
        </div>}
      </section>
      <button className={control} disabled={joinEnabled && (!joinData || mapping[joinLeft] === undefined)} onClick={() => {
        setAssessment(null);
        void request({ path, sheet: data.source.sheet, mapping, declarations, join: joinEnabled && joinData ? { ...joinData.source, left: joinLeft, rightColumn: joinRight } : undefined }, r => { setData(r); setAssessment(r); });
      }}>{t("analyze")}</button>
    </fieldset>}
    {data && <section className="space-y-2"><h3 className="font-semibold">{t("source")}</h3><p>{t("count", { n: data.rowsAssessed })} · {t(data.reasons.length ? "partial" : "complete")}</p>{data.reasons.map(r => <p key={r}>{label(r)}</p>)}<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>{t("row")}</th>{data.columns.map((c, i) => <th key={i} className="border p-1">{i + 1}: {c}</th>)}</tr></thead><tbody>{data.preview.map(row => <tr key={row.ref.dataRow}><td className="border p-1">{row.ref.dataRow} / {row.ref.sourceRow}</td>{row.values.map((v, i) => <td className="border p-1 whitespace-pre-wrap" key={i}>{v ?? ""}</td>)}</tr>)}</tbody></table></div>{data.previewTruncated && <p>{t("clipped")}</p>}</section>}
    {assessment ? <section className="space-y-2" aria-live="polite"><h3 className="font-semibold">{t("checks")} · {t(assessment.status)}</h3>
      <ul>{assessment.checks.map(c => <li key={c.name}>{t(c.name)}: {t(c.status)}{c.reason && ` · ${label(c.reason)}`}</li>)}</ul>
      <p>{t("issueCount", { n: assessment.issueCount })}</p>
      <ul className="space-y-2">{assessment.issues.map((issue, i) => <li className="rounded border p-2" key={i}><p>{t(issue.code)}{issue.role && ` · ${t(issue.role)}`}{issue.values && ` · ${issue.values.join(" / ")}`}</p>{issue.refs.map((r, j) => <p key={j} className="font-mono text-xs">{r.path}{r.sheet && ` [${r.sheet}]`} · {t("row")}: {r.dataRow} / {r.sourceRow}</p>)}</li>)}</ul>
      {assessment.issuesTruncated && <p>{t("clipped")}</p>}
    </section> : data && <p>{t("stale")}</p>}
  </div>;
}
