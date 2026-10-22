"use client";
import { useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import type { HubSkillFinding, HubSkillLicence, HubSkillOrigin } from "@/geo/contracts/hub-skills";
import { geoLocale, geoText } from "@/geo/i18n";
import { TechnicalDetail } from "@/geo/hub/technical";

export const text = geoText("hubSkills");
export const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(geoLocale(), { dateStyle: "medium" }).format(date);
};
export function Failure({ error, retry }: { error: string; retry?: () => void }) {
  return <div className="space-y-2"><p role="alert" className="text-sm text-gaid-danger">{text("error")}</p><TechnicalDetail detail={error} />{retry && <Button variant="outline" onClick={retry}>{text("retry")}</Button>}</div>;
}
export function Licence({ licence, visibility = true }: { licence: HubSkillLicence; visibility?: boolean }) {
  return <div className="space-y-2 text-sm"><p>{text(`licence.${licence.state}`, { name: licence.spdx ?? "" })}</p>
    {visibility && ["unknown", "restricted"].includes(licence.state) && <p className="text-gaid-warning">{text("authorOnly")}</p>}
    {licence.file && <p className="font-mono text-xs">{licence.file}</p>}{licence.excerpt && <blockquote className="whitespace-pre-wrap text-gaid-ink-2">{licence.excerpt}</blockquote>}
  </div>;
}
export function Findings({ findings }: { findings: HubSkillFinding[] }) {
  return <section className="space-y-3"><h3 className="text-lg font-semibold">{text("findings")}</h3><p className="text-sm text-gaid-ink-2">{text(findings.length ? "findingsHint" : "findingsNone")}</p>
    {[...new Set(findings.map((f) => f.kind))].map((kind) => <details key={kind} className="border-b border-gaid-edge pb-2"><summary className="cursor-pointer text-sm font-medium">{text(`finding.${kind}`)}</summary><ul className="mt-3 space-y-3">{findings.filter((f) => f.kind === kind).map((f, i) => <li key={i}><p className="text-xs font-mono">{f.line ? text("line", { file: f.file, line: f.line }) : f.file}</p><pre className="mt-1 overflow-auto whitespace-pre-wrap break-words text-sm text-gaid-ink-2">{f.excerpt}</pre></li>)}</ul></details>)}
  </section>;
}
export function Origin({ origin }: { origin: HubSkillOrigin }) {
  return <div className="space-y-2 text-sm"><p>{text(`origin.${origin.kind}`, { title: origin.workflow?.title ?? "", revision: origin.workflow?.revision ?? 0, source: origin.source ?? "" })}</p>
    {origin.kind === "github" && <details><summary className="cursor-pointer">{text("sourceRecord")}</summary><dl className="mt-2 space-y-2 break-all">{[["ref", origin.ref], ["commit", origin.commit], ["fetched", origin.fetchedAt && when(origin.fetchedAt)]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-gaid-ink-2">{text(k!)}</dt><dd className="font-mono">{v}</dd></div>)}</dl></details>}
  </div>;
}
/** Static Markdown, no raw HTML execution and no remote images from skill content. */
export function Instructions({ content }: { content: string }) {
  return <div className="max-w-[680px] break-words text-sm leading-6"><Streamdown mode="static" allowedTags={{}} components={{ img: ({ alt }) => <span>{alt}</span> }}>{content}</Streamdown></div>;
}
export function FileList({ files, load }: { files: string[]; load?: (path: string) => Promise<string> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  async function open(path: string) {
    const current = ++requestId.current;
    setSelected(path); setContent(null); setError(null); setBusy(true);
    try { const value = await load!(path); if (current === requestId.current) setContent(value); } catch (e) { if (current === requestId.current) setError(String(e)); } finally { if (current === requestId.current) setBusy(false); }
  }
  return <details><summary className="cursor-pointer text-sm font-medium">{text("files", { count: files.length })}</summary><ul className="mt-2 max-h-48 overflow-auto text-sm font-mono">{files.map((f) => <li key={f}>{load ? <Button variant="ghost" className="h-auto min-h-8 max-w-full whitespace-normal break-all text-left font-mono" onClick={() => void open(f)}>{f}</Button> : f}</li>)}</ul>
    {selected && <section className="mt-4 space-y-2" aria-label={text("file")}><p className="break-all text-sm font-mono">{selected}</p>{busy ? <p role="status">{text("loading")}</p> : error ? <Failure error={error} /> : <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-gaid-edge p-4 text-sm">{content}</pre>}</section>}
  </details>;
}
