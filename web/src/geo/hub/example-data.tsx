"use client";
/**
 * "예제 자료" on the draft screen (gaid-workflow-example): per Workflow input, the attached example data (title, source,
 * licence, synthetic mark, size, bundled or downloaded on first use) and the researcher's actions: add from files on
 * this PC, from a data source of this draft or from a public URL, edit the text, remove. Every change is a new draft
 * revision made by the server (contract web/src/geo/contracts/authoring.ts, example section).
 */
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  suggestExampleText,
  type AttachExampleFrom,
  type AuthoringProject,
  type DraftInputExample,
  type LocalWorkflow,
  type MethodDraft,
} from "@/geo/contracts/authoring";
import { EXAMPLE_LIMITS } from "@/geo/contracts/workflow-examples";
import { geoText } from "@/geo/i18n";

import { fileBase64, hubApi } from "./api";
import { localText } from "./text";

const text = geoText("hub");
type Role = LocalWorkflow["inputRoles"][number];
type Mode = "upload" | "source" | "url";

/** Bytes as MiB/KiB with one decimal (the server states its limits in MiB). */
export function exampleSize(bytes: number): string {
  const format = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
  if (bytes >= 1024 * 1024) return text("example.size.mib", { n: format(bytes / 1024 / 1024) });
  return text("example.size.kib", { n: format(Math.max(bytes, 1) / 1024) });
}

export function ExampleDataSection({
  draft,
  project,
  onChanged,
}: {
  draft: MethodDraft;
  project: Pick<AuthoringProject, "id" | "sources" | "extractions">;
  onChanged: (draft: MethodDraft) => void;
}) {
  const roles = draft.workflow?.inputRoles ?? [];
  const [open, setOpen] = useState<{ roleId: string; edit: boolean } | null>(null);
  if (!roles.length) return null;
  return (
    <section aria-labelledby="hub-example-heading" className="flex flex-col gap-2">
      <h3 id="hub-example-heading" className="text-base font-semibold">{text("example.heading")}</h3>
      <p className="max-w-[640px] text-sm text-muted-foreground">{text("example.line")}</p>
      <ul className="flex flex-col divide-y divide-gaid-edge rounded-lg border border-gaid-edge">
        {roles.map((role) => (
          <li key={role.id} className="flex flex-col gap-3 p-3">
            <ExampleRow
              role={role}
              busyElsewhere={open !== null && open.roleId !== role.id}
              onAdd={() => setOpen({ roleId: role.id, edit: false })}
              onEdit={() => setOpen({ roleId: role.id, edit: true })}
              onRemove={async () => onChanged(await hubApi.removeExample(project.id, role.id, draft.revision))}
            />
            {open?.roleId === role.id && (
              <ExampleForm
                key={`${draft.revision}:${open.edit}`}
                role={role}
                edit={open.edit}
                draft={draft}
                project={project}
                onCancel={() => setOpen(null)}
                onSaved={(next) => {
                  setOpen(null);
                  onChanged(next);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExampleRow({
  role,
  busyElsewhere,
  onAdd,
  onEdit,
  onRemove,
}: {
  role: Role;
  busyElsewhere: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
}) {
  const example = role.example;
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = example?.files.reduce((sum, f) => sum + f.size, 0) ?? 0;
  const remote = example?.files.some((f) => f.url) ?? false;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">{localText(role.label)}</span>
        <span className="text-xs text-muted-foreground">{role.formats.join(", ")}</span>
      </div>
      {example ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{localText(example.title)}</span>
            {example.synthetic && <Badge variant="outline">{text("example.synthetic")}</Badge>}
            <Badge variant="secondary" title={text(remote ? "example.remote.tooltip" : "example.bundled.tooltip")}>
              {text(remote ? "example.remote.badge" : "example.bundled.badge")}
            </Badge>
          </div>
          <p className="text-[13px] text-muted-foreground">{text("example.source", { source: localText(example.source) })}</p>
          <p className="text-[13px] text-muted-foreground">
            {text("example.meta", { size: exampleSize(size), files: example.files.length })}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {example.license ? text("example.license", { license: example.license }) : text("example.noLicense")}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {confirm ? (
              <>
                <span className="text-sm">{text("example.removeAsk")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => void onRemove().catch((e: Error) => { setError(e.message); setConfirm(false); })}
                >
                  {text("example.remove.confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>{text("example.cancel")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" disabled={busyElsewhere} onClick={onEdit}>{text("example.edit.action")}</Button>
                <Button variant="outline" size="sm" disabled={busyElsewhere} onClick={onAdd}>{text("example.replace.action")}</Button>
                <Button variant="ghost" size="sm" disabled={busyElsewhere} onClick={() => setConfirm(true)}>{text("example.remove.action")}</Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-muted-foreground">{text("example.none")}</p>
          <Button variant="outline" size="sm" disabled={busyElsewhere} onClick={onAdd}>{text("example.add.action")}</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ExampleForm({
  role,
  edit,
  draft,
  project,
  onCancel,
  onSaved,
}: {
  role: Role;
  edit: boolean;
  draft: MethodDraft;
  project: Pick<AuthoringProject, "id" | "sources" | "extractions">;
  onCancel: () => void;
  onSaved: (draft: MethodDraft) => void;
}) {
  const current: DraftInputExample | undefined = edit ? role.example : undefined;
  const fileSources = project.sources.filter((s) => (project.extractions[s.id]?.files?.length ?? 0) > 0);
  const [mode, setMode] = useState<Mode>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [sourceId, setSourceId] = useState(fileSources[0]?.id ?? "");
  const [paths, setPaths] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [urls, setUrls] = useState("");
  const [title, setTitle] = useState(current ? localText(current.title) : "");
  const [source, setSource] = useState(current ? localText(current.source) : "");
  const [license, setLicense] = useState(current?.license ?? "");
  const [synthetic, setSynthetic] = useState(current?.synthetic ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A suggestion fills only empty fields; the researcher's own words are never replaced.
  const suggest = (from: Parameters<typeof suggestExampleText>[1]) => {
    const s = suggestExampleText(project, from);
    if (!title.trim() && s.title) setTitle(s.title);
    if (!source.trim() && s.source) setSource(s.source);
  };
  const entries = (project.extractions[sourceId]?.files ?? []).filter((f) => !filter || f.path.toLowerCase().includes(filter.toLowerCase()));
  const tooLarge = files.some((f) => f.size > EXAMPLE_LIMITS.bundledFile);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const textBody = { title, source, license, synthetic };
      if (edit) {
        onSaved(await hubApi.editExample(project.id, role.id, { baseRevision: draft.revision, ...textBody }));
        return;
      }
      let from: AttachExampleFrom;
      if (mode === "upload")
        from = { kind: "upload", files: await Promise.all(files.map(async (f) => ({ name: f.name, contentBase64: await fileBase64(f) }))) };
      else if (mode === "source") from = { kind: "source", sourceId, paths };
      else from = { kind: "url", files: urls.split(/\s+/).filter(Boolean).map((url) => ({ url })) };
      onSaved(await hubApi.attachExample(project.id, { baseRevision: draft.revision, roleId: role.id, from, ...textBody }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ready =
    title.trim() &&
    source.trim() &&
    (edit ||
      (mode === "upload" && files.length > 0 && !tooLarge) ||
      (mode === "source" && paths.length > 0) ||
      (mode === "url" && urls.trim()));

  return (
    <form onSubmit={submit} aria-label={text(edit ? "example.edit.title" : "example.add.title")} className="flex flex-col gap-3 rounded-lg border border-gaid-edge bg-gaid-face-2 p-3">
      <h4 className="text-sm font-semibold">{text(edit ? "example.edit.title" : "example.add.title")}</h4>
      <fieldset disabled={busy} className="flex flex-col gap-3">
        {!edit && (
          <>
            <div role="group" aria-label={text("example.from.label")} className="gaid-seg flex w-fit flex-wrap gap-1">
              {(["upload", "source", "url"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={mode === value}
                  className={mode === value ? "bg-gaid-signal-tint font-semibold text-gaid-signal-ink" : "text-gaid-ink-2"}
                  onClick={() => setMode(value)}
                >
                  {text(`example.from.${value}`)}
                </Button>
              ))}
            </div>
            {mode === "upload" && (
              <label className="flex flex-col gap-1 text-sm">
                <span>{text("example.upload.label")}</span>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, EXAMPLE_LIMITS.files))}
                />
                <span className={tooLarge ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}>
                  {text(tooLarge ? "example.upload.tooLarge" : "example.upload.hint", { mib: EXAMPLE_LIMITS.bundledFile / 1024 / 1024 })}
                </span>
              </label>
            )}
            {mode === "source" &&
              (fileSources.length ? (
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex flex-col gap-1">
                    <span>{text("example.sourceList.pick")}</span>
                    <select
                      className="h-8 w-fit max-w-full rounded-md border border-gaid-control-edge bg-gaid-face px-2 text-sm"
                      value={sourceId}
                      onChange={(e) => {
                        setSourceId(e.target.value);
                        setPaths([]);
                      }}
                    >
                      {fileSources.map((s) => (
                        <option key={s.id} value={s.id}>{s.title?.trim() || s.name}</option>
                      ))}
                    </select>
                  </label>
                  <Input
                    aria-label={text("example.sourceList.filter")}
                    placeholder={text("example.sourceList.filter")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {entries.slice(0, 100).map((entry) => (
                      <li key={entry.path}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={paths.includes(entry.path)}
                            disabled={entry.size > EXAMPLE_LIMITS.bundledFile}
                            onChange={(e) => {
                              setPaths((list) => (e.target.checked ? [...list, entry.path] : list.filter((p) => p !== entry.path)));
                              if (e.target.checked) suggest({ kind: "source", sourceId });
                            }}
                          />
                          <span className="font-mono text-[13px]">{entry.path}</span>
                          <span className="text-[13px] text-muted-foreground">{exampleSize(entry.size)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {entries.length > 100 && <p className="text-[13px] text-muted-foreground">{text("example.sourceList.more", { count: entries.length - 100 })}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{text("example.sourceList.none")}</p>
              ))}
            {mode === "url" && (
              <label className="flex flex-col gap-1 text-sm">
                <span>{text("example.url.label")}</span>
                <Textarea
                  rows={2}
                  inputMode="url"
                  placeholder="https://"
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  onBlur={() => {
                    const first = urls.split(/\s+/).find(Boolean);
                    if (first) suggest({ kind: "url", url: first });
                  }}
                />
                <span className="text-[13px] text-muted-foreground">{text("example.url.hint")}</span>
              </label>
            )}
          </>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>{text("example.field.title")}</span>
          <Input required maxLength={500} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{text("example.field.source")}</span>
          <Input required maxLength={500} placeholder={text("example.field.sourceHint")} value={source} onChange={(e) => setSource(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{text("example.field.license")}</span>
          <Input maxLength={500} placeholder={text("example.field.licenseHint")} value={license} onChange={(e) => setLicense(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} />
          <span>{text("example.field.synthetic")}</span>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>{text("example.cancel")}</Button>
          <Button type="submit" disabled={!ready}>
            {busy ? text(mode === "url" && !edit ? "example.checking" : "example.saving") : text(edit ? "example.edit.save" : "example.add.save")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
