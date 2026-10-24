# GAID UI/UX guide v2

Status: adopted 2026-10-22 (gaid-design-identity--fresh). It replaces guide v1 (One UI only, approved 2026-10-16). The
user chose the identity in section 2 after the comparison of three options (계측, 도폭, 표준), verbatim: "계측을 기본으로 하고
도폭을 사용자 설정 테마에서 설정할 수 있게 할 수 있나?" and, after the answer that it is feasible, "가로 진행하자." 계측 is the
default identity; 도폭 is a style a researcher may choose in Settings → 화면 표시; 표준 was not adopted. Machine-readable values:
`geo/ui/ui-rules.json`. Checks: `node geo/ui/check-ui.mjs` (run by `scripts/check`). Copy voice and wording stay in
`geo/copy/gaid-writing.md` and `geo/copy/terminology.csv`. Implementation: tokens and identity styles in
`web/src/app/globals.css`; the style switch in `web/src/geo/appearance/`; shared parts in `web/src/geo/shell/` (app bar,
sidebar, step scale, resources popover).

User request (2026-10-22, verbatim): "모두 마음에 들지 않는다. Opus 5.5 max 에이전트에게 현재 있는 oneui와
https://developer.apple.com/kr/design/human-interface-guidelines/ 를 바탕으로 UI/UX가이드를 현재 GAID허브 GAID시스템에 맞게
재설계한 후 UI UX디자인을 새롭게 하게하자. 로고 이미지외에는 편견없이 작업할수 있게하자."
Standing user rule (verbatim): "디자인은 항상 impeccable과 taste와 브랜딩 가이드 전문가 입장에서 디자인해야한다."

Earlier user requirements this guide keeps (verbatim, from v1):
- "항상 새로운 시스템을 이용자는 너무 많은 정보량이 플랫폼이나 시스템에서 제공되면 역치를 넘어서지 못하고 포기하거나 유입에서
  빠져나올 수 있는 점을 고려하고 UI/UX에서도 너무 많은 글자 수자 정보량이 보이는 것은 유의해야한다."
- "사람 이용자들이 읽어야 하는 글자량이 너무 많으며, 스크롤이 한없이 아래로 내려가게 되어 있어 불친절하고 처음 사용자의 유입을
  떨어뜨리게 한다. 그리고 가급적 현재 사용자가 에이전트 작업하는 방식처럼 질문에 대해서는 권장 옵션을 포함한 선택지가 제공되어야
  하고, ... 기타 입력란을 제공하는 방식으로 하고 한번에 한 개의 질문을 하며, 질문은 탭으로 이전/다음으로 이동할 수 있게 ...
  흐름도 및 명료한 설명으로 인지부하를 낮추면서도 의도가 잘 반영될 수 있게"
- "시스템에 글자가 너무 많으며, 폰트도 작고 사람 연구자가 어디에 집중해야 할지도 불분명해진다." (2026-10-17)
- Map panels: legend and basic information beside the map without scrolling; attribute tables with column filter and sort;
  feature information as a map popup. Agent internals (model names, run logs, raw errors) are not shown to researchers.

Sources: Samsung One UI design guidelines (read 2026-10-16; digest `~/data/geoaidesk/work/gaid-ui-guide/oneui-notes.md`) and
Apple Human Interface Guidelines (read 2026-10-22 from developer.apple.com, design principles page dated June 8, 2026; Layout
updated September 9, 2026; digest `~/data/geoaidesk/work/gaid-design-identity--fresh/hig/md/`). GAID adapts principles and
measurements only. It uses no Samsung or Apple assets, icons, colours, materials or fonts (no One UI Sans, SF Pro, SF Symbols,
Liquid Glass). Each rule names its sources in short form: `OneUI <page>` or `HIG <page>`; `GAID` marks GAID's own rule.
Section 13 lists where GAID deliberately differs from both.

## 0. How agents use this guide

1. Before changing visible UI, read sections 1, 2 and 10, and the parts of 3–9 for what you touch. Use the shared parts
   (`GaidAppBar`, `SidebarGroup`/`SidebarItem`, `StepScale`, `StepList`, `.gaid-orbit`, `.gaid-index`, `.gaid-seg`) instead of
   re-drawing them.
2. In the change report, list the rule ids the change follows (`P2 L4 Q1`) and any it breaks, with the reason. Accepted
   debt goes in `geo/ui/ui-baseline.json` only with that reason.
3. Visual review (layout, density, component or state changes; a pure wording change needs none): screenshot the changed
   screen in Korean in both styles (계측, 도폭) and both themes (light, dark), at 1440×900 and 1280×800, and check it
   against section 12.
4. Run `node geo/ui/check-ui.mjs` (part of `scripts/check`).
5. UI quality kit (`geo/ui/quality/`, part of `scripts/check`): `node geo/ui/quality/run.mjs` after `npm ci` in that folder.
   It runs shadcn lint over the GAID sources, impeccable's detector, axe-core and full-page screenshots of the development
   parts page (`/dev/parts`, served by `next dev`) in 계측/도폭 × light/dark at 1440×900 against
   `geo/ui/quality/baseline/`, and names the guide rule of every finding (`geo/ui/ui-rules.json` `quality`). impeccable and axe
   block (switched 2026-10-24 under the switch rule there): a finding fails unless it is accepted debt in
   `geo/ui/ui-baseline.json` `quality`; shadcn lint and the screenshot comparison report only. A change to a shared part updates its specimen on the parts page and the
   baselines (`--update-baseline`, reviewed images in the change report).

Rule ids: P principles, I identity, L layout, T type, S colour, materials and states, B buttons, N navigation and
toolbars, D dialogs, sheets, popovers and menus, Q questions and start settings, G lists and cards, X tables, MAP maps,
C chat and composer, RN research notes, F feedback, M motion, A accessibility, W copy length and density, R what
researchers never see, V visual bans.

## 1. Principles

GAID is a desktop research tool (impeccable mode: Operate). The researcher's question, data and decision are the subject;
the interface is the instrument that serves them.

| Id | Rule | Source |
|---|---|---|
| P1 | **Research first.** Each view exists for a research question, a result or a decision. Data, maps and figures carry the colour; the interface stays calm around them. | HIG Design principles "Purpose", Branding "Ensure branding always defers to content"; OneUI Overview "Focus on the task at hand" |
| P2 | **One task, one primary action per view.** A second task opens in its own pane or step, not stacked under the first. | OneUI Writing "Make a choice"; HIG Buttons "prominent visual style for the most likely action" |
| P3 | **Show less first.** The first view holds what the researcher needs to decide or act; explanations, provenance and technical detail sit behind a disclosure, popover or the next step (W5 budget). | HIG Layout "Use progressive disclosure", Design principles "Simplicity"; OneUI Writing "Entice users to explore" |
| P4 | **Stay in context.** Detail opens beside its trigger (popover, inspector, pane), lists and detail sit side by side, and short tasks never leave the window. Modality only when interruption protects the researcher (D1). | HIG Modality, Split views, Popovers; OneUI Large screen "Get things done without leaving the screen" |
| P5 | **The researcher decides.** The AI agent proposes; the researcher chooses, can undo, can stop a run, and is told what is happening. Nothing important dismisses itself on a timer. | HIG Design principles "Agency", Undo and redo, Accessibility "Minimize use of time-boxed interface elements"; OneUI Accessibility "Interaction and control" |
| P6 | **Familiar desktop conventions.** Sidebar, toolbar, content and inspector; keyboard shortcuts; standard controls behaving the standard way. Identity lives in precise details (section 2), never in reinvented affordances. | HIG Design principles "Familiarity", Designing for macOS; impeccable Operate "earned familiarity" |
| P7 | **Researchers see research, not machinery** (section 10). | OneUI Writing "Show benefits and possibilities"; HIG Design principles "Responsibility" |
| P8 | **Comfortable for long sessions.** Readable sizes (T1), calm surfaces, light and dark themes that follow the system, text that scales to 200%. | OneUI Overview "Be visibly comfortable"; HIG Dark Mode, Typography, Accessibility |
| P9 | **Honest states.** Execution, review and verification stay separate states with separate words and marks (`실행 완료` ≠ `검토 완료`); estimates and untested routes keep their limit words. | GAID (`geo/copy/gaid-writing.md`); HIG Design principles "Be fully transparent about what your product does" |

## 2. Identity (what GAID-specific means)

The logo is the only fixed element (`geo/brand/`, unchanged). Its two shapes and its lettering are the identity sources:
the **octagonal G**, a solid form with 45° chamfered corners, the **orbit ring** sweeping around it, the **brand blue**
`#1f5eff` (`#4d7fff` on dark), and the **lettering**, which is outlined Pretendard (`geo/brand/licenses/`). Both styles
keep these four.

Rules for both styles:

| Id | Rule | Source |
|---|---|---|
| I1 | **The mark appears once.** The 24 px compact mark sits at the leading end of the top bar; the full lockup appears only on the project list empty state and the about view. No logo watermarks, no logo in toolbars, dialogs or empty panes. Clear space and minimum sizes follow `geo/brand/README.md`. | HIG Branding "Resist the temptation to display your logo throughout"; brand README |
| I2 | **Blue is the signal.** The brand blue marks the primary action, the current selection, focus and the AI agent's activity, nothing else. It never fills large areas and never decorates. Status colours are separate (S4). | HIG Branding "Apply your app's accent color judiciously", Color "Avoid using the same color to mean different things"; OneUI Color system "calm colours for large areas" |
| I3 | **Pretendard is the brand face** because the logo lettering is Pretendard. One family, self-hosted (`@font-face`, OFL licence in `web/public/fonts/`), carries every role; code and paths use the monospace stack. No second display face. | HIG Typography "Minimize the number of typefaces"; brand README |
| I4 | **The orbit means "the AI agent is working".** A small orbit (`.gaid-orbit`: an 18×10 px ellipse with a travelling point in the signal blue) is the one looping animation in GAID. It appears where work runs (chat header, the running note, a running step) and stops when work stops. Reduced motion shows the point at rest plus the text state. | GAID (logo); HIG Motion "Add motion purposefully"; OneUI Motion "Icon animation" |
| I5 | **Numbers are part of the identity.** Counts, versions (`0.1.1`), coordinates, depths and areas use tabular figures, align on their decimals and keep their units; they never become decoration (no `01 / 02` section numbers). | GAID; impeccable craft floor (tabular numerals) |
| I6 | **Images keep their pixels.** Figures, maps, PDFs and concept pictures are never tinted, filtered, blended or recoloured for a theme; in dark mode they sit on a light mat only when their own background is white (HIG "Soften the color of white backgrounds" is applied by the mat, not by filtering the image). Concept pictures follow the theme by asset: each has a light file generated on `--gaid-pic-well` and a dark-mode file edited from it, and `ConceptPicture` (`web/src/geo/hub/concept-picture.tsx`) frames it with the well colour and loads the file for the current theme; older white pictures sit on `--gaid-pic-mat` until the researcher fits them ("화면 테마에 맞추기"). | GAID user rule (concept pictures: user decision 2026-10-22); HIG Dark Mode "provide separate images" |

### 계측 (Instrument), the default identity

World: field and survey instruments (geologist's compass, total station, engraved scales, machined bodies). The octagonal G
reads as a machined part and the orbit as a graduated ring; instruments report values with their uncertainty, which is how
GAID reports results (P9). Brand lives in precise details, never in costume (impeccable Operate).

| Id | Rule |
|---|---|
| I7 | **Two tones.** A cool aluminium functional layer (`--gaid-chrome`: top bar, sidebars, tab strips, toolbars) around white content faces (`--gaid-face`); hairlines `--gaid-edge`. |
| I8 | **Chamfered corners.** Every rounded box gets a 45° chamfer (`corner-shape: bevel` from `--gaid-corner`, applied in `globals.css` to `rounded-*` classes except `rounded-full`): 4–6 px controls, 8 px containers, 12 px dialogs. Browsers without `corner-shape` show round corners; nothing depends on the bevel. |
| I9 | **Index mark.** The current item in a sidebar or list carries `.gaid-index`: a small signal-blue pointer at the pane edge, plus tint and weight. |
| I10 | **Graduated scale.** Step progress (start settings, research-note decisions) is drawn by `StepScale`: a scale with a major tick per step, minor ticks between, filled to the current step, a pointer above it. Scales appear only where they show a position; never as decoration. |
| I11 | **Readouts.** Counts that need the researcher (`결정 3`) are short tinted plates with tabular figures. |

| Token (light / dark) | Value |
|---|---|
| `--gaid-face` | #ffffff / #16191f |
| `--gaid-face-2` | #f6f7f9 / #1b1f26 |
| `--gaid-chrome` | #f1f3f6 / #20242c |
| `--gaid-edge` | #dce0e6 / #2e333c |
| `--gaid-control-edge` | #878f9d / #6b7382 (≥ 3:1) |
| `--gaid-ink`, `--gaid-ink-2`, `--gaid-ink-3` | #171b23, #525a68, #646c7a / #e7e9ee, #b3b9c4, #98a0ad |
| `--gaid-signal` (fill), `--gaid-signal-ink` (text) | #1f5eff, #1d4fd8 / #3366e8, #7fa2ff |
| `--gaid-signal-hover` (hovered blue fill), `--gaid-brand-hover` (pressed blue fill) | #1a54e8, #1749cc / #2f60df, #2b5ad6 |
| `--gaid-signal-tint` | #e8eeff / #1e2b4d |
| `--gaid-on-signal` (text on blue) | #ffffff / #ffffff |
| `--gaid-hover`, `--gaid-press` | #e9ecf1, #dde1e8 / #262b34, #2f3540 |
| `--gaid-danger-press` (pressed destructive fill) | #9e1f17 / #6e302b |
| `--ring` (focus ring) | `--gaid-signal` / `--gaid-signal-ink` |
| status (`success`, `warning`, `danger` with `-tint`) | #1e7a46, #8a5300, #c2261d / #4cc38a, #f0b44c, #ff7a6e |

Contrast (computed): body 17.3:1 light, 14.5:1 dark; secondary 7.0:1 / 8.9:1; placeholders 5.3:1 / 6.7:1; blue text 6.6:1 /
7.1:1; white on blue buttons 5.1:1 / 5.0:1 (hovered 6.0:1 / 5.4:1, pressed 7.3:1 / 5.9:1); control boundaries 3.3:1 / 3.7:1;
focus ring on face and chrome 5.1:1 and 4.6:1 / 7.1:1 and 6.3:1.

### 도폭 (Map sheet), the style a researcher may choose

Settings → 화면 표시 → 화면 스타일: `계측 (기본)` or `도폭`, independent of the theme, stored in the browser
(`gaid:style`) and applied as `<html data-style="mapsheet">` before first paint. The structure, behaviour and copy are the
same; only these change:

| Id | Rule |
|---|---|
| I12 | **One paper ground.** Chrome and face are the same paper (`#ffffff` / `#0f1113`); the functional layer is separated by ink neat lines (`--gaid-frame`: `#15171a` / `#d9dce0`), not by tone. |
| I13 | **Square corners** (`--radius: 0`), round elements stay round. |
| I14 | **Selection in ink.** The current item is framed in ink (`.gaid-index` draws an inset ink frame); the selected segment of a segmented control is inverted (`.gaid-seg`). |
| I15 | **Scale bar.** `StepScale` draws a cartographic scale bar: done steps solid ink, the current step in the signal blue, the rest open. |

Every screen change is reviewed in both styles (section 0). A component never branches on the style in code; it uses the
roles (`--gaid-frame`, `--gaid-chrome`, radius classes) and the shared parts, and `globals.css` draws the difference.

## 3. Layout and spacing

| Id | Rule | Source |
|---|---|---|
| L1 | **Window classes.** Regular desktop ≥ 1280 px wide (design at 1440×900, check at 1280×800); compact desktop 1024–1279 px (the inspector becomes an overlay sheet, the sidebar may collapse to a 48 px rail); below 1024 px the workspace is unsupported (`geo/compatibility.json`), hub pages reflow to one column. Functionality is the same in every class; only how much is visible changes. | HIG Layout "Keep functionality the same as size classes change"; OneUI Large screen "Windows size classes" |
| L2 | **App frame.** Top bar 52 px (global: mark, place switch 내 연구 / GAID 허브, project switcher, help, settings). Workspace: sidebar 272 px (220–360, collapsible, state kept), content (min 560 px), inspector 440 px (360–640, resizable, collapsible); the content face is the widest pane. Pane dividers are 1 px lines with an 8 px drag target and a keyboard resize alternative. | HIG Split views "Set reasonable defaults for minimum and maximum pane sizes", "Prefer the thin divider style", Sidebars; OneUI Large screen "Multi-pane layout" |
| L3 | **Functional layer and content layer.** Top bar, sidebar, toolbars and pane headers form the functional layer, drawn in the chrome tone; content (notes, files, tables, maps, chat transcript) sits on the face tone. Controls are not drawn on a solid band inside the content; a toolbar over scrolling content shows a 1 px edge only once content is under it (scroll-edge line). | HIG Materials "Liquid Glass forms a distinct functional layer", Layout "Differentiate controls from content", Scroll views (scroll edge effect); OneUI Structure "Visual depth" |
| L4 | **Reading order and alignment.** The most important item is top-leading. Align to one left edge per pane; indent only to show hierarchy. Group with space first, then a hairline, then a container; never a container inside a container. | HIG Layout "Visual hierarchy"; OneUI Layout "Focus block" |
| L5 | **Spacing scale.** 4 px unit: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Inside a control 4–8; related items 8–12; groups 20–24; sections 32–40, with more space above a heading than below it. Pane insets: content 24 (16 in compact class), sidebar 12, inspector 16. Every size is a whole number of 4 px cells. | OneUI Grid "Keyline and margin" (24 dp); HIG Accessibility (12 pt padding around bezelled controls); impeccable craft floor |
| L6 | **Measure.** Prose is at most 680 px wide (about 42 Korean characters at 15 px, 75 Latin characters); tables and maps may use the full pane. List/detail panes split 38:62 from 960 px. | OneUI Large screen "Multi-pane layout" (38:62); HIG Layout guides (readable width) |
| L7 | **First action visible.** The primary action of a view is visible at 1280×800 without scrolling. Long content scrolls inside its own region with the header and actions fixed; sheets and dialogs are at most 85% of the viewport height with a fixed footer. | OneUI Layout "Interaction area"; HIG Sheets "Present a sheet in a reasonable default size" |
| L8 | **No critical control at the bottom of a page.** Page-level actions sit in the header or next to the content they change. Exceptions: the chat composer (C1) and the footer of a fixed-height sheet or step (Q4). | HIG Layout (macOS) "Avoid placing controls or critical information at the bottom of a window", Sidebars |
| L9 | **Continuity.** Resizing, collapsing a pane, switching tabs or themes keeps scroll position, selection, expansion state and unsent input. | OneUI Foldables "App continuity"; HIG Split views, Outline views "Retain people's expansion choices" |

## 4. Typography

| Id | Rule | Source |
|---|---|---|
| T1 | **Scale (px / line height / weight).** micro 12/16/500 (tick numerals, units in table headers, nothing longer than 3 words); caption 13/18/400–500 (labels, metadata); body 15/24/400 (prose; controls use 15/20); subtitle 17/26/600; title 20/28/650; page title 26/34/700 (hub and 내 연구 pages only). Nothing below 12 px; no `text-[10px]`/`text-[11px]` (`globals.css` raises any left in upstream code to 12 px). Tailwind `text-xs`/`sm`/`lg`/`xl`/`2xl` map to 13/15/17/20/26 px. | HIG Typography "Use font sizes that most people can read easily" (macOS default 13 pt, minimum 10 pt; GAID raises both for Korean and the user's 2026-10-17 remark) |
| T2 | **Hierarchy by weight and size, at most four sizes per view** (three in dialogs and sheets). One title per view. Avoid weights below 400. | HIG Typography "Conveying hierarchy", "avoid light font weights" |
| T3 | **Korean setting.** `word-break: keep-all`; no letter-spacing on Hangul; Latin capitals in labels may take +0.02 em; line height 1.6 for prose, 1.3 for headings. English technical terms stay in English inside Korean sentences (gaid-writing.md). | GAID; gaid-writing.md "Technical terms" |
| T4 | **Numerals.** Tabular figures (`font-variant-numeric: tabular-nums`) in tables, counts, coordinates, sizes and readouts; units after a thin space or in the column header (I5). | GAID; HIG Lists and tables |
| T5 | **Text scales to 200%** (browser zoom) without lost content or overlap; adjacent items stack when space runs out; long labels wrap or truncate with a tooltip that shows the whole text, never clip silently. | HIG Typography "Dynamic Type", Text fields "expansion tooltip"; OneUI Accessibility "Scalable text" |
| T6 | **Monospace only for code, paths, commands and raw values**, never as a costume for "technical". | impeccable craft floor; taste skill |

## 5. Colour, materials and states

Colours come from tokens in `web/src/app/globals.css` by role. Components never hard-code colours or use Tailwind hue
utilities (V1). Data palettes for maps and depth tracks are the exception (`ui-rules.json` `styles.hexAllowFiles`).

| Id | Rule | Source |
|---|---|---|
| S1 | **Roles.** Each role is a `--gaid-` token: `--gaid-face` content background, `--gaid-face-2` quiet content panels (table headers, code), `--gaid-chrome` functional layer, `--gaid-edge` hairlines, `--gaid-control-edge` input and control boundaries (≥ 3:1), `--gaid-ink` text, `--gaid-ink-2` secondary text, `--gaid-ink-3` placeholders and disabled text (≥ 4.5:1), `--gaid-signal` primary fill (`--gaid-signal-hover` hovered, `--gaid-brand-hover` pressed), `--gaid-signal-ink` blue text and links (also the link-style button), `--gaid-signal-tint` selection, `--gaid-on-signal` text and icons on blue, `--gaid-hover` and `--gaid-press` the hover and pressed fills of bordered and plain controls; status `--gaid-success`, `--gaid-warning`, `--gaid-danger`, `--gaid-untested`, `--gaid-nodata` with `-tint` backgrounds. shadcn variables map onto these roles (`--background` → face, `--primary` → signal, `--primary-foreground` → on-signal, …); Tailwind reads them as `bg-gaid-*`/`text-gaid-*`. | HIG Color "dynamic system colors … semantically defined by purpose"; OneUI Color system |
| S2 | **Calm large areas, colour on small areas.** Surfaces stay neutral; colour marks only the primary action, selection, focus, agent activity and status. At most one coloured status mark per row. No gradients, glass or blur in work areas (V3). | OneUI Color system "Background color"; HIG Color "Liquid Glass color: apply color sparingly" |
| S3 | **Same colour, same meaning.** Blue never marks status; status colours never mark interactivity; meaning is never carried by colour alone (text, icon or pattern too; check in greyscale). | HIG Color "Avoid using the same color to mean different things", Accessibility "Convey information with more than color alone"; OneUI Accessibility "Use of color" |
| S4 | **Contrast.** Body text ≥ 7:1 on its surface; secondary text, captions and placeholders ≥ 4.5:1; large text (≥ 24 px, or ≥ 18.7 px bold) ≥ 3:1; control boundaries and focus rings ≥ 3:1. Checked in light and dark. | HIG Dark Mode "strive for a contrast ratio of 7:1, especially in small text", Accessibility (WCAG AA); OneUI Accessibility "Minimum contrast ratio" |
| S5 | **Light and dark follow the system.** The app follows `prefers-color-scheme` by default (`시스템 테마`); Settings → 화면 표시 may override it (`밝은 테마` / `어두운 테마`), and the header carries no theme switch. Dark surfaces are dimmer, foreground brighter; elevated overlays are lighter than the base. Both themes ship and are reviewed for every changed screen. | HIG Dark Mode "Avoid offering an app-specific appearance setting", iOS "base and elevated"; OneUI Color "Theme" |
| S6 | **Three plies of depth.** Ply 0 chrome and face (flat; separated by tone and hairlines); ply 1 raised controls only where they need it (none by default); ply 2 overlays (popover, menu, sheet, toast) with one soft shadow and a 1 px edge. Cards never cast shadows. A modal dims the window (one dim level); a related overlay gets the shadow without dim; never both stacked. | OneUI Structure "Visual depth" (dim for unrelated, shadow for related, never both); HIG Materials (functional vs content layer) |
| S7 | **States.** Every interactive element has default, hover, pressed, focus-visible (2 px `--ring` outline with 2 px offset: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`; never a translucent ring), selected, disabled and, where it applies, loading and error. A disabled primary action says why on one line beside it. Loading replaces the label with progress text and keeps the width. Selection is shown by tint plus a non-colour cue (weight, index mark or check). Pressed differs from hover and darkens: filled buttons hover on `--gaid-signal-hover` and take `--gaid-brand-hover` when pressed, destructive ones `--gaid-danger-press`, bordered and plain ones `--gaid-press` (`web/src/components/ui/button.tsx`). The development parts page (`/dev/parts`) pins every state with `data-preview` for review. | HIG Buttons "Always include a press state", Feedback "Show people when a command can't be carried out"; OneUI Accessibility "Screen reader" |
| S8 | **Browser surfaces carry the design.** Text selection, caret, scrollbars (thin, `--edge`/`--ink-3` thumb), focus rings, link underlines (offset 3 px) and placeholder text are themed from the tokens in both themes. | impeccable craft floor "Browser surfaces" |
| S9 | **Increased contrast.** Under `prefers-contrast: more`, hairlines become `--control-edge`, `--ink-2` becomes `--ink`, and tints double their strength. | HIG Color "an increased contrast option for each variant", Accessibility |

## 6. Components

### Buttons (B)

| Id | Rule | Source |
|---|---|---|
| B1 | Three levels: **filled** (signal; the one most likely action of a view), **bordered** (secondary actions), **plain** (tertiary, inline, toolbars). Exactly one filled button per view; a destructive action is never the filled default (it uses the danger style and needs confirmation or undo). | HIG Buttons "Use style, not size, to distinguish the preferred choice", "Don't assign the primary role to a button that performs a destructive action"; OneUI Buttons (three emphasis levels) |
| B2 | Height 32 px (28 in toolbars, 40 for the primary action of a sheet or start step); horizontal padding 12–16; icon 16 px with 1.75 px stroke (lucide, one family); label 15 px/500. Icon-only buttons are 28×28 or larger, have a tooltip and an accessible name; adjacent targets keep ≥ 8 px gap. | HIG Accessibility "Offer sufficiently sized controls" (macOS 28×28 default, 20×20 minimum), Offering help (tooltips); OneUI Accessibility "Touch target spacing" |
| B3 | Labels name the next action: Korean object + action (`결과 저장`), English verb + object (`Save result`); never bare `열기`/`확인`. A button that opens another view or step before acting ends with `…` only in menus, not in button labels. | HIG Writing "Be action oriented", Menus (ellipsis); gaid-writing.md |
| B4 | A view header holds at most **three** actions; the rest go in a `더 보기` (⋯) menu, where on/off items show a check. | OneUI App bar "Action button" (≤ 3), "More option"; HIG Toolbars "Add a More menu" |
| B5 | In a button row the primary action is last (trailing). Cancel is always available in sheets and dialogs and responds to Escape. | HIG Alerts "Place buttons where people expect", Sheets; OneUI Dialog |
| B6 | A button whose action takes time shows its own progress (label → progress text, width kept) and can be stopped when the work can be stopped. | HIG Buttons "display an activity indicator", Progress indicators "let people halt processing" |

### Navigation, toolbars and tabs (N)

| Id | Rule | Source |
|---|---|---|
| N1 | **Place switch.** `내 연구` and `GAID 허브` are the two places, a segmented control in the top bar, always visible. | HIG Segmented controls; OneUI Large screen "Show menus together with content" |
| N2 | **Sidebars** list areas and collections, at most two levels, with short group titles; the current item shows tint + index cue; nothing critical at the sidebar bottom; the sidebar can be hidden by a button and a shortcut. | HIG Sidebars; OneUI Large screen "Make navigation controls fit the screen" |
| N3 | **Tabs** switch closely related content in one pane: noun labels, 2–5 tabs (open-file tabs are documents and are not limited). Selected tab is announced "Tab n of m". Switching keeps input (L9). Segmented controls change a setting or a filter, not the page. | HIG Tab views (≤ 6), Segmented controls "Use a tab view … for view switching"; OneUI Bottom navigation (≤ 5) |
| N4 | **Toolbars** carry the few frequent commands for their pane, grouped by function; the pane title names the content (file name, note title), never the app. At most three visible actions plus `더 보기` (B4). | HIG Toolbars "Provide a useful title", "Don't title windows with your app name", "Choose items deliberately" |
| N5 | **Search** gets a primary position where finding is the main task (GAID 허브, file tree filter); it shows its scope in the placeholder and suggests recent or matching items when empty. | HIG Searching "give it a primary position", "Clearly display the current scope"; OneUI Search |
| N6 | **Keyboard.** Every command reachable by pointer is reachable by keyboard; common ones have shortcuts shown in menus and tooltips (`⌘K`/`Ctrl K` search, `⌘\` sidebar, `⌘Enter` send). Never override browser or OS shortcuts. | HIG Designing for macOS "Handle keyboard shortcuts", Accessibility "Let people use the keyboard alone" |

### Dialogs, sheets, popovers and menus (D)

| Id | Rule | Source |
|---|---|---|
| D1 | **Modal only when interruption protects the researcher:** required input that blocks everything else, a destructive or irreversible step, consent to send data outside the PC, or information that must be read before continuing. Everything else is inline, a popover, a pane or a toast. | OneUI Writing "Only interrupt for important things"; HIG Modality "Present content modally only when there's a clear benefit", Alerts "Use alerts sparingly" |
| D2 | **Sheets** hold one short scoped task (≤ 3 footer actions; title states the task; 480/640/720 px wide; ≤ 85% height). The Workflow start window is the one 920 px sheet: it carries a step list beside the page (Q4) so stage names stay readable (gaid-workflow-start-ui, user decision 2026-10-23); its list has at most 7 entries (gaid-workflow-stages). Longer or open-ended work uses a pane. Never a sheet over a sheet. | HIG Sheets "For complex or prolonged user flows, consider alternatives", "Display only one sheet at a time"; OneUI Dialog |
| D3 | **Alerts** are for destructive or irreversible actions people did not obviously choose: a statement title, one sentence of consequence, a named destructive button and `취소`. No alert for undoable actions (use undo instead), none at startup, none that scrolls. | HIG Alerts; OneUI Writing "Remove defensive text" |
| D4 | **Popovers** open beside their trigger, hold one small task or one record, close with Escape, outside click or the trigger, and return focus. One popover at a time; never a warning in a popover. | HIG Popovers; OneUI Large screen |
| D5 | **Context menus** (right-click or ⋯) hold a small set of relevant actions, one submenu level at most; every item also exists in visible UI or the `더 보기` menu; unavailable items are hidden in context menus and dimmed in `더 보기`. | HIG Context menus, Menus; OneUI Dialog (context menu) |
| D6 | **Inspector.** The trailing pane shows the AI agent (chat and Workflow) or the selection's properties; it can be hidden and reopened by a button and a shortcut, and keeps its width. | HIG Panels "Consider using a panel to present inspector functionality", Split views "Provide multiple ways to reveal hidden panes" |
| D7 | **Confirm before losing work.** Closing a sheet, pane or step with unsent input asks to keep or discard, or keeps the draft automatically. | HIG Modality "help people avoid data loss", Popovers "Always save work when automatically closing" |

### Questions and Workflow start settings (Q)

The pattern for every multi-step setup: Workflow start settings, hub authoring questions, method trial, interview questions
and research-note decisions.

| Id | Rule | Source |
|---|---|---|
| Q1 | **One question per step.** A setup with more than two decisions is a stepper: one question, its options, one line on why it matters. Workflow start settings are the exception: one page per analysis-flow stage holds every input and condition that stage uses, each still with its options and one line on why it matters, so the steps follow the analysis and never one item each (gaid-workflow-stages, user decision 2026-10-23). | OneUI Writing "Make a choice"; HIG Accessibility (Assistive Access) "Break up multistep workflows so people can focus on a single interaction" |
| Q2 | **Options, recommended first.** 2–5 options as selectable rows (radio rows). `권장` only when the method, the catalogue or the researcher's data gives a reason, shown on one line; the recommended option is first and pre-selected. A scientific parameter without such a reason gets no pre-selection; a question with one real option shows it as a fact. Other options state their trade-off in one line. | OneUI Writing "Understand what's happening" (benefits and trade-offs); HIG Toggles "Prefer a set of radio buttons for mutually exclusive options" |
| Q3 | **기타 (직접 입력)** is the last option with a text field; for a file input it opens the project file list. `작업 중 결정` appears only where the Workflow allows it, as its own option. | OneUI Writing "Provide help, not limits" |
| Q4 | **Step scale and Previous/Next.** A step indicator names every step (short nouns) and shows the current one; earlier steps are clickable. Up to 7 steps it is the `StepScale` at the top; the Workflow start window lists its pages in full in a left `StepList`: Workflow 소개, one page per analysis-flow stage (or 입력 자료 and 분석 조건 for a Workflow whose steps do not map its inputs and conditions), 요약 — at most 7 entries (`workflowStages`, gaid-workflow-stages). `이전 단계` and `다음 단계` sit at the bottom right of the fixed step footer; `다음 단계` is disabled with a one-line reason until the step is valid. Answers persist across steps. Readiness blockers (missing skill, environment, input) appear on the first step with the action that fixes them. A Workflow start opens on Workflow 소개 (what it does, its data, conditions, outputs, steps and limits) before any data is asked for; a setup opened from the researcher's own saved start settings starts at the summary. | HIG Writing "consistent language throughout processes with multiple steps"; OneUI Bottom navigation (tabs, no swipe-only switching) |
| Q5 | **Flow first, summary last.** The Workflow's steps are shown as one short flow (3–6 named stages) using the same words as the step scale. The last step is a summary of all answers with `수정` links and the one primary action. | OneUI Motion "Transitions harmonized with logical spatial structure"; HIG Writing ("Get Started" … "Done") |
| Q6 | Free-text questions say what a good answer contains in the hint (`값과 근거를 한 줄로 적으세요`), not in a paragraph. | HIG Text fields "Show a hint", Writing "Show hints in text fields" |
| Q7 | Start settings open as one sheet over the workspace (D2); answers persist when it is closed and reopened, and the Workflow list stays where it was. | HIG Sheets "A sheet helps people perform a scoped task that's closely related to their current context"; P4 |

### Lists, cards and Workflow rows (G)

| Id | Rule | Source |
|---|---|---|
| G1 | Row title ≤ 30 Korean / 60 English characters on one line; at most one secondary line; detail opens on click in the detail pane or a popover. Rows are 40 px (one line) or 56 px (two lines). | OneUI Lists "Main text" (≤ 31 characters); HIG Lists and tables "Keep item text succinct" |
| G2 | **Every Workflow row carries the same fields in the same places:** name; one-line purpose; source (기본 / 공유 / 내 초안) with its version (초안 for a draft; gaid-hub-versions); state (준비됨, 환경 준비 필요, 미시험 …). At most three badges, each with a tooltip. The researcher's own assessment (`수정 필요`) is a line, not a badge. | GAID (Workflow model); OneUI Layout "Text + Controller"; taste "one label per intent" |
| G3 | Cards only where elevation or an image carries real hierarchy (featured Workflows with concept pictures, project tiles with a cover). Otherwise group rows with space and hairlines. No identical icon + heading + text card grids as page structure. | impeccable craft floor "Refuse: same-size cards"; HIG Collections "Consider using a table instead of a collection for text" |
| G4 | Long lists get search, a sort control and group headers ordered by use; empty search states suggest the next query or `전체 보기`. | OneUI Search, Lists "Subheader"; HIG Searching "Provide suggestions" |
| G5 | Toggles at the trailing end of a settings row; elsewhere a checkbox or a toggle-style button. | HIG Toggles "Use the switch toggle style only in a list row"; OneUI Lists |
| G6 | Selection shows tint plus the identity's index cue (section 2) and is announced; selection persists while another pane changes. | HIG Split views "persistently highlight the current selection" |

### Tables (X)

| Id | Rule | Source |
|---|---|---|
| X1 | Sticky header; every column header sorts and filters; numbers right-aligned with tabular figures; units in the header, not in cells. | HIG Lists and tables "let people click a column heading to sort", "Use descriptive column headings"; T4 |
| X2 | ≤ 8 columns visible by default; others chosen from a column menu; columns resizable; wide tables scroll inside their region. | HIG Lists and tables "Let people resize columns"; user default 8 |
| X3 | Selecting a row opens its record in a popover or the inspector; it does not navigate away. | HIG Split views; OneUI Large screen "Avoid switching context" |
| X4 | One state line above the table: `조건에 맞는 행 133 / 전체 133`; filter scope explanations in a tooltip. Missing values show `결측값` in `--gaid-nodata`, never 0 or a raw code. | P3; gaid-writing.md "missing values never shown as 0" |
| X5 | Rows 36 px; zebra striping only above 8 columns; hairlines between rows, never both above and below every row. | HIG Lists and tables "Consider using alternating row colors"; taste "no border-t + border-b on every row" |

### Maps (MAP)

| Id | Rule | Source |
|---|---|---|
| MAP1 | Map and a 320 px side panel side by side from 1024 px. The panel holds, in order, **레이어**, **범례**, **기본 정보**; legend and basic information are visible without page scroll at 1280×800 (the panel may scroll inside). When the legend cannot show every class it shows the count (`범례 14개`) and `모두 보기`; never a silently clipped list. | OneUI Large screen "Multi-pane layout"; HIG Charting data "Keep a chart simple, letting people choose when they want additional details" |
| MAP2 | Basic information: at most 5 rows (source file, CRS, unit, feature or pixel count, extent on demand). A CRS is named by name and code when known (`Korea 2000 / Central Belt (EPSG:5186)`); a projection method alone is labelled `투영법만 기록됨`. Display-only notes go behind `자세히`. | P3; gaid-writing.md (CRS) |
| MAP3 | Clicking a feature opens a popup next to the point: layer + feature id, up to 8 attributes with readable labels, `모든 속성 보기` to the table. | OneUI Large screen; HIG Popovers |
| MAP4 | Map toolbar: display CRS and basemap as one compact group with labels; `지도 PNG 저장`; at most three visible actions. The network note for online basemaps appears only when one is chosen. | OneUI App bar; HIG Toolbars |
| MAP5 | The attribute table sits below the map (≥ 6 rows visible or a draggable split) and follows X1–X5. | GAID |
| MAP6 | The canvas shows a scale bar, cursor coordinates in the display CRS, zoom and zoom-to-layer, and a visible highlight on the selected feature. Map colours are data (V1 exception). | GAID (desktop GIS convention) |

### Chat with the AI agent and the composer (C)

| Id | Rule | Source |
|---|---|---|
| C1 | The composer docks at the bottom of the AI agent pane (the one bottom exception, L8): text field with a hint naming what can be asked, attach (`참고 자료 추가`), the model chip (configuration, R1 allows the model name here), send (`⌘Enter`). While the agent works, send becomes `중지`. | GAID; HIG Buttons, Progress indicators "let people halt processing" |
| C2 | The transcript shows research: requests, answers, results with their files, questions from the agent as Q-pattern forms, and progress as plain step text (F1). Tool calls, commands and logs collapse into one `작업 내용 보기` disclosure per answer. | P7; HIG Disclosure controls "hide details until they're relevant" |
| C3 | A Workflow started from the panel appears as one block card (title, version, the researcher's settings) at the top of its chat; the full 지침 opens on demand. | GAID (Workflow model) |
| C4 | The AI agent's running state uses the orbit (I4) with the current step in words; a finished answer shows `실행 완료` and never `검토 완료` (P9). | GAID; HIG Feedback "integrate status feedback into your interface" |
| C5 | Messages from the agent are left-aligned on the face tone without bubbles; the researcher's messages sit in a tinted block. Long answers keep the prose measure (L6). | GAID; HIG Typography (readability) |
| C6 | Mid-run steering and queued messages are visible as such (`다음 요청으로 보냄`); nothing typed is lost when a run ends or fails (L9). | P5; HIG Modality "help people avoid data loss" |

### Research notes and decisions (RN)

| Id | Rule | Source |
|---|---|---|
| RN1 | The notes view opens on research notes grouped `결정할 일`, `검토 전`, `확인함`; each row shows title, one-line headline result and the state; decisions show their count as a readout. | GAID (`docs/geo/research-notes.md`); OneUI Lists "Subheader" |
| RN2 | A note reads result first: headline, figure or table, how far it can be trusted, then decisions; method detail and the work record sit behind disclosures. | P1, P3; HIG Writing "put the most important information first" |
| RN3 | Each decision is a Q-pattern card (Q2–Q3: options with `권장` and reason, `별도 지시 (직접 입력)`). All answers go together with one `답변 보내기`; answered decisions stay visible with the chosen option. | Q-rules; user requirement (one question at a time, recommended option, 기타) |
| RN4 | `확인함으로 표시` is the researcher's review mark, separate from `실행 완료` (P9); it is reversible (`검토 전으로 되돌리기`). | P9; HIG Undo and redo |

### Feedback: progress, activity, toasts, empty and error states (F)

| Id | Rule | Source |
|---|---|---|
| F1 | **Progress** names the current research step in plain words (`입력 확인 중`, `격자 표 만드는 중 2/5`), determinate when the count is known, in one consistent place per pane. No logs, tool names or command lines (R1). | HIG Progress indicators "use a determinate progress indicator", "Display a progress indicator in a consistent location"; OneUI Writing "Understand what's happening" |
| F2 | **Loading** shows the structure immediately (skeleton rows in the final layout) and lets the researcher keep working elsewhere; no full-pane spinners. | HIG Loading "Show something as soon as possible", "Let people do other things"; impeccable Operate |
| F3 | **Toasts** confirm minor results in one line (≤ 40 Korean / 80 English characters, never more than two lines), may carry one follow-up (`되돌리기`), stay until dismissed when they carry an action, and never carry errors that block work or need a choice. | OneUI Toasts; HIG Accessibility "Minimize use of time-boxed interface elements" |
| F4 | **Empty states** say what is missing in one line and offer one action (`파일 올리기`) or a way back. | HIG Writing "Provide clear next steps on any blank screens"; OneUI Writing "Take an action" |
| F5 | **Errors** say what did not happen and what to do next, in research terms, next to the problem: `지도 자료를 읽지 못했습니다. 파일 형식을 확인한 뒤 다시 읽으세요.` Raw messages, codes and stack traces only in a collapsed `기술 정보` disclosure with a copy button (R2). Focus moves to the fix. | HIG Writing "Write clear error messages … display it as close to the problem as possible, avoid blame"; OneUI Writing "Remove defensive text" |
| F6 | **Limits** appear where they apply, in one line (`Yilgarn Ni 사례에서만 검증했습니다.`), with detail behind a disclosure that says what it opens (`해석 한계 보기`). Required limit words (추정, 미시험, 검토 전) are never removed. | OneUI Writing "Remove defensive text"; gaid-writing.md protected wording |
| F7 | **Completion** of a significant task is confirmed where the work happened (the note, the step, the file), not only in a toast. | HIG Feedback "confirm that a significant action or task has completed" |

## 7. Motion

| Id | Rule | Source |
|---|---|---|
| M1 | Durations: 120 ms for hover, press and small fades; 200 ms for popovers, panes and sheets; nothing over 300 ms. Frequent interactions (typing, row hover, tab switch) get no animation beyond colour. | OneUI Motion basics "Duration" (100–500 ms); HIG Motion "avoid adding motion to UI interactions that occur frequently" |
| M2 | Easing `cubic-bezier(0.22, 0.25, 0, 1)` for entering movement (fast start, gentle settle); linear for opacity; ease-in for exits. | OneUI Motion basics (Basic Path Interpolator 0.22, 0.25, 0.00, 1.00); impeccable craft floor (exponential ease-out) |
| M3 | Motion explains a change (a pane from its edge, a popover from its trigger, a step sliding in the direction of travel); the orbit (I4) is the only loop. No decorative entrances or page-load choreography. | HIG Motion "Add motion purposefully"; OneUI Motion "Introduction" |
| M4 | Text that changes in place fades out before the new text fades in; images may cross-fade. | OneUI Motion basics "Non-interrupted motion" |
| M5 | People never wait for an animation; input during a transition is accepted. | HIG Motion "Let people cancel motion" |
| M6 | `prefers-reduced-motion` replaces movement with fades and stops the orbit. | HIG Accessibility "Replacing transitions … with fades"; OneUI Accessibility |

## 8. Accessibility

| Id | Rule | Source |
|---|---|---|
| A1 | Every control has an accessible name; state is exposed (`aria-checked/expanded/selected/disabled`); decorative icons are `aria-hidden`; names do not repeat the role. | OneUI Accessibility "Screen reader"; HIG Accessibility "Describe your app's interface" |
| A2 | Logical tab order, visible focus ring, no focus on decoration, related controls as one stop where possible; focus stays where a repeatable action happened. Full keyboard operation (N6). | OneUI Accessibility "Focus order"; HIG Accessibility "Let people use the keyboard alone" |
| A3 | Targets ≥ 24×24 px (28×28 for icon buttons, B2) with ≥ 8 px between adjacent targets. | HIG Accessibility (macOS 28×28 / 20×20); OneUI "Touch target spacing"; WCAG 2.2 2.5.8 |
| A4 | Every drag (layer order, file move, pane resize) has a button, menu or keyboard alternative. Nothing important auto-hides; moving content longer than 5 s has a pause. | HIG Drag and drop "Offer alternative ways"; OneUI Accessibility "Interaction and control" |
| A5 | Live regions announce results (added/deleted, n selected, step changes, run finished, errors). Instructions name controls by label, never by colour or position. | OneUI Accessibility "Screen reader" principle 6, "Content"; HIG Accessibility |
| A6 | Colour-only distinctions get a second channel (text, icon, pattern). Charts and maps provide a text summary of their main message. | HIG Charting data "Make every chart accessible", "Aid comprehension by adding descriptive text"; OneUI "Use of color" |
| A7 | Respect `prefers-reduced-motion`, `prefers-contrast` and `forced-colors`. | HIG Accessibility; S9 |

## 9. Copy length and information density (W)

Voice, terminology and banned patterns: `geo/copy/gaid-writing.md`. Limits count visible characters (an ICU argument counts
as 4); English limits are double the Korean ones.

| Id | Rule | Limit (ko / en) | Source |
|---|---|---|---|
| W1 | Buttons and actions | 16 / 32 | OneUI Buttons; HIG Writing "Be action oriented" |
| W2 | Titles, headings, list row names | 30 / 60 | OneUI Lists "Main text" |
| W3 | Toasts and saved/copied notices | 40 / 80 | OneUI Toasts |
| W4 | Any other single string | 140 / 280 | OneUI Writing; HIG Writing "Be clear" |
| W5 | **First-view budget** per view (the focused pane or the open sheet, without the top bar and sidebar): body text before any interaction ≤ 300 / 600 characters, excluding the researcher's own data; at most 2 paragraphs before the first action; at most 3 badges per row. | per view | OneUI Writing; HIG Design principles "Simplicity" |
| W6 | One line of context under a title; longer explanation behind a disclosure or tooltip. One term per concept across screens (`geo/copy/terminology.csv`). Tooltips describe the action and do not repeat the control's name. | — | HIG Offering help "avoid repeating a control's name in its tooltip"; OneUI Writing |

W2–W4 are checked per string by `check-ui.mjs` (`copy-length`) for ids matching each role's patterns in `ui-rules.json`
(W1 `*.button`, `*.cta`, `*.action`; W2 `*.title`, `*.heading`, `*.name`; W3 `*.toast`, `*.saved`, `*.copied`); every other id gets
the W4 limit. W5–W6 are checked in visual review. Titles and buttons are statements and actions; only a yes/no dialog body
may ask (gaid-writing.md). Pronouns: no `우리`/"we" in system messages (HIG Writing "Avoid using we").

## 10. What researchers never see (R)

Researcher views are the workspace, chat, Workflow and method screens, viewers, results, notes, automation and hub
screens. Settings (`settings.*`, `app.settings.*`), the model picker and the local model card are configuration views where
the chosen model is content.

| Id | Rule |
|---|---|
| R1 | **No agent machinery in researcher views:** model or provider names (outside configuration views, the model chip in the composer and the R4 record view), session/chat/run/tool-call ids, commit SHAs and check receipts, token counts, prompts and system instructions, tool names and arguments, command lines, run logs, exit codes, internal state keys, internal paths (`.kady/`, `.pi/`, caches), English enum values in Korean UI, CPU/GPU/memory percentages outside a dedicated system popover. |
| R2 | **Raw errors** only inside a collapsed `기술 정보` disclosure with a copy button; the visible message follows F5. Locale ids for it end in `.technical`. |
| R3 | **Translate internal facts into research facts** or leave them out: `채팅 ID` → `채팅 열기`; `revision 1` → `version 0.1.0` (the English word on Korean screens too, never 판/버전; gaid-hub-versions). |
| R4 | Provenance, environment and trial records keep their full data; the researcher view shows a summary (what was used, when, result) with the record behind `기록 보기`. The record view may name the model; its locale ids end in `.record`. |
| R5 | Costs appear only in the budget chip (shown when a cap is set or spend is non-zero) and project settings, never inside results or method screens. |

`check-ui.mjs` (`internals`) blocks locale strings outside configuration views that interpolate `{detail}`, `{error}`,
`{message}`, `{stderr}`, `{stack}`, `{model}`, `{models}` or internal ids, and the literal labels listed in `ui-rules.json`.

## 11. Visual bans (V)

Checked mechanically by `check-ui.mjs` (`styles`, `slop`) where a proxy exists; reviewers judge the rest on screen.

| Id | Ban | Check |
|---|---|---|
| V1 | Hard-coded colours and Tailwind hue utilities (`text-blue-600`, `bg-slate-50`) in components; colours come from tokens. Data palettes are the listed exception. | `styles` hex, `slop` hue-utility |
| V2 | Generic AI symbols (sparkles, wands, robots, brain circuits, stars as "AI") and emoji in copy. The AI agent is shown by its name and the orbit (I4). | `slop` ai-icon, emoji |
| V3 | Gradients, glass, backdrop blur and glow as decoration. | `slop` gradient, glass |
| V4 | Eyebrows/kickers above headings, section numbers (`01`), decorative status dots, decorative grid lines and crosshairs. | review |
| V5 | Identical icon + heading + text card grids as page structure; cards inside cards. | review |
| V6 | CSS filters, blend modes or recolouring on figures, maps and images. | `slop` image-filter |
| V7 | Coloured side stripes (`border-left`/`border-right` ≥ 2 px) on cards, rows, callouts or alerts. | `slop` side-stripe |
| V8 | A missing brand font face: Pretendard must be declared with `@font-face` in `globals.css`. | `slop` fontFace |
| V9 | Em dashes and en dashes as separators in visible copy; middle dots at most one per line. | review (copy validator warns on em-dash cadence) |

## 12. Visual review checklist

With screenshots in Korean, light and dark, at 1440×900 and 1280×800:

1. One task and one filled primary action per view, visible without scrolling (P2, L7, B1).
2. First view within the budget; ≤ 2 paragraphs before the first action (W5).
3. Functional layer and content layer distinct; header has a title, at most one line and ≤ 3 actions (L3, B4, N4).
4. Detail, limits and technical information behind disclosures (P3, F6, R2); nothing from section 10 visible.
5. Setup flows: one question per step (Workflow start: one page per analysis stage, ≤ 7 list entries), recommended first with its reason, 기타, Previous/Next, summary (Q1–Q5).
6. Maps: legend and basic information beside the map without page scroll; feature popup (MAP1–MAP3).
7. Tables: sort and filter per column, ≤ 8 columns, state line, 결측값 (X1–X4).
8. Colour roles only; status has text or icon; contrast passes in both themes; greyscale check (S1–S4).
9. Identity: the mark once; blue only as signal; Pretendard; the orbit only while work runs; checked in 계측 and 도폭,
   light and dark (I1–I15).
10. Keyboard path through the change; focus ring visible; names on icon buttons (A1–A3).

## 13. Where GAID differs from One UI and HIG

| Source says | GAID does | Why |
|---|---|---|
| OneUI: viewing area on top, controls in the lower thumb zone; centred large titles | Leading-aligned compact headers; controls next to what they change; nothing critical at the bottom (L8) | Desktop mouse and keyboard; HIG macOS bottom-edge rule |
| OneUI: choice dialogs at the bottom of the screen | Centred sheets and alerts; popovers at the trigger | Desktop convention (HIG Sheets, Popovers) |
| OneUI: confirmations phrased as questions | Statement titles and action buttons; only a yes/no dialog body asks | GAID copy rule (gaid-writing.md) |
| OneUI: motion up to 500 ms, lively and 3D animation | ≤ 300 ms, functional motion, one loop (the orbit) | Repeated use in a research tool; HIG Motion "frequent interactions" |
| OneUI: one button style per screen; flat buttons in dialogs | One filled primary per view, bordered and plain for the rest (B1) | A clear default action in desktop sheets (HIG Buttons) |
| HIG: Liquid Glass for the functional layer; blur and vibrancy | Opaque chrome tone and hairlines; no glass or blur (V3) | Apple-proprietary material; legibility over maps and figures; GAID slop ban |
| HIG: system fonts (SF Pro, New York) and SF Symbols | Pretendard (the logo's lettering) and lucide icons (ISC, already a project dependency) at 16 px with a 1.75 px stroke | No proprietary fonts or symbols; brand continuity |
| HIG: macOS body 13 pt, minimum 10 pt | Body 15 px, minimum 12 px | Korean glyph density; the user's remark on small type |
| HIG: avoid app-specific appearance settings | Follow the system by default; an override in Settings only (S5) | Browsers may not reflect the researcher's preference; no header theme switch |
| HIG: menu bar for every command | Commands in toolbars, `더 보기` menus and the command palette (`⌘K`) | Web app in a browser window has no app menu bar |
| HIG and OneUI: system blue accents and colours | The GAID brand blue as the only signal (I2) | Brand; no platform colours |
| OneUI: toast up to 3 lines; list main text ≤ 31 characters | Toast ≤ 2 lines; 30 Korean / 60 English characters | Korean strings wrap sooner at desktop widths |

## 14. Source pages

Apple HIG (read 2026-10-22; JSON data from `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`):
design-principles, designing-for-macos, designing-for-ipados, layout, color, dark-mode, materials, typography, motion,
writing, accessibility, branding, icons, images, inclusion, charting-data, drag-and-drop, entering-data, feedback,
file-management, loading, modality, multitasking, offering-help, onboarding, searching, settings, undo-and-redo,
collaboration-and-sharing, managing-notifications, charts, collections, disclosure-controls, labels, lists-and-tables,
outline-views, split-views, tab-views, buttons, context-menus, menus, pop-up-buttons, pull-down-buttons, toolbars,
the-menu-bar, path-controls, search-fields, sidebars, tab-bars, token-fields, alerts, panels, popovers, scroll-views,
sheets, windows, combo-boxes, pickers, segmented-controls, sliders, steppers, text-fields, toggles, gauges,
progress-indicators, text-views, web-views, image-views. Korean landing page:
https://developer.apple.com/kr/design/human-interface-guidelines/

Samsung One UI (read 2026-10-16): the pages listed in guide v1 section 12 (overview, structure, layout, components, colour,
motion, writing, accessibility, large screen and foldable).
