# GAID UI/UX guide v1

Status: structure, rules and default values approved by the user on 2026-10-16 ("승인한다."); before/after screens and visual review in gaid-ui-guide. Machine-readable values: `geo/ui/ui-rules.json`. Checks:
`node geo/ui/check-ui.mjs` (run by `scripts/check`). Copy voice and wording stay in `geo/copy/gaid-writing.md` and
`geo/copy/terminology.csv`; colours, fonts, radius and motion tokens stay in `geo/copy/gaid-app.css` (vendored WP00
kit). This guide decides layout, density, components, states and what a researcher sees.

User request (2026-10-16, verbatim): "현재 gaid ui/ux 시스템과 관련하여 https://developer.samsung.com/one-ui 를 적극 참고하여
ui/ux 가이드를 개선하자. 현재는 에이전트가 스스로 판단하여 개발하였지만 이제부터는 올바른 가이드를 기반으로 해서 시스템을 구축하게
하고 싶다."

Earlier user requirements this guide carries (verbatim):
- "항상 새로운 시스템을 이용자는 너무 많은 정보량이 플랫폼이나 시스템에서 제공되면 역치를 넘어서지 못하고 포기하거나 유입에서
  빠져나올 수 있는 점을 고려하고 UI/UX에서도 너무 많은 글자 수자 정보량이 보이는 것은 유의해야한다."
- "사람 이용자들이 읽어야 하는 글자량이 너무 많으며, 스크롤이 한없이 아래로 내려가게 되어 있어 불친절하고 처음 사용자의 유입을
  떨어뜨리게 한다. 그리고 가급적 현재 사용자가 에이전트 작업하는 방식처럼 질문에 대해서는 권장 옵션을 포함한 선택지가 제공되어야
  하고, ... 기타 입력란을 제공하는 방식으로 하고 한번에 한 개의 질문을 하며, 질문은 탭으로 이전/다음으로 이동할 수 있게 ...
  흐름도 및 명료한 설명으로 인지부하를 낮추면서도 의도가 잘 반영될 수 있게"
- Map panels: legend and basic information beside the map without scrolling; attribute tables with column filter and
  sort; feature information as a map popup. Agent-internal details (model names, run logs, raw errors) are not shown
  to researchers.

Source basis: Samsung One UI design guidelines (https://developer.samsung.com/one-ui/index.html, read 2026-10-16; the
pages show no version number). GAID adapts principles only. It does not copy Samsung assets, images, icons or the
proprietary One UI Sans font, and it does not use Samsung colours. Each rule names the One UI page and section it
adapts; section 11 lists where GAID deliberately differs.

## How agents use this guide

1. Before any change to visible UI, read sections 1 and 9 and the sections for the components you touch.
2. In the change report, list the rule ids the change follows (for example `P1 Q1–Q5 R1`) and any rule it breaks,
   with the reason. Accepted debt goes in `geo/ui/ui-baseline.json` only with that reason.
3. Visual review (changes to layout, density, components or states; a pure wording change needs none): screenshot the
   changed screen in Korean at 1440×900 and at 1280×800, check it against the checklist in section 10, and attach the
   screenshots to the report.
4. Run `node geo/ui/check-ui.mjs` (part of `scripts/check`).

Rule ids: P principles, L layout, T type, S colour and states, B buttons, N navigation and tabs, D dialogs and
popovers, Q questions, G lists and cards, X tables, MAP map panels, F feedback (progress, toasts, empty and error
states), M motion, A accessibility, W copy length and density, R what researchers never see.

## 1. Principles

| Id | Rule | One UI source |
|---|---|---|
| P1 | **One task per screen.** Each screen or dialog serves one task with one primary action. A second task opens in its own view; it is not stacked under the first. | Overview "Focus on the task at hand"; Writing / Focused and purposeful "Make a choice" |
| P2 | **Viewing area, then interaction area.** Every view has a short header zone (title, current state, at most one line of context) and a work zone where the controls sit next to the content they change. Actions are grouped in one place per view, in a logical order. | Layout / Basic layout "Viewing area", "Interaction area" |
| P3 | **Show less first.** The first view shows what the researcher needs to decide or act. Explanations, limits detail, provenance and technical information move behind a disclosure, a popover or the next step. A first view stays within the density budget (W5). | Writing / Focused and purposeful (text must help choose, act or understand, otherwise leave it out); Writing / Empowering "Entice users to explore" |
| P4 | **Stay in context.** Short inputs and details open next to what triggered them (popover, side panel), not as a new page. Lists and their detail sit side by side on wide windows. | Large screen / Designing for large screens "Get things done without leaving the screen", "Multi-pane layout"; Layout design for large screens "Avoid switching context" |
| P5 | **Visibly comfortable.** Calm neutral surfaces, one accent colour, readable contrast, text that scales to 200%. | Overview "Be visibly comfortable"; Color / Theme; Accessibility / Color and contrast |
| P6 | **Researchers see research, not machinery.** Screens describe data, methods, results, states and next actions in research terms. Agent internals stay out of researcher views (section 9). | Writing / Simple and human "Show benefits and possibilities" (skip behind-the-scenes technical detail) |

## 2. Layout and spacing

| Id | Rule | One UI source |
|---|---|---|
| L1 | **Desktop window classes.** Design for 1280–1920 px wide windows; 1024 px is the minimum that must work without horizontal page scroll. Narrow windows (~390 px) are unsupported for the workspace (`geo/compatibility.json`). | Large screen / Layout design "Windows size classes" (Expanded ≥ 840 dp is the desktop baseline) |
| L2 | **Panes.** The workspace is sidebar + main + optional side panel. List/detail views use two panes with roughly 38:62 width from 960 px; side panels are 280–400 px (default 320 px); the app header is 56 px; reading-width content (forms, documents) is at most 960 px wide. Never stretch one text column across a wide window: body text keeps a readable measure (T4). | Large screen / Designing for large screens "Multi-pane layout" (42:58 at 600–960 dp, 38:62 from 960 dp) |
| L3 | **Navigation stays visible** next to content on desktop widths (sidebar, tabs); do not hide it behind a menu button. | Large screen / Layout design "Show menus together with content"; Designing for large screens "Make navigation controls fit the screen" |
| L4 | **Spacing scale.** 4 px unit; use 4, 8, 12, 16, 24, 32, 48 px (Tailwind `1 2 3 4 6 8 12`). Inside a control or row: 4–8. Between related items: 8–12. Between groups/sections: 16–24. Page and panel inset: at least 16 px, 24 px for main content areas. | Layout / Grid system "Keyline and margin" (24 dp minimum side margin). The 4 px unit and scale are GAID's; One UI states no base grid |
| L5 | **Group into focus blocks.** Related content goes in one card or grouped list with a short subheader; use few block types per screen. Text-only cards when the content is more than three lines. | Layout / Basic layout "Focus block" |
| L6 | **Keep the first action visible.** The primary action of a view is visible at 1280×800 without scrolling. Long content scrolls inside its own region (list, table, panel), with header and actions fixed. Dialogs are at most 85% of the viewport height with a fixed footer. | Layout / Basic layout "Interaction area"; Large screen "Keep things reachable" |
| L7 | **Continuity.** Resizing, collapsing a panel or switching tabs keeps scroll position, selection and unsent input. | Large screen / Designing for foldables "App continuity and responsive layouts"; App bar (state restored on return) |

## 3. Typography

Font: Pretendard (open licence) as set in `gaid-app.css`; D2Coding for code and paths. GAID does not use One UI Sans.

| Id | Rule | One UI source |
|---|---|---|
| T1 | **Scale.** Caption 12 px, body 14 px (`--gaid-body-size`), subtitle 16 px (`--gaid-h2-size`), title 20 px (`--gaid-h1-size`). Weights 400 body, 500 emphasis, 600 headings (`--gaid-heading-weight`). Nothing below 12 px; no `text-[10px]`/`text-[11px]`. | One UI states no type scale; the scale is GAID's WP00 token set. Accessibility / Layout and typography "Scalable text" |
| T2 | **One title per view**, then subtitles for sections. Do not use more than three sizes in one view. | Layout / Basic layout "Typography for spatial design" (text recognisable at a glance); the three-size limit is GAID's |
| T3 | **Line height** 1.5 for body, 1.3 for headings. Korean uses `word-break: keep-all` (already global). | — (GAID) |
| T4 | **Measure.** Body text blocks are at most ~40 Korean characters or ~75 Latin characters per line (about 640 px at 14 px). | Large screen "Multi-pane layout" (stretched single columns are hard to read) |
| T5 | **Numbers** in tables, coordinates and statistics use tabular figures (`table, .gaid-numeric`). | — (GAID) |
| T6 | **Text scales to 200%** (browser zoom) without lost content or overlapping controls; long labels wrap or truncate with a tooltip, never clip silently. | Accessibility / Layout and typography "Scalable text", "Large text layout" |

## 4. Colour and states

Colours come from `gaid-app.css` by role; components never hard-code hex values (`check-ui.mjs` styles check). Data
palettes for maps and depth tracks are the exception (`ui-rules.json` `styles.hexAllowFiles`).

| Id | Rule | One UI source |
|---|---|---|
| S1 | **Roles.** Text `--foreground`; secondary text `--muted-foreground`; surfaces `--background`/`--muted`; action `--primary` (hover `--gaid-brand-hover`); focus `--ring`; borders `--border`; meaning `--gaid-success`, `--gaid-warning`, `--gaid-danger`, `--gaid-untested`, `--gaid-nodata`. | Color / Color system "Basic system color", "Informative color" |
| S2 | **Calm large areas, colour on small areas.** Backgrounds and cards stay neutral; the accent marks the primary action, the selection and focus. No gradients in work areas. Use at most one coloured status badge per row. | Color / Color system "Background color" (calm colours for large areas, bright ones only for small areas), "Focus block color" |
| S3 | **Meaning never by colour alone.** Every status colour has a text label or icon; check the screen in greyscale. Status colours keep the same meaning in light and dark themes. | Accessibility / Color and contrast "Use of color"; Color system "Informative color" |
| S4 | **Contrast.** Text ≥ 4.5:1, large text (≥ 24 px, or ≥ 18.7 px bold) ≥ 3:1, control boundaries and focus rings ≥ 3:1. | Accessibility / Color and contrast "Minimum contrast ratio" (thresholds expressed in WCAG CSS px, not dp) |
| S5 | **States.** Every interactive element has default, hover, focus-visible (2 px `--ring`), pressed/selected, disabled. A disabled primary action shows why it is disabled next to it (one line). Loading replaces the label with progress text, keeps the width. | Accessibility / Screen reader (status is part of every element); Interaction and control |
| S6 | **Dark mode** is checked before release for any screen that shows images or maps; map basemaps may stay light. | Color / Theme |

## 5. Components

### Buttons (B)

| Id | Rule | One UI source |
|---|---|---|
| B1 | Three emphasis levels: filled primary (high), outline/secondary (medium), ghost/text (low). **One filled primary per view**; dialogs and toolbars use medium/low except their one primary. | Components / Buttons (flat, contained gray, contained colour; one style per screen; flat inside dialogs and toolbars) |
| B2 | Height 32 px (`--gaid-button-height`), radius `--radius-md`, icon 16 px. Icon-only buttons have a tooltip and an accessible name. Adjacent targets keep ≥ 8 px gap. | Buttons; Toasts "Label toast (Tool tip)"; Accessibility / Layout and typography "Touch target spacing" |
| B3 | Labels name the next action: Korean object + action (`결과 저장`), English verb + object (`Save result`); never a bare `열기`/`확인` (gaid-writing.md). | Writing / Focused and purposeful "Take an action" |
| B4 | A view header carries at most **3 actions**; the rest go in a "더 보기" (More) menu, where on/off items show a checkbox. | Components / App bar "Action button", "More option" |
| B5 | Order: primary action last (right) in a button row; destructive actions use `--destructive` and are never the default focus. | Dialog (choice/confirmation) |

### Navigation and tabs (N)

| Id | Rule | One UI source |
|---|---|---|
| N1 | Tabs are text labels (noun), ideally 3 or fewer and never more than 5 in one tab bar; more destinations go in the sidebar or a list. Open-file tabs in the workspace are documents, not navigation, and are not limited by N1. | Components / Bottom navigation (fewer than 4 tabs, at most 5 if necessary, text only) |
| N2 | Switching tabs never loses input (L7). Selected tab is announced as "Tab n of m" (`role="tab"`, `aria-selected`). | Accessibility / Screen reader announcement table |
| N3 | A contextual selection bar appears only after multi-select, holds 2–5 actions with icon + text, and overflows into More after four. | Components / Bottom bar |

### Dialogs and popovers (D)

| Id | Rule | One UI source |
|---|---|---|
| D1 | **Use a modal dialog only to** enter required data, confirm a destructive or irreversible action, get consent to send data outside the PC, or show information the researcher must read before continuing. Everything else uses a popover, side panel, inline message or toast. | Writing / Simple and human "Only interrupt for important things"; Components / Dialog |
| D2 | A dialog has a title (statement, not a question), at most two short paragraphs, and at most **3 actions** (footer task buttons such as 취소 / 이전 단계 / 다음 단계; step tabs, option rows, disclosures and the close button do not count). Sizes 400/560/720 px. It closes by its actions, Escape or the close button; destructive confirmations do not close on outside click. | Dialog (purpose, dismissal); the 3-action cap is GAID's, extended from App bar "Action button" (≤ 3 per page). One UI states no dialog button count |
| D3 | **One overlay level.** Never open a dialog over a dialog. Modal = dim backdrop; related overlays (popover, side sheet, map popup) = light shadow, no dim. Never dim and shadow together. | Structure / Visual depth |
| D4 | Popovers open next to their trigger, hold one small task or one record, and close with Escape, outside click or a close button; focus returns to the trigger. | Large screen "Get things done without leaving the screen" |
| D5 | Context menus are untitled lists opened by right-click or a ⋯ button; every item also exists in visible UI or the More menu. | Components / Dialog (context menu) |

### Questions and option pickers (Q)

The pattern for any multi-field setup (workflow start, recipe import, method trial, interview questions). One UI has no
picker or stepper component page; Q1–Q6 apply its Writing principles and the user's requirement.

| Id | Rule | One UI source |
|---|---|---|
| Q1 | **One question per step.** A setup with more than two decisions becomes a stepper: one question, its options, a one-line reason why it matters. | Writing / Focused and purposeful "Make a choice" (one choice and one task at a time, even if it adds steps) |
| Q2 | **Options, recommended first.** Offer 2–5 options as selectable rows (radio cards). Mark an option `권장` only when the method, catalogue or the researcher's data gives a reason, and show that reason in one line; the recommended option is first and pre-selected. A scientific parameter without such a source gets no pre-selection. A question with only one real option shows it as a fact, not as `권장`. Other options state their trade-off in one line. | Writing / Focused and purposeful "Understand what's happening" (benefits and trade-offs) |
| Q3 | **기타 input.** The last option is `기타 (직접 입력)` with a text field, so the researcher is never forced into a listed answer; for a file input it opens the project file list or file chooser, not a path field. "Decide later" is allowed only where the method allows it, as its own option. | Writing / Empowering "Provide help, not limits" |
| Q4 | **Move with tabs and Previous/Next.** A step indicator (tabs or a numbered rail with short step names) shows where the researcher is and lets them go back; Previous/Next buttons sit at the bottom right; Next is disabled with a one-line reason until the step is valid. Answers persist when moving between steps. Readiness blockers (missing skills, environment) appear on the first step with the action that fixes them (`필요한 스킬 켜기`), not only beside the final action. A setup opened from a recipe or an earlier run starts at the summary step. | Components / Bottom navigation (tabs, no swipe-only switching); Accessibility / Focus order |
| Q5 | **Flow first, summary last.** The workflow is shown as one short flow (3–6 named stages, e.g. 입력 → 확인 → 분석 → 결과) instead of a paragraph. Show one sequence only: when the step tabs are the flow, they carry the stage names; a separate analysis flow on the first step uses the same words as the steps and results. The last step is a summary of all answers with Edit links and the one primary action. | Motion / Motion basics "Transitions harmonized with logical spatial structure"; Writing "Take an action" |
| Q6 | Free-text questions say what a good answer contains in the placeholder or a one-line hint, not a paragraph. | Accessibility / Interaction and control (describe input fields) |

### Lists and cards (G)

| Id | Rule | One UI source |
|---|---|---|
| G1 | List row title ≤ 30 Korean / 60 English characters on one line (noun or short verb phrase); one line of secondary text at most; details open on click (detail pane or popover). | Components / Lists "Main text" (≤ 31 characters; subtext on the detail page) |
| G2 | Toggles sit at the right of the row; status badges at most 3 per row (W5), short nouns, each with a tooltip saying what it means. The researcher's own assessment (`수정 필요`) is shown as an assessment line, not as a badge next to package properties. | Lists; Layout / Basic layout "Text + Controller" |
| G3 | Long lists get search with recent and suggested entries when empty, and subheaders for groups ordered by use. | Components / Search; Lists "Subheader" |
| G4 | Cards in a grid show title, one line of description (clamped) and at most one action; the rest is in the detail view. | Layout / Basic layout "Multiple card type" |

### Tables (X)

| Id | Rule | One UI source |
|---|---|---|
| X1 | Sticky header; each column header has sort and filter; numbers right-aligned with tabular figures; units in the header, not in every cell. | Lists (scan and search); T5 |
| X2 | Show ≤ 8 columns by default; other columns are chosen from a column menu. Wide tables scroll inside their own region. | Large screen "Adjust grids for large screens" (no column numbers); 8 is the user-approved GAID default |
| X3 | Selecting a row opens its record in a popover or the side panel (D4); it does not navigate away. | Large screen "Avoid switching context" |
| X4 | Above the table, one line of state: `조건에 맞는 행 133 / 전체 133`. Explanations of filtering scope go in a tooltip. | P3 |

### Map side panels and popups (MAP)

| Id | Rule | One UI source |
|---|---|---|
| MAP1 | Map + side panel (320 px) side by side from 1024 px; the panel holds, in order, **레이어**, **범례**, **기본 정보**; legend and basic information are visible without scrolling the page at 1280×800 (the panel may scroll inside). The legend uses the panel's free height; when it still cannot show every class it shows the count (`범례 14개`) and a `모두 보기` control, never a silently clipped list. | Large screen "Multi-pane layout", "Show menus together with content" |
| MAP2 | Basic information shows at most 5 rows (source file name, CRS, unit, feature or pixel count, extent on demand). A CRS is named by name and authority code when known (`Korea 2000 / Central Belt (EPSG:5186)`); a projection method alone (`Transverse_Mercator`) is labelled as such (`투영법만 기록됨`). Sampling method, tile details and display-only notes go behind `자세히` or a tooltip. | P3; Writing / Simple and human "Show benefits" |
| MAP3 | Clicking a feature or pixel opens a map popup next to the point: title (layer + feature id), up to 8 attribute rows with readable labels, `모든 속성 보기` to open the full record in the attribute table. Missing values show `결측값` in `--gaid-nodata`, not raw codes. | Large screen "Get things done without leaving the screen"; Visual depth (shadow, no dim) |
| MAP4 | Map toolbar: at most 3 visible actions (B4). Display CRS and basemap are one compact control group above the map, each with a short label; the network note for online basemaps appears only when an online basemap is chosen. Overlays such as the KIGAM 1:5만 지질도 and `레이어 추가` stay one click away in the panel. | App bar "Action button"; Writing / Simple and human "Remove defensive text" |
| MAP6 | The map canvas shows a scale bar, cursor coordinates in the display CRS, zoom-to-layer, and a visible highlight on the selected feature. | — (GAID; desktop GIS convention) |
| MAP5 | The attribute table sits below the map in its own region (at least 6 rows visible, or a draggable map/table split) and follows X1–X4. | — |

### Feedback: progress, toasts, empty and error states (F)

| Id | Rule | One UI source |
|---|---|---|
| F1 | **Progress** names the current research step in plain words (`입력 확인 중`, `격자 표 만드는 중 2/5`), determinate when the count is known. No logs, tool names or command lines in progress text (R1). | One UI has no progress component rules (Dialog only places progress popups centrally); adapted from Motion basics "Real-time feedback response" and Writing "Understand what's happening" |
| F2 | **Toasts** confirm minor results in one line (≤ 40 Korean / 80 English characters; never more than two lines) and may carry one follow-up action (`되돌리기`). Errors that block work, data loss or anything that needs a choice is never only a toast. Toasts do not hide important information on a timer. | Components / Toasts ("about one line, never more than three"; snack bar); Accessibility / Interaction and control |
| F3 | **Empty states** say what is missing in one line and offer one primary action (`파일 올리기`), or a clear way back. | Writing / Focused and purposeful "Take an action" |
| F4 | **Error states** say what did not happen and what the researcher can do next, in research terms: `지도 자료를 읽지 못했습니다. 파일 형식을 확인한 뒤 다시 읽으세요.` Raw messages, codes and stack traces go only in a collapsed `기술 정보` disclosure with a copy button (R2). Focus moves to the fix after an error. | Writing / Simple and human "Remove defensive text"; Empowering "Provide help, not limits"; Accessibility / Interaction and control |
| F5 | Warnings appear when the condition occurs, next to what they concern; no blanket disclaimers above every view. Required limits (추정, 미시험, 검토 전) stay, in one line, with detail behind `자세히` (gaid-writing.md protected wording). The visible line is the most specific, decision-relevant limit (`Yilgarn Ni 사례에서만 검증했습니다.`), not a generic one. Disclosure labels say what they open (`해석 한계 보기`), not a bare `자세히` when several disclosures share a view. | Writing / Simple and human "Remove defensive text" |

## 6. Motion

| Id | Rule | One UI source |
|---|---|---|
| M1 | Durations `--gaid-motion-fast` (150 ms) for hover/press/small fades and `--gaid-motion-base` (200 ms) for popovers, panels and dialogs; nothing longer than 300 ms. | Motion / Motion basics "Duration" (100–500 ms) |
| M2 | Easing `--gaid-easing` (fast start, gentle settle) for movement; linear only for opacity; exits may use ease-in. | Motion basics "Speed type and attributes" |
| M3 | Motion explains a change (panel opening from its edge, popover from its trigger); no decorative or looping animation; running jobs may use one small animated status icon. `prefers-reduced-motion` disables transitions (already global). | Motion / Introduction; Motion basics "Lively animations" (icon animation) |
| M4 | When text changes in place, the old text disappears before the new text appears; no overlapping text cross-fades. | Motion basics "Non-interrupted motion and interaction" |

## 7. Accessibility

| Id | Rule | One UI source |
|---|---|---|
| A1 | Every control has an accessible name; state is exposed (`aria-checked`, `aria-expanded`, `aria-selected`, `aria-disabled`); decorative icons are `aria-hidden`. Names do not repeat the role ("결과 저장", not "결과 저장 버튼"). | Accessibility / Screen reader (status, name, type, hint; principles 1–2) |
| A2 | Keyboard: logical tab order, visible focus ring, no focus on decoration, related controls grouped as one stop where possible; focus stays where a repeatable action happened. | Accessibility / Focus order |
| A3 | Click targets at least 24×24 px with ≥ 8 px between adjacent targets. | Accessibility / Layout and typography "Touch target spacing" (8 dp from figure; One UI states no minimum size, so 24 px is WCAG 2.2 2.5.8) |
| A4 | Every drag action (layer order, file move) has a button or menu alternative. Nothing important auto-hides; moving content longer than 5 s has a pause control. | Accessibility / Interaction and control |
| A5 | Live regions announce results of actions (added/deleted, n selected, step changes, errors). Instructions name controls by label, not by colour or position ("`지도 PNG 저장`을 누르세요", not "오른쪽 위 버튼"). | Screen reader principle 6; Accessibility / Content |

## 8. Copy length and information density (W)

Voice, terminology and banned patterns: `geo/copy/gaid-writing.md`. This section adds limits. Limits count visible
characters (an ICU argument counts as 4); English limits are double the Korean ones.

| Id | Rule | Limit (ko / en) | One UI source |
|---|---|---|---|
| W1 | Buttons and actions | 16 / 32 | Buttons; Writing "Take an action" |
| W2 | Titles, headings, list row names | 30 / 60 | Lists "Main text" (≤ 31 characters) |
| W3 | Toasts and saved/copied notices | 40 / 80 | Toasts (about one line) |
| W4 | Any other single string (description, hint, message) | 140 / 280 | Writing / Focused and purposeful |
| W5 | **First-view budget** (a view = the focused surface: the open dialog, or the main work area of a tab, excluding app header, sidebar and tab bar): body text visible in a view before any interaction ≤ 300 / 600 characters, excluding data the researcher brought (file names, table values, map labels); at most 2 paragraphs before the first action; at most 3 badges per row. | per view | Writing / Focused and purposeful; Empowering "Entice users to explore" |
| W6 | One line of context under a title; longer explanation goes behind `자세히` (disclosure), a tooltip or documentation. Do not repeat the same limit sentence in several places of one view. One term per concept across screens (one name for the setup flow, its draft and its start action; check `geo/copy/terminology.csv`). | — | Writing / Simple and human |

W2–W4 are checked per string by `check-ui.mjs` (`copy-length`): a role applies only to locale ids that match its
pattern in `ui-rules.json` (W1 `*.button`, `*.cta`, `*.action`; W2 `*.title`, `*.heading`, `*.name`; W3 `*.toast`,
`*.saved`, `*.copied`); every other id gets the W4 limit. Existing catalogues have no `*.button` ids, so W1 is checked only
for new strings that follow this convention: key new button labels `<area>.<thing>.button` (or `.action`). W5–W6 are
checked in visual review.

One UI phrases confirmations as questions (Writing / Empowering "Engage users with questions"); GAID keeps its copy rule:
titles and buttons are statements and actions, and only a yes/no dialog body may ask (gaid-writing.md).

## 9. What researchers never see (R)

Researcher views are the workspace, chat, workflow and method screens, viewers, results, notebook, automation and
hub screens. Settings (the whole `settings.*` and `app.settings.*` namespaces), the model picker and the local model card
are configuration views where the model the researcher chose is content.

| Id | Rule |
|---|---|
| R1 | **No agent machinery in researcher views**: model or provider names (outside configuration views, the model picker and the R4 record view), session/chat/run/tool-call ids, token counts, prompts and system instructions, tool names and arguments, command lines, run logs, exit codes, internal state keys (`needs-environment`, `whole layer for display`), internal paths (`.kady/`, `.pi/`, cache directories), English enum values in Korean UI. |
| R2 | **Raw errors** (exception text, HTTP status, stack traces, stderr) appear only inside a collapsed `기술 정보` disclosure with a copy button; the visible message follows F4. Locale ids for that disclosure end in `.technical` (allowed by the check; `.details` is an ordinary id and is checked). |
| R3 | **Translate internal facts into research facts**: `도구 호출 42회 · 실패 10회` → `분석 단계 42개 중 10개를 다시 시도했습니다` only if that is true, otherwise leave it out; `채팅 ID` → a link `채팅 열기`; `revision 1` → `버전 1`. |
| R4 | Provenance, environment and trial records keep their full data, but the researcher view shows a summary (what was used, when, result) with the full record behind `기록 보기`. The record view is where a researcher cites a result: it shows the model used, read-only and copyable, and links to the chat (`채팅 열기`). Locale ids for that view end in `.record` and may name the model. |
| R5 | Costs: budget and spend appear only in the budget chip and project settings, never inside results or method screens. |

`check-ui.mjs` (`internals`) blocks locale strings outside configuration views that interpolate `{detail}`, `{error}`,
`{message}`, `{stderr}`, `{stack}`, `{model}`, `{models}` or internal ids, and literal "stack trace"/"traceback"/"stderr". Code
paths that show `error.message` directly, and strings using generic argument names (`{id}`, `{status}`, `{code}`,
`{tokens}`), are found in review, not by the check; the literal labels `채팅 ID`, `세션 ID`, `종료 코드` and `HTTP {status}` are
checked.

## 10. Visual review checklist

Use for every UI change (author) and every review (reviewer), with screenshots at 1440×900 and 1280×800, Korean.

1. One task, one primary action visible without scrolling (P1, L6, B1).
2. First view within the budget: count body characters; ≤ 2 paragraphs before the first action (W5).
3. Header zone has title + at most one line; actions grouped; ≤ 3 header actions (P2, B4).
4. Details, limits detail and technical information behind a disclosure or popover (P3, F5, R2).
5. Nothing from section 9 visible.
6. Setup flows: one question per step, recommended first, 기타 input, Previous/Next, summary (Q1–Q5).
7. Maps: legend and basic information beside the map without page scroll; popup for features (MAP1–MAP3).
8. Tables: sort/filter per column, ≤ 8 columns by default, state line (X1–X4).
9. Colour roles only, status has text, contrast, greyscale check (S1–S4).
10. Keyboard path through the change; focus ring visible; names on icon buttons (A1–A3).

## 11. Where GAID deliberately differs from One UI

| One UI | GAID | Why |
|---|---|---|
| Viewing area is the top third of a phone screen, centred large title, controls in the lower thumb zone (Basic layout) | Left-aligned compact header zone; controls next to the content they change | Desktop mouse/keyboard use; no thumb reach |
| Choice and confirmation dialogs at the bottom of the screen (Dialog) | Centred modal dialogs; popovers anchored to the trigger | Desktop convention; One UI's own large-screen guidance anchors popovers near the trigger |
| Bottom navigation and bottom bars | Sidebar, top tabs, selection bar above the list | Desktop layout (L3) |
| Confirmations phrased as questions (Writing / Empowering) | Statement titles; action-named buttons | GAID copy rule (gaid-writing.md), user-approved WP00 kit |
| Motion up to 500 ms; lively, 3D and decorative animation (Motion basics) | ≤ 300 ms, functional motion only | Research work tool; repeated use; reduced distraction |
| One button style per screen; flat buttons inside dialogs and toolbars (Buttons) | Mixed emphasis levels with exactly one filled primary per view, also in dialogs (B1) | Desktop dialogs need a clear default action; one primary keeps the focus rule |
| Samsung blue palette (#0072de, #3e91ff, #0381fe) and One UI Sans | GAID WP00 colours (`--primary` #1f5eff) and Pretendard | No Samsung assets or proprietary fonts; GAID brand kit |
| Button corner radius 18 dp (pill) in the Android sample | `--radius-md` (8 px) | GAID token set; dense desktop controls |
| Toast up to 3 lines | Toast ≤ 2 lines, prefer 1 | Korean strings wrap sooner at desktop toast width |
| List main text ≤ 31 characters (English) | 30 Korean / 60 English | Korean characters carry more meaning per character |
| No minimum target size stated | 24×24 px minimum (WCAG 2.2) | One UI gives only 8 dp spacing |
| Alternative gradients for backgrounds and focus blocks (Color system "Background color") | Neutral surfaces, no gradients in work areas (S2) | Data colours on maps and charts need a calm, neutral ground |
| Dark mode as a primary comfort feature | Light theme first (WP00 v1), dark mode checked for maps/images | WP00 tokens ship light mode only in v1 |

## 12. Source pages

All read on 2026-10-16. Digest with per-page notes (not in Git): `~/data/geoaidesk/work/gaid-ui-guide/oneui-notes.md`.
Independent cross-check (ChatGPT Pro web research, same date) agreed on the cited values and found no One UI type scale,
base grid, minimum target size, picker, progress or dialog button-count rules; the guide marks those as GAID's own.
Vault note: `웹 조사/geoaidesk/2026-10-16-i-am-writing-a-ui--0230c8af23.md`.

- Overview: https://developer.samsung.com/one-ui/index.html
- Structure / Visual depth: https://developer.samsung.com/one-ui/structure/visual-depth.html
- Layout / Basic layout: https://developer.samsung.com/one-ui/layout/basic.html
- Layout / Grid system: https://developer.samsung.com/one-ui/layout/grid.html
- Components / App bar: https://developer.samsung.com/one-ui/comp/app-bar.html
- Components / Bottom bar: https://developer.samsung.com/one-ui/comp/bottom-bar.html
- Components / Bottom navigation: https://developer.samsung.com/one-ui/comp/bottom-navigation.html
- Components / Buttons: https://developer.samsung.com/one-ui/comp/button.html
- Components / Dialog: https://developer.samsung.com/one-ui/comp/dialog.html
- Components / Lists: https://developer.samsung.com/one-ui/comp/list.html
- Components / Search: https://developer.samsung.com/one-ui/comp/search.html
- Components / Toasts: https://developer.samsung.com/one-ui/comp/toast.html
- Color / Color system: https://developer.samsung.com/one-ui/color/system.html
- Color / Theme: https://developer.samsung.com/one-ui/color/theme.html
- Motion / Introduction: https://developer.samsung.com/one-ui/motion/intro.html
- Motion / Motion basics: https://developer.samsung.com/one-ui/motion/basic.html
- Writing / Focused and purposeful: https://developer.samsung.com/one-ui/writing/focused-and-purposeful.html
- Writing / Simple and human: https://developer.samsung.com/one-ui/writing/simple-and-human.html
- Writing / Empowering and engaging: https://developer.samsung.com/one-ui/writing/empowering.html
- Accessibility (introduction, screen reader, focus order, colour and contrast, layout and typography, interaction and
  control, content): https://developer.samsung.com/one-ui/accessibility/intro.html and its sibling pages
- Large screen / Designing for large screens: https://developer.samsung.com/one-ui/largescreen-and-foldable/intro.html
- Large screen / Layout design: https://developer.samsung.com/one-ui/largescreen-and-foldable/large_screen_layout.html
- Large screen / Designing for foldables: https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html

Iconography pages (app launcher icons) and Sound & Haptic were read or skipped as not applicable; GAID uses lucide
icons at 16 px with consistent stroke weight.
