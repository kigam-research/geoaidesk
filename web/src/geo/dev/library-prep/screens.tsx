"use client";
/**
 * 문헌 정리 mockups (gaid-library-prep phase 1): a 문헌 정리 (prepared literature summary and citation set) in 서재, made with
 * a general literature Workflow on chosen papers or imported from Gemini Notebook as 외부 정리, then read first by a
 * Workflow start and by Connect authoring. Static sample data only; nothing here is wired to the server. Built from the
 * shared parts so the screenshots show the real tokens in 계측 and 도폭.
 */
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  EllipsisIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  GlobeIcon,
  LibraryIcon,
  ListIcon,
  NewspaperIcon,
  NotebookPenIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SheetIcon,
  StarIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geoText } from "@/geo/i18n";
import { PageHeader } from "@/geo/shell/page-header";
import { SEG_TRACK, segItem } from "@/geo/shell/segmented";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import { StepList } from "@/geo/shell/step-list";
import { StepScale } from "@/geo/shell/step-scale";
import { OptionCard } from "@/geo/workspace/setup-steps";
import { IntroDisclosure, IntroFacts, IntroNote } from "@/geo/workspace/start-intro";
import { cn } from "@/lib/utils";

import { PlacesAppBar } from "./app-bar";
import { DIGESTS, DIGEST_OUTLINE, FOLDER, FOLDERS, INSTRUCTIONS_SAMPLE, NOTEBOOK_URL, PAPERS, WORKFLOW, type DigestRow } from "./fixtures";

const text = geoText("devLibraryPrep");

const FRAME = "relative flex h-dvh flex-col overflow-hidden bg-gaid-face text-gaid-ink";
const SIDEBAR = "flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-gaid-frame bg-gaid-chrome px-2.5 py-3";
const CHIP = "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold";

/* ---------------------------------------------------------------- shared bits */

function StateChip({ state }: { state: DigestRow["state"] }) {
  return state === "checked"
    ? <span className={cn(CHIP, "bg-gaid-success-tint text-gaid-success")}>{text("state.checked")}</span>
    : <span className={cn(CHIP, "border border-gaid-edge text-gaid-ink-2")}>{text("state.unreviewed")}</span>;
}

function OriginChip({ origin }: { origin: DigestRow["origin"] }) {
  return (
    <span title={text(`origin.${origin}Tip`)} className="inline-flex shrink-0 items-center rounded-full border border-gaid-edge bg-gaid-face-2 px-2 py-px text-xs font-medium text-gaid-ink-2">
      {text(`origin.${origin}`)}
    </span>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border", checked ? "border-gaid-signal bg-gaid-signal text-gaid-on-signal" : "border-gaid-control-edge bg-gaid-face")}>
      {checked && <CheckIcon className="size-3" />}
    </span>
  );
}

function SearchField({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gaid-ink-2" aria-hidden />
      <Input type="search" className="pl-9" aria-label={label} placeholder={label} />
    </div>
  );
}

function LibrarySidebar() {
  return (
    <nav aria-label={text("library.folders")} className={SIDEBAR}>
      <SidebarGroup>
        <SidebarItem icon={LibraryIcon} label={text("library.all")} count={24} />
      </SidebarGroup>
      <SidebarGroup title={text("library.folders")} action={<Button variant="ghost" size="icon-xs" aria-label={text("library.newFolder")}><FolderPlusIcon /></Button>}>
        {FOLDERS.map((f) => <SidebarItem key={f.id} icon={FolderIcon} label={f.name} count={f.count} selected={f.id === FOLDER.id} />)}
      </SidebarGroup>
    </nav>
  );
}

/** A centred sheet over a dimmed screen, drawn statically so the screenshot shows it without a portal (UI guide D2). */
function Sheet({ width, title, context, children, footer, labelId }: { width: number; title: string; context: string; children: ReactNode; footer: ReactNode; labelId: string }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <section role="dialog" aria-modal aria-labelledby={labelId} style={{ width }} className="flex max-h-[85dvh] flex-col overflow-hidden rounded-xl border border-gaid-frame bg-gaid-face shadow-lg">
        <div className="flex items-start gap-3 border-b border-gaid-edge px-6 pb-3.5 pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={labelId} className="text-xl font-semibold leading-snug">{title}</h2>
            <p className="text-sm text-gaid-ink-2">{context}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={text("sheet.close")} title={text("sheet.close")}><XIcon /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex items-center gap-2 border-t border-gaid-edge px-6 py-3">{footer}</div>
      </section>
    </div>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pb-2">
      <span className="text-sm font-semibold">{children}</span>
      {hint && <span className="text-[13px] text-gaid-ink-2">{hint}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- 1. 서재: 문헌 정리 in a folder */

function DigestDetail({ digest }: { digest: DigestRow }) {
  const covered = PAPERS.filter((p) => !p.late);
  const late = PAPERS.filter((p) => p.late);
  return (
    <aside aria-labelledby="dg-title" className="flex w-[480px] shrink-0 flex-col border-l border-gaid-frame bg-gaid-face">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gaid-frame bg-gaid-chrome px-4">
        <NotebookPenIcon className="size-4 text-gaid-ink-2" aria-hidden />
        <span className="text-sm font-semibold">{text("detail.header")}</span>
        <span className="flex-1" />
        <Button variant="outline" size="sm">{text("detail.markChecked")}</Button>
        <Button variant="ghost" size="icon-sm" aria-label={text("detail.more")} title={text("detail.more")}><EllipsisIcon /></Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2"><OriginChip origin={digest.origin} /><StateChip state={digest.state} /></div>
          <h2 id="dg-title" className="text-lg font-semibold">{digest.title}</h2>
          <p className="text-[13px] text-gaid-ink-2 tabular-nums">{text("detail.madeLine", { workflow: digest.made, date: digest.date })}</p>
        </div>
        <div className="flex items-start gap-2.5 rounded-md bg-gaid-warning-tint px-3 py-2.5 text-sm">
          <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-gaid-warning" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span>{text("detail.stale", { count: late.length })}</span>
            <span><Button variant="outline" size="sm">{text("detail.remake")}</Button></span>
          </div>
        </div>
        <IntroFacts rows={[
          { label: text("detail.fact.covers"), content: <>
            <span className="tabular-nums">{text("detail.coversLine", { count: covered.length, folder: FOLDER.name })}</span>
            <ul className="mt-1.5 flex flex-col gap-1">
              {covered.slice(0, 3).map((p) => <li key={p.id} className="truncate text-[13px] text-gaid-ink-2" title={p.title}>{p.authors} {p.year} · {p.title}</li>)}
              <li className="text-[13px] text-gaid-signal-ink">{text("detail.coversMore", { count: covered.length - 3 })}</li>
            </ul>
            <IntroNote>{text("detail.noPdf", { count: 1 })}</IntroNote>
          </> },
          { label: text("detail.fact.contents"), content: <ul className="flex flex-col gap-1">
            {DIGEST_OUTLINE.map((s) => <li key={s.heading} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-[13.5px]"><span className="font-medium">{s.heading}</span><span className="line-clamp-2 text-gaid-ink-2">{s.body}</span></li>)}
          </ul> },
          { label: text("detail.fact.used"), content: text("detail.usedLine", { projects: 1, workflows: 1 }) },
        ]} />
        <IntroDisclosure title={text("detail.read")} hint={text("detail.readHint")}><span className="text-sm text-gaid-ink-2">…</span></IntroDisclosure>
        <IntroDisclosure title={text("detail.record")} hint={text("detail.recordHint")}><span className="text-sm text-gaid-ink-2">…</span></IntroDisclosure>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gaid-edge px-5 py-3">
        <Button variant="outline">{text("detail.openProject")}</Button>
        <Button><PlayIcon data-icon="inline-start" />{text("detail.useInWorkflow")}</Button>
      </div>
    </aside>
  );
}

export function DigestLibrary() {
  const selected = DIGESTS[0];
  return (
    <div className={FRAME}>
      <PlacesAppBar place={null} library trailing={<Button variant="ghost" size="sm"><ArrowLeftIcon data-icon="inline-start" />{text("library.back")}</Button>} />
      <div className="flex min-h-0 flex-1">
        <LibrarySidebar />
        <main aria-labelledby="lib-title" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-5 px-8 pb-10 pt-7">
            <PageHeader
              titleId="lib-title"
              title={FOLDER.name}
              context={text("library.folderContext", { project: FOLDER.project })}
              actions={<>
                <Button variant="outline"><UploadIcon data-icon="inline-start" />{text("library.importGemini")}</Button>
                <Button variant="outline"><NotebookPenIcon data-icon="inline-start" />{text("library.make")}</Button>
              </>}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className={SEG_TRACK} role="group" aria-label={text("library.kinds")}>
                <button type="button" aria-pressed={false} className={segItem(false)}>{text("library.papers", { count: PAPERS.length })}</button>
                <button type="button" aria-pressed={false} className={segItem(false)}>{text("library.notes", { count: 2 })}</button>
                <button type="button" aria-pressed className={segItem(true)}>{text("library.digests", { count: 2 })}</button>
              </div>
              <SearchField label={text("library.search")} className="w-full max-w-[360px]" />
            </div>
            <ul className="flex flex-col border-t border-gaid-frame">
              {DIGESTS.slice(0, 2).map((d, i) => (
                <li key={d.id} className={cn("relative flex flex-col gap-1 border-b border-gaid-edge px-3 py-3", i === 0 && "gaid-index bg-gaid-signal-tint")}>
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{d.title}</span>
                    <OriginChip origin={d.origin} />
                    <StateChip state={d.state} />
                  </span>
                  <span className="text-xs text-gaid-ink-2 tabular-nums">
                    {d.unmatched ? text("library.rowLineUnmatched", { count: d.covers, unmatched: d.unmatched, date: d.date }) : text("library.rowLine", { count: d.covers, date: d.date })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="max-w-[680px] text-[13px] text-gaid-ink-2">{text("library.digestNote")}</p>
          </div>
        </main>
        <DigestDetail digest={selected} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 2. 문헌 정리 만들기 (sheet over 서재) */

export function DigestMake() {
  return (
    <div className={FRAME}>
      <PlacesAppBar place={null} library />
      <div className="flex min-h-0 flex-1">
        <LibrarySidebar />
        <main className="min-w-0 flex-1 px-8 pt-7"><PageHeader title={FOLDER.name} context={text("library.folderContext", { project: FOLDER.project })} /></main>
      </div>
      <Sheet
        width={720}
        labelId="mk-title"
        title={text("make.title")}
        context={text("make.context")}
        footer={<>
          <span className="flex-1 text-[13px] text-gaid-ink-2">{text("make.footer")}</span>
          <Button variant="outline">{text("sheet.cancel")}</Button>
          <Button><PlayIcon data-icon="inline-start" />{text("make.start")}</Button>
        </>}
      >
        <div className="flex flex-col gap-6">
          <section>
            <FieldLabel hint={text("make.papersHint")}>{text("make.papers")}</FieldLabel>
            <div className="flex items-center gap-3 rounded-md border border-gaid-edge px-3 py-2.5 text-sm">
              <FolderIcon className="size-4 text-gaid-ink-2" aria-hidden />
              <span className="font-medium">{FOLDER.name}</span>
              <span className="text-gaid-ink-2 tabular-nums">{text("make.papersCount", { count: PAPERS.length, pdf: PAPERS.filter((p) => p.pdf).length })}</span>
              <span className="flex-1" />
              <Button variant="link" size="sm" className="h-auto px-0">{text("make.papersEdit")}</Button>
            </div>
            <IntroNote>{text("make.noPdf", { count: PAPERS.filter((p) => !p.pdf).length })}</IntroNote>
          </section>
          <section role="radiogroup" aria-labelledby="mk-kind">
            <div id="mk-kind"><FieldLabel hint={text("make.kindHint")}>{text("make.kind")}</FieldLabel></div>
            <div className="flex flex-col gap-2">
              <OptionCard selected onSelect={() => {}} title={text("make.kinds.compare")} badge={<span className={cn(CHIP, "bg-gaid-signal-tint text-gaid-signal-ink")}>{text("make.recommended")}</span>} hint={text("make.kinds.compareHint")} />
              <OptionCard selected={false} onSelect={() => {}} title={text("make.kinds.summarize")} hint={text("make.kinds.summarizeHint")} />
              <OptionCard selected={false} onSelect={() => {}} title={text("make.kinds.methods")} hint={text("make.kinds.methodsHint")} />
            </div>
          </section>
          <section>
            <FieldLabel hint={text("make.questionHint")}>{text("make.question")}</FieldLabel>
            <textarea rows={2} aria-label={text("make.question")} defaultValue={DIGEST_OUTLINE[0].body}
              className="w-full resize-none rounded-md border border-gaid-control-edge bg-gaid-face px-3 py-2 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-ring" />
          </section>
          <section>
            <FieldLabel hint={text("make.whereHint")}>{text("make.where")}</FieldLabel>
            <div className="flex items-center gap-3 rounded-md border border-gaid-control-edge px-3 py-2 text-sm">
              <span className="font-medium">{FOLDER.project}</span>
              <span className="text-[13px] text-gaid-ink-2">{text("make.whereAttached")}</span>
              <span className="flex-1" />
              <span className="text-gaid-ink-2" aria-hidden>▾</span>
            </div>
          </section>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- 3. Gemini Notebook 결과 가져오기 (sheet over 서재) */

export function DigestImport() {
  const matched = PAPERS.filter((p) => ["a1", "a2", "a3", "a4"].includes(p.id));
  return (
    <div className={FRAME}>
      <PlacesAppBar place={null} library />
      <div className="flex min-h-0 flex-1">
        <LibrarySidebar />
        <main className="min-w-0 flex-1 px-8 pt-7"><PageHeader title={FOLDER.name} context={text("library.folderContext", { project: FOLDER.project })} /></main>
      </div>
      <Sheet
        width={720}
        labelId="im-title"
        title={text("import.title")}
        context={text("import.context")}
        footer={<>
          <span className="flex-1 text-[13px] text-gaid-ink-2">{text("import.footer")}</span>
          <Button variant="outline">{text("sheet.cancel")}</Button>
          <Button>{text("import.add")}</Button>
        </>}
      >
        <div className="flex flex-col gap-6">
          <section>
            <FieldLabel hint={text("import.fileHint")}>{text("import.file")}</FieldLabel>
            <div className="flex items-center gap-3 rounded-md border border-gaid-edge px-3 py-2.5 text-sm">
              <FileTextIcon className="size-4 text-gaid-ink-2" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">Pocheon_magnetite_briefing.docx</span>
              <span className="text-[13px] text-gaid-ink-2 tabular-nums">182 KB</span>
              <Button variant="link" size="sm" className="h-auto px-0">{text("import.replace")}</Button>
            </div>
            <p className="mt-2 flex items-start gap-2 rounded-md bg-gaid-face-2 px-3 py-2.5 text-[13px] text-gaid-ink-2">
              <BookOpenIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {text("import.limit")}
            </p>
          </section>
          <section className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>{text("import.name")}</FieldLabel>
              <Input aria-label={text("import.name")} defaultValue="Pocheon magnetite briefing" />
            </div>
            <div>
              <FieldLabel>{text("import.link")}</FieldLabel>
              <Input aria-label={text("import.link")} defaultValue={NOTEBOOK_URL} />
              <IntroNote>{text("import.linkFromFolder")}</IntroNote>
            </div>
          </section>
          <section>
            <FieldLabel hint={text("import.coversHint")}>{text("import.covers")}</FieldLabel>
            <ul className="flex flex-col border-t border-gaid-frame">
              {matched.map((p) => (
                <li key={p.id} className="flex items-start gap-3 border-b border-gaid-edge px-2 py-2">
                  <CheckBox checked />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium" title={p.title}>{p.title}</span>
                    <span className="text-xs text-gaid-ink-2">{p.authors} · {p.year} · {text(p.id === "a4" ? "import.byTitle" : "import.byDoi")}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-3 border-b border-gaid-edge px-2 py-2">
                <CheckBox checked={false} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">Magnetite skarn deposits of the Gyeonggi Massif: a field guide</span>
                  <span className="text-xs text-gaid-ink-2">{text("import.notInLibrary")}</span>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------------------------------------------------------------- 4. Workflow start window reads the 문헌 정리 first */

function StartFrame({ index, children, footer }: { index: number; children: ReactNode; footer: ReactNode }) {
  const steps = [
    { index: 0, label: text("start.steps.intro") },
    { index: 1, label: "자료 준비", hint: text("start.steps.hint1") },
    { index: 2, label: "처리·모델링", hint: text("start.steps.hint2") },
    { index: 3, label: text("start.steps.summary") },
  ];
  return (
    <div className={FRAME}>
      <PlacesAppBar place="workspace" project={FOLDER.project} />
      <div className="flex min-h-0 flex-1 bg-gaid-face-2" />
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
        <section role="dialog" aria-modal aria-labelledby="st-title" className="flex h-[min(760px,85dvh)] w-[920px] flex-col overflow-hidden rounded-xl border border-gaid-frame bg-gaid-face shadow-lg">
          <div className="space-y-1 border-b border-gaid-edge px-6 pb-3.5 pt-4">
            <div className="flex items-center gap-2 text-[13px] text-gaid-ink-2"><span>{text("start.meta", { version: WORKFLOW.version })}</span></div>
            <h2 id="st-title" className="text-xl font-semibold leading-snug">{WORKFLOW.title}</h2>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto border-r border-gaid-edge bg-gaid-chrome py-3.5 pl-3.5 pr-2.5">
              <StepList groups={[{ items: [steps[0]] }, { title: text("start.steps.stage"), count: 2, items: steps.slice(1, 3) }, { items: [steps[3]] }]} current={index} onStep={() => {}} label={text("start.steps.label")} />
            </div>
            <div className="min-h-0 overflow-y-auto px-7 pb-6 pt-5">{children}</div>
          </div>
          <div className="flex items-center gap-2 border-t border-gaid-edge px-6 py-3">{footer}</div>
        </section>
      </div>
    </div>
  );
}

function DigestChoice() {
  const [gaid, gemini] = DIGESTS;
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={text("start.fact.digest")}>
      <OptionCard selected onSelect={() => {}}
        title={gaid.title}
        badge={<><span className={cn(CHIP, "bg-gaid-signal-tint text-gaid-signal-ink")}>{text("make.recommended")}</span><StateChip state={gaid.state} /></>}
        hint={text("start.digestHint", { covers: gaid.covers, total: 5, date: gaid.date })}>
        <span className="text-[13px] text-gaid-ink-2">{text("start.digestWhy")}</span>
      </OptionCard>
      <OptionCard selected={false} onSelect={() => {}}
        title={gemini.title}
        badge={<OriginChip origin="gemini" />}
        hint={text("start.digestHintExternal", { covers: gemini.covers, total: 5 })} />
      <OptionCard selected={false} onSelect={() => {}} title={text("start.digestNone")} hint={text("start.digestNoneHint")} />
    </div>
  );
}

export function StartIntroDigest() {
  return (
    <StartFrame index={0} footer={<>
      <span className="text-sm text-gaid-ink-2">{text("start.steps.intro")}</span>
      <span className="flex-1" />
      <Button>{text("start.toInputs")}<ArrowRightIcon data-icon="inline-end" /></Button>
    </>}>
      <IntroFacts rows={[
        { label: text("start.fact.purpose"), content: WORKFLOW.purpose },
        { label: text("start.fact.papers"), content: <>
          <span className="tabular-nums">{text("start.papersLine", { count: 5 })}</span>
          <IntroNote>{text("start.papersAttached")}</IntroNote>
        </> },
        { label: text("start.fact.digest"), content: <DigestChoice /> },
        { label: text("start.fact.inputs"), content: <>
          <span className="block">항공자력 격자<span className="ml-2 font-mono text-xs text-gaid-ink-2">.tif, .grd</span></span>
          <span className="block">시추 코어 대자율 표<span className="ml-2 font-mono text-xs text-gaid-ink-2">.csv, .xlsx</span></span>
        </> },
        { label: text("start.fact.outputs"), content: "광체 경계 지도, 깊이 단면, 부피 추정표" },
      ]} />
    </StartFrame>
  );
}

export function StartSummaryDigest() {
  return (
    <StartFrame index={3} footer={<>
      <span className="text-sm text-gaid-ink-2">{text("start.steps.summary")}</span>
      <span className="flex-1" />
      <Button variant="outline">{text("start.back")}</Button>
      <Button><PlayIcon data-icon="inline-start" />{text("start.begin")}</Button>
    </>}>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">{text("start.summaryTitle")}</h3>
        <IntroFacts rows={[
          { label: text("start.sum.digest"), content: <>
            <span className="font-medium">{DIGESTS[0].title}</span>
            <span className="ml-2"><StateChip state="unreviewed" /></span>
            <IntroNote>{text("start.sum.digestNote")}</IntroNote>
            <Button variant="link" size="sm" className="h-auto px-0 pt-1">{text("start.edit")}</Button>
          </> },
          { label: text("start.sum.papers"), content: <>
            <span className="tabular-nums">{text("start.sum.papersLine", { count: 5 })}</span>
            <IntroNote>{text("start.sum.papersNote")}</IntroNote>
          </> },
          { label: "항공자력 격자", content: <span className="font-mono text-[13px]">user_data/pocheon_tmi_2024.tif</span> },
          { label: "시추 코어 대자율 표", content: <span className="font-mono text-[13px]">user_data/pocheon_core_susceptibility.csv</span> },
          { label: "대자율 임계값", content: "0.05 SI" },
        ]} />
        <IntroDisclosure title={text("start.instructions")} hint={text("start.instructionsHint")}>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-gaid-ink-2">{INSTRUCTIONS_SAMPLE}</pre>
        </IntroDisclosure>
      </div>
    </StartFrame>
  );
}

/* ---------------------------------------------------------------- 5. Connect authoring: 문헌 정리 as a source */

export function AuthoringDigest() {
  const steps = (["sources", "questions", "draft", "trial", "share"] as const).map((id) => ({ label: text(`authoring.steps.${id}`) }));
  return (
    <div className={FRAME}>
      <PlacesAppBar place="connect" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label={text("authoring.nav")} className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gaid-frame bg-gaid-chrome py-3">
          {[StarIcon, ListIcon, PencilIcon, BookOpenIcon, NewspaperIcon].map((RailIcon, i) => (
            <span key={i} className={cn("relative flex size-9 items-center justify-center rounded-md text-gaid-ink-2", i === 2 && "gaid-index bg-gaid-signal-tint text-gaid-signal-ink before:!left-[-6px]")}>
              <RailIcon className="size-4" aria-hidden />
            </span>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7 px-8 pb-8 pt-7">
              <PageHeader title={text("authoring.title")} context={text("authoring.context")} />
              <StepScale steps={steps} current={0} label={text("authoring.steps.label")} />
              <section className="flex flex-col gap-3" aria-labelledby="au-added">
                <h2 id="au-added" className="text-lg font-semibold">{text("authoring.added", { count: 1 })}</h2>
                <ul className="border-t border-gaid-frame">
                  <li className="flex min-h-11 items-center gap-3 border-b border-gaid-edge px-3 py-2">
                    <SheetIcon className="size-4 shrink-0 text-gaid-ink-2" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">pocheon_core_susceptibility.csv</span>
                    <span className="text-xs text-gaid-ink-2">{text("authoring.kinds.data")}</span>
                  </li>
                </ul>
              </section>
              <section className="flex flex-wrap items-center gap-x-4 gap-y-3" aria-labelledby="au-add">
                <h2 id="au-add" className="text-base font-semibold">{text("authoring.addHeading")}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline"><UploadIcon data-icon="inline-start" />{text("authoring.upload")}</Button>
                  <Button variant="outline"><GlobeIcon data-icon="inline-start" />{text("authoring.web")}</Button>
                  <Button variant="outline" aria-pressed className="border-transparent bg-gaid-signal-tint text-gaid-signal-ink hover:bg-gaid-signal-tint"><BookOpenIcon data-icon="inline-start" />{text("authoring.fromLibrary")}</Button>
                </div>
              </section>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gaid-edge px-8 py-3">
            <Button variant="outline" disabled>{text("authoring.back")}</Button>
            <Button variant="outline">{text("authoring.next")}<ArrowRightIcon data-icon="inline-end" /></Button>
          </div>
        </main>
        <aside aria-label={text("panel.title")} className="flex w-[440px] shrink-0 flex-col border-l border-gaid-frame bg-gaid-face">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gaid-frame bg-gaid-chrome px-3">
            <BookOpenIcon className="size-4 text-gaid-ink-2" aria-hidden />
            <span className="text-sm font-semibold">{text("panel.title")}</span>
            <span className="flex-1" />
            <Button variant="ghost" size="icon-sm" aria-label={text("sheet.close")} title={text("sheet.close")}><XIcon /></Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <p className="text-sm text-gaid-ink-2">{text("panel.context")}</p>
            <div className={SEG_TRACK} role="group" aria-label={text("library.kinds")}>
              <button type="button" aria-pressed={false} className={segItem(false, "h-7 text-xs")}>{text("library.papers", { count: 24 })}</button>
              <button type="button" aria-pressed={false} className={segItem(false, "h-7 text-xs")}>{text("library.notes", { count: 5 })}</button>
              <button type="button" aria-pressed className={segItem(true, "h-7 text-xs")}>{text("library.digests", { count: 3 })}</button>
            </div>
            <SearchField label={text("library.search")} />
            <ul className="flex flex-col border-t border-gaid-frame">
              {DIGESTS.map((d, i) => (
                <li key={d.id}>
                  <button type="button" aria-pressed={i === 0} className={cn("flex w-full gap-3 border-b border-gaid-edge px-2 py-2.5 text-left hover:bg-gaid-hover", i === 0 && "bg-gaid-signal-tint hover:bg-gaid-signal-tint")}>
                    <CheckBox checked={i === 0} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span><OriginChip origin={d.origin} /></span>
                      <span className="text-xs text-gaid-ink-2 tabular-nums">{text("library.rowLine", { count: d.covers, date: d.date })} · {text(`state.${d.state}`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1.5 rounded-md border border-gaid-edge px-3 py-2.5">
              <span className="flex items-start gap-3 text-sm"><CheckBox checked /><span>{text("panel.withPapers", { count: 5 })}</span></span>
              <span className="pl-7 text-[13px] text-gaid-ink-2">{text("panel.withPapersHint")}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gaid-edge px-4 py-3">
            <span className="text-sm text-gaid-ink-2 tabular-nums">{text("panel.selected", { count: 1, papers: 5 })}</span>
            <Button>{text("panel.add", { count: 6 })}</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
