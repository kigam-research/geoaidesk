"use client";
/**
 * Development parts page (/dev/parts, gaid-ui-quality-kit): the shared parts pinned in every state on one screen, plus a
 * contrast table computed from the live tokens. The UI quality check (geo/ui/quality/) screenshots it in 계측/도폭 × light/dark
 * at 1440×900 and runs axe on it. States are pinned with data-preview (shadcn skill preview states, globals.css), so the
 * page needs no pointer. The route exists only in `next dev` or a GAID_DEV_PAGES=1 build (web/src/app/dev/parts/page.dev.tsx).
 */
import { CheckIcon, FolderIcon, LoaderIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReasoningBlock, ToolActivityList } from "@/components/tool-activity";
import { setGaidStyle, useGaidStyle } from "@/geo/appearance/style";
import { geoText } from "@/geo/i18n";
import { GaidAppBar } from "@/geo/shell/app-bar";
import { PageBody, PageHeader } from "@/geo/shell/page-header";
import { SEG_TRACK, segItem } from "@/geo/shell/segmented";
import { SidebarGroup, SidebarItem } from "@/geo/shell/sidebar";
import { StepList } from "@/geo/shell/step-list";
import { StepScale } from "@/geo/shell/step-scale";
import type { ActivityItem } from "@/lib/use-agent";
import { cn } from "@/lib/utils";

const text = geoText("devParts");

/** Foreground/background role pairs and their UI guide S4 minimum (7 body, 4.5 other text, 3 boundaries and rings). */
const PAIRS = [
  { id: "body", fg: "--gaid-ink", bg: "--gaid-face", min: 7 },
  { id: "bodyChrome", fg: "--gaid-ink", bg: "--gaid-chrome", min: 7 },
  { id: "secondary", fg: "--gaid-ink-2", bg: "--gaid-face", min: 4.5 },
  { id: "secondaryChrome", fg: "--gaid-ink-2", bg: "--gaid-chrome", min: 4.5 },
  { id: "placeholder", fg: "--gaid-ink-3", bg: "--gaid-face", min: 4.5 },
  { id: "link", fg: "--gaid-signal-ink", bg: "--gaid-face", min: 4.5 },
  { id: "onSignal", fg: "--gaid-on-signal", bg: "--gaid-signal", min: 4.5 },
  { id: "onSignalHover", fg: "--gaid-on-signal", bg: "--gaid-signal-hover", min: 4.5 },
  { id: "onSignalPressed", fg: "--gaid-on-signal", bg: "--gaid-brand-hover", min: 4.5 },
  { id: "selected", fg: "--gaid-ink", bg: "--gaid-signal-tint", min: 7 },
  { id: "success", fg: "--gaid-success", bg: "--gaid-success-tint", min: 4.5 },
  { id: "warning", fg: "--gaid-warning", bg: "--gaid-warning-tint", min: 4.5 },
  { id: "danger", fg: "--gaid-danger", bg: "--gaid-danger-tint", min: 4.5 },
  { id: "untested", fg: "--gaid-untested", bg: "--gaid-face", min: 4.5 },
  { id: "controlEdge", fg: "--gaid-control-edge", bg: "--gaid-face", min: 3 },
  { id: "ring", fg: "--ring", bg: "--gaid-face", min: 3 },
  { id: "ringChrome", fg: "--ring", bg: "--gaid-chrome", min: 3 },
] as const;

// Resolves any CSS colour to sRGB by painting one pixel (shadcn skill showcase color-pair.tsx, MIT).
function toRgb(color: string, backdrop: string): [number, number, number] | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = backdrop;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function tokenColor(probe: HTMLElement, name: string) {
  probe.style.color = `var(${name})`;
  return getComputedStyle(probe).color;
}

function ContrastTable() {
  const probe = useRef<HTMLSpanElement>(null);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  useEffect(() => {
    const measure = () => {
      const el = probe.current;
      if (!el) return;
      const page = getComputedStyle(document.body).backgroundColor;
      const next: Record<string, number> = {};
      for (const pair of PAIRS) {
        const bgColor = tokenColor(el, pair.bg);
        const bg = toRgb(bgColor, page);
        const fg = bg && toRgb(tokenColor(el, pair.fg), bgColor);
        if (bg && fg) next[pair.id] = contrast(bg, fg);
      }
      setRatios(next);
    };
    measure();
    // Theme and style switches change attributes on <html>; measure again after the new tokens apply.
    const observer = new MutationObserver(() => requestAnimationFrame(measure));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-style"] });
    return () => observer.disconnect();
  }, []);
  return (
    <div>
      <span ref={probe} className="hidden" aria-hidden />
      <table className="w-full border-collapse text-sm">
        <tbody>
          {PAIRS.map((pair) => {
            const ratio = ratios[pair.id];
            const pass = ratio !== undefined && ratio >= pair.min;
            return (
              <tr key={pair.id} className="border-b border-gaid-edge last:border-b-0">
                <td className="w-12 py-1.5 pr-3">
                  <span
                    className="flex h-7 w-11 items-center justify-center rounded-sm border border-gaid-edge bg-(--pair-bg) text-xs font-semibold text-(--pair-fg)"
                    style={{ "--pair-bg": `var(${pair.bg})`, "--pair-fg": `var(${pair.fg})` } as CSSProperties}
                    aria-hidden
                  >
                    {pair.id === "controlEdge" || pair.id.startsWith("ring") ? <span className="h-4 w-6 rounded-sm border-2 border-current" /> : text("contrast.sample")}
                  </span>
                </td>
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">{text(`contrast.pairs.${pair.id}`)}</th>
                <td className="py-1.5 pr-3 text-right tabular-nums">{ratio === undefined ? "" : text("contrast.ratio", { ratio: ratio.toFixed(1) })}</td>
                <td className="py-1.5 pr-3 text-xs tabular-nums text-gaid-ink-2">{text("contrast.minimum", { min: pair.min })}</td>
                <td className="py-1.5">
                  {ratio !== undefined && (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", pass ? "text-gaid-success" : "text-gaid-danger")}>
                      {pass ? <CheckIcon className="size-3.5" aria-hidden /> : <XIcon className="size-3.5" aria-hidden />}
                      {text(pass ? "contrast.pass" : "contrast.fail")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TABS = ["papers", "notes", "files"] as const;
// Chat activity rows (UI guide V2: a skill call shows a document icon, the reasoning disclosure no AI symbol).
const ACTIVITY: ActivityItem[] = [
  { id: "dev-skill", label: "read", toolName: "read", skillName: "gaid-figures", status: "complete", timestamp: 0, args: { path: ".pi/skills/gaid-figures/SKILL.md" } },
  { id: "dev-write", label: "write", toolName: "write", status: "complete", timestamp: 0, args: { path: "연구노트/2026-10-24-grid/index.md" } },
];
const STATES = ["default", "hover", "active", "focus", "disabled", "loading"] as const;
const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
type PreviewState = (typeof STATES)[number];

function previewProps(state: PreviewState) {
  if (state === "disabled" || state === "loading") return { disabled: true };
  if (state === "hover" || state === "active" || state === "focus") return { "data-preview": state };
  return {};
}

function ButtonMatrix() {
  return (
    <table className="w-full border-separate border-spacing-x-1.5 border-spacing-y-2 text-sm">
      <thead>
        <tr>
          <th />
          {STATES.map((state) => (
            <th key={state} scope="col" className="text-left text-xs font-medium text-gaid-ink-2">{text(`states.${state}`)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VARIANTS.map((variant) => (
          <tr key={variant}>
            <th scope="row" className="pr-2 text-left text-xs font-medium text-gaid-ink-2">{text(`states.variants.${variant}`)}</th>
            {STATES.map((state) => (
              <td key={state}>
                <Button variant={variant} size="sm" {...previewProps(state)}>
                  {state === "loading" && <LoaderIcon aria-hidden />}
                  {text(state === "loading" ? "states.sampleLoading" : "states.sampleAction")}
                </Button>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, context, children, className }: { title: string; context?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold leading-6.5">{title}</h2>
        {context && <p className="text-xs text-gaid-ink-2">{context}</p>}
      </div>
      {children}
    </section>
  );
}

function Part({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <h3 className="text-xs font-semibold text-gaid-ink-2">{label}</h3>
      {children}
    </div>
  );
}

function Status({ icon, label, className }: { icon?: ReactNode; label: string; className: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium", className)}>{icon}{label}</span>;
}

export function DevPartsPage() {
  const style = useGaidStyle();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const steps = [
    { label: text("parts.steps.intro"), done: true },
    { label: text("parts.steps.data"), done: true },
    { label: text("parts.steps.model") },
    { label: text("parts.steps.review") },
    { label: text("parts.steps.summary") },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-gaid-face text-gaid-ink">
      <GaidAppBar
        place="projects"
        leading={<Badge variant="outline">{text("badge")}</Badge>}
        onOpenSettings={() => {}}
      />
      <PageBody labelledBy="dev-parts-title" className="max-w-340 gap-8">
        <PageHeader
          titleId="dev-parts-title"
          title={text("title")}
          context={text("context")}
          actions={
            <>
              <div className={SEG_TRACK} role="group" aria-label={text("style.label")}>
                {(["instrument", "mapsheet"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={style === value} className={segItem(style === value)} onClick={() => setGaidStyle(value)}>
                    {text(`style.${value}`)}
                  </button>
                ))}
              </div>
              <div className={SEG_TRACK} role="group" aria-label={text("theme.label")}>
                {(["light", "dark"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={theme === value} className={segItem(theme === value)} onClick={() => setTheme(value)}>
                    {text(`theme.${value}`)}
                  </button>
                ))}
              </div>
            </>
          }
        />
        <div className="grid grid-cols-12 gap-10">
          <Section className="col-span-5" title={text("contrast.heading")} context={text("contrast.context")}>
            <ContrastTable />
          </Section>
          <div className="col-span-7 flex min-w-0 flex-col gap-8">
            <Section title={text("states.heading")} context={text("states.context")}>
              <ButtonMatrix />
            </Section>
            <Section title={text("controls.heading")}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Input placeholder={text("controls.placeholder")} aria-label={text("controls.placeholder")} />
                <Input defaultValue={text("controls.value")} data-preview="focus" aria-label={text("controls.placeholder")} />
                <Input defaultValue={text("controls.value")} disabled aria-label={text("controls.placeholder")} />
                <div className="flex flex-col gap-1">
                  <Input defaultValue={text("controls.value")} aria-invalid aria-describedby="dev-parts-invalid" aria-label={text("controls.placeholder")} />
                  <p id="dev-parts-invalid" className="text-xs text-gaid-danger">{text("controls.invalid")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch defaultChecked />{text("controls.switchOn")}</label>
                <label className="flex items-center gap-2 text-sm"><Switch />{text("controls.switchOff")}</label>
                <label className="flex items-center gap-2 text-sm text-gaid-ink-2"><Switch disabled />{text("controls.switchDisabled")}</label>
                <Tabs defaultValue="papers">
                  <TabsList>
                    {TABS.map((tab) => <TabsTrigger key={tab} value={tab}>{text(`controls.tabs.${tab}`)}</TabsTrigger>)}
                  </TabsList>
                  {/* Each trigger's aria-controls needs its panel; the panels hold no specimen. */}
                  {TABS.map((tab) => <TabsContent key={tab} value={tab} className="sr-only">{text(`controls.tabs.${tab}`)}</TabsContent>)}
                </Tabs>
              </div>
            </Section>
          </div>
        </div>
        <Section title={text("parts.heading")}>
          <div className="flex gap-10">
            <Part className="w-60 shrink-0" label={text("parts.sidebar")}>
              <div className="rounded-md border border-gaid-frame bg-gaid-chrome p-2">
                <SidebarGroup>
                  <SidebarItem icon={FolderIcon} label={text("parts.itemSelected")} count={5} selected />
                  <SidebarItem icon={FolderIcon} label={text("parts.itemDefault")} count={2} />
                  <SidebarItem icon={FolderIcon} label={text("parts.itemHover")} count={12} preview="hover" />
                  <SidebarItem icon={FolderIcon} label={text("parts.itemFocus")} preview="focus" />
                </SidebarGroup>
              </div>
            </Part>
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <Part label={text("parts.segmented")}>
                <div className={SEG_TRACK} role="group" aria-label={text("parts.segmented")}>
                  <button type="button" aria-pressed="true" className={segItem(true)}>{text("parts.segPapers")}</button>
                  <button type="button" aria-pressed="false" className={segItem(false)}>{text("parts.segNotes")}</button>
                  <button type="button" aria-pressed="false" data-preview="hover" className={segItem(false)}>{text("parts.segHover")}</button>
                </div>
              </Part>
              <Part label={text("parts.scale")}>
                <StepScale label={text("parts.scale")} current={2} steps={steps} onStep={() => {}} />
              </Part>
              <div className="grid grid-cols-2 gap-6">
                <Part label={text("parts.status")}>
                  <div className="flex flex-wrap gap-2">
                    <Status className="bg-gaid-success-tint text-gaid-success" icon={<CheckIcon className="size-3.5" aria-hidden />} label={text("parts.done")} />
                    <Status className="bg-gaid-warning-tint text-gaid-warning" icon={<TriangleAlertIcon className="size-3.5" aria-hidden />} label={text("parts.review")} />
                    <Status className="bg-gaid-danger-tint text-gaid-danger" icon={<XIcon className="size-3.5" aria-hidden />} label={text("parts.failed")} />
                    <Status className="bg-gaid-face-2 text-gaid-untested" label={text("parts.untested")} />
                    <Status className="bg-gaid-face-2 text-gaid-ink-2" label={text("parts.nodata")} />
                    <Status className="bg-gaid-signal-tint text-gaid-ink tabular-nums" label={text("parts.readout", { count: 3 })} />
                  </div>
                </Part>
                <Part label={text("parts.agent")}>
                  <span className="inline-flex items-center gap-2 text-sm">
                    <span className="gaid-orbit" aria-hidden />
                    {text("parts.running")}
                  </span>
                </Part>
              </div>
              <Part label={text("parts.activity")}>
                <div className="flex max-w-xl flex-col gap-1">
                  <ToolActivityList activities={ACTIVITY} />
                  <ReasoningBlock reasoning={text("parts.reasoning")} />
                </div>
              </Part>
            </div>
            <Part className="w-60 shrink-0" label={text("parts.list")}>
              <StepList
                label={text("parts.list")}
                current={2}
                onStep={() => {}}
                groups={[
                  { items: [{ index: 0, label: steps[0].label, done: true }] },
                  {
                    title: text("parts.stepGroup"),
                    count: 3,
                    items: [
                      { index: 1, label: steps[1].label, done: true },
                      { index: 2, label: steps[2].label },
                      { index: 3, label: steps[3].label },
                    ],
                  },
                  { items: [{ index: 4, label: steps[4].label }] },
                ]}
              />
            </Part>
          </div>
        </Section>
      </PageBody>
    </div>
  );
}
