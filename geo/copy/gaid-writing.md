# GAID UI copy guideline v1 (Korean first, English second)

Source: docs/specs/geo-byok-plan.md section 4.5 (revised 2026-10-11 after the user's review), with the enforcement
rules of 4.6. This file is the copy reference for every GeoAIDesk surface: the app (fork `kigam-research/geoaidesk`)
and the C site (skill_hub `web/content/site/`). Companion files in this directory:

| File | Role |
|---|---|
| `terminology.csv` | Glossary: Korean name, English name, definition, forbidden variants (`|`-separated), note |
| `copy-policy.json` | Machine rules: blocked (error), allowed after context review (warning), protected wording, roles by id |
| `validate-copy.mjs` | Dependency-free Node validator for `{ko,en}.json` catalogues; `scripts/check` runs it |
| `approved/{ko,en}.json` | User-approved hero, install-step, general limit/review and run-state strings |
| `agent-prompt.md` | The prompt block for the fork's AGENTS.md and every UI package goal |
| `briefs.md` | impeccable `shape`/`clarify` briefs for the hero, install page and the QC result state |

Principle: copy states what the screen does, the current state, and the evidence. The rules below are GAID's editorial
choices; they are not claims about how AI text can be detected (research q3 §2.1). AI-detector scores are not a quality
measure and are not used to approve copy.

## Voice and sentence forms

- Descriptions in 합니다체; instructions in 하세요체; labels as short nouns (`실행 기록`, `좌표계`, `검층 QC`).
- Buttons: Korean object + action noun (`파일 열기`, `분석 실행`, `결과 저장`, `설치 안내`); English verb + object
  (`Open file`, `Run analysis`).
- Headings: the hero title names the product and its category, `GeoAIDesk: <category> for <audience>`
  (`GeoAIDesk: Geoscience 연구자를 위한 에이전틱 프레임워크`), with the product name as the highlighted phrase; plain
  names for sections (`지원 파일 형식`, `모델 연결`).
- Navigation items, tabs and field labels are nouns (`설정`, `지도`, `실행 기록`). Buttons that act name the object
  (`지도 열기`, `면적표 열기`, `결과 내보내기`, never a bare `열기`). Text links to another page end with the reading
  action (`작동 방식 보기 →`, `스킬 문서 읽기 →`).
- No question headlines or question CTAs in product copy; dialogs may ask only for a real yes/no decision and then
  name the action on both buttons (`프로젝트 삭제` / `취소`).
- English follows the same action, condition and limit as the Korean string; it is not a looser marketing variant.

## Product framing and Korean naturalness (user review, 2026-10-11)

User (verbatim): "hero.title, hero.titleHighlight 에서 "내 PC에서"를 강조해서는 안된다. 현재 사용자의 목적은 사용자의 조직인
KIGAM에서 지구과학 연구자의 연구 보조 플랫폼을 만드는 것이다. 이용자의 PC에서 사용하는 것은 방법론일 뿐이며, 강조하려는 것이
아니다. 그리고 Geoscience Data라는 것이 영어표현으로는 적절하지만 지구과학 자료라고 하면 AI Slop같은 뉘앙스이므로 한국어에서도
Geoscience 자료로 표현하는 방식이 더 자연스럽다. 즉, 기술 용어의 경우 혼용하는 것이 더 자연스러우며, 연구자들은 대부분 기술
영어용어에 익숙하므로 해당 관점에서 더 자연스럽게 수정할 수 있는 부분은 수정해야한다. hero.body 의 경우에도 특정 과업에만 치중된
서술이 아니라 현재 구현중인 플랫폼을 잘 드러낼 수 있는 명료한 문장으로 나타내야 한다. 그리고 영어 표현에서는 This라는 표현이
자연스럽지만, 한국어 번역에서 "이 컴퓨터"와 같이 "이" 라는 표현은 어색한 표현이다."

- **Framing.** GeoAIDesk is KIGAM's agentic framework for geoscience researchers (user, 2026-10-11: "플랫폼이 아닌
  프레임워크라고 하자." and the title form "GAID: Geoscience 연구자를 위한 에이전틱 프레임워크", written in a
  professional web-marketing register with the product name visible). Running on the user's PC
  with the user's own model is the method; it belongs on the install page and in the comparison table, not in the
  hero or its highlighted phrase. The hero body describes the platform as a whole, not one task.
- **Technical terms.** Write technical terms the way Korean researchers use them, usually in English inside Korean
  sentences: `Geoscience 자료` (not `지구과학 자료`), `Well log`, `curve`, `CRS`, `QC`, `out-of-range 후보`,
  `context 길이`, `upstream`, `unlabeled 셀`, `spatial block`, `spatial leakage`, `depth track`, `workflow`,
  `AI agent`. Keep established Korean terms and naturalised loanwords where researchers use them (`결측값`, `암상`,
  `추정`, `불확실성`, `프로젝트`, `코드`, `스킬`, `설치`). Capitalise an English term that starts a Korean sentence
  (`Well log curve의 …`). The glossary (`terminology.csv`) records the preferred form; the old forms are warnings.
- **No carried-over demonstratives.** English `this`/`that` is natural; Korean `이`/`그` before a noun usually is not.
  Drop it or name the thing: `이 컴퓨터 준비` → `설치 환경 준비`, `이 조합은` → `선택한 조합은`, `그 모델 제공사` →
  `해당 모델 제공사`, `이 값은 추정값입니다` → `추정값입니다`.

## Patterns not used in product copy

| # | Pattern | Do not write | Write | Validator rule (severity) |
|---|---|---|---|---|
| 1 | Fragment ending in a destination (`~로`, `~까지`, `~을 위한`) | `지구과학 자료를, 내 PC에서 검토 가능한 결과로.` | `GeoAIDesk: Geoscience 연구자를 위한 에이전틱 프레임워크` | `hero-destination-ending` (warning) |
| 2 | Rhetorical/question headline | `연구의 가능성을 넓힐 준비가 되셨나요?` | `설치 요구 사항` | `question-title` (error), `empty-capability` (error) |
| 3 | Empty capability verbs | `Unlock insights`, `Empower your research` | `Export the results as CSV` | `empty-capability` (error) |
| 4 | Unproven ease/speed | `한 번에`, `손쉽게`, `5분이면` | the actual step count or tested time with conditions | `unproven-ease` (warning) |
| 5 | Adjectives instead of function | `혁신적인`, `스마트한`, `강력한`, `차세대`, `직관적인` | supported formats, actions, outputs, limits | `hype-adjective` (error) |
| 6 | "Not just X but Y" contrast | `단순한 도구가 아닌 연구 파트너` | what the tool does and does not do | `not-just-contrast` (error) |
| 7 | Triads for rhythm, em-dash cadence | `빠르게. 정확하게. 스마트하게.` | the real list, or delete | `triad-rhythm`, `em-dash-cadence` (warning) |
| 8 | Translationese / nominalisation | `확인하는 것이 가능합니다`, `검토를 수행합니다` | `확인합니다`, `검토합니다` | `translationese` (error / warning) |
| 9 | Experience CTAs | `새로운 분석을 경험해 보세요` | `작업 예제 보기` | `experience-cta` (error) |
| 10 | Celebration and emoji | `분석이 완벽하게 완료되었어요 🎉` | `QC 실행이 끝났습니다. 결과 파일을 확인하세요.` | `emoji`, `hype-adjective` (error), `haeyo-voice`, `exclamation` (warning) |

Further checks: `demonstrative-this` (warning; `이 컴퓨터`, `이 조합`), `launch-cta` (error; `시작하기`, `Get started`, `Launch app` suggest the app runs without installation),
`bare-cta` (warning), `merged-verified` (warning; `검증됨`), `question-copy` (warning outside dialogs), `terminology`
(warning; glossary variants), `limit-marker-missing` (error; a `*.limit` string lost its limit wording).

## State templates

Approved only when the state and action really exist.

| State | Korean | English |
|---|---|---|
| Empty project | `파일이 없습니다. 분석할 파일을 추가하세요.` | `No files yet. Add a file to analyze.` |
| No search results | `조건에 맞는 파일이 없습니다. 검색어나 필터를 바꾸세요.` | `No files match. Change the search term or filters.` |
| No model | `모델이 연결되지 않았습니다. 연결 방식을 선택하세요.` | `No model is connected. Choose a connection method.` |
| Loading | `{name} 파일을 읽는 중입니다.` | `Reading {name}.` |
| Missing CRS | `CRS 정보가 없습니다. 원본 자료의 CRS를 지정하세요.` | `The coordinate reference system is missing. Set the source CRS.` |
| Connection error (cause unknown) | `모델에 연결하지 못했습니다. 연결 설정을 확인한 뒤 다시 시도하세요.` | `Could not connect to the model. Check the connection settings and try again.` |
| Run finished | `분석 실행이 끝났습니다. 결과 파일을 확인하세요.` | `The analysis run is complete. Open the output files.` |
| Review pending | `결과는 검토 전입니다. 해석에 쓰기 전에 입력 자료와 실행 코드를 확인하세요.` | `The results have not been reviewed. Check the input data and code before using them in an interpretation.` |
| Install step | `터미널에서 아래 명령을 실행하세요.` + the tested command + what to check | `Run the command below in a terminal.` + command + check |

Shared catalogues (`common/`, `approved/`) hold general system states and guidance only. A limit that belongs to
one research case or method (for example out-of-range candidates in well-log QC, unlabeled cells in PU modelling,
spatial blocks in evaluation) is written in that skill's or workflow's own catalogue by the package that builds it,
following this guide; the validator fixtures keep such examples (user review 2026-10-11: "일반적인 시스템 상태나 안내가
표시되면 되는 것이 아닌가? 지엽적인 연구 케이스에 대한 것들이 포함되어야 하는 것인가?").

Errors follow observed problem → confirmed cause (only when known) → recovery action. Execution state and review state
are separate fields: `실행 완료` means the program finished; `검토 완료` needs a recorded review. Install tested, model
connected, file produced, numbers compared and geoscience interpretation reviewed are never merged into one "검증됨"
badge. Progress bars show numbers only when progress is measured.

## Term list levels

| Level | Terms | In `copy-policy.json` |
|---|---|---|
| Blocked in product copy | 혁신적인, 차세대, 스마트한, 완벽한, 무한한 가능성, 경험해 보세요, 지금 만나보세요, unlock, supercharge, game-changing, seamless/empower (as promotion) | `severity: error` rules |
| Allowed after context review | 한 번에, 손쉽게, 자동으로, 빠르게, 검증된, `~로` hero endings, repeated em dashes | `severity: warning` rules |
| Never removed by the linter | 추정, 불확실성, 검토 전, 미시험, 조건에 따라, capability statements `~할 수 있습니다`, user data, citations, research questions, commands, code | `protected`, `scope.exemptIds`, inline code |

`한 번에` is fine when it really means one action, and `자동으로` when the automatic step is implemented; a warning asks
for that check, it does not ask for deletion. Changing a fact or a limit to make a warning disappear is a failure.

## Numbers, units and terms

SI spacing (`125 m`, `12.3 %`), units on every axis, legend and table header; MD/TVD and CRS kept as in the source with
display conversions labelled; missing values never shown as 0. Keep `SKILL.md`, `GeoTIFF`, `GeoPackage`, `CRS`, `LAS`,
file extensions, commands and paths untranslated. Scientific precision is set per quantity, not left to
`Intl.NumberFormat` defaults. The glossary is `terminology.csv`.

## Catalogues and ids

- Strings live in catalogues, never inline in JSX: app `web/src/geo/locales/{ko,en}.json` (fork), site
  `web/content/site/<page>/{ko,en}.json` (skill_hub; `common/` for navigation, footer and shared states), read through
  `web/src/lib/site-catalog.ts`.
- Values are ICU messages (`{name}`, `{count, plural, one {…} other {…}}`, `{kind, select, …}`). Complete messages only;
  never concatenate fragments. Ko and en carry the same ids and the same arguments.
- Ids name context and state (`workspace.file.open`, `analysis.run.completed`, `analysis.review.pending`). The id
  suffix gives the role the validator checks:

| Id pattern | Role | Checked for |
|---|---|---|
| `hero.*`, `*.hero.*` | hero | destination fragments, questions |
| `*.title`, `*.heading`, `*.h1`, `*.h2` | title | questions |
| `*.cta`, `*.button`, `*.action` (and `.…` below them) | button | questions, launch wording, bare verbs |
| `limit.*`, `*.limit` | scientific limit | must keep a limit word (추정, 검토 전, 미시험, 않습니다, not, untested, …) |
| `*.dialog.*`, `*.confirm.*` | dialog | yes/no question allowed |
| `*.command`, `*.code`, `*.path`, `*.citation`, `*.userData`, `*.question` | exempt | not linted |

Text inside backticks is not linted either.

## Running the validator

```bash
node design/copy/validate-copy.mjs web/content/site design/copy/approved   # skill_hub (scripts/check runs this)
node design/copy/validate-copy.mjs web/src/geo/locales                     # fork, from the exported bundle
node --test design/copy/validate-copy.test.mjs                             # fixtures and rule tests
```

Errors fail the check; warnings are printed for the author and the reviewer (`--strict` turns them into failures).

## Review

Copy changes appear as catalogue diffs with the screen state; the validator runs; the user (or a named reviewer)
approves hero, install and limit strings. Usability evidence comes from the human walkthrough (spec 8.2), not from an
"AI-likeness" score.

## Approved strings

`approved/{ko,en}.json` holds the hero, install-step, general limit/review and run-state strings. Status: **approved by the
user on 2026-10-11** (verbatim: "승인하겠다.") after four review rounds in the gaid-design-copy writer tab (the
framing, terminology and generalisation decisions above). Changing an approved string needs the user's approval again. WP08 copies the hero and
install ids into its page catalogues; WP07 uses the limit and result strings in the app. Strings with variables
(`{date}`, `{version}`, `{dataset}`) are filled only from recorded test or run facts.
