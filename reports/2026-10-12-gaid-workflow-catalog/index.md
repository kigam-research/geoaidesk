---
title: workflow 목록 통합, 카테고리를 고르는 레시피 저장, skill_hub 스킬 가져오기
date: 2026-10-12
project: geoaidesk
task: gaid-workflow-catalog
headline: Geoscience 작업이 K-Dense workflow와 같은 목록·검색·카테고리 버튼으로 맨 앞에 나오고, 가져온 레시피를 고른 카테고리(새 카테고리 포함)에 저장해 다시 열 수 있으며, skill_hub 사이트에서 찾은 스킬을 기존 확인·설치 절차로 가져올 수 있습니다.
review_status: pending
decisions: 0
cover: figures/workflow-panel-desktop.png
supersedes:
---
# workflow 목록 통합, 카테고리를 고르는 레시피 저장, skill_hub 스킬 가져오기

## 0. 한눈에

| | |
|---|---|
| 요청 | 대화창 위 workflow 화면을 K-Dense workflow 디자인과 일관되게 바꾸고 Geoscience 카테고리를 추가하며, 레시피를 추가할 때 카테고리를 고르게 하고, skill_hub 사이트에서 스킬을 찾아 가져오는 연계를 검토해 적용합니다. |
| 결론 | Geoscience 작업 7개가 큰 카드 대신 K-Dense와 같은 한 줄 목록으로 맨 앞 카테고리에 나오며, 검색창과 카테고리 버튼을 함께 씁니다. 준비 상태·미시험·사용자 자료 필요는 배지로 남겼습니다. 레시피는 확인한 뒤 제목과 카테고리(Geoscience, K-Dense 카테고리, 새로 만든 카테고리)를 골라 프로젝트에 저장합니다. skill_hub 연계는 SKILL_HUB_SUMMARY |
| 믿을 수 있는 정도 | 자동 시험과 별도 인스턴스의 실제 브라우저 화면으로 확인했습니다. 사용자가 PC71에서 직접 써 본 체감은 아직 확인하지 않았습니다. |
| 결정할 일 | 없음 |

## 1. 요청한 것

> "그리고 세번째 이미지처럼 대화창 상단의 workflow를 클릭하면 Geoscience 작업에 대한 레시피가 표시되는데 기존 K-Dense workflow에서 제공하는 4번째 디자인과 같이 일관되게 ui를 개선해야하며, Geoscience 카테고리를 추가하고 workflow를 4번째 디자인과 같이 구성하는 것이 필요하다. 레시피를 추가할때 카테고리를 선택하게 하는 방식으로 해야 자유도와 기능 확장성을 만족할 수 있을 것이다. 그리고 스킬을 추가할 때에는 skill_hub 프로젝트에서 작업한 skill_hub 사이트를 클릭하여 스킬을 탐색하고 해당 사이트에서 스킬을 가져올 수 있게 연계하는 방안도 검토 후 적용해보아야 한다." — 2026-10-12 요청(같은 요청의 지도·표 부분은 다른 작업 gaid-map-table-ux가 맡습니다)

완료 기준: (1) workflow 화면에서 Geoscience 작업이 K-Dense 목록과 같은 형태(검색, 카테고리 버튼, 아이콘·제목·한 줄 설명·배지 행)로 Geoscience 카테고리에 나오고 준비 상태 표시는 유지합니다. (2) 레시피를 추가할 때 카테고리를 고릅니다. (3) skill_hub 사이트 연계를 검토해 적용하되, 스킬 설치 전 내용 확인과 사용자 동의 절차는 그대로 둡니다.

## 2. 수행한 것

1. K-Dense workflow 목록에 다른 카테고리와 행을 끼워 넣을 수 있는 작은 연결부를 만들고, 고정 카탈로그의 Geoscience 작업을 그 목록의 첫 카테고리로 넣었습니다. 검색은 두 목록을 함께 찾고, 행을 누르면 기존 작업 설정 창이 열립니다. 카드에 있던 입력 형식·예상 결과·해석 한계·환경 준비는 작업 설정 창으로 옮겼습니다.
2. 행의 배지는 K-Dense의 "Needs user data"와 같은 크기로 준비 상태(준비됨·스킬 필요·환경 준비 필요·사용 불가), 미시험, 사용자 자료 필요를 보여 줍니다. 미시험 배지에 마우스를 올리면 "미시험 · GAID 실행 기록 없음" 전체 문구가 나오고, 작업 설정 창에는 전체 문구가 그대로 있습니다.
3. "레시피 가져오기"를 레시피 파일 확인 → 제목·카테고리 선택 → 저장 순서로 바꿨습니다. 카테고리는 Geoscience, K-Dense 카테고리 22개, 이미 만든 카테고리, 새 카테고리 추가 중에서 고릅니다. 저장한 레시피는 그 카테고리의 행으로 나타나고, 누르면 레시피의 분석 조건이 채워진 작업 설정 창이 열립니다. 저장하지 않고 한 번만 여는 방법도 남겼습니다.
4. 저장한 레시피는 목록을 읽을 때마다 현재 카탈로그로 다시 확인합니다. 카탈로그가 바뀌어 맞지 않게 된 레시피는 지우지 않고 "사용 불가"로 보여 주며, 누르면 이유와 삭제 버튼이 나옵니다. 삭제는 두 번 눌러야 됩니다.
5. skill_hub 연계를 검토했습니다(5번 항목은 3절 "skill_hub 스킬 가져오기"에 정리).

## 3. 결과

### workflow 목록

![workflow 화면(넓은 화면). Geoscience 7개 작업이 K-Dense 카테고리와 같은 행 모양으로 맨 앞에 있고, 행마다 준비 상태·미시험·사용자 자료 필요 배지가 붙습니다. 오른쪽 위가 레시피 가져오기 버튼입니다.](figures/workflow-panel-desktop.png)

![좁은 화면(폭 420px). 배지가 줄을 바꿔 제목 아래로 내려가고, 카테고리 버튼은 가로로 밀어 봅니다.](figures/workflow-panel-narrow.png)

### 레시피 저장

![레시피 가져오기 창. 레시피 파일을 확인한 뒤 기반 작업 이름이 나오고, 제목과 카테고리를 고릅니다. 여기서는 새 카테고리 "현장 조사"를 만듭니다.](figures/recipe-add.png)

![저장 뒤 목록. 카테고리 버튼에 "현장 조사"가 Geoscience 바로 뒤에 생기고, 저장한 레시피가 "저장한 레시피" 배지와 기반 작업의 준비 상태 배지를 달고 나옵니다.](figures/recipe-saved.png)

![저장한 레시피를 연 작업 설정 창. 레시피의 심도 기준(MD)이 채워져 있고, 레시피에서 미결정으로 남긴 조건은 "작업 중 결정"으로 비어 있습니다. 창 아래에 레시피 삭제 버튼이 있습니다.](figures/recipe-setup.png)

- 레시피는 프로젝트별로 저장합니다. 다른 프로젝트에서는 보이지 않습니다.
- 레시피는 고정 카탈로그에 있는 작업의 분석 조건을 미리 채우는 파일입니다. 새 분석 절차(새 workflow)를 정의하지는 않습니다.

### skill_hub 스킬 가져오기

SKILL_HUB_SECTION

## 4. 검증

- 서버 자동 시험: 레시피 저장·새 카테고리 생성·같은 이름 카테고리 재사용·K-Dense 카테고리 저장·확인 실패 거부(이유 반환)·카탈로그가 꺼졌을 때 레시피 유지와 사용 불가 표시·마지막 레시피 삭제 시 빈 사용자 카테고리 제거·형식이 깨진 저장 파일을 덮어쓰지 않음.
- 화면 자동 시험: Geoscience가 첫 카테고리이고 K-Dense 카테고리가 이어짐, 검색이 두 목록을 함께 거름, 상태별 배지와 작업 설정 창의 전체 준비 상태 문구, 레시피 확인 실패 시 저장 불가, 새 카테고리로 저장 → 목록 표시 → 조건이 채워진 설정 → 두 번 눌러 삭제, 저장하지 않고 열기, 카탈로그와 맞지 않는 레시피의 이유 표시. 기존 환경 준비·스킬 켜기·작업 초안 시험도 새 화면 흐름으로 통과합니다.
- 전체 시험: CHECK_RESULT
- 실제 브라우저: 별도 인스턴스에서 고정 카탈로그 0.2.1로 3절 그림의 흐름(레시피 파일 확인, 새 카테고리 저장, 저장한 레시피 열기)을 확인했습니다.

## 5. 한계

- 저장한 레시피와 사용자 카테고리는 프로젝트마다 따로 있습니다. 여러 프로젝트에서 같이 쓰려면 프로젝트마다 다시 가져와야 합니다.
- 사용자 카테고리 이름 바꾸기·순서 바꾸기는 없습니다. 카테고리는 그 안의 마지막 레시피를 지우면 함께 없어집니다.
- K-Dense 카테고리 이름은 upstream 문구 그대로 영어로 보입니다.
- 미시험 배지는 이번 작업에서 바뀌지 않았습니다. GAID에서 실행 기록이 쌓인 작업이 없으므로 모든 Geoscience 작업이 미시험으로 나옵니다.
SKILL_HUB_LIMITS

## 6. 결정할 일

없음.

## 7. 대체되었거나 실패한 시도

- "K-Dense workflow 목록 보기/접기"로 두 목록을 따로 보여 주던 방식은 한 목록으로 합치며 없앴습니다.

## 부록 A. 근거 위치

- 목록 연결부: `web/src/components/workflows-panel.tsx` (`extension` prop, `WORKFLOW_CATEGORIES`; `geo/integration-boundaries.json`에 등록)
- Geoscience 행과 배지: `web/src/geo/workspace/task-catalogue.tsx`; 레시피 창: `web/src/geo/workspace/recipe-add.tsx`; 작업 설정: `web/src/geo/workspace/task-setup.tsx`
- 레시피 저장: `server/src/geo/workspace/saved-recipes.ts`, 경로 `GET/POST /geo/recipes`, `DELETE /geo/recipes/:id` (`server/src/geo/routes/workspace.ts`), 저장 파일 `<sandbox>/.kady/geo/recipes.json` (`gaid-saved-recipes/v1`), 계약 `web/src/geo/contracts/workspace.ts`
- 문구: `web/src/geo/locales/workspace/{ko,en}.json` (추가 id: `workspace.catalogue.category`, `.search`, `workspace.badge.*`, `workspace.recipe.{description,choose,title,category,userCategories,upstreamCategories,newCategory,newCategoryName,openOnce,save,saving,close}`, `workspace.saved.*`; 삭제 id: `workspace.catalogue.showUpstream` "K-Dense workflow 목록 보기", `workspace.catalogue.hideUpstream` "K-Dense workflow 목록 접기")
- 시험: `server/test/geo-workspace.test.ts`, `web/src/geo/workspace/workspace.test.tsx`
- 화면 확인: 인스턴스 포트 3320/18320, 데이터 `~/data/geoaidesk/work/gaid-workflow-catalog/`, 카탈로그 `~/assets/geo-catalogue/0.2.1/geo-catalogue-0.2.1.tar.gz`, 스크립트 `~/data/geoaidesk/work/gaid-workflow-catalog/scripts/shots.py`
SKILL_HUB_EVIDENCE
