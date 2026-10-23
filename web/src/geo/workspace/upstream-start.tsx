"use client";
/**
 * 일반 Workflow (upstream BYOK) in the one GAID start window (gaid-workflow-start-ui). Same parts as a GAID Workflow:
 * 소개 from what the upstream Workflow records (description, data, placeholders; no outputs or steps are recorded, so
 * none are shown), 자료 with the researcher's own data first, one step per placeholder, and a summary whose action
 * puts a start draft into a new chat (user decision 2026-10-23: no model choice in this window; the composer's model
 * applies). The English instructions sit collapsed under "AI agent가 받는 지침" and stay editable.
 */
import { useId, useMemo, useRef, useState } from "react";
import { ChevronRightIcon, FolderUpIcon, UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkflowInputProps } from "@/components/workflow-inputs";
import { workflowDisplayText, type Workflow } from "@/components/workflows-panel";
import { buildWorkflowPrompt } from "@/lib/workflow-inputs";
import { SourceBadge, UPSTREAM_APP_SOURCE } from "@/geo/attribution/source-badge";
import { geoText, t } from "@/geo/i18n";
import { startGeoTask } from "./events";
import { OptionCard, StepHeading, SummaryRows, isOwnData, type SummaryRow } from "./setup-steps";
import { StartWindow, introNextLabel, type StartStep } from "./start-window";
import { ClampedText, IntroDisclosure, IntroFacts, IntroNote, IntroQual, type IntroRow } from "./start-intro";

const inputText = geoText("workflows");
const fieldClass = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const baseName = (path: string) => path.split("/").pop() || path;

type Step = { kind: "intro" } | { kind: "data" } | { kind: "text"; key: string; label: string; required: boolean } | { kind: "summary" };

export function UpstreamStart({ workflow, open, onOpenChange, availableFiles = [], availableFolders = [], filesReady = true, onUploadFiles }: {
  workflow: Workflow; open: boolean; onOpenChange: (open: boolean) => void;
} & WorkflowInputProps) {
  const name = workflowDisplayText(workflow, "name", workflow.name);
  const description = workflowDisplayText(workflow, "description", workflow.description);
  const steps: Step[] = useMemo(() => [
    { kind: "intro" },
    { kind: "data" },
    ...workflow.placeholders.map((ph): Step => ({ kind: "text", key: ph.key, label: workflowDisplayText(workflow, `inputs.${ph.key}`, ph.label), required: ph.required })),
    { kind: "summary" },
  ], [workflow]);
  const summary = steps.length - 1;
  const [index, setIndex] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [sources, setSources] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  const assembled = useMemo(() => workflow.placeholders.reduce(
    (prompt, ph) => prompt.replaceAll(`{${ph.key}}`, values[ph.key]?.trim() || `[${ph.label}]`), workflow.prompt), [workflow, values]);
  const finalPrompt = buildWorkflowPrompt(edited ?? assembled, files, sources, folders);
  const hasData = files.length + folders.length > 0 || sources.trim().length > 0;
  const dataDone = hasData || !workflow.requiresFiles;
  const textDone = (key: string) => Boolean(values[key]?.trim());
  const done = (i: number) => {
    const step = steps[i];
    return step.kind === "intro" ? index > 0 : step.kind === "data" ? hasData || (!workflow.requiresFiles && i < index) : step.kind === "text" ? textDone(step.key) || (!step.required && i < index) : false;
  };
  const step = steps[index];
  const nextBlocked = step.kind === "data" && !dataDone ? t("workspace.start.upstream.needData")
    : step.kind === "text" && step.required && !textDone(step.key) ? t("workspace.start.upstream.needText") : null;
  const missing = steps.filter((s): s is Extract<Step, { kind: "text" }> => s.kind === "text" && s.required && !textDone(s.key)).map((s) => s.label);
  const blocked = !dataDone ? t("workspace.start.upstream.needData")
    : missing.length ? t("workspace.start.upstream.blockedText", { names: missing.join(", ") }) : null;

  const start = () => {
    setError(null);
    const result = startGeoTask({ title: name, text: finalPrompt, attachedFiles: files, skills: [] });
    if (result !== "opened") { setError({ message: t(`workspace.setup.${result === "tab-limit" ? "tabLimit" : "noWorkspace"}`) }); return; }
    setIndex(0); setFiles([]); setFolders([]); setSources(""); setValues({}); setEdited(null); setEditing(false);
    onOpenChange(false);
  };

  const startSteps: StartStep[] = steps.map((s, i) => ({
    group: s.kind === "data" ? "input" : s.kind === "text" ? "choice" : s.kind,
    label: s.kind === "intro" ? t("workspace.start.intro") : s.kind === "data" ? inputText("dialog.data") : s.kind === "text" ? s.label : t("workspace.setup.summaryTab"),
    done: s.kind !== "summary" && done(i),
  }));

  const instructions = (editable: boolean) => <IntroDisclosure title={t("workflowView.agentInstructions")} hint={t("workspace.start.upstream.english")}>
    {editable && <div className="mb-2 flex justify-end">
      <Button type="button" variant="ghost" size="sm" onClick={() => { if (!editing) setEdited(edited ?? assembled); setEditing(!editing); }}>
        {t(editing ? "workspace.start.upstream.editDone" : "workspace.start.upstream.edit")}
      </Button>
    </div>}
    {editing && editable
      ? <textarea aria-label={t("workflowView.agentInstructions")} value={edited ?? assembled} onChange={(event) => setEdited(event.target.value)}
        className="min-h-40 w-full resize-y rounded-md border bg-background px-3 py-2 text-[13px] leading-5" />
      : <pre className="max-h-56 overflow-auto rounded-md border border-gaid-edge bg-gaid-face-2 px-3 py-2 font-sans text-[13px] leading-5 whitespace-pre-wrap break-words">{editable ? finalPrompt : assembled}</pre>}
  </IntroDisclosure>;

  const introRows: IntroRow[] = [
    { label: t("workspace.start.fact.purpose"), content: <ClampedText value={description} /> },
    { label: t("workspace.start.fact.inputs"), content: <>
      {inputText("dialog.data")}<IntroQual>{t(workflow.requiresFiles ? "workspace.setup.required" : "workspace.setup.optional")}</IntroQual>
      <IntroNote>{t("workspace.start.upstream.dataKinds")}</IntroNote>
    </> },
    ...(workflow.placeholders.length ? [{ label: t("workspace.start.fact.choices"), content: <>
      {workflow.placeholders.map((ph) => <span key={ph.key} className="block">{workflowDisplayText(workflow, `inputs.${ph.key}`, ph.label)}<IntroQual>{t(ph.required ? "workspace.setup.required" : "workspace.setup.optional")}</IntroQual></span>)}
    </> }] : []),
    { label: t("workspace.start.fact.note"), content: t("workspace.start.upstream.note") },
  ];

  const rows: SummaryRow[] = steps.flatMap((s, i): SummaryRow[] => {
    if (s.kind === "data") {
      const picked = [...folders.map((path) => `${baseName(path)}/`), ...files.map(baseName)];
      const locations = sources.split(/\r?\n/).filter((line) => line.trim()).length;
      const value = picked.length ? (picked.length > 1 ? t("workspace.start.upstream.dataMany", { first: picked[0], rest: picked.length - 1 }) : picked[0])
        : locations ? t("workspace.start.upstream.locations", { count: locations }) : t("workspace.setup.notChosen");
      return [{ step: i, group: t("workspace.start.group.input"), label: inputText("dialog.data"), value, muted: !hasData, title: [...folders, ...files].join("\n") || undefined }];
    }
    if (s.kind === "text") return [{ step: i, group: t("workspace.start.group.choice"), label: s.label, value: values[s.key]?.trim() || t("workspace.setup.notChosen"), muted: !textDone(s.key) }];
    return [];
  });

  return <StartWindow open={open} onOpenChange={onOpenChange} title={name} purpose={description}
    meta={<>
      <span>{t("workspace.start.source.upstream")}</span><span aria-hidden>·</span><SourceBadge source={UPSTREAM_APP_SOURCE} asText />
      <Badge variant="outline" title={t("workspace.readiness.untested")}>{t("workspace.badge.untested")}</Badge>
    </>}
    steps={startSteps} index={index} onIndex={setIndex} error={error}
    reason={index === summary ? blocked : nextBlocked}
    actions={<>
      {index > 0 && <Button variant="outline" onClick={() => setIndex(index - 1)}>{t("workspace.setup.prev")}</Button>}
      {index < summary
        ? <Button disabled={Boolean(nextBlocked)} onClick={() => setIndex(index + 1)}>{index === 0 ? introNextLabel(startSteps) : t(index === summary - 1 ? "workspace.setup.toSummary" : "workspace.setup.next")}</Button>
        : <Button disabled={Boolean(blocked)} onClick={start}>{t("workspace.setup.create")}</Button>}
    </>}>
    {step.kind === "intro" && <section aria-label={t("workspace.start.intro")}><IntroFacts rows={introRows} />{instructions(false)}</section>}
    {step.kind === "data" && <DataStep required={workflow.requiresFiles} files={files} folders={folders} sources={sources}
      availableFiles={availableFiles} availableFolders={availableFolders} filesReady={filesReady} onUploadFiles={onUploadFiles}
      onFiles={setFiles} onFolders={setFolders} onSources={setSources} />}
    {step.kind === "text" && <TextStep key={step.key} label={step.label} required={step.required} value={values[step.key] ?? ""} onChange={(value) => setValues({ ...values, [step.key]: value })} />}
    {step.kind === "summary" && <section aria-labelledby="gaid-upstream-summary" className="space-y-4">
      <div className="space-y-1">
        <h3 id="gaid-upstream-summary" className="text-base font-semibold">{t("workspace.setup.summaryTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("workspace.setup.summaryBody")}</p>
      </div>
      <SummaryRows rows={rows} onEdit={setIndex} />
      <p className="text-sm">{t("workspace.setup.limitUntested")}</p>
      {instructions(true)}
    </section>}
  </StartWindow>;
}

function TextStep({ label, required, value, onChange }: { label: string; required: boolean; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} title={label} lines={[t(required ? "workspace.start.upstream.textRequired" : "workspace.start.upstream.textOptional")]} />
    <input autoFocus aria-labelledby={id} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} />
  </section>;
}

/** Project files and folders, the researcher's own data (`user_data/`) first, earlier results folded (decision 3). */
function DataStep({ required, files, folders, sources, availableFiles, availableFolders, filesReady, onUploadFiles, onFiles, onFolders, onSources }: {
  required: boolean; files: string[]; folders: string[]; sources: string;
  onFiles: (files: string[]) => void; onFolders: (folders: string[]) => void; onSources: (sources: string) => void;
} & WorkflowInputProps) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const entries = useMemo(() => [
    ...(availableFolders ?? []).map((path) => ({ path, folder: true })),
    ...(availableFiles ?? []).map((path) => ({ path, folder: false })),
  ].filter(({ path }) => path.toLowerCase().includes(query.trim().toLowerCase())), [availableFiles, availableFolders, query]);
  const mine = entries.filter(({ path }) => isOwnData(path));
  const earlier = entries.filter(({ path }) => !isOwnData(path));
  const toggle = (path: string, folder: boolean) => {
    const values = folder ? folders : files;
    (folder ? onFolders : onFiles)(values.includes(path) ? values.filter((value) => value !== path) : [...values, path]);
  };
  const card = ({ path, folder }: { path: string; folder: boolean }) => <OptionCard key={`${folder}:${path}`} multiple
    selected={(folder ? folders : files).includes(path)} onSelect={() => toggle(path, folder)}
    title={`${baseName(path)}${folder ? "/" : ""}`} hint={folder ? t("workspace.start.upstream.folder", { path }) : path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : t("workspace.setup.input.root")} />;
  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length || !onUploadFiles) return;
    setUploading(true); setUploadError(null);
    try {
      const paths = await onUploadFiles(picked);
      onFiles([...new Set([...files, ...paths])]);
      if (paths.length < picked.length) setUploadError(inputText("inputs.partial_upload"));
    } catch { setUploadError(t("workspace.setup.input.uploadFailed")); }
    finally { setUploading(false); }
  };
  const earlierChosen = earlier.some(({ path, folder }) => (folder ? folders : files).includes(path));
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} title={inputText("dialog.data")} lines={[t(required ? "workspace.start.upstream.dataRequired" : "workspace.start.upstream.dataOptional")]} />
    {(availableFiles?.length ?? 0) + (availableFolders?.length ?? 0) > 8 && <input aria-label={inputText("inputs.search")} value={query} onChange={(event) => setQuery(event.target.value)}
      placeholder={inputText("inputs.search_placeholder")} className={fieldClass} />}
    {!filesReady ? <p className="text-sm text-gaid-ink-2">{inputText("inputs.not_ready")}</p>
      : !entries.length ? <p className="rounded-md bg-gaid-face-2 px-3 py-2 text-sm">{query ? inputText("inputs.no_matches") : inputText("inputs.empty")}</p> : null}
    <div role="group" aria-labelledby={id} className="space-y-2">
      {mine.length > 0 && <p className="flex items-baseline gap-1.5 text-[13px] font-semibold text-gaid-ink-2">{t("workspace.start.mine")}<span className="font-medium text-gaid-ink-3 tabular-nums">{mine.length}</span></p>}
      {mine.slice(0, 100).map(card)}
      {earlier.length > 0 && <details open={earlierChosen || Boolean(query)} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-dashed border-gaid-edge px-3 py-2 text-sm text-gaid-ink-2 select-none [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
          {t("workspace.start.earlier")}<span className="text-gaid-ink-3 tabular-nums">{earlier.length}</span>
        </summary>
        <div className="mt-2 space-y-2">{earlier.slice(0, 100).map(card)}</div>
      </details>}
    </div>
    {onUploadFiles && <div className="flex flex-wrap items-center gap-2">
      <input ref={fileInput} aria-label={inputText("inputs.upload_files_label")} type="file" multiple className="hidden" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
      {/* @ts-expect-error -- webkitdirectory is supported in all major browsers */}
      <input ref={folderInput} aria-label={inputText("inputs.upload_folder_label")} type="file" webkitdirectory="" className="hidden" onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}><UploadIcon aria-hidden />{t(uploading ? "workspace.setup.input.uploading" : "workspace.start.upstream.uploadFiles")}</Button>
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => folderInput.current?.click()}><FolderUpIcon aria-hidden />{t("workspace.start.upstream.uploadFolder")}</Button>
      {uploadError && <span role="alert" className="text-sm text-destructive">{uploadError}</span>}
    </div>}
    <details open={Boolean(sources)} className="text-sm">
      <summary className="cursor-pointer text-gaid-ink-2 select-none">{inputText("inputs.host_source")}</summary>
      <label htmlFor={`${id}-sources`} className="mt-2 mb-1 block text-[13px] font-medium">{inputText("inputs.locations")}</label>
      <textarea id={`${id}-sources`} value={sources} onChange={(event) => onSources(event.target.value)} rows={3} placeholder={inputText("inputs.location_examples")}
        aria-describedby={`${id}-help`} className="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm" />
      <p id={`${id}-help`} className="text-[13px] text-gaid-ink-2">{inputText("inputs.access_help")}</p>
    </details>
  </section>;
}
