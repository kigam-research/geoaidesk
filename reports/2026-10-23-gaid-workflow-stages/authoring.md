# 분석 흐름 단계: Workflow 작성과 검사

하위 작업 gaid-stages-authoring의 결과입니다. 부모 작업이 전체 보고서에 합칩니다.

## 0. 한눈에

| | |
|---|---|
| 요청 | Workflow를 분석 흐름에 따라 3~5단계로 나누고, 꼭 정할 조건은 6개 이하로 줄이며, 기존 Workflow는 편집할 때 새 형식으로 바꾸게 합니다. |
| 결론 | 새 지침으로 포천 Workflow를 다시 만들었고 5단계, 꼭 정할 조건 4개, 입력 6개를 모두 단계에 연결했습니다. 기존 0.2.0(10단계, 기본값 없는 조건 15개)도 고치기 동작으로 5단계, 꼭 정할 조건 6개가 되었고, 처리 단계와 비교 조합은 빠지지 않았습니다. |
| 믿을 수 있는 정도 | 초안 형식 검사와 SKILL.md 대조까지 확인했습니다. 새 초안으로 분석을 실행해 보지는 않았습니다. |
| 결정할 일 | 없음 |

## 1. 요청한 것

> 워크플로우의 적정 단계로 최대 단계 수를 설정할 필요가 있으며, 하나의 단계에서 여러 자료를 입력 받을 수 있게 하면 단계수도 충분히 줄일 수 있다고 생각한다. 또한, 단계를 무분별하게 나누는 것이 아니라 데이터 분석 흐름 또는 연구 분석 흐름 절차에 맞게 나누어야 한다. 항목별로 나누면 워크플로우라기보다는 절차서가 되어버리고 더더욱 특정 과업에만 맞춘 워크플로우가 되버릴 수 있다.

이 하위 작업은 승인된 계획 가운데 작성과 검사 쪽(계획 2의 자료·검사 부분, 계획 3)을 맡았습니다. 시작 창 화면은 다른 하위 작업이 맡았습니다.

## 2. 수행한 것

1. 작성 지침을 바꿨습니다. AI agent는 Workflow를 자료 준비 → 처리·모델링 → 평가 → 해석·결과처럼 분석 흐름으로 나눕니다. 단계는 3~5개입니다. 입력 자료 하나나 조건 하나마다 단계를 만들지 않습니다. 각 단계에는 처음 쓰는 입력 자료와 조건을 적습니다. 같은 종류의 파일 여러 개(측선 여러 개, 시추공 묶음)는 입력 하나로 받습니다. 연구자가 시작할 때 꼭 정할 조건은 6개 이하입니다. 나머지 조건에는 기본값을 두고, 연구자는 시작 요약에서 그 값을 바꿀 수 있습니다. 논문 값을 기본값으로 쓰면 논문 값이라고 적습니다. 기본값이 결과를 바꿀 수 있으면 조건 설명에 그 사실을 적습니다. 방법 전체를 유지하는 기존 규칙(처리 단계, 자료 종류, 비교 조합, 해석 기준을 빼지 않음)은 그대로입니다.
2. 새로 받은 초안이 단계 기준에 맞지 않으면 한 번 고쳐 달라고 요청합니다. 고친 뒤에도 맞지 않으면 초안은 받아 두고 경고로 알립니다. 쓸 만한 초안을 버리지 않으려는 선택입니다.
3. 패키지·등록 검사에 단계 수, 꼭 정할 조건 수, 항목별 분할, 단계에 연결되지 않은 입력을 연구자 문장으로 알리는 참고 사항을 추가했습니다. 오류가 아니므로 이전에 만든 초안도 그대로 패키지로 만들고 등록할 수 있습니다.
4. 허브의 초안 화면과 등록 미리보기에 "Workflow 단계 구성 확인" 안내를 띄웁니다. "분석 흐름으로 단계 나누기"를 누르면 정해진 요청으로 초안을 고칩니다. 연구자는 다른 고치기와 마찬가지로 새 초안을 검토합니다. 기존 Workflow를 편집할 때 새 형식으로 바꾸는 경로가 이것입니다. 저장된 자료는 다시 쓰지 않습니다.
5. 설치된 Workflow의 패키지를 읽을 때 새 항목(입력의 여러 파일 여부, 조건의 기본값, 단계의 입력 연결)을 확인합니다. 기본값이 있는 조건은 "아직 정할 조건"으로 세지 않습니다.

## 3. 결과

포천 2차 작성 프로젝트(저장된 분석 38개 발견, 연구자 결정 6개)에서 GPT-6.1 Sol high로 두 번 실행했습니다.

| | 기존 0.2.0 | 새 지침으로 새 초안 | 0.2.0을 단계로 고치기 |
|---|---|---|---|
| 단계 수 | 10 | 5 | 5 |
| 조건 수 (꼭 정할 조건) | 15 (15) | 16 (4) | 15 (6) |
| 단계에 연결된 입력 | 0 / 6 | 6 / 6 | 6 / 6 |
| 패키지 검사 오류 | 0 | 0 | 0 |
| 단계 관련 참고 사항 | 8 | 0 | 0 |
| 모델 응답 | 해당 없음 | 한 번 고친 뒤 통과 | 첫 응답 통과 |

새 초안의 단계는 자료 준비와 자력 보정 → 코어 물성과 역산 설계 → 두 PGI 역산 → 광체 분리와 부피 비교 → 평가와 결과 정리입니다. 단계를 고친 0.2.0은 자료 준비와 보정 → 물성·격자 구성 → 두 PGI 역산과 평가 → 광체 후보와 목표 확인 → 부피와 해석 정리입니다. 기존 10단계는 새 단계 안의 소절로 모두 남았습니다(첫 소절 이름만 "자료 기준 확인"에서 "입력 기준 확인"으로 바뀌었습니다).

방법이 온전한지 SKILL.md를 0.2.0과 대조했습니다. 세 초안 모두 다음을 담고 있습니다.

- 기준 관측소 일변화 보정, IGRF 보정, 지형 고도, 재표본화
- 코어 대자율로 만든 GMM과 PGI-full, PGI-none 두 역산
- property-based 경계와 probability-based 경계(ore 확률 0.99 초과), 각 역산마다 두 경계
- 낮은 sensitivity 구역 제외, 시추공으로 목표 광체 지정, 기준 광체와 부피·깊이 비교
- 빠른 시험 설정과 전체 설정

0.2.0 본문에 있던 한자 2자("새資料")는 고친 초안에서 사라졌습니다.

그림 없음: 결과가 단계 구성과 검사 수치이므로 표로 보입니다.

### 바뀐 화면 문구 (namespace hub, 새로 추가, 이전 문구 없음)

| id | 한국어 | English |
|---|---|---|
| hub.stages.title | Workflow 단계 구성 확인 | Check the Workflow stages |
| hub.stages.body | Workflow는 자료 준비 → 처리·모델링 → 평가 → 해석·결과처럼 분석 흐름에 따라 3~5단계로 나눕니다. 시작할 때 꼭 정할 조건은 6개 이하로 두고, 나머지는 기본값을 두어 시작 요약에서 바꿀 수 있게 합니다. | A Workflow is split by the analysis flow, such as data preparation → processing and modelling → evaluation → interpretation and results, into 3-5 stages. At most 6 conditions must be set at the start; the others get a default that can be changed in the start summary. |
| hub.stages.detail | 확인할 점 {count}개 | {count, plural, one {# point} other {# points}} to check |
| hub.stages.action | 분석 흐름으로 단계 나누기 | Regroup stages by analysis flow |
| hub.stages.reviewNote | AI agent가 새 초안을 만듭니다. 바뀐 단계와 조건을 검토한 뒤 시험하거나 등록하세요. | The AI agent writes a new draft. Review the changed stages and conditions before you try or register it. |
| hub.stages.failed | 단계 나누기를 시작하지 못했습니다. | Regrouping could not start. |

검사 문구(서버의 한국어 참고 사항): 새 항목 workflow-stages "Workflow 단계를 분석 흐름에 맞게 3~5단계로 나누고, 꼭 정할 조건은 6개 이하로 줄여 주세요."와 경고별 문장(단계 수, 꼭 정할 조건 수, 항목별 분할, 연결되지 않은 입력)을 추가했습니다.

## 4. 검증

- 자동 시험: 서버 지구과학 시험 685개(새 시험 6개 포함)와 허브 화면 시험 114개(새 시험 3개 포함)가 통과했습니다. 서버·웹 타입 검사, 문구 검사, 화면 규칙 검사는 오류 0개입니다.
- 실제 모델 실행: 위 표의 두 실행입니다. 기준은 기존 0.2.0 초안이고, 단위는 개수입니다. 반복은 한 번씩이므로 모델 응답의 편차는 확인하지 못했습니다.
- 다른 설명 가능성: 첫 실행 두 번은 단계와 무관한 이유로 거절되었습니다(7절). 표의 수치는 그 원인을 없앤 재실행 결과입니다.
- 미확인: 새 초안으로 분석을 실행하지 않았습니다. 분석 품질이 0.2.0과 같은지는 시험 실행에서 확인해야 합니다.

## 5. 한계

- 두 실행 모두 입력 6개 전부를 여러 파일 입력으로 표시했습니다. 지형 고도나 비교용 기준 광체처럼 보통 파일 하나인 입력도 포함됩니다. 차이는 시작 창에서 파일을 여러 개 고를 수 있다는 점이고, 파일 하나를 고르면 AI agent가 받는 지침은 같습니다. 지침에 "파일 하나인 입력은 표시하지 않는다"를 더하는 것은 선택 과제로 남깁니다.
- 기본값 가운데 몇 개는 설정 묶음을 한 문장으로 적었습니다(예: 역산 반복과 정규화 제어 값 12개). 시작 요약에서 길게 보입니다.
- 새 초안의 첫 응답은 연구자가 이미 답한 조건 4개를 선택지 하나와 같은 값의 기본값으로 적었습니다. 선택지는 두 개 이상이어야 하므로 검사가 한 번 고치게 했고, 고친 응답은 통과했습니다. 지침에 "답이 정해진 조건은 선택지를 두 개 이상 두고 답을 기본값으로 둔다"를 더하는 것도 선택 과제입니다.
- 모델 실행은 검토 앱의 OpenAI 로그인을 한 번 공유해서 했습니다. 사용자 결정(2026-10-23, "검토 앱 로그인을 이번만 공유")에 따른 것이며, 실행 뒤 검토 앱의 연결이 유지되는 것을 확인했습니다.

## 6. 결정할 일

없음

## 7. 대체되었거나 실패한 시도

- 첫 실행 두 번이 거절되었습니다. 같은 프로젝트를 한 작성 저장소에 두 벌 복사해서 두 복사본이 서로 같은 skill 이름을 "다른 Workflow가 쓰는 이름"으로 판정했기 때문입니다. 시험 환경 문제였습니다. 그 응답들도 단계 형식(4·5단계, 꼭 정할 조건 5·6개, 입력 모두 연결)은 맞았습니다. 고치기용 복사본을 별도 저장소로 옮겨 다시 실행했습니다.

## 용어

없음

## 부록 A. 근거 위치

- 코드: `server/src/geo/authoring/{prompts,agent,workflow,package}.ts`, `server/src/geo/methods/{method-file,local-methods}.ts`,
  `server/src/geo/workspace/workflows.ts`, `server/src/geo/workflow-doc.ts`, `web/src/geo/hub/stage-notice.tsx`
  (`draft-step.tsx`, `hub-screen.tsx`에 연결), 문구 `web/src/geo/locales/hub/{ko,en}.json` `stages.*`.
- 시험: `server/test/geo-authoring-stages.test.ts`, `web/src/geo/hub/stage-notice.test.tsx`; 명령 `cd server && npm run typecheck && npx vitest run test/geo`,
  `cd web && npx tsc --noEmit && npx vitest run src/geo/hub`, `node geo/copy/validate-copy.mjs web/src/geo/locales`, `node geo/ui/check-ui.mjs`.
- 프롬프트 판: `gaid-analyze/2026-10-23.3`, `gaid-draft/2026-10-23.3`.
- 실행 (PC74, 이 작업의 인스턴스, 포트 18610/18611, 끝난 뒤 정지): 작성 프로젝트 ap-43431e17-f09(새 초안, attempt att-c5bc8d55-79a, 초안 10판),
  ap-stages-regroup(0.2.0 고치기, attempt att-a6b6c15e-cc8, 초안 10판), 모델 openai/gpt-6.1-sol, thinking high. 거절된 첫 실행 att-15490c60-7db,
  att-2c2e3549-102 기록은 `rejected-1/`.
- 결과 파일 (PC74 `~/data/geoaidesk/work/gaid-stages-authoring/`):
  - `stages-draft-draft-r10.json` sha256 30cd3794ab19981d0b7305ddea66e157941d356196f1a04a76e5be0d55103fcf
  - `stages-regroup-draft-r10.json` sha256 c837618a00b61cf85d5ac4695c149125e33b592cf904c9473a34ed16a2ecb979
  - `stages-draft-check.json` sha256 0211fe7700357df8cc510bafa2bc6e33ac656099ef0ffb978a352be2bd16b03b
  - `stages-regroup-check.json` sha256 6db457414419c3d2ccab244c3e63571d064f125805234ee2f8f88c43d106fbe7
  - `check-rev9-0.2.0.json` (기존 0.2.0 검사) sha256 37680ec017b46245a8b23071c53e81929502555586cb9dbe7b96c35626bd5fe1
