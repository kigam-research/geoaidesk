---
title: GAID를 Workflow 중심으로 정리하고 Workflow를 지침 문서로 AI agent에게 보냄
date: 2026-10-20
project: geoaidesk
task: gaid-workflow-model
headline: GAID의 허브 단위와 Workflow 패널의 줄을 모두 Workflow로 부르고, Workflow를 단계·사용 스킬·결과가 적힌 하나의 지침 문서로 AI agent에게 보냅니다. 허브와 프로젝트에서 보는 지침이 곧 채팅에 가는 글이며, 기관 Qwen 실제 대화에서 AI agent가 지침대로 스킬 지침부터 읽고 1단계를 수행했습니다.
review_status: pending
decisions: 0
cover: figures/12-chat-workflow-card.png
supersedes:
reviewed: 2026-10-22
---
# GAID를 Workflow 중심으로 정리하고 Workflow를 지침 문서로 AI agent에게 보냄

## 0. 한눈에

| | |
|---|---|
| 요청 | 스킬·Workflow·방법이 섞여 쓰이고 허브 방법의 구성이 보이지 않는 현황을 진단하고, 체계적으로 정리할 방안을 논의하기 |
| 결론 | 화면 문구를 Workflow, 스킬, 저장한 시작 설정, 판으로 정리했습니다. Workflow는 이제 입력·연구자 설정·사용 스킬·단계·결과·한계가 적힌 하나의 지침 문서로 AI agent에게 갑니다. 허브 상세, 프로젝트 상세, 시작 설정 요약, 채팅 첫 메시지, CLI용 파일이 모두 같은 문서를 씁니다. 허브 작성 기능은 절차를 Workflow 단계에 한 번만 씁니다. GitHub 등에서 가져온 스킬도 Workflow의 부품으로 쓸 수 있습니다. 기존 허브 항목과 기본 Workflow는 저장 자료를 바꾸지 않고 같은 형태로 보입니다. |
| 믿을 수 있는 정도 | 기관 Qwen으로 실제 대화를 한 번 돌려, AI agent가 지침대로 스킬 지침부터 읽고 1단계만 수행한 뒤 멈추는 것을 확인했습니다. 기관 Qwen으로 새 형식 초안도 한 번 만들었습니다. CLI 내보내기는 Pi와 Claude Code에서 명령과 스킬이 잡히는 것까지만 확인했고, Codex는 확인하지 못해 뺐습니다. 다른 연구자의 사용, Workflow 전체 단계 실행, 다른 모델은 시험하지 않았습니다. 검토용 앱(포트 3000)에는 아직 반영하지 않았습니다. |
| 결정할 일 | 없음 (2026-10-20 결정 5건은 6절) |

## 1. 요청한 것

> 현재 gaid 허브에서는 워크플로우를 방법이라고 표현하고 있다. 그리고 Gaid 시스템에는 스킬과 워크플로우가 별도의 기능으로 제공되고 있다. 또한, BYOK에서 제공하는 워크플로우는 지침의 형태로 구성되어 있는데 반해 GAID 허브에서 방법(워크플로우)는 어떻게 구성되어 있는지 허브에서도 보이지 않고 GAID 시스템에서도 보이지 않는다. 현재 스킬, 워크플로우, 방법이 혼용되고 있는 것도 이용자들은 혼선이 올 수 밖에 없다. 오히려 스킬은 github를 비롯한 곳에서 유용한 스킬을 가져올 수 있게하고, 워크플로우에 집중하는 것도 하나의 방법이라고 생각한다. 이와 관련하여 현황을 진단하고 어떻게 체계적으로 정리하고 개선할지 논의하고 개선하는 작업을 진행하자. — 2026-10-20 요청

> 모두 권장하는 방식으로 진행해도 좋다. skill_hub는 legacy이므로 계획에 포함하지 말아야 한다. GAID 허브에서 스킬도 추후에 관리해야한다. 그리고 워크플로우에서 스킬을 사용하는 것은 어떻게 사용하는지도 설계되어야 하며, BYOK의 워크플로우는 지침이 GAID 시스템에서 보이는데 GAID 허브의 워크플로우는 어떤 형태로 GAID 시스템의 에이전트 채팅에 반영되는지도 정의되어야 한다. 지침형태로 되는 것인지? 아니면 지금의 형태가 어떻게 구현되어 있는지도 구체화되고 확정되어야 한다. 즉, GAID 허브에서도 최종 워크플로우 형태가 어떤 것인지 보여야 한다는 것이다. 현재는 워크플로우가 어떤 흐름으로 진행되는지 설명만 있을 뿐 에이전트 채팅(CLAUDE, CODEX 채팅 같은 형태), CLI 환경에서 어떻게 적용되는지가 불분명하다. — 2026-10-20, 결정 4건에 대한 답과 추가 요청

> 가) 지침 문서 (권장) — 2026-10-20, Workflow가 AI agent에게 가는 형태에 대한 답

완료 기준: 1단계에서 이름, 저장 형태, 화면 표시, 서로의 관계를 진단하고 정리안을 냅니다. 2단계에서는 정한 범위를 구현합니다. 정한 범위는 이름 정리, 스킬 화면 연결, 결함 수정, 지침 문서 형태의 실행 방식, 허브와 프로젝트에서 최종 지침 보이기, Workflow의 스킬 사용 방식, CLI에서 쓰기입니다. 3.0절이 최종 결과이고, 3.1–3.15절은 진단과 설계, 3.16–3.17절은 화면과 CLI 구현입니다.

## 2. 수행한 것

1. 검토용 앱 자료를 작업 폴더로 복사하고, 그 복사본으로 앱을 따로 띄웠습니다. 검토용 앱 자료는 고치지 않았습니다.
2. 허브에 등록된 항목 5개와 설치된 패키지 4개를 열어 실제 구성을 확인했습니다.
3. 허브 상세, 프로젝트의 Workflow 패널, 설치한 방법의 상세 창, 시작 설정, 기존 BYOK Workflow 실행 창, 설정의 스킬 목록을 한국어 화면(1440×900)으로 찍었습니다.
4. 화면 문구 카탈로그, 용어집, 허브 패키지 형식, skill_hub 생산자 계약, 카탈로그 Workflow 정의를 대조했습니다.
5. 정리안 세 가지를 비교하고 권장안의 용어표와 영향 범위를 정리했습니다.
6. 결정 뒤 추가 요청에 따라, 허브 Workflow가 지금 채팅에 어떤 글로 들어가는지 코드에서 확인하고, 지침 문서 형태의 실행 방식과 스킬 사용 방식, CLI에서 쓰는 방식을 설계했습니다.
7. 사용자가 지침 문서 형태를 고른 뒤, 지침 문서의 공통 형식과 만드는 규칙, 채팅 시작 방식은 직접 구현했습니다. 나머지는 하위 작업 네 개로 나눴습니다. 이름 정리와 스킬 화면, 허브와 프로젝트의 지침 화면, 허브 작성 기능, CLI 내보내기입니다.
8. 네 작업을 합친 뒤 별도 앱에서 기관 Qwen으로 실제 대화를 돌려 확인했고, 그 과정에서 드러난 입력창·채팅 기록 표시 문제 세 가지를 고쳤습니다.

## 3. 결과

### 3.0 최종 결과: Workflow가 채팅에 들어가는 형태와 실제 실행 (2026-10-21)

사용자가 고른 "가) 지침 문서"대로 구현했습니다. Workflow는 이제 하나의 지침 문서로 AI agent에게 갑니다. 지침에는 입력, 연구자가 정한 설정, 사용하는 스킬, 단계, 결과 파일, 해석 한계가 들어갑니다. 허브 상세(그림 8), 프로젝트의 Workflow 상세(그림 9), 시작 설정 요약(그림 10), 채팅 첫 메시지, CLI용 파일(3.17)이 모두 같은 규칙으로 만든 같은 문서를 씁니다.

시작 설정에서 "시작 초안 만들기"를 누르면 입력창 위에 "Workflow · 제목 · 판" 카드가 생깁니다(그림 11). 카드를 펼치면 보낼 지침 전문을 읽을 수 있고, 카드를 뺄 수도 있습니다. 연구자가 입력창에 쓴 내용은 지침 뒤에 붙습니다. 보낸 뒤에는 채팅 기록에 같은 카드가 남습니다(그림 12). 대화 목록과 탭 이름은 "Workflow · 제목"으로 나옵니다. 스킬을 쓰라는 한 줄("Make sure to use the skills")은 더 붙이지 않습니다. 각 단계에 쓸 스킬이 적혀 있기 때문입니다.

![입력창 위의 Workflow 카드](figures/11-composer-workflow-card.png)

그림 11. 시작 설정을 마친 뒤의 입력창(1440×900). 볼 것: 지침이 "Workflow · PU-컨포멀 탐사 존 분류 (새 지역) · 1판" 카드로 들어가 있고, 입력창은 연구자의 말을 쓰도록 비어 있습니다. 첨부 파일은 그 아래에 있습니다.

![채팅 기록의 Workflow 카드와 AI agent의 첫 동작](figures/12-chat-workflow-card.png)

그림 12. 기관 Qwen으로 보낸 뒤의 채팅 기록(1440×900). 볼 것: 맨 위에 Workflow 카드와 연구자가 덧붙인 말이 있고, AI agent의 첫 동작이 이 Workflow에 딸린 스킬의 지침을 읽는 것입니다.

실제 대화로 확인한 결과입니다. 검토용 자료 복사본의 프로젝트에서 허브 Workflow 「PU-컨포멀 탐사 존 분류 (새 지역)」를 저장한 시작 설정으로 시작했습니다. 기관 Qwen(Qwen3.8 Flash Next)에 "1단계만 진행하고 멈춰 달라"는 말을 덧붙여 보냈습니다.

| 순서 | AI agent가 한 일 |
|---|---|
| 1 | 지침의 규칙대로 Workflow에 딸린 스킬의 지침 문서를 먼저 읽었습니다 |
| 2 | 격자 표를 점검하고 앞부분을 읽었습니다 |
| 3 | 1단계 검증 스크립트를 쓰고 실행했습니다 |
| 4 | 연구노트를 쓰고 QC 결과를 남겼습니다 |
| 5 | 1단계 결과를 표로 알리고 멈췄습니다 |

AI agent는 지침의 예시 값과 실제 파일이 다른 점 두 가지를 먼저 알렸습니다. 지침은 1 km 격자와 약 30만 셀을 예로 들었지만, 실제 파일은 5 km 격자에 70,200셀이었습니다. 양성 라벨 비율 1.165%와 예측 변수 결측률은 지침의 확인 항목대로 판정했습니다. 답변 중간에 중국어 제목 한 줄("注意事项")이 섞여 나왔습니다. 모델의 출력 문제이고 이번 변경과는 관계없습니다.

이번 확인에서 고친 것이 셋 있습니다. 처음 구현에서는 지침의 내부 표기가 입력창에 그대로 보였습니다. 첨부 파일 경로가 지침 블록에 붙어 보낸 뒤 카드로 인식되지 않는 문제도 있었습니다. 대화 목록에도 내부 표기가 보였습니다. 셋 다 고쳤고, 그림 11과 12가 고친 뒤의 화면입니다.


### 3.1 지금의 네 가지 개념과 실제 구성

| 개념 | 실제로 무엇인가 | 들어 있는 것 | 개수(검토용 자료) |
|---|---|---|---|
| 스킬 | AI agent가 읽는 지침과 도구 꾸러미 | 지침 문서, 스크립트, 참고 문서 | 카탈로그 13개, 프로젝트마다 허브에서 설치한 1개 |
| BYOK Workflow (출처: K-Dense) | 지시문 하나를 채워 보내는 양식 | 영어 지시문, 빈칸 0–5개, 자료 필요 여부. 스킬과 단계는 없습니다 | 326개 |
| 카탈로그 Workflow (지구과학) | 시작 양식 | 입력 파일, 연구자가 정할 분석 조건, 한두 문장 지시문, 사용할 스킬 목록, 예상 결과, 해석 한계. 단계는 없습니다 | 7개 |
| 허브 "방법" | 스킬 하나에 카탈로그와 같은 형식의 Workflow를 0–1개, 레시피를 0–1개 붙인 묶음 | 스킬 폴더, 허브 흐름도용 단계 정보, Workflow 정의, 레시피 | 허브 등록 5개(모두 Workflow 1개, 레시피 1개) |
| 레시피 | Workflow의 분석 조건 값을 미리 정해 둔 것 | 조건별 선택값, 작업 중 정할 조건 | 방법마다 1개, 프로젝트에서 따로 저장 가능 |

허브 화면의 용어 설명도 이 구조를 그대로 적고 있습니다. "방법: 스킬 하나와, 있으면 Workflow 하나로 이루어집니다", "시작 설정: 레시피라고도 부릅니다". 연구자는 사용자가 쓴 표현처럼 방법을 Workflow로 이해합니다. 저장 구조에서는 스킬이 중심이고, Workflow는 스킬에 붙은 시작 양식입니다.

### 3.2 같은 항목이 화면마다 다른 이름으로 나옵니다

허브에 등록된 「격자 탐사 우선순위: PU 학습·순응 보정·구역 분류」 하나가 화면마다 이렇게 불립니다.

| 화면 | 부르는 이름 |
|---|---|
| 허브 목록과 상세 | "방법", "분석 방법", "방법 흐름", "방법 소개", "복사해서 고치기: 내 방법으로" |
| 허브 상세의 종류 표시 | "Workflow" (그림 1의 왼쪽 위) |
| 패키지 안의 Workflow 제목 | "격자 탐사 우선순위 레시피" (만든 모델이 Workflow 제목에 레시피라고 씀) |
| 프로젝트 Workflow 패널 | "허브에서 설치한 Workflow" |
| 같은 줄의 상세 단추 | "방법 상세 보기" |
| 방법 상세 창 | 제목 아래 "본 스킬은…", 머리글 "Workflows", "레시피", "버전 0.1.0 · revision 1" |
| 시작 설정 | "입력 파일과 분석 조건", "레시피 값" |
| 설정 → 스킬 | 이름 없는 "설치됨" 스킬 한 줄과 내부 저장 경로 (그림 6) |
| 설정 → 스킬 → 추가의 허브 검색 | "GAID 허브에서 스킬 찾기", 종류 표시 "스킬"/"Workflow", "허브 패키지", "허브 방법: … revision …" |

판 번호도 "1판", "판 1", "revision 1", "버전 0.1.0"으로 섞여 있습니다. "레시피"는 연구 기능 쪽 화면에서 그림 생성 설정이라는 다른 뜻으로도 쓰입니다. 용어집에는 "Workflow"와 "스킬"만 있고 "방법"과 "레시피"는 없습니다.

![허브에 등록된 항목의 상세 화면](figures/01-hub-entry.png)

그림 1. 허브 상세 화면(1440×900). 볼 것: 종류 표시는 "Workflow"인데 제목 아래 설명과 단추는 모두 "방법"이라고 부릅니다. "실행 코드 포함" 한 줄 말고는 어떤 스킬과 파일이 들어 있는지 나오지 않습니다.

### 3.3 "Workflow"가 서로 다른 세 가지를 가리킵니다

| | BYOK Workflow | 카탈로그 Workflow | 허브 방법 안의 Workflow |
|---|---|---|---|
| 본질 | 지시문 | 시작 양식 + 짧은 지시문 | 시작 양식 + 짧은 지시문 |
| 지시문을 시작 전에 보여 줌 | 예 (영어, 고칠 수 있음, 그림 5) | 아니요 | 아니요 |
| 사용하는 스킬 | 없음 | 1–3개, 화면에 안 나옴 | 자기 스킬 1개, 화면에 안 나옴 |
| 단계 | 없음 | 없음 (스킬 지침 안에만 있음) | 없음 (스킬 지침과 허브 흐름도에 따로 있음) |
| 상세 보기 | 실행 창 | 없음 | 방법 상세 창 |

사용자가 지적한 차이는 여기서 생깁니다. BYOK Workflow는 지시문 자체라서 실행 창에서 무엇을 시키는지 다 보입니다. GAID Workflow는 입력과 조건을 묻는 양식이고, 실제로 무엇을 하는지는 스킬 지침에 있어서 보이지 않습니다.

![기존 BYOK Workflow 실행 창](figures/05-byok-launch.png)

그림 5. BYOK Workflow 「논문 검토」 실행 창(1440×900). 볼 것: "프롬프트 미리보기"에 AI agent에게 보낼 지시문 전체가 나오고 고칠 수 있습니다. 다만 지시문은 영어 그대로입니다.

### 3.4 구성이 보이지 않는 곳

○ 보임, △ 일부, × 안 보임.

| 화면 | 단계 | AI agent 지시문 | 사용하는 스킬 | 포함 파일·코드 | 입력·분석 조건 | 결과·한계 |
|---|---|---|---|---|---|---|
| 허브 상세 (등록 항목) | ○ 7단계 | × | × | △ "실행 코드 포함" 한 줄 | △ 입력 ○, 조건은 5개 중 1개만 표시 | ○ |
| 허브 추천의 카탈로그 카드 | × 상세 화면 없음, 알림만 뜸 | × | × | × | × | × |
| 허브 초안 (작성자 본인) | ○ | × | × | ○ "생성 파일 보기" (Workflow 정의 파일은 빠짐) | △ | ○ |
| 프로젝트 Workflow 패널 줄 | × | × | × | △ "코드 포함" 표시 | × | × |
| 방법 상세 창 (설치 후) | × | × | × | × | ○ | ○ |
| 카탈로그 Workflow | × 상세 단추 없음 | × | △ 준비가 안 됐을 때만 이름 표시 | × | 시작 설정에서만 | 시작 설정에서만 |
| 시작 설정 | × | × 시작 초안을 만든 뒤 입력창에서 처음 보임 | × 첫 스킬만 조용히 고정, 나머지는 보이지 않게 허용 | × | ○ | △ 접힘 |
| 설정 → 스킬 | × | △ 연필(편집) 단추로 지침 문서만 열림 | — | × 스크립트와 나머지 파일은 안 보임 | — | — |

![허브 상세의 방법 흐름](figures/02-hub-flow.png)

그림 2. 허브 상세의 "방법 흐름"(1440×900). 볼 것: 허브는 7단계와 단계별 확인 항목을 잘 보여 줍니다. 하지만 이 흐름은 설치한 뒤 프로젝트의 어느 화면에도 나오지 않습니다.

![설치한 방법의 상세 창](figures/03-method-detail.png)

그림 3. 프로젝트 Workflow 패널에서 연 방법 상세 창(1440×900). 볼 것: 검사 기록과 출처, 입력·조건·결과 목록은 있지만 단계, AI agent 지시문, 사용하는 스킬, 포함 파일이 없습니다. 설명 첫 문장이 "본 스킬은"으로 시작하고, 판 번호는 "revision 1"로 나옵니다.

![시작 설정의 요약 단계](figures/04-task-setup.png)

그림 4. 시작 설정의 요약 단계(1440×900). 볼 것: 입력 2개와 분석 조건 8개를 차례로 고르지만, 이 값들이 어떤 지시문과 스킬로 AI agent에게 넘어가는지는 "시작 초안 만들기"를 누른 뒤에야 입력창에서 보입니다.

![설정의 스킬 목록에 나온 허브 방법](figures/06-skills-row.png)

그림 6. 설정 → 스킬 목록(1440×900). 볼 것: 프로젝트에 설치한 허브 방법이 "pu-conformal-targeting 설치됨" 한 줄로만 나오고, 어느 Workflow의 스킬인지 대신 내부 저장 경로가 보입니다.

### 3.5 절차가 두 곳에 따로 적혀 있고, Workflow에는 없습니다

허브 방법 하나에 절차가 이렇게 나뉘어 있습니다.

| 어디 | 누가 읽나 | 「격자 탐사 우선순위」의 내용 |
|---|---|---|
| 스킬 지침 문서의 "처리 절차" | AI agent | 8단계 (6단계 순응 보정과 7단계 구역 분류가 따로) |
| 허브 흐름도용 단계 정보 | 허브 화면의 연구자 | 7단계 (순응 보정·구역 분류가 한 단계) |
| Workflow 정의 | 시작 설정 | 단계 없음. 지시문은 한 문단 |

허브 작성 기능은 두 곳을 한 번에 만들지만, 둘이 같은지 확인하지 않습니다. 연구자가 허브에서 본 7단계와 AI agent가 따르는 8단계가 다를 수 있습니다. 같은 이유로 허브의 "연구자가 정하는 곳 1개"(흐름도에서 직접 정하는 단계 수)와 시작 설정이 묻는 분석 조건 5개(이 항목 기준)도 맞지 않습니다. 단계마다 "연구자가 정함" 줄을 보여 주는 화면 기능은 있지만, 작성 과정에서 결정이 어느 단계에 속하는지 정보가 빠져 한 번도 표시되지 않습니다.

### 3.6 GitHub에서 스킬을 가져오는 기능은 이미 있습니다

설정 → 스킬 → "스킬 추가"에는 "owner/repo, Git URL 또는 로컬 경로"로 스킬을 가져오는 입력란이 그대로 있습니다. 미리보기 → 출처 신뢰 확인 → 설치 절차도 같습니다. 그 위에 GAID 허브 검색이, 아래 접힌 칸에 이전 skill_hub 입력이 있습니다.

다만 Workflow와 이어지지 않습니다. Workflow가 쓰는 스킬은 카탈로그 스킬이거나 자기 패키지 안의 스킬만 가리킬 수 있습니다. 그래서 GitHub에서 가져온 스킬을 Workflow의 부품으로 지정할 방법이 없습니다. 지금 가져온 스킬은 기본 범위의 채팅에서만 AI agent에게 보이고, Workflow로 시작한 채팅에서는 숨겨집니다.

### 3.7 정리안 세 가지

| | 가안: 이름만 정리 | 나안: Workflow 중심 (사용자 제안) | 다안: 스킬 중심 |
|---|---|---|---|
| 허브의 단위 | "방법" 유지 | Workflow | 스킬 |
| 스킬의 위치 | 방법의 일부 | Workflow가 쓰는 부품. 카탈로그, GitHub 등 외부, Workflow에 딸린 것 세 출처 | 허브의 주인공 |
| Workflow의 뜻 | 방법 안의 시작 양식 | 연구 작업 하나의 절차: 입력, 정할 조건, 단계, 지시문, 사용 스킬, 결과·한계 | 스킬을 시작하는 양식 |
| BYOK Workflow와의 관계 | 다른 것으로 남음 | 같은 개념에서 단계·스킬이 없는 가장 단순한 형태 | 다른 것으로 남음 |
| 연구자가 배울 말 | 방법, Workflow, 스킬, 레시피 | Workflow, 스킬, 저장한 시작 설정 | 스킬, Workflow, 레시피 |
| 구성 보이기 | 각 화면에 따로 추가 | Workflow 구성 화면 하나를 허브·프로젝트·시작 설정에서 같이 씀 | 스킬 문서 보기 위주 |
| 패키지 형식 | 바꾸지 않음 | 처음에는 바꾸지 않음. 절차를 한 곳에 모으고 외부 스킬을 가리키려면 나중에 선택 항목 추가 | 바꾸지 않음 |
| 약점 | "방법"과 "Workflow" 두 이름이 계속 같은 것을 가리킴 | 화면 문구를 넓게 고쳐야 함 | 연구자는 지침 문서를 읽지 않음. 사용자 방향과 반대 |

나안을 권장합니다. 근거는 세 가지입니다.

- 저장된 허브 항목 5개가 이미 모두 종류 "Workflow"이고 각각 Workflow 하나를 갖고 있습니다. 이름만 바꾸면 자료는 그대로 맞습니다.
- 연구자가 고르고 시작하는 것은 Workflow 패널의 줄입니다. 허브와 프로젝트가 같은 단어를 쓰면 "허브에서 고른 것이 프로젝트에서 이 줄이 된다"가 한 번에 이어집니다.
- GitHub 스킬 가져오기가 이미 있어서, 스킬을 부품으로 두는 쪽은 새 기능보다 연결 작업에 가깝습니다.

### 3.8 권장안의 개념과 용어표

```mermaid
flowchart LR
  subgraph W["Workflow (허브 단위, Workflow 패널의 한 줄)"]
    I["입력 자료"] --> C["연구자가 정할 조건"] --> S["단계"] --> R["결과와 해석 한계"]
    P["AI agent 지시문"]
  end
  K1["카탈로그 스킬"] -.사용.-> W
  K2["GitHub 등에서 가져온 스킬"] -.사용.-> W
  K3["이 Workflow에 딸린 스킬 (논문 코드 등)"] -.사용.-> W
  SS["저장한 시작 설정"] -.값을 채움.-> C
```

| 지금 쓰는 말 | 제안 (한국어) | 영어 | 정의 |
|---|---|---|---|
| 방법, 분석 방법, 허브 방법 | Workflow | Workflow | 연구 작업 하나를 AI agent에게 맡기는 절차. 입력 자료, 연구자가 정할 조건, 단계, AI agent 지시문, 사용하는 스킬, 결과와 해석 한계로 이루어집니다. |
| 카탈로그 Workflow | 기본 Workflow (분야: 지구과학) | built-in Workflow | GAID와 함께 배포되는 Workflow |
| BYOK Workflow | 일반 Workflow (출처: K-Dense) | general Workflow | 지시문만 있는 Workflow. 단계와 스킬 없이 시작합니다. |
| 스킬 | 스킬 | skill | AI agent가 읽는 지침과 도구 꾸러미. Workflow가 부품으로 씁니다. 출처는 카탈로그, GitHub 등 외부, Workflow에 딸린 것입니다. |
| 레시피, 시작 설정, 저장한 레시피 | 저장한 시작 설정 | saved start settings | Workflow의 입력과 조건 값을 미리 정해 둔 것 |
| 방법 흐름 | Workflow 단계 | steps | Workflow가 거치는 처리 순서 |
| 판, revision, 버전 | 판 | revision | 등록한 Workflow를 고쳐 다시 등록할 때 올라가는 번호 |
| 허브 패키지, 패키지 | (화면에 쓰지 않음) | — | 내부 저장 형식 이름은 화면에 내보내지 않습니다. |

"Workflow"는 2026-10-15 사용자 결정대로 한국어 문구에서도 로마자로 씁니다.

### 3.9 기존 자료에 미치는 영향

| 대상 | 2단계 1차(이름 정리, 구성 보기) | 나중의 형식 확장(선택) |
|---|---|---|
| 허브 등록 항목 5개 | 그대로. 새 이름으로 보임 | 그대로 읽힘 |
| 프로젝트에 설치한 방법 | 그대로. 실행 기록과 시험 기록도 그대로 | 다시 설치하지 않아도 됨 |
| 프로젝트에 저장한 레시피 | 그대로. "저장한 시작 설정"으로 보임 | 영향 없음 |
| 허브 패키지 형식 | 바꾸지 않음. 내부 이름도 유지 | Workflow에 단계 항목과 사용 스킬 목록을 추가(3.12, GAID가 형식을 정함) |
| 카탈로그 Workflow(고정 파일) | 바꾸지 않음 | 바꾸지 않음. 카탈로그의 스킬 단계 정보로 GAID가 단계를 만들어 보여 줌(3.15) |
| BYOK Workflow 326개 | 그대로. 이름만 "일반 Workflow"로 묶음 | 영향 없음 |

1단계 초안에는 skill_hub 계약 문서를 함께 고치는 항목이 있었습니다. 사용자 결정(skill_hub는 legacy)에 따라 계획에서 뺐습니다.

### 3.10 2단계 작업 묶음 제안 (나안 기준)

1. 이름 정리: 허브, 허브 검색, 설치한 방법, Workflow 패널, 스킬 설치 화면의 문구와 허브 용어 설명, 용어집을 3.8 표에 맞춥니다. 새 초안이 Workflow 제목에 "레시피"를 쓰지 않도록 작성 지시도 고칩니다. 이미 저장된 제목은 고치지 않습니다.
2. Workflow 구성 화면 하나: 단계, 입력, 정할 조건 전부, 결과와 한계, 사용하는 스킬(이름, 출처, 지침 읽기), AI agent에게 보낼 지시문, 포함 파일과 코드를 한 화면에 모읍니다. 허브 상세, 프로젝트의 상세 창, 시작 설정 요약에서 같은 화면을 씁니다. 카탈로그 Workflow에도 상세 단추를 달고, 허브 추천의 카탈로그 카드도 이 화면으로 엽니다.
3. 스킬 화면 연결: 허브에서 온 스킬 줄에 내부 경로 대신 "「…」 Workflow에 딸린 스킬"을 보입니다. 지침을 읽기 전용으로 여는 단추를 둡니다. 허브 검색은 Workflow 쪽(레시피 가져오기 자리)으로 옮기고, 스킬 추가는 GitHub 등 출처에서 가져오기를 앞에 둡니다.
4. 진단 중 찾은 결함 고치기: 등록 창의 "공유: 스킬·Workflow 파일 … 시험 평가" 문구가 실제로 공유되는 것보다 많이 약속합니다. 다른 연구자가 등록한 항목을 설치해도 "GAID 허브에서 만든 초안"으로 표시됩니다. 허브에서 바로 설치할 때 설치 내용 미리보기가 보이지 않습니다. 허브 흐름도의 "연구자가 정하는 곳"이 실제 분석 조건 수와 맞지 않습니다.
5. 형식 확장(3.12–3.15의 설계로 구체화): 절차를 Workflow의 단계 항목 한 곳에서 만들고 스킬 지침과 허브 흐름도가 그것을 따르게 합니다. Workflow가 GitHub 등에서 가져온 스킬을 출처와 판으로 가리킬 수 있게 합니다.

### 3.11 바꾸기 전 허브 Workflow가 채팅에 들어가던 형태 (2026-10-20 확인)

사용자 질문("지침 형태로 되는 것인지, 지금은 어떻게 구현되어 있는지")에 답하려고 실제 전달 경로를 코드에서 확인했습니다. 「격자 탐사 우선순위」를 저장된 기본 설정으로 시작하면 AI agent는 세 가지를 받습니다.

| 전달 위치 | 내용 | 연구자가 보는가 |
|---|---|---|
| 시스템 지시(대화 전체에 적용) | GAID 작업 규칙과, 이 Workflow가 쓰는 스킬 1개의 이름·한 줄 설명·지침 파일 위치. 다른 스킬은 목록에서 빠집니다 | 아니요 |
| 첫 메시지 | 아래 상자의 글. 입력창에 들어가고 연구자가 보냅니다 | 시작 설정을 마친 뒤 입력창에서 |
| 보낼 때 붙는 줄 | "Make sure to use the skills: 'conformal-grid-priority'" | 아니요 |

```text
연구자가 정한 설정 (아래 Workflow 지시문보다 우선합니다)

입력 파일:
- 집계 격자 CSV: user_data/<격자 파일>.csv

선택한 분석 조건:
- 공간 블록 크기 산정 방식: 경험 바리오그램 유효 범위의 약 1.6배로 자동 산정 (auto-variogram)
- lift 백분위 구역 경계: 1% / 5% / 10% (논문 Yilgarn 운영점) (paper-operating)
- …(조건 5개)

작업 중 결정할 조건: 없음
미결정 조건은 해당 조건이 필요한 단계 전에 질문하세요.

Workflow 지시문:
이 격자 표로 탐사 우선순위 5등급 구역(Immediate ~ Excluded)을 만들어 주세요. 공간 블록 크기는 바리오그램으로 자동 산정하되 …
첫 시험은 줄인 설정으로 하고 줄인 설정임을 결과에 반드시 적어 주세요.
지시문의 예시 값(…)이 위 설정이나 입력 파일과 다르면 위 설정과 실제 파일을 따르고, 다른 점을 먼저 알려 주세요.

해석 한계: 이 결과는 Yilgarn 단일 craton에서 개발·검증된 방법론의 일반화 적용입니다. …
결과는 검토 전입니다. 실행 완료를 검토 완료로 표시하지 마세요.
```

지금의 허브 Workflow는 "짧은 지시 + 스킬을 쓰라는 한 줄"입니다. 7단계 절차는 이 메시지에 없습니다. AI agent가 스킬 이름을 보고 스스로 그 지침 문서를 읽어야 8단계 절차를 알게 됩니다. 읽을지는 모델이 정합니다. 허브가 보여 주는 7단계 흐름은 AI agent에게 전달되지 않는 별도 설명입니다. 사용자가 "설명만 있을 뿐"이라고 본 것이 실제 구현과 맞습니다.

### 3.12 설계: Workflow는 하나의 지침 문서로 AI agent에게 갑니다

BYOK Workflow처럼 지침 형태로 확정하자고 제안합니다. 다만 이 문서는 Workflow의 구성 요소(입력, 조건, 단계, 사용 스킬, 결과, 한계)에서 GAID가 같은 규칙으로 만들어 냅니다. 허브 상세, 프로젝트의 Workflow 상세, 시작 설정 요약, 채팅의 첫 메시지, CLI 파일이 모두 이 한 문서를 씁니다. 그래서 허브에서 본 글이 곧 AI agent가 받는 글입니다.

같은 Workflow를 이 방식으로 만들면 첫 메시지는 다음과 같습니다(허브의 7단계와 실제 조건 값으로 만든 예시이며, 설정 줄은 일부 줄였습니다).

```text
# Workflow: 격자 탐사 우선순위: PU 학습·순응 보정·구역 분류 (1판)
목적: 격자 표와 광상 표지로 탐사 우선순위 5등급 구역을 만듭니다.

## 연구자가 정한 설정 (이 지침의 예시 값보다 우선합니다)
- 집계 격자 CSV: user_data/<격자 파일>.csv
- 공간 블록 크기 산정 방식: 경험 바리오그램 유효 범위의 약 1.6배로 자동 산정
- lift 백분위 구역 경계: 1% / 5% / 10%
- rho_IQR 불확실성 임계: 30%
- 순응 보정 허용 FNR alpha: 0.15
- 계산 설정 규모: 줄인 설정 (B=10, Optuna 10 trials, T=10)
정하지 않은 조건: 없음. 정하지 않은 조건이 있으면 그 조건을 쓰는 단계 전에 연구자에게 물으세요.

## 사용하는 스킬
- conformal-grid-priority (이 Workflow에 딸린 스킬, 실행 코드 포함): 1–7단계에서 씁니다.
  각 단계를 시작하기 전에 이 스킬 지침에서 그 단계의 절을 읽으세요.

## 단계
1. 데이터 입력·QA: 격자 CSV를 읽고 좌표 열, 양성 표지, 예측 변수 열과 결측을 점검합니다.
   확인할 것: 열 이름이 설정 파일과 같은지 / 좌표가 투영 좌표계인지 / 양성 셀 수와 비율 / 결측률 5% 초과 열
2. 블록 크기 산정 [연구자 결정: 공간 블록 크기 산정 방식]: 위 설정의 방식으로 정합니다.
   확인할 것: 유효 범위 추정값이 0보다 큰지 / 블록 크기가 격자 간격의 정수배인지
3. 공간 블록 폴드 생성: 정한 블록 크기로 바깥 폴드 5개와 안쪽 교차 검증 폴드를 나눕니다.
4. 누출 방지 전처리: 폴드마다 학습 폴드에서만 변환과 결측 대체 값을 정합니다.
5. BaggingPU-XGBoost 학습 [연구자 결정: 계산 설정 규모]: 위 설정의 규모로 학습합니다.
6. 순응 보정·구역 분류 [연구자 결정: alpha, lift 경계, rho_IQR 임계]: 위 설정 값을 씁니다.
7. 결과 출력·해석: 아래 결과 파일을 만들고, 줄인 설정을 썼으면 실행 로그에 적습니다.

## 결과 파일
- outputs/zone_table.csv: 구역 등급 표 (필수)
- outputs/summary_stats.csv: 구역별 요약 통계 (필수)
- outputs/run_log.md: 실행 로그 (필수)
- outputs/variogram_fit.csv: 바리오그램 진단 (선택)

## 해석 한계
이 결과는 Yilgarn 단일 craton에서 개발·검증된 방법론의 일반화 적용입니다. …

결과는 검토 전입니다. 실행 완료를 검토 완료로 쓰지 마세요.
```

(설계 때 손수 만든 예시입니다. 구현에서는 연구노트 줄을 지침에 넣지 않았습니다. GAID 채팅에서는 기본 작업 규칙이 연구노트를 다루고, CLI에는 연구노트 기능이 없기 때문입니다.)

채팅에서는 이 문서가 "Workflow · 격자 탐사 우선순위 · 1판" 카드 하나로 보이고, 누르면 전문이 펼쳐집니다. 지금처럼 입력창에 넣은 뒤 연구자가 한 줄을 덧붙여 보낼 수 있습니다. 채팅 기록에는 어느 Workflow의 몇 판으로 시작했는지 남습니다. "Make sure to use the skills" 줄은 붙이지 않습니다. 단계마다 쓸 스킬과 읽을 부분을 적었기 때문입니다.

### 3.13 Workflow가 스킬을 쓰는 방식

| 스킬 출처 | Workflow에 적는 것 | 프로젝트에 들어오는 방법 | AI agent가 읽는 때 |
|---|---|---|---|
| 기본 제공 스킬(카탈로그) | 스킬 이름 | GAID 설치 때 이미 있음 | 그 스킬을 쓰는 단계 전 |
| GitHub 등에서 가져온 스킬 | 스킬 이름, 가져온 곳과 판 | 시작 설정의 준비 확인에서 "가져오기"를 누르면 지금의 미리보기·신뢰 확인 절차로 설치 | 그 스킬을 쓰는 단계 전 |
| Workflow에 딸린 스킬(논문 코드 등) | 스킬 이름 | Workflow를 설치할 때 함께 설치 | 그 스킬을 쓰는 단계 전 |
| GAID 허브에서 관리하는 스킬 | (나중에) | 사용자 결정대로 나중에 허브에서 관리 | — |

- 스킬은 "할 줄 아는 것"을 담습니다. 자료 형식 점검, 스크립트 실행법, 방법의 세부 사항이 여기에 들어갑니다. 순서, 연구자 결정, 결과 파일은 Workflow의 단계가 정합니다. 같은 스킬을 여러 Workflow가 쓸 수 있습니다.
- 채팅에서는 그 Workflow의 스킬만 AI agent에게 목록으로 보입니다. 지금도 이렇게 동작합니다. 스킬 전문은 처음부터 메시지에 넣지 않고, 단계가 지시할 때 AI agent가 읽습니다. 64K 문맥으로 설정한 로컬 모델에서도 도구 설명만으로 시작 문맥 약 25K 토큰 가운데 약 19K 토큰을 쓰기 때문입니다.
- 허브의 Workflow 작성 기능은 절차를 단계에 한 번만 씁니다. Workflow에 딸린 스킬의 지침은 단계 이름과 같은 절 제목을 두고, 둘이 어긋나면 검사에서 경고합니다. 지금처럼 7단계와 8단계가 따로 생기지 않습니다.

### 3.14 CLI 에이전트에서 쓰는 방식

GAID 채팅은 Pi라는 CLI 에이전트를 앱 안에서 돌리는 구조입니다. 그래서 같은 지침 문서를 CLI 에이전트에서도 쓸 수 있습니다. 허브 상세와 프로젝트 Workflow 상세에 "CLI에서 쓰기"를 두고, 내려받은 폴더에 두 가지를 넣습니다.

| 들어가는 것 | 내용 | CLI에서 쓰는 법 |
|---|---|---|
| Workflow 지침 파일 1개 | 3.12의 문서. "연구자가 정한 설정" 자리는 명령 뒤에 적은 값으로 채워지고, 비어 있으면 AI agent가 조건 목록(선택지 포함)을 먼저 묻습니다 | 명령 하나로 시작(Workflow 이름 뒤에 격자 파일과 alpha 같은 값을 적음) |
| 스킬 폴더 | Workflow가 쓰는 스킬의 지침과 파일. Claude Code, Codex, Pi가 같은 스킬 폴더 형식(SKILL.md)을 읽습니다 | 각 CLI의 스킬 폴더에 둠 |

Pi에서는 GAID가 이미 같은 방식(프롬프트 템플릿과 스킬 폴더)으로 동작하므로 2단계에서 직접 확인합니다. Claude Code와 Codex의 폴더 위치와 명령 이름 규칙은 구현할 때 실제 CLI로 확인한 뒤에 내놓습니다. 확인하지 못한 CLI는 내려받기 목록에 넣지 않습니다.

### 3.15 기존 Workflow와 2단계 순서

- 허브 등록 항목 5개, 프로젝트에 설치한 사본, 기본 Workflow 7개는 저장 자료를 바꾸지 않습니다. GAID가 주 스킬의 단계 정보(허브 항목은 등록 때 저장된 흐름, 기본 Workflow는 카탈로그의 스킬 단계)로 단계를 만들어 같은 지침 문서로 보여 줍니다. 이런 Workflow에는 "이전 형식: 자세한 방법은 스킬 지침의 처리 절차를 따릅니다"를 붙입니다. 허브에서 고쳐 다시 등록하면 새 형식이 됩니다.
- 일반 Workflow(BYOK 326개)는 바꾸지 않았습니다. 실행 창이 이미 지시문 전문을 보여 줍니다.
- skill_hub는 사용자 결정대로 계획에 넣지 않습니다. Workflow 형식은 GAID가 정하고, 고정된 카탈로그 파일은 바꾸지 않습니다.
- 2단계 순서: (1) 이름 정리·스킬 화면 연결·결함 수정(하위 작업으로 이미 시작, 이 설계와 무관), (2) 이 설계 확정 후 지침 문서를 만드는 공통 부분과 채팅 시작 방식, (3) 허브·프로젝트·시작 설정의 Workflow 상세 화면, (4) 허브 작성 기능이 단계를 쓰도록 바꾸기, (5) CLI에서 쓰기.

### 3.16 최종 Workflow 지침을 허브와 프로젝트에서 함께 봅니다

허브 등록 항목, 작성 중인 초안, 프로젝트의 Workflow 상세, 기본 Workflow 상세에 공통 구성 화면을 연결했습니다. 기본 Workflow는 패널 줄의 상세 단추나 허브 추천 카드에서 엽니다. 시작 설정 요약에서는 연구자가 채운 입력과 조건을 반영한 지침을 펼쳐 읽고 복사합니다. 복사한 글과 새 채팅의 첫 메시지는 같은 문서 렌더러를 씁니다.

단계마다 사용하는 스킬, 먼저 읽을 부분, 확인할 항목, 연구자 결정, 결과를 표시합니다. 허브의 개념 그림과 입력·결과 예시는 기존 표시 기능을 재사용합니다. 연구자 결정 표시는 단계에 연결된 선택 조건에서 읽습니다. 이전 형식의 Workflow에는 자세한 방법을 스킬 지침에서 읽어야 한다는 안내가 남습니다.

사용하는 스킬은 기본 제공, 가져온 스킬, Workflow에 딸린 스킬로 구분합니다. 프로젝트에 설치한 스킬 지침은 읽기 전용으로 엽니다. 허브 등록 항목의 스킬 지침은 화면에 표시한 판의 실제 등록 파일에서 읽습니다. 기본 Workflow의 스킬도 허브에서 읽을 수 있습니다. 입력과 선택 조건 전체, 결과 파일과 해석 한계, AI agent가 받는 지침은 접힌 칸에서 확인합니다. 프로젝트 상세에서는 첫 단계만 펼쳐 보여 주며, 나머지는 제목을 눌러 읽습니다. 검사 기록도 접힌 칸에 보관합니다.

가져온 스킬이 프로젝트에 없으면 이름과 기록된 출처를 표시합니다. 가져오기 단추는 기존 스킬 설치 화면에 출처를 채웁니다. 출처를 읽거나 설치하는 동작은 연구자가 미리보기와 출처 확인을 거쳐 선택합니다.

![허브에서 보는 최종 Workflow 지침](figures/08-workflow-hub-instructions.png)

그림 8. 허브 등록 항목의 최종 지침. 연구자가 정할 조건과 전체 단계가 AI agent에게 전달될 문서 안에 함께 들어갑니다.

![프로젝트의 Workflow 단계](figures/09-workflow-project-detail.png)

그림 9. 프로젝트의 Workflow 상세. 첫 단계를 펼치고 나머지는 제목으로 보여 전체 순서를 확인할 수 있습니다.

![시작 설정을 반영한 지침](figures/10-workflow-setup-instructions.png)

그림 10. 시작 설정 요약의 지침. 선택한 입력 파일과 분석 조건을 반영하고, 정하지 않은 조건을 따로 표시합니다.

### 3.17 CLI용 지침과 스킬 내보내기

기본 Workflow, 프로젝트에 설치한 Workflow, 허브에 등록한 Workflow를 Pi 또는 Claude Code용 ZIP으로 받을 수 있는 기능을 만들었습니다. ZIP에는 같은 렌더러가 만든 Workflow 지침, 그 Workflow가 쓰는 스킬 파일, 한국어·영어 시작 안내가 들어갑니다. 기본 스킬은 고정된 카탈로그에서, 딸린 스킬은 설치한 폴더나 허브 등록 사본에서 가져옵니다. 외부에서 가져온 스킬은 프로젝트의 설치 사본을 씁니다. 사본이 없으면 시작 안내에 빠진 스킬을 적습니다.

명령 뒤에 입력 파일과 분석 조건을 적어 시작합니다. 인수가 비어 있으면 AI agent가 지침에 적힌 조건을 묻습니다. 분석 자료와 실행 환경은 ZIP에 포함하지 않습니다. 파일 경로가 스킬 폴더를 벗어나거나 링크·특수 파일이 있으면 내보내지 않습니다. 기존 패키지와 같은 크기 제한을 적용합니다.

실제 Pi와 Claude Code에서 ZIP을 풀어 명령과 스킬이 목록에 잡히는 것을 확인했습니다. 분석은 실행하지 않았습니다. Codex는 명령 파일의 인식·확장을 확인하지 못해 내려받기 목록에서 제외했습니다.

내려받기 버튼을 허브 등록 상세와 프로젝트 Workflow 상세에 연결했습니다. 아래 그림은 버튼 구성요소만 띄운 시험 화면입니다. 두 창 크기에서 잘림과 가로 넘침이 없고 Escape로 닫으면 버튼에 초점이 돌아오는 것을 확인했습니다.

![CLI용 파일 내려받기 구성요소 시험 화면(1440×900). Pi와 Claude Code 파일 받기를 고릅니다.](figures/cli-export-1440.png)

![같은 구성요소의 1280×800 시험 화면. 안내와 두 내려받기 버튼이 모두 보입니다.](figures/cli-export-1280.png)

## 4. 검증

- 과학적 검증: 해당 없음. 이 작업은 화면 구성, 용어, Workflow 전달 방식을 바꾼 것입니다. 3.0의 실제 대화는 지침이 AI agent에게 전달되고 따라지는지를 본 것이며, 분석 결과의 타당성을 본 것이 아닙니다.
- 실제 모델 확인:
  - 기관 Qwen 대화 1회. AI agent가 지침대로 스킬 지침을 먼저 읽고 1단계만 수행한 뒤 멈췄습니다. 예시 값과 실제 파일의 차이도 먼저 알렸습니다(3.0).
  - 기관 Qwen으로 새 형식 초안 1회. 첫 응답이 검사를 통과했습니다. 9단계에 분석 조건 3개와 결과 파일 7개가 모두 단계에 연결되었고, 스킬 지침의 절 제목과 단계가 맞았습니다. 검사 경고는 optuna와 scikit-gstat 설치 안내 2건뿐이었습니다.
- CLI 확인: 내려받은 ZIP을 실제 Pi와 Claude Code에서 풀어 Workflow 명령과 스킬이 목록에 잡히는 것을 확인했습니다. 분석은 돌리지 않았습니다.
- 소프트웨어 검증:
  - 하위 작업마다 전체 검사(백엔드·프론트엔드 시험, 문구·UI·배포 검사, 실행 환경 확인, 배포판 시작·종료·재시작)를 통과했습니다. 마지막 통과 기준으로 백엔드 시험은 1,965–1,977개(8개 건너뜀), 프론트엔드 시험은 1,120–1,133개입니다.
  - 네 작업을 합친 상태에서 시험 1개가 실패했습니다. 화면 작업이 만든 시험이 작성 기능을 합치기 전의 기대값을 갖고 있었기 때문입니다. 기대값을 고쳐 통과했습니다.
  - 마지막 통합 수정(입력창 카드, 대화 목록 이름, 목록 줄바꿈) 뒤 관련 시험은 웹 30개, 서버 22개가 통과했습니다. 전체 검사는 마무리 단계에서 다시 돌립니다.
- 화면 확인: 별도 앱에서 한국어 화면을 1440×900과 1280×800으로 찍었습니다. 입력창 카드, 채팅 기록, 시작 설정 요약, 대화 목록입니다. 화면 작업이 찍은 여섯 화면(14장)에서 화면 오류는 0건이었습니다.
- 진단(3.1–3.11)은 코드와 저장 자료를 읽어 확인했습니다. 3.5의 단계 수(8단계, 7단계)와 분석 조건 수는 등록된 패키지 파일에서 직접 셌습니다.
- 연구자 대상 이해도 시험은 하지 않았습니다.

## 5. 한계

- 실제 대화는 한 Workflow의 1단계까지만 확인했습니다. 전체 단계를 끝까지 돌리지 않았고, 다른 모델도 시험하지 않았습니다.
- 기존 허브 항목과 기본 Workflow는 "이전 형식"입니다. 단계는 주 스킬의 단계 정보에서 만들고, 자세한 방법은 스킬 지침을 따릅니다. 여러 스킬을 쓰는 기본 Workflow 3개도 주 스킬의 단계만 보입니다. 이전 형식 허브 항목은 결정과 단계의 연결 정보가 없어, 단계별 "연구자 결정" 표시가 비고 전체 조건 목록에만 나옵니다. 허브에서 고쳐 다시 등록하면 새 형식이 됩니다.
- Codex CLI는 사용자 정의 명령이 동작하는지 확인하지 못해 내려받기 대상에서 뺐습니다.
- 허브에서 스킬을 관리하는 기능은 사용자 결정대로 나중 일입니다. 지금 허브는 Workflow만 등록합니다.
- 기관 Qwen의 답변에 중국어 제목 한 줄이 섞여 나왔습니다. 모델 출력 문제로 보고 이번에는 고치지 않았습니다.
- 검토용 앱(포트 3000)에는 아직 반영하지 않았습니다. 검토용 앱을 바꾸는 일은 사용자가 정합니다.

## 6. 결정할 일

없음. 2026-10-20에 정한 결정은 다음 5건입니다.

| 질문 | 정한 답 |
|---|---|
| 기능 구조를 어느 방향으로 정리할까요? | Workflow 중심. 허브 단위와 Workflow 패널의 줄을 Workflow로 부르고, 스킬은 Workflow가 쓰는 부품 |
| 허브에 스킬만 있는 항목은? | 지금은 허브에 Workflow만 등록. 스킬은 나중에 GAID 허브에서 관리 |
| 레시피의 이름은? | "저장한 시작 설정" |
| 2단계 범위는? | 이름 정리, Workflow 구성 화면, 스킬 화면 연결, 결함 수정을 먼저 함. skill_hub는 legacy로 계획에서 뺌 |
| Workflow가 AI agent에게 가는 형태는? | 가) 지침 문서. 허브·프로젝트·시작 설정·채팅 첫 메시지·CLI 파일이 같은 문서를 씀 |

## 7. 대체되었거나 실패한 시도

<details><summary>펼치기 — 4건</summary>

- 1단계 초안은 형식 확장 전에 skill_hub 계약 문서를 함께 고치는 안이었습니다. 사용자가 skill_hub를 legacy로 정해 계획에서 뺐고, Workflow 형식은 GAID가 정합니다.
- 처음 구현한 채팅 시작은 지침 블록을 입력창 글자로 넣었습니다. 내부 표기가 그대로 보였고, 첨부 파일 경로가 블록에 붙어 보낸 뒤 카드로 인식되지 않았습니다. 입력창 위 카드로 바꿨습니다.
- 지침 문서의 목록 바로 뒤에 문장을 붙여 써서, 채팅 화면에서 "정하지 않은 조건" 문장이 마지막 설정 항목에 붙어 보였습니다. 목록 뒤에 빈 줄을 넣었습니다.
- Codex용 내보내기는 사용자 정의 명령이 동작하는지 확인하지 못해 내놓지 않았습니다.

</details>

## 용어

| 용어 | 새 정의 / 정의 변경 | 정의 |
|---|---|---|
| Workflow | 정의 변경 | 연구 작업 하나를 AI agent에게 맡기는 절차입니다. 입력 자료, 연구자가 정할 조건, 단계, AI agent 지시문, 사용하는 스킬, 결과와 해석 한계로 이루어집니다. 허브의 단위이자 Workflow 패널의 한 줄입니다. |
| 스킬 | 정의 변경 | Workflow가 쓰는 지침과 도구 꾸러미입니다. 기본 제공 스킬, GitHub 등에서 가져온 스킬, Workflow에 딸린 스킬이 있습니다. |
| 저장한 시작 설정 | 새 정의 (레시피 대체) | Workflow의 입력과 조건 값을 미리 정해 둔 것입니다. |
| 기본 Workflow / 일반 Workflow | 새 정의 | GAID와 함께 배포되는 Workflow / K-Dense에서 온 지시문형 Workflow입니다. |
| Workflow 지침 | 새 정의 | Workflow가 AI agent에게 가는 형태입니다. 구성 요소에서 같은 규칙으로 만들어, 허브·프로젝트·채팅·CLI에서 같은 글로 보입니다. |

이 프로젝트에는 별도 용어집 문서가 없고, GAID 문구 용어표(부록 A)에 반영했습니다.

## 부록 A. 근거 위치

<details><summary>펼치기 — 실행 방법, 원본, 해시, 커밋</summary>

| 항목 | 위치 |
|---|---|
| 기준 코드 | geoaidesk main 5f139a4 (task branch base f69300a), 검토용 앱도 5f139a47 |
| 진단용 앱 | systemd user unit `gaid-wfm-app`, `GAID_HOME=~/data/geoaidesk/work/gaid-workflow-model/home` (copy of `~/.geoaidesk` without project 2-bb7bed, `config.env`, `auth.json`), ports 3110/18110 |
| 화면 원본 | PC74 `~/data/geoaidesk/work/gaid-workflow-model/playwright/*.png` (01–09) |
| 허브 자료 | `~/.geoaidesk/pi-agent/skill-hub/shared/entries/*/entry.json` (5 entries, all `kind: "workflow"`); package `c70e5068…/conformal-grid-priority/` (`SKILL.md` 처리 절차 8 steps, `atlas.yaml` `procedure.nodes` 7, `gaid-method.json` `workflows[0]` with 5 `requiredScientificChoices`, no `steps`) |
| 허브 용어 설명 | `web/src/geo/locales/hub/ko.json:70-101` |
| 이름 혼용 | `web/src/geo/locales/{hub,hubPicker,methods,workspace,skillHub}/ko.json`; `geo/copy/terminology.csv` (workflow, 스킬 only) |
| BYOK Workflow | `web/src/data/workflows.json` (326), launch dialog prompt preview `web/src/components/workflows-panel.tsx:473-503`, sent with `skills: []` `web/src/components/chat-tab.tsx:2396` |
| 카탈로그 Workflow | catalogue 0.2.1 `workflows.json` (7, `geo-workflow/v1`, no steps); spec skill_hub `docs/specs/gaid-interfaces.md` §9 ("a task template, not a DAG") |
| 패키지 형식 | `docs/design/hub-method-package.md`; producer contract skill_hub `docs/specs/gaid-method-package.md` (v1; §7 additive fields keep v1); builder `server/src/geo/authoring/package.ts:105-249, 628-701` |
| Workflow 구성이 빠지는 곳 | shared entry API `server/src/geo/hub-shared/routes.ts:309-316`; method detail `web/src/geo/methods/methods.tsx:154-193`; task setup `web/src/geo/workspace/task-setup.tsx:55-176`, draft `web/src/geo/workspace/api.ts:27-37`; exposure `server/src/geo/context.ts:183-192, 245-252` |
| 흐름도 결정 표시 | `userDecisions.at` dropped `server/src/geo/authoring/agent.ts:670-681`; `web/src/geo/hub/method-flow.tsx:204-206` |
| GitHub 스킬 가져오기 | `web/src/components/skills-panel.tsx:459-488`, `server/src/agent/skills-fetch.ts` (bundled `skills` CLI 1.7.0) |
| 현재 채팅 전달 형태 | start draft `web/src/geo/workspace/api.ts:27-37` + `workspace.setup.draft.*`; nudge `web/src/components/skills-selector.tsx:263-267` ("Make sure to use the skills"), pinned primary `web/src/geo/workspace/task-setup.tsx:99-104`; skills index Pi `formatSkillsForPrompt` (`<available_skills>`) filtered by `server/src/geo/context.ts` exposure |
| 설계 | ADR `docs/adr/2026-10-20-workflow-runtime-form.md` (accepted 2026-10-20); catalogue skill procedures `catalogue/details/*/*.json` `profile.procedure.nodes` (3–8 per skill, catalogue 0.2.1) |
| 결함 | registration copy `hub/ko.json:322`; install origin label `server/src/geo/authoring/install.ts:70-76`, `methods/ko.json:23`; install without visible preview `install.ts:103-115` |
| 통합 구현 (parent) | contract `web/src/geo/contracts/workflow-doc.ts` (+ test), wording `web/src/geo/locales/workflowDoc/`, server `server/src/geo/workflow-doc.ts`, validation `server/src/geo/methods/method-file.ts` (`gaidWorkflowParts`), readiness/exposure `server/src/geo/methods/local-methods.ts`, chat start `web/src/geo/workspace/task-setup.tsx` + `tab-state.ts`, cards `web/src/geo/workflow/workflow-card.tsx` + `render.ts`, seams `web/src/components/chat-tab.tsx`, `web/src/lib/workspace-persistence.ts`, `web/src/lib/command-blocks.ts`; AGENTS.md "Workflow model" |
| 하위 작업 | gaid-workflow-model--terms, --cli, --views, --authoring (receipts `~/data/geoaidesk/work/reports/gaid-workflow-model--{terms-2c7c0a9aa14f,cli-986d95c1b6ff,views-c41cfdf703b4,authoring-0f4becab743e}.md`; task documents `docs/tasks/gaid-workflow-model--*.md`) |
| 실제 대화 (3.0) | PC74 `~/data/geoaidesk/work/gaid-workflow-model/home/projects/3-fac20b/sandbox/.pi/sessions/2026-10-20T15-17-43-665Z_01a159e3-cc71-747c-aaaa-5876d35fdb7d.jsonl`; note `…/sandbox/연구노트/2026-10-20-pu-conformal-격자표-검증/index.md`; model `kigam-qwen/qwen3.8-flash-next`; sent 2026-10-21 00:17:49 KST; first tool `read …/.pi/skills/pu-conformal-targeting/SKILL.md`; 10 tool calls, last call 41,872 input / 604 output tokens |
| 실제 초안 (4절) | authoring job output `~/data/geoaidesk/runs/gaid-workflow-model--authoring-20261020T142305.092598Z/out/{gaid-method.json,workflow-chat.md,draft.json,checks.json}` |
| 최종 화면 | PC74 `~/data/geoaidesk/work/gaid-workflow-model/playwright5/`: 05-composer-1440 (sha256 95543e6dcf49…, = figures/11), 05-composer-1280 (584f5d454efc…), 02-transcript-1440 (cf2d1f5ec074…, = figures/12), 02-transcript-1280 (9c1e04a5710f…), 04-summary-1440 (a301b93d9a59…), 01-history (fedd141f024e…) |

### CLI 내보내기 구현 근거 (2026-10-20)

- 구현: server/src/geo/cli-export.ts, server/src/geo/routes/cli-export.ts, web/src/geo/workflow/cli-export.tsx. 경로: GET /geo/workflows/:id/cli-export?target=pi|claude[&method=<runtimeName>], GET /geo/hub/entries/:id/cli-export?target=pi|claude; locale=ko|en, 기본 ko; application/zip, 파일 이름 <workflow-id>-<target>.zip. 프로젝트는 X-Project-Id 또는 다운로드 주소의 project로 지정하고 withApiToken()을 적용합니다.
- 코드 기준: 1da2f0824572 (구현). 실제 CLI 시험 코드와 ZIP: PC74 /home/seongin3/data/geoaidesk/work/gaid-workflow-model--cli/{make-export.mts,pi-probe.mjs,claude-probe.mjs,pi-export.zip,claude-export.zip}. 시험용 지침과 스킬만 포함합니다. 분석 자료와 인증 정보는 넣지 않았습니다.
- Pi 1.0.0: node <server>/node_modules/@earendil-works/pi-coding-agent/dist/cli.js --mode rpc --no-session --no-extensions --no-tools --offline --approve, PI_CODING_AGENT_DIR=<scratch>/agent. 생성한 ZIP을 pi-probe에 풀었습니다. get_commands 응답: gaid-workflow-probe (source prompt), skill:gaid-probe (source skill), success=true. 모델을 호출하지 않았습니다. 폴더: .pi/prompts/<id>.md, .pi/skills/<name>/.
- Claude Code 2.1.304: claude -p '/gaid-workflow-probe sentinel' --max-budget-usd 0.000001 --output-format stream-json --verbose --tools '' --strict-mcp-config --setting-sources project --no-session-persistence 명령을 ZIP을 푼 claude-probe 폴더에서 실행했습니다. 초기 slash_commands: gaid-workflow-probe 및 gaid-probe; skills: gaid-probe. error_max_budget_usd와 종료 코드 1로 끝났습니다. 명령·스킬 인식만 확인했으며 분석 실행을 확인한 시험은 아닙니다. 폴더: .claude/commands/<id>.md, .claude/skills/<name>/. 두 CLI의 명령 파일 모두 description/argument-hint와 공통 렌더러의 $ARGUMENTS를 담습니다.
- Codex 0.163.0: codex --help, codex app-server --help, codex app-server generate-json-schema --out <scratch>/codex-schema. 생성한 app-server 스키마에는 skills/list가 있고 customPrompts/list는 없습니다. 프롬프트 확장을 확인하지 못해 지원 목록에서 제외했습니다. 참고한 공식 문서: https://learn.chatgpt.com/docs/custom-prompts and https://learn.chatgpt.com/docs/build-skills (developers.openai.com/codex/{custom-prompts,skills}에서 이동). Codex 지원을 주장하지 않습니다.
- 전체 검사: 첫 scripts/check 작업은 종료 코드 0, 서버 1968개 통과·8개 건너뜀, 웹 1123개 통과, 배포·환경·생산 실행 재시작 시험 통과. 작업 실행기가 호출자의 환경변수를 보존하지 않아 작업 전용 경로를 명령 안에 지정해 다시 검사했습니다. 두 번째 검사도 서버·웹 시험은 모두 통과했으나 새 소유자 이름이 배포 검사 허용 목록에 빠져 종료했습니다. 목록을 보완한 뒤 해당 배포 검사 7개가 통과했습니다. 최종 통합 트리는 task finish에서 같은 작업 전용 환경으로 다시 검사합니다. 첫 작업 기록: /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--cli-20261020T140225.089338Z/receipt.json, 두 번째: /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--cli-20261020T141232.488050Z/receipt.json.
- 관련 시험: npm test -- --run test/geo-cli-export.test.ts (서버, 10개 통과); npm test -- --run src/geo/workflow/cli-export.test.tsx (웹, 2개 통과); npm run typecheck (서버, 통과). 카탈로그·설치 패키지·허브 등록 사본, 가져온 스킬의 설치 여부, 실행 권한, 한·영 문구, 잘못된 대상·언어·식별자, 경로·링크·ZIP 크기 제한을 시험했습니다.
- 새 문자열(변경 전에는 없음): workflowCli.export.button = CLI에서 쓰기 / Use in a CLI; workflowCli.target.title = CLI용 파일 내려받기 / Download CLI files; workflowCli.target.hint = 지침, 사용 스킬, 시작 안내를 ZIP으로 받습니다. 실행할 CLI를 고릅니다. / Get instructions, skills and a start guide as a ZIP. Choose the CLI you will use.; workflowCli.pi.button = Pi용 파일 받기 / Download for Pi; workflowCli.claude.button = Claude Code용 받기 / Download for Claude Code.
- UI 규칙: P1/P3/P4, B1–B3, D1/D4, T1, S1/S5, A1–A3, W1–W6. R1 적용 예외: 사용자가 요청한 CLI 내보내기 대상을 구분하기 위해 CLI 이름을 표시합니다. 팝오버에 모델·제공자·프롬프트·경로·로그는 표시하지 않습니다. 내보낸 지침은 요청한 파일에 포함합니다. UI 부채를 추가하지 않았습니다.
- 한국어 화면 점검: 실제 상세 화면이 아닌 임시 Vite 구성요소 시험 화면. 그림: figures/cli-export-1440.png and figures/cli-export-1280.png. 본문 약 100자, 안내 1문단, 내려받기 버튼 높이 32 px이며 가로 넘침이 없습니다. Escape로 닫으면 원래 버튼에 초점이 돌아옵니다. 상세 화면 배치는 부모 작업에서 담당합니다. Playwright 세션과 시험 서비스를 종료했습니다.


### 화면 구현 근거 (gaid-workflow-model--views)

- 공통 구성 화면: `web/src/geo/workflow/workflow-view.tsx`; 그림과 입출력 예시 재사용: `web/src/geo/hub/method-flow.tsx`.
- 적용 위치: 허브 등록 상세, 허브 초안, 프로젝트 Workflow 상세, 기본 Workflow 패널 상세, 허브 추천 상세, 시작 설정 요약.
- UI guide 적용: P1–P3, L6, B1, D2, F1/F4, A1–A3, Q4, R2. R1의 지시문 비표시 규칙은 사용자 요청과 승인된 Workflow 지침 ADR에 따라 이 문서에 한해 예외로 합니다. 시스템 지시나 실행 로그를 새로 공개하지 않습니다.
- 문자열: `workflowView.*`는 모두 신규(변경 전 없음). 한·영 전체 대응은 `web/src/geo/locales/workflowView/{ko,en}.json`. 주요 신규 문구: `workflowView.agentInstructions`: “AI agent가 받는 지침 보기” / “View instructions the AI agent receives”; `workflowView.instructions.button`: “지침 보기” / “Read instructions”; `workflowView.detail.button`: “Workflow 상세 보기” / “View Workflow details”; `workflowView.import.button`: “GitHub 등에서 가져오기” / “Import from GitHub or elsewhere”. 기존 문자열은 바꾸지 않았습니다.
- CLI 버튼은 허브 등록 상세와 프로젝트 Workflow 상세에 기본으로 표시하며 `exportAction` 슬롯으로 바꿀 수 있습니다. CLI 구현 파일은 수정하지 않았습니다.

- 화면 확인: 여섯 적용 위치를 한국어 1440×900, 1280×800에서 확인했습니다. 추가로 허브의 최종 지침도 두 크기로 캡처했습니다(총 14장). 단계 순서·그림 유지, 스킬 지침 읽기, 전체 선택지 표시, 시작 설정의 입력 반영, 브라우저 오류 0건을 확인했습니다. 모델 호출이나 설치는 하지 않았습니다.
- 화면의 코드 스냅샷: `4e214c0204bd`. 원본과 SHA-256 목록: `~/data/geoaidesk/work/gaid-workflow-model--views/playwright/screenshots.json`. 재현 경로: 같은 폴더의 `capture.js`; 데이터: `~/data/geoaidesk/work/gaid-workflow-model--views/home`(부모 시험 데이터의 격리 사본).
- 이전 형식에서 단계와 선택 조건을 연결한 정보가 없으면 결정 표시를 추정하지 않습니다. 전체 조건은 구성 화면과 최종 지침에서 읽을 수 있습니다. 새 형식의 결정 표시와 개요 단계 수는 `steps[].choiceIds`를 따릅니다.

- 최종 검사 중 기존 파일 미리보기의 저장 알림 타이머가 시험 환경이 닫힌 뒤 실행되는 간헐적 오류를 발견했습니다. 부모 작업자의 승인에 따라 `web/src/components/code-views.tsx`에서 타이머를 다시 예약하기 전과 편집기를 닫을 때 해제하도록 고쳤습니다. `web/src/components/file-preview-panel.test.tsx`의 관련 시험 8개와 프런트엔드 전체 시험 1,133개가 통과했습니다. 시험을 제외하거나 오류를 숨기지 않았습니다.

작성 시점: 1단계 2026-10-20 (commit 6bbd7fa), 최종 통합 2026-10-21 (task branch edd5eb4 위; CLI 근거 1da2f082, 화면 근거 4e214c0).

</details>
